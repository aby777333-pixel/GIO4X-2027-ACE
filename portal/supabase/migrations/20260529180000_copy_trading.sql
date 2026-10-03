-- ============================================================================
-- 20260529180000_copy_trading.sql
-- Module 4 of Expansion Pack A — copy trading (social / mirror trading).
--
-- The portal already ships /copy/discover, /copy/copier and
-- /copy/signal-provider pages, but they were static mock-ups with no backend.
-- This module makes copy trading real and wires into the existing trade +
-- fee + commission engines:
--
--   • signal_providers   — a trader's public, staff-approved strategy profile,
--                          optionally linked to a master trading_account.
--   • copy_subscriptions  — a follower's allocation + copy ratio + status,
--                          with a high-water mark for performance fees.
--   • copy_trades         — the mirror log: one row per (subscription, master
--                          trade), the source of follower P&L.
--   • tg_mirror_provider_trade() — when a provider's master trade closes, mirror
--                          it to every active follower, charge the performance
--                          fee on new high-water profit via charge_fee(), and
--                          accrue the provider's share into commission_ledger
--                          (settled through settle_ib_commissions()).
--   • become_signal_provider / copy_subscribe / copy_set_subscription_status /
--     staff_set_provider_status — the buttons behind the UI.
--   • copy_list_providers / copy_my_subscriptions — read models with live stats.
--
-- ADDITIVE ONLY. Reuses trades, trading_accounts, wallets, profiles,
-- commission_ledger, charge_fee(), process_wallet_transaction(), events_outbox,
-- is_staff(), log_audit(), tg_updated_at(). The 'performance' fee_type already
-- exists in the fee_type enum.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0 · Enums
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.copy_provider_status AS ENUM ('pending','active','paused','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.copy_subscription_status AS ENUM ('active','paused','stopped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.copy_risk AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 1 · Tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signal_providers (
  id                   uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trading_account_id   uuid REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
  display_name         text NOT NULL,
  headline             text,
  risk                 public.copy_risk NOT NULL DEFAULT 'medium',
  performance_fee_bps  integer NOT NULL DEFAULT 2000 CHECK (performance_fee_bps BETWEEN 0 AND 5000),
  provider_share_bps   integer NOT NULL DEFAULT 8000 CHECK (provider_share_bps BETWEEN 0 AND 10000),
  min_allocation       numeric(20,8) NOT NULL DEFAULT 100 CHECK (min_allocation >= 0),
  currency             public.wallet_currency NOT NULL DEFAULT 'USD',
  status               public.copy_provider_status NOT NULL DEFAULT 'pending',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS signal_providers_status_idx  ON public.signal_providers (status);
CREATE INDEX IF NOT EXISTS signal_providers_account_idx ON public.signal_providers (trading_account_id);

CREATE TABLE IF NOT EXISTS public.copy_subscriptions (
  id               uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  follower_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id      uuid NOT NULL REFERENCES public.signal_providers(id) ON DELETE CASCADE,
  allocation       numeric(20,8) NOT NULL DEFAULT 0 CHECK (allocation >= 0),
  copy_ratio       numeric(8,4)  NOT NULL DEFAULT 1.0 CHECK (copy_ratio > 0),
  status           public.copy_subscription_status NOT NULL DEFAULT 'active',
  realized_pnl     numeric(20,8) NOT NULL DEFAULT 0,
  high_water_mark  numeric(20,8) NOT NULL DEFAULT 0,
  fees_paid        numeric(20,8) NOT NULL DEFAULT 0,
  currency         public.wallet_currency NOT NULL DEFAULT 'USD',
  started_at       timestamptz NOT NULL DEFAULT now(),
  paused_at        timestamptz,
  stopped_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, provider_id)
);
CREATE INDEX IF NOT EXISTS copy_subs_follower_idx ON public.copy_subscriptions (follower_id);
CREATE INDEX IF NOT EXISTS copy_subs_provider_idx ON public.copy_subscriptions (provider_id);
CREATE INDEX IF NOT EXISTS copy_subs_status_idx   ON public.copy_subscriptions (status);

CREATE TABLE IF NOT EXISTS public.copy_trades (
  id                 uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  subscription_id    uuid NOT NULL REFERENCES public.copy_subscriptions(id) ON DELETE CASCADE,
  provider_id        uuid NOT NULL REFERENCES public.signal_providers(id) ON DELETE CASCADE,
  follower_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_trade_id  uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  symbol             text NOT NULL DEFAULT 'XAUUSD',
  lots               numeric(12,4) NOT NULL DEFAULT 0,
  pnl                numeric(20,8) NOT NULL DEFAULT 0,
  currency           public.wallet_currency NOT NULL DEFAULT 'USD',
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, provider_trade_id)
);
CREATE INDEX IF NOT EXISTS copy_trades_sub_idx       ON public.copy_trades (subscription_id);
CREATE INDEX IF NOT EXISTS copy_trades_follower_idx  ON public.copy_trades (follower_id);

-- updated_at + audit triggers (match the platform pattern)
DROP TRIGGER IF EXISTS signal_providers_updated_at ON public.signal_providers;
CREATE TRIGGER signal_providers_updated_at BEFORE UPDATE ON public.signal_providers
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
DROP TRIGGER IF EXISTS signal_providers_audit ON public.signal_providers;
CREATE TRIGGER signal_providers_audit AFTER INSERT OR UPDATE OR DELETE ON public.signal_providers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS copy_subscriptions_updated_at ON public.copy_subscriptions;
CREATE TRIGGER copy_subscriptions_updated_at BEFORE UPDATE ON public.copy_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
DROP TRIGGER IF EXISTS copy_subscriptions_audit ON public.copy_subscriptions;
CREATE TRIGGER copy_subscriptions_audit AFTER INSERT OR UPDATE OR DELETE ON public.copy_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ----------------------------------------------------------------------------
-- 2 · RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.signal_providers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_trades        ENABLE ROW LEVEL SECURITY;

-- signal_providers: anyone signed in sees ACTIVE providers; owner sees own; staff all
DROP POLICY IF EXISTS sp_public_read ON public.signal_providers;
DROP POLICY IF EXISTS sp_self_read   ON public.signal_providers;
DROP POLICY IF EXISTS sp_staff_all   ON public.signal_providers;
CREATE POLICY sp_public_read ON public.signal_providers FOR SELECT TO authenticated
  USING (status = 'active' OR user_id = auth.uid());
CREATE POLICY sp_staff_all   ON public.signal_providers FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- copy_subscriptions: follower sees own; provider sees their followers; staff all
DROP POLICY IF EXISTS cs_self_read     ON public.copy_subscriptions;
DROP POLICY IF EXISTS cs_provider_read ON public.copy_subscriptions;
DROP POLICY IF EXISTS cs_staff_all     ON public.copy_subscriptions;
CREATE POLICY cs_self_read ON public.copy_subscriptions FOR SELECT TO authenticated
  USING (follower_id = auth.uid());
CREATE POLICY cs_provider_read ON public.copy_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.signal_providers sp
                  WHERE sp.id = copy_subscriptions.provider_id AND sp.user_id = auth.uid()));
CREATE POLICY cs_staff_all ON public.copy_subscriptions FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- copy_trades: follower sees own; staff all
DROP POLICY IF EXISTS ct_self_read  ON public.copy_trades;
DROP POLICY IF EXISTS ct_staff_all  ON public.copy_trades;
CREATE POLICY ct_self_read ON public.copy_trades FOR SELECT TO authenticated
  USING (follower_id = auth.uid());
CREATE POLICY ct_staff_all ON public.copy_trades FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- grants (writes flow through SECURITY DEFINER RPCs; reads via RLS)
GRANT SELECT ON public.signal_providers   TO authenticated;
GRANT SELECT ON public.copy_subscriptions TO authenticated;
GRANT SELECT ON public.copy_trades        TO authenticated;
GRANT ALL    ON public.signal_providers   TO service_role;
GRANT ALL    ON public.copy_subscriptions TO service_role;
GRANT ALL    ON public.copy_trades        TO service_role;

-- ----------------------------------------------------------------------------
-- 3 · Mirror trigger — fan a closed master trade out to active followers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_mirror_provider_trade()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_provider record;
  v_sub      record;
  v_fpnl     numeric;
  v_inc      numeric;
  v_fee      numeric;
  v_share    numeric;
  v_wallet   uuid;
  v_inserted integer;
  v_idem     text;
BEGIN
  IF NEW.status <> 'closed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'closed' THEN RETURN NEW; END IF;
  IF NEW.trading_account_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_provider FROM public.signal_providers
   WHERE trading_account_id = NEW.trading_account_id AND status = 'active'
   LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  FOR v_sub IN
    SELECT * FROM public.copy_subscriptions
     WHERE provider_id = v_provider.id AND status = 'active'
  LOOP
    v_fpnl := round(COALESCE(NEW.pnl, 0) * COALESCE(v_sub.copy_ratio, 1), 8);

    INSERT INTO public.copy_trades
      (subscription_id, provider_id, follower_id, provider_trade_id, symbol, lots, pnl, currency)
    VALUES
      (v_sub.id, v_provider.id, v_sub.follower_id, NEW.id, NEW.symbol,
       round(COALESCE(NEW.lots, 0) * COALESCE(v_sub.copy_ratio, 1), 4), v_fpnl, v_sub.currency)
    ON CONFLICT (subscription_id, provider_trade_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN CONTINUE; END IF;   -- already mirrored

    UPDATE public.copy_subscriptions
       SET realized_pnl = realized_pnl + v_fpnl
     WHERE id = v_sub.id;

    -- performance fee on NEW high-water profit only
    v_inc := (v_sub.realized_pnl + v_fpnl) - v_sub.high_water_mark;
    IF v_inc > 0 AND v_provider.performance_fee_bps > 0 THEN
      v_fee := round(v_inc * v_provider.performance_fee_bps / 10000.0, 8);
      IF v_fee > 0 THEN
        SELECT id INTO v_wallet FROM public.wallets
         WHERE user_id = v_sub.follower_id AND currency = v_sub.currency AND type = 'main'
         LIMIT 1;
        v_idem := 'copyperf-' || v_sub.id::text || '-' || NEW.id::text;

        BEGIN
          IF v_wallet IS NOT NULL THEN
            PERFORM public.charge_fee(
              p_fee_type        => 'performance',
              p_idempotency_key => v_idem,
              p_user_id         => v_sub.follower_id,
              p_wallet_id       => v_wallet,
              p_base_amount     => v_inc,
              p_override_amount => v_fee,
              p_move_wallet     => true,
              p_source_type     => 'copy_performance',
              p_source_id       => v_sub.id::text
            );
          END IF;

          v_share := round(v_fee * COALESCE(v_provider.provider_share_bps, 8000) / 10000.0, 8);
          IF v_share > 0 THEN
            INSERT INTO public.commission_ledger
              (ib_user_id, source_user_id, trading_account_id, lots, amount, currency, settled, metadata)
            VALUES
              (v_provider.user_id, v_sub.follower_id, NEW.trading_account_id, 0, v_share, v_sub.currency, false,
               jsonb_build_object('source','copy_engine','subscription_id', v_sub.id, 'provider_trade_id', NEW.id));
          END IF;

          UPDATE public.copy_subscriptions
             SET high_water_mark = realized_pnl, fees_paid = fees_paid + v_fee
           WHERE id = v_sub.id;
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO public.events_outbox (topic, payload)
          VALUES ('copy.fee_failed',
                  jsonb_build_object('subscription_id', v_sub.id, 'provider_trade_id', NEW.id, 'error', SQLERRM));
        END;
      END IF;
    END IF;

    INSERT INTO public.events_outbox (topic, payload)
    VALUES ('copy.trade_mirrored',
            jsonb_build_object('user_id', v_sub.follower_id, 'provider_id', v_provider.id,
                               'pnl', v_fpnl, 'currency', v_sub.currency));
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trades_copy_mirror ON public.trades;
CREATE TRIGGER trades_copy_mirror
  AFTER INSERT OR UPDATE OF status ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.tg_mirror_provider_trade();

-- ----------------------------------------------------------------------------
-- 4 · Self-serve + staff RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.become_signal_provider(
  p_display_name        text,
  p_headline            text DEFAULT NULL,
  p_trading_account_id  uuid DEFAULT NULL,
  p_risk                public.copy_risk DEFAULT 'medium',
  p_performance_fee_bps integer DEFAULT 2000,
  p_min_allocation      numeric DEFAULT 100
) RETURNS public.signal_providers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.signal_providers;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'become_signal_provider: sign-in required';
  END IF;
  IF coalesce(btrim(p_display_name),'') = '' THEN
    RAISE EXCEPTION 'a display name is required';
  END IF;
  IF p_performance_fee_bps < 0 OR p_performance_fee_bps > 5000 THEN
    RAISE EXCEPTION 'performance fee must be between 0%% and 50%%';
  END IF;
  IF p_trading_account_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.trading_accounts
                      WHERE id = p_trading_account_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'that trading account is not yours';
  END IF;

  INSERT INTO public.signal_providers
    (user_id, trading_account_id, display_name, headline, risk, performance_fee_bps, min_allocation, status)
  VALUES
    (v_uid, p_trading_account_id, btrim(p_display_name), p_headline, p_risk,
     p_performance_fee_bps, GREATEST(p_min_allocation, 0), 'pending')
  ON CONFLICT (user_id) DO UPDATE
     SET display_name        = EXCLUDED.display_name,
         headline            = EXCLUDED.headline,
         trading_account_id  = EXCLUDED.trading_account_id,
         risk                = EXCLUDED.risk,
         performance_fee_bps = EXCLUDED.performance_fee_bps,
         min_allocation      = EXCLUDED.min_allocation
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.become_signal_provider(text, text, uuid, public.copy_risk, integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.become_signal_provider(text, text, uuid, public.copy_risk, integer, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.copy_subscribe(
  p_provider_id uuid,
  p_allocation  numeric,
  p_copy_ratio  numeric DEFAULT 1.0
) RETURNS public.copy_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_p   public.signal_providers;
  v_row public.copy_subscriptions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'copy_subscribe: sign-in required';
  END IF;
  SELECT * INTO v_p FROM public.signal_providers WHERE id = p_provider_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'provider not found'; END IF;
  IF v_p.status <> 'active' THEN RAISE EXCEPTION 'this provider is not accepting followers'; END IF;
  IF v_p.user_id = v_uid THEN RAISE EXCEPTION 'you cannot copy your own strategy'; END IF;
  IF p_allocation < v_p.min_allocation THEN
    RAISE EXCEPTION 'minimum allocation is %', v_p.min_allocation;
  END IF;
  IF COALESCE(p_copy_ratio, 1) <= 0 THEN RAISE EXCEPTION 'copy ratio must be positive'; END IF;

  INSERT INTO public.copy_subscriptions
    (follower_id, provider_id, allocation, copy_ratio, currency, status, started_at)
  VALUES
    (v_uid, p_provider_id, p_allocation, COALESCE(p_copy_ratio, 1), v_p.currency, 'active', now())
  ON CONFLICT (follower_id, provider_id) DO UPDATE
     SET allocation = EXCLUDED.allocation,
         copy_ratio = EXCLUDED.copy_ratio,
         status     = 'active',
         paused_at  = NULL,
         stopped_at = NULL,
         started_at = CASE WHEN public.copy_subscriptions.status = 'stopped' THEN now()
                           ELSE public.copy_subscriptions.started_at END
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_subscribe(uuid, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_subscribe(uuid, numeric, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.copy_set_subscription_status(
  p_subscription_id uuid,
  p_status          public.copy_subscription_status
) RETURNS public.copy_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.copy_subscriptions;
BEGIN
  SELECT * INTO v_row FROM public.copy_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'subscription not found'; END IF;
  IF v_row.follower_id <> v_uid AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'not your subscription';
  END IF;

  UPDATE public.copy_subscriptions
     SET status     = p_status,
         paused_at  = CASE WHEN p_status = 'paused'  THEN now() ELSE paused_at END,
         stopped_at = CASE WHEN p_status = 'stopped' THEN now() ELSE stopped_at END
   WHERE id = p_subscription_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_set_subscription_status(uuid, public.copy_subscription_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_set_subscription_status(uuid, public.copy_subscription_status) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_set_provider_status(
  p_provider_id uuid,
  p_status      public.copy_provider_status
) RETURNS public.signal_providers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.signal_providers;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff_set_provider_status: staff access only';
  END IF;
  UPDATE public.signal_providers SET status = p_status
   WHERE id = p_provider_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'provider not found'; END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_set_provider_status(uuid, public.copy_provider_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_set_provider_status(uuid, public.copy_provider_status) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5 · Read models with live stats
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.copy_list_providers()
RETURNS TABLE (
  provider_id         uuid,
  user_id             uuid,
  display_name        text,
  headline            text,
  risk                public.copy_risk,
  performance_fee_bps integer,
  min_allocation      numeric,
  currency            public.wallet_currency,
  followers           bigint,
  aum                 numeric,
  trades_count        bigint,
  win_rate            numeric,
  total_pnl           numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sp.id,
         sp.user_id,
         sp.display_name,
         sp.headline,
         sp.risk,
         sp.performance_fee_bps,
         sp.min_allocation,
         sp.currency,
         COALESCE(f.followers, 0),
         COALESCE(f.aum, 0),
         COALESCE(t.trades_count, 0),
         CASE WHEN COALESCE(t.trades_count,0) > 0
              THEN round(100.0 * t.wins / t.trades_count, 1) ELSE 0 END,
         COALESCE(t.total_pnl, 0)
    FROM public.signal_providers sp
    LEFT JOIN LATERAL (
      SELECT count(*) AS followers, COALESCE(SUM(allocation),0) AS aum
        FROM public.copy_subscriptions cs
       WHERE cs.provider_id = sp.id AND cs.status = 'active'
    ) f ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS trades_count,
             count(*) FILTER (WHERE tr.pnl > 0) AS wins,
             COALESCE(SUM(tr.pnl),0) AS total_pnl
        FROM public.trades tr
       WHERE tr.trading_account_id = sp.trading_account_id AND tr.status = 'closed'
    ) t ON true
   WHERE sp.status = 'active'
   ORDER BY COALESCE(t.total_pnl,0) DESC, COALESCE(f.followers,0) DESC;
$$;

REVOKE ALL ON FUNCTION public.copy_list_providers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_list_providers() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.copy_my_subscriptions()
RETURNS TABLE (
  subscription_id uuid,
  provider_id     uuid,
  provider_name   text,
  allocation      numeric,
  copy_ratio      numeric,
  realized_pnl    numeric,
  fees_paid       numeric,
  status          public.copy_subscription_status,
  currency        public.wallet_currency,
  started_at      timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cs.id,
         cs.provider_id,
         sp.display_name,
         cs.allocation,
         cs.copy_ratio,
         cs.realized_pnl,
         cs.fees_paid,
         cs.status,
         cs.currency,
         cs.started_at
    FROM public.copy_subscriptions cs
    JOIN public.signal_providers sp ON sp.id = cs.provider_id
   WHERE cs.follower_id = auth.uid()
   ORDER BY cs.started_at DESC;
$$;

REVOKE ALL ON FUNCTION public.copy_my_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_my_subscriptions() TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- END 20260529180000_copy_trading.sql
-- ============================================================================
