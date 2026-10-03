-- =============================================================================
-- GIO4X · 0026_portal_ops · the rest of the portal sections can be worked from Control
-- =============================================================================
-- Copy Trading, PAMM / MAM, General Ledger, Document Builder and Event Bus were
-- read-only. Each now has the changes a back office makes there, through one
-- function in the portal's database that only the server's secret key can call
-- (portal/supabase/migrations/20261003160000_control_ops.sql):
--
--   copy.status, pamm.status     approve, pause, resume or close a signal        partners.manage
--                                provider / a managed fund                       (admin, finance)
--   ledger.account               add a ledger account; switch one off or on      ledger.manage
--   ledger.journal               post a manual, balanced journal entry           (admin, finance)
--   legal.save, legal.publish    edit a legal document; publish it to clients    documents.manage
--                                or take it down                                 (admin, compliance)
--   events.dispatch              run the portal's event queue now                events.manage (admin)
--
-- The audit entry is written here first, as the signed-in member of staff, by
-- portal_ops_record(), which checks the capability for that action again.
-- 'ops.failed' records a change the portal refused.
--
-- One person makes each of these. None moves client money: a manual journal
-- entry corrects the books and touches no wallet.
--
-- Trade Log and Bulk Emailer stay read-only on purpose: trades are written by
-- the trading platform, not typed in; and no e-mail provider is configured
-- anywhere yet, so there is nothing to send with.
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
  ('admin', 'ledger.manage'), ('finance', 'ledger.manage'),
  ('admin', 'documents.manage'), ('compliance', 'documents.manage'),
  ('admin', 'events.manage')
on conflict do nothing;

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
    when p_action in ('copy.status', 'pamm.status') then 'partners.manage'
    when p_action in ('ledger.account', 'ledger.journal') then 'ledger.manage'
    when p_action in ('legal.save', 'legal.publish') then 'documents.manage'
    when p_action = 'events.dispatch' then 'events.manage'
    when p_action = 'ops.failed' then ''
    else null
  end;
  if v_cap is null then
    raise exception 'unknown action' using errcode = '22023';
  end if;
  if v_cap = '' then
    if not ((select public.staff_can('partners.manage')) or (select public.staff_can('ledger.manage'))
            or (select public.staff_can('documents.manage')) or (select public.staff_can('events.manage'))) then
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
