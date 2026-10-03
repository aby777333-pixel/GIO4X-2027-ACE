-- ============================================================================
-- 20260615000002_fix_charge_fee_status_enum_cast.sql
-- BUGFIX (money path) — charge_fee() could never insert a row.
--
-- The INSERT into public.fee_charges set the `status` column (type
-- public.fee_charge_status) from a CASE expression whose branches are string
-- literals. Postgres resolves a CASE over string literals to `text`, and there
-- is no implicit text -> enum cast, so every call raised:
--   column "status" is of type fee_charge_status but expression is of type text
--
-- This had never surfaced in production because no fee had ever actually been
-- charged: public.trades was empty and no deposit/withdrawal had settled, so
-- the only callers (tg_trade_settled, tg_autocharge_settlement_fee, the copy /
-- PAMM engines) never reached a successful charge. With the trade lifecycle now
-- live (open_trade/close_trade), closing a trade exercised this path and the
-- failure landed safely in events_outbox as 'fee.trade_commission_failed'.
--
-- FIX: cast the CASE result explicitly to public.fee_charge_status. This is the
-- ONLY change from the shipped definition — every other line is identical to
-- the version in 20260529000004_ledger_and_fee_engine.sql.
--
-- ADDITIVE: CREATE OR REPLACE of an existing function; no signature change, no
-- schema change. ROLLBACK: re-apply charge_fee() from 20260529000004.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.charge_fee(
  p_fee_type        public.fee_type,
  p_idempotency_key text,
  p_user_id         uuid DEFAULT NULL,
  p_wallet_id       uuid DEFAULT NULL,
  p_trading_account_id uuid DEFAULT NULL,
  p_base_amount     numeric DEFAULT 0,
  p_lots            numeric DEFAULT 0,
  p_scope           jsonb DEFAULT '{}'::jsonb,
  p_override_amount numeric DEFAULT NULL,
  p_move_wallet     boolean DEFAULT true,
  p_source_type     text DEFAULT 'fee',
  p_source_id       text DEFAULT NULL,
  p_created_by      uuid DEFAULT NULL,
  p_notes           text DEFAULT NULL
) RETURNS public.fee_charges
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_existing   public.fee_charges;
  v_calc       jsonb;
  v_amount     numeric(20,8);
  v_currency   public.wallet_currency := 'USD';
  v_sched_id   uuid;
  v_rule_id    uuid;
  v_method     public.fee_calc_method;
  v_charge     public.fee_charges;
  v_entry_id   uuid;
  v_tx_id      uuid;
  v_wallet     public.wallets%ROWTYPE;
  v_lines      jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'charge_fee: idempotency_key required (min 8 chars)';
  END IF;

  SELECT * INTO v_existing FROM public.fee_charges WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF FOUND THEN RETURN v_existing; END IF;

  IF p_override_amount IS NOT NULL THEN
    v_amount := round(p_override_amount, 8);
  ELSE
    v_calc := public.compute_fee(p_fee_type, p_base_amount, p_lots, p_scope);
    IF NOT (v_calc->>'matched')::boolean THEN
      v_amount := 0;
    ELSE
      v_amount   := (v_calc->>'amount')::numeric;
      v_sched_id := (v_calc->>'schedule_id')::uuid;
      v_rule_id  := (v_calc->>'rule_id')::uuid;
      v_method   := (v_calc->>'calc_method')::public.fee_calc_method;
      v_currency := (v_calc->>'currency')::public.wallet_currency;
    END IF;
  END IF;

  IF p_wallet_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id;
    IF FOUND THEN v_currency := v_wallet.currency; END IF;
  END IF;

  INSERT INTO public.fee_charges
    (fee_type, schedule_id, rule_id, user_id, wallet_id, trading_account_id,
     base_amount, lots, computed_amount, currency, status, calc_method,
     source_type, source_id, idempotency_key, created_by, notes)
  VALUES
    (p_fee_type, v_sched_id, v_rule_id, p_user_id, p_wallet_id, p_trading_account_id,
     COALESCE(p_base_amount,0), p_lots, v_amount, v_currency,
     (CASE WHEN v_amount = 0 THEN 'waived' ELSE 'applied' END)::public.fee_charge_status,
     v_method, COALESCE(p_source_type,'fee'), p_source_id, p_idempotency_key,
     p_created_by, p_notes)
  RETURNING * INTO v_charge;

  IF v_amount = 0 THEN RETURN v_charge; END IF;

  IF v_amount > 0 THEN
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code','CLIENT_FUNDS','direction','debit',
                         'amount', v_amount, 'currency', v_currency,
                         'memo', p_fee_type::text || ' fee'),
      jsonb_build_object('account_code','FEE_REVENUE','direction','credit',
                         'amount', v_amount, 'currency', v_currency,
                         'memo', p_fee_type::text || ' fee')
    );
  ELSE
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code','REBATE_EXPENSE','direction','debit',
                         'amount', abs(v_amount), 'currency', v_currency,
                         'memo', p_fee_type::text || ' rebate'),
      jsonb_build_object('account_code','CLIENT_FUNDS','direction','credit',
                         'amount', abs(v_amount), 'currency', v_currency,
                         'memo', p_fee_type::text || ' rebate')
    );
  END IF;

  v_entry_id := public.post_journal_entry(
    p_idempotency_key => 'fee-' || p_idempotency_key,
    p_lines           => v_lines,
    p_source_type     => 'fee',
    p_source_id       => v_charge.id::text,
    p_description     => p_fee_type::text || ' fee charge',
    p_created_by      => p_created_by
  );

  IF p_move_wallet AND p_wallet_id IS NOT NULL THEN
    IF v_amount > 0 THEN
      v_tx_id := public.process_wallet_transaction(
        p_wallet_id => p_wallet_id, p_type => 'fee', p_amount => v_amount,
        p_idempotency_key => 'feewx-' || p_idempotency_key, p_status => 'completed',
        p_related_user_id => p_user_id,
        p_metadata => jsonb_build_object('fee_charge_id', v_charge.id, 'fee_type', p_fee_type));
    ELSE
      v_tx_id := public.process_wallet_transaction(
        p_wallet_id => p_wallet_id, p_type => 'rebate', p_amount => abs(v_amount),
        p_idempotency_key => 'feewx-' || p_idempotency_key, p_status => 'completed',
        p_related_user_id => p_user_id,
        p_metadata => jsonb_build_object('fee_charge_id', v_charge.id, 'fee_type', p_fee_type));
    END IF;
  END IF;

  UPDATE public.fee_charges
     SET journal_entry_id = v_entry_id, wallet_tx_id = v_tx_id
   WHERE id = v_charge.id
   RETURNING * INTO v_charge;

  INSERT INTO public.events_outbox (topic, payload, actor_id)
  VALUES ('fee.charged',
          jsonb_build_object('fee_charge_id', v_charge.id, 'fee_type', p_fee_type,
                             'amount', v_amount, 'currency', v_currency,
                             'user_id', p_user_id),
          p_created_by);

  RETURN v_charge;
END;
$function$;

COMMIT;

-- ============================================================================
-- END 20260615000002_fix_charge_fee_status_enum_cast.sql
-- ============================================================================
