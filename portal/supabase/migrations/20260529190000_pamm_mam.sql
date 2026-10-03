-- ============================================================================
-- 20260529190000_pamm_mam.sql
-- Module 5 of Expansion Pack A — PAMM / MAM (pooled managed accounts).
--
-- Investors buy NAV units in a manager's pool. The manager trades a master
-- trading account; each closed master trade reprices the pool's NAV per unit,
-- so every investor's stake scales proportionally. On redemption we charge a
-- (time-prorated) management fee + a high-water performance fee through the
-- existing fee engine, pay the manager's share into commission_ledger
-- (settled via settle_ib_commissions), and credit the net to the investor's
-- wallet.
--
--   • pamm_funds          — a manager's pool: NAV/unit, units outstanding, AUM,
--                           fee schedule, lockup, status (staff-approved).
--   • pamm_investments    — an investor's position: units, cost basis, locked_until.
--   • pamm_transactions   — append-only log of invest / redeem / fee events.
--   • tg_pamm_apply_trade()— reprice NAV when a master trade closes.
--   • pamm_create_fund / pamm_invest / pamm_redeem / staff_set_fund_status —
--     the buttons behind the UI.
--   • pamm_list_funds / pamm_my_investments — read models with live stats.
--
-- ADDITIVE ONLY. Reuses trades, trading_accounts, wallets, profiles,
-- commission_ledger, charge_fee(), process_wallet_transaction(), events_outbox,
-- is_staff(), log_audit(), tg_updated_at(). 'management' + 'performance' already
-- exist in the fee_type enum.
-- ============================================================================

BEGIN;

-- 0 · Enums
DO $$ BEGIN
  CREATE TYPE public.pamm_fund_status AS ENUM ('pending','active','paused','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pamm_investment_status AS ENUM ('active','redeemed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pamm_txn_kind AS ENUM ('invest','redeem','fee','nav');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1 · Tables
CREATE TABLE IF NOT EXISTS public.pamm_funds (
  id                   uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  manager_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trading_account_id   uuid REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
  name                 text NOT NULL,
  headline             text,
  currency             public.wallet_currency NOT NULL DEFAULT 'USD',
  management_fee_bps   integer NOT NULL DEFAULT 200  CHECK (management_fee_bps BETWEEN 0 AND 1000),
  performance_fee_bps  integer NOT NULL DEFAULT 2000 CHECK (performance_fee_bps BETWEEN 0 AND 5000),
  manager_share_bps    integer NOT NULL DEFAULT 8000 CHECK (manager_share_bps BETWEEN 0 AND 10000),
  min_investment       numeric(20,8) NOT NULL DEFAULT 100 CHECK (min_investment >= 0),
  lockup_days          integer NOT NULL DEFAULT 0 CHECK (lockup_days >= 0),
  nav_per_unit         numeric(20,8) NOT NULL DEFAULT 1.0 CHECK (nav_per_unit > 0),
  high_water_nav       numeric(20,8) NOT NULL DEFAULT 1.0,
  units_outstanding    numeric(28,8) NOT NULL DEFAULT 0,
  aum                  numeric(20,8) NOT NULL DEFAULT 0,
  status               public.pamm_fund_status NOT NULL DEFAULT 'pending',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id, name)
);
CREATE INDEX IF NOT EXISTS pamm_funds_status_idx  ON public.pamm_funds (status);
CREATE INDEX IF NOT EXISTS pamm_funds_account_idx ON public.pamm_funds (trading_account_id);
CREATE INDEX IF NOT EXISTS pamm_funds_manager_idx ON public.pamm_funds (manager_id);

CREATE TABLE IF NOT EXISTS public.pamm_investments (
  id               uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  fund_id          uuid NOT NULL REFERENCES public.pamm_funds(id) ON DELETE CASCADE,
  investor_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  units            numeric(28,8) NOT NULL DEFAULT 0 CHECK (units >= 0),
  invested_amount  numeric(20,8) NOT NULL DEFAULT 0 CHECK (invested_amount >= 0),
  realized_pnl     numeric(20,8) NOT NULL DEFAULT 0,
  fees_paid        numeric(20,8) NOT NULL DEFAULT 0,
  currency         public.wallet_currency NOT NULL DEFAULT 'USD',
  status           public.pamm_investment_status NOT NULL DEFAULT 'active',
  locked_until     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fund_id, investor_id)
);
CREATE INDEX IF NOT EXISTS pamm_inv_fund_idx     ON public.pamm_investments (fund_id);
CREATE INDEX IF NOT EXISTS pamm_inv_investor_idx ON public.pamm_investments (investor_id);
CREATE INDEX IF NOT EXISTS pamm_inv_status_idx   ON public.pamm_investments (status);

CREATE TABLE IF NOT EXISTS public.pamm_transactions (
  id            uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  fund_id       uuid NOT NULL REFERENCES public.pamm_funds(id) ON DELETE CASCADE,
  investor_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind          public.pamm_txn_kind NOT NULL,
  units_delta   numeric(28,8) NOT NULL DEFAULT 0,
  amount        numeric(20,8) NOT NULL DEFAULT 0,
  nav_at        numeric(20,8) NOT NULL DEFAULT 1.0,
  currency      public.wallet_currency NOT NULL DEFAULT 'USD',
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pamm_txn_fund_idx     ON public.pamm_transactions (fund_id);
CREATE INDEX IF NOT EXISTS pamm_txn_investor_idx ON public.pamm_transactions (investor_id);

-- updated_at + audit triggers
DROP TRIGGER IF EXISTS pamm_funds_updated_at ON public.pamm_funds;
CREATE TRIGGER pamm_funds_updated_at BEFORE UPDATE ON public.pamm_funds
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
DROP TRIGGER IF EXISTS pamm_funds_audit ON public.pamm_funds;
CREATE TRIGGER pamm_funds_audit AFTER INSERT OR UPDATE OR DELETE ON public.pamm_funds
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS pamm_investments_updated_at ON public.pamm_investments;
CREATE TRIGGER pamm_investments_updated_at BEFORE UPDATE ON public.pamm_investments
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
DROP TRIGGER IF EXISTS pamm_investments_audit ON public.pamm_investments;
CREATE TRIGGER pamm_investments_audit AFTER INSERT OR UPDATE OR DELETE ON public.pamm_investments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- 2 · RLS
ALTER TABLE public.pamm_funds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pamm_investments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pamm_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pf_public_read ON public.pamm_funds;
DROP POLICY IF EXISTS pf_staff_all   ON public.pamm_funds;
CREATE POLICY pf_public_read ON public.pamm_funds FOR SELECT TO authenticated
  USING (status = 'active' OR manager_id = auth.uid());
CREATE POLICY pf_staff_all ON public.pamm_funds FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS pi_self_read    ON public.pamm_investments;
DROP POLICY IF EXISTS pi_manager_read ON public.pamm_investments;
DROP POLICY IF EXISTS pi_staff_all    ON public.pamm_investments;
CREATE POLICY pi_self_read ON public.pamm_investments FOR SELECT TO authenticated
  USING (investor_id = auth.uid());
CREATE POLICY pi_manager_read ON public.pamm_investments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pamm_funds pf
                  WHERE pf.id = pamm_investments.fund_id AND pf.manager_id = auth.uid()));
CREATE POLICY pi_staff_all ON public.pamm_investments FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS pt_self_read ON public.pamm_transactions;
DROP POLICY IF EXISTS pt_staff_all ON public.pamm_transactions;
CREATE POLICY pt_self_read ON public.pamm_transactions FOR SELECT TO authenticated
  USING (investor_id = auth.uid());
CREATE POLICY pt_staff_all ON public.pamm_transactions FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

GRANT SELECT ON public.pamm_funds        TO authenticated;
GRANT SELECT ON public.pamm_investments  TO authenticated;
GRANT SELECT ON public.pamm_transactions TO authenticated;
GRANT ALL    ON public.pamm_funds        TO service_role;
GRANT ALL    ON public.pamm_investments  TO service_role;
GRANT ALL    ON public.pamm_transactions TO service_role;

-- 3 · NAV repricing trigger — a closed master trade flows to pool equity
CREATE OR REPLACE FUNCTION public.tg_pamm_apply_trade()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fund   record;
  v_new_aum numeric;
  v_new_nav numeric;
BEGIN
  IF NEW.status <> 'closed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'closed' THEN RETURN NEW; END IF;
  IF NEW.trading_account_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_fund FROM public.pamm_funds
   WHERE trading_account_id = NEW.trading_account_id AND status = 'active'
   FOR UPDATE
   LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_fund.units_outstanding <= 0 THEN RETURN NEW; END IF;

  v_new_aum := round(v_fund.aum + COALESCE(NEW.pnl, 0), 8);
  IF v_new_aum < 0 THEN v_new_aum := 0; END IF;
  v_new_nav := round(v_new_aum / v_fund.units_outstanding, 8);
  IF v_new_nav <= 0 THEN v_new_nav := 0.00000001; END IF;

  UPDATE public.pamm_funds
     SET aum            = v_new_aum,
         nav_per_unit   = v_new_nav,
         high_water_nav = GREATEST(high_water_nav, v_new_nav)
   WHERE id = v_fund.id;

  INSERT INTO public.pamm_transactions (fund_id, kind, amount, nav_at, currency, metadata)
  VALUES (v_fund.id, 'nav', COALESCE(NEW.pnl, 0), v_new_nav, v_fund.currency,
          jsonb_build_object('trade_id', NEW.id, 'symbol', NEW.symbol));

  INSERT INTO public.events_outbox (topic, payload)
  VALUES ('pamm.nav_updated',
          jsonb_build_object('fund_id', v_fund.id, 'nav_per_unit', v_new_nav,
                             'aum', v_new_aum, 'pnl', COALESCE(NEW.pnl, 0)));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trades_pamm_apply ON public.trades;
CREATE TRIGGER trades_pamm_apply
  AFTER INSERT OR UPDATE OF status ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.tg_pamm_apply_trade();

-- 4 · Self-serve + staff RPCs
CREATE OR REPLACE FUNCTION public.pamm_create_fund(
  p_name                text,
  p_headline            text DEFAULT NULL,
  p_trading_account_id  uuid DEFAULT NULL,
  p_management_fee_bps  integer DEFAULT 200,
  p_performance_fee_bps integer DEFAULT 2000,
  p_min_investment      numeric DEFAULT 100,
  p_lockup_days         integer DEFAULT 0
) RETURNS public.pamm_funds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.pamm_funds;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'pamm_create_fund: sign-in required'; END IF;
  IF coalesce(btrim(p_name),'') = '' THEN RAISE EXCEPTION 'a fund name is required'; END IF;
  IF p_management_fee_bps < 0 OR p_management_fee_bps > 1000 THEN
    RAISE EXCEPTION 'management fee must be between 0%% and 10%%';
  END IF;
  IF p_performance_fee_bps < 0 OR p_performance_fee_bps > 5000 THEN
    RAISE EXCEPTION 'performance fee must be between 0%% and 50%%';
  END IF;
  IF p_trading_account_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.trading_accounts
                      WHERE id = p_trading_account_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'that trading account is not yours';
  END IF;

  INSERT INTO public.pamm_funds
    (manager_id, trading_account_id, name, headline, management_fee_bps,
     performance_fee_bps, min_investment, lockup_days, status)
  VALUES
    (v_uid, p_trading_account_id, btrim(p_name), p_headline, p_management_fee_bps,
     p_performance_fee_bps, GREATEST(p_min_investment, 0), GREATEST(p_lockup_days, 0), 'pending')
  ON CONFLICT (manager_id, name) DO UPDATE
     SET headline            = EXCLUDED.headline,
         trading_account_id  = EXCLUDED.trading_account_id,
         management_fee_bps  = EXCLUDED.management_fee_bps,
         performance_fee_bps = EXCLUDED.performance_fee_bps,
         min_investment      = EXCLUDED.min_investment,
         lockup_days         = EXCLUDED.lockup_days
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pamm_create_fund(text, text, uuid, integer, integer, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pamm_create_fund(text, text, uuid, integer, integer, numeric, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pamm_invest(
  p_fund_id uuid,
  p_amount  numeric
) RETURNS public.pamm_investments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_fund   public.pamm_funds;
  v_wallet uuid;
  v_units  numeric;
  v_idem   text;
  v_row    public.pamm_investments;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'pamm_invest: sign-in required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'enter a positive amount'; END IF;

  SELECT * INTO v_fund FROM public.pamm_funds WHERE id = p_fund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'fund not found'; END IF;
  IF v_fund.status <> 'active' THEN RAISE EXCEPTION 'this fund is not open for investment'; END IF;
  IF v_fund.manager_id = v_uid THEN RAISE EXCEPTION 'a manager cannot invest in their own fund'; END IF;
  IF p_amount < v_fund.min_investment THEN
    RAISE EXCEPTION 'minimum investment is %', v_fund.min_investment;
  END IF;

  SELECT id INTO v_wallet FROM public.wallets
   WHERE user_id = v_uid AND currency = v_fund.currency AND type = 'main'
   LIMIT 1;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'no % wallet found to fund the investment', v_fund.currency; END IF;

  v_idem := 'pamminv-' || v_uid::text || '-' || p_fund_id::text || '-' || extract(epoch from clock_timestamp())::bigint::text;

  -- pull capital out of the investor wallet into the pool
  PERFORM public.process_wallet_transaction(
    p_wallet_id       => v_wallet,
    p_type            => 'transfer_out',
    p_amount          => round(p_amount, 8),
    p_idempotency_key => v_idem,
    p_status          => 'completed',
    p_related_user_id => v_fund.manager_id,
    p_metadata        => jsonb_build_object('source','pamm_invest','fund_id', p_fund_id));

  v_units := round(round(p_amount, 8) / v_fund.nav_per_unit, 8);

  UPDATE public.pamm_funds
     SET units_outstanding = units_outstanding + v_units,
         aum               = aum + round(p_amount, 8)
   WHERE id = p_fund_id;

  INSERT INTO public.pamm_investments
    (fund_id, investor_id, units, invested_amount, currency, status, locked_until)
  VALUES
    (p_fund_id, v_uid, v_units, round(p_amount, 8), v_fund.currency, 'active',
     now() + make_interval(days => v_fund.lockup_days))
  ON CONFLICT (fund_id, investor_id) DO UPDATE
     SET units           = public.pamm_investments.units + EXCLUDED.units,
         invested_amount = public.pamm_investments.invested_amount + EXCLUDED.invested_amount,
         status          = 'active',
         locked_until    = GREATEST(COALESCE(public.pamm_investments.locked_until, now()), EXCLUDED.locked_until)
  RETURNING * INTO v_row;

  INSERT INTO public.pamm_transactions (fund_id, investor_id, kind, units_delta, amount, nav_at, currency)
  VALUES (p_fund_id, v_uid, 'invest', v_units, round(p_amount, 8), v_fund.nav_per_unit, v_fund.currency);

  INSERT INTO public.events_outbox (topic, payload)
  VALUES ('pamm.invested',
          jsonb_build_object('user_id', v_uid, 'fund_id', p_fund_id,
                             'amount', round(p_amount, 8), 'units', v_units, 'currency', v_fund.currency));

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pamm_invest(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pamm_invest(uuid, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pamm_redeem(
  p_investment_id uuid,
  p_units         numeric DEFAULT NULL   -- NULL = redeem all
) RETURNS public.pamm_investments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_inv     public.pamm_investments;
  v_fund    public.pamm_funds;
  v_units   numeric;
  v_gross   numeric;
  v_cost    numeric;
  v_profit  numeric;
  v_days    numeric;
  v_mgmt    numeric;
  v_perf    numeric;
  v_fee     numeric;
  v_net     numeric;
  v_share   numeric;
  v_wallet  uuid;
  v_idem    text;
  v_row     public.pamm_investments;
BEGIN
  SELECT * INTO v_inv FROM public.pamm_investments WHERE id = p_investment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'investment not found'; END IF;
  IF v_inv.investor_id <> v_uid AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'not your investment';
  END IF;
  IF v_inv.units <= 0 THEN RAISE EXCEPTION 'nothing to redeem'; END IF;
  IF v_inv.locked_until IS NOT NULL AND v_inv.locked_until > now() AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'locked until %', v_inv.locked_until;
  END IF;

  SELECT * INTO v_fund FROM public.pamm_funds WHERE id = v_inv.fund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'fund not found'; END IF;

  v_units := LEAST(COALESCE(p_units, v_inv.units), v_inv.units);
  IF v_units <= 0 THEN RAISE EXCEPTION 'enter a positive number of units'; END IF;

  v_gross  := round(v_units * v_fund.nav_per_unit, 8);
  v_cost   := round(v_inv.invested_amount * (v_units / v_inv.units), 8);
  v_profit := v_gross - v_cost;
  v_days   := GREATEST(extract(epoch from (now() - v_inv.created_at)) / 86400.0, 0);

  v_mgmt := round(v_cost * v_fund.management_fee_bps / 10000.0 * (v_days / 365.0), 8);
  IF v_mgmt < 0 THEN v_mgmt := 0; END IF;
  v_perf := CASE WHEN v_profit > 0
                 THEN round(v_profit * v_fund.performance_fee_bps / 10000.0, 8) ELSE 0 END;
  v_fee  := LEAST(v_mgmt + v_perf, v_gross);
  v_net  := round(v_gross - v_fee, 8);

  SELECT id INTO v_wallet FROM public.wallets
   WHERE user_id = v_inv.investor_id AND currency = v_fund.currency AND type = 'main'
   LIMIT 1;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'no % wallet found to receive the redemption', v_fund.currency; END IF;

  v_idem := 'pammred-' || p_investment_id::text || '-' || extract(epoch from clock_timestamp())::bigint::text;

  -- record fees through the fee engine (revenue side; money is netted from payout)
  IF v_mgmt > 0 THEN
    PERFORM public.charge_fee(
      p_fee_type        => 'management',
      p_idempotency_key => 'pammmgmt-' || v_idem,
      p_user_id         => v_inv.investor_id,
      p_base_amount     => v_cost,
      p_override_amount => v_mgmt,
      p_move_wallet     => false,
      p_source_type     => 'pamm_management',
      p_source_id       => p_investment_id::text);
  END IF;
  IF v_perf > 0 THEN
    PERFORM public.charge_fee(
      p_fee_type        => 'performance',
      p_idempotency_key => 'pammperf-' || v_idem,
      p_user_id         => v_inv.investor_id,
      p_base_amount     => v_profit,
      p_override_amount => v_perf,
      p_move_wallet     => false,
      p_source_type     => 'pamm_performance',
      p_source_id       => p_investment_id::text);
  END IF;

  -- pay the net redemption into the investor wallet
  PERFORM public.process_wallet_transaction(
    p_wallet_id       => v_wallet,
    p_type            => 'transfer_in',
    p_amount          => v_net,
    p_idempotency_key => 'pammpay-' || v_idem,
    p_status          => 'completed',
    p_related_user_id => v_fund.manager_id,
    p_metadata        => jsonb_build_object('source','pamm_redeem','fund_id', v_fund.id,
                                            'gross', v_gross, 'fee', v_fee));

  -- accrue the manager's share of the fees (settled via settle_ib_commissions)
  v_share := round(v_fee * COALESCE(v_fund.manager_share_bps, 8000) / 10000.0, 8);
  IF v_share > 0 THEN
    INSERT INTO public.commission_ledger
      (ib_user_id, source_user_id, trading_account_id, lots, amount, currency, settled, metadata)
    VALUES
      (v_fund.manager_id, v_inv.investor_id, v_fund.trading_account_id, 0, v_share, v_fund.currency, false,
       jsonb_build_object('source','pamm_engine','fund_id', v_fund.id, 'investment_id', p_investment_id));
  END IF;

  -- bookkeeping
  UPDATE public.pamm_funds
     SET units_outstanding = GREATEST(units_outstanding - v_units, 0),
         aum               = GREATEST(aum - v_gross, 0)
   WHERE id = v_fund.id;

  UPDATE public.pamm_investments
     SET units           = units - v_units,
         invested_amount = GREATEST(invested_amount - v_cost, 0),
         fees_paid       = fees_paid + v_fee,
         realized_pnl    = realized_pnl + (v_profit - v_fee),
         status          = CASE WHEN units - v_units <= 0.00000001 THEN 'redeemed' ELSE 'active' END
   WHERE id = p_investment_id
  RETURNING * INTO v_row;

  INSERT INTO public.pamm_transactions (fund_id, investor_id, kind, units_delta, amount, nav_at, currency, metadata)
  VALUES (v_fund.id, v_inv.investor_id, 'redeem', -v_units, v_net, v_fund.nav_per_unit, v_fund.currency,
          jsonb_build_object('gross', v_gross, 'mgmt_fee', v_mgmt, 'perf_fee', v_perf));

  INSERT INTO public.events_outbox (topic, payload)
  VALUES ('pamm.redeemed',
          jsonb_build_object('user_id', v_inv.investor_id, 'fund_id', v_fund.id,
                             'amount', v_net, 'fee', v_fee, 'currency', v_fund.currency));

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pamm_redeem(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pamm_redeem(uuid, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_set_fund_status(
  p_fund_id uuid,
  p_status  public.pamm_fund_status
) RETURNS public.pamm_funds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.pamm_funds;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff_set_fund_status: staff access only';
  END IF;
  UPDATE public.pamm_funds SET status = p_status
   WHERE id = p_fund_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'fund not found'; END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_set_fund_status(uuid, public.pamm_fund_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_set_fund_status(uuid, public.pamm_fund_status) TO authenticated, service_role;

-- 5 · Read models
CREATE OR REPLACE FUNCTION public.pamm_list_funds()
RETURNS TABLE (
  fund_id             uuid,
  manager_id          uuid,
  manager_name        text,
  name                text,
  headline            text,
  currency            public.wallet_currency,
  management_fee_bps  integer,
  performance_fee_bps integer,
  min_investment      numeric,
  lockup_days         integer,
  nav_per_unit        numeric,
  aum                 numeric,
  investors           bigint,
  return_pct          numeric,
  trades_count        bigint,
  win_rate            numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pf.id,
         pf.manager_id,
         pr.full_name,
         pf.name,
         pf.headline,
         pf.currency,
         pf.management_fee_bps,
         pf.performance_fee_bps,
         pf.min_investment,
         pf.lockup_days,
         pf.nav_per_unit,
         pf.aum,
         COALESCE(i.investors, 0),
         round((pf.nav_per_unit - 1.0) * 100.0, 2),
         COALESCE(t.trades_count, 0),
         CASE WHEN COALESCE(t.trades_count,0) > 0
              THEN round(100.0 * t.wins / t.trades_count, 1) ELSE 0 END
    FROM public.pamm_funds pf
    LEFT JOIN public.profiles pr ON pr.id = pf.manager_id
    LEFT JOIN LATERAL (
      SELECT count(*) AS investors
        FROM public.pamm_investments pi
       WHERE pi.fund_id = pf.id AND pi.status = 'active'
    ) i ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS trades_count,
             count(*) FILTER (WHERE tr.pnl > 0) AS wins
        FROM public.trades tr
       WHERE tr.trading_account_id = pf.trading_account_id AND tr.status = 'closed'
    ) t ON true
   WHERE pf.status = 'active'
   ORDER BY pf.aum DESC, pf.nav_per_unit DESC;
$$;

REVOKE ALL ON FUNCTION public.pamm_list_funds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pamm_list_funds() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pamm_my_investments()
RETURNS TABLE (
  investment_id   uuid,
  fund_id         uuid,
  fund_name       text,
  units           numeric,
  invested_amount numeric,
  nav_per_unit    numeric,
  current_value   numeric,
  unrealized_pnl  numeric,
  realized_pnl    numeric,
  fees_paid       numeric,
  status          public.pamm_investment_status,
  currency        public.wallet_currency,
  locked_until    timestamptz,
  created_at      timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pi.id,
         pi.fund_id,
         pf.name,
         pi.units,
         pi.invested_amount,
         pf.nav_per_unit,
         round(pi.units * pf.nav_per_unit, 8),
         round(pi.units * pf.nav_per_unit - pi.invested_amount, 8),
         pi.realized_pnl,
         pi.fees_paid,
         pi.status,
         pi.currency,
         pi.locked_until,
         pi.created_at
    FROM public.pamm_investments pi
    JOIN public.pamm_funds pf ON pf.id = pi.fund_id
   WHERE pi.investor_id = auth.uid()
   ORDER BY pi.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.pamm_my_investments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pamm_my_investments() TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- END 20260529190000_pamm_mam.sql
-- ============================================================================
