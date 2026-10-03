-- =============================================================================
-- 20260717090000_security_hardening_rpc_grants.sql
-- Security hardening from the 2026-07-17 Supabase advisor sweep. Grants only —
-- no function bodies or app logic change.
--
-- Background: most SECURITY DEFINER RPCs were created without revoking the
-- default PUBLIC execute grant, so the browser-shipped anon key could call
-- internal money-path functions directly via /rest/v1/rpc/*.
--
-- (1) Internal-only functions -> revoke anon AND authenticated.
--     These are only ever called from inside other SECURITY DEFINER functions /
--     triggers (which execute as the function owner, unaffected by these
--     grants) or via service_role (raptor-trade-bridge edge function).
--     Verified no app code calls them with a user session.
-- (2) Portal RPCs called with an authenticated session -> revoke anon only.
--     Each is self-gated internally (auth.uid() / is_staff() /
--     tech_is_super_admin()), so authenticated stays.
-- (3) ledger_account_balances was a SECURITY DEFINER view with SELECT granted
--     to authenticated -> ANY logged-in client could read all ledger balances.
--     Underlying tables' RLS is staff-gated (is_staff()), so flipping the view
--     to security_invoker keeps the staff fee console working and closes the
--     client-side leak.
--
-- Deliberately UNCHANGED (legitimate anon callers):
--   guest_start_conversation / guest_send_message / guest_fetch_messages
--     (marketing-site guest web chat runs on the anon key)
--   check_login_lockout / record_login_attempt (pre-auth login flow)
--   is_staff / tech_is_super_admin (referenced by RLS policies that are
--     evaluated under anon requests; revoking would turn "no rows" into errors)
--   trigger-returning functions (PostgREST cannot invoke them)
-- =============================================================================

-- (1) internal-only: no client role may call these directly
revoke execute on function public.charge_fee(public.fee_type, text, uuid, uuid, uuid, numeric, numeric, jsonb, numeric, boolean, text, text, uuid, text) from anon, authenticated;
revoke execute on function public.post_journal_entry(text, jsonb, text, text, text, text, uuid, jsonb) from anon, authenticated;
revoke execute on function public.distribute_rebate(uuid, uuid, numeric, text, uuid) from anon, authenticated;
revoke execute on function public.recompute_kyc_status(uuid) from anon, authenticated;
revoke execute on function public.bridge_ingest_position(jsonb) from anon, authenticated;

-- (2) authenticated-only portal RPCs: drop the anon grant
revoke execute on function public.compute_fee(public.fee_type, numeric, numeric, jsonb, timestamp with time zone) from anon;
revoke execute on function public.dispatch_outbox_events(integer) from anon;
revoke execute on function public.settle_ib_commissions(uuid, public.wallet_currency, text) from anon;
revoke execute on function public.process_wallet_transaction(uuid, public.transaction_type, numeric, text, text, text, public.transaction_status, uuid, jsonb) from anon;
revoke execute on function public.become_signal_provider(text, text, uuid, public.copy_risk, integer, numeric) from anon;
revoke execute on function public.copy_list_providers() from anon;
revoke execute on function public.copy_my_subscriptions() from anon;
revoke execute on function public.copy_set_subscription_status(uuid, public.copy_subscription_status) from anon;
revoke execute on function public.copy_subscribe(uuid, numeric, numeric) from anon;
revoke execute on function public.pamm_create_fund(text, text, uuid, integer, integer, numeric, integer) from anon;
revoke execute on function public.pamm_invest(uuid, numeric) from anon;
revoke execute on function public.pamm_list_funds() from anon;
revoke execute on function public.pamm_my_investments() from anon;
revoke execute on function public.pamm_redeem(uuid, numeric) from anon;
revoke execute on function public.ib_downline_summary(uuid) from anon;
revoke execute on function public.staff_charge_fee(public.fee_type, text, uuid, uuid, uuid, numeric, numeric, jsonb, numeric, boolean, text) from anon;
revoke execute on function public.staff_distribute_rebate(uuid, uuid, numeric, text) from anon;
revoke execute on function public.staff_link_ib(uuid, uuid, uuid) from anon;
revoke execute on function public.staff_post_journal_entry(text, jsonb, text, text, jsonb) from anon;
revoke execute on function public.staff_record_trade(uuid, text, public.trade_side, numeric, numeric, numeric, numeric, public.trade_status, bigint, text) from anon;
revoke execute on function public.staff_set_fund_status(uuid, public.pamm_fund_status) from anon;
revoke execute on function public.staff_set_provider_status(uuid, public.copy_provider_status) from anon;
revoke execute on function public.staff_settle_wallet_transaction(uuid, text, text) from anon;
revoke execute on function public.tech_audit_search(text, integer) from anon;

-- (3) ledger balances view: run with the caller's rights so staff-gated RLS applies
alter view public.ledger_account_balances set (security_invoker = true);
