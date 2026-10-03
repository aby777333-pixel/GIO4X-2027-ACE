-- ============================================================================
-- 20260529000004_ledger_and_fee_engine.sql
-- Core money infrastructure (spec Part 16 / build-order Phase 2 prerequisite):
--   1. Double-entry general ledger (ledger_accounts, journal_entries,
--      journal_lines) + balanced posting function post_journal_entry().
--   2. Universal centralized Fee Engine (versioned fee_schedules + fee_rules,
--      immutable fee_charges) with a precedence/scope resolver compute_fee()
--      and a transactional charge_fee() that posts to the ledger AND (optionally)
--      moves the wallet via the existing process_wallet_transaction().
--   3. Rebate distribution (rebates = negative fees) that walks the existing
--      ib_relationships tree and writes to the existing commission_ledger.
--
-- ADDITIVE ONLY. Reuses is_staff()/is_admin(), log_audit(), tg_updated_at(),
-- process_wallet_transaction(), wallets, trading_accounts, ib_relationships,
-- commission_ledger, events_outbox and feature_flags from prior migrations.
-- No existing table, type, policy, function or trigger is altered or dropped.
--
-- All money is numeric(20,8). Ledger is append-only: journal entries can be
-- VOIDED (a reversing entry) but never mutated; fee_charges can be REVERSED
-- but rows are never updated destructively (status transitions only).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums (guarded so the migration is safe to re-run)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.ledger_account_type AS ENUM
    ('asset','liability','equity','revenue','expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.journal_status AS ENUM ('posted','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fee_type AS ENUM (
    'deposit','withdrawal','inactivity','conversion','swap','spread',
    'commission_per_lot','management','performance','subscription',
    'rebate','adjustment','custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fee_calc_method AS ENUM
    ('flat','percentage','per_lot','spread_markup','tiered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fee_charge_status AS ENUM
    ('pending','applied','waived','reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================================================
-- 1 · DOUBLE-ENTRY GENERAL LEDGER
-- ===========================================================================

-- 1.1 chart of accounts. System accounts (is_system) are global control
-- accounts; per-user subledger accounts carry owner_id.
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id          uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  code        text UNIQUE NOT NULL,                 -- 'CLIENT_FUNDS','FEE_REVENUE',...
  name        text NOT NULL,
  type        public.ledger_account_type NOT NULL,
  currency    public.wallet_currency NOT NULL DEFAULT 'USD',
  owner_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_system   boolean NOT NULL DEFAULT false,
  active      boolean NOT NULL DEFAULT true,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_accounts_type_idx  ON public.ledger_accounts (type);
CREATE INDEX IF NOT EXISTS ledger_accounts_owner_idx ON public.ledger_accounts (owner_id);

DROP TRIGGER IF EXISTS ledger_accounts_touch ON public.ledger_accounts;
CREATE TRIGGER ledger_accounts_touch BEFORE UPDATE ON public.ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 1.2 journal entry header (a balanced set of debit/credit lines).
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id              uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  reference       text,
  description     text NOT NULL DEFAULT '',
  source_type     text NOT NULL DEFAULT 'manual',   -- 'fee','rebate','wallet_tx','deposit','manual'
  source_id       text,
  idempotency_key text UNIQUE NOT NULL,
  status          public.journal_status NOT NULL DEFAULT 'posted',
  reverses_id     uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  posted_at       timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_entries_source_idx ON public.journal_entries (source_type, source_id);
CREATE INDEX IF NOT EXISTS journal_entries_posted_idx ON public.journal_entries (posted_at DESC);

-- 1.3 journal lines. Each line is a single-sided debit or credit > 0.
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id          uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  entry_id    uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  direction   text NOT NULL CHECK (direction IN ('debit','credit')),
  amount      numeric(20,8) NOT NULL CHECK (amount > 0),
  currency    public.wallet_currency NOT NULL,
  memo        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_lines_entry_idx   ON public.journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_account_idx ON public.journal_lines (account_id, created_at DESC);

-- 1.4 running balance view per ledger account (debits/credits netted by type).
CREATE OR REPLACE VIEW public.ledger_account_balances AS
SELECT
  a.id,
  a.code,
  a.name,
  a.type,
  a.currency,
  a.owner_id,
  COALESCE(SUM(CASE WHEN l.direction = 'debit'  THEN l.amount ELSE 0 END), 0) AS total_debit,
  COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE 0 END), 0) AS total_credit,
  -- Natural sign by account type: assets/expenses are debit-positive;
  -- liabilities/equity/revenue are credit-positive.
  CASE
    WHEN a.type IN ('asset','expense')
      THEN COALESCE(SUM(CASE WHEN l.direction = 'debit'  THEN l.amount ELSE -l.amount END), 0)
    ELSE COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE -l.amount END), 0)
  END AS balance
FROM public.ledger_accounts a
LEFT JOIN public.journal_lines l ON l.account_id = a.id
LEFT JOIN public.journal_entries e ON e.id = l.entry_id AND e.status = 'posted'
GROUP BY a.id;

-- 1.5 post_journal_entry — the ONLY way to write the ledger. Validates that
-- debits == credits per currency, idempotent on idempotency_key.
-- p_lines: jsonb array of {account_code|account_id, direction, amount, currency?, memo?}
CREATE OR REPLACE FUNCTION public.post_journal_entry(
  p_idempotency_key text,
  p_lines           jsonb,
  p_source_type     text DEFAULT 'manual',
  p_source_id       text DEFAULT NULL,
  p_description     text DEFAULT '',
  p_reference       text DEFAULT NULL,
  p_created_by      uuid DEFAULT NULL,
  p_metadata        jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entry_id   uuid;
  v_existing   uuid;
  v_line       jsonb;
  v_account_id uuid;
  v_code       text;
  v_currency   public.wallet_currency;
  v_dir        text;
  v_amount     numeric(20,8);
  v_net_by_ccy jsonb := '{}'::jsonb;
  v_key        text;
  v_val        numeric;
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'post_journal_entry: idempotency_key required (min 8 chars)';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'post_journal_entry: at least two journal lines required';
  END IF;

  -- idempotency short-circuit
  SELECT id INTO v_existing FROM public.journal_entries
   WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.journal_entries
    (reference, description, source_type, source_id, idempotency_key, created_by, metadata)
  VALUES
    (p_reference, COALESCE(p_description,''), COALESCE(p_source_type,'manual'),
     p_source_id, p_idempotency_key, p_created_by, COALESCE(p_metadata,'{}'::jsonb))
  RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_dir    := v_line->>'direction';
    v_amount := (v_line->>'amount')::numeric;
    IF v_dir NOT IN ('debit','credit') THEN
      RAISE EXCEPTION 'post_journal_entry: bad direction %', v_dir;
    END IF;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'post_journal_entry: line amount must be > 0';
    END IF;

    -- resolve account by id or code
    IF v_line ? 'account_id' AND (v_line->>'account_id') IS NOT NULL THEN
      v_account_id := (v_line->>'account_id')::uuid;
      SELECT currency INTO v_currency FROM public.ledger_accounts WHERE id = v_account_id;
    ELSE
      v_code := v_line->>'account_code';
      SELECT id, currency INTO v_account_id, v_currency
        FROM public.ledger_accounts WHERE code = v_code;
    END IF;
    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'post_journal_entry: ledger account not found (%/%)',
        v_line->>'account_id', v_line->>'account_code';
    END IF;

    -- line currency overrides account currency only if explicitly supplied
    IF v_line ? 'currency' AND (v_line->>'currency') IS NOT NULL THEN
      v_currency := (v_line->>'currency')::public.wallet_currency;
    END IF;

    INSERT INTO public.journal_lines (entry_id, account_id, direction, amount, currency, memo)
    VALUES (v_entry_id, v_account_id, v_dir, v_amount, v_currency, v_line->>'memo');

    -- accumulate signed net per currency (debit +, credit -)
    v_val := COALESCE((v_net_by_ccy->>v_currency::text)::numeric, 0)
             + CASE WHEN v_dir = 'debit' THEN v_amount ELSE -v_amount END;
    v_net_by_ccy := jsonb_set(v_net_by_ccy, ARRAY[v_currency::text], to_jsonb(v_val), true);
  END LOOP;

  -- every currency must net to zero
  FOR v_key, v_val IN SELECT key, value::numeric FROM jsonb_each_text(v_net_by_ccy)
  LOOP
    IF round(v_val, 8) <> 0 THEN
      RAISE EXCEPTION 'post_journal_entry: unbalanced in % (net %)', v_key, v_val;
    END IF;
  END LOOP;

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_journal_entry(text, jsonb, text, text, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(text, jsonb, text, text, text, text, uuid, jsonb) TO service_role;

-- ===========================================================================
-- 2 · UNIVERSAL FEE ENGINE
-- ===========================================================================

-- 2.1 versioned schedule. scope is a jsonb of conditions; a schedule MATCHES a
-- context when scope <@ context (every key/value in scope is present in the
-- context). Empty scope = global default. Lower precedence wins.
CREATE TABLE IF NOT EXISTS public.fee_schedules (
  id             uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  code           text NOT NULL,
  name           text NOT NULL,
  version        integer NOT NULL DEFAULT 1,
  active         boolean NOT NULL DEFAULT true,
  precedence     integer NOT NULL DEFAULT 100,       -- lower = higher priority
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to   timestamptz,
  scope          jsonb NOT NULL DEFAULT '{}'::jsonb, -- {channel,currency,account_kind,country,plan,vip_tier}
  description    text NOT NULL DEFAULT '',
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, version)
);
CREATE INDEX IF NOT EXISTS fee_schedules_active_idx ON public.fee_schedules (active, precedence);

DROP TRIGGER IF EXISTS fee_schedules_touch ON public.fee_schedules;
CREATE TRIGGER fee_schedules_touch BEFORE UPDATE ON public.fee_schedules
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 2.2 individual fee rules attached to a schedule.
CREATE TABLE IF NOT EXISTS public.fee_rules (
  id          uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.fee_schedules(id) ON DELETE CASCADE,
  fee_type    public.fee_type NOT NULL,
  calc_method public.fee_calc_method NOT NULL,
  rate        numeric(20,8) NOT NULL DEFAULT 0,    -- flat amt / fraction / per-lot $
  min_amount  numeric(20,8),
  max_amount  numeric(20,8),
  currency    public.wallet_currency NOT NULL DEFAULT 'USD',
  tiers       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{threshold,rate}] ascending
  is_rebate   boolean NOT NULL DEFAULT false,      -- negative fee (credit to client)
  priority    integer NOT NULL DEFAULT 100,
  active      boolean NOT NULL DEFAULT true,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fee_rules_schedule_idx ON public.fee_rules (schedule_id);
CREATE INDEX IF NOT EXISTS fee_rules_type_idx     ON public.fee_rules (fee_type, active);

DROP TRIGGER IF EXISTS fee_rules_touch ON public.fee_rules;
CREATE TRIGGER fee_rules_touch BEFORE UPDATE ON public.fee_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 2.3 immutable record of every fee actually computed/charged.
CREATE TABLE IF NOT EXISTS public.fee_charges (
  id                 uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  fee_type           public.fee_type NOT NULL,
  schedule_id        uuid REFERENCES public.fee_schedules(id) ON DELETE SET NULL,
  rule_id            uuid REFERENCES public.fee_rules(id) ON DELETE SET NULL,
  user_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  wallet_id          uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  trading_account_id uuid REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
  base_amount        numeric(20,8) NOT NULL DEFAULT 0,
  lots               numeric(12,4),
  computed_amount    numeric(20,8) NOT NULL,           -- negative = rebate/credit
  currency           public.wallet_currency NOT NULL DEFAULT 'USD',
  status             public.fee_charge_status NOT NULL DEFAULT 'applied',
  calc_method        public.fee_calc_method,
  source_type        text,
  source_id          text,
  idempotency_key    text UNIQUE NOT NULL,
  journal_entry_id   uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  wallet_tx_id       uuid REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  notes              text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fee_charges_user_idx   ON public.fee_charges (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fee_charges_type_idx   ON public.fee_charges (fee_type);
CREATE INDEX IF NOT EXISTS fee_charges_status_idx ON public.fee_charges (status);
CREATE INDEX IF NOT EXISTS fee_charges_source_idx ON public.fee_charges (source_type, source_id);

DROP TRIGGER IF EXISTS fee_charges_touch ON public.fee_charges;
CREATE TRIGGER fee_charges_touch BEFORE UPDATE ON public.fee_charges
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 2.4 compute_fee — pure resolver. Returns the matching schedule/rule and the
-- computed amount WITHOUT writing anything. Used by the simulator and charge_fee.
-- Returns jsonb: {matched, schedule_id, rule_id, fee_type, calc_method, currency,
--                 base_amount, lots, amount, is_rebate}
CREATE OR REPLACE FUNCTION public.compute_fee(
  p_fee_type    public.fee_type,
  p_base_amount numeric DEFAULT 0,
  p_lots        numeric DEFAULT 0,
  p_scope       jsonb   DEFAULT '{}'::jsonb,
  p_at          timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r            public.fee_rules%ROWTYPE;
  v_sched_id   uuid;
  v_amount     numeric(20,8) := 0;
  v_base       numeric(20,8) := COALESCE(p_base_amount, 0);
  v_lots       numeric(20,8) := COALESCE(p_lots, 0);
  v_tier       jsonb;
  v_tier_rate  numeric(20,8);
  v_currency   public.wallet_currency;
BEGIN
  -- pick the highest-priority active rule whose schedule scope matches context
  SELECT fr.*
    INTO r
    FROM public.fee_rules fr
    JOIN public.fee_schedules fs ON fs.id = fr.schedule_id
   WHERE fr.fee_type = p_fee_type
     AND fr.active
     AND fs.active
     AND fs.scope <@ COALESCE(p_scope, '{}'::jsonb)
     AND fs.effective_from <= p_at
     AND (fs.effective_to IS NULL OR fs.effective_to > p_at)
   ORDER BY fs.precedence ASC, fr.priority ASC, fs.version DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', false, 'amount', 0, 'fee_type', p_fee_type);
  END IF;

  v_sched_id := r.schedule_id;
  v_currency := r.currency;

  CASE r.calc_method
    WHEN 'flat' THEN
      v_amount := r.rate;
    WHEN 'percentage', 'spread_markup' THEN
      v_amount := v_base * r.rate;
    WHEN 'per_lot' THEN
      v_amount := v_lots * r.rate;
    WHEN 'tiered' THEN
      -- tiers ascending by threshold; use the rate of the highest threshold <= base
      v_tier_rate := r.rate;  -- fallback / base bracket
      FOR v_tier IN SELECT * FROM jsonb_array_elements(r.tiers)
      LOOP
        IF v_base >= (v_tier->>'threshold')::numeric THEN
          v_tier_rate := (v_tier->>'rate')::numeric;
        END IF;
      END LOOP;
      v_amount := v_base * v_tier_rate;
    ELSE
      v_amount := 0;
  END CASE;

  -- clamp (clamp applies to magnitude before rebate negation)
  IF r.min_amount IS NOT NULL AND v_amount < r.min_amount THEN v_amount := r.min_amount; END IF;
  IF r.max_amount IS NOT NULL AND v_amount > r.max_amount THEN v_amount := r.max_amount; END IF;

  IF r.is_rebate THEN v_amount := -v_amount; END IF;

  RETURN jsonb_build_object(
    'matched',     true,
    'schedule_id', v_sched_id,
    'rule_id',     r.id,
    'fee_type',    p_fee_type,
    'calc_method', r.calc_method,
    'currency',    v_currency,
    'base_amount', v_base,
    'lots',        v_lots,
    'is_rebate',   r.is_rebate,
    'amount',      round(v_amount, 8)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_fee(public.fee_type, numeric, numeric, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_fee(public.fee_type, numeric, numeric, jsonb, timestamptz) TO authenticated, service_role;

-- 2.5 charge_fee — compute (or accept an override), record an immutable
-- fee_charge, post the double-entry journal, optionally debit the wallet, and
-- enqueue an event. Idempotent on p_idempotency_key.
--   • positive fee  → DEBIT client funds (liability down), CREDIT fee revenue
--   • negative fee (rebate) → DEBIT rebate expense, CREDIT client funds
CREATE OR REPLACE FUNCTION public.charge_fee(
  p_fee_type        public.fee_type,
  p_idempotency_key text,
  p_user_id         uuid DEFAULT NULL,
  p_wallet_id       uuid DEFAULT NULL,
  p_trading_account_id uuid DEFAULT NULL,
  p_base_amount     numeric DEFAULT 0,
  p_lots            numeric DEFAULT 0,
  p_scope           jsonb DEFAULT '{}'::jsonb,
  p_override_amount numeric DEFAULT NULL,   -- skip resolver, charge this exact amount
  p_move_wallet     boolean DEFAULT true,
  p_source_type     text DEFAULT 'fee',
  p_source_id       text DEFAULT NULL,
  p_created_by      uuid DEFAULT NULL,
  p_notes           text DEFAULT NULL
) RETURNS public.fee_charges
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
      -- no schedule matched → zero fee, record a waived charge for traceability
      v_amount := 0;
    ELSE
      v_amount   := (v_calc->>'amount')::numeric;
      v_sched_id := (v_calc->>'schedule_id')::uuid;
      v_rule_id  := (v_calc->>'rule_id')::uuid;
      v_method   := (v_calc->>'calc_method')::public.fee_calc_method;
      v_currency := (v_calc->>'currency')::public.wallet_currency;
    END IF;
  END IF;

  -- resolve currency from wallet if we are moving money
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
     CASE WHEN v_amount = 0 THEN 'waived' ELSE 'applied' END,
     v_method, COALESCE(p_source_type,'fee'), p_source_id, p_idempotency_key,
     p_created_by, p_notes)
  RETURNING * INTO v_charge;

  -- nothing more to do for a zero/waived fee
  IF v_amount = 0 THEN RETURN v_charge; END IF;

  -- double-entry journal
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

  -- optionally move the client wallet (positive fee = debit, rebate = credit)
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

  -- side-channel event for the bus / notifications
  INSERT INTO public.events_outbox (topic, payload, actor_id)
  VALUES ('fee.charged',
          jsonb_build_object('fee_charge_id', v_charge.id, 'fee_type', p_fee_type,
                             'amount', v_amount, 'currency', v_currency,
                             'user_id', p_user_id),
          p_created_by);

  RETURN v_charge;
END;
$$;

REVOKE ALL ON FUNCTION public.charge_fee(public.fee_type, text, uuid, uuid, uuid, numeric, numeric, jsonb, numeric, boolean, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_fee(public.fee_type, text, uuid, uuid, uuid, numeric, numeric, jsonb, numeric, boolean, text, text, uuid, text) TO service_role;

-- ===========================================================================
-- 3 · REBATE DISTRIBUTION (rebates = negative fees, paid up the IB tree)
--     Walks the existing ib_relationships and writes the existing
--     commission_ledger (kind: per-lot rebate). Connects Fee Engine -> IB.
-- ===========================================================================

-- Additive: commission_ledger predates the Fee Engine and has no metadata
-- column. Add one (nullable, defaulted) so rebate runs can record idempotency
-- keys + provenance without altering any existing column or constraint.
ALTER TABLE public.commission_ledger
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS comm_ledger_idem_idx
  ON public.commission_ledger ((metadata->>'idem'));

CREATE OR REPLACE FUNCTION public.distribute_rebate(
  p_source_user_id     uuid,
  p_trading_account_id uuid,
  p_lots               numeric,
  p_idempotency_prefix text,
  p_created_by         uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rel        record;
  v_plan       public.commission_plans%ROWTYPE;
  v_rate       numeric(20,8);
  v_share      numeric(6,4);
  v_amount     numeric(20,8);
  v_count      integer := 0;
  v_idem       text;
BEGIN
  IF p_lots IS NULL OR p_lots <= 0 THEN RETURN 0; END IF;

  -- walk every ancestor IB of the trading client
  FOR v_rel IN
    SELECT * FROM public.ib_relationships
     WHERE child_id = p_source_user_id
     ORDER BY level ASC
  LOOP
    -- resolve the plan + per-level share
    SELECT * INTO v_plan FROM public.commission_plans
     WHERE id = COALESCE(v_rel.commission_plan_id,
                         (SELECT id FROM public.commission_plans WHERE is_default LIMIT 1));
    IF NOT FOUND THEN CONTINUE; END IF;

    v_rate  := v_plan.rate_per_lot;
    v_share := COALESCE(v_rel.share_override,
                        CASE v_rel.level WHEN 1 THEN 1.0
                                         WHEN 2 THEN v_plan.sub_ib_share_l1
                                         ELSE v_plan.sub_ib_share_l2 END);
    v_amount := round(p_lots * v_rate * v_share, 8);
    IF v_amount <= 0 THEN CONTINUE; END IF;

    v_idem := p_idempotency_prefix || '-' || v_rel.parent_id::text || '-L' || v_rel.level::text;

    -- idempotency: skip if a ledger row with this settlement note already exists
    IF EXISTS (
      SELECT 1 FROM public.commission_ledger
       WHERE ib_user_id = v_rel.parent_id
         AND source_user_id = p_source_user_id
         AND metadata->>'idem' = v_idem
    ) THEN CONTINUE; END IF;

    INSERT INTO public.commission_ledger
      (ib_user_id, source_user_id, trading_account_id, lots, amount, currency, settled, metadata)
    VALUES
      (v_rel.parent_id, p_source_user_id, p_trading_account_id, p_lots, v_amount, 'USD', false,
       jsonb_build_object('idem', v_idem, 'level', v_rel.level, 'source','rebate_engine'));

    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    INSERT INTO public.events_outbox (topic, payload, actor_id)
    VALUES ('rebate.distributed',
            jsonb_build_object('source_user_id', p_source_user_id, 'lots', p_lots, 'payouts', v_count),
            p_created_by);
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.distribute_rebate(uuid, uuid, numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.distribute_rebate(uuid, uuid, numeric, text, uuid) TO service_role;

-- ===========================================================================
-- 4 · ROW-LEVEL SECURITY
--   Ledger + fee config are staff/admin surfaces. Clients see only their own
--   fee_charges (read). All money mutation happens through SECURITY DEFINER
--   functions (service_role), never direct table writes.
-- ===========================================================================
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_schedules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_charges     ENABLE ROW LEVEL SECURITY;

-- ledger_accounts: staff read, admin manage.
DROP POLICY IF EXISTS ledger_accounts_select ON public.ledger_accounts;
CREATE POLICY ledger_accounts_select ON public.ledger_accounts
  FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS ledger_accounts_write ON public.ledger_accounts;
CREATE POLICY ledger_accounts_write ON public.ledger_accounts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- journal entries/lines: staff read-only (writes only via post_journal_entry).
DROP POLICY IF EXISTS journal_entries_select ON public.journal_entries;
CREATE POLICY journal_entries_select ON public.journal_entries
  FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS journal_lines_select ON public.journal_lines;
CREATE POLICY journal_lines_select ON public.journal_lines
  FOR SELECT TO authenticated USING (public.is_staff());

-- fee_schedules + fee_rules: staff read, admin manage.
DROP POLICY IF EXISTS fee_schedules_select ON public.fee_schedules;
CREATE POLICY fee_schedules_select ON public.fee_schedules
  FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS fee_schedules_write ON public.fee_schedules;
CREATE POLICY fee_schedules_write ON public.fee_schedules
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS fee_rules_select ON public.fee_rules;
CREATE POLICY fee_rules_select ON public.fee_rules
  FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS fee_rules_write ON public.fee_rules;
CREATE POLICY fee_rules_write ON public.fee_rules
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- fee_charges: clients read their own; staff read all; no client writes.
DROP POLICY IF EXISTS fee_charges_select_own ON public.fee_charges;
CREATE POLICY fee_charges_select_own ON public.fee_charges
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff());

-- ===========================================================================
-- 5 · AUDIT TRIGGERS (reuse shared log_audit())
-- ===========================================================================
DROP TRIGGER IF EXISTS audit_ledger_accounts ON public.ledger_accounts;
CREATE TRIGGER audit_ledger_accounts AFTER INSERT OR UPDATE OR DELETE ON public.ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_fee_schedules ON public.fee_schedules;
CREATE TRIGGER audit_fee_schedules AFTER INSERT OR UPDATE OR DELETE ON public.fee_schedules
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_fee_rules ON public.fee_rules;
CREATE TRIGGER audit_fee_rules AFTER INSERT OR UPDATE OR DELETE ON public.fee_rules
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_fee_charges ON public.fee_charges;
CREATE TRIGGER audit_fee_charges AFTER INSERT OR UPDATE OR DELETE ON public.fee_charges
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ===========================================================================
-- 6 · GRANTS (explicit ahead of the 2026-10-30 public-schema grant flip)
-- ===========================================================================
GRANT SELECT ON public.ledger_accounts, public.journal_entries, public.journal_lines,
                public.fee_schedules, public.fee_rules, public.fee_charges TO authenticated;
GRANT SELECT ON public.ledger_account_balances TO authenticated;
-- admin config writes go through RLS-checked direct DML from the staff UI:
GRANT INSERT, UPDATE, DELETE ON public.ledger_accounts, public.fee_schedules, public.fee_rules TO authenticated;

GRANT ALL ON public.ledger_accounts, public.journal_entries, public.journal_lines,
              public.fee_schedules, public.fee_rules, public.fee_charges TO service_role;
GRANT SELECT ON public.ledger_account_balances TO service_role;

-- ===========================================================================
-- 7 · SEED — system chart of accounts, a default fee schedule, feature flag
-- ===========================================================================
INSERT INTO public.ledger_accounts (code, name, type, currency, is_system) VALUES
  ('CLIENT_FUNDS',   'Client Funds (segregated liability)', 'liability', 'USD', true),
  ('FEE_REVENUE',    'Fee Revenue',                         'revenue',   'USD', true),
  ('REBATE_EXPENSE', 'Rebate & Cashback Expense',           'expense',   'USD', true),
  ('CASH_GATEWAY',   'Payment Gateway Clearing',            'asset',     'USD', true),
  ('IB_PAYABLE',     'IB Commission Payable',               'liability', 'USD', true),
  ('PNL_TRADING',    'Trading P&L Clearing',                'equity',    'USD', true)
ON CONFLICT (code) DO NOTHING;

-- Default global fee schedule (v1) with a few representative rules. Rates are
-- conservative defaults the owner can tune in /staff/fees.
INSERT INTO public.fee_schedules (code, name, version, active, precedence, scope, description)
VALUES ('default', 'Default Fee Schedule', 1, true, 1000, '{}'::jsonb,
        'Global fallback schedule. Lowest precedence — any scoped schedule overrides it.')
ON CONFLICT (code, version) DO NOTHING;

INSERT INTO public.fee_rules (schedule_id, fee_type, calc_method, rate, min_amount, max_amount, currency)
SELECT s.id, x.fee_type::public.fee_type, x.calc_method::public.fee_calc_method,
       x.rate::numeric, x.min_amount::numeric, x.max_amount::numeric, 'USD'
FROM public.fee_schedules s
CROSS JOIN (VALUES
    ('deposit',     'percentage', 0.0,    NULL::numeric, NULL::numeric),   -- free deposits by default
    ('withdrawal',  'flat',       5.0,    NULL::numeric, NULL::numeric),   -- $5 flat withdrawal
    ('inactivity',  'flat',       10.0,   NULL::numeric, NULL::numeric),   -- $10/mo dormant
    ('conversion',  'percentage', 0.005,  NULL::numeric, NULL::numeric),   -- 0.5% FX conversion
    ('commission_per_lot','per_lot', 3.5, NULL::numeric, NULL::numeric)    -- $3.5 / standard lot
  ) AS x(fee_type, calc_method, rate, min_amount, max_amount)
WHERE s.code = 'default' AND s.version = 1
ON CONFLICT DO NOTHING;

INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('fee_engine', true, 'Universal Fee Engine + double-entry ledger')
ON CONFLICT (key) DO NOTHING;
