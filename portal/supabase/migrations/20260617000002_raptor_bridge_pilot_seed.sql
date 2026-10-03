-- Pilot seed for the Raptor trade bridge.
-- Maps the founder's live terminal account to a portal mirror account and
-- surfaces it as an ACTIVE Copy signal provider + PAMM fund, so the (already
-- backfilled) mirrored trades show real, computed stats on /copy + /pamm.
-- Idempotent: re-running is a no-op once the mapping exists.

do $$
declare
  v_admin uuid := 'b903e891-6391-4065-85e0-c26bb61d69ee';        -- admin@gio4x.com (founder's portal identity)
  v_raptor_acct uuid := 'a45318ff-fe29-429b-8020-e17a2cfaff75';  -- founder's terminal account (leumpgkfillgeyyfptef)
  v_acct uuid;
begin
  select portal_trading_account_id into v_acct from public.bridge_account_map where raptor_account_id = v_raptor_acct;
  if v_acct is not null then return; end if;  -- already seeded

  insert into public.trading_accounts
    (user_id, account_number, account_kind, leverage, base_currency, balance, equity, margin_free, status, plan_name, server)
  values
    (v_admin, 'RAPTOR-MIRROR-01', 'managed', 500, 'USD', 0, 0, 0, 'active', 'Raptor Mirror', 'GIO-Raptor-Live')
  returning id into v_acct;

  insert into public.bridge_account_map (raptor_account_id, portal_trading_account_id, portal_user_id)
  values (v_raptor_acct, v_acct, v_admin);

  insert into public.signal_providers
    (user_id, trading_account_id, display_name, headline, risk, performance_fee_bps, provider_share_bps, min_allocation, currency, status)
  values
    (v_admin, v_acct, 'GIO Raptor — Founder''s Strategy',
     'Discretionary multi-asset strategy executed live on the GIO Raptor terminal.',
     'medium', 2000, 8000, 100, 'USD', 'active');

  insert into public.pamm_funds
    (manager_id, trading_account_id, name, headline, currency, management_fee_bps, performance_fee_bps, manager_share_bps,
     min_investment, lockup_days, nav_per_unit, high_water_nav, units_outstanding, aum, status)
  values
    (v_admin, v_acct, 'GIO Raptor Managed Fund',
     'Founder-managed PAMM mirroring the live Raptor strategy.',
     'USD', 200, 2000, 8000, 500, 30, 1, 1, 0, 0, 'active');
end $$;
