-- ============================================================================
-- 20260529170000_ib_multi_tier_tree.sql
-- Module 3 of Expansion Pack A — the IB multi-tier tree.
--
-- The foundation only ever wrote the level-1 (direct) edge in handle_new_user,
-- so the "multi-level" tree was single-level in practice: grandparent IBs got
-- no closure rows, distribute_rebate() never paid past L1, and /ib/tree never
-- showed beyond direct sub-IBs. This module makes the tree genuinely
-- multi-tier by maintaining an ancestor↔descendant closure, backfilling it
-- from existing direct edges, and adding commission settlement into wallets.
--
-- Additions (all ADDITIVE — no existing object altered or dropped):
--   • tg_ib_closure()         AFTER INSERT trigger that materialises the full
--                             ancestor×descendant closure whenever a direct
--                             (level-1) edge is created.
--   • one-time backfill       rebuild closure from existing level-1 edges.
--   • staff_link_ib()         staff-only manual IB enrolment (fires closure).
--   • settle_ib_commissions() pay an IB's unsettled commission into their
--                             ib_commission wallet, idempotent + audited.
--   • ib_downline_summary()   rolled-up volume + commission per downline member
--                             (self-or-staff gated) to power the tree UI.
--
-- Reuses ib_relationships, commission_plans, commission_ledger, wallets,
-- process_wallet_transaction(), events_outbox, is_staff(), wallet_seq.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1 · Closure maintenance trigger
--     When a DIRECT (level-1) edge (P → C) is inserted, every ancestor A of P
--     becomes an ancestor of C, and every descendant D of C becomes a
--     descendant of A — at the summed distance. We cross-join ancestors of P
--     (including P at distance 0) with descendants of C (including C at
--     distance 0) and insert the missing closure rows. Capped at level 8.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_ib_closure()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan uuid;
BEGIN
  -- Only fan out from a freshly-created DIRECT edge. The deeper closure rows
  -- this inserts are level >= 2, so they short-circuit here (no recursion).
  IF NEW.level <> 1 THEN
    RETURN NEW;
  END IF;

  v_plan := (SELECT id FROM public.commission_plans WHERE is_default = true LIMIT 1);

  WITH anc AS (
    -- ancestors of the new parent, including the parent itself at distance 0
    SELECT NEW.parent_id AS aid, 0 AS adist
    UNION
    SELECT r.parent_id, r.level FROM public.ib_relationships r
     WHERE r.child_id = NEW.parent_id
  ),
  des AS (
    -- descendants of the new child, including the child itself at distance 0
    SELECT NEW.child_id AS did, 0 AS ddist
    UNION
    SELECT r.child_id, r.level FROM public.ib_relationships r
     WHERE r.parent_id = NEW.child_id
  )
  INSERT INTO public.ib_relationships (parent_id, child_id, level, commission_plan_id)
  SELECT a.aid, d.did, (a.adist + 1 + d.ddist)::smallint, v_plan
    FROM anc a CROSS JOIN des d
   WHERE a.aid <> d.did
     AND (a.adist + 1 + d.ddist) BETWEEN 2 AND 8   -- (P,C,1) already inserted by the triggering statement
  ON CONFLICT (parent_id, child_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ib_closure_build ON public.ib_relationships;
CREATE TRIGGER ib_closure_build
  AFTER INSERT ON public.ib_relationships
  FOR EACH ROW EXECUTE FUNCTION public.tg_ib_closure();

-- ----------------------------------------------------------------------------
-- 2 · One-time backfill — rebuild the transitive closure from existing
--     direct (level-1) edges. Existing level-1 rows are authoritative; we only
--     add the missing deeper ancestor rows (level >= 2).
-- ----------------------------------------------------------------------------
WITH RECURSIVE direct AS (
  SELECT parent_id, child_id FROM public.ib_relationships WHERE level = 1
),
closure AS (
  SELECT parent_id, child_id, 1 AS level FROM direct
  UNION ALL
  SELECT c.parent_id, d.child_id, c.level + 1
    FROM closure c
    JOIN direct d ON d.parent_id = c.child_id
   WHERE c.level < 8
)
INSERT INTO public.ib_relationships (parent_id, child_id, level, commission_plan_id)
SELECT cl.parent_id, cl.child_id, cl.level::smallint,
       (SELECT id FROM public.commission_plans WHERE is_default = true LIMIT 1)
  FROM closure cl
 WHERE cl.level >= 2
   AND cl.parent_id <> cl.child_id
ON CONFLICT (parent_id, child_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3 · staff_link_ib — manual enrolment for clients who didn't sign up via a
--     referral link. Inserts the direct edge (firing the closure trigger).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_link_ib(
  p_parent_id          uuid,
  p_child_id           uuid,
  p_commission_plan_id uuid DEFAULT NULL
) RETURNS public.ib_relationships
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row  public.ib_relationships;
  v_plan uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff_link_ib: staff access only';
  END IF;
  IF p_parent_id IS NULL OR p_child_id IS NULL THEN
    RAISE EXCEPTION 'staff_link_ib: parent and child are required';
  END IF;
  IF p_parent_id = p_child_id THEN
    RAISE EXCEPTION 'an IB cannot refer themselves';
  END IF;
  -- cycle guard: the proposed parent must not already sit in the child's downline
  IF EXISTS (
    SELECT 1 FROM public.ib_relationships
     WHERE parent_id = p_child_id AND child_id = p_parent_id
  ) THEN
    RAISE EXCEPTION 'cycle detected: % is already within %''s downline', p_parent_id, p_child_id;
  END IF;

  v_plan := COALESCE(p_commission_plan_id,
                     (SELECT id FROM public.commission_plans WHERE is_default = true LIMIT 1));

  INSERT INTO public.ib_relationships (parent_id, child_id, level, commission_plan_id)
  VALUES (p_parent_id, p_child_id, 1, v_plan)
  ON CONFLICT (parent_id, child_id)
    DO UPDATE SET commission_plan_id = COALESCE(EXCLUDED.commission_plan_id, public.ib_relationships.commission_plan_id)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_link_ib(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_link_ib(uuid, uuid, uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4 · settle_ib_commissions — pay an IB's accrued (unsettled) commission for a
--     given currency into their ib_commission wallet (created on demand), then
--     stamp the ledger rows settled. Idempotent via process_wallet_transaction.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_ib_commissions(
  p_ib_user_id      uuid,
  p_currency        public.wallet_currency DEFAULT 'USD',
  p_idempotency_key text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ids    uuid[];
  v_total  numeric := 0;
  v_wallet uuid;
  v_wref   text;
  v_tx     uuid;
  v_idem   text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'settle_ib_commissions: staff access only';
  END IF;

  -- lock + snapshot the unsettled rows so concurrent inserts can't drift the total
  SELECT array_agg(s.id), COALESCE(SUM(s.amount), 0)
    INTO v_ids, v_total
    FROM (
      SELECT id, amount
        FROM public.commission_ledger
       WHERE ib_user_id = p_ib_user_id
         AND currency   = p_currency
         AND settled    = false
       FOR UPDATE
    ) s;

  IF v_total IS NULL OR v_total <= 0 THEN
    RETURN 0;  -- nothing to settle
  END IF;

  -- ensure an ib_commission wallet exists for this IB + currency
  SELECT id INTO v_wallet FROM public.wallets
   WHERE user_id = p_ib_user_id AND currency = p_currency AND type = 'ib_commission'
   LIMIT 1;
  IF v_wallet IS NULL THEN
    v_wref := 'W-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.wallet_seq')::text, 7, '0');
    INSERT INTO public.wallets (wallet_id, user_id, currency, type)
    VALUES (v_wref, p_ib_user_id, p_currency, 'ib_commission')
    ON CONFLICT (user_id, currency, type) DO NOTHING;
    SELECT id INTO v_wallet FROM public.wallets
     WHERE user_id = p_ib_user_id AND currency = p_currency AND type = 'ib_commission'
     LIMIT 1;
  END IF;

  v_idem := COALESCE(
    p_idempotency_key,
    'ibsettle-' || p_ib_user_id::text || '-' || p_currency::text || '-' || to_char(now(), 'YYYYMMDDHH24MISS')
  );

  -- credit the wallet (process_wallet_transaction enforces idempotency + locks)
  v_tx := public.process_wallet_transaction(
    p_wallet_id       => v_wallet,
    p_type            => 'commission',
    p_amount          => v_total,
    p_idempotency_key => v_idem,
    p_status          => 'completed',
    p_metadata        => jsonb_build_object('source', 'ib_settlement', 'ib_user_id', p_ib_user_id)
  );

  -- stamp exactly the rows we snapshotted + paid
  UPDATE public.commission_ledger
     SET settled = true, settlement_tx_id = v_tx
   WHERE id = ANY(v_ids);

  INSERT INTO public.events_outbox (topic, payload, actor_id)
  VALUES (
    'ib.commission_settled',
    jsonb_build_object(
      'user_id', p_ib_user_id,
      'amount',  v_total,
      'currency', p_currency,
      'rows', array_length(v_ids, 1)
    ),
    auth.uid()
  );

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_ib_commissions(uuid, public.wallet_currency, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_ib_commissions(uuid, public.wallet_currency, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5 · ib_downline_summary — rolled-up volume + commission per downline member.
--     SECURITY DEFINER so a parent IB can see downline names that RLS on
--     profiles would otherwise hide; gated so callers only see their OWN
--     downline (or staff sees any).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ib_downline_summary(p_ib_user_id uuid)
RETURNS TABLE (
  member_id     uuid,
  level         integer,
  full_name     text,
  member_status text,
  lots          numeric,
  commission    numeric,
  last_activity timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.child_id,
         r.level::integer,
         p.full_name,
         p.status::text,
         COALESCE(SUM(cl.lots), 0),
         COALESCE(SUM(cl.amount), 0),
         MAX(cl.created_at)
    FROM public.ib_relationships r
    JOIN public.profiles p ON p.id = r.child_id
    LEFT JOIN public.commission_ledger cl
           ON cl.source_user_id = r.child_id
          AND cl.ib_user_id     = p_ib_user_id
   WHERE r.parent_id = p_ib_user_id
     AND (p_ib_user_id = auth.uid() OR public.is_staff())
   GROUP BY r.child_id, r.level, p.full_name, p.status
   ORDER BY r.level ASC, p.full_name ASC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.ib_downline_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ib_downline_summary(uuid) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- END 20260529170000_ib_multi_tier_tree.sql
-- ============================================================================
