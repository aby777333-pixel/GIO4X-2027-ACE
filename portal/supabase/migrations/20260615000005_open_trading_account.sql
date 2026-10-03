-- ============================================================================
-- 20260615000005_open_trading_account.sql
-- Account opening — a proper RPC to mint a trading account (demo OR live) with
-- a real sequential account number from trading_account_seq. Until now the only
-- path was a client-side INSERT (RLS allows clients to insert their OWN 'demo'
-- accounts only), and the account number was a hacky epoch string. Live
-- accounts could not be opened at all from the portal, which blocked the
-- transfer/positions flows from having a fundable destination.
--
--   open_trading_account(p_kind, p_currency, p_leverage, p_plan) — SECURITY
--   DEFINER, auth-required, owner-scoped. demo accounts are credited with play
--   funds (10,000); live accounts start at 0 (fund via deposit/transfer).
--
-- ADDITIVE ONLY. New function; reuses trading_account_seq, is_staff, the
-- trading_accounts table + its audit trigger. Nothing altered/dropped; the
-- existing client demo-insert path keeps working.
-- ROLLBACK: DROP FUNCTION public.open_trading_account(public.account_kind, public.wallet_currency, integer, text);
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.open_trading_account(
  p_kind     public.account_kind DEFAULT 'demo',
  p_currency public.wallet_currency DEFAULT 'USD',
  p_leverage integer DEFAULT 500,
  p_plan     text DEFAULT NULL
) RETURNS public.trading_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_num     text;
  v_start   numeric(20,8);
  v_server  text;
  v_plan    text;
  v_row     public.trading_accounts%ROWTYPE;
BEGIN
  -- A real signed-in user is required; the account is opened for that user.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'open_trading_account: sign in required';
  END IF;

  -- Clients open demo or live accounts. copy/prop/managed are provisioned by
  -- their own engines (signal provider / prop desk / PAMM), staff only.
  IF p_kind NOT IN ('demo','live') AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'open_trading_account: % accounts are not self-served', p_kind;
  END IF;
  IF p_leverage IS NULL OR p_leverage < 1 OR p_leverage > 2000 THEN
    RAISE EXCEPTION 'open_trading_account: leverage must be 1..2000';
  END IF;

  -- real sequential public account number (>= 100001), unique by sequence
  v_num := (100000 + nextval('public.trading_account_seq'))::text;

  IF p_kind = 'demo' THEN
    v_start  := 10000;
    v_server := 'GIO4X-Demo';
    v_plan   := COALESCE(p_plan, 'Demo');
  ELSE
    v_start  := 0;
    v_server := 'GIO4X-Live01';
    v_plan   := COALESCE(p_plan, 'Classic');
  END IF;

  INSERT INTO public.trading_accounts
    (account_number, user_id, account_kind, leverage, base_currency,
     balance, equity, margin_free, status, plan_name, server)
  VALUES
    (v_num, v_caller, p_kind, p_leverage, p_currency,
     v_start, v_start, v_start, 'active', v_plan, v_server)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.open_trading_account(public.account_kind, public.wallet_currency, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.open_trading_account(public.account_kind, public.wallet_currency, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.open_trading_account(public.account_kind, public.wallet_currency, integer, text) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- END 20260615000005_open_trading_account.sql
-- ============================================================================
