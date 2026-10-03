# Waiting for Abe

Everything the build needs from the owner before it can be published or connected. Nothing on this list
has been guessed. Each item says where the answer goes, so supplying it is a configuration change, not a rebuild.

## A. Decisions that block publishing statements

| # | Question | Why it is open | Where the answer goes |
|---|---|---|---|
| A1 | **Which legal entity contracts with clients?** | The newer site says "GIO4X, a subsidiary of 777 Capital Markets Limited (UK), Company No. 17049134" (Ruislip, London). The older site says "Reg. No. 15807, Hamchako, Mutsamudu, Anjouan, Union of Comoros", also labelled "St. Lucia", and names "GIO4X Forex Limited". This build carries the newer statement verbatim and nothing else. | `src/config/site.ts`, `src/config/legal.ts` |
| A2 | **Regulatory status: regulator, licence number, register link.** | Both old sites say "regulated / licensed" many times and never name an authority. A UK company number is a Companies House registration, not an FCA authorisation. The new site makes **no** regulatory claim and says so on the Transparency page. | `site.regulation` in `src/config/site.ts`; Trust Centre pages |
| A3 | **Are UK and US residents accepted?** | The old site excludes both; the newer list of 36 restricted jurisdictions (carried over) does not, while naming a UK parent. | `restrictedJurisdictions` in `src/data/accounts.ts` |
| A4 | **Retail-loss percentage** for the risk warning. | Two different figures were published (75% and 63.21%), neither sourced. None is shown. | `src/config/legal.ts`, `/legal/risk` |
| A5 | **Negative balance protection: yes or no?** | Both old sites promise it and also say "you may lose more than your initial investment". Not stated on the new site. | `/trust/client-funds`, `/legal/terms` |
| A6 | **Is MetaTrader 5 offered, on which servers, for which accounts?** | Your brief says MT5 × 777 Raptor. The newer site said Raptor only; the older one mentioned MT4/MT5. The MT5 page describes the platform itself (public MetaQuotes facts) and marks every GIO4X-specific detail "not yet published". | `src/data/platforms.ts` |
| A7 | **Is 777 Raptor "proprietary / built in-house"?** | The old site says so; its own source code says "GIO4X is a client of GIORAPTOR". The new site says: "Technology provided by 777 Raptor", as you instructed. | `/platforms/raptor` |
| A8 | **Final legal documents** (Terms, Privacy, AML, Risk, Cookie notice, complaints procedure, execution policy). | The four existing documents are short and are carried over verbatim (minus unverifiable sentences, logged in `docs/CONTENT-AUDIT-LEGAL.md`), each marked "under legal review". Professional legal review is required. | `src/data/legal-docs.ts` |

## B. Destinations (all currently UNCONFIGURED: nothing links to a guessed URL)

| # | Item | Notes | Where it goes |
|---|---|---|---|
| B1 | Client Portal URL | The old code pointed at `zippy-piroshki-21aa30.netlify.app` (a Netlify preview host) and, before that, `client.icareforex.com`. Neither is on an official domain, so neither is linked. | env `CLIENT_PORTAL_URL` |
| B2 | Trader Portal URL | The old "terminal" was `dashing-hamster-0028ed.netlify.app/terminal`. | env `TRADER_PORTAL_URL` |
| B3 | IB Portal URL | | env `IB_PORTAL_URL` |
| B4 | Account-opening URL | Until supplied, `/open-account` collects a "register your interest" enquiry instead. | env `ACCOUNT_OPENING_URL` |
| B5 | Hosts those portals live on (e.g. `portal.gio4x.com`) | A destination is only honoured if it is https and on `gio4x.com` or a host listed here. | env `NEXT_PUBLIC_OFFICIAL_PORTAL_HOSTS` |
| B6 | Platform download links (Raptor desktop/mobile, MT5 server details) | No download links existed on either old site. | `src/data/platforms.ts` |
| B7 | Official social profiles | Old site: Facebook profile id 61565834445070, LinkedIn company 105476920, a YouTube channel id. Newer site: assumed `/gio4x` handles. Neither set verified, so none is shown. | `socials` in `src/config/destinations.ts` |

Since 3 October 2026 the portal is served by this site at `/portal`, so B1–B4 resolve there without any of
these variables; they are needed only to send a destination to a different address. Still needed from the
owner: add `<site origin>/portal/auth/callback` to the portal's Supabase Auth redirect URLs, and decide when
the portal's sign-in requirement (`AUTH_ENFORCE`) is switched on.
See `docs/PORTAL-GATEWAY.md` for the security checklist to run before any of B1–B5 is switched on.

## C. Contact and operations

| # | Item | Notes |
|---|---|---|
| C1 | Telephone number | Old sites carried placeholders (`+91 1111 1111 11111`). One plausible number (`+91 416 355 1652`) is tied to the legacy "icareforex" brand. None is published. |
| C2 | Support hours | 24/7 and 24/5 were both claimed. Not published. |
| C3 | Official mailboxes | `info@`, `support@`, `security@`, `privacy@`, `careers@gio4x.com` appear in the old code. The site uses `info@gio4x.com` as the public contact and `careers@` on Careers. Please confirm which exist and are monitored; a `security.txt` will be published once `security@` is confirmed. |
| C4 | Office list | Only the Ruislip head office and the Chennai support office (address given by the owner on 2 October 2026) are shown (the only two with addresses). Dubai, Singapore, Johannesburg and the Indian city list were unverified. |
| C5 | Genuine job openings | Eight roles were listed on the old site; not carried over. |
| C6 | Leadership names and biographies | Four executives were named on the old site; not carried over. |

## D. Trading facts with conflicts (shown conservatively or omitted)

| # | Topic | What the old sites said | What the new site does |
|---|---|---|---|
| D1 | Maximum leverage | 1:500, 1:1000, 200/400/500 by account, 1:100 on ECN, 1:2000 on PAMM | "Up to 1:500" per account; per-instrument values as published in the newer site's tables, labelled indicative |
| D2 | Spreads | Classic 2.5 vs 1.2; Premium 1.5 vs 0.5; ECN 0.2 vs 0.0 | The values both account pages agree on: 2.5 / 1.5 / 0.2 |
| D3 | Stop out | 30% vs 20% vs 50% | 30% (both account pages) |
| D4 | Swap-free | ECN only vs all accounts on request | ECN "swap-free" as on both account pages; nothing promised for the others |
| D5 | Funding: methods, fees, processing times, cut-off | Free vs $25 wire vs 1–4.5%; 7 AM vs 1 PM IST | Not published; "confirmed in your client area" |
| D6 | Instrument count | 200+, 300+, 500+, 1,000, 5,000 | The 34 instruments actually listed |
| D7 | Copy trading / PAMM fees and provider counts | 10% vs 10–30%; one vs many providers | Not published |
| D8 | IB rebates and payouts | $10 / $12 / $15 per lot; daily / weekly / monthly | Not published |
| D9 | Demo account terms | 30 days; $100,000 virtual funds | Not published |
| D10 | Verification time | 15 minutes vs 1–2 business days vs 12 business hours | Not published |
| D11 | Swap rates, commission schedule beyond ECN, execution policy, liquidity providers | Not available | Listed as "not yet published" on `/trust/transparency` |

## E. Claims found on the old sites and deliberately not carried forward

"Since 2012" (also 2022, 2023, 2024) · US$5.55B daily volume · 25K+ traders · 50+/100+ countries · $500M+ client funds
protected · tier-1 banks · professional indemnity insurance · external audits · "award-winning" · sub-10 ms execution
(also 12, 30, 40 ms) · Equinix LD4/NY4/TY3 · 99.99% uptime · "no requotes" · FIX 4.4 API · 100+ indicators ·
$10M+ paid to partners · the PAMM "leaderboard" (hard-coded sample data) · three testimonials · blog bylines
"David Chen" and "Sarah Mitchell" · 35% / 40% bonuses and prize contests · "certified by MetaQuotes" ·
Raptor Intelligence (EMIL, ABIN, Lara and the agent counts) · the synthetic "live" spreads, sentiment and ticker.

If any of these can be evidenced, send the evidence and it will be added with its source.

## F. Services and credentials

| # | Item | Purpose |
|---|---|---|
| F1 | Production domain confirmation (`https://www.gio4x.com` is assumed as canonical) | `NEXT_PUBLIC_SITE_URL` |
| F2 | Licensed market-data provider (quotes, economic calendar, policy rates) | Replaces the "unavailable" states; adapters are in `src/lib/rates.ts` and the Market pages |
| F3 | Approved analytics tool and consent wording | The data layer in `src/lib/analytics.ts` is ready and inert |
| F4 | AI provider key and approved knowledge sources | GIO4X AI is deliberately not live; see `/trust/ai` |
| F5 | Email sending domain (SPF, DKIM, DMARC) | Needed before any newsletter or auto-reply is offered |
| F6 | First administrator for GIO4X Control | Create the user in Supabase Auth, then run the one-line SQL in `docs/CONTROL.md` |
| F7 | TT Norms web-font licence confirmation | The supplied TT Norms files are served as Latin-subset WOFF2 from this repository, which is public on GitHub. Please confirm the licence covers web embedding, or make the repository private. |
| F8 | Google Search Console / Bing Webmaster verification tokens | `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` |

## G. Platform screenshots (added 2 October 2026)

Five of the six screenshots supplied are published on `/platforms`, `/platforms/raptor` and
`/platforms/metatrader-5` (files in `public/platforms/`, captions in `src/data/platform-shots.ts`). Each is
captioned as a demo-account screenshot. Open points:

| # | Item | Why it is open |
|---|---|---|
| G1 | The MT5 "devices" image (laptop and two phones with the MT5 logo) is **not** published | The browser bars in it show another broker's address (`xbzbroker.com`), and it carries the MetaTrader 5 logo and browser logos. Send a version with a GIO4X address, or MetaQuotes' own artwork, and it goes on the MT5 page. |
| G2 | The two MetaTrader 5 terminal screenshots are MetaQuotes material | Confirm GIO4X's MetaQuotes licence covers using their screenshots, or replace them with captures of a GIO4X terminal. |
| G3 | The Raptor workspace screenshot shows a CNBC video tile and a news headline | Third-party marks inside a product screenshot. A capture with that panel closed would be cleaner. |
| G4 | The EMIL and hedging panels are shown, not described | Section E still applies: Raptor Intelligence is not described until its documentation is approved. The EMIL capture shows a directional lean, a trade plan and a win rate from the demo; the caption says so, but a capture without them would sit better beside "no signals" on `/trust/ai`. |
