-- ============================================================================
-- 20260528000003_deposit_funding_sources.sql
-- ============================================================================
-- Purpose: Make the /deposits page DB-driven instead of JSX-hardcoded.
--   - deposit_bank_accounts  : the wire / NEFT / SEPA destinations GIO4X
--                              publishes to clients funding their wallets.
--   - deposit_crypto_addresses: per-network deposit addresses (TRC20, ERC20,
--                              BTC, ETH, USDC, BNB, …).
--
-- Access model:
--   - Both tables are public reference data — anon + authenticated can SELECT
--     active rows so the /deposits page renders for signed-out visitors too.
--   - Only admins (is_admin()) may INSERT / UPDATE / DELETE.
--   - Default-deny RLS; per-operation policies grant what's allowed.
--
-- Grants (per the 2026-10-30 public-schema grant flip on this project):
--   - SELECT to anon, authenticated
--   - ALL to authenticated (gated by RLS to admins only)
--   - service_role keeps implicit access
--
-- Seeds: ports the values currently hardcoded in apps/portal's deposits page.
--   - SWIFT / Wire     → GIO4X Ltd. @ Standard Chartered UAE
--   - INR NEFT / RTGS  → GIO4X Payments @ ICICI Bank
--   - Crypto: USDT TRC20 active; ERC20/BTC/ETH/USDC/BNB pre-populated but
--             is_active=false so admin can fill the address then flip them on.
--
-- Rollback:
--   DROP TABLE public.deposit_crypto_addresses;
--   DROP TABLE public.deposit_bank_accounts;
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- deposit_bank_accounts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deposit_bank_accounts (
  id                  uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  region              text NOT NULL,                          -- 'SWIFT', 'INR', 'SEPA'
  label               text NOT NULL,                          -- 'SWIFT / Wire', 'India (NEFT / RTGS)'
  beneficiary         text NOT NULL,
  bank                text NOT NULL,
  swift_code          text,
  iban                text,
  ifsc                text,
  account_number      text NOT NULL,
  reference_template  text NOT NULL DEFAULT 'GIO4X-{wallet}',
  notes               text,
  is_active           boolean NOT NULL DEFAULT true,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dep_bank_active_idx  ON public.deposit_bank_accounts (is_active, sort_order);

DROP TRIGGER IF EXISTS deposit_bank_updated_at ON public.deposit_bank_accounts;
CREATE TRIGGER deposit_bank_updated_at BEFORE UPDATE ON public.deposit_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();


-- ----------------------------------------------------------------------------
-- deposit_crypto_addresses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deposit_crypto_addresses (
  id                  uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  network             text UNIQUE NOT NULL,                   -- 'USDT TRC20', 'USDT ERC20', 'BTC', 'ETH', 'USDC', 'BNB'
  symbol              text NOT NULL,                          -- 'USDT', 'BTC', 'ETH', …
  address             text NOT NULL,
  min_confirmations   integer NOT NULL DEFAULT 1 CHECK (min_confirmations >= 0),
  min_amount_usd      numeric(20,8) NOT NULL DEFAULT 10 CHECK (min_amount_usd >= 0),
  warning             text,
  is_active           boolean NOT NULL DEFAULT false,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dep_crypto_active_idx ON public.deposit_crypto_addresses (is_active, sort_order);

DROP TRIGGER IF EXISTS deposit_crypto_updated_at ON public.deposit_crypto_addresses;
CREATE TRIGGER deposit_crypto_updated_at BEFORE UPDATE ON public.deposit_crypto_addresses
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();


-- ----------------------------------------------------------------------------
-- RLS — default deny; explicit per-operation policies below.
-- ----------------------------------------------------------------------------
ALTER TABLE public.deposit_bank_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_crypto_addresses  ENABLE ROW LEVEL SECURITY;

-- Bank accounts: anyone can read active rows; only admins can write.
DROP POLICY IF EXISTS bank_select_active ON public.deposit_bank_accounts;
CREATE POLICY bank_select_active ON public.deposit_bank_accounts
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS bank_admin_read_all ON public.deposit_bank_accounts;
CREATE POLICY bank_admin_read_all ON public.deposit_bank_accounts
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS bank_admin_insert ON public.deposit_bank_accounts;
CREATE POLICY bank_admin_insert ON public.deposit_bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS bank_admin_update ON public.deposit_bank_accounts;
CREATE POLICY bank_admin_update ON public.deposit_bank_accounts
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS bank_admin_delete ON public.deposit_bank_accounts;
CREATE POLICY bank_admin_delete ON public.deposit_bank_accounts
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Crypto addresses: same pattern.
DROP POLICY IF EXISTS crypto_select_active ON public.deposit_crypto_addresses;
CREATE POLICY crypto_select_active ON public.deposit_crypto_addresses
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS crypto_admin_read_all ON public.deposit_crypto_addresses;
CREATE POLICY crypto_admin_read_all ON public.deposit_crypto_addresses
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS crypto_admin_insert ON public.deposit_crypto_addresses;
CREATE POLICY crypto_admin_insert ON public.deposit_crypto_addresses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS crypto_admin_update ON public.deposit_crypto_addresses;
CREATE POLICY crypto_admin_update ON public.deposit_crypto_addresses
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS crypto_admin_delete ON public.deposit_crypto_addresses;
CREATE POLICY crypto_admin_delete ON public.deposit_crypto_addresses
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ----------------------------------------------------------------------------
-- Grants (explicit per 2026-10-30 public-schema grant flip)
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.deposit_bank_accounts    TO anon, authenticated;
GRANT SELECT ON public.deposit_crypto_addresses TO anon, authenticated;
-- writes go through RLS-gated policies; grant the verbs but RLS limits to admins.
GRANT INSERT, UPDATE, DELETE ON public.deposit_bank_accounts    TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.deposit_crypto_addresses TO authenticated;


-- ----------------------------------------------------------------------------
-- Seeds — current hardcoded values from apps/portal/src/app/deposits/page.tsx
-- ----------------------------------------------------------------------------
INSERT INTO public.deposit_bank_accounts
  (region, label, beneficiary, bank, swift_code, iban, ifsc, account_number, reference_template, sort_order)
VALUES
  ('SWIFT', 'SWIFT / Wire', 'GIO4X Ltd.',     'Standard Chartered, UAE', 'SCBLAEADXXX', NULL, NULL, '0210448122001', 'GIO4X-{wallet}', 10),
  ('INR',   'India (NEFT / RTGS)', 'GIO4X Payments', 'ICICI Bank',         NULL,          NULL, 'ICIC0000001', '000105588421', 'GIO4X-{wallet}', 20)
ON CONFLICT DO NOTHING;

INSERT INTO public.deposit_crypto_addresses
  (network, symbol, address, min_confirmations, min_amount_usd, is_active, sort_order)
VALUES
  ('USDT TRC20', 'USDT', 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', 1,  10,  true,  10),
  ('USDT ERC20', 'USDT', '0x0000000000000000000000000000000000000000', 12, 25, false, 20),
  ('BTC',        'BTC',  'bc1q00000000000000000000000000000000000000', 3,  25, false, 30),
  ('ETH',        'ETH',  '0x0000000000000000000000000000000000000000', 12, 25, false, 40),
  ('USDC',       'USDC', '0x0000000000000000000000000000000000000000', 12, 10, false, 50),
  ('BNB',        'BNB',  '0x0000000000000000000000000000000000000000', 15, 10, false, 60)
ON CONFLICT (network) DO NOTHING;

COMMIT;
