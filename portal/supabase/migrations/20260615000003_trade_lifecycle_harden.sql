-- ============================================================================
-- 20260615000003_trade_lifecycle_harden.sql
-- SECURITY HARDENING for open_trade() / close_trade() (added in
-- 20260615000001). The Supabase database linter flagged
-- 0028_anon_security_definer_function_executable: Supabase's default function
-- privileges grant EXECUTE to `anon`, and the original guards used
-- `auth.uid() IS NOT NULL` to wave through a service-role backend. But the
-- `anon` role ALSO has a NULL auth.uid(), so an unauthenticated caller could
-- reach /rest/v1/rpc/close_trade and settle a trade with an arbitrary pnl
-- (which drives commission / IB rebate / copy / PAMM). Hole.
--
-- FIX (defense in depth):
--   1. Re-author both guards to authorize on auth.role() instead of relying on
--      a NULL auth.uid(). Allowed callers:
--        - staff/admin            (public.is_staff())
--        - service-role backend   (auth.role() = 'service_role')
--        - trusted server context (auth.role() IS NULL — direct DB / migrations)
--        - open_trade only: the account OWNER (auth.uid() = account.user_id)
--      'anon' and ordinary 'authenticated' users are rejected.
--   2. REVOKE EXECUTE ... FROM anon so PostgREST refuses the call before the
--      function body even runs.
--
-- ADDITIVE: CREATE OR REPLACE (no signature change) + REVOKE. ROLLBACK: re-apply
-- 20260615000001 definitions and re-GRANT anon if ever desired (not advised).
-- ============================================================================

BEGIN;

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
  v_role    text := (select auth.role());
BEGIN
  IF p_lots IS NULL OR p_lots <= 0 THEN
    RAISE EXCEPTION 'open_trade: lots must be > 0';
  END IF;

  SELECT user_id, base_currency INTO v_user_id, v_ccy
    FROM public.trading_accounts WHERE id = p_trading_account_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'open_trade: trading account % not found', p_trading_account_id;
  END IF;

  -- staff, service-role backend, trusted server context, or the account owner.
  IF NOT (public.is_staff()
          OR v_role IS NULL
          OR v_role = 'service_role'
          OR (auth.uid() IS NOT NULL AND v_user_id = auth.uid())) THEN
    RAISE EXCEPTION 'open_trade: not authorized for this trading account';
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
  v_role  text := (select auth.role());
BEGIN
  -- Authoritative settlement: staff, service-role backend, or trusted server.
  IF NOT (public.is_staff() OR v_role IS NULL OR v_role = 'service_role') THEN
    RAISE EXCEPTION 'close_trade: staff access only';
  END IF;

  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF v_trade.id IS NULL THEN
    RAISE EXCEPTION 'close_trade: trade % not found', p_trade_id;
  END IF;

  IF v_trade.status = 'closed' THEN
    RETURN v_trade;            -- idempotent no-op; never re-fire the engines
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

-- Defense in depth: keep the public REST surface closed to anon.
REVOKE EXECUTE ON FUNCTION public.open_trade(uuid, text, public.trade_side, numeric, numeric, bigint, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_trade(uuid, numeric, numeric, numeric) FROM anon;

COMMIT;

-- ============================================================================
-- END 20260615000003_trade_lifecycle_harden.sql
-- ============================================================================
