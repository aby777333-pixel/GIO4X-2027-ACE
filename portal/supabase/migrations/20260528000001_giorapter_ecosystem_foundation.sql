-- ============================================================================
-- 20260528000001_giorapter_ecosystem_foundation.sql
-- ============================================================================
-- Purpose: Lay the entire GIORAPTOR ecosystem schema in one additive migration.
--   profiles · crm_profiles · wallets · wallet_transactions · kyc_documents
--   trading_accounts · ib_relationships · commission_plans · commission_ledger
--   referrals · support_tickets · ticket_messages · notifications · announcements
--   audit_logs · login_history · device_sessions
-- Plus enums, indexes, helper fns (is_staff / is_admin / generate_referral_code /
-- tg_updated_at), triggers (handle_new_user, log_audit, updated_at), the
-- SECURITY DEFINER money mutator (process_wallet_transaction), RLS (default
-- deny) on every table, GRANTs for the 2026-10-30 public-schema flip, and the
-- kyc-documents private storage bucket with per-user RLS.
--
-- Rollback (manual, in reverse order):
--   • drop policies on storage.objects ('kyc-documents owners ...')
--   • delete from storage.buckets where id = 'kyc-documents';
--   • drop trigger on_auth_user_created on auth.users;
--   • drop functions: handle_new_user, process_wallet_transaction,
--     log_audit, tg_updated_at, generate_referral_code, is_staff, is_admin;
--   • drop tables (children first): audit_logs, login_history, device_sessions,
--     announcements, notifications, ticket_messages, support_tickets, referrals,
--     commission_ledger, ib_relationships, commission_plans, trading_accounts,
--     kyc_documents, wallet_transactions, wallets, crm_profiles, profiles;
--   • drop sequences: wallet_seq, trading_account_seq, referral_code_seq,
--     ticket_seq;
--   • drop types (in reverse): audit_action, notification_kind,
--     ticket_category, ticket_priority, ticket_status, account_status,
--     account_kind, kyc_doc_status, kyc_doc_type, transaction_status,
--     transaction_type, wallet_status, wallet_currency, wallet_type,
--     user_status, kyc_status, user_role.
--
-- This migration is INTENDED to run on an empty public schema (verified via
-- list_tables 2026-05-28 — public had 0 tables, list_migrations was empty).
-- Every CREATE uses IF NOT EXISTS so re-running is a no-op on existing objects.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0 · Extensions (pgcrypto + uuid-ossp already installed; this is idempotent)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext;


-- ----------------------------------------------------------------------------
-- 1 · Enum types
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('trader','ib','affiliate','staff','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM ('pending_verification','active','suspended','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.kyc_status AS ENUM ('not_started','in_progress','in_review','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_type AS ENUM ('main','bonus','ib_commission');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_currency AS ENUM ('USD','EUR','GBP','INR','AED','USDT','BTC','ETH','USC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_status AS ENUM ('active','frozen','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_type AS ENUM (
    'deposit','withdraw','transfer_in','transfer_out',
    'bonus','rebate','commission','fee','adjustment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_status AS ENUM (
    'pending','processing','completed','failed','reversed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.kyc_doc_type AS ENUM (
    'passport','national_id','drivers_license','utility_bill','bank_statement','selfie','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.kyc_doc_status AS ENUM ('pending','in_review','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.account_kind AS ENUM ('demo','live','copy','prop','managed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('active','archived','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','waiting_customer','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_category AS ENUM (
    'account','kyc','deposit','withdraw','trading','ib','technical','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_kind AS ENUM (
    'account','kyc','funds','trade','ib','promo','system','security'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM ('INSERT','UPDATE','DELETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- 2 · Sequences (for human-friendly public refs)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.wallet_seq            START 100001;
CREATE SEQUENCE IF NOT EXISTS public.trading_account_seq   START 100001;
CREATE SEQUENCE IF NOT EXISTS public.ticket_seq            START 10001;


-- ----------------------------------------------------------------------------
-- 3 · Helper functions that DON'T reference public.profiles
--    (role helpers is_staff / is_admin / generate_referral_code are declared
--    in section 6, after the profiles table exists, so SQL functions can
--    validate their bodies at creation time.)
-- ----------------------------------------------------------------------------

-- generic updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- 4 · Tables
-- ----------------------------------------------------------------------------

-- 4.1 profiles (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            public.user_role     NOT NULL DEFAULT 'trader',
  full_name       text                 NOT NULL DEFAULT '',
  email           citext               UNIQUE,
  phone           text,
  country         text,                                       -- ISO 3166-1 alpha-2
  status          public.user_status   NOT NULL DEFAULT 'pending_verification',
  kyc_status      public.kyc_status    NOT NULL DEFAULT 'not_started',
  referred_by     uuid                 REFERENCES public.profiles(id) ON DELETE SET NULL,
  referral_code   text                 UNIQUE,
  language        text                 NOT NULL DEFAULT 'en',
  timezone        text                 NOT NULL DEFAULT 'UTC',
  avatar_url      text,
  metadata        jsonb                NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz          NOT NULL DEFAULT now(),
  updated_at      timestamptz          NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profiles_role_idx          ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx   ON public.profiles (referred_by);
CREATE INDEX IF NOT EXISTS profiles_kyc_status_idx    ON public.profiles (kyc_status);
CREATE INDEX IF NOT EXISTS profiles_country_idx       ON public.profiles (country);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();


-- 4.2 crm_profiles
CREATE TABLE IF NOT EXISTS public.crm_profiles (
  user_id          uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  risk_level       smallint     NOT NULL DEFAULT 3 CHECK (risk_level BETWEEN 1 AND 5),
  tags             text[]       NOT NULL DEFAULT '{}',
  notes            text         NOT NULL DEFAULT '',
  assigned_staff   uuid         REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary          text         NOT NULL DEFAULT '',
  source           text         NOT NULL DEFAULT 'organic',
  lifecycle_stage  text         NOT NULL DEFAULT 'lead',
  lifetime_value   numeric(20,2) NOT NULL DEFAULT 0,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_profiles_assigned_staff_idx ON public.crm_profiles (assigned_staff);
CREATE INDEX IF NOT EXISTS crm_profiles_lifecycle_idx      ON public.crm_profiles (lifecycle_stage);

DROP TRIGGER IF EXISTS crm_profiles_updated_at ON public.crm_profiles;
CREATE TRIGGER crm_profiles_updated_at BEFORE UPDATE ON public.crm_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();


-- 4.3 wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id          uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  wallet_id   text UNIQUE NOT NULL,                          -- 'W-26-0100001'
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency    public.wallet_currency NOT NULL DEFAULT 'USD',
  balance     numeric(20,8) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  type        public.wallet_type NOT NULL DEFAULT 'main',
  status      public.wallet_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency, type)
);
CREATE INDEX IF NOT EXISTS wallets_user_idx     ON public.wallets (user_id);
CREATE INDEX IF NOT EXISTS wallets_status_idx   ON public.wallets (status);

DROP TRIGGER IF EXISTS wallets_updated_at ON public.wallets;
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();


-- 4.4 wallet_transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id                uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  wallet_id         uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  type              public.transaction_type NOT NULL,
  amount            numeric(20,8) NOT NULL CHECK (amount >= 0),  -- always non-neg; sign implied by type
  currency          public.wallet_currency NOT NULL,             -- snapshot at tx time
  balance_after     numeric(20,8) NOT NULL,
  status            public.transaction_status NOT NULL DEFAULT 'pending',
  gateway           text,
  gateway_ref       text,
  idempotency_key   text UNIQUE NOT NULL,
  related_user_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_tx_wallet_idx   ON public.wallet_transactions (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_tx_type_idx     ON public.wallet_transactions (type);
CREATE INDEX IF NOT EXISTS wallet_tx_status_idx   ON public.wallet_transactions (status);
CREATE INDEX IF NOT EXISTS wallet_tx_gateway_idx  ON public.wallet_transactions (gateway, gateway_ref);

DROP TRIGGER IF EXISTS wallet_tx_updated_at ON public.wallet_transactions;
CREATE TRIGGER wallet_tx_updated_at BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();


-- 4.5 kyc_documents
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id                uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type          public.kyc_doc_type NOT NULL,
  storage_path      text NOT NULL,                              -- bucket: kyc-documents
  file_name         text,
  file_size_bytes   integer CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  mime_type         text,
  status            public.kyc_doc_status NOT NULL DEFAULT 'pending',
  reviewed_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  rejection_reason  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kyc_docs_user_idx     ON public.kyc_documents (user_id);
CREATE INDEX IF NOT EXISTS kyc_docs_status_idx   ON public.kyc_documents (status);

DROP TRIGGER IF EXISTS kyc_documents_updated_at ON public.kyc_documents;
CREATE TRIGGER kyc_documents_updated_at BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();


-- 4.6 trading_accounts
CREATE TABLE IF NOT EXISTS public.trading_accounts (
  id               uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  account_number   text UNIQUE NOT NULL,                       -- '100001'
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_kind     public.account_kind NOT NULL DEFAULT 'live',
  leverage         integer NOT NULL DEFAULT 500 CHECK (leverage > 0 AND leverage <= 2000),
  base_currency    public.wallet_currency NOT NULL DEFAULT 'USD',
  balance          numeric(20,8) NOT NULL DEFAULT 0,
  equity           numeric(20,8) NOT NULL DEFAULT 0,
  margin_free      numeric(20,8) NOT NULL DEFAULT 0,
  status           public.account_status NOT NULL DEFAULT 'active',
  plan_name        text NOT NULL DEFAULT 'Classic',
  server           text NOT NULL DEFAULT 'GIO4X-Live01',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trading_accounts_user_idx    ON public.trading_accounts (user_id);
CREATE INDEX IF NOT EXISTS trading_accounts_kind_idx    ON public.trading_accounts (account_kind);
CREATE INDEX IF NOT EXISTS trading_accounts_status_idx  ON public.trading_accounts (status);

DROP TRIGGER IF EXISTS trading_accounts_updated_at ON public.trading_accounts;
CREATE TRIGGER trading_accounts_updated_at BEFORE UPDATE ON public.trading_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();


-- 4.7 commission_plans
CREATE TABLE IF NOT EXISTS public.commission_plans (
  id                 uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name               text UNIQUE NOT NULL,
  rate_per_lot       numeric(10,4) NOT NULL DEFAULT 0,         -- USD per standard lot
  sub_ib_share_l1    numeric(5,4) NOT NULL DEFAULT 0,          -- 0.15 = 15%
  sub_ib_share_l2    numeric(5,4) NOT NULL DEFAULT 0,
  is_default         boolean NOT NULL DEFAULT false,
  active             boolean NOT NULL DEFAULT true,
  description        text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
-- one default plan
CREATE UNIQUE INDEX IF NOT EXISTS commission_plans_one_default_idx
  ON public.commission_plans (is_default)
  WHERE is_default = true;


-- 4.8 ib_relationships
CREATE TABLE IF NOT EXISTS public.ib_relationships (
  id                  uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  parent_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level               smallint NOT NULL CHECK (level >= 1 AND level <= 10),
  commission_plan_id  uuid REFERENCES public.commission_plans(id) ON DELETE SET NULL,
  share_override      numeric(5,4),                           -- nullable: use plan if null
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, child_id),
  CHECK (parent_id <> child_id)
);
CREATE INDEX IF NOT EXISTS ib_rel_parent_idx   ON public.ib_relationships (parent_id);
CREATE INDEX IF NOT EXISTS ib_rel_child_idx    ON public.ib_relationships (child_id);


-- 4.9 commission_ledger
CREATE TABLE IF NOT EXISTS public.commission_ledger (
  id                    uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  ib_user_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trading_account_id    uuid REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
  lots                  numeric(12,4) NOT NULL DEFAULT 0,
  amount                numeric(20,8) NOT NULL,
  currency              public.wallet_currency NOT NULL DEFAULT 'USD',
  period_start          date,
  period_end            date,
  settled               boolean NOT NULL DEFAULT false,
  settlement_tx_id      uuid REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comm_ledger_ib_idx       ON public.commission_ledger (ib_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comm_ledger_source_idx   ON public.commission_ledger (source_user_id);
CREATE INDEX IF NOT EXISTS comm_ledger_settled_idx  ON public.commission_ledger (settled);


-- 4.10 referrals (link codes, separate from profile.referral_code)
CREATE TABLE IF NOT EXISTS public.referrals (
  id            uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  code          text UNIQUE NOT NULL,
  owner_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          text,
  destination   text NOT NULL DEFAULT 'register',
  sub_id        text,
  clicks        integer NOT NULL DEFAULT 0,
  conversions   integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referrals_owner_idx ON public.referrals (owner_id);


-- 4.11 support_tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id              uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  ticket_ref      text UNIQUE NOT NULL,                       -- 'T-10001'
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject         text NOT NULL,
  category        public.ticket_category NOT NULL DEFAULT 'other',
  priority        public.ticket_priority NOT NULL DEFAULT 'normal',
  status          public.ticket_status NOT NULL DEFAULT 'open',
  assigned_staff  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_user_idx     ON public.support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_status_idx   ON public.support_tickets (status);
CREATE INDEX IF NOT EXISTS tickets_assigned_idx ON public.support_tickets (assigned_staff);

DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();


-- 4.12 ticket_messages
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id              uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            text NOT NULL,
  is_staff_reply  boolean NOT NULL DEFAULT false,
  attachments     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_messages_ticket_idx ON public.ticket_messages (ticket_id, created_at);


-- 4.13 notifications (per-user inbox)
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind        public.notification_kind NOT NULL,
  title       text NOT NULL,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;


-- 4.14 announcements (broadcast)
CREATE TABLE IF NOT EXISTS public.announcements (
  id          uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  kind        public.notification_kind NOT NULL DEFAULT 'system',
  audience    text NOT NULL DEFAULT 'all',                    -- 'all','traders','ibs','staff'
  starts_at   timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz,
  active      boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_active_idx ON public.announcements (active, starts_at, ends_at);


-- 4.15 audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      public.audit_action NOT NULL,
  table_name  text NOT NULL,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  context     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx     ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_idx     ON public.audit_logs (table_name, created_at DESC);


-- 4.16 login_history
CREATE TABLE IF NOT EXISTS public.login_history (
  id                uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id           uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_attempted   citext,                                    -- for failed attempts on unknown emails
  success           boolean NOT NULL,
  failure_reason    text,
  ip_address        inet,
  user_agent        text,
  country           text,
  device_id         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_history_user_idx     ON public.login_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS login_history_success_idx  ON public.login_history (success, created_at DESC);


-- 4.17 device_sessions
CREATE TABLE IF NOT EXISTS public.device_sessions (
  id            uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id     text NOT NULL,
  device_label  text,
  ip_address    inet,
  user_agent    text,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
CREATE INDEX IF NOT EXISTS device_sessions_user_idx ON public.device_sessions (user_id, last_seen_at DESC);


-- ----------------------------------------------------------------------------
-- 5 · Seed (one default commission plan so handle_new_user can reference it)
-- ----------------------------------------------------------------------------
INSERT INTO public.commission_plans (name, rate_per_lot, sub_ib_share_l1, sub_ib_share_l2, is_default, description)
VALUES ('Standard IB', 1.00, 0.15, 0.05, true, 'Default IB commission plan — $1/lot, 15% L1 share, 5% L2 share.')
ON CONFLICT (name) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 5b · Role helpers + referral code generator (now that profiles exists)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('staff','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- referral code generator: 8 chars, base32-ish from gen_random_bytes
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_code text;
  v_exists boolean;
  v_attempt int := 0;
BEGIN
  LOOP
    v_code := upper(substring(encode(extensions.gen_random_bytes(6), 'base64') from 1 for 8));
    v_code := regexp_replace(v_code, '[^A-Z0-9]', '0', 'g');
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_attempt := v_attempt + 1;
    IF v_attempt > 8 THEN
      v_code := 'R' || lpad((p_user_id::text || extract(epoch from now())::text)::text, 7, '0');
      EXIT;
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;


-- ----------------------------------------------------------------------------
-- 6 · handle_new_user — atomically provision profile, crm_profile, wallet
--    Runs on auth.users INSERT via SECURITY DEFINER trigger.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_referrer_id   uuid;
  v_role          public.user_role := 'trader';
  v_full_name     text := '';
  v_phone         text;
  v_source        text := 'organic';
  v_wallet_ref    text;
  v_referral_code text;
  v_meta          jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  -- pull metadata if provided by signup form
  IF v_meta ? 'full_name' THEN v_full_name := v_meta->>'full_name'; END IF;
  IF v_meta ? 'phone'     THEN v_phone     := v_meta->>'phone';     END IF;
  IF v_meta ? 'source'    THEN v_source    := v_meta->>'source';    END IF;
  IF v_meta ? 'role'      THEN
    BEGIN v_role := (v_meta->>'role')::public.user_role;
    EXCEPTION WHEN invalid_text_representation THEN v_role := 'trader'; END;
  END IF;

  -- find referrer (if signed up via referral code)
  IF v_meta ? 'referral_code' THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles WHERE referral_code = v_meta->>'referral_code'
    LIMIT 1;
  END IF;

  -- mint this user's own referral code first so we have it for the insert
  v_referral_code := public.generate_referral_code(NEW.id);

  -- profile (1:1 with auth.users)
  INSERT INTO public.profiles (id, email, full_name, phone, role, referred_by, referral_code, status)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    COALESCE(v_phone, NEW.phone),
    v_role,
    v_referrer_id,
    v_referral_code,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN 'active'::public.user_status
         ELSE 'pending_verification'::public.user_status END
  )
  ON CONFLICT (id) DO NOTHING;

  -- crm shadow row
  INSERT INTO public.crm_profiles (user_id, source)
  VALUES (NEW.id, v_source)
  ON CONFLICT (user_id) DO NOTHING;

  -- main USD wallet
  v_wallet_ref := 'W-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.wallet_seq')::text, 7, '0');
  INSERT INTO public.wallets (wallet_id, user_id, currency, type)
  VALUES (v_wallet_ref, NEW.id, 'USD', 'main')
  ON CONFLICT (user_id, currency, type) DO NOTHING;

  -- IB relationship if signed up via a referral
  IF v_referrer_id IS NOT NULL THEN
    INSERT INTO public.ib_relationships (parent_id, child_id, level, commission_plan_id)
    VALUES (
      v_referrer_id,
      NEW.id,
      1,
      (SELECT id FROM public.commission_plans WHERE is_default = true LIMIT 1)
    )
    ON CONFLICT (parent_id, child_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 7 · process_wallet_transaction — the ONLY way to move money
--    Row-locks the wallet, enforces idempotency, validates balance.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_wallet_transaction(
  p_wallet_id        uuid,
  p_type             public.transaction_type,
  p_amount           numeric,
  p_idempotency_key  text,
  p_gateway          text DEFAULT NULL,
  p_gateway_ref      text DEFAULT NULL,
  p_status           public.transaction_status DEFAULT 'pending',
  p_related_user_id  uuid DEFAULT NULL,
  p_metadata         jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wallet       public.wallets%ROWTYPE;
  v_new_balance  numeric(20,8);
  v_tx_id        uuid;
  v_existing     uuid;
BEGIN
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'process_wallet_transaction: amount must be non-negative (got %)', p_amount;
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'process_wallet_transaction: idempotency_key required (min 8 chars)';
  END IF;

  -- idempotency short-circuit
  SELECT id INTO v_existing FROM public.wallet_transactions
   WHERE idempotency_key = p_idempotency_key
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- row-lock the wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet % not found', p_wallet_id; END IF;
  IF v_wallet.status <> 'active' THEN
    RAISE EXCEPTION 'wallet % is %, cannot transact', p_wallet_id, v_wallet.status;
  END IF;

  -- compute the would-be balance based on tx type
  v_new_balance := v_wallet.balance;
  CASE p_type
    WHEN 'deposit','bonus','rebate','commission','transfer_in','adjustment' THEN
      IF p_status = 'completed' THEN v_new_balance := v_wallet.balance + p_amount; END IF;
    WHEN 'withdraw','transfer_out','fee' THEN
      IF p_status = 'completed' THEN
        IF v_wallet.balance < p_amount THEN
          RAISE EXCEPTION 'insufficient balance: have %, need %', v_wallet.balance, p_amount;
        END IF;
        v_new_balance := v_wallet.balance - p_amount;
      END IF;
    ELSE
      RAISE EXCEPTION 'unsupported transaction type: %', p_type;
  END CASE;

  -- only completed transactions mutate the wallet balance
  IF p_status = 'completed' THEN
    UPDATE public.wallets
       SET balance = v_new_balance, updated_at = now()
     WHERE id = p_wallet_id;
  END IF;

  INSERT INTO public.wallet_transactions
    (wallet_id, type, amount, currency, balance_after, status,
     gateway, gateway_ref, idempotency_key, related_user_id, metadata)
  VALUES
    (p_wallet_id, p_type, p_amount, v_wallet.currency, v_new_balance, p_status,
     p_gateway, p_gateway_ref, p_idempotency_key, p_related_user_id, p_metadata)
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- only authenticated callers may invoke; service role implicitly allowed.
REVOKE ALL ON FUNCTION public.process_wallet_transaction(uuid, public.transaction_type, numeric, text, text, text, public.transaction_status, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_wallet_transaction(uuid, public.transaction_type, numeric, text, text, text, public.transaction_status, uuid, jsonb) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 8 · log_audit — generic audit trigger for sensitive tables
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_record_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := COALESCE((to_jsonb(OLD)->>'id'), '');
  ELSE
    v_record_id := COALESCE((to_jsonb(NEW)->>'id'), '');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_OP::public.audit_action,
    TG_TABLE_NAME,
    v_record_id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- attach to sensitive tables
DROP TRIGGER IF EXISTS profiles_audit ON public.profiles;
CREATE TRIGGER profiles_audit AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS wallets_audit ON public.wallets;
CREATE TRIGGER wallets_audit AFTER INSERT OR UPDATE OR DELETE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS wallet_tx_audit ON public.wallet_transactions;
CREATE TRIGGER wallet_tx_audit AFTER INSERT OR UPDATE OR DELETE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS kyc_documents_audit ON public.kyc_documents;
CREATE TRIGGER kyc_documents_audit AFTER INSERT OR UPDATE OR DELETE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS trading_accounts_audit ON public.trading_accounts;
CREATE TRIGGER trading_accounts_audit AFTER INSERT OR UPDATE OR DELETE ON public.trading_accounts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();


-- ----------------------------------------------------------------------------
-- 9 · Row-Level Security: enable on EVERY table, default deny, then layer policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ib_relationships    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions     ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS profiles_self_select   ON public.profiles;
DROP POLICY IF EXISTS profiles_staff_select  ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update   ON public.profiles;
DROP POLICY IF EXISTS profiles_staff_update  ON public.profiles;
CREATE POLICY profiles_self_select  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY profiles_staff_select ON public.profiles FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY profiles_self_update  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  -- forbid the user from escalating their own role/status/kyc
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
    AND kyc_status = (SELECT kyc_status FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY profiles_staff_update ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- crm_profiles
DROP POLICY IF EXISTS crm_self_select   ON public.crm_profiles;
DROP POLICY IF EXISTS crm_staff_all     ON public.crm_profiles;
CREATE POLICY crm_self_select ON public.crm_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY crm_staff_all   ON public.crm_profiles FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- wallets: read own / staff sees all; writes only via SECURITY DEFINER fn
DROP POLICY IF EXISTS wallets_self_select  ON public.wallets;
DROP POLICY IF EXISTS wallets_staff_select ON public.wallets;
CREATE POLICY wallets_self_select  ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY wallets_staff_select ON public.wallets FOR SELECT TO authenticated
  USING (public.is_staff());
-- NO insert/update/delete policies → default deny for clients.

-- wallet_transactions: read own / staff; writes only via fn
DROP POLICY IF EXISTS wallet_tx_self_select  ON public.wallet_transactions;
DROP POLICY IF EXISTS wallet_tx_staff_select ON public.wallet_transactions;
CREATE POLICY wallet_tx_self_select  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wallets w WHERE w.id = wallet_transactions.wallet_id AND w.user_id = auth.uid()
  ));
CREATE POLICY wallet_tx_staff_select ON public.wallet_transactions FOR SELECT TO authenticated
  USING (public.is_staff());

-- kyc_documents
DROP POLICY IF EXISTS kyc_self_select  ON public.kyc_documents;
DROP POLICY IF EXISTS kyc_self_insert  ON public.kyc_documents;
DROP POLICY IF EXISTS kyc_self_delete  ON public.kyc_documents;
DROP POLICY IF EXISTS kyc_staff_all    ON public.kyc_documents;
CREATE POLICY kyc_self_select  ON public.kyc_documents FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY kyc_self_insert  ON public.kyc_documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY kyc_self_delete  ON public.kyc_documents FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');
CREATE POLICY kyc_staff_all    ON public.kyc_documents FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- trading_accounts (clients can read own; insert own demo; staff can manage all)
DROP POLICY IF EXISTS trading_self_select ON public.trading_accounts;
DROP POLICY IF EXISTS trading_self_insert ON public.trading_accounts;
DROP POLICY IF EXISTS trading_staff_all   ON public.trading_accounts;
CREATE POLICY trading_self_select ON public.trading_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY trading_self_insert ON public.trading_accounts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND account_kind = 'demo');
CREATE POLICY trading_staff_all   ON public.trading_accounts FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- commission_plans: all authenticated read; admin writes
DROP POLICY IF EXISTS comm_plans_read    ON public.commission_plans;
DROP POLICY IF EXISTS comm_plans_admin   ON public.commission_plans;
CREATE POLICY comm_plans_read  ON public.commission_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY comm_plans_admin ON public.commission_plans FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ib_relationships
DROP POLICY IF EXISTS ib_rel_parent_read   ON public.ib_relationships;
DROP POLICY IF EXISTS ib_rel_child_read    ON public.ib_relationships;
DROP POLICY IF EXISTS ib_rel_staff_all     ON public.ib_relationships;
CREATE POLICY ib_rel_parent_read ON public.ib_relationships FOR SELECT TO authenticated
  USING (parent_id = auth.uid());
CREATE POLICY ib_rel_child_read  ON public.ib_relationships FOR SELECT TO authenticated
  USING (child_id  = auth.uid());
CREATE POLICY ib_rel_staff_all   ON public.ib_relationships FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- commission_ledger
DROP POLICY IF EXISTS comm_ledger_ib_read    ON public.commission_ledger;
DROP POLICY IF EXISTS comm_ledger_staff_all  ON public.commission_ledger;
CREATE POLICY comm_ledger_ib_read   ON public.commission_ledger FOR SELECT TO authenticated
  USING (ib_user_id = auth.uid());
CREATE POLICY comm_ledger_staff_all ON public.commission_ledger FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- referrals
DROP POLICY IF EXISTS referrals_self_select ON public.referrals;
DROP POLICY IF EXISTS referrals_self_insert ON public.referrals;
DROP POLICY IF EXISTS referrals_self_update ON public.referrals;
DROP POLICY IF EXISTS referrals_self_delete ON public.referrals;
DROP POLICY IF EXISTS referrals_staff_all   ON public.referrals;
CREATE POLICY referrals_self_select ON public.referrals FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY referrals_self_insert ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY referrals_self_update ON public.referrals FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY referrals_self_delete ON public.referrals FOR DELETE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY referrals_staff_all   ON public.referrals FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- support_tickets
DROP POLICY IF EXISTS tickets_self_select ON public.support_tickets;
DROP POLICY IF EXISTS tickets_self_insert ON public.support_tickets;
DROP POLICY IF EXISTS tickets_self_update ON public.support_tickets;
DROP POLICY IF EXISTS tickets_staff_all   ON public.support_tickets;
CREATE POLICY tickets_self_select ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY tickets_self_insert ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY tickets_self_update ON public.support_tickets FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status IN ('closed'));
CREATE POLICY tickets_staff_all   ON public.support_tickets FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ticket_messages
DROP POLICY IF EXISTS ticket_msgs_select ON public.ticket_messages;
DROP POLICY IF EXISTS ticket_msgs_insert ON public.ticket_messages;
DROP POLICY IF EXISTS ticket_msgs_staff  ON public.ticket_messages;
CREATE POLICY ticket_msgs_select ON public.ticket_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY ticket_msgs_insert ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid()
    )
    AND is_staff_reply = false
  );
CREATE POLICY ticket_msgs_staff  ON public.ticket_messages FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- notifications
DROP POLICY IF EXISTS notif_self_select ON public.notifications;
DROP POLICY IF EXISTS notif_self_update ON public.notifications;
DROP POLICY IF EXISTS notif_self_delete ON public.notifications;
DROP POLICY IF EXISTS notif_staff_all   ON public.notifications;
CREATE POLICY notif_self_select ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notif_self_update ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_self_delete ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notif_staff_all   ON public.notifications FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- announcements: any signed-in user sees active ones in their window; staff manage
DROP POLICY IF EXISTS announcements_read       ON public.announcements;
DROP POLICY IF EXISTS announcements_staff_all  ON public.announcements;
CREATE POLICY announcements_read ON public.announcements FOR SELECT TO authenticated
  USING (active = true AND now() >= starts_at AND (ends_at IS NULL OR now() <= ends_at));
CREATE POLICY announcements_staff_all ON public.announcements FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- audit_logs: only staff can read; inserts are trigger-only (no policy = denied)
DROP POLICY IF EXISTS audit_logs_staff_select ON public.audit_logs;
CREATE POLICY audit_logs_staff_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_staff());

-- login_history: user sees own / staff sees all; inserts via server only
DROP POLICY IF EXISTS login_history_self_select  ON public.login_history;
DROP POLICY IF EXISTS login_history_staff_select ON public.login_history;
CREATE POLICY login_history_self_select  ON public.login_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY login_history_staff_select ON public.login_history FOR SELECT TO authenticated
  USING (public.is_staff());

-- device_sessions
DROP POLICY IF EXISTS device_self_select ON public.device_sessions;
DROP POLICY IF EXISTS device_self_insert ON public.device_sessions;
DROP POLICY IF EXISTS device_self_update ON public.device_sessions;
DROP POLICY IF EXISTS device_self_delete ON public.device_sessions;
CREATE POLICY device_self_select ON public.device_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY device_self_insert ON public.device_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY device_self_update ON public.device_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY device_self_delete ON public.device_sessions FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 10 · GRANTs (explicit, ready for the 2026-10-30 public-schema auto-grant flip)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- generous table grants for authenticated / service_role — RLS gates row access
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles, public.crm_profiles, public.wallets, public.wallet_transactions,
  public.kyc_documents, public.trading_accounts, public.commission_plans,
  public.ib_relationships, public.commission_ledger, public.referrals,
  public.support_tickets, public.ticket_messages, public.notifications,
  public.announcements, public.audit_logs, public.login_history,
  public.device_sessions
TO authenticated, service_role;

-- anon: only public-readable surfaces (active announcements, commission plans)
GRANT SELECT ON public.commission_plans, public.announcements TO anon;

-- sequences used by handle_new_user
GRANT USAGE, SELECT ON SEQUENCE public.wallet_seq, public.trading_account_seq, public.ticket_seq
  TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 11 · Storage: private kyc-documents bucket + per-user policies
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Object key convention: '<user_id>/<doc_type>/<filename>'
-- Owner-only read/insert/delete; staff sees all via the catch-all.
DROP POLICY IF EXISTS "kyc-documents owners read"   ON storage.objects;
DROP POLICY IF EXISTS "kyc-documents owners insert" ON storage.objects;
DROP POLICY IF EXISTS "kyc-documents owners delete" ON storage.objects;
DROP POLICY IF EXISTS "kyc-documents staff all"     ON storage.objects;

CREATE POLICY "kyc-documents owners read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc-documents owners insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc-documents owners delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc-documents staff all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.is_staff())
  WITH CHECK (bucket_id = 'kyc-documents' AND public.is_staff());


COMMIT;

-- ============================================================================
-- END 20260528000001_giorapter_ecosystem_foundation.sql
-- ============================================================================
