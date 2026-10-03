-- =============================================================================
-- GIO4X · 0024_portal_config · who may change what the broker charges, pays and offers
-- =============================================================================
-- Control can now add, change and retire rows in four configuration tables of
-- the client portal's database, through one function there that only the
-- server's secret key can call
-- (portal/supabase/migrations/20261003140000_control_config_write.sql):
--
--   fee schedules and fee rules     fees.manage      admin, finance
--   IB commission plans             partners.manage  admin, finance
--   account types                   trading.manage   admin, dealing
--
-- Nothing is deleted: a row that is no longer wanted is retired (switched off),
-- because charges, partner relationships and accounts point at it.
--
-- As with every write Control makes in the portal, the audit entry is written
-- here first, as the signed-in member of staff, by portal_config_record(),
-- which checks the capability for that table again. No audit entry, no change.
-- The entry carries the values that were asked for; they are configuration
-- (rates, names of plans), never client data.
--
-- One person makes a configuration change. It applies to future charges only;
-- it moves no money by itself.
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
  ('admin', 'fees.manage'), ('finance', 'fees.manage'),
  ('admin', 'partners.manage'), ('finance', 'partners.manage'),
  ('admin', 'trading.manage'), ('dealing', 'trading.manage')
on conflict do nothing;

-- p_op: create | update | retire | failed.  p_entity_id: the portal row's id, or null for a create.
create or replace function public.portal_config_record(p_table text, p_op text, p_entity_id text, p_detail jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cap text;
begin
  v_cap := case p_table
    when 'fee_schedules' then 'fees.manage'
    when 'fee_rules' then 'fees.manage'
    when 'commission_plans' then 'partners.manage'
    when 'account_types' then 'trading.manage'
    else null
  end;
  if v_cap is null or p_op is null or p_op not in ('create', 'update', 'retire', 'failed') then
    raise exception 'unknown table or operation' using errcode = '22023';
  end if;
  if not (select public.staff_can(v_cap)) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_entity_id is not null and p_entity_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid record id' using errcode = '22023';
  end if;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (
    (select auth.uid()),
    'config.' || p_op,
    'portal_' || p_table,
    p_entity_id,
    case
      when p_detail is not null and jsonb_typeof(p_detail) = 'object' and octet_length(p_detail::text) <= 2000 then p_detail
      else '{}'::jsonb
    end
  );
end;
$$;

revoke all on function public.portal_config_record(text, text, text, jsonb) from public, anon;
grant execute on function public.portal_config_record(text, text, text, jsonb) to authenticated;
