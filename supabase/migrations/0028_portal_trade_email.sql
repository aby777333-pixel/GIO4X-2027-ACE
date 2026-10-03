-- =============================================================================
-- GIO4X · 0028_portal_trade_email · entering a trade by hand; sending service e-mail
-- =============================================================================
-- Two more one-person actions for portal_ops_record() (0026, 0027):
--
--   trade.record   trading.manage (admin, dealing)   a closed trade entered by hand
--   email.send     emailer.send   (admin)            a service message to one of three
--                                                    fixed audiences of portal clients
--
-- The audit entry for an e-mail carries the audience, the subject and how many
-- addresses it went to: never the addresses, never the body.
--
-- Trading-terminal settings (per-symbol conditions and trading blocks) use
-- 'broker.symbol' and 'broker.block', already known since 0027.
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

insert into public.role_capabilities (role, capability) values ('admin', 'emailer.send') on conflict do nothing;

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
    when p_action in ('broker.symbol', 'broker.block', 'trade.record') then 'trading.manage'
    when p_action = 'email.send' then 'emailer.send'
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
            or (select public.staff_can('trading.manage')) or (select public.staff_can('emailer.send'))) then
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

revoke all on function public.portal_ops_record(text, text, jsonb) from public, anon;
grant execute on function public.portal_ops_record(text, text, jsonb) to authenticated;
