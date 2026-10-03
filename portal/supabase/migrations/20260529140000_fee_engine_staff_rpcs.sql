-- ===========================================================================
-- Fee Engine — staff-callable RPC wrappers
-- ===========================================================================
-- The core money mutators created in 20260529000004 (post_journal_entry,
-- charge_fee, distribute_rebate) are granted to service_role ONLY, by design:
-- they must never be reachable directly from a browser/anon/authenticated JWT.
--
-- The portal staff console, however, runs as the signed-in staff user (the
-- cookie-bound `authenticated` client), NOT service_role. To let staff drive
-- these flows from /staff/fees and /staff/ledger WITHOUT shipping a
-- service-role key into the portal runtime, we add thin SECURITY DEFINER
-- wrappers that:
--   1. hard-gate on public.is_staff()  (regular clients are rejected),
--   2. stamp created_by = auth.uid()    (audit truth, not client-supplied),
--   3. delegate to the inner mutator.
--
-- Because these wrappers are SECURITY DEFINER (owned by the migration role,
-- which holds EXECUTE on the inner functions), they can invoke the
-- service_role-only mutators even though the *caller* cannot. auth.uid() and
-- is_staff() keep working inside a definer context (they read the request JWT
-- GUC, not the effective DB role). 100% additive — nothing existing changes.
-- ===========================================================================

-- 1 · staff_post_journal_entry — manual double-entry posting from /staff/ledger
CREATE OR REPLACE FUNCTION public.staff_post_journal_entry(
  p_idempotency_key text,
  p_lines           jsonb,
  p_description     text DEFAULT '',
  p_reference       text DEFAULT NULL,
  p_metadata        jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff_post_journal_entry: staff role required';
  END IF;

  v_entry_id := public.post_journal_entry(
    p_idempotency_key => p_idempotency_key,
    p_lines           => p_lines,
    p_source_type     => 'manual',
    p_source_id       => NULL,
    p_description     => COALESCE(p_description, ''),
    p_reference       => p_reference,
    p_created_by      => auth.uid(),
    p_metadata        => COALESCE(p_metadata, '{}'::jsonb)
  );
  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_post_journal_entry(text, jsonb, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_post_journal_entry(text, jsonb, text, text, jsonb) TO authenticated, service_role;

-- 2 · staff_charge_fee — manually apply / waive a fee or rebate from /staff/fees
CREATE OR REPLACE FUNCTION public.staff_charge_fee(
  p_fee_type           public.fee_type,
  p_idempotency_key    text,
  p_user_id            uuid DEFAULT NULL,
  p_wallet_id          uuid DEFAULT NULL,
  p_trading_account_id uuid DEFAULT NULL,
  p_base_amount        numeric DEFAULT 0,
  p_lots               numeric DEFAULT 0,
  p_scope              jsonb DEFAULT '{}'::jsonb,
  p_override_amount    numeric DEFAULT NULL,
  p_move_wallet        boolean DEFAULT true,
  p_notes              text DEFAULT NULL
) RETURNS public.fee_charges
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_charge public.fee_charges;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff_charge_fee: staff role required';
  END IF;

  v_charge := public.charge_fee(
    p_fee_type           => p_fee_type,
    p_idempotency_key    => p_idempotency_key,
    p_user_id            => p_user_id,
    p_wallet_id          => p_wallet_id,
    p_trading_account_id => p_trading_account_id,
    p_base_amount        => COALESCE(p_base_amount, 0),
    p_lots               => COALESCE(p_lots, 0),
    p_scope              => COALESCE(p_scope, '{}'::jsonb),
    p_override_amount    => p_override_amount,
    p_move_wallet        => COALESCE(p_move_wallet, true),
    p_source_type        => 'staff_manual',
    p_source_id          => NULL,
    p_created_by         => auth.uid(),
    p_notes              => p_notes
  );
  RETURN v_charge;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_charge_fee(public.fee_type, text, uuid, uuid, uuid, numeric, numeric, jsonb, numeric, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_charge_fee(public.fee_type, text, uuid, uuid, uuid, numeric, numeric, jsonb, numeric, boolean, text) TO authenticated, service_role;

-- 3 · staff_distribute_rebate — manually run a per-lot rebate up the IB tree
CREATE OR REPLACE FUNCTION public.staff_distribute_rebate(
  p_source_user_id     uuid,
  p_trading_account_id uuid,
  p_lots               numeric,
  p_idempotency_prefix text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff_distribute_rebate: staff role required';
  END IF;

  v_count := public.distribute_rebate(
    p_source_user_id     => p_source_user_id,
    p_trading_account_id => p_trading_account_id,
    p_lots               => p_lots,
    p_idempotency_prefix => p_idempotency_prefix,
    p_created_by         => auth.uid()
  );
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_distribute_rebate(uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_distribute_rebate(uuid, uuid, numeric, text) TO authenticated, service_role;
