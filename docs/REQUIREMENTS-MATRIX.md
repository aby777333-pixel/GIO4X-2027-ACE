# Requirements matrix

The master specification (thirteen directives, about 21,000 lines) mapped to what exists in this release.

Statuses: **IMPLEMENTED** · **PARTIAL** · **PLACEHOLDER** (designed, honest "not yet" state) ·
**NOT BUILT** · **N/A** · **BLOCKED: USER INPUT** · **BLOCKED: CREDENTIAL** · **BLOCKED: LEGAL** ·
**BLOCKED: EXTERNAL SERVICE**.

This matrix is deliberately blunt. The specification describes a programme of work far larger than one
release; the public website, its knowledge universe and a first backend slice are built, and the large
internal systems (CRM operating system, CMS, communications, generative AI) are not.

## I. Core rebrand and website

| Requirement | Status | Where / note |
|---|---|---|
| Inspect both repositories before building | IMPLEMENTED | Audit of GIO4X-NEW (39 URLs) and GIO4X (30 pages); findings in `WAITING-FOR-ABE.md`, `CONTENT-AUDIT*.md` |
| New design system with reusable tokens | IMPLEMENTED | `src/styles/tokens.css`, `tailwind.config.ts`, `docs/DESIGN-SYSTEM.md` |
| Golden-ratio system (spacing, type, grid, motion) | IMPLEMENTED | Fibonacci spacing, φ type scale, 61.8/38.2 grids, φ-stepped durations; overlay on `/design` |
| Colour with purpose, gold as accent only | IMPLEMENTED | Logo DNA palette + champagne prestige accent |
| Editorial display + clean UI typeface | IMPLEMENTED | TT Norms × Inter |
| Cinematic hero, not stock photography | IMPLEMENTED | Market Sphere (canvas): real centres, real hours, FX dial |
| Signature motif | IMPLEMENTED | Rosette (from the logo mark), DNA rule |
| Scroll choreography | PARTIAL | CSS view-timeline reveals, sticky story on Raptor; no WebGL sequences |
| "Wow" continuous globe → coordinates → Raptor narrative | NOT BUILT | Hero and Raptor chapter exist separately; the continuous transform was not attempted |
| Market data visual language, never fabricated | IMPLEMENTED | Reference / Indicative / Schedule / Simulation / Unavailable states with `DataNote` |
| Raptor as flagship product | IMPLEMENTED | `/platforms/raptor` (night chapter, five-beat story, interface tour) |
| Account types as a comparison experience | IMPLEMENTED | `/trading/accounts` |
| Trust architecture | IMPLEMENTED | `/trust/*` |
| Global presence without the glowing-map cliché | IMPLEMENTED | Market Sphere, World Market Clock, Day Ribbon |
| Microinteractions | IMPLEMENTED | Buttons, links, nav, focus states; one restrained hover system |
| Institutional navigation with mega-menu | IMPLEMENTED | `SiteHeader` (desktop mega-menu, mobile drawer) |
| Page architecture; no existing route removed | IMPLEMENTED | All 39 legacy URLs exist or redirect (`src/config/redirects.json`) |
| Homepage story with varied rhythm | IMPLEMENTED | `/` |
| Original graphics, no stock imagery | IMPLEMENTED | No photographs anywhere; SVG/canvas only |
| Responsive, mobile as its own composition | IMPLEMENTED | Swept at 390px: no overflow on 71 sampled routes |
| Performance | PARTIAL | Static generation, ~106 kB first-load JS, no third-party scripts. Lighthouse / Core Web Vitals not measured |
| Accessibility | PARTIAL | Semantic structure, keyboard, focus, reduced motion, text equivalents, contrast modes. No formal WCAG audit or screen-reader pass |
| SEO foundations | IMPLEMENTED | See section III |
| Content preserved, facts not invented | IMPLEMENTED | Audited import; held items logged |
| Premium forms | IMPLEMENTED | Contact and interest forms; document upload not built (no onboarding here) |
| Substantial footer with readable risk text | IMPLEMENTED | `SiteFooter`, incl. "Technology provided by 777 Raptor" |
| 404, error and loading states | IMPLEMENTED | `not-found.tsx`, `error.tsx`, `global-error.tsx`, `loading.tsx` |

## II. Financial digital universe

| Requirement | Status | Where / note |
|---|---|---|
| Market Command | IMPLEMENTED | `/markets` |
| Market Pulse | PARTIAL | ECB reference fixings board; no intraday pulse (no feed) |
| World Market Clock, Day Ribbon | IMPLEMENTED | `/markets/clock` |
| Asset Explorer and instrument pages | IMPLEMENTED | 34 pages; live price / bid-ask / day range are BLOCKED: EXTERNAL SERVICE |
| Asset-class personalities | IMPLEMENTED | Tone per class |
| Market heatmap | PARTIAL | Currency heat matrix only; other classes need data |
| Currency Strength Matrix | IMPLEMENTED | `/markets/currency-strength` |
| Correlation Lab | PARTIAL | Correlation matrix for the USD pairs from ECB fixings |
| Economic calendar | BLOCKED: EXTERNAL SERVICE | Honest "not connected" state; explainers built |
| Economic event detail pages | IMPLEMENTED | 7 events, without release values |
| Central Bank Watch | PARTIAL | 9 banks: institutional facts and primary sources; rates need a feed |
| Global rate map, Macro dashboard, Volatility centre, Movers | BLOCKED: EXTERNAL SERVICE | Not shown |
| Market hours & holidays | PARTIAL | Regular hours; holidays not modelled (stated) |
| Trader tools hub, shared values | IMPLEMENTED | `/tools`, 12 tools, `gx:calc` |
| Cost Lab | IMPLEMENTED | `/tools/cost-lab` |
| Glossary as a designed reference | IMPLEMENTED | 153 terms |
| GIO4X Intelligence publication | IMPLEMENTED | 11 audited articles, sections, RSS |
| Article experience | IMPLEMENTED | Progress, brief, contents, glossary links, share, cite, print |
| Interactive articles, Chart of the Day, Week Ahead, Market Recap | NOT BUILT | Need data and an editorial desk |
| Morning Brief | PARTIAL | `/morning-room` (sessions, fixings, reading; no events feed) |
| Academy with levels | IMPLEMENTED | 14 lessons, 8 modules, 2 paths |
| Visual learning demonstrations | IMPLEMENTED | Spread, leverage, drawdown, order anatomy, slippage simulation |
| Financial timelines | NOT BUILT | |
| Raptor Lab (docs, release notes, tutorials) | PLACEHOLDER | Marked "not yet published": BLOCKED: USER INPUT |
| Platform comparison | IMPLEMENTED | `/platforms/compare`, neutral |
| Security Centre, Transparency, Document Centre | IMPLEMENTED | `/trust/security`, `/trust/transparency`, `/legal` |
| Status page | PLACEHOLDER | `/status`: "Not monitored" |
| Help centre | PARTIAL | `/faq` (35 audited answers) |
| Smart search and command palette | IMPLEMENTED | `CommandBar`, `/search` |
| Personalisation, watchlist | PARTIAL | Local display preferences; watchlist not built |
| Dark and light experiences | IMPLEMENTED | |
| Day/night market state | IMPLEMENTED | Sphere faces the active region |
| Shareable graphics | IMPLEMENTED | Share cards per page; chart share images not built |
| Empty and loading states | IMPLEMENTED | |
| Source architecture (replaceable providers) | IMPLEMENTED | `src/lib/rates.ts` contract |
| Ten additional ideas | IMPLEMENTED | Lens, link verifier, "What we have chosen not to say", honest Transparency ledger, worked cost example, Source mode, φ grid overlay, 404 suggestions, privacy reset, `/llms.txt` |

## III. SEO, discovery and growth

| Requirement | Status | Where / note |
|---|---|---|
| Technical audit of the old site | IMPLEMENTED | Missing OG image, 10 URLs absent from sitemap, 4 pages without metadata, dead `?tab=` links: all corrected |
| robots.txt, crawler policy | IMPLEMENTED | `src/app/robots.ts` |
| Sitemap index + child sitemaps, real `lastmod` | IMPLEMENTED | 303 URLs |
| HTML sitemap | IMPLEMENTED | `/explore` |
| URL architecture, canonicals | IMPLEMENTED | `pageMeta()` |
| Redirect registry | IMPLEMENTED | 32 single-hop redirects |
| Structured data | IMPLEMENTED | Organization, WebSite, Breadcrumb, Article, DefinedTerm, FAQPage, SoftwareApplication |
| Titles, descriptions, Open Graph, X cards | IMPLEMENTED | |
| Dynamic social images | IMPLEMENTED | Articles, lessons, instruments, terms, tools |
| Glossary superstructure, internal linking, related content | IMPLEMENTED | Graph-driven |
| Pillar content and clusters | PARTIAL | Structure exists; new long-form writing not done |
| Author system | PARTIAL | Desk bylines only; no individuals verified |
| Editorial standards, corrections | IMPLEMENTED | `/trust/editorial-standards` |
| Search Console / Bing readiness | IMPLEMENTED | Env-driven verification tags |
| IndexNow | NOT BUILT | |
| llms.txt, RSS | IMPLEMENTED | |
| Newsletter | PARTIAL | Endpoint and table exist; no sign-up UI because nothing is sent yet (BLOCKED: EXTERNAL SERVICE: email) |
| Landing-page system, UTM handling | PARTIAL | UTM captured on forms; campaign pages not built |
| Analytics data layer, consent | PARTIAL | Consent-gated layer defined, inert; no banner needed while there are no trackers |
| Social sharing | IMPLEMENTED | Article share, native share |
| Video, podcast, web push, PWA | PARTIAL | Manifest and icons only |
| Security headers | IMPLEMENTED | `next.config.mjs` |
| Print stylesheet | IMPLEMENTED | |
| Lighthouse CI, broken-link monitoring | PARTIAL | `npm run audit:links`; no CI wired |
| International SEO | NOT BUILT | Architecture only (single locale) |

## IV. Dual platform ecosystem

| Requirement | Status | Where / note |
|---|---|---|
| Platforms navigation and gateway | IMPLEMENTED | `/platforms` |
| Raptor flagship, tour, five-beat story | IMPLEMENTED | Illustrative, captioned |
| Raptor markets, releases, features, docs, shortcuts, downloads, requirements | BLOCKED: USER INPUT | Rendered as "not yet published" |
| MetaTrader 5 page with respect for the trademark | IMPLEMENTED | Public MetaQuotes facts, sourced |
| MT5 downloads, server, GIO4X getting-started specifics | BLOCKED: USER INPUT | |
| Neutral comparison, finder, "what matters to you" | IMPLEMENTED | |
| Account × platform and market × platform matrices | PLACEHOLDER | BLOCKED: USER INPUT |
| Compatibility source of truth | IMPLEMENTED | `src/data/platforms.ts` (verified / unverified per fact) |
| `/verify` official links | IMPLEMENTED | `/trust/verify` |
| Platform status, demo, client area, first-login journey | NOT BUILT / BLOCKED | Depend on the portals |
| Risk Lab, leverage and drawdown visualisers, order types | IMPLEMENTED | Tools |
| Market Playground, news terminal, My GIO4X dashboard | NOT BUILT | Need data / accounts |

## V. Omnipresence, adaptive UI, experimental

| Requirement | Status | Where / note |
|---|---|---|
| Social registry, empty until supplied | IMPLEMENTED | `socials` in `destinations.ts` |
| Display modes Light / Dark / Auto | IMPLEMENTED | Ambient and Focus modes NOT BUILT |
| Accent palettes | IMPLEMENTED | Seven moods |
| Density, accessibility panel, reset | IMPLEMENTED | `/preferences`, header popover |
| Low-power / low-effects mode | IMPLEMENTED | `data-effects="low"` |
| Command palette syntax (`$`, `define:`, `calc:`, `verify:`) | IMPLEMENTED | |
| Keyboard shortcuts | PARTIAL | Ctrl/Cmd+K and `/` |
| Media Centre, Cite this page | IMPLEMENTED | |
| Privacy controls, "what is stored" | IMPLEMENTED | |
| Labs: Market Universe / Financial Constellation, Connect the Dots | IMPLEMENTED | |
| Labs: Time Machine, Macro Weather, Sonification, Research Canvas | NOT BUILT | Listed on `/labs` as concepts |
| Designing GIO4X, φ easter egg | IMPLEMENTED | `/design`, `φ` in the command bar |
| What's New | IMPLEMENTED | |
| Display / wallboard / event modes, widgets, embeds, public data API | NOT BUILT | |
| Distribution engine, link-opportunity records, QR engine | NOT BUILT | Internal tooling |
| i18n | NOT BUILT | |

## VI–VIII. AI universe, CMS, admin, CRM, communications

| Requirement | Status | Where / note |
|---|---|---|
| Find the existing admin first | IMPLEMENTED | None exists in either repository; staff tools live in a separate portal deployment |
| GIO4X Control | PARTIAL | First slice: staff sign-in, roles, leads inbox, notes, status, subscribers, CSV export, audit log |
| CRM operating system (pipelines, routing, segmentation, automation, tasks, appointments, Client 360) | NOT BUILT | |
| CMS for Intelligence / Academy | NOT BUILT | Content is typed data imported by `scripts/import-content.mjs` |
| SEO, campaign, social, newsletter command centres | NOT BUILT | |
| Communications hub, bulk email, voice control | NOT BUILT | |
| Live chat with human support | NOT BUILT | The old site bridged to the portal's chat tables; that bridge was not carried over (BLOCKED: CREDENTIAL) |
| GIO4X AI (generative, grounded, cited) | NOT BUILT | BLOCKED: CREDENTIAL. Commitments published at `/trust/ai` |
| Ask This Page / Lens | PARTIAL | Deterministic Lens: Explain, Related, Sources, Source mode |
| AI Site Concierge commands | PARTIAL | Command-bar display commands |
| Connect the Dots | IMPLEMENTED | Deterministic, from the graph |
| Admin AI tooling (doctors, guardians, digital twin, self-audit) | NOT BUILT | |
| Radio / Audio Lounge | NOT BUILT | Needs licensed streams |

## IX. Portal gateway

| Requirement | Status | Where / note |
|---|---|---|
| Portals unconnected, no guessed URLs | IMPLEMENTED | `destinations.ts`, `/sign-in`, `/open-account` |
| Central configuration, allow-listed hosts | IMPLEMENTED | |
| Verified Destination Registry and checker | IMPLEMENTED | `/trust/verify` |
| Portal URLs | BLOCKED: USER INPUT | |
| Portal health, SSO, context hand-off | NOT BUILT | Adapter points only |

## X. Fortress

| Requirement | Status | Where / note |
|---|---|---|
| Security headers and tailored CSP | IMPLEMENTED | No third-party scripts; `'unsafe-inline'` remains for Next.js bootstrap on static pages |
| Server-side authorisation, RLS tested | IMPLEMENTED | Direct read and forged insert with the publishable key refused |
| Input validation, mass-assignment protection, size limits | IMPLEMENTED | `src/lib/server/validate.ts` |
| Rate limiting, bot protection | PARTIAL | In-memory per instance + database throttle + honeypot + timing; no CAPTCHA/WAF |
| Open-redirect and SSRF protection | IMPLEMENTED | No redirects from input; verifier never fetches |
| Secrets management | IMPLEMENTED | No secret in the repository or client; publishable key only |
| Audit log, append-only | IMPLEMENTED | |
| MFA, passkeys, four-eyes approval, break-glass, session list | NOT BUILT | Recommended next steps in `SECURITY.md` |
| Threat model, security documentation | PARTIAL | `docs/SECURITY.md`; no incident-response or DR plan |
| Penetration test, dependency and secret scanning in CI | NOT BUILT | Manual secret scan done before the first push |
| Privacy centre, consent records | PARTIAL | Consent evidence stored with enquiries; `/preferences` |
| Legal documents versioned, professionally reviewed | BLOCKED: LEGAL | Carried over, marked "under legal review" |
| security.txt | BLOCKED: USER INPUT | Needs a confirmed security contact |

## XI. Process rules

| Rule | Status | Note |
|---|---|---|
| Inventory, gap analysis, phased plan | IMPLEMENTED | Audit, this matrix |
| Never invent business facts | IMPLEMENTED | |
| Type safety, no error hiding | IMPLEMENTED | `tsc` clean, lint clean |
| Happy and unhappy path tests | PARTIAL | Crawl audit (310 pages), browser sweep (71 routes × desktop, mobile, dark), form and endpoint tests. No automated unit/e2e suite |
| Cross-browser | NOT BUILT | Chrome only |
| Rollback plan, migrations versioned | IMPLEMENTED | `DEPLOY.md`, `supabase/migrations` |
| Documentation set | IMPLEMENTED | `docs/` |
| "Waiting for Abe" list | IMPLEMENTED | |
| Production deployment | BLOCKED: USER INPUT | Preview deployment only; production waits for section A of `WAITING-FOR-ABE.md` |

## XII–XIII. Divine proportion, logo DNA, the last 5%

| Requirement | Status | Where / note |
|---|---|---|
| Inter × TT Norms | IMPLEMENTED | Supplied TT Norms, Latin subset; licence to confirm |
| White/ivory flagship, "GIO4X after dark" | IMPLEMENTED | |
| Logo colours sampled from the asset, semantic roles | IMPLEMENTED | `tokens.css` header |
| Logo-derived signature light and motif | IMPLEMENTED | `.dna-light`, `.dna-rule`, Rosette |
| Market Universe, Financial Constellations | IMPLEMENTED | |
| Lens, Source Mode | IMPLEMENTED | Trust Mode folded into Source mode |
| Command bar with natural-language commands | PARTIAL | Navigation, search and display commands; no voice |
| Morning Room / Night Desk | PARTIAL | One page with a time-of-day greeting |
| World Market Clock, Day Ribbon | IMPLEMENTED | |
| Time Machine, On This Day, Research Canvas, What Changed? | NOT BUILT | Need licensed history |
| Market DNA, Connection Map | IMPLEMENTED | Instrument pages, graph |
| Visual calculators and visualisers | IMPLEMENTED | |
| Labs | IMPLEMENTED | |
| Designing GIO4X, φ easter egg | IMPLEMENTED | |
| 404 "This market doesn't exist", calm 500 | IMPLEMENTED | |
| Typo-tolerant, symbol-first search | IMPLEMENTED | |
| Official check / phishing shield | IMPLEMENTED | |
| Platform universe, MT5 respect | IMPLEMENTED | |
| Client journey and social placeholders, no `#` links | IMPLEMENTED | |
| Print styles | IMPLEMENTED | |
| Accessibility profile, low-power mode, privacy reset | IMPLEMENTED | |
| Media Centre, Trust Centre, Data methodology, AI transparency | IMPLEMENTED | |
| Company timeline, leadership, careers listings, partners | BLOCKED: USER INPUT | Nothing verifiable |
| Knowledge graph behind everything | IMPLEMENTED | 137 nodes, 436 relations |
| Pixel-polish, φ, typography, theme audits | PARTIAL | Contact-sheet review of 71 routes in three variants; not every one of 310 pages was inspected by eye |
