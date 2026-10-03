-- 20261003120000_close_known_security_holes.sql
--
-- Closes the holes recorded in docs/BACKOFFICE-PLAN.md section 1, as they stood in the
-- live database (tdifcayznqnaduchzfqz) on 3 October 2026. Additive: no table, column,
-- or function signature is dropped or changed. Safe to run twice.
--
-- WHAT EACH PART CLOSES
--
--  A. Hole 1 (any signed-in client can credit any wallet) and hole 7 (pending
--     withdrawals do not reserve funds).
--     public.process_wallet_transaction keeps its name, arguments and grants, but
--     becomes a thin SECURITY INVOKER dispatcher:
--       * called straight from the API (current_user is anon/authenticated) it goes to
--         public.process_wallet_transaction_client, which enforces the caller rules;
--       * called from inside another SECURITY DEFINER function (transfer_funds,
--         charge_fee, pamm_invest, pamm_redeem, claim_my_ib_commission,
--         settle_ib_commissions: all owned by postgres), by service_role or by
--         postgres, it goes to public.process_wallet_transaction_core unchanged.
--     process_wallet_transaction_core is the previous body plus (a) an idempotency
--     re-check after the wallet row lock and (b) the reservation rule: a withdraw or
--     transfer_out may not exceed balance minus the wallet's other pending/processing
--     withdrawals. It is not executable by anon or authenticated.
--     Client rules (a signed-in non-staff caller): own wallet only; amount > 0; and only
--       deposit      + pending                      (a request; staff settle it)
--       withdraw     + pending                      (KYC approved, profile active, reserved)
--       transfer_out + completed                    (debit of own wallet)
--       transfer_in  + completed                    only as the second leg of the caller's
--                                                   own direct transfer_out ("<key>-out" /
--                                                   "<key>-in", same amount and currency,
--                                                   other wallet of the same user), once.
--     Everything else (bonus, rebate, commission, adjustment, fee, completed deposit,
--     completed withdraw) is refused for clients. Staff (public.is_staff()) keep the
--     previous unrestricted behaviour.
--
--  B. Hole 2 (demo money into a real wallet). public.transfer_funds refuses any
--     transfer in which one endpoint is a demo trading account and the other is not.
--
--  C. Hole 3 (anyone can register as admin). public.handle_new_user only honours
--     'trader', 'ib' or 'affiliate' from the sign-up metadata; anything else becomes
--     'trader'. Staff and admin are set afterwards by admin_set_staff_access, which is
--     what apps/portal/src/lib/team-actions.ts createStaffUser already does.
--
--  D. Hole 4 (staff can make themselves admin; clients can edit privileged profile
--     columns). BEFORE UPDATE trigger profiles_guard_privileged on public.profiles.
--     For writes made straight through the API (current_user anon/authenticated):
--       id                                   never
--       is_super_admin, tech_permissions     super admin only (tech_is_super_admin())
--       role, staff_sections                 admin only (is_admin())
--       status, kyc_status, referred_by      staff only; on a staff/admin row, admin only
--     Writes made by SECURITY DEFINER functions, service_role and postgres are not
--     affected (recompute_kyc_status, activate_on_email_confirm, admin_set_staff_access,
--     tech_set_super_admin, staff_set_customer_status, staff_set_ib_role).
--     Also: staff_set_ib_role no longer changes the role of a staff/admin profile, and
--     staff_set_customer_status needs an admin to change a staff/admin profile.
--
--  E. Hole 5 (client inserts own KYC document as approved). Policy kyc_self_insert now
--     also requires status = 'pending' and no review fields.
--
--  F. Hole 7, second half (no client-callable path writes a balance directly). RLS
--     already has no write policy for clients on wallets / wallet_transactions; the
--     table-level INSERT/UPDATE/DELETE/TRUNCATE grants to anon and authenticated are
--     removed as well, and TRUNCATE (which RLS does not police) is removed on the other
--     money and identity tables.
--
--  NOT addressed here: hole 6 (shared staff login) is an operational matter, not SQL.
--
-- ROLLBACK
--   drop trigger if exists profiles_guard_privileged on public.profiles;
--   drop function if exists public.tg_profiles_guard_privileged();
--   drop policy if exists kyc_self_insert on public.kyc_documents;
--   create policy kyc_self_insert on public.kyc_documents for insert to authenticated
--     with check (user_id = auth.uid());
--   grant insert, update, delete, truncate on public.wallets, public.wallet_transactions
--     to anon, authenticated;
--   grant truncate on public.profiles, public.kyc_documents, public.trading_accounts,
--     public.account_transfers to anon, authenticated;
--   Re-run the earlier definitions of the replaced functions (CREATE OR REPLACE):
--     process_wallet_transaction, handle_new_user  20260528000001_giorapter_ecosystem_foundation.sql
--                                                  (handle_new_user as later amended; the live body
--                                                   before this migration differs only in the role block)
--     transfer_funds                               20260615000004_internal_transfers.sql
--     staff_set_ib_role                            20260620140049_ib_network_management.sql
--     staff_set_customer_status                    20260620144744_staff_customer_status.sql
--   then: drop function if exists public.process_wallet_transaction_client(uuid, public.transaction_type,
--           numeric, text, text, text, public.transaction_status, uuid, jsonb);
--         drop function if exists public.process_wallet_transaction_core(uuid, public.transaction_type,
--           numeric, text, text, text, public.transaction_status, uuid, jsonb);

-- No BEGIN/COMMIT here: apply_migration and `supabase db push` already run a migration
-- in one transaction. If you paste this into the SQL editor, wrap it in one yourself.

-- =====================================================================================
-- A. Wallet transactions: engine, client rules, dispatcher
-- =====================================================================================

-- A1. The engine. Previous body of process_wallet_transaction, plus the idempotency
--     re-check under the wallet lock and the pending-withdrawal reservation.
create or replace function public.process_wallet_transaction_core(
  p_wallet_id        uuid,
  p_type             public.transaction_type,
  p_amount           numeric,
  p_idempotency_key  text,
  p_gateway          text default null,
  p_gateway_ref      text default null,
  p_status           public.transaction_status default 'pending'::public.transaction_status,
  p_related_user_id  uuid default null,
  p_metadata         jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet       public.wallets%rowtype;
  v_new_balance  numeric(20,8);
  v_reserved     numeric(20,8) := 0;
  v_tx_id        uuid;
  v_existing     uuid;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'process_wallet_transaction: amount must be non-negative (got %)', p_amount;
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'process_wallet_transaction: idempotency_key required (min 8 chars)';
  end if;

  select id into v_existing from public.wallet_transactions
   where idempotency_key = p_idempotency_key limit 1;
  if v_existing is not null then return v_existing; end if;

  select * into v_wallet from public.wallets where id = p_wallet_id for update;
  if not found then raise exception 'wallet % not found', p_wallet_id; end if;

  -- Same key may have been written while this call waited for the wallet lock.
  select id into v_existing from public.wallet_transactions
   where idempotency_key = p_idempotency_key limit 1;
  if v_existing is not null then return v_existing; end if;

  if v_wallet.status <> 'active' then
    raise exception 'wallet % is %, cannot transact', p_wallet_id, v_wallet.status;
  end if;

  -- Reservation: money already asked for in a pending withdrawal cannot be asked for
  -- again, withdrawn, or moved out. The wallet row lock above serialises this check.
  if p_type in ('withdraw', 'transfer_out')
     and p_status in ('pending', 'processing', 'completed') then
    select coalesce(sum(t.amount), 0) into v_reserved
      from public.wallet_transactions t
     where t.wallet_id = p_wallet_id
       and t.type = 'withdraw'
       and t.status in ('pending', 'processing');
    if v_wallet.balance - v_reserved < p_amount then
      raise exception 'insufficient available balance: have %, reserved for pending withdrawals %, need %',
        v_wallet.balance, v_reserved, p_amount;
    end if;
  end if;

  v_new_balance := v_wallet.balance;
  case p_type
    when 'deposit', 'bonus', 'rebate', 'commission', 'transfer_in', 'adjustment' then
      if p_status = 'completed' then v_new_balance := v_wallet.balance + p_amount; end if;
    when 'withdraw', 'transfer_out', 'fee' then
      if p_status = 'completed' then
        if v_wallet.balance < p_amount then
          raise exception 'insufficient balance: have %, need %', v_wallet.balance, p_amount;
        end if;
        v_new_balance := v_wallet.balance - p_amount;
      end if;
    else
      raise exception 'unsupported transaction type: %', p_type;
  end case;

  if p_status = 'completed' then
    update public.wallets set balance = v_new_balance, updated_at = now() where id = p_wallet_id;
  end if;

  insert into public.wallet_transactions
    (wallet_id, type, amount, currency, balance_after, status, gateway, gateway_ref,
     idempotency_key, related_user_id, metadata)
  values
    (p_wallet_id, p_type, p_amount, v_wallet.currency, v_new_balance, p_status, p_gateway, p_gateway_ref,
     p_idempotency_key, p_related_user_id, p_metadata)
  returning id into v_tx_id;

  return v_tx_id;
end;
$$;

revoke all on function public.process_wallet_transaction_core(
  uuid, public.transaction_type, numeric, text, text, text, public.transaction_status, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_wallet_transaction_core(
  uuid, public.transaction_type, numeric, text, text, text, public.transaction_status, uuid, jsonb)
  to service_role;

-- A2. Caller rules for calls that arrive straight from the API as a signed-in user.
create or replace function public.process_wallet_transaction_client(
  p_wallet_id        uuid,
  p_type             public.transaction_type,
  p_amount           numeric,
  p_idempotency_key  text,
  p_gateway          text default null,
  p_gateway_ref      text default null,
  p_status           public.transaction_status default 'pending'::public.transaction_status,
  p_related_user_id  uuid default null,
  p_metadata         jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_owner      uuid;
  v_currency   public.wallet_currency;
  v_existing   uuid;
  v_kyc        public.kyc_status;
  v_pstatus    public.user_status;
  v_out_key    text;
  v_match      uuid;
  v_meta       jsonb;
begin
  if v_uid is null then
    raise exception 'process_wallet_transaction: sign in required' using errcode = '42501';
  end if;

  -- Staff keep the previous behaviour.
  if public.is_staff() then
    return public.process_wallet_transaction_core(
      p_wallet_id, p_type, p_amount, p_idempotency_key, p_gateway, p_gateway_ref,
      p_status, p_related_user_id, p_metadata);
  end if;

  select w.user_id, w.currency into v_owner, v_currency
    from public.wallets w where w.id = p_wallet_id;
  if v_owner is null or v_owner <> v_uid then
    -- Same message whether the wallet is missing or someone else's.
    raise exception 'wallet % not found', p_wallet_id using errcode = '42501';
  end if;

  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'process_wallet_transaction: idempotency_key required (min 8 chars)';
  end if;

  -- A retry with the same key returns the first result, as before.
  select t.id into v_existing from public.wallet_transactions t
   where t.idempotency_key = p_idempotency_key and t.wallet_id = p_wallet_id limit 1;
  if v_existing is not null then return v_existing; end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'process_wallet_transaction: amount must be greater than 0';
  end if;

  if p_type = 'deposit' and p_status = 'pending' then
    null;  -- a request; credited only when staff settle it

  elsif p_type = 'withdraw' and p_status = 'pending' then
    select p.kyc_status, p.status into v_kyc, v_pstatus
      from public.profiles p where p.id = v_uid;
    if v_kyc is distinct from 'approved' then
      raise exception 'process_wallet_transaction: KYC must be approved before requesting a withdrawal';
    end if;
    if v_pstatus is distinct from 'active' then
      raise exception 'process_wallet_transaction: account is not active';
    end if;
    -- the reservation check is in process_wallet_transaction_core

  elsif p_type = 'transfer_out' and p_status = 'completed' then
    null;  -- debit of the caller's own wallet; balance and reservation checked in core

  elsif p_type = 'transfer_in' and p_status = 'completed' then
    -- Only as the second leg of the caller's own direct wallet-to-wallet transfer
    -- (apps/portal/src/lib/wallet-actions.ts transferBetweenWallets: "<key>-out" then
    -- "<key>-in"). The idempotency key is unique, so one debit yields one credit.
    if right(p_idempotency_key, 3) <> '-in' then
      raise exception 'process_wallet_transaction: transfer_in is not permitted' using errcode = '42501';
    end if;
    v_out_key := left(p_idempotency_key, length(p_idempotency_key) - 3) || '-out';
    select t.id into v_match
      from public.wallet_transactions t
      join public.wallets w on w.id = t.wallet_id
     where t.idempotency_key = v_out_key
       and t.type = 'transfer_out'
       and t.status = 'completed'
       and t.wallet_id <> p_wallet_id
       and w.user_id = v_uid
       and w.currency = v_currency
       and round(t.amount, 8) = round(p_amount, 8)
       -- set below, only by this function: the debit was a direct client call, not the
       -- wallet leg of transfer_funds / pamm_invest (which credit elsewhere themselves)
       and t.metadata ->> 'origin' = 'client_rpc';
    if v_match is null then
      raise exception 'process_wallet_transaction: transfer_in has no matching transfer_out'
        using errcode = '42501';
    end if;

  else
    raise exception 'process_wallet_transaction: % with status % is not permitted', p_type, p_status
      using errcode = '42501';
  end if;

  v_meta := case when jsonb_typeof(p_metadata) = 'object' then p_metadata else '{}'::jsonb end
            || jsonb_build_object('origin', 'client_rpc', 'requested_by', v_uid);

  return public.process_wallet_transaction_core(
    p_wallet_id, p_type, p_amount, p_idempotency_key, p_gateway, p_gateway_ref,
    p_status, p_related_user_id, v_meta);
end;
$$;

revoke all on function public.process_wallet_transaction_client(
  uuid, public.transaction_type, numeric, text, text, text, public.transaction_status, uuid, jsonb)
  from public, anon;
grant execute on function public.process_wallet_transaction_client(
  uuid, public.transaction_type, numeric, text, text, text, public.transaction_status, uuid, jsonb)
  to authenticated;

-- A3. The public name. Same signature and grants as before. SECURITY INVOKER on purpose:
--     current_user here is the role that is really calling. Straight from the API that is
--     anon/authenticated; from inside a SECURITY DEFINER function it is that function's
--     owner (postgres), which may execute the core; an API role may not.
create or replace function public.process_wallet_transaction(
  p_wallet_id        uuid,
  p_type             public.transaction_type,
  p_amount           numeric,
  p_idempotency_key  text,
  p_gateway          text default null,
  p_gateway_ref      text default null,
  p_status           public.transaction_status default 'pending'::public.transaction_status,
  p_related_user_id  uuid default null,
  p_metadata         jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    return public.process_wallet_transaction_client(
      p_wallet_id, p_type, p_amount, p_idempotency_key, p_gateway, p_gateway_ref,
      p_status, p_related_user_id, p_metadata);
  end if;
  return public.process_wallet_transaction_core(
    p_wallet_id, p_type, p_amount, p_idempotency_key, p_gateway, p_gateway_ref,
    p_status, p_related_user_id, p_metadata);
end;
$$;

revoke all on function public.process_wallet_transaction(
  uuid, public.transaction_type, numeric, text, text, text, public.transaction_status, uuid, jsonb)
  from public, anon;
grant execute on function public.process_wallet_transaction(
  uuid, public.transaction_type, numeric, text, text, text, public.transaction_status, uuid, jsonb)
  to authenticated, service_role;

-- =====================================================================================
-- B. transfer_funds: demo accounts are sealed off from wallets and non-demo accounts
--    (live body, plus account_kind on both endpoints and the demo rule)
-- =====================================================================================
create or replace function public.transfer_funds(
  p_from_kind        text,
  p_from_id          uuid,
  p_to_kind          text,
  p_to_id            uuid,
  p_amount           numeric,
  p_idempotency_key  text
) returns public.account_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller    uuid := auth.uid();
  v_staff     boolean := public.is_staff();
  v_existing  public.account_transfers;
  v_src_user  uuid;  v_src_ccy public.wallet_currency;  v_src_bal numeric(20,8);  v_src_status text;
  v_dst_user  uuid;  v_dst_ccy public.wallet_currency;  v_dst_status text;
  v_src_demo  boolean := false;
  v_dst_demo  boolean := false;
  v_to_amount numeric(20,8);
  v_row       public.account_transfers;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'transfer_funds: amount must be > 0';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'transfer_funds: idempotency_key required (min 8 chars)';
  end if;
  if p_from_kind not in ('wallet','account') or p_to_kind not in ('wallet','account') then
    raise exception 'transfer_funds: kind must be wallet or account';
  end if;
  if p_from_kind = p_to_kind and p_from_id = p_to_id then
    raise exception 'transfer_funds: source and destination are the same';
  end if;

  select * into v_existing from public.account_transfers where idempotency_key = p_idempotency_key limit 1;
  if found then return v_existing; end if;

  if p_from_kind = 'wallet' then
    select user_id, currency, balance, status::text into v_src_user, v_src_ccy, v_src_bal, v_src_status
      from public.wallets where id = p_from_id for update;
  else
    select user_id, base_currency, balance, status::text, (account_kind = 'demo')
      into v_src_user, v_src_ccy, v_src_bal, v_src_status, v_src_demo
      from public.trading_accounts where id = p_from_id for update;
  end if;
  if v_src_user is null then
    raise exception 'transfer_funds: source % not found', p_from_id;
  end if;
  if v_src_status <> 'active' then
    raise exception 'transfer_funds: source is % (must be active)', v_src_status;
  end if;

  if p_to_kind = 'wallet' then
    select user_id, currency, status::text into v_dst_user, v_dst_ccy, v_dst_status
      from public.wallets where id = p_to_id for update;
  else
    select user_id, base_currency, status::text, (account_kind = 'demo')
      into v_dst_user, v_dst_ccy, v_dst_status, v_dst_demo
      from public.trading_accounts where id = p_to_id for update;
  end if;
  if v_dst_user is null then
    raise exception 'transfer_funds: destination % not found', p_to_id;
  end if;
  if v_dst_status <> 'active' then
    raise exception 'transfer_funds: destination is % (must be active)', v_dst_status;
  end if;

  if not v_staff then
    if v_caller is null or v_src_user <> v_caller or v_dst_user <> v_caller then
      raise exception 'transfer_funds: not authorized for these endpoints';
    end if;
  end if;
  if v_src_user <> v_dst_user then
    raise exception 'transfer_funds: cannot transfer between different users';
  end if;

  -- Demo balances are play money. They may move between demo accounts only; this
  -- applies to staff as well.
  if coalesce(v_src_demo, false) <> coalesce(v_dst_demo, false) then
    raise exception 'transfer_funds: demo accounts cannot exchange funds with wallets or real accounts';
  end if;

  if v_src_ccy = v_dst_ccy then
    v_to_amount := round(p_amount, 8);
  elsif v_src_ccy = 'USD' and v_dst_ccy = 'USC' then
    v_to_amount := round(p_amount * 100, 8);
  elsif v_src_ccy = 'USC' and v_dst_ccy = 'USD' then
    v_to_amount := round(p_amount / 100, 8);
  else
    raise exception 'transfer_funds: unsupported currency pair % -> %', v_src_ccy, v_dst_ccy;
  end if;

  if v_src_bal < p_amount then
    raise exception 'transfer_funds: insufficient balance (have %, need %)', v_src_bal, p_amount;
  end if;

  if p_from_kind = 'wallet' then
    perform public.process_wallet_transaction(
      p_wallet_id => p_from_id, p_type => 'transfer_out', p_amount => p_amount,
      p_idempotency_key => 'xferout-' || p_idempotency_key, p_status => 'completed',
      p_related_user_id => v_src_user,
      p_metadata => jsonb_build_object('transfer', p_idempotency_key, 'to_kind', p_to_kind, 'to_id', p_to_id));
  else
    update public.trading_accounts
       set balance = balance - p_amount, equity = equity - p_amount, updated_at = now()
     where id = p_from_id;
  end if;

  if p_to_kind = 'wallet' then
    perform public.process_wallet_transaction(
      p_wallet_id => p_to_id, p_type => 'transfer_in', p_amount => v_to_amount,
      p_idempotency_key => 'xferin-' || p_idempotency_key, p_status => 'completed',
      p_related_user_id => v_dst_user,
      p_metadata => jsonb_build_object('transfer', p_idempotency_key, 'from_kind', p_from_kind, 'from_id', p_from_id));
  else
    update public.trading_accounts
       set balance = balance + v_to_amount, equity = equity + v_to_amount, updated_at = now()
     where id = p_to_id;
  end if;

  insert into public.account_transfers
    (user_id, from_kind, from_id, from_currency, from_amount,
     to_kind, to_id, to_currency, to_amount, status, idempotency_key, metadata)
  values
    (v_src_user, p_from_kind, p_from_id, v_src_ccy, round(p_amount,8),
     p_to_kind, p_to_id, v_dst_ccy, v_to_amount, 'completed', p_idempotency_key,
     jsonb_build_object('by', v_caller))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.transfer_funds(text, uuid, text, uuid, numeric, text) from public, anon;
grant execute on function public.transfer_funds(text, uuid, text, uuid, numeric, text)
  to authenticated, service_role;

-- =====================================================================================
-- C. handle_new_user: the sign-up form cannot choose a staff or admin role
--    (live body; only the role block differs. search_path kept as it was because
--     generate_referral_code is SECURITY INVOKER and resolves names through it.)
-- =====================================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_referrer_id   uuid;
  v_role          public.user_role := 'trader';
  v_full_name     text := '';
  v_phone         text;
  v_source        text := 'organic';
  v_wallet_ref    text;
  v_referral_code text;
  v_meta          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if v_meta ? 'full_name' then v_full_name := v_meta->>'full_name'; end if;
  if v_meta ? 'phone'     then v_phone     := v_meta->>'phone';     end if;
  if v_meta ? 'source'    then v_source    := v_meta->>'source';    end if;

  -- raw_user_meta_data is written by whoever signs up. Only the client roles the
  -- sign-up form offers are honoured; 'staff' and 'admin' are granted afterwards by
  -- an admin through public.admin_set_staff_access.
  if v_meta->>'role' in ('trader', 'ib', 'affiliate') then
    v_role := (v_meta->>'role')::public.user_role;
  end if;

  if v_meta ? 'referral_code' then
    select id into v_referrer_id
    from public.profiles where referral_code = v_meta->>'referral_code' limit 1;
  end if;

  v_referral_code := public.generate_referral_code(new.id);

  insert into public.profiles (id, email, full_name, phone, role, referred_by, referral_code, status)
  values (
    new.id, new.email, v_full_name, coalesce(v_phone, new.phone), v_role, v_referrer_id, v_referral_code,
    case when new.email_confirmed_at is not null then 'active'::public.user_status
         else 'pending_verification'::public.user_status end
  )
  on conflict (id) do nothing;

  insert into public.crm_profiles (user_id, source) values (new.id, v_source) on conflict (user_id) do nothing;

  v_wallet_ref := 'W-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.wallet_seq')::text, 7, '0');
  insert into public.wallets (wallet_id, user_id, currency, type)
  values (v_wallet_ref, new.id, 'USD', 'main')
  on conflict (user_id, currency, type) do nothing;

  if v_referrer_id is not null then
    insert into public.ib_relationships (parent_id, child_id, level, commission_plan_id)
    values (v_referrer_id, new.id, 1, (select id from public.commission_plans where is_default = true limit 1))
    on conflict (parent_id, child_id) do nothing;
  end if;

  return new;
end;
$$;

-- =====================================================================================
-- D. profiles: privileged columns
-- =====================================================================================

-- D1. Column guard for writes that come straight through the API. SECURITY INVOKER on
--     purpose (see A3): inside a SECURITY DEFINER function current_user is the owner,
--     so the audited RPCs keep working and carry their own checks.
create or replace function public.tg_profiles_guard_privileged() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profiles: id cannot be changed' using errcode = '42501';
  end if;

  if new.is_super_admin is distinct from old.is_super_admin
     or new.tech_permissions is distinct from old.tech_permissions then
    if not coalesce(public.tech_is_super_admin(), false) then
      raise exception 'profiles: only a super admin can change is_super_admin or tech_permissions'
        using errcode = '42501';
    end if;
  end if;

  if new.role is distinct from old.role
     or new.staff_sections is distinct from old.staff_sections then
    if not coalesce(public.is_admin(), false) then
      raise exception 'profiles: only an admin can change role or staff_sections'
        using errcode = '42501';
    end if;
  end if;

  if new.status is distinct from old.status
     or new.kyc_status is distinct from old.kyc_status
     or new.referred_by is distinct from old.referred_by then
    if not coalesce(public.is_staff(), false) then
      raise exception 'profiles: status, kyc_status and referred_by are set by staff'
        using errcode = '42501';
    end if;
    if old.role in ('staff', 'admin') and not coalesce(public.is_admin(), false) then
      raise exception 'profiles: only an admin can change a staff or admin profile'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.tg_profiles_guard_privileged() from public, anon, authenticated;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.tg_profiles_guard_privileged();

-- D2. staff_set_ib_role flips trader <-> ib. It could also turn an admin into a trader
--     or ib; staff and admin roles now stay with admin_set_staff_access.
create or replace function public.staff_set_ib_role(p_user_id uuid, p_is_ib boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  if not public.is_staff() then raise exception 'staff access only'; end if;
  select role into v_role from public.profiles where id = p_user_id;
  if v_role in ('staff', 'admin') then
    raise exception 'staff and admin roles are managed by a master admin';
  end if;
  update public.profiles
     set role = case when p_is_ib then 'ib'::public.user_role else 'trader'::public.user_role end,
         updated_at = now()
   where id = p_user_id;
  return 'ok';
end;
$$;

revoke all on function public.staff_set_ib_role(uuid, boolean) from public, anon;
grant execute on function public.staff_set_ib_role(uuid, boolean) to authenticated, service_role;

-- D3. staff_set_customer_status: a member of staff cannot suspend or close a colleague
--     or an admin; an admin can.
create or replace function public.staff_set_customer_status(p_user_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  if not public.is_staff() then raise exception 'staff access only'; end if;
  if p_status not in ('active','suspended','closed','pending_verification') then
    raise exception 'invalid status %', p_status;
  end if;
  select role into v_role from public.profiles where id = p_user_id;
  if v_role in ('staff', 'admin') and not public.is_admin() then
    raise exception 'only a master admin can change the status of a staff or admin profile';
  end if;
  update public.profiles set status = p_status::public.user_status, updated_at = now()
   where id = p_user_id;
  return 'ok';
end;
$$;

revoke all on function public.staff_set_customer_status(uuid, text) from public, anon;
grant execute on function public.staff_set_customer_status(uuid, text) to authenticated, service_role;

-- =====================================================================================
-- E. kyc_documents: a client can only insert a document awaiting review
-- =====================================================================================
drop policy if exists kyc_self_insert on public.kyc_documents;
create policy kyc_self_insert on public.kyc_documents
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'::public.kyc_doc_status
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
  );

-- =====================================================================================
-- F. Grants: balances and the transaction record are written by functions only
-- =====================================================================================
revoke insert, update, delete, truncate on public.wallets             from anon, authenticated;
revoke insert, update, delete, truncate on public.wallet_transactions from anon, authenticated;
revoke truncate on public.profiles, public.kyc_documents, public.trading_accounts, public.account_transfers
  from anon, authenticated;
