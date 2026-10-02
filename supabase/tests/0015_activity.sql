-- =============================================================================
-- GIO4X · tests for 0015_activity
-- -----------------------------------------------------------------------------
-- Run as the migration role (on Supabase: postgres) AFTER 0015 is applied.
-- Everything happens inside one transaction that is rolled back: no row
-- survives, including the audit entries the triggers write.
--
-- What it does
--   1. Finds an existing admin in public.staff (the reader of the figures).
--   2. Creates a second, temporary member of staff with the role `support`
--      (a sign-in row in auth.users and a row in public.staff). Support holds
--      neither activity.read nor reports.read, and has no history, so the
--      figures expected of them are exact. If the sign-in row cannot be
--      created here, the admin does the work instead and the two checks that
--      need a second person are reported as SKIPPED (pass is null).
--   3. As that person, through the same paths the console uses: answers a
--      ticket opened 30 minutes ago, writes an internal note, solves it; takes
--      a live chat, answers it, closes it; takes an enquiry, moves its stage,
--      writes a note, adds a follow-up and completes it.
--   4. Reads staff_activity() and my_activity() and compares each figure with
--      what it was before (every expected difference is exactly 1).
--   5. Checks the refusals: staff without activity.read, a signed-in person
--      who is not staff, and the anonymous role.
--   6. Reads report_month() before and after and compares, checks its
--      refusals, and checks that record_report_download() writes one audit
--      entry and refuses a caller without reports.read.
--
-- The last statement before the rollback selects the results: one row per
-- check, `pass` true, false, or null for a check that was skipped.
-- =============================================================================

begin;

create temp table activity_test_results (
  n      integer generated always as identity,
  name   text not null,
  pass   boolean,
  detail text
) on commit drop;

do $test$
declare
  admin_id   uuid;
  temp_id    uuid := gen_random_uuid();
  has_temp   boolean := true;
  actor_id   uuid;
  outsider   uuid := gen_random_uuid();   -- signed in, not on staff: no row anywhere
  v_lead     uuid := gen_random_uuid();
  v_ticket   uuid := gen_random_uuid();
  v_chat     uuid;
  t_created  timestamptz := now() - interval '30 minutes';
  m_now      text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  m_ticket   text := to_char((now() - interval '30 minutes') at time zone 'UTC', 'YYYY-MM');
  before_row record;
  after_row  record;
  mine_count integer;
  mine_id    uuid;
  all_count  integer;
  staff_rows integer;
  rep_before jsonb;
  rep_after  jsonb;
  tkt_before jsonb;
  tkt_after  jsonb;
  audit_n    integer;
  state      text;
  refused    boolean;
  results    jsonb := '[]'::jsonb;
  r          jsonb;
begin
  -- ------------------------------------------------------------------ set-up
  select s.user_id into admin_id
  from public.staff s
  where s.active and s.role = 'admin'
  order by s.created_at
  limit 1;
  if admin_id is null then
    raise exception 'this test needs one active admin in public.staff';
  end if;

  begin
    insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    values (temp_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'test-activity-0015@example.invalid', now(), now());
    insert into public.staff (user_id, role, display_name)
    values (temp_id, 'support', 'Test Support (0015, rolled back)');
  exception when others then
    has_temp := false;
  end;
  actor_id := case when has_temp then temp_id else admin_id end;
  results := results || jsonb_build_object('name', 'set-up: temporary support member created', 'pass',
    case when has_temp then true else null end,
    'detail', case when has_temp then 'the work below is done by a fresh support member' else 'SKIPPED: auth.users could not be written here; the admin does the work instead' end);

  select count(*) into staff_rows from public.staff;

  -- ----------------------------------------------------- before: the admin reads
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select * into before_row from public.staff_activity(30) a where a.user_id = actor_id;
  rep_before := public.report_month(m_now);
  tkt_before := public.report_month(m_ticket);
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{}', true);

  -- rows a visitor would have created (no API role is set, so the throttles and clocks of the public path do not apply)
  insert into public.leads (id, reference, name, email, topic, message, privacy_accepted_at, privacy_version)
  values (v_lead, 'GX-ZZZZ2222', 'Test Visitor', 'test-activity-0015@example.invalid', 'General', '[TEST] 0015', now(), 'test');

  insert into public.tickets (id, reference, created_at, name, email, category, subject, message, privacy_accepted_at, privacy_version)
  values (v_ticket, 'TK-ZZZZ2222', t_created, 'Test Visitor', 'test-activity-0015@example.invalid', 'other', '[TEST] 0015', '[TEST] 0015', now(), 'test');

  insert into public.chat_conversations (token_hash, visitor_name, page)
  values (encode(sha256(convert_to('test-activity-0015', 'UTF8')), 'hex'), 'Test Visitor', '/')
  returning id into v_chat;
  insert into public.chat_messages (conversation_id, author_kind, author, body) values (v_chat, 'visitor', null, '[TEST] 0015');

  -- month-level rows that are not anybody's activity
  insert into public.newsletter_subscribers (email, source, consent_at, consent_version)
  values ('test-activity-0015-sub@example.invalid', 'test', now(), 'test');
  insert into public.blog_posts (slug, title, status, published_at)
  values ('test-activity-0015', '[TEST] 0015', 'published', now());
  insert into public.incidents (title, component, severity) values ('[TEST] 0015', 'website', 'notice');

  -- --------------------------------------------------- the work, as the actor
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- ticket: a reply to the customer (answers it, takes it), an internal note, solved
  insert into public.ticket_messages (ticket_id, body, internal) values (v_ticket, '[TEST] reply', false);
  insert into public.ticket_messages (ticket_id, body, internal) values (v_ticket, '[TEST] note', true);
  update public.tickets t set status = 'solved' where t.id = v_ticket;

  -- live chat: take it, answer, close
  perform public.chat_staff_claim(v_chat);
  perform public.chat_staff_send(v_chat, '[TEST] reply');
  perform public.chat_staff_close(v_chat);

  -- enquiry: take it and move its stage, a note, a follow-up completed
  update public.leads l set assigned_to = actor_id, stage = 'contacted' where l.id = v_lead;
  insert into public.lead_notes (lead_id, body) values (v_lead, '[TEST] note');
  insert into public.lead_tasks (lead_id, title, due_at, assigned_to) values (v_lead, '[TEST] follow-up', now() + interval '1 day', actor_id);
  update public.lead_tasks k set done = true where k.lead_id = v_lead;

  -- the actor's own view
  select count(*), min(a.user_id::text)::uuid into mine_count, mine_id from public.my_activity(30) a;

  -- a member of staff without activity.read is refused the team view
  refused := false;
  if has_temp then
    begin
      perform count(*) from public.staff_activity(30);
    exception when insufficient_privilege then
      refused := true;
    end;
  end if;
  results := results || jsonb_build_object('name', 'staff_activity refuses staff without activity.read', 'pass',
    case when has_temp then refused else null end,
    'detail', case when has_temp then 'role support' else 'SKIPPED: no second member of staff' end);

  -- and without reports.read, the monthly summary and the record of its download
  refused := false;
  if has_temp then
    begin
      perform public.report_month(m_now);
    exception when insufficient_privilege then
      refused := true;
    end;
  end if;
  results := results || jsonb_build_object('name', 'report_month refuses staff without reports.read', 'pass',
    case when has_temp then refused else null end,
    'detail', case when has_temp then 'role support' else 'SKIPPED: no second member of staff' end);

  refused := false;
  if has_temp then
    begin
      perform public.record_report_download(m_now);
    exception when insufficient_privilege then
      refused := true;
    end;
  end if;
  results := results || jsonb_build_object('name', 'record_report_download refuses staff without reports.read', 'pass',
    case when has_temp then refused else null end,
    'detail', case when has_temp then 'role support' else 'SKIPPED: no second member of staff' end);

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{}', true);

  results := results || jsonb_build_object('name', 'my_activity returns exactly one row, the caller''s own', 'pass',
    mine_count = 1 and mine_id = actor_id and staff_rows >= case when has_temp then 2 else 1 end,
    'detail', format('rows %s, staff on file %s', mine_count, staff_rows));

  -- ------------------------------------------------------ after: the admin reads
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into all_count from public.staff_activity(30);
  select * into after_row from public.staff_activity(30) a where a.user_id = actor_id;
  rep_after := public.report_month(m_now);
  tkt_after := public.report_month(m_ticket);

  -- the admin's own view is one row too
  select count(*), min(a.user_id::text)::uuid into mine_count, mine_id from public.my_activity(30) a;

  -- malformed months are refused, not guessed at
  state := 'accepted';
  begin
    perform public.report_month('2026-13');
  exception when others then
    state := sqlstate;
  end;
  results := results || jsonb_build_object('name', 'report_month refuses a malformed month', 'pass', state = '22023', 'detail', state);

  -- the download is recorded, once, as the caller
  perform public.record_report_download(m_now);
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{}', true);

  select count(*) into audit_n
  from public.audit_log a
  where a.action = 'report.download' and a.entity = 'report' and a.entity_id = m_now and a.actor = admin_id and a.at = now();
  results := results || jsonb_build_object('name', 'record_report_download writes one audit entry as the caller', 'pass', audit_n = 1, 'detail', format('entries %s', audit_n));

  results := results || jsonb_build_object('name', 'staff_activity lists every member of staff, active or not', 'pass', all_count = staff_rows,
    'detail', format('rows %s, staff on file %s', all_count, staff_rows));
  results := results || jsonb_build_object('name', 'my_activity for the admin is one row, their own', 'pass', mine_count = 1 and mine_id = admin_id,
    'detail', format('rows %s', mine_count));

  -- each figure moved by exactly what was done
  results := results
    || jsonb_build_object('name', 'tickets_assigned +1', 'pass', after_row.tickets_assigned - before_row.tickets_assigned = 1,
         'detail', format('%s -> %s', before_row.tickets_assigned, after_row.tickets_assigned))
    || jsonb_build_object('name', 'tickets_replied +1', 'pass', after_row.tickets_replied - before_row.tickets_replied = 1,
         'detail', format('%s -> %s', before_row.tickets_replied, after_row.tickets_replied))
    || jsonb_build_object('name', 'first_replies +1', 'pass', after_row.first_replies - before_row.first_replies = 1,
         'detail', format('%s -> %s', before_row.first_replies, after_row.first_replies))
    || jsonb_build_object('name', 'first_reply_median_minutes is 30.0 for a ticket opened 30 minutes ago',
         'pass', case when before_row.first_replies = 0 then after_row.first_reply_median_minutes = 30.0 else after_row.first_reply_median_minutes is not null end,
         'detail', format('%s (first replies before: %s; exact only when that is 0)', after_row.first_reply_median_minutes, before_row.first_replies))
    || jsonb_build_object('name', 'tickets_solved +1', 'pass', after_row.tickets_solved - before_row.tickets_solved = 1,
         'detail', format('%s -> %s', before_row.tickets_solved, after_row.tickets_solved))
    || jsonb_build_object('name', 'ticket_notes +1', 'pass', after_row.ticket_notes - before_row.ticket_notes = 1,
         'detail', format('%s -> %s', before_row.ticket_notes, after_row.ticket_notes))
    || jsonb_build_object('name', 'chats_claimed +1', 'pass', after_row.chats_claimed - before_row.chats_claimed = 1,
         'detail', format('%s -> %s', before_row.chats_claimed, after_row.chats_claimed))
    || jsonb_build_object('name', 'chat_messages +1', 'pass', after_row.chat_messages - before_row.chat_messages = 1,
         'detail', format('%s -> %s', before_row.chat_messages, after_row.chat_messages))
    || jsonb_build_object('name', 'chats_closed +1', 'pass', after_row.chats_closed - before_row.chats_closed = 1,
         'detail', format('%s -> %s', before_row.chats_closed, after_row.chats_closed))
    || jsonb_build_object('name', 'leads_assigned +1', 'pass', after_row.leads_assigned - before_row.leads_assigned = 1,
         'detail', format('%s -> %s', before_row.leads_assigned, after_row.leads_assigned))
    || jsonb_build_object('name', 'lead_notes +1', 'pass', after_row.lead_notes - before_row.lead_notes = 1,
         'detail', format('%s -> %s', before_row.lead_notes, after_row.lead_notes))
    || jsonb_build_object('name', 'tasks_completed +1', 'pass', after_row.tasks_completed - before_row.tasks_completed = 1,
         'detail', format('%s -> %s', before_row.tasks_completed, after_row.tasks_completed))
    || jsonb_build_object('name', 'stage_changes +1', 'pass', after_row.stage_changes - before_row.stage_changes = 1,
         'detail', format('%s -> %s', before_row.stage_changes, after_row.stage_changes))
    || jsonb_build_object('name', 'last_activity is this transaction', 'pass', after_row.last_activity = now(),
         'detail', format('%s', after_row.last_activity))
    || jsonb_build_object('name', 'the row carries name, role and active', 'pass',
         after_row.display_name is not null and after_row.role = case when has_temp then 'support' else 'admin' end and after_row.active,
         'detail', format('%s, %s', after_row.role, after_row.active));

  -- the month, before and after
  results := results
    || jsonb_build_object('name', 'report_month: enquiries +1', 'pass',
         (rep_after #>> '{leads,total}')::integer - (rep_before #>> '{leads,total}')::integer = 1,
         'detail', format('%s -> %s', rep_before #>> '{leads,total}', rep_after #>> '{leads,total}'))
    || jsonb_build_object('name', 'report_month: sources add up to the total', 'pass',
         (select coalesce(sum((x ->> 'count')::integer), 0) from jsonb_array_elements(rep_after #> '{leads,by_source}') x)
           + (rep_after #>> '{leads,other_sources}')::integer = (rep_after #>> '{leads,total}')::integer,
         'detail', format('other sources %s', rep_after #>> '{leads,other_sources}'))
    || jsonb_build_object('name', 'report_month: topics add up to the total', 'pass',
         (select coalesce(sum((x ->> 'count')::integer), 0) from jsonb_array_elements(rep_after #> '{leads,by_topic}') x)
           = (rep_after #>> '{leads,total}')::integer,
         'detail', rep_after #>> '{leads,total}')
    || jsonb_build_object('name', 'report_month: tickets opened +1 (in the month the ticket was opened)', 'pass',
         (tkt_after #>> '{tickets,opened}')::integer - (tkt_before #>> '{tickets,opened}')::integer = 1,
         'detail', format('%s: %s -> %s', m_ticket, tkt_before #>> '{tickets,opened}', tkt_after #>> '{tickets,opened}'))
    || jsonb_build_object('name', 'report_month: tickets answered +1 (in the month the ticket was opened)', 'pass',
         (tkt_after #>> '{tickets,answered}')::integer - (tkt_before #>> '{tickets,answered}')::integer = 1,
         'detail', format('%s -> %s', tkt_before #>> '{tickets,answered}', tkt_after #>> '{tickets,answered}'))
    || jsonb_build_object('name', 'report_month: median first reply is a number once a ticket is answered', 'pass',
         jsonb_typeof(tkt_after #> '{tickets,first_response_median_minutes}') = 'number',
         'detail', tkt_after #>> '{tickets,first_response_median_minutes}')
    || jsonb_build_object('name', 'report_month: tickets solved +1', 'pass',
         (rep_after #>> '{tickets,solved}')::integer - (rep_before #>> '{tickets,solved}')::integer = 1,
         'detail', format('%s -> %s', rep_before #>> '{tickets,solved}', rep_after #>> '{tickets,solved}'))
    || jsonb_build_object('name', 'report_month: chats started +1, answered +1', 'pass',
         (rep_after #>> '{chats,started}')::integer - (rep_before #>> '{chats,started}')::integer = 1
         and (rep_after #>> '{chats,answered}')::integer - (rep_before #>> '{chats,answered}')::integer = 1,
         'detail', format('started %s -> %s', rep_before #>> '{chats,started}', rep_after #>> '{chats,started}'))
    || jsonb_build_object('name', 'report_month: newsletter joined +1, left unchanged', 'pass',
         (rep_after #>> '{subscribers,joined}')::integer - (rep_before #>> '{subscribers,joined}')::integer = 1
         and (rep_after #>> '{subscribers,left}') = (rep_before #>> '{subscribers,left}'),
         'detail', format('joined %s -> %s', rep_before #>> '{subscribers,joined}', rep_after #>> '{subscribers,joined}'))
    || jsonb_build_object('name', 'report_month: follow-ups created +1, completed +1', 'pass',
         (rep_after #>> '{follow_ups,created}')::integer - (rep_before #>> '{follow_ups,created}')::integer = 1
         and (rep_after #>> '{follow_ups,completed}')::integer - (rep_before #>> '{follow_ups,completed}')::integer = 1,
         'detail', format('created %s -> %s', rep_before #>> '{follow_ups,created}', rep_after #>> '{follow_ups,created}'))
    || jsonb_build_object('name', 'report_month: blog posts published +1', 'pass',
         (rep_after #>> '{blog,published}')::integer - (rep_before #>> '{blog,published}')::integer = 1,
         'detail', format('%s -> %s', rep_before #>> '{blog,published}', rep_after #>> '{blog,published}'))
    || jsonb_build_object('name', 'report_month: incidents created +1, published unchanged', 'pass',
         (rep_after #>> '{incidents,created}')::integer - (rep_before #>> '{incidents,created}')::integer = 1
         and (rep_after #>> '{incidents,published}') = (rep_before #>> '{incidents,published}'),
         'detail', format('%s -> %s', rep_before #>> '{incidents,created}', rep_after #>> '{incidents,created}'))
    || jsonb_build_object('name', 'report_month: the range is the calendar month in UTC and the current month is not complete', 'pass',
         (rep_after ->> 'from')::timestamptz = make_timestamptz(substr(m_now, 1, 4)::integer, substr(m_now, 6, 2)::integer, 1, 0, 0, 0, 'UTC')
         and (rep_after ->> 'to')::timestamptz > now()
         and (rep_after ->> 'complete')::boolean = false,
         'detail', format('%s to %s', rep_after ->> 'from', rep_after ->> 'to'));

  -- ------------------------------------- signed in but not staff: refused everywhere
  perform set_config('request.jwt.claims', jsonb_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  state := '';
  begin
    perform count(*) from public.staff_activity(30);
    state := state || 'staff_activity accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from public.my_activity(30);
    state := state || 'my_activity accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.report_month(m_now);
    state := state || 'report_month accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.record_report_download(m_now);
    state := state || 'record_report_download accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  perform set_config('role', 'none', true);
  results := results || jsonb_build_object('name', 'a signed-in person who is not staff is refused by all four functions', 'pass', state = '', 'detail', coalesce(nullif(state, ''), 'all refused'));

  -- ------------------------------------------------ anonymous: may not even call
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
  state := '';
  begin
    perform count(*) from public.staff_activity(30);
    state := state || 'staff_activity accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from public.my_activity(30);
    state := state || 'my_activity accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.report_month(m_now);
    state := state || 'report_month accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.record_report_download(m_now);
    state := state || 'record_report_download accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from public.staff_activity_rows(now() - interval '30 days', null);
    state := state || 'staff_activity_rows accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{}', true);
  results := results || jsonb_build_object('name', 'the anonymous role cannot execute any of the five functions', 'pass', state = '', 'detail', coalesce(nullif(state, ''), 'all refused'));

  -- the internal function is not reachable by a signed-in member of staff either
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  refused := false;
  begin
    perform count(*) from public.staff_activity_rows(now() - interval '30 days', null);
  exception when insufficient_privilege then
    refused := true;
  end;
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{}', true);
  results := results || jsonb_build_object('name', 'staff_activity_rows is not callable through the API, even by an admin', 'pass', refused, 'detail', '');

  -- the capability went to admin and compliance, and to nobody else
  results := results || jsonb_build_object('name', 'activity.read is held by admin and compliance only', 'pass',
    (select array_agg(rc.role order by rc.role) from public.role_capabilities rc where rc.capability = 'activity.read') = array['admin', 'compliance'],
    'detail', (select string_agg(rc.role, ', ' order by rc.role) from public.role_capabilities rc where rc.capability = 'activity.read'));

  for r in select * from jsonb_array_elements(results) loop
    insert into activity_test_results (name, pass, detail) values (r ->> 'name', (r ->> 'pass')::boolean, r ->> 'detail');
  end loop;
end
$test$;

select n, case when pass is null then 'SKIPPED' when pass then 'pass' else 'FAIL' end as result, name, detail
from activity_test_results
order by n;

rollback;
