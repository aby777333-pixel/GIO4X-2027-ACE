-- =============================================================================
-- GIO4X · 0015_activity · what each member of staff recorded, and a month in counts
-- -----------------------------------------------------------------------------
-- Apply after 0012 (it reads tables from 0001 to 0011). Re-runnable. Purely
-- additive: one capability, five functions, no table, no column, no policy.
--
-- Nothing here stores anything or holds a figure of its own: every number is
-- counted from real rows at the moment it is asked for.
--
--   staff_activity(days)   "Team activity" in the console: one row per member
--        of staff, active or switched off, with what the console recorded
--        about their work over the period. This is information about people,
--        so it needs its own capability, `activity.read`, held by admin and
--        compliance only.
--
--   my_activity(days)      the same row, for the caller alone. Anyone on staff
--        may always see what the console has counted about themselves.
--
--   report_month(month)    the Reporting Centre's monthly summary: counts for
--        one calendar month (UTC), `reports.read`. Counts only: no name, no
--        address, no message text.
--
--   record_report_download(month)   writes the audit entry for a download of
--        that summary. The console calls it BEFORE it sends the file.
--
-- What the activity figures are, exactly (the console prints the same words):
--   tickets_assigned   distinct tickets given to, or taken by, the person in
--                      the period (audit entries `ticket.assign` naming them)
--   tickets_replied    distinct tickets on which they sent at least one reply
--                      to the customer in the period
--   first_replies      tickets whose FIRST reply to the customer was theirs and
--                      was sent in the period
--   first_reply_median_minutes   median minutes from a ticket being opened to
--                      that first reply, over those tickets; null when none
--   tickets_solved     tickets solved or closed in the period that are assigned
--                      to them (a ticket reopened since is not counted)
--   ticket_notes       internal notes they wrote on tickets in the period
--   chats_claimed      distinct live chats they took in the period (`chat.claim`)
--   chat_messages      messages they sent in live chats in the period
--   chats_closed       distinct live chats they closed in the period (`chat.close`)
--   leads_assigned     distinct enquiries given to, or taken by, them in the
--                      period (`lead.assign` naming them)
--   lead_notes         notes they wrote on enquiries in the period
--   tasks_completed    follow-ups they completed in the period that are still
--                      marked as completed
--   stage_changes      pipeline stage changes they made in the period
--                      (`lead.stage`)
--   last_activity      the latest audit entry made by them, at ANY time, not
--                      only in the period; null when there is none
--
-- They count events recorded in this console. They are not a measure of the
-- quality of anybody's work.
--
-- New capability: activity.read (admin, compliance).
-- New audit action: report.download (entity `report`, entity_id the month).
-- =============================================================================

do $guard$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles r
    where r.rolname = current_user and (r.rolbypassrls or r.rolsuper)
  ) then
    raise exception
      'GIO4X migrations must be applied by a role with BYPASSRLS (on Supabase: postgres). Current role: %', current_user;
  end if;
end
$guard$;

insert into public.role_capabilities (role, capability) values
  ('admin', 'activity.read'), ('compliance', 'activity.read')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Internal: the rows. Not callable through the API; the two functions below
-- decide who may ask and for whom. `p_user` null means everyone on staff.
-- ---------------------------------------------------------------------------
create or replace function public.staff_activity_rows(p_since timestamptz, p_user uuid)
returns table (
  user_id uuid, display_name text, role text, active boolean,
  tickets_assigned integer, tickets_replied integer, first_replies integer, first_reply_median_minutes numeric,
  tickets_solved integer, ticket_notes integer,
  chats_claimed integer, chat_messages integer, chats_closed integer,
  leads_assigned integer, lead_notes integer, tasks_completed integer, stage_changes integer,
  last_activity timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  -- the first reply a customer received on each ticket, and who sent it
  with first_reply as (
    select distinct on (m.ticket_id) m.ticket_id, m.author, m.created_at
    from public.ticket_messages m
    where m.author_kind = 'staff' and not m.internal
    order by m.ticket_id, m.created_at, m.id
  )
  select
    s.user_id, s.display_name, s.role, s.active,
    (select count(distinct a.entity_id) from public.audit_log a
      where a.action = 'ticket.assign' and a.at >= p_since and a.detail ->> 'to' = s.user_id::text)::integer,
    (select count(distinct m.ticket_id) from public.ticket_messages m
      where m.author_kind = 'staff' and not m.internal and m.author = s.user_id and m.created_at >= p_since)::integer,
    (select count(*) from first_reply f where f.author = s.user_id and f.created_at >= p_since)::integer,
    (select round((percentile_cont(0.5) within group (order by extract(epoch from (f.created_at - t.created_at)) / 60))::numeric, 1)
      from first_reply f join public.tickets t on t.id = f.ticket_id
      where f.author = s.user_id and f.created_at >= p_since),
    (select count(*) from public.tickets t where t.assigned_to = s.user_id and t.solved_at >= p_since)::integer,
    (select count(*) from public.ticket_messages m
      where m.author_kind = 'staff' and m.internal and m.author = s.user_id and m.created_at >= p_since)::integer,
    (select count(distinct a.entity_id) from public.audit_log a
      where a.action = 'chat.claim' and a.at >= p_since and a.actor = s.user_id)::integer,
    (select count(*) from public.chat_messages c
      where c.author_kind = 'staff' and c.author = s.user_id and c.created_at >= p_since)::integer,
    (select count(distinct a.entity_id) from public.audit_log a
      where a.action = 'chat.close' and a.at >= p_since and a.actor = s.user_id)::integer,
    (select count(distinct a.entity_id) from public.audit_log a
      where a.action = 'lead.assign' and a.at >= p_since and a.detail ->> 'to' = s.user_id::text)::integer,
    (select count(*) from public.lead_notes n where n.author = s.user_id and n.created_at >= p_since)::integer,
    (select count(*) from public.lead_tasks k where k.done and k.done_by = s.user_id and k.done_at >= p_since)::integer,
    (select count(*) from public.audit_log a
      where a.action = 'lead.stage' and a.at >= p_since and a.actor = s.user_id)::integer,
    (select max(a.at) from public.audit_log a where a.actor = s.user_id)
  from public.staff s
  where p_user is null or s.user_id = p_user
  order by s.active desc, s.display_name;
$$;

-- Everyone on staff, over the last p_days days (1 to 365). activity.read only.
create or replace function public.staff_activity(p_days integer default 30)
returns table (
  user_id uuid, display_name text, role text, active boolean,
  tickets_assigned integer, tickets_replied integer, first_replies integer, first_reply_median_minutes numeric,
  tickets_solved integer, ticket_notes integer,
  chats_claimed integer, chat_messages integer, chats_closed integer,
  leads_assigned integer, lead_notes integer, tasks_completed integer, stage_changes integer,
  last_activity timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (select public.staff_can('activity.read')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  return query
    select * from public.staff_activity_rows(
      now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365)), null);
end;
$$;

-- The caller's own row, and only that row. Any active member of staff.
create or replace function public.my_activity(p_days integer default 30)
returns table (
  user_id uuid, display_name text, role text, active boolean,
  tickets_assigned integer, tickets_replied integer, first_replies integer, first_reply_median_minutes numeric,
  tickets_solved integer, ticket_notes integer,
  chats_claimed integer, chat_messages integer, chats_closed integer,
  leads_assigned integer, lead_notes integer, tasks_completed integer, stage_changes integer,
  last_activity timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
begin
  if me is null or not (select public.is_staff()) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  return query
    select * from public.staff_activity_rows(
      now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365)), me);
end;
$$;

-- ---------------------------------------------------------------------------
-- One calendar month in counts. `p_month` is 'YYYY-MM'; the month runs from
-- 00:00 UTC on its first day to 00:00 UTC on the first day of the next.
-- A month that has not ended is counted up to now, and `complete` says so.
-- ---------------------------------------------------------------------------
create or replace function public.report_month(p_month text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m_from         timestamptz;
  m_to           timestamptz;
  leads_total    bigint;
  sources        jsonb;
  sources_listed bigint;
begin
  if not (select public.staff_can('reports.read')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_month is null or p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid month' using errcode = '22023';
  end if;

  m_from := make_timestamptz(substr(p_month, 1, 4)::integer, substr(p_month, 6, 2)::integer, 1, 0, 0, 0, 'UTC');
  m_to := (make_timestamp(substr(p_month, 1, 4)::integer, substr(p_month, 6, 2)::integer, 1, 0, 0, 0) + interval '1 month') at time zone 'UTC';

  select count(*) into leads_total
  from public.leads l
  where l.created_at >= m_from and l.created_at < m_to and l.status <> 'spam';

  -- the campaign link the enquirer arrived by (utm_source), or 'direct'; the twelve largest
  select coalesce(jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k), '[]'::jsonb),
         coalesce(sum(x.n), 0)
  into sources, sources_listed
  from (
    select coalesce(nullif(l.utm ->> 'utm_source', ''), 'direct') as k, count(*) as n
    from public.leads l
    where l.created_at >= m_from and l.created_at < m_to and l.status <> 'spam'
    group by 1
    order by 2 desc, 1
    limit 12
  ) x;

  return jsonb_build_object(
    'month', p_month,
    'from', m_from,
    'to', m_to,
    'generated_at', now(),
    'complete', m_to <= now(),
    'leads', jsonb_build_object(
      'total', leads_total,
      'spam', (select count(*) from public.leads l where l.created_at >= m_from and l.created_at < m_to and l.status = 'spam'),
      'by_topic', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select l.topic as k, count(*) as n from public.leads l
              where l.created_at >= m_from and l.created_at < m_to and l.status <> 'spam' group by l.topic) x), '[]'::jsonb),
      'by_stage', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select l.stage as k, count(*) as n from public.leads l
              where l.created_at >= m_from and l.created_at < m_to and l.status <> 'spam' group by l.stage) x), '[]'::jsonb),
      -- the twelve largest sources; `by_source` and `other_sources` together add up to `total`
      'by_source', sources,
      'other_sources', greatest(leads_total - sources_listed, 0)
    ),
    'tickets', jsonb_build_object(
      'opened', (select count(*) from public.tickets t where t.created_at >= m_from and t.created_at < m_to),
      'answered', (select count(*) from public.tickets t where t.created_at >= m_from and t.created_at < m_to and t.first_response_at is not null),
      'solved', (select count(*) from public.tickets t where t.solved_at >= m_from and t.solved_at < m_to),
      -- minutes from opening to the first public reply, for tickets opened in the month that have one
      'first_response_median_minutes', (
        select round((percentile_cont(0.5) within group (order by extract(epoch from (t.first_response_at - t.created_at)) / 60))::numeric, 1)
        from public.tickets t where t.created_at >= m_from and t.created_at < m_to and t.first_response_at is not null)
    ),
    'chats', jsonb_build_object(
      'started', (select count(*) from public.chat_conversations c where c.created_at >= m_from and c.created_at < m_to),
      'answered', (select count(*) from public.chat_conversations c where c.created_at >= m_from and c.created_at < m_to and c.claimed_by is not null)
    ),
    'subscribers', jsonb_build_object(
      'joined', (select count(*) from public.newsletter_subscribers n where n.created_at >= m_from and n.created_at < m_to),
      'left', (select count(*) from public.newsletter_subscribers n where n.unsubscribed_at >= m_from and n.unsubscribed_at < m_to)
    ),
    'follow_ups', jsonb_build_object(
      'created', (select count(*) from public.lead_tasks k where k.created_at >= m_from and k.created_at < m_to),
      'completed', (select count(*) from public.lead_tasks k where k.done_at >= m_from and k.done_at < m_to)
    ),
    -- posts that are public now and whose publication time falls in the month (a post scheduled for later is not counted yet)
    'blog', jsonb_build_object(
      'published', (select count(*) from public.blog_posts b
                    where b.status = 'published' and b.published_at >= m_from and b.published_at < m_to and b.published_at <= now())
    ),
    'incidents', jsonb_build_object(
      'created', (select count(*) from public.incidents i where i.created_at >= m_from and i.created_at < m_to),
      'published', (select count(*) from public.incidents i where i.created_at >= m_from and i.created_at < m_to and i.published)
    )
  );
end;
$$;

-- Records that a member of staff downloaded the monthly summary. Called BEFORE
-- the file is sent: no audit entry, no file. The actor is always the caller.
create or replace function public.record_report_download(p_month text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (select public.staff_can('reports.read')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_month is null or p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid month' using errcode = '22023';
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values ((select auth.uid()), 'report.download', 'report', p_month, jsonb_build_object('format', 'csv'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
-- internal: reachable only from staff_activity() and my_activity()
revoke all on function public.staff_activity_rows(timestamptz, uuid) from public, anon, authenticated;

revoke all on function public.staff_activity(integer) from public, anon;
revoke all on function public.my_activity(integer) from public, anon;
revoke all on function public.report_month(text) from public, anon;
revoke all on function public.record_report_download(text) from public, anon;
grant execute on function public.staff_activity(integer) to authenticated;
grant execute on function public.my_activity(integer) to authenticated;
grant execute on function public.report_month(text) to authenticated;
grant execute on function public.record_report_download(text) to authenticated;
