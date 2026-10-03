-- ============================================================================
-- 20260615000006_claim_my_ib_commission.sql
-- Self-service IB rebate claim. settle_ib_commissions() is staff-only (it can
-- settle ANY ib_user_id, so it must be). This adds a safe client-callable
-- counterpart that settles ONLY the caller's own accrued commission into their
-- own ib_commission wallet — a benign move of already-earned, system-computed
-- amounts, so an IB can claim without waiting for a staff run.
--
--   claim_my_ib_commission(p_currency) RETURNS numeric — total just claimed.
--
-- Mirrors settle_ib_commissions' body but pinned to auth.uid() with no staff
-- gate. ADDITIVE: new function; reuses wallet_seq, process_wallet_transaction,
-- commission_ledger, events_outbox. settle_ib_commissions is left untouched.
-- ROLLBACK: DROP FUNCTION public.claim_my_ib_commission(public.wallet_currency);
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_my_ib_commission(
  p_currency public.wallet_currency DEFAULT 'USD'
) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_ids    uuid[];
  v_total  numeric := 0;
  v_wallet uuid;
  v_wref   text;
  v_tx     uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'claim_my_ib_commission: sign in required';
  END IF;

  SELECT array_agg(s.id), COALESCE(SUM(s.amount), 0)
    INTO v_ids, v_total
    FROM (
      SELECT id, amount
        FROM public.commission_ledger
       WHERE ib_user_id = v_uid
         AND currency   = p_currency
         AND settled    = false
       FOR UPDATE
    ) s;

  IF v_total IS NULL OR v_total <= 0 THEN
    RETURN 0;
  END IF;

  SELECT id INTO v_wallet FROM public.wallets
   WHERE user_id = v_uid AND currency = p_currency AND type = 'ib_commission'
   LIMIT 1;
  IF v_wallet IS NULL THEN
    v_wref := 'W-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.wallet_seq')::text, 7, '0');
    INSERT INTO public.wallets (wallet_id, user_id, currency, type)
    VALUES (v_wref, v_uid, p_currency, 'ib_commission')
    ON CONFLICT (user_id, currency, type) DO NOTHING;
    SELECT id INTO v_wallet FROM public.wallets
     WHERE user_id = v_uid AND currency = p_currency AND type = 'ib_commission'
     LIMIT 1;
  END IF;

  v_tx := public.process_wallet_transaction(
    p_wallet_id       => v_wallet,
    p_type            => 'commission',
    p_amount          => v_total,
    p_idempotency_key => 'ibclaim-' || v_uid::text || '-' || p_currency::text || '-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    p_status          => 'completed',
    p_metadata        => jsonb_build_object('source', 'ib_self_claim', 'ib_user_id', v_uid)
  );

  UPDATE public.commission_ledger
     SET settled = true, settlement_tx_id = v_tx
   WHERE id = ANY(v_ids);

  INSERT INTO public.events_outbox (topic, payload, actor_id)
  VALUES ('ib.commission_settled',
          jsonb_build_object('user_id', v_uid, 'amount', v_total, 'currency', p_currency,
                             'rows', array_length(v_ids, 1), 'self', true),
          v_uid);

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_my_ib_commission(public.wallet_currency) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_my_ib_commission(public.wallet_currency) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_my_ib_commission(public.wallet_currency) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- END 20260615000006_claim_my_ib_commission.sql
-- ============================================================================
