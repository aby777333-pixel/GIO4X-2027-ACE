-- =============================================================================
-- GIO4X · 0021_portal_sections · who may open the sections that read the portal
-- =============================================================================
-- Twelve Service Console sections (KYC, Funds & Settlement, Fee Engine,
-- General Ledger, IB Network, Copy Trading, PAMM / MAM, Trade Log, Broker
-- Controls, Event Bus, Document Builder, Bulk Emailer) show records that live
-- in the client portal's database, not in this one. Control reads that
-- database on the server with the portal project's secret key
-- (src/lib/server/portal-db.ts). That key bypasses the portal's row-level
-- security, so the portal's database does not know who is asking: the decision
-- is made here, by the capabilities below, before the key is ever used.
--
-- This migration adds only those capabilities. It creates no table: none of
-- the portal's records are copied into this database.
--
--   kyc.read        KYC: clients' verification status and document records
--   funds.read      Funds & Settlement, Fee Engine, General Ledger
--   partners.read   IB Network, Copy Trading, PAMM / MAM
--   trading.read    Trade Log, Broker Controls
--   events.read     Event Bus
--   documents.read  Document Builder (the legal documents the portal publishes)
--   emailer.read    Bulk Emailer (the record of what was sent)
--
-- All seven are read capabilities. Nothing in Control writes to the portal's
-- database yet; when it does, each write gets its own capability and its own
-- audit entry in a later migration.
--
-- Who holds them:
--   admin       all seven
--   compliance  all seven (reads everything, changes nothing, as before)
--   finance     funds, partners, trading
--   dealing     trading
--   support     kyc, documents, emailer
--   sales       partners, emailer
--   agent, viewer: none (they see the sections' names, not their contents)
--
-- Re-runnable and additive.
-- =============================================================================

do $guard$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles r
    where r.rolname = current_user and (r.rolbypassrls or r.rolsuper)
  ) then
    raise exception
      'GIO4X migrations must be applied by a role with BYPASSRLS (on Supabase: postgres). Current role: %', current_user;
  end if;
end
$guard$;

insert into public.role_capabilities (role, capability) values
  ('admin', 'kyc.read'), ('admin', 'funds.read'), ('admin', 'partners.read'), ('admin', 'trading.read'),
  ('admin', 'events.read'), ('admin', 'documents.read'), ('admin', 'emailer.read'),
  ('compliance', 'kyc.read'), ('compliance', 'funds.read'), ('compliance', 'partners.read'), ('compliance', 'trading.read'),
  ('compliance', 'events.read'), ('compliance', 'documents.read'), ('compliance', 'emailer.read'),
  ('finance', 'funds.read'), ('finance', 'partners.read'), ('finance', 'trading.read'),
  ('dealing', 'trading.read'),
  ('support', 'kyc.read'), ('support', 'documents.read'), ('support', 'emailer.read'),
  ('sales', 'partners.read'), ('sales', 'emailer.read')
on conflict do nothing;
