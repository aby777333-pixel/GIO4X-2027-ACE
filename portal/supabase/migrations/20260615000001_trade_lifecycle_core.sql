-- ============================================================================
-- 20260615000001_trade_lifecycle_core.sql
-- Trading core — the open -> close trade lifecycle seam (the "LP bridge"
-- integration point). Until now the only way a row reached public.trades was
-- staff_record_trade(), which books an ALREADY-CLOSED trade. That left a gap:
-- nothing modelled a live (open) position, and there was no canonical RPC an
-- execution backend / dealing desk could call to open a position and later
-- close it. This migration adds that pair:
--
--   1. open_trade()  — books a LIVE (status='open') position. No money moves
--      and NO downstream engine fires on open (tg_trade_settled only acts on
--      the transition INTO 'closed'). Callable by the account owner OR staff
--      OR a service-role execution backend.
--   2. close_trade() — flips a live position to 'closed' with its final price /
--      pnl / swap. This is the authoritative settlement, so it is staff /
--      service-role only (a client must never set its own pnl, which drives
--      commission, IB rebate, copy mirroring and PAMM NAV). Idempotent: closing
--      an already-closed trade is a no-op that returns the row unchanged, so the
--      fee/rebate/copy/PAMM triggers can never double-fire.
--
-- ADDITIVE ONLY. Creates two new functions. Reuses the existing public.trades
-- table, its trades_settled / trades_copy_mirror / trades_pamm_apply / trades_audit
-- triggers, is_staff(), trade_side / trade_status / wallet_currency enums. No
-- existing object is altered or dropped; staff_record_trade() is untouched.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.open_trade(uuid, text, public.trade_side, numeric, numeric, bigint, text);
--   DROP FUNCTION IF EXISTS public.close_trade(uuid, numeric, numeric, numeric);
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · open_trade — book a LIVE position. Owner / staff / service-role.
--     Opening never fires the settlement engines (those key off ->'closed').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_trade(
  p_trading_account_id uuid,
  p_symbol             text,
  p_side               public.trade_side,
  p_lots               numeric,
  p_open_price         numeric DEFAULT NULL,
  p_ticket             bigint  DEFAULT NULL,
  p_source             text    DEFAULT 'platform'
) RETURNS public.trades
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_ccy     public.wallet_currency;
  v_trade   public.trades%ROWTYPE;
BEGIN
  IF p_lots IS NULL OR p_lots <= 0 THEN
    RAISE EXCEPTION 'open_trade: lots must be > 0';
  END IF;

  SELECT user_id, base_currency INTO v_user_id, v_ccy
    FROM public.trading_accounts WHERE id = p_trading_account_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'open_trade: trading account % not found', p_trading_account_id;
  END IF;

  -- Owner of the account, staff, or a service-role backend (auth.uid() IS NULL).
  IF NOT public.is_staff() AND auth.uid() IS NOT NULL AND v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'open_trade: not your trading account';
  END IF;

  INSERT INTO public.trades
    (ticket, trading_account_id, user_id, symbol, side, lots, open_price,
     currency, status, source, opened_at, closed_at)
  VALUES
    (p_ticket, p_trading_account_id, v_user_id, COALESCE(p_symbol,'XAUUSD'), p_side, p_lots,
     p_open_price, v_ccy, 'open', COALESCE(p_source,'platform'), now(), NULL)
  RETURNING * INTO v_trade;

  RETURN v_trade;
END;
$$;

REVOKE ALL ON FUNCTION public.open_trade(uuid, text, public.trade_side, numeric, numeric, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_trade(uuid, text, public.trade_side, numeric, numeric, bigint, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2 · close_trade — settle a live position. Staff / service-role only.
--     The transition INTO 'closed' fires tg_trade_settled (commission +
--     IB rebate + trade.closed event), tg_mirror_provider_trade (copy) and
--     tg_pamm_apply_trade (NAV) via the existing AFTER triggers on trades.
--     Idempotent: an already-closed trade is returned unchanged (no UPDATE,
--     so no trigger re-fires).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_trade(
  p_trade_id    uuid,
  p_close_price numeric DEFAULT NULL,
  p_pnl         numeric DEFAULT 0,
  p_swap        numeric DEFAULT 0
) RETURNS public.trades
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trade public.trades%ROWTYPE;
BEGIN
  -- Authoritative settlement: staff or a service-role backend only.
  IF NOT public.is_staff() AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'close_trade: staff access only';
  END IF;

  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF v_trade.id IS NULL THEN
    RAISE EXCEPTION 'close_trade: trade % not found', p_trade_id;
  END IF;

  -- Idempotent no-op for an already-closed trade (never re-fire the engines).
  IF v_trade.status = 'closed' THEN
    RETURN v_trade;
  END IF;
  IF v_trade.status = 'cancelled' THEN
    RAISE EXCEPTION 'close_trade: trade % is cancelled', p_trade_id;
  END IF;

  UPDATE public.trades
     SET status      = 'closed',
         close_price = COALESCE(p_close_price, close_price),
         pnl         = COALESCE(p_pnl, 0),
         swap        = COALESCE(p_swap, swap),
         closed_at   = now()
   WHERE id = p_trade_id
  RETURNING * INTO v_trade;

  RETURN v_trade;
END;
$$;

REVOKE ALL ON FUNCTION public.close_trade(uuid, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_trade(uuid, numeric, numeric, numeric) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- END 20260615000001_trade_lifecycle_core.sql
-- ============================================================================
