-- =============================================================================
-- GIO4X · 0027_portal_clients_fees · clients, marketing, fees by hand, broker settings
-- =============================================================================
-- More of the client portal is worked from Control
-- (portal/supabase/migrations/20261003170000_control_more.sql):
--
--   clients.read     (admin, compliance, finance, support, sales)  one page per client
--   clients.manage   (admin, compliance)   activate, suspend or close a client
--   fees.charge      (admin, finance)      charge a fee by hand, waive a pending
--                                          charge, reverse an applied one
--   partners.manage  (existing)            marketing materials; campaign links for an IB
--   trading.manage   (existing)            per-symbol settings and trading blocks on
--                                          the trading terminal
--
-- portal_ops_record() (0026) learns the new one-person actions. Charging a fee
-- and reversing one move a client's money, so they take two people, through a
-- general request / confirm function, portal_two_person(), built on the
-- portal_approvals table of 0023:
--
--   request   the first person asks; the details of what is asked for are kept
--             in `payload` so that the second person confirms exactly that
--   confirm   a different person holding the capability confirms; the function
--             hands back the payload, and only then does the server act
--   cancel    an open request is withdrawn
--
-- with the same stated exception: when nobody else who is active holds the
-- capability, the request is approved at once and recorded as unreviewed.
--
-- Re-runnable and additive.
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
  ('admin', 'clients.read'), ('compliance', 'clients.read'), ('finance', 'clients.read'), ('support', 'clients.read'), ('sales', 'clients.read'),
  ('admin', 'clients.manage'), ('compliance', 'clients.manage'),
  ('admin', 'fees.charge'), ('finance', 'fees.charge')
on conflict do nothing;

alter table public.portal_approvals add column if not exists payload jsonb;
alter table public.portal_approvals drop constraint if exists portal_approvals_kind_valid;
alter table public.portal_approvals add constraint portal_approvals_kind_valid check (kind in ('wallet_tx', 'ib_settlement', 'fee_charge', 'fee_reverse'));
alter table public.portal_approvals drop constraint if exists portal_approvals_payload_small;
alter table public.portal_approvals add constraint portal_approvals_payload_small check (payload is null or octet_length(payload::text) <= 2000);

create or replace function public.portal_ops_record(p_action text, p_entity_id text, p_detail jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cap text;
begin
  v_cap := case
    when p_action in ('copy.status', 'pamm.status', 'marketing.material', 'marketing.link') then 'partners.manage'
    when p_action in ('ledger.account', 'ledger.journal') then 'ledger.manage'
    when p_action in ('legal.save', 'legal.publish') then 'documents.manage'
    when p_action = 'events.dispatch' then 'events.manage'
    when p_action = 'client.status' then 'clients.manage'
    when p_action = 'fee.waive' then 'fees.charge'
    when p_action in ('broker.symbol', 'broker.block') then 'trading.manage'
    when p_action = 'ops.failed' then ''
    else null
  end;
  if v_cap is null then
    raise exception 'unknown action' using errcode = '22023';
  end if;
  if v_cap = '' then
    if not ((select public.staff_can('partners.manage')) or (select public.staff_can('ledger.manage'))
            or (select public.staff_can('documents.manage')) or (select public.staff_can('events.manage'))
            or (select public.staff_can('clients.manage')) or (select public.staff_can('fees.charge'))
            or (select public.staff_can('trading.manage'))) then
      raise exception 'not authorised' using errcode = '42501';
    end if;
  elsif not (select public.staff_can(v_cap)) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_entity_id is not null and p_entity_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid record id' using errcode = '22023';
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values ((select auth.uid()), p_action, 'portal_ops', p_entity_id,
          case when p_detail is not null and jsonb_typeof(p_detail) = 'object' and octet_length(p_detail::text) <= 1000 then p_detail else '{}'::jsonb end);
end;
$$;

-- p_kind: fee_charge | fee_reverse.  p_op: request | confirm | cancel.
-- Returns { result, payload?, requested_by_name? }:
--   request → pending | exists | unreviewed (with the payload)
--   confirm → confirmed (with the payload) | own | none
--   cancel  → cancelled | none
create or replace function public.portal_two_person(p_kind text, p_op text, p_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_cap    text;
  v_act    text;
  v_row    public.portal_approvals%rowtype;
  v_others boolean;
  v_name   text;
  v_pay    jsonb := case when p_payload is not null and jsonb_typeof(p_payload) = 'object' then p_payload else '{}'::jsonb end;
begin
  if p_kind = 'fee_charge' then v_cap := 'fees.charge'; v_act := 'fee.charge';
  elsif p_kind = 'fee_reverse' then v_cap := 'fees.charge'; v_act := 'fee.reverse';
  else raise exception 'unknown kind' using errcode = '22023';
  end if;
  if not (select public.staff_can(v_cap)) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_id is null or p_op is null or p_op not in ('request', 'confirm', 'cancel') then
    raise exception 'invalid request' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  select * into v_row from public.portal_approvals a where a.tx_id = p_id and a.state = 'pending' for update;

  if p_op = 'request' then
    if found then return jsonb_build_object('result', 'exists'); end if;
    select exists (
      select 1 from public.staff s join public.role_capabilities rc on rc.role = s.role
       where s.active and s.user_id <> v_me and rc.capability = v_cap
    ) into v_others;
    if v_others then
      insert into public.portal_approvals (kind, tx_id, state, requested_by, payload) values (p_kind, p_id, 'pending', v_me, v_pay);
      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values (v_me, v_act || '_request', 'portal_ops', p_id::text, v_pay);
      return jsonb_build_object('result', 'pending');
    end if;
    insert into public.portal_approvals (kind, tx_id, state, requested_by, decided_at, payload) values (p_kind, p_id, 'unreviewed', v_me, now(), v_pay);
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (v_me, v_act, 'portal_ops', p_id::text, v_pay || jsonb_build_object('unreviewed', true, 'why', 'no other active member of staff holds ' || v_cap));
    return jsonb_build_object('result', 'unreviewed', 'payload', v_pay);
  end if;

  if not found or v_row.kind <> p_kind then
    return jsonb_build_object('result', 'none');
  end if;

  if p_op = 'cancel' then
    update public.portal_approvals set state = 'cancelled', decided_by = v_me, decided_at = now() where id = v_row.id;
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (v_me, v_act || '_cancel', 'portal_ops', p_id::text, '{}'::jsonb);
    return jsonb_build_object('result', 'cancelled');
  end if;

  if v_row.requested_by = v_me then
    return jsonb_build_object('result', 'own');
  end if;
  update public.portal_approvals set state = 'confirmed', decided_by = v_me, decided_at = now() where id = v_row.id;
  select s.display_name into v_name from public.staff s where s.user_id = v_row.requested_by;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (v_me, v_act, 'portal_ops', p_id::text, coalesce(v_row.payload, '{}'::jsonb) || jsonb_build_object('requested_by', v_row.requested_by));
  return jsonb_build_object('result', 'confirmed', 'payload', coalesce(v_row.payload, '{}'::jsonb), 'requested_by_name', coalesce(v_name, 'a former member of staff'));
end;
$$;

-- Open requests of one kind, newest first, for the screen that confirms them.
create or replace function public.portal_requests_open(p_kind text)
returns table (id uuid, payload jsonb, requested_by_name text, requested_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.tx_id, coalesce(a.payload, '{}'::jsonb), coalesce(s.display_name, 'a former member of staff'), a.requested_at, a.requested_by = (select auth.uid())
  from public.portal_approvals a
  left join public.staff s on s.user_id = a.requested_by
  where a.state = 'pending' and a.kind = p_kind
    and p_kind in ('fee_charge', 'fee_reverse')
    and (select public.staff_can('funds.read'))
  order by a.requested_at desc
  limit 100;
$$;

revoke all on function public.portal_ops_record(text, text, jsonb) from public, anon;
revoke all on function public.portal_two_person(text, text, uuid, jsonb) from public, anon;
revoke all on function public.portal_requests_open(text) from public, anon;
grant execute on function public.portal_ops_record(text, text, jsonb) to authenticated;
grant execute on function public.portal_two_person(text, text, uuid, jsonb) to authenticated;
grant execute on function public.portal_requests_open(text) to authenticated;
