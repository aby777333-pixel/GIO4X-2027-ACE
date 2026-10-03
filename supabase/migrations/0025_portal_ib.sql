-- =============================================================================
-- GIO4X · 0025_portal_ib · managing introducing brokers, and paying them
-- =============================================================================
-- Control now manages the IB network held in the client portal's database
-- (portal/supabase/migrations/20261003150000_control_ib.sql): who is an IB, who
-- sits under whom, on which plan, and paying out commission that has accrued.
--
--   partners.manage  (admin, finance; from 0024)
--       make a client an IB or an IB a client; put a person under an IB, move
--       or detach them; set the plan and share of a direct link.
--       One person. The audit entry is written first: portal_ib_record().
--
--   partners.settle  (admin, finance; new)
--       pay an IB the commission awaiting settlement in one currency. That
--       credits a wallet, so it takes two people, exactly as a deposit or a
--       withdrawal does (0023): one asks, a different one confirms, and when
--       nobody else on staff holds the capability it is approved at once and
--       recorded as unreviewed. portal_ib_settlement() does all three steps
--       and writes the audit entries.
--
-- portal_approvals gains `kind`: 'wallet_tx' for the rows of 0023, and
-- 'ib_settlement', where tx_id is the IB's id in the portal and reference is
-- the currency. One open request per id, as before.
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
  ('admin', 'partners.settle'), ('finance', 'partners.settle')
on conflict do nothing;

alter table public.portal_approvals add column if not exists kind text not null default 'wallet_tx';
alter table public.portal_approvals drop constraint if exists portal_approvals_kind_valid;
alter table public.portal_approvals add constraint portal_approvals_kind_valid check (kind in ('wallet_tx', 'ib_settlement'));

-- p_action: ib.role | ib.link | ib.unlink | ib.plan | ib.failed
create or replace function public.portal_ib_record(p_action text, p_entity_id text, p_detail jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_action is null or p_action not in ('ib.role', 'ib.link', 'ib.unlink', 'ib.plan', 'ib.failed') then
    raise exception 'unknown action' using errcode = '22023';
  end if;
  if not ((select public.staff_can('partners.manage')) or (p_action = 'ib.failed' and (select public.staff_can('partners.settle')))) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_entity_id is null or p_entity_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid record id' using errcode = '22023';
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values ((select auth.uid()), p_action, 'portal_ib', p_entity_id,
          case when p_detail is not null and jsonb_typeof(p_detail) = 'object' and octet_length(p_detail::text) <= 1000 then p_detail else '{}'::jsonb end);
end;
$$;

-- p_op: request | confirm | cancel.  Returns { result, currency?, requested_by_name? }:
--   request  → pending | exists | unreviewed
--   confirm  → confirmed (with the currency that was asked for) | own | none
--   cancel   → cancelled | none
create or replace function public.portal_ib_settlement(p_op text, p_ib uuid, p_currency text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_row    public.portal_approvals%rowtype;
  v_others boolean;
  v_name   text;
begin
  if not (select public.staff_can('partners.settle')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_ib is null or p_op is null or p_op not in ('request', 'confirm', 'cancel') then
    raise exception 'invalid request' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ib::text, 0));
  select * into v_row from public.portal_approvals a where a.tx_id = p_ib and a.state = 'pending' for update;

  if p_op = 'request' then
    if found then return jsonb_build_object('result', 'exists'); end if;
    if p_currency is null or p_currency !~ '^[A-Z]{3,4}$' then
      raise exception 'invalid currency' using errcode = '22023';
    end if;
    select exists (
      select 1 from public.staff s join public.role_capabilities rc on rc.role = s.role
       where s.active and s.user_id <> v_me and rc.capability = 'partners.settle'
    ) into v_others;
    if v_others then
      insert into public.portal_approvals (kind, tx_id, state, reference, requested_by) values ('ib_settlement', p_ib, 'pending', p_currency, v_me);
      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values (v_me, 'ib.settle_request', 'portal_ib', p_ib::text, jsonb_build_object('currency', p_currency));
      return jsonb_build_object('result', 'pending');
    end if;
    insert into public.portal_approvals (kind, tx_id, state, reference, requested_by, decided_at) values ('ib_settlement', p_ib, 'unreviewed', p_currency, v_me, now());
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (v_me, 'ib.settle', 'portal_ib', p_ib::text,
            jsonb_build_object('currency', p_currency, 'unreviewed', true, 'why', 'no other active member of staff holds partners.settle'));
    return jsonb_build_object('result', 'unreviewed', 'currency', p_currency);
  end if;

  if not found or v_row.kind <> 'ib_settlement' then
    return jsonb_build_object('result', 'none');
  end if;

  if p_op = 'cancel' then
    update public.portal_approvals set state = 'cancelled', decided_by = v_me, decided_at = now() where id = v_row.id;
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (v_me, 'ib.settle_cancel', 'portal_ib', p_ib::text, jsonb_build_object('currency', v_row.reference));
    return jsonb_build_object('result', 'cancelled');
  end if;

  if v_row.requested_by = v_me then
    return jsonb_build_object('result', 'own');
  end if;
  update public.portal_approvals set state = 'confirmed', decided_by = v_me, decided_at = now() where id = v_row.id;
  select s.display_name into v_name from public.staff s where s.user_id = v_row.requested_by;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (v_me, 'ib.settle', 'portal_ib', p_ib::text, jsonb_build_object('currency', v_row.reference, 'requested_by', v_row.requested_by));
  return jsonb_build_object('result', 'confirmed', 'currency', v_row.reference, 'requested_by_name', coalesce(v_name, 'a former member of staff'));
end;
$$;

revoke all on function public.portal_ib_record(text, text, jsonb) from public, anon;
revoke all on function public.portal_ib_settlement(text, uuid, text) from public, anon;
grant execute on function public.portal_ib_record(text, text, jsonb) to authenticated;
grant execute on function public.portal_ib_settlement(text, uuid, text) to authenticated;
