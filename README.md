# GIO4X: The Gentleman's Brokerage House

The public website, knowledge universe and internal console for GIO4X.
MetaTrader 5 × 777 Raptor · Inter × TT Norms · φ = 1.618 · logo DNA.

> Technology provided by [777 Raptor](https://www.777raptor.com/).

## What this is

| Area | Routes |
|---|---|
| Home | `/` |
| Markets | `/markets` (Market Command), `/markets/{class}`, `/markets/{class}/{instrument}`, `/markets/clock`, `/markets/currency-strength`, `/markets/central-banks`, `/markets/events` |
| Trading | `/trading`, `/trading/accounts`, `/trading/conditions`, `/trading/funding`, `/trading/copy-trading`, `/trading/pamm`, `/partners`, `/partners/money-managers` |
| Platforms | `/platforms`, `/platforms/raptor`, `/platforms/metatrader-5`, `/platforms/compare` |
| Trader Toolkit | `/tools` and twelve calculators / visualisers |
| Intelligence | `/intelligence`, `/intelligence/{slug}`, `/intelligence/feed.xml`, `/morning-room` |
| Academy | `/academy`, `/academy/{slug}`, `/academy/books`, `/glossary`, `/glossary/{term}`, `/faq` |
| Labs | `/labs`, `/labs/market-universe`, `/labs/connect-the-dots` |
| Company | `/about`, `/about/why-gio4x`, `/about/what-we-are`, `/careers`, `/media`, `/contact`, `/design`, `/whats-new`, `/explore` |
| Trust | `/trust`, `/trust/verify`, `/trust/security`, `/trust/client-funds`, `/trust/transparency`, `/trust/data-methodology`, `/trust/ai`, `/trust/editorial-standards`, `/status` |
| Legal | `/legal`, `/legal/terms`, `/legal/risk`, `/legal/privacy`, `/legal/aml`, `/legal/cookies` |
| Gateways | `/sign-in`, `/open-account` (lead to the portal: see `docs/PORTAL-GATEWAY.md`) |
| Portal | `/portal/**`: the client and IB portal and its staff console. A separate application in `portal/`, proxied by this site |
| Utility | `/search`, `/preferences`, 404, error pages, command bar (Ctrl/Cmd+K), GIO4X Lens |
| Internal | `/control` (GIO4X Control: staff sign-in, leads, subscribers, audit log) |
| Machine | `/sitemap.xml` (+ seven child sitemaps), `/robots.txt`, `/llms.txt`, `/manifest.webmanifest`, `/search-index.json`, `/graph.json` |

Every URL of the previous site still resolves: see `src/config/redirects.json`.

## Stack

- **Next.js 15** (App Router, React 19, TypeScript strict). Almost every page is statically generated;
  reference rates revalidate hourly.
- **Tailwind CSS 3** as a thin mapping over CSS-variable design tokens (`src/styles/tokens.css`).
- **Supabase** (Postgres + Auth) for enquiries, subscribers and the staff console. Row-level security is
  the security boundary; the site only ever uses the publishable key.
- **No runtime UI dependencies**: charts, the market sphere, the knowledge-graph views and all tools are
  hand-written SVG / Canvas. Third-party charts are TradingView iframes loaded on request.
- Hosting: **Netlify** (`netlify.toml`, `@netlify/plugin-nextjs`).

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev                  # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run audit:links` | crawl a running instance: status codes, one `<h1>`, title, description, canonical, anchors, placeholder links, sitemap consistency (`-- --external` also checks outbound links) |
| `node scripts/import-content.mjs` | re-import the audited editorial content |

## Environment variables

See `.env.example`. In short:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | yes (prod) | canonical origin, no trailing slash |
| `NEXT_PUBLIC_SITE_ENV` | yes (prod) | only `production` is indexable; anything else is `noindex` with a disallow-all robots.txt |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | for forms and Control | browser-safe; RLS is the control |
| `PORTAL_ORIGIN` | no | address of the portal's own deployment; `/portal` is proxied to it. Set in `netlify.toml` |
| `CLIENT_PORTAL_URL`, `TRADER_PORTAL_URL`, `IB_PORTAL_URL`, `ACCOUNT_OPENING_URL`, `NEXT_PUBLIC_OFFICIAL_PORTAL_HOSTS` | no | only to send a destination somewhere other than `/portal` |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` | no | search-console verification |

No secret is required to build or run the public site. Never commit `.env.local`.

## Documentation

| Document | Contents |
|---|---|
| `docs/DESIGN-SYSTEM.md` | tokens, logo DNA palette, φ spacing and type, components, motion, data honesty, writing |
| `docs/ARCHITECTURE.md` | folders, data flow, rendering strategy, data-provider abstraction, search, graph, SEO |
| `docs/SECURITY.md` | threat model, RLS policy table, headers and CSP, rate limiting, what is not built yet |
| `docs/CONTROL.md` | GIO4X Control: first admin, roles, lead flow, migrations |
| `docs/PORTAL-GATEWAY.md` | how the portal in `portal/` is attached at `/portal`, and how destinations are configured |
| `docs/SEO.md` | metadata, canonicals, sitemaps, structured data, redirects, indexing policy |
| `docs/DEPLOY.md` | environments, build, deploy, rollback, post-deploy checks |
| `docs/CONTENT-AUDIT.md`, `docs/CONTENT-AUDIT-LEGAL.md` | what was carried over from the previous sites, what was held and why |
| `docs/REQUIREMENTS-MATRIX.md` | the master specification mapped to implementation status |
| `docs/WAITING-FOR-ABE.md` | everything that needs the owner's input |

## Principles that are enforced, not just stated

1. **Nothing fabricated.** No invented prices, statistics, awards, testimonials, regulators or "live" labels.
   Every number carries its source, status and date.
2. **Portals are never guessed.** One registry, environment-driven: this site's own `/portal`, or allow-listed hosts only.
3. **The site works with everything optional switched off:** JavaScript reveals, canvas scenes, third-party
   charts, the data provider, Supabase.
4. **Light is the flagship, dark is the same building at night**, and both pass AA contrast.
