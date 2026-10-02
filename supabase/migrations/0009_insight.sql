-- =============================================================================
-- GIO4X · 0009_insight · people, reports and the command summary
-- -----------------------------------------------------------------------------
-- Apply after 0008. Re-runnable.
--
-- Three read-only views of what the other tables already hold. Nothing here
-- stores anything, estimates anything or holds a figure of its own: every
-- number is counted from real rows at the moment it is asked for.
--
--   people_list / person_view   "Customers" in the console. One record per
--        e-mail address that has contacted GIO4X: its enquiries, its support
--        tickets and whether it subscribes. These are people who have written
--        in, NOT client accounts: there are no client accounts in this
--        database yet. A person is addressed by `key`, a hash of the address,
--        so that an address never appears in a URL.
--
--   report_summary(days)        "Reporting Centre": counts over a period.
--
--   command_summary()           "Command Centre": what needs attention now,
--        across every section that exists.
--
-- New capabilities: customers.read, compliance.read, reports.read, command.read.
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
  ('admin', 'customers.read'), ('agent', 'customers.read'), ('support', 'customers.read'),
  ('sales', 'customers.read'), ('compliance', 'customers.read'), ('viewer', 'customers.read'),
  ('admin', 'compliance.read'), ('compliance', 'compliance.read'),
  ('admin', 'reports.read'), ('compliance', 'reports.read'), ('sales', 'reports.read'), ('finance', 'reports.read'),
  ('admin', 'command.read')
on conflict do nothing;

-- the key a person is addressed by: 32 hex characters of the address's SHA-256
create or replace function public.person_key(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select substr(encode(sha256(convert_to(lower(p_email), 'UTF8')), 'hex'), 1, 32);
$$;

-- One row per address, newest contact first. `p_search` matches any part of
-- a name or of an address (it has already been reduced to safe
-- characters by the caller; it is used as a plain substring, not a pattern).
create or replace function public.people_list(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns table (
  key text, email text, name text, first_seen timestamptz, last_seen timestamptz,
  enquiries integer, tickets integer, open_tickets integer, subscribed boolean, total bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with contacts as (
    select l.email, l.name, l.created_at, 1 as enquiry, 0 as ticket, 0 as open_ticket from public.leads l where l.status <> 'spam'
    union all
    select t.email, t.name, t.created_at, 0, 1, case when t.status in ('open', 'pending') then 1 else 0 end from public.tickets t
    union all
    select n.email, null, n.created_at, 0, 0, 0 from public.newsletter_subscribers n
  ),
  people as (
    select c.email,
           (array_agg(c.name order by c.created_at desc) filter (where c.name is not null))[1] as name,
           min(c.created_at) as first_seen,
           max(c.created_at) as last_seen,
           sum(c.enquiry)::integer as enquiries,
           sum(c.ticket)::integer as tickets,
           sum(c.open_ticket)::integer as open_tickets
    from contacts c
    group by c.email
  ),
  matched as (
    select p.* from people p
    where coalesce(p_search, '') = ''
       or position(lower(p_search) in p.email) > 0
       or position(lower(p_search) in lower(coalesce(p.name, ''))) > 0
  )
  select public.person_key(m.email), m.email, m.name, m.first_seen, m.last_seen, m.enquiries, m.tickets, m.open_tickets,
         exists (select 1 from public.newsletter_subscribers n where n.email = m.email and n.unsubscribed_at is null),
         count(*) over ()
  from matched m
  where (select public.staff_can('customers.read'))
  order by m.last_seen desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Everything known about one person, or null.
create or replace function public.person_view(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  addr text;
begin
  if not (select public.staff_can('customers.read')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_key is null or p_key !~ '^[0-9a-f]{32}$' then
    return null;
  end if;

  select x.email into addr
  from (
    select email from public.leads
    union select email from public.tickets
    union select email from public.newsletter_subscribers
  ) x
  where public.person_key(x.email) = p_key
  limit 1;
  if addr is null then
    return null;
  end if;

  return jsonb_build_object(
    'key', p_key,
    'email', addr,
    'name', (
      select y.name from (
        select name, created_at from public.leads where email = addr
        union all select name, created_at from public.tickets where email = addr
      ) y order by y.created_at desc limit 1),
    'leads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'reference', l.reference, 'created_at', l.created_at, 'topic', l.topic,
        'status', l.status, 'stage', l.stage, 'score', l.score, 'assigned_to', l.assigned_to) order by l.created_at desc)
      from public.leads l where l.email = addr), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'reference', t.reference, 'created_at', t.created_at, 'category', t.category, 'subject', t.subject,
        'status', t.status, 'priority', t.priority, 'assigned_to', t.assigned_to) order by t.created_at desc)
      from public.tickets t where t.email = addr), '[]'::jsonb),
    'subscription', (
      select jsonb_build_object('since', n.created_at, 'consent_version', n.consent_version, 'unsubscribed_at', n.unsubscribed_at)
      from public.newsletter_subscribers n where n.email = addr),
    'marketing_consent', exists (select 1 from public.leads l where l.email = addr and l.marketing_consent)
  );
end;
$$;

-- Counts over the last p_days days (1 to 365).
create or replace function public.report_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d     integer := least(greatest(coalesce(p_days, 30), 1), 365);
  since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
begin
  if not (select public.staff_can('reports.read')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'days', d,
    'since', since,
    'leads', jsonb_build_object(
      'total', (select count(*) from public.leads l where l.created_at >= since and l.status <> 'spam'),
      'spam', (select count(*) from public.leads l where l.created_at >= since and l.status = 'spam'),
      'by_topic', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select l.topic as k, count(*) as n from public.leads l where l.created_at >= since and l.status <> 'spam' group by l.topic) x), '[]'::jsonb),
      'by_stage', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select l.stage as k, count(*) as n from public.leads l where l.created_at >= since and l.status <> 'spam' group by l.stage) x), '[]'::jsonb),
      'by_status', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select l.status as k, count(*) as n from public.leads l where l.created_at >= since group by l.status) x), '[]'::jsonb),
      'by_source', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select coalesce(nullif(l.utm ->> 'utm_source', ''), 'direct') as k, count(*) as n
              from public.leads l where l.created_at >= since and l.status <> 'spam' group by 1 order by 2 desc limit 12) x), '[]'::jsonb),
      'by_page', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select l.page as k, count(*) as n from public.leads l where l.created_at >= since and l.status <> 'spam' group by 1 order by 2 desc limit 12) x), '[]'::jsonb),
      'lost_reasons', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select l.lost_reason as k, count(*) as n from public.leads l where l.created_at >= since and l.lost_reason is not null group by 1) x), '[]'::jsonb)
    ),
    'tickets', jsonb_build_object(
      'total', (select count(*) from public.tickets t where t.created_at >= since),
      'solved', (select count(*) from public.tickets t where t.solved_at >= since),
      'answered', (select count(*) from public.tickets t where t.created_at >= since and t.first_response_at is not null),
      -- minutes from opening to the first public reply, for tickets opened in the period that have one
      'first_response_median_minutes', (
        select round((percentile_cont(0.5) within group (order by extract(epoch from (t.first_response_at - t.created_at)) / 60))::numeric, 1)
        from public.tickets t where t.created_at >= since and t.first_response_at is not null),
      'by_category', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select t.category as k, count(*) as n from public.tickets t where t.created_at >= since group by 1) x), '[]'::jsonb),
      'by_status', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select t.status as k, count(*) as n from public.tickets t where t.created_at >= since group by 1) x), '[]'::jsonb)
    ),
    'chats', jsonb_build_object(
      'total', (select count(*) from public.chat_conversations c where c.created_at >= since),
      'answered', (select count(*) from public.chat_conversations c where c.created_at >= since and c.claimed_by is not null)
    ),
    'subscribers', jsonb_build_object(
      'new', (select count(*) from public.newsletter_subscribers n where n.created_at >= since),
      'unsubscribed', (select count(*) from public.newsletter_subscribers n where n.unsubscribed_at >= since),
      'active', (select count(*) from public.newsletter_subscribers n where n.unsubscribed_at is null)
    ),
    'follow_ups', jsonb_build_object(
      'created', (select count(*) from public.lead_tasks k where k.created_at >= since),
      'completed', (select count(*) from public.lead_tasks k where k.done_at >= since)
    )
  );
end;
$$;

-- What needs attention now. Response targets by priority (hours) must equal
-- TICKET_TARGET_HOURS in src/lib/server/constants.ts: urgent 2, high 8, normal 24, low 72.
create or replace function public.command_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.staff_can('command.read')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'at', now(),
    'leads', jsonb_build_object(
      'new', (select count(*) from public.leads where status = 'new'),
      'unassigned', (select count(*) from public.leads where status = 'new' and assigned_to is null),
      'open', (select count(*) from public.leads where status in ('open', 'waiting')),
      'last_24h', (select count(*) from public.leads where created_at > now() - interval '24 hours' and status <> 'spam')
    ),
    'follow_ups', jsonb_build_object(
      'open', (select count(*) from public.lead_tasks where not done),
      'overdue', (select count(*) from public.lead_tasks where not done and due_at < now())
    ),
    'tickets', jsonb_build_object(
      'open', (select count(*) from public.tickets where status = 'open'),
      'pending', (select count(*) from public.tickets where status = 'pending'),
      'unassigned', (select count(*) from public.tickets where status in ('open', 'pending') and assigned_to is null),
      'unanswered', (select count(*) from public.tickets where status = 'open' and first_response_at is null),
      'late', (
        select count(*) from public.tickets t
        where t.status = 'open' and t.first_response_at is null
          and now() > t.created_at + make_interval(hours => case t.priority when 'urgent' then 2 when 'high' then 8 when 'normal' then 24 else 72 end)),
      'complaints_open', (select count(*) from public.tickets where category = 'complaint' and status in ('open', 'pending'))
    ),
    'chats', jsonb_build_object(
      'waiting', (select count(*) from public.chat_conversations where status = 'waiting'),
      'active', (select count(*) from public.chat_conversations where status = 'active'),
      'staff_online', (select count(*) from public.staff_presence p join public.staff s on s.user_id = p.user_id and s.active where p.chat_until > now()),
      'enabled', coalesce((select (value ->> 'enabled')::boolean from public.site_settings where key = 'chat'), false)
    ),
    'staff', jsonb_build_object(
      'active', (select count(*) from public.staff where active),
      'pending_changes', (select count(*) from public.staff_changes where status = 'pending')
    ),
    'site', jsonb_build_object(
      'incidents_open', (select count(*) from public.incidents where status <> 'resolved'),
      'incidents_published', (select count(*) from public.incidents where status <> 'resolved' and published),
      'announcement_on', coalesce((select (value ->> 'enabled')::boolean from public.site_settings where key = 'announcement'), false)
    ),
    'audience', jsonb_build_object(
      'subscribers', (select count(*) from public.newsletter_subscribers where unsubscribed_at is null)
    ),
    'audit_24h', (select count(*) from public.audit_log where at > now() - interval '24 hours')
  );
end;
$$;

-- Records that an admin exported the enquiries. Called BEFORE the file is sent.
create or replace function public.record_leads_export(row_count integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (select public.staff_can('subscribers.export')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values ((select auth.uid()), 'leads.export', 'lead', null, jsonb_build_object('rows', greatest(coalesce(row_count, 0), 0)));
end;
$$;

revoke all on function public.person_key(text) from public, anon;
revoke all on function public.people_list(text, integer, integer) from public, anon;
revoke all on function public.person_view(text) from public, anon;
revoke all on function public.report_summary(integer) from public, anon;
revoke all on function public.command_summary() from public, anon;
revoke all on function public.record_leads_export(integer) from public, anon;
grant execute on function public.person_key(text) to authenticated;
grant execute on function public.people_list(text, integer, integer) to authenticated;
grant execute on function public.person_view(text) to authenticated;
grant execute on function public.report_summary(integer) to authenticated;
grant execute on function public.command_summary() to authenticated;
grant execute on function public.record_leads_export(integer) to authenticated;
