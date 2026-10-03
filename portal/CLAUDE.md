# CLAUDE.md — GIO4X portal (imported from GIO4X-JUNE-2026) Working Agreement

> **Where this lives now.** This is the `portal/` folder of `GIO4X-2027-ACE`, imported on 3 October 2026
> without `apps/raptor`. Repository, local path and deploy notes in sections 1 and 2 describe the old
> repository; what replaces them: the app runs under `basePath` `/portal` behind the website's proxy
> (`../docs/PORTAL-GATEWAY.md`), `npm run dev` here serves port 3100, and raw paths (next/image `src`,
> `<a href>`, `window.location`, absolute URLs) must go through `apps/portal/src/lib/base-path.ts`.
> The hard rules in section 3 still apply.

> Persistent rules for any agent working in this repo. Read this fully before
> touching code. These rules override convenience. When in doubt, STOP and ask.

---

## 1. WHAT THIS REPO IS

Unified GIO4X workspace — a monorepo of independently deployable Next.js apps that
share UI, a typed Supabase client, and config. Brand: GIO4X navy/cyan,
"The Gentleman's Forex Broker."

- **GitHub:** https://github.com/aby777333-pixel/GIO4X-JUNE-2026
- **Local:** `C:\Users\GIO4X\Documents\GIO4x JUNE 2026`
- **Supabase project:** `tdifcayznqnaduchzfqz`
- **Netlify (portal, current):** https://zippy-piroshki-21aa30.netlify.app/

### Layout — respect exactly, do not restructure

Two brands, two roles. **GIO4X** is the client/IB portal (website + sign-in + KYC
+ account opening + IB views). **GIORAPTOR** is the trading terminal users
enter *after* their formalities are done in the portal.

```
apps/
  portal/      GIO4X client/IB portal (Dashboard, Wallet, Deposits, Withdrawals,
               Transfers, Copy Trading, PAMM, IB, KYC, signup) [PRIMARY — in progress]
  raptor/      GIORAPTOR trading terminal (charts + orders)    [IMPORTED — Next 16/React 19/TW4]
  crm/         Internal CRM                                    [PLANNED]
  dealer/      Dealer console                                  [PLANNED]
packages/
  ui/          Shared React components on GIO4X brand tokens
  supabase/    Typed Supabase client + shared DB types
  config/      Shared tsconfig, tailwind preset, eslint config
supabase/
  migrations/  Consolidated SQL migrations for tdifcayznqnaduchzfqz
```

Note: `apps/portal` runs Next 14 + React 18 + Tailwind 3. `apps/raptor` was
imported from the standalone Gioraptor repo on its own stack (Next 16 + React 19
+ Tailwind 4) and is intentionally NOT yet wired into `packages/*`. Stack
convergence is a future Phase D task — until then, treat the two apps as
independent within the shared workspace.

---

## 2. STACK — DO NOT DEVIATE

- TypeScript **strict** (repo is 99%+ TS). No `any` on public boundaries.
- Next.js **App Router**.
- Supabase: Postgres + Auth (PKCE) + RLS + Storage + Realtime.
- **npm workspaces.** One root lockfile. Never introduce yarn/pnpm or a second lockfile.
- Netlify: one site per app.

### Commands
```
npm install            # root only — installs all workspace deps
npm run dev:portal     # GIO4X portal → http://localhost:3000
npm run dev:raptor     # GIORAPTOR terminal → http://localhost:3001
npm run build          # must pass for any app you touch, before any checkpoint
npm run deploy:portal  # build → patch Windows paths → deploy to zippy-piroshki
```

### Netlify deploy notes — read before deploying
- **Default path: `git push origin main`.** `apps/portal` deploys
  automatically. Mechanism:
    1. `.github/workflows/deploy-portal.yml` fires on push to main and POSTs
       to a Netlify build hook (URL in repo secret `NETLIFY_PORTAL_BUILD_HOOK`).
    2. Netlify clones the repo via SSH deploy key (added 2026-05-28; the
       Netlify GitHub App is NOT installed for this org, so a key + the
       Actions-driven webhook are what makes auto-deploy work).
    3. Build runs on Linux containers — no Windows path bug.
- **Fallback: manual local deploy from Windows** via `npm run deploy:portal`.
  Only needed if Actions / Netlify build is broken and you must ship now.
  This script runs `netlify build → node scripts/patch-netlify-handler-paths.mjs
  → netlify deploy --prod --no-build --skip-functions-cache` because
  `@netlify/plugin-nextjs` writes Windows backslash paths into the Lambda
  handler when built on Windows (every route then 502s with
  `Cannot find package 'ar\taskappsportal'`). The patcher rewrites to POSIX.

---

## 3. HARD RULES (non-negotiable)

1. **Additive only.** Never break existing `apps/portal` or `apps/raptor` routes,
   components, auth, or schema. You extend; you do not replace.
2. **Migrations are immutable.** One timestamped migration per unit of work, with a
   rollback note in the header comment. Never edit a committed migration; write a new one.
3. **Money is `NUMERIC`, never float.** All balance changes happen server-side via
   `SECURITY DEFINER` functions, are idempotent (idempotency key), and are audited.
   No client ever writes a balance directly.
4. **RLS on every table, default deny.** Users access only their own rows; staff/admin
   access is scoped via `profiles.role`.
5. **Secrets via env only.** The service-role key must NEVER appear in a client bundle.
   Keep `.env.example` current. Never commit real keys.
6. **Shared code lives in `packages/*` and is imported.** No copy-paste between apps.
7. **Brand tokens from `packages/ui` only.** No hardcoded hex anywhere.
8. **Mobile-responsive** by default on every screen.

---

## 4. HOW TO WORK — PHASES & CHECKPOINTS

Work in phases. Never attempt the whole system in one pass. After each phase, STOP
and wait for an explicit "go." At every checkpoint, output:

1. Inventory / diff summary
2. New & changed file paths
3. New migration names
4. How to test locally
5. Risks I should review

Phase order of record:
- **A** — Audit & schema foundation (no UI)
- **B** — Authentication suite (apps/portal)
- **C** — Post-login onboarding & dashboard (apps/portal)
- **D** — Connected modules (apps/raptor stack convergence, crm, dealer, finance, marketing, security)

The first action in any fresh session is to re-read this file and the current state
of `apps/portal`, `apps/raptor`, `packages/*`, and `supabase/migrations` before
proposing changes.

---

## 5. DATA MODEL SOURCE OF TRUTH

Canonical tables (see migrations for authoritative DDL):
`profiles`, `crm_profiles`, `wallets`, `wallet_transactions`, `kyc_documents`,
`trading_accounts`, `ib_relationships`, `commission_plans`, `commission_ledger`,
`referrals`, `support_tickets`, `ticket_messages`, `notifications`, `announcements`,
`audit_logs`, `login_history`, `device_sessions`.

Provisioning trigger `handle_new_user()` creates, atomically, on signup:
profile → crm_profile → main wallet → referral code.

Connectivity chain that must always hold:
```
Website → Auth → CRM profile → Wallet → Raptor Platform → IB → Support → Admin → Analytics
```

---

## 6. ADAPTERS — KEEP INTEGRATIONS SWAPPABLE

Wrap all external dependencies behind typed interfaces so providers can change
without touching feature code:
- **SMS/OTP** → `packages/supabase/sms.ts` (stub provider first)
- **Payments** → fiat + crypto behind a single payment adapter interface
- **Market data + order execution** (platform) → typed adapter, stub before live feed

---

## 7. DEFINITION OF DONE (per change)

- [ ] Additive; nothing existing broken
- [ ] Migration timestamped + rollback note; not editing a prior migration
- [ ] RLS written and tested (default deny)
- [ ] Money paths server-side, idempotent, audited
- [ ] Types regenerated into `packages/supabase`
- [ ] `npm run build` passes for touched app
- [ ] No secrets committed; `.env.example` updated if envs changed
- [ ] Mobile-responsive; brand tokens only
