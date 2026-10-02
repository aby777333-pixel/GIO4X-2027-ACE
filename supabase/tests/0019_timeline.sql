-- =============================================================================
-- GIO4X · tests for 0019_timeline
-- -----------------------------------------------------------------------------
-- Run as the migration role (on Supabase: postgres) AFTER 0019 is applied.
-- Everything happens inside one transaction that is rolled back: no row
-- survives, including the audit entries the triggers write and the changes this
-- script makes to role_capabilities for one temporary role.
--
-- What it does
--   1. Finds an existing admin in public.staff.
--   2. Creates four temporary members of staff (sign-in rows in auth.users and
--      rows in public.staff): `support` (may write notes, can be mentioned),
--      `viewer` (reads customers, may NOT write notes, can be mentioned), an
--      `agent` who is switched off (must never be mentioned) and `dealing`
--      (holds neither customers.read, leads.read nor tickets.read to begin
--      with). If the sign-in rows cannot be created here, the checks that need
--      a second person are reported as SKIPPED (pass is null).
--   3. Builds a small history for ONE address, test-timeline-0019@example.invalid:
--        7 days ago   subscribed to the newsletter
--        6 days ago   an enquiry from the website
--        5 days ago   a note on that enquiry
--        4 days ago   a ticket opened
--        3 days ago   a message from the customer (longer than one line)
--        2 days ago   a reply from staff
--        1 day ago    an internal note on the ticket
--        12 hours ago unsubscribed
--        now          the ticket was escalated and its status changed (the
--                     reply answered it), the enquiry's status and stage
--                     changed, a follow-up was created and completed, and two
--                     notes were written about the person, with mentions.
--      Rows a visitor would have created are inserted without an API role, so
--      their times can be set; everything staff do is done as that member of
--      staff through the same paths the console uses.
--   4. Reads person_timeline() and checks the order, the paging, the filter
--      and what each row carries.
--   5. Gives the temporary `dealing` role one capability at a time and checks
--      that each kind of event appears only with the capability for it.
--   6. Checks person_notes: who may write, that nothing can be changed or
--      removed through the API, who a mention can reach, the audit entry.
--   7. Checks my_mentions() and staff_mentionable(), and every refusal.
--
-- The last statement before the rollback selects the results: one row per
-- check, `pass` true, false, or null for a check that was skipped.
-- =============================================================================

begin;

create temp table timeline_test_results (
  n      integer generated always as identity,
  name   text not null,
  pass   boolean,
  detail text
) on commit drop;

do $test$
declare
  admin_id   uuid;
  admin_name text;
  sup_id     uuid := gen_random_uuid();
  view_id    uuid := gen_random_uuid();
  off_id     uuid := gen_random_uuid();
  deal_id    uuid := gen_random_uuid();
  outsider   uuid := gen_random_uuid();   -- signed in, not on staff: no row anywhere
  nobody     uuid := gen_random_uuid();   -- an id that belongs to no one
  has_temp   boolean := true;
  sup_name   constant text := 'Test Support 0019';
  view_name  constant text := 'Test Viewer 0019';
  off_name   constant text := 'Test Inactive 0019';
  addr       constant text := 'test-timeline-0019@example.invalid';
  k          text;
  v_lead     uuid := gen_random_uuid();
  v_ticket   uuid := gen_random_uuid();
  note1      uuid;
  note2      uuid;
  got1       uuid[];
  got2       uuid[];
  esc        text;
  n          integer;
  n2         integer;
  sig        text;
  tail       text;
  heads      text;
  ok         boolean;
  ids        text[] := '{}'::text[];
  page_n     integer[] := '{}'::integer[];
  page_more  boolean[] := '{}'::boolean[];
  cursor_at  timestamptz;
  rec        record;
  state      text;
  refused    boolean;
  results    jsonb := '[]'::jsonb;
  r          jsonb;
  all_kinds  constant text :=
    'enquiry_note,enquiry_received,enquiry_stage,enquiry_status,followup_completed,followup_created,'
    || 'newsletter_joined,newsletter_left,person_note,ticket_customer_message,ticket_escalated,'
    || 'ticket_internal_note,ticket_opened,ticket_staff_reply,ticket_status';
begin
  -- ------------------------------------------------------------------ set-up
  select s.user_id, s.display_name into admin_id, admin_name
  from public.staff s
  where s.active and s.role = 'admin'
  order by s.created_at
  limit 1;
  if admin_id is null then
    raise exception 'this test needs one active admin in public.staff';
  end if;

  begin
    insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
      (sup_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-0019-support@example.invalid', now(), now()),
      (view_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-0019-viewer@example.invalid', now(), now()),
      (off_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-0019-inactive@example.invalid', now(), now()),
      (deal_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-0019-dealing@example.invalid', now(), now());
    insert into public.staff (user_id, role, display_name, active) values
      (sup_id, 'support', sup_name, true),
      (view_id, 'viewer', view_name, true),
      (off_id, 'agent', off_name, false),
      (deal_id, 'dealing', 'Test Dealing 0019', true);
  exception when others then
    has_temp := false;
  end;
  results := results || jsonb_build_object('name', 'set-up: four temporary members of staff created', 'pass',
    case when has_temp then true else null end,
    'detail', case when has_temp then 'support, viewer, a switched-off agent, dealing' else 'SKIPPED: auth.users could not be written here; checks that need a second person are skipped' end);

  -- the temporary dealing role starts with the audit log and nothing about people
  delete from public.role_capabilities rc
  where rc.role = 'dealing' and rc.capability in ('customers.read', 'customers.note', 'leads.read', 'tickets.read');
  insert into public.role_capabilities (role, capability) values ('dealing', 'audit.read') on conflict do nothing;

  k := public.person_key(addr);

  -- ------------------------------------------- the history a visitor would have made
  -- (no API role is set, so the throttles and clocks of the public paths do not apply)
  insert into public.newsletter_subscribers (email, created_at, source, consent_at, consent_version, unsubscribed_at)
  values (addr, now() - interval '7 days', 'test', now() - interval '7 days', 'test', now() - interval '12 hours');

  insert into public.leads (id, reference, created_at, name, email, topic, message, privacy_accepted_at, privacy_version)
  values (v_lead, 'GX-ZZZZ3333', now() - interval '6 days', 'Test Visitor', addr, 'General', '[TEST] 0019', now() - interval '6 days', 'test');

  insert into public.lead_notes (lead_id, author, body, created_at)
  values (v_lead, admin_id, '[TEST] 0019 note on the enquiry', now() - interval '5 days');

  insert into public.tickets (id, reference, created_at, name, email, category, subject, message, privacy_accepted_at, privacy_version)
  values (v_ticket, 'TK-ZZZZ3333', now() - interval '4 days', 'Test Visitor', addr, 'other', '[TEST] 0019 subject', '[TEST] 0019', now() - interval '4 days', 'test');

  -- longer than one line: the timeline must cut it to 160 characters
  insert into public.ticket_messages (ticket_id, created_at, author_kind, author, internal, body)
  values (v_ticket, now() - interval '3 days', 'customer', null, false, '[TEST] 0019 customer message ' || repeat('word ', 60));

  -- the ticket is four days old, open and unanswered: late. The admin escalates it.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  esc := public.ticket_escalate(v_ticket);
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{}', true);
  results := results || jsonb_build_object('name', 'set-up: the late ticket was escalated', 'pass', esc = 'escalated', 'detail', esc);

  -- the reply (it answers the ticket: status open to pending, recorded now) and an internal note
  insert into public.ticket_messages (ticket_id, created_at, author_kind, author, internal, body)
  values (v_ticket, now() - interval '2 days', 'staff', admin_id, false, '[TEST] 0019 reply');
  insert into public.ticket_messages (ticket_id, created_at, author_kind, author, internal, body)
  values (v_ticket, now() - interval '1 day', 'staff', admin_id, true, '[TEST] 0019 internal note');

  -- ----------------------------------------------------- the work, as the admin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  update public.leads l set status = 'open', stage = 'contacted' where l.id = v_lead;
  insert into public.lead_tasks (lead_id, title, due_at, assigned_to) values (v_lead, '[TEST] 0019 follow-up', now() + interval '1 day', admin_id);
  update public.lead_tasks t set done = true where t.lead_id = v_lead;

  -- who can be mentioned, before anything about the dealing role changes
  select count(*) filter (where m.user_id in (sup_id, view_id)),
         count(*) filter (where m.user_id in (off_id, deal_id, admin_id))
  into n, n2
  from public.staff_mentionable() m;
  results := results || jsonb_build_object('name', 'staff_mentionable lists active staff who can open a customer record, without the caller', 'pass',
    case when has_temp then n = 2 and n2 = 0 else n2 = 0 end,
    'detail', format('expected present %s of 2, expected absent %s of 0', n, n2));

  -- two notes about the person. The ids sent are deliberately wrong in every way a browser could be wrong.
  insert into public.person_notes (person_key, body, mentions)
  values (k, '[TEST] 0019 first note @' || sup_name || ' please look',
          array[sup_id, view_id, off_id, nobody, admin_id])
  returning id, mentions into note1, got1;

  insert into public.person_notes (person_key, body, mentions)
  values (k, '[TEST] 0019 second note @' || sup_name || ' @' || view_name || ' @' || off_name,
          array[sup_id, view_id, off_id, nobody, admin_id])
  returning id, mentions into note2, got2;

  results := results
    || jsonb_build_object('name', 'mentions: a colleague who is named and active is kept; one who is not named is dropped', 'pass',
         case when has_temp then got1 = array[sup_id] else got1 = '{}'::uuid[] end,
         'detail', format('%s kept', coalesce(array_length(got1, 1), 0)))
    || jsonb_build_object('name', 'mentions: a switched-off member of staff, an unknown id and the author are never kept, even when named', 'pass',
         case when has_temp then got2 = array[sup_id, view_id] else got2 = '{}'::uuid[] end,
         'detail', format('%s kept', coalesce(array_length(got2, 1), 0)));

  -- ------------------------------------------------- the timeline, as the admin
  select count(*),
         coalesce(string_agg(t.kind, ',' order by t.rn) filter (where t.at < now()), ''),
         coalesce(string_agg(t.kind, ',' order by t.kind) filter (where t.at = now()), ''),
         bool_and(t.prev_at is null or t.at <= t.prev_at),
         bool_and(not t.has_older)
  into n, tail, heads, ok, refused
  from (
    select x.*, lag(x.at) over (order by x.rn) as prev_at
    from (select y.*, row_number() over () as rn from public.person_timeline(k, 100) y) x
  ) t;

  results := results
    || jsonb_build_object('name', 'timeline: every event of the history is there, once', 'pass', n = 16, 'detail', format('%s events', n))
    || jsonb_build_object('name', 'timeline: newest first, never out of order', 'pass', ok, 'detail', '')
    || jsonb_build_object('name', 'timeline: the dated events come in exactly the order they happened, newest first', 'pass',
         tail = 'newsletter_left,ticket_internal_note,ticket_staff_reply,ticket_customer_message,ticket_opened,enquiry_note,enquiry_received,newsletter_joined',
         'detail', tail)
    || jsonb_build_object('name', 'timeline: what was done in this transaction is at the top', 'pass',
         heads = 'enquiry_stage,enquiry_status,followup_completed,followup_created,person_note,person_note,ticket_escalated,ticket_status',
         'detail', heads)
    || jsonb_build_object('name', 'timeline: has_older is false when everything fits on the page', 'pass', refused, 'detail', '');

  -- within one instant, what changed is listed above what was written
  select max(x.rn) filter (where x.kind in ('enquiry_stage', 'enquiry_status', 'followup_completed', 'ticket_escalated', 'ticket_status')),
         min(x.rn) filter (where x.kind in ('followup_created', 'person_note'))
  into n, n2
  from (select y.*, row_number() over () as rn from public.person_timeline(k, 100) y) x
  where x.at = now();
  results := results || jsonb_build_object('name', 'timeline: events sharing one instant are ordered, changes above what was written', 'pass', n < n2,
    'detail', format('last change at row %s, first written at row %s', n, n2));

  -- what a row carries
  select t.actor = admin_id and t.actor_name = admin_name and t.entity = 'lead' and t.entity_id = v_lead::text
         and t.reference = 'GX-ZZZZ3333' and t.detail ->> 'from' = 'enquiry' and t.detail ->> 'to' = 'contacted'
  into ok
  from public.person_timeline(k, 100) t where t.kind = 'enquiry_stage';
  results := results || jsonb_build_object('name', 'timeline: a stage change carries who made it, the enquiry it links to, and from and to', 'pass', coalesce(ok, false), 'detail', '');

  select char_length(t.summary) = 160 and right(t.summary, 3) = '...' and position(E'\n' in t.summary) = 0
         and t.actor is null and t.actor_name is null and t.reference = 'TK-ZZZZ3333'
  into ok
  from public.person_timeline(k, 100) t where t.kind = 'ticket_customer_message';
  results := results || jsonb_build_object('name', 'timeline: a long message is cut to one line of 160 characters, and a customer has no staff name', 'pass', coalesce(ok, false), 'detail', '');

  select (t.detail ->> 'internal')::boolean and t.actor = admin_id
  into ok
  from public.person_timeline(k, 100) t where t.kind = 'ticket_internal_note';
  results := results || jsonb_build_object('name', 'timeline: an internal note on a ticket is included and marked internal', 'pass', coalesce(ok, false), 'detail', '');

  select count(*) = 2 and bool_and(t.entity = 'person' and t.entity_id in (note1::text, note2::text) and t.actor = admin_id)
  into ok
  from public.person_timeline(k, 100) t where t.kind = 'person_note';
  results := results || jsonb_build_object('name', 'timeline: the notes about the person are in it, linked to the note', 'pass', coalesce(ok, false), 'detail', '');

  -- paging, three at a time: nothing lost, nothing twice, ties kept together
  cursor_at := null;
  for step in 1..8 loop
    select count(*)::integer as rows_n, min(t.at) as oldest,
           coalesce(bool_or(t.has_older), false) as more, coalesce(array_agg(t.id), '{}'::text[]) as page_ids
    into rec
    from public.person_timeline(k, 3, cursor_at) t;
    exit when rec.rows_n = 0;
    page_n := page_n || rec.rows_n;
    page_more := page_more || rec.more;
    ids := ids || rec.page_ids;
    cursor_at := rec.oldest;
    exit when not rec.more;
  end loop;
  results := results
    || jsonb_build_object('name', 'paging: pages of three, with the eight events of one instant kept on one page', 'pass',
         page_n = array[8, 3, 3, 2], 'detail', array_to_string(page_n, ', '))
    || jsonb_build_object('name', 'paging: has_older is true until the last page', 'pass',
         page_more = array[true, true, true, false], 'detail', array_to_string(page_more, ', '))
    || jsonb_build_object('name', 'paging: every event is returned exactly once across the pages', 'pass',
         coalesce(array_length(ids, 1), 0) = 16 and (select count(distinct i) from unnest(ids) i) = 16,
         'detail', format('%s rows', coalesce(array_length(ids, 1), 0)));

  -- the filter
  select count(*), coalesce(string_agg(distinct t.kind, ',' order by t.kind), '') into n, sig
  from public.person_timeline(k, 100, null, array['person_note', 'enquiry_note', 'ticket_internal_note']) t;
  results := results || jsonb_build_object('name', 'filter: only the kinds asked for are returned', 'pass',
    n = 4 and sig = 'enquiry_note,person_note,ticket_internal_note', 'detail', format('%s rows: %s', n, sig));

  -- a key nobody has, and one that is not a key
  select count(*) into n from public.person_timeline(repeat('0', 32), 100);
  select count(*) into n2 from public.person_timeline('not-a-key', 100);
  results := results || jsonb_build_object('name', 'timeline: an unknown or malformed key returns nothing', 'pass', n = 0 and n2 = 0, 'detail', '');

  -- --------------------------------------------- notes: append-only through the API
  refused := false;
  begin
    update public.person_notes pn set body = '[TEST] changed' where pn.id = note1;
  exception when insufficient_privilege then
    refused := true;
  end;
  results := results || jsonb_build_object('name', 'notes: a note cannot be updated through the API, even by an admin', 'pass', refused, 'detail', '');

  refused := false;
  begin
    delete from public.person_notes pn where pn.id = note1;
  exception when insufficient_privilege then
    refused := true;
  end;
  results := results || jsonb_build_object('name', 'notes: a note cannot be deleted through the API, even by an admin', 'pass', refused, 'detail', '');

  state := 'accepted';
  begin
    insert into public.person_notes (person_key, body) values (repeat('0', 32), '[TEST] 0019 nobody');
  exception when others then
    state := sqlstate;
  end;
  results := results || jsonb_build_object('name', 'notes: a note about a key nobody has is refused', 'pass', state = 'P0002', 'detail', state);

  state := 'accepted';
  begin
    insert into public.person_notes (person_key, body) values (k, repeat('x', 2001));
  exception when others then
    state := sqlstate;
  end;
  results := results || jsonb_build_object('name', 'notes: more than 2,000 characters is refused', 'pass', state = '23514', 'detail', state);

  state := 'accepted';
  begin
    insert into public.person_notes (person_key, body, author) values (k, '[TEST] 0019 as somebody else', sup_id);
  exception when insufficient_privilege then
    state := 'refused';
  end;
  results := results || jsonb_build_object('name', 'notes: the author cannot be supplied by the caller', 'pass', state = 'refused', 'detail', state);

  -- the admin was named in both notes, by themselves: that is not a mention
  select count(*) into n from public.my_mentions(50) m where m.note_id in (note1, note2);
  results := results || jsonb_build_object('name', 'my_mentions: the author is not told about their own note', 'pass', n = 0, 'detail', format('%s rows', n));

  -- the internal helper is not reachable through the API
  refused := false;
  begin
    perform public.timeline_excerpt('x');
  exception when insufficient_privilege then
    refused := true;
  end;
  results := results || jsonb_build_object('name', 'timeline_excerpt is not callable through the API, even by an admin', 'pass', refused, 'detail', '');

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{}', true);

  -- what was stored
  select count(*), bool_and(pn.author = admin_id and pn.created_at = now() and pn.body like '[TEST] 0019 % note %')
  into n, ok
  from public.person_notes pn where pn.person_key = k;
  results := results || jsonb_build_object('name', 'notes: two notes stored, unchanged, by the caller, at the database clock', 'pass', n = 2 and ok, 'detail', format('%s notes', n));

  select count(*), bool_and(a.detail::text not like '%TEST%' and a.detail ? 'note_id')
  into n, ok
  from public.audit_log a
  where a.action = 'person.note' and a.entity = 'person' and a.entity_id = k and a.actor = admin_id;
  results := results || jsonb_build_object('name', 'notes: one audit entry per note, as the author, without the text', 'pass', n = 2 and ok, 'detail', format('%s entries', n));

  -- ---------------------------------- the support member: may write; sees their mentions
  if has_temp then
    perform set_config('request.jwt.claims', jsonb_build_object('sub', sup_id, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*), bool_and(m.author_name = admin_name and m.person_key = k) into n, ok
    from public.my_mentions(50) m where m.note_id in (note1, note2);
    select count(*) into n2 from public.my_mentions(50) m where m.note_id not in (note1, note2) and m.person_key = k;
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '{}', true);
  end if;
  results := results || jsonb_build_object('name', 'my_mentions: the person mentioned in both notes sees both, with the author''s name and the person key', 'pass',
    case when has_temp then n = 2 and ok and n2 = 0 else null end,
    'detail', case when has_temp then format('%s rows', n) else 'SKIPPED: no second member of staff' end);

  -- ------------------------- the viewer: reads, is mentioned once, may not write
  refused := false;
  if has_temp then
    perform set_config('request.jwt.claims', jsonb_build_object('sub', view_id, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      insert into public.person_notes (person_key, body) values (k, '[TEST] 0019 from a viewer');
    exception when insufficient_privilege then
      refused := true;
    end;
    select count(*), min(m.note_id::text) into n, state from public.my_mentions(50) m where m.note_id in (note1, note2);
    select count(*) into n2 from public.staff_mentionable();
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '{}', true);
  end if;
  results := results
    || jsonb_build_object('name', 'notes: a member of staff without customers.note is refused', 'pass',
         case when has_temp then refused else null end,
         'detail', case when has_temp then 'role viewer' else 'SKIPPED: no second member of staff' end)
    || jsonb_build_object('name', 'my_mentions: returns only the caller''s (the viewer sees the one note that names them)', 'pass',
         case when has_temp then n = 1 and state = note2::text else null end,
         'detail', case when has_temp then format('%s rows', n) else 'SKIPPED: no second member of staff' end)
    || jsonb_build_object('name', 'staff_mentionable is empty for a caller without customers.note', 'pass',
         case when has_temp then n2 = 0 else null end,
         'detail', case when has_temp then format('%s rows', n2) else 'SKIPPED: no second member of staff' end);

  -- --------------- each kind of event only with its capability (the temporary dealing role)
  if has_temp then
    -- a) no customers.read: refused outright
    perform set_config('request.jwt.claims', jsonb_build_object('sub', deal_id, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    refused := false;
    begin
      perform count(*) from public.person_timeline(k, 100);
    exception when insufficient_privilege then
      refused := true;
    end;
    select count(*) into n from public.my_mentions(50);
    perform set_config('role', 'none', true);
    results := results
      || jsonb_build_object('name', 'capabilities: without customers.read the timeline is refused', 'pass', refused, 'detail', '')
      || jsonb_build_object('name', 'my_mentions: nothing for a caller who cannot open a customer record', 'pass', n = 0, 'detail', format('%s rows', n));

    -- b) customers.read alone: the newsletter and the notes about the person
    insert into public.role_capabilities (role, capability) values ('dealing', 'customers.read');
    perform set_config('role', 'authenticated', true);
    select count(*), coalesce(string_agg(distinct t.kind, ',' order by t.kind), '') into n, sig from public.person_timeline(k, 100) t;
    perform set_config('role', 'none', true);
    results := results || jsonb_build_object('name', 'capabilities: customers.read alone shows the newsletter and the notes about the person, nothing else', 'pass',
      n = 4 and sig = 'newsletter_joined,newsletter_left,person_note', 'detail', format('%s rows: %s', n, sig));

    -- c) + leads.read (audit.read is held): everything about enquiries, nothing about tickets
    insert into public.role_capabilities (role, capability) values ('dealing', 'leads.read');
    perform set_config('role', 'authenticated', true);
    select count(*), coalesce(string_agg(distinct t.kind, ',' order by t.kind), '') into n, sig from public.person_timeline(k, 100) t;
    perform set_config('role', 'none', true);
    results := results || jsonb_build_object('name', 'capabilities: leads.read adds the enquiry events, and no ticket event', 'pass',
      n = 10 and sig = 'enquiry_note,enquiry_received,enquiry_stage,enquiry_status,followup_completed,followup_created,newsletter_joined,newsletter_left,person_note',
      'detail', format('%s rows: %s', n, sig));

    -- d) without audit.read: status and stage changes go
    delete from public.role_capabilities rc where rc.role = 'dealing' and rc.capability = 'audit.read';
    perform set_config('role', 'authenticated', true);
    select count(*), coalesce(string_agg(distinct t.kind, ',' order by t.kind), '') into n, sig from public.person_timeline(k, 100) t;
    perform set_config('role', 'none', true);
    results := results || jsonb_build_object('name', 'capabilities: without audit.read the status and stage changes of an enquiry are hidden', 'pass',
      n = 8 and sig = 'enquiry_note,enquiry_received,followup_completed,followup_created,newsletter_joined,newsletter_left,person_note',
      'detail', format('%s rows: %s', n, sig));

    -- e) + tickets.read, still without audit.read: the ticket and its messages, not its status changes
    insert into public.role_capabilities (role, capability) values ('dealing', 'tickets.read');
    perform set_config('role', 'authenticated', true);
    select count(*), coalesce(string_agg(distinct t.kind, ',' order by t.kind), '') into n, sig from public.person_timeline(k, 100) t;
    perform set_config('role', 'none', true);
    results := results || jsonb_build_object('name', 'capabilities: tickets.read adds the ticket and its messages; its status change and escalation need audit.read', 'pass',
      n = 12 and sig = 'enquiry_note,enquiry_received,followup_completed,followup_created,newsletter_joined,newsletter_left,person_note,ticket_customer_message,ticket_internal_note,ticket_opened,ticket_staff_reply',
      'detail', format('%s rows: %s', n, sig));

    -- f) without leads.read: the enquiry events go, the ticket events stay
    delete from public.role_capabilities rc where rc.role = 'dealing' and rc.capability = 'leads.read';
    perform set_config('role', 'authenticated', true);
    select count(*), coalesce(string_agg(distinct t.kind, ',' order by t.kind), '') into n, sig from public.person_timeline(k, 100) t;
    perform set_config('role', 'none', true);
    results := results || jsonb_build_object('name', 'capabilities: without leads.read every enquiry event is hidden', 'pass',
      n = 8 and sig = 'newsletter_joined,newsletter_left,person_note,ticket_customer_message,ticket_internal_note,ticket_opened,ticket_staff_reply',
      'detail', format('%s rows: %s', n, sig));

    -- g) everything: the whole history
    insert into public.role_capabilities (role, capability) values ('dealing', 'leads.read'), ('dealing', 'audit.read');
    perform set_config('role', 'authenticated', true);
    select count(*), coalesce(string_agg(distinct t.kind, ',' order by t.kind), '') into n, sig from public.person_timeline(k, 100) t;
    -- reads the notes, but holds no customers.note
    select count(*) into n2 from public.person_notes pn where pn.person_key = k;
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '{}', true);
    results := results
      || jsonb_build_object('name', 'capabilities: with all four the whole history is returned', 'pass', n = 16 and sig = all_kinds, 'detail', format('%s rows', n))
      || jsonb_build_object('name', 'notes: customers.read reads the notes', 'pass', n2 = 2, 'detail', format('%s notes', n2));
  else
    results := results || jsonb_build_object('name', 'capabilities: each kind of event only with its capability', 'pass', null, 'detail', 'SKIPPED: no second member of staff');
  end if;

  -- ------------------------------------- signed in but not staff: refused everywhere
  perform set_config('request.jwt.claims', jsonb_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  state := '';
  begin
    perform count(*) from public.person_timeline(k, 100);
    state := state || 'person_timeline accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from public.my_mentions(50);
    state := state || 'my_mentions accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.person_notes (person_key, body) values (k, '[TEST] 0019 outsider');
    state := state || 'insert accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  select count(*) into n from public.person_notes;
  select count(*) into n2 from public.staff_mentionable();
  perform set_config('role', 'none', true);
  results := results || jsonb_build_object('name', 'a signed-in person who is not staff is refused the timeline, the mentions and writing, and reads no note and no name', 'pass',
    state = '' and n = 0 and n2 = 0, 'detail', coalesce(nullif(state, ''), format('all refused; %s notes and %s names readable', n, n2)));

  -- ------------------------------------------------ anonymous: may not even call
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
  state := '';
  begin
    perform count(*) from public.person_timeline(k, 100);
    state := state || 'person_timeline accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from public.my_mentions(50);
    state := state || 'my_mentions accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from public.staff_mentionable();
    state := state || 'staff_mentionable accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from public.person_notes;
    state := state || 'select accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.person_notes (person_key, body) values (k, '[TEST] 0019 anonymous');
    state := state || 'insert accepted; ';
  exception when insufficient_privilege then
    null;
  end;
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{}', true);
  results := results || jsonb_build_object('name', 'the anonymous role cannot call the three functions, read a note or write one', 'pass', state = '', 'detail', coalesce(nullif(state, ''), 'all refused'));

  -- the capability went to the four roles that work with people, and to nobody else
  results := results || jsonb_build_object('name', 'customers.note is held by admin, agent, sales and support only', 'pass',
    (select array_agg(rc.role order by rc.role) from public.role_capabilities rc where rc.capability = 'customers.note') = array['admin', 'agent', 'sales', 'support'],
    'detail', (select string_agg(rc.role, ', ' order by rc.role) from public.role_capabilities rc where rc.capability = 'customers.note'));

  for r in select * from jsonb_array_elements(results) loop
    insert into timeline_test_results (name, pass, detail) values (r ->> 'name', (r ->> 'pass')::boolean, r ->> 'detail');
  end loop;
end
$test$;

select n, case when pass is null then 'SKIPPED' when pass then 'pass' else 'FAIL' end as result, name, detail
from timeline_test_results
order by n;

rollback;
