-- =============================================================================
-- GIO4X · 0022_portal_actions · the first decisions Control makes in the portal
-- =============================================================================
-- Until now the sections that read the client portal's database only read.
-- This adds two decisions, each made on ONE record in the portal's database by
-- a function there that only the server's secret key can call
-- (portal/supabase/migrations/20261003130000_control_actions.sql):
--
--   a KYC document awaiting review is accepted or rejected (with a reason)
--   a pending deposit or withdrawal is approved or rejected
--
-- The portal's database cannot know who the member of staff is: the secret key
-- carries no person. So the two things that make a decision accountable live
-- here, in this database:
--
--   1. WHO MAY DECIDE: two capabilities.
--        kyc.decide     admin, compliance
--        funds.settle   admin, finance
--      (compliance could change nothing before this migration; deciding a KYC
--      document is the one thing it now changes.)
--
--   2. WHO DECIDED: portal_action_record() writes the audit entry. The server
--      action calls it BEFORE it touches the portal: no audit entry, no
--      decision. It checks the capability itself (staff_can), as the signed-in
--      member of staff, so an entry cannot be written by someone who could not
--      have made the decision. If the portal then refuses or fails, a second
--      entry says so ('kyc.failed' / 'funds.failed').
--
-- Not built, and said plainly: a second person. One member of staff with
-- funds.settle approves a withdrawal alone. Four eyes on money is the next
-- step, not this one.
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
  ('admin', 'kyc.decide'), ('compliance', 'kyc.decide'),
  ('admin', 'funds.settle'), ('finance', 'funds.settle')
on conflict do nothing;

-- The audit entry for a decision made in the portal's database.
--   p_action     kyc.approve | kyc.reject | kyc.failed | funds.approve | funds.reject | funds.failed
--   p_entity_id  the portal record's id (a uuid, as text)
--   p_detail     a small object: what was decided and, for a failure, the outcome code.
--                Never a name, an address or free text typed by a client.
create or replace function public.portal_action_record(p_action text, p_entity_id text, p_detail jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cap    text;
  v_entity text;
begin
  if p_action in ('kyc.approve', 'kyc.reject', 'kyc.failed') then
    v_cap := 'kyc.decide';
    v_entity := 'portal_kyc_document';
  elsif p_action in ('funds.approve', 'funds.reject', 'funds.failed') then
    v_cap := 'funds.settle';
    v_entity := 'portal_wallet_tx';
  else
    raise exception 'unknown action' using errcode = '22023';
  end if;

  if not (select public.staff_can(v_cap)) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if p_entity_id is null or p_entity_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid record id' using errcode = '22023';
  end if;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (
    (select auth.uid()),
    p_action,
    v_entity,
    p_entity_id,
    case
      when p_detail is not null and jsonb_typeof(p_detail) = 'object' and octet_length(p_detail::text) <= 1000 then p_detail
      else '{}'::jsonb
    end
  );
end;
$$;

revoke all on function public.portal_action_record(text, text, jsonb) from public, anon;
grant execute on function public.portal_action_record(text, text, jsonb) to authenticated;
