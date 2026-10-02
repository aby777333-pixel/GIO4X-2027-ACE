-- =============================================================================
-- 0010  A person's record shows only what the reader's role already holds
-- =============================================================================
-- person_view() (0009) returned a person's enquiries and tickets to anyone
-- holding customers.read. The console hid each list from a role without
-- leads.read or tickets.read, but that was the page being polite, not the
-- database deciding. Now the function itself leaves a list empty unless the
-- caller holds the capability for it. Name, address, subscription state and
-- the marketing-consent flag are unchanged: they are what customers.read is.
-- =============================================================================

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
      from public.leads l where l.email = addr and (select public.staff_can('leads.read'))), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'reference', t.reference, 'created_at', t.created_at, 'category', t.category, 'subject', t.subject,
        'status', t.status, 'priority', t.priority, 'assigned_to', t.assigned_to) order by t.created_at desc)
      from public.tickets t where t.email = addr and (select public.staff_can('tickets.read'))), '[]'::jsonb),
    'subscription', (
      select jsonb_build_object('since', n.created_at, 'consent_version', n.consent_version, 'unsubscribed_at', n.unsubscribed_at)
      from public.newsletter_subscribers n where n.email = addr),
    'marketing_consent', exists (select 1 from public.leads l where l.email = addr and l.marketing_consent)
  );
end;
$$;
