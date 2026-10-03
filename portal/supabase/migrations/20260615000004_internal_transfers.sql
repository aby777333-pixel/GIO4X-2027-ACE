-- ============================================================================
-- 20260615000004_internal_transfers.sql
-- Internal transfers — move funds between a user's main wallet and their
-- trading accounts (and account <-> account). Backs the existing /transfers UI,
-- which until now was mock data + a dead "Transfer Now" button.
--
--   1. account_transfers — append-only history/audit of each internal move.
--   2. transfer_funds()  — SECURITY DEFINER, atomic, idempotent, ownership-
--      checked. Debits the source, credits the destination, records the row.
--      Wallet legs go through the existing process_wallet_transaction()
--      (transfer_out / transfer_in, which locks + balance-checks + writes a
--      wallet_transactions row); trading-account legs adjust
--      trading_accounts.balance/equity under a row lock. Cross-currency is only
--      allowed for the documented USD <-> USC cent rate (1:100); anything else
--      is rejected.
--
-- Money rules honoured (CLAUDE.md §3): NUMERIC only, server-side, idempotent
-- (idempotency_key), audited (account_transfers + wallet_transactions + the
-- trading_accounts audit trigger). No client writes a balance directly.
--
-- ADDITIVE ONLY. New table + new function; reuses process_wallet_transaction,
-- is_staff, tg_updated_at, log_audit, wallet_currency. Nothing altered/dropped.
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.transfer_funds(text, uuid, text, uuid, numeric, text);
--   DROP TABLE IF EXISTS public.account_transfers;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · account_transfers — history of internal wallet/account moves
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_transfers (
  id              uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_kind       text NOT NULL CHECK (from_kind IN ('wallet','account')),
  from_id         uuid NOT NULL,
  from_currency   public.wallet_currency NOT NULL,
  from_amount     numeric(20,8) NOT NULL CHECK (from_amount > 0),
  to_kind         text NOT NULL CHECK (to_kind IN ('wallet','account')),
  to_id           uuid NOT NULL,
  to_currency     public.wallet_currency NOT NULL,
  to_amount       numeric(20,8) NOT NULL CHECK (to_amount > 0),
  status          text NOT NULL DEFAULT 'completed',
  idempotency_key text NOT NULL UNIQUE,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_transfers_user_idx ON public.account_transfers (user_id, created_at DESC);

DROP TRIGGER IF EXISTS account_transfers_updated_at ON public.account_transfers;
CREATE TRIGGER account_transfers_updated_at BEFORE UPDATE ON public.account_transfers
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_transfers_self_select ON public.account_transfers;
CREATE POLICY account_transfers_self_select ON public.account_transfers FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS account_transfers_staff_all ON public.account_transfers;
CREATE POLICY account_transfers_staff_all ON public.account_transfers FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

GRANT SELECT ON public.account_transfers TO authenticated;
GRANT ALL    ON public.account_transfers TO service_role;

-- ---------------------------------------------------------------------------
-- 2 · transfer_funds — atomic, idempotent internal transfer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_from_kind       text,
  p_from_id         uuid,
  p_to_kind         text,
  p_to_id           uuid,
  p_amount          numeric,
  p_idempotency_key text
) RETURNS public.account_transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_staff     boolean := public.is_staff();
  v_existing  public.account_transfers;
  v_src_user  uuid;  v_src_ccy public.wallet_currency;  v_src_bal numeric(20,8);  v_src_status text;
  v_dst_user  uuid;  v_dst_ccy public.wallet_currency;  v_dst_status text;
  v_to_amount numeric(20,8);
  v_row       public.account_transfers;
BEGIN
  -- validate inputs
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'transfer_funds: amount must be > 0';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'transfer_funds: idempotency_key required (min 8 chars)';
  END IF;
  IF p_from_kind NOT IN ('wallet','account') OR p_to_kind NOT IN ('wallet','account') THEN
    RAISE EXCEPTION 'transfer_funds: kind must be wallet or account';
  END IF;
  IF p_from_kind = p_to_kind AND p_from_id = p_to_id THEN
    RAISE EXCEPTION 'transfer_funds: source and destination are the same';
  END IF;

  -- idempotency: already done?
  SELECT * INTO v_existing FROM public.account_transfers WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF FOUND THEN RETURN v_existing; END IF;

  -- resolve + lock source
  IF p_from_kind = 'wallet' THEN
    SELECT user_id, currency, balance, status::text INTO v_src_user, v_src_ccy, v_src_bal, v_src_status
      FROM public.wallets WHERE id = p_from_id FOR UPDATE;
  ELSE
    SELECT user_id, base_currency, balance, status::text INTO v_src_user, v_src_ccy, v_src_bal, v_src_status
      FROM public.trading_accounts WHERE id = p_from_id FOR UPDATE;
  END IF;
  IF v_src_user IS NULL THEN
    RAISE EXCEPTION 'transfer_funds: source % not found', p_from_id;
  END IF;
  IF v_src_status <> 'active' THEN
    RAISE EXCEPTION 'transfer_funds: source is % (must be active)', v_src_status;
  END IF;

  -- resolve + lock destination
  IF p_to_kind = 'wallet' THEN
    SELECT user_id, currency, status::text INTO v_dst_user, v_dst_ccy, v_dst_status
      FROM public.wallets WHERE id = p_to_id FOR UPDATE;
  ELSE
    SELECT user_id, base_currency, status::text INTO v_dst_user, v_dst_ccy, v_dst_status
      FROM public.trading_accounts WHERE id = p_to_id FOR UPDATE;
  END IF;
  IF v_dst_user IS NULL THEN
    RAISE EXCEPTION 'transfer_funds: destination % not found', p_to_id;
  END IF;
  IF v_dst_status <> 'active' THEN
    RAISE EXCEPTION 'transfer_funds: destination is % (must be active)', v_dst_status;
  END IF;

  -- ownership: caller must own both endpoints (or be staff); endpoints same user
  IF NOT v_staff THEN
    IF v_caller IS NULL OR v_src_user <> v_caller OR v_dst_user <> v_caller THEN
      RAISE EXCEPTION 'transfer_funds: not authorized for these endpoints';
    END IF;
  END IF;
  IF v_src_user <> v_dst_user THEN
    RAISE EXCEPTION 'transfer_funds: cannot transfer between different users';
  END IF;

  -- FX: same currency, or the documented USD<->USC cent rate (1:100)
  IF v_src_ccy = v_dst_ccy THEN
    v_to_amount := round(p_amount, 8);
  ELSIF v_src_ccy = 'USD' AND v_dst_ccy = 'USC' THEN
    v_to_amount := round(p_amount * 100, 8);
  ELSIF v_src_ccy = 'USC' AND v_dst_ccy = 'USD' THEN
    v_to_amount := round(p_amount / 100, 8);
  ELSE
    RAISE EXCEPTION 'transfer_funds: unsupported currency pair % -> %', v_src_ccy, v_dst_ccy;
  END IF;

  -- sufficient funds (wallet legs re-check inside process_wallet_transaction)
  IF v_src_bal < p_amount THEN
    RAISE EXCEPTION 'transfer_funds: insufficient balance (have %, need %)', v_src_bal, p_amount;
  END IF;

  -- debit source
  IF p_from_kind = 'wallet' THEN
    PERFORM public.process_wallet_transaction(
      p_wallet_id => p_from_id, p_type => 'transfer_out', p_amount => p_amount,
      p_idempotency_key => 'xferout-' || p_idempotency_key, p_status => 'completed',
      p_related_user_id => v_src_user,
      p_metadata => jsonb_build_object('transfer', p_idempotency_key, 'to_kind', p_to_kind, 'to_id', p_to_id));
  ELSE
    UPDATE public.trading_accounts
       SET balance = balance - p_amount, equity = equity - p_amount, updated_at = now()
     WHERE id = p_from_id;
  END IF;

  -- credit destination
  IF p_to_kind = 'wallet' THEN
    PERFORM public.process_wallet_transaction(
      p_wallet_id => p_to_id, p_type => 'transfer_in', p_amount => v_to_amount,
      p_idempotency_key => 'xferin-' || p_idempotency_key, p_status => 'completed',
      p_related_user_id => v_dst_user,
      p_metadata => jsonb_build_object('transfer', p_idempotency_key, 'from_kind', p_from_kind, 'from_id', p_from_id));
  ELSE
    UPDATE public.trading_accounts
       SET balance = balance + v_to_amount, equity = equity + v_to_amount, updated_at = now()
     WHERE id = p_to_id;
  END IF;

  INSERT INTO public.account_transfers
    (user_id, from_kind, from_id, from_currency, from_amount,
     to_kind, to_id, to_currency, to_amount, status, idempotency_key, metadata)
  VALUES
    (v_src_user, p_from_kind, p_from_id, v_src_ccy, round(p_amount,8),
     p_to_kind, p_to_id, v_dst_ccy, v_to_amount, 'completed', p_idempotency_key,
     jsonb_build_object('by', v_caller))
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_funds(text, uuid, text, uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transfer_funds(text, uuid, text, uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.transfer_funds(text, uuid, text, uuid, numeric, text) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- END 20260615000004_internal_transfers.sql
-- ============================================================================
