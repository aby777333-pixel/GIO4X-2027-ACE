-- =============================================================================
-- GIO4X · 0023_portal_four_eyes · two people on money; opening a KYC file is recorded
-- =============================================================================
-- 1. OPENING A KYC FILE. Control can now open a client's identity document
--    (a short-lived link to the portal's private storage). Each opening is
--    written to the audit log first: portal_action_record() accepts
--    'kyc.view', which needs kyc.read.
--
-- 2. TWO PEOPLE ON EVERY APPROVAL THAT CHANGES A BALANCE. Approving a deposit
--    credits a client's wallet and approving a withdrawal pays money out. From
--    this migration neither is done by one person:
--
--      first person   "approve"  → a request (portal_approvals, state pending)
--      second person  "confirm"  → the request is confirmed, and only then does
--                                  the server make the change in the portal
--
--    The second person must be a different member of staff holding
--    funds.settle; the database refuses a confirmation by the requester
--    (portal_approval_confirm). A rejection needs one person: refusing to move
--    money is not a risk that needs a second pair of eyes. A request can be
--    withdrawn by anyone holding funds.settle.
--
--    The one exception, the same as for staff access (0004): when nobody else
--    who is active holds funds.settle, there is no second person to ask. The
--    request is then confirmed at once and marked 'unreviewed', and the audit
--    entry says so. Add a second person with the finance or admin role and the
--    exception stops applying by itself.
--
--    portal_approvals holds no client data: a portal transaction id, who asked,
--    who confirmed, when, and the payment reference staff typed.
--
-- Because approval now goes through these functions, portal_action_record()
-- no longer accepts 'funds.approve': an approval's audit entry can only be
-- written by a confirmation (or the stated exception).
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

create table if not exists public.portal_approvals (
  id            bigint generated always as identity primary key,
  tx_id         uuid not null,
  state         text not null default 'pending',
  reference     text,
  requested_by  uuid not null,
  requested_at  timestamptz not null default now(),
  decided_by    uuid,
  decided_at    timestamptz,
  constraint portal_approvals_state_valid check (state in ('pending', 'confirmed', 'unreviewed', 'cancelled')),
  constraint portal_approvals_reference_valid check (reference is null or char_length(reference) <= 120),
  constraint portal_approvals_two_people check (state <> 'confirmed' or (decided_by is not null and decided_by <> requested_by))
);
comment on table public.portal_approvals is 'Requests to approve a deposit or withdrawal in the client portal, and who confirmed them. Written only by the portal_approval_* functions.';

create unique index if not exists portal_approvals_one_open on public.portal_approvals (tx_id) where state = 'pending';
create index if not exists portal_approvals_tx_idx on public.portal_approvals (tx_id, requested_at desc);

alter table public.portal_approvals enable row level security;
alter table public.portal_approvals force row level security;
revoke all on table public.portal_approvals from public, anon, authenticated;

-- the audit entry for a decision made in the portal's database (replaces 0022's)
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
  elsif p_action = 'kyc.view' then
    v_cap := 'kyc.read';
    v_entity := 'portal_kyc_document';
  elsif p_action in ('funds.reject', 'funds.failed') then
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

-- First person: ask for a deposit or withdrawal to be approved.
-- Returns 'pending' (a second person must confirm), 'exists' (already asked for),
-- or 'unreviewed' (nobody else could confirm: approved at once, and recorded as such).
create or replace function public.portal_approval_request(p_tx uuid, p_reference text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_ref    text := nullif(btrim(left(coalesce(p_reference, ''), 120)), '');
  v_others boolean;
begin
  if not (select public.staff_can('funds.settle')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_tx is null then
    raise exception 'invalid record id' using errcode = '22023';
  end if;

  -- one request at a time per transaction, whoever asks
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tx::text, 0));
  if exists (select 1 from public.portal_approvals a where a.tx_id = p_tx and a.state = 'pending') then
    return 'exists';
  end if;

  select exists (
    select 1
    from public.staff s
    join public.role_capabilities rc on rc.role = s.role
    where s.active and s.user_id <> v_me and rc.capability = 'funds.settle'
  ) into v_others;

  if v_others then
    insert into public.portal_approvals (tx_id, state, reference, requested_by) values (p_tx, 'pending', v_ref, v_me);
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (v_me, 'funds.request', 'portal_wallet_tx', p_tx::text,
            case when v_ref is null then '{}'::jsonb else jsonb_build_object('reference', v_ref) end);
    return 'pending';
  end if;

  insert into public.portal_approvals (tx_id, state, reference, requested_by, decided_at) values (p_tx, 'unreviewed', v_ref, v_me, now());
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (v_me, 'funds.approve', 'portal_wallet_tx', p_tx::text,
          jsonb_build_object('unreviewed', true, 'why', 'no other active member of staff holds funds.settle')
            || case when v_ref is null then '{}'::jsonb else jsonb_build_object('reference', v_ref) end);
  return 'unreviewed';
end;
$$;

-- Second person: confirm. Returns { result: 'confirmed', reference, requested_by_name },
-- { result: 'none' } when there is no open request, or { result: 'own' } for the requester.
create or replace function public.portal_approval_confirm(p_tx uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_row  public.portal_approvals%rowtype;
  v_name text;
begin
  if not (select public.staff_can('funds.settle')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select * into v_row from public.portal_approvals a where a.tx_id = p_tx and a.state = 'pending' for update;
  if not found then
    return jsonb_build_object('result', 'none');
  end if;
  if v_row.requested_by = v_me then
    return jsonb_build_object('result', 'own');
  end if;

  update public.portal_approvals set state = 'confirmed', decided_by = v_me, decided_at = now() where id = v_row.id;
  select s.display_name into v_name from public.staff s where s.user_id = v_row.requested_by;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (v_me, 'funds.approve', 'portal_wallet_tx', p_tx::text,
          jsonb_build_object('requested_by', v_row.requested_by)
            || case when v_row.reference is null then '{}'::jsonb else jsonb_build_object('reference', v_row.reference) end);

  return jsonb_build_object('result', 'confirmed', 'reference', v_row.reference, 'requested_by_name', coalesce(v_name, 'a former member of staff'));
end;
$$;

-- Withdraw an open request (the requester, or anyone else holding funds.settle).
-- Returns true when a request was withdrawn.
create or replace function public.portal_approval_cancel(p_tx uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id bigint;
begin
  if not (select public.staff_can('funds.settle')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  update public.portal_approvals set state = 'cancelled', decided_by = v_me, decided_at = now()
   where tx_id = p_tx and state = 'pending'
   returning id into v_id;
  if v_id is null then
    return false;
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (v_me, 'funds.cancel', 'portal_wallet_tx', p_tx::text, '{}'::jsonb);
  return true;
end;
$$;

-- The open requests among the given transactions, for the Funds screen.
create or replace function public.portal_approvals_open(p_ids uuid[])
returns table (tx_id uuid, requested_by_name text, requested_at timestamptz, reference text, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.tx_id,
         coalesce(s.display_name, 'a former member of staff'),
         a.requested_at,
         a.reference,
         a.requested_by = (select auth.uid())
  from public.portal_approvals a
  left join public.staff s on s.user_id = a.requested_by
  where a.state = 'pending'
    and a.tx_id = any (coalesce(p_ids, '{}'::uuid[]))
    and (select public.staff_can('funds.read'));
$$;

revoke all on function public.portal_approval_request(uuid, text) from public, anon;
revoke all on function public.portal_approval_confirm(uuid) from public, anon;
revoke all on function public.portal_approval_cancel(uuid) from public, anon;
revoke all on function public.portal_approvals_open(uuid[]) from public, anon;
grant execute on function public.portal_approval_request(uuid, text) to authenticated;
grant execute on function public.portal_approval_confirm(uuid) to authenticated;
grant execute on function public.portal_approval_cancel(uuid) to authenticated;
grant execute on function public.portal_approvals_open(uuid[]) to authenticated;
