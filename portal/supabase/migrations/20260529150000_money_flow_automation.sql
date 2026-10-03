-- ============================================================================
-- 20260529150000_money_flow_automation.sql
-- Module 1 of Expansion Pack A — wires the Fee Engine + Rebate Engine into the
-- real money flows so they fire automatically (no dead buttons, fully connected):
--
--   1. trades — append-only record of executed/closed trades per trading account.
--   2. tg_autocharge_settlement_fee — AFTER UPDATE on wallet_transactions: when a
--      deposit/withdraw settles (-> 'completed') the matching deposit/withdrawal
--      fee is computed + charged + posted to the ledger automatically.
--   3. tg_trade_settled — AFTER INSERT/UPDATE on trades: when a trade closes the
--      per-lot commission fee is charged AND a rebate is distributed up the IB
--      tree via distribute_rebate().
--   4. staff_settle_wallet_transaction — staff-gated SECURITY DEFINER settle/reject
--      for pending deposits & withdrawals (moves money, flips status -> the trigger
--      above then charges the fee).
--   5. staff_record_trade — staff-gated booking of a (closed) trade, the portal
--      integration point for the trading platform; firing the rebate/commission.
--
-- ADDITIVE ONLY. Reuses charge_fee(), distribute_rebate(), compute_fee(),
-- process_wallet_transaction(), is_staff(), log_audit(), tg_updated_at(),
-- feature_flags, events_outbox. No existing object is altered or dropped.
-- All fee/rebate side-effects are wrapped so a fee misconfiguration can NEVER
-- block or roll back a settlement/trade — failures land in events_outbox.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · trades — executed trades (the rebate/commission source of truth)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.trade_side AS ENUM ('buy','sell');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.trade_status AS ENUM ('open','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.trades (
  id                  uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  ticket             bigint,                                   -- platform ticket id
  trading_account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol             text NOT NULL DEFAULT 'XAUUSD',
  side               public.trade_side NOT NULL DEFAULT 'buy',
  lots               numeric(12,4) NOT NULL DEFAULT 0 CHECK (lots >= 0),
  open_price         numeric(20,8),
  close_price        numeric(20,8),
  pnl                numeric(20,8) NOT NULL DEFAULT 0,
  commission         numeric(20,8) NOT NULL DEFAULT 0,
  swap               numeric(20,8) NOT NULL DEFAULT 0,
  currency           public.wallet_currency NOT NULL DEFAULT 'USD',
  status             public.trade_status NOT NULL DEFAULT 'closed',
  source             text NOT NULL DEFAULT 'manual',           -- 'manual','platform','copy','pamm'
  opened_at          timestamptz NOT NULL DEFAULT now(),
  closed_at          timestamptz,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trades_account_idx ON public.trades (trading_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trades_user_idx    ON public.trades (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trades_status_idx  ON public.trades (status);
CREATE INDEX IF NOT EXISTS trades_symbol_idx  ON public.trades (symbol);

DROP TRIGGER IF EXISTS trades_updated_at ON public.trades;
CREATE TRIGGER trades_updated_at BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

DROP TRIGGER IF EXISTS trades_audit ON public.trades;
CREATE TRIGGER trades_audit AFTER INSERT OR UPDATE OR DELETE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trades_self_select ON public.trades;
CREATE POLICY trades_self_select ON public.trades FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS trades_staff_all ON public.trades;
CREATE POLICY trades_staff_all ON public.trades FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

GRANT SELECT ON public.trades TO authenticated;
GRANT ALL    ON public.trades TO service_role;

-- ---------------------------------------------------------------------------
-- 2 · Auto-charge deposit / withdrawal fee on settlement
--     Fires when a deposit/withdraw wallet_transaction transitions to completed.
--     Recursion-safe: the fee debit itself is type 'fee'/'rebate', skipped here.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_autocharge_settlement_fee() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_ccy       public.wallet_currency;
  v_fee_type  public.fee_type;
  v_enabled   boolean;
BEGIN
  -- only the transition INTO completed, only for deposit/withdraw
  IF NEW.status <> 'completed' OR COALESCE(OLD.status,'pending') = 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.type NOT IN ('deposit','withdraw') THEN
    RETURN NEW;
  END IF;

  SELECT enabled INTO v_enabled FROM public.feature_flags WHERE key = 'fee_engine';
  IF NOT COALESCE(v_enabled, false) THEN RETURN NEW; END IF;

  SELECT user_id, currency INTO v_user_id, v_ccy
    FROM public.wallets WHERE id = NEW.wallet_id;

  v_fee_type := CASE NEW.type
                  WHEN 'deposit' THEN 'deposit'::public.fee_type
                  ELSE 'withdrawal'::public.fee_type
                END;

  BEGIN
    PERFORM public.charge_fee(
      p_fee_type        => v_fee_type,
      p_idempotency_key => 'settlefee-' || NEW.id::text,
      p_user_id         => v_user_id,
      p_wallet_id       => NEW.wallet_id,
      p_base_amount     => NEW.amount,
      p_scope           => jsonb_build_object('channel', COALESCE(NEW.gateway, 'unknown'),
                                              'currency', v_ccy::text),
      p_move_wallet     => true,
      p_source_type     => NEW.type::text,
      p_source_id       => NEW.id::text,
      p_created_by      => NEW.reviewed_by
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.events_outbox (topic, payload)
    VALUES ('fee.autocharge_failed',
            jsonb_build_object('wallet_tx_id', NEW.id, 'fee_type', v_fee_type, 'error', SQLERRM));
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_tx_autocharge ON public.wallet_transactions;
CREATE TRIGGER wallet_tx_autocharge AFTER UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_autocharge_settlement_fee();

-- ---------------------------------------------------------------------------
-- 3 · On trade close: charge per-lot commission AND distribute IB rebate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_trade_settled() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  -- only the transition INTO closed
  IF NEW.status <> 'closed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'closed' THEN RETURN NEW; END IF;
  IF NEW.lots IS NULL OR NEW.lots <= 0 THEN RETURN NEW; END IF;

  SELECT enabled INTO v_enabled FROM public.feature_flags WHERE key = 'fee_engine';

  -- 3a · per-lot trading commission (ledger-only; spread/commission model)
  IF COALESCE(v_enabled, false) THEN
    BEGIN
      PERFORM public.charge_fee(
        p_fee_type           => 'commission_per_lot',
        p_idempotency_key    => 'tradecomm-' || NEW.id::text,
        p_user_id            => NEW.user_id,
        p_wallet_id          => NULL,                 -- ledger only, no wallet move
        p_trading_account_id => NEW.trading_account_id,
        p_lots               => NEW.lots,
        p_scope              => jsonb_build_object('symbol', NEW.symbol, 'currency', NEW.currency::text),
        p_move_wallet        => false,
        p_source_type        => 'trade',
        p_source_id          => NEW.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.events_outbox (topic, payload)
      VALUES ('fee.trade_commission_failed',
              jsonb_build_object('trade_id', NEW.id, 'error', SQLERRM));
    END;
  END IF;

  -- 3b · distribute rebate up the IB tree (writes commission_ledger)
  BEGIN
    PERFORM public.distribute_rebate(
      p_source_user_id     => NEW.user_id,
      p_trading_account_id => NEW.trading_account_id,
      p_lots               => NEW.lots,
      p_idempotency_prefix => 'trade-' || NEW.id::text
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.events_outbox (topic, payload)
    VALUES ('rebate.distribute_failed',
            jsonb_build_object('trade_id', NEW.id, 'error', SQLERRM));
  END;

  INSERT INTO public.events_outbox (topic, payload)
  VALUES ('trade.closed',
          jsonb_build_object('trade_id', NEW.id, 'user_id', NEW.user_id,
                             'lots', NEW.lots, 'pnl', NEW.pnl, 'symbol', NEW.symbol));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trades_settled ON public.trades;
CREATE TRIGGER trades_settled AFTER INSERT OR UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.tg_trade_settled();

-- ---------------------------------------------------------------------------
-- 4 · staff_settle_wallet_transaction — approve/reject a pending deposit/withdraw
--     Moves the money under a row lock then flips status (firing the fee trigger).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_settle_wallet_transaction(
  p_tx_id       uuid,
  p_action      text DEFAULT 'approve',          -- 'approve' | 'reject'
  p_gateway_ref text DEFAULT NULL
) RETURNS public.wallet_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tx          public.wallet_transactions%ROWTYPE;
  v_wallet      public.wallets%ROWTYPE;
  v_new_balance numeric(20,8);
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff_settle_wallet_transaction: staff access only';
  END IF;

  SELECT * INTO v_tx FROM public.wallet_transactions WHERE id = p_tx_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction % not found', p_tx_id; END IF;

  -- idempotent: anything already finalised is returned untouched
  IF v_tx.status NOT IN ('pending','processing') THEN
    RETURN v_tx;
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.wallet_transactions
       SET status      = 'failed',
           reviewed_by = auth.uid(),
           gateway_ref = COALESCE(p_gateway_ref, gateway_ref)
     WHERE id = p_tx_id
     RETURNING * INTO v_tx;
    RETURN v_tx;
  END IF;

  IF p_action <> 'approve' THEN
    RAISE EXCEPTION 'staff_settle_wallet_transaction: unknown action %', p_action;
  END IF;

  -- approve → move the money
  SELECT * INTO v_wallet FROM public.wallets WHERE id = v_tx.wallet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet % not found', v_tx.wallet_id; END IF;
  IF v_wallet.status <> 'active' THEN
    RAISE EXCEPTION 'wallet % is %, cannot settle', v_wallet.id, v_wallet.status;
  END IF;

  v_new_balance := v_wallet.balance;
  IF v_tx.type IN ('deposit','transfer_in','bonus','rebate','commission','adjustment') THEN
    v_new_balance := v_wallet.balance + v_tx.amount;
  ELSIF v_tx.type IN ('withdraw','transfer_out','fee') THEN
    IF v_wallet.balance < v_tx.amount THEN
      RAISE EXCEPTION 'insufficient balance: have %, need %', v_wallet.balance, v_tx.amount;
    END IF;
    v_new_balance := v_wallet.balance - v_tx.amount;
  ELSE
    RAISE EXCEPTION 'unsupported transaction type for settlement: %', v_tx.type;
  END IF;

  UPDATE public.wallets
     SET balance = v_new_balance, updated_at = now()
   WHERE id = v_wallet.id;

  UPDATE public.wallet_transactions
     SET status        = 'completed',
         balance_after = v_new_balance,
         reviewed_by   = auth.uid(),
         gateway_ref   = COALESCE(p_gateway_ref, gateway_ref)
   WHERE id = p_tx_id
   RETURNING * INTO v_tx;   -- AFTER UPDATE trigger now auto-charges the fee

  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_settle_wallet_transaction(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_settle_wallet_transaction(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5 · staff_record_trade — book a (closed) trade, firing commission + rebate.
--     The portal's integration point for the trading platform / manual entry.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_record_trade(
  p_trading_account_id uuid,
  p_symbol             text,
  p_side               public.trade_side,
  p_lots               numeric,
  p_open_price         numeric DEFAULT NULL,
  p_close_price        numeric DEFAULT NULL,
  p_pnl                numeric DEFAULT 0,
  p_status             public.trade_status DEFAULT 'closed',
  p_ticket             bigint  DEFAULT NULL,
  p_source             text    DEFAULT 'manual'
) RETURNS public.trades
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_ccy     public.wallet_currency;
  v_trade   public.trades%ROWTYPE;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff_record_trade: staff access only';
  END IF;
  IF p_lots IS NULL OR p_lots < 0 THEN
    RAISE EXCEPTION 'staff_record_trade: lots must be >= 0';
  END IF;

  SELECT user_id, base_currency INTO v_user_id, v_ccy
    FROM public.trading_accounts WHERE id = p_trading_account_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'staff_record_trade: trading account % not found', p_trading_account_id;
  END IF;

  INSERT INTO public.trades
    (ticket, trading_account_id, user_id, symbol, side, lots, open_price, close_price,
     pnl, currency, status, source, closed_at)
  VALUES
    (p_ticket, p_trading_account_id, v_user_id, COALESCE(p_symbol,'XAUUSD'), p_side, p_lots,
     p_open_price, p_close_price, COALESCE(p_pnl,0), v_ccy, COALESCE(p_status,'closed'),
     COALESCE(p_source,'manual'),
     CASE WHEN COALESCE(p_status,'closed') = 'closed' THEN now() ELSE NULL END)
  RETURNING * INTO v_trade;

  RETURN v_trade;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_record_trade(uuid, text, public.trade_side, numeric, numeric, numeric, numeric, public.trade_status, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_record_trade(uuid, text, public.trade_side, numeric, numeric, numeric, numeric, public.trade_status, bigint, text) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- END 20260529150000_money_flow_automation.sql
-- ============================================================================
