> **This folder is the client/IB portal of the `GIO4X-2027-ACE` repository**, imported from
> `GIO4X-JUNE-2026` at commit `4c10a7f` (3 October 2026) without `apps/raptor`. It is served by the website
> at `/portal` (`basePath`), keeps its own database, and deploys as its own Netlify site with Base directory
> `portal`. See `../docs/PORTAL-GATEWAY.md`. Commands here: `npm install`, `npm run dev` (port 3100),
> `npm run build`. Paths below that mention the old repository layout are relative to this folder.

# GIO4X — June 2026

Unified workspace for GIO4X. Monorepo of independently deployable Next.js apps that share UI, Supabase client, and config.

## Layout

```
apps/
  portal/              GIO4X client/IB portal (Dashboard, Wallet, Deposits,
                       Withdrawals, Transfers, Copy Trading, PAMM, IB, KYC, signup)
  raptor/              GIORAPTOR trading terminal (charts/orders) — clients enter
                       here after KYC + account opening in portal
  crm/                 (planned) Internal CRM — migrated from GIOCRM + RAPTOR MAIN CRM
  dealer/              (planned) Dealer console — migrated from RAPTOR DEALER

packages/
  ui/                  Shared React components on GIO4X brand tokens
  supabase/            Typed Supabase client + shared DB types
  config/              Shared tsconfig, tailwind preset, eslint config

supabase/
  migrations/          Consolidated SQL migrations for project tdifcayznqnaduchzfqz
```

## Infrastructure

- **GitHub:** https://github.com/aby777333333-pixel/GIO4X-JUNE-2026
- **Supabase:** https://supabase.com/dashboard/project/tdifcayznqnaduchzfqz
- **Netlify:** one site per app (TBD as each app is deployed)

## Development

```bash
npm install                  # installs all workspace deps
npm run dev:portal           # GIO4X portal on http://localhost:3000
npm run dev:raptor           # GIORAPTOR terminal on http://localhost:3001
```

## Source projects being consolidated

| Source path                                          | Migrated into                       | Status        |
|------------------------------------------------------|-------------------------------------|---------------|
| (new) StarTrader-style Client/IB portal              | `apps/portal`                       | shipped       |
| `Documents/Gioraptor`                                | `apps/raptor`                       | shipped       |
| `Documents/GIO4X NEW`                                | `apps/portal` public routes (TBD)   | planned       |
| `Documents/RAPTOR BRAND NEW/RAPTOR MAIN CRM`         | `apps/crm`                          | planned       |
| `Documents/GIOCRM`                                   | merge into `apps/crm`               | planned       |
| `Documents/RAPTOR BRAND NEW/RAPTOR DEALER`           | `apps/dealer`                       | planned       |

The source projects remain untouched — this workspace only copies what's needed.
The standalone Gioraptor repo and its `dashing-hamster-0028ed.netlify.app` deploy
stay live as the canonical terminal until `apps/raptor` reaches deploy parity.
