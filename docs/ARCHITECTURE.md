# Architecture

## Shape of the codebase

```
src/
  app/                    routes (App Router). One folder per URL segment.
    layout.tsx            fonts, theme boot script, header, footer, command bar, Lens, org JSON-LD
    page.tsx              homepage
    markets/ trading/ platforms/ tools/ intelligence/ academy/ glossary/ faq/ labs/
    about/ careers/ media/ contact/ trust/ legal/ design/ whats-new/ explore/ status/
    sign-in/ open-account/                portal gateway (UNCONFIGURED by default)
    search/ preferences/                  utilities (noindex)
    control/                              GIO4X Control (staff only, dynamic, noindex)
    api/contact, api/newsletter           the only public write endpoints
    sitemap.xml + sitemap-*.xml           sitemap index and children
    search-index.json, graph.json         static JSON for search / Lens / Labs
    robots.ts manifest.ts llms.txt opengraph-image.tsx not-found.tsx error.tsx global-error.tsx
  components/
    shell/        header, footer, command bar, Lens, appearance, reveal, 404 suggestions
    brand/        Logo (supplied asset), Rosette (signature)
    ui/           Page primitives, Data primitives
    market/       MarketSphere (hero canvas), SessionStrip
    home/ markets/ platforms/ trading/ tools/ knowledge/ company/ trust/ labs/ control/
  config/         site facts, navigation/IA, destination registry, legal strings, redirect registry
  data/           typed content: instruments, accounts, knowledge (currencies, banks, events),
                  glossary, tools, platforms, articles, academy, faqs, books, legal docs, graph
    generated/    JSON produced by scripts/import-content.mjs from the audited legacy content
  lib/            rates (market-data service), sessions (schedule engine), search, search-index,
                  prefs, meta, schema, sitemap, og, analytics
    supabase/     browser + server clients (publishable key only)
    server/       request validation, rate limiting
  hooks/          useNow, usePrefs
  styles/         tokens.css (design tokens), globals.css (base + component classes)
  fonts/          TT Norms (Latin subset WOFF2; OTF subsets for share cards)
supabase/migrations/      SQL: tables, RLS policies, triggers
scripts/                  import-content.mjs, audit-links.mjs
docs/                     this folder
```

## Rendering strategy

| Kind of page | Strategy |
|---|---|
| Institutional, legal, trust, academy, glossary, tools, labs, platform pages | Static (built once) |
| Instrument, asset-class, article, lesson, term, bank, event pages | Static via `generateStaticParams`; unknown slugs call `notFound()` and return a real 404. (`dynamicParams = false` is deliberately not used: it makes prerendered dynamic routes 404 on the Netlify runtime.) |
| Pages showing ECB reference fixings (`/`, `/markets`, pairs, currency strength, converter tools, Morning Room) | Static with `revalidate = 3600` |
| Time-dependent UI (sessions, clocks, greeting) | Server renders a neutral state; the client fills it from the visitor's clock (`useNow`) so nothing server-rendered is ever presented as "now" |
| `/control/**` | Dynamic, authenticated, `private, no-store`, `noindex` |
| `/api/contact`, `/api/newsletter` | Node route handlers, `no-store` |

Client JavaScript is confined to leaf components (`"use client"`): header, command bar, Lens, appearance,
market sphere, clocks, tools, graph views, forms. Content is always in the server-rendered HTML.

## Data and its honesty

There is one rule: a number is on the site only if it has a source, a status and a date.

| Status | What | Module |
|---|---|---|
| Reference | ECB daily euro reference fixings (via the Frankfurter API), cached 1 h | `src/lib/rates.ts` |
| Indicative | GIO4X's previously published trading conditions | `src/data/instruments.ts`, `src/data/accounts.ts` |
| Schedule | Session and exchange-hour states computed from the device clock | `src/lib/sessions.ts` |
| Simulation | Calculations on the visitor's own inputs | `src/components/tools/*` |
| Third-party chart | TradingView iframe, loaded on request, attributed | `src/components/markets/*` |
| Unavailable | A designed state. Never zeros, never stale values | everywhere |

**Provider abstraction.** UI components depend on the shapes exported by `src/lib/rates.ts`
(`ReferenceRates`, `crossRate`, `crossChange`, `crossSeries`, `strength`, `correlation`), not on the provider.
To connect a licensed feed, implement the same shape in a new module and switch the import; add new
services (economic calendar, policy rates, news) beside it with the same `ok | unavailable` contract.
External payloads are validated at runtime before use.

## The knowledge graph

`src/data/graph.ts` derives nodes and typed edges from the data modules (instruments, currencies, central
banks, events, glossary concepts, tools, platforms). It powers the Market Universe, Connect the Dots,
Market DNA / related links and the Lens "Related" view (through `/graph.json`). Relations are curated and
explanatory ("is quoted in", "is issued by", "is commonly watched with"); none is predictive.

## Search

`src/lib/search-index.ts` builds one index at build time from navigation and data, served as
`/search-index.json`. `src/lib/search.ts` is the engine shared by the command bar, `/search` and the 404
suggestions: symbol normalisation, aliases, typo tolerance (Damerau–Levenshtein), prefixes (`$EURUSD`,
`define:`, `calc:`, `verify:`), display commands ("switch dark mode") and a φ easter egg.
Search-result pages are `noindex`.

## Preferences and privacy

Display preferences (theme, accent, density, motion, contrast, text size, effects, underline links, time
zone) live only in `localStorage` (`gx:prefs`) and are applied to `<html data-*>` by an inline boot script
before first paint. There are no advertising scripts and no third-party analytics. The site counts
its own page views, accepted forms and searches as daily totals with no cookie and no identifier
(`src/lib/pulse.ts`, `docs/SECURITY.md` section 11; switch: `countVisits` in `gx:prefs`). Separately, `src/lib/analytics.ts` defines a
consent-gated event vocabulary that is inert until an approved tool is attached. `/preferences` lists every
key the site stores and clears them in one action.

## Portal gateway

See `docs/PORTAL-GATEWAY.md`. `src/config/destinations.ts` is the only place an outbound sign-in,
registration or platform destination can come from, and it is UNCONFIGURED by default.

## Security

See `docs/SECURITY.md`. In short: strict security headers and CSP from `next.config.mjs` (no third-party
scripts), no secrets in the client, the Supabase publishable key only, row-level security as the boundary,
insert-only public writes with validation, honeypot, timing check and rate limits, authenticated and
role-checked staff console.

## Feature switches

Everything optional degrades to a designed state rather than a broken one:

| If this is unavailable | The site shows |
|---|---|
| ECB data provider | "Reference rates are temporarily unavailable" panels; tools ask for a manual rate |
| JavaScript | All content, static session placeholders, no command bar or Lens |
| Canvas / reduced motion / low effects | A single static frame; all text content unaffected |
| Supabase | Forms fail gracefully with the contact email; `/control` says "Not configured" |
| TradingView | The chart frame is simply not loaded (it is opt-in per page view) |
| Portal URLs | "Not connected yet" gateway states |
