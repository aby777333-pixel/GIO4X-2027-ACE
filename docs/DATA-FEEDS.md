# Data feeds: live quotes and an economic calendar

Status: **prepared, not connected.** GIO4X has no licensed market-data feed and no
economic-calendar feed attached to this website. Nothing on the site simulates either, and this
document does not change that. It records exactly where each would plug in, what the owner has to
supply, and what the pages show until then.

Read with `docs/ARCHITECTURE.md` ("Data and its honesty", "Provider abstraction") and
`docs/DESIGN-SYSTEM.md` section 7.

## 1. What the site shows today

| Kind | Source | Where it comes from in the code | Label on the page |
|---|---|---|---|
| Daily FX reference fixings (eight currencies, about 100 days) | European Central Bank, through the Frankfurter API | `src/lib/rates.ts` (`getReferenceRates`, cached one hour) | Reference data, with the fixing date |
| Indicative trading conditions | GIO4X's own previously published figures | `src/data/instruments.ts`, `src/data/accounts.ts` | Indicative |
| Session and exchange-hour states | The visitor's own clock | `src/lib/sessions.ts`, `src/hooks/useNow.ts` | Schedule |
| Charts, quote panels, heat maps, ticker tape | TradingView frames, loaded on request | `src/components/markets/TradingViewChart.tsx`, `TradingViewWidget.tsx`, `MarketPanels.tsx` | Third-party content, attributed |
| Dated economic calendar | TradingView "events" frame, loaded on request | `EconomicCalendar` in `src/components/markets/MarketPanels.tsx`, used on `/markets/events` and `/morning-room` | Third-party content, attributed |
| Economic-event explainers | Written content, no dates | `econEvents` in `src/data/knowledge.ts` | Explainer |

Two consequences that matter here:

- **The TradingView frames are not a feed.** They are TradingView's own pages inside a sandboxed
  `<iframe>`. The site cannot read a price or a release time out of them, so it cannot build a
  ticker, an alert or a countdown from them.
- **There is no dated release in the repository.** `econEvents` deliberately carries no dates,
  forecasts or outcomes ("a wrong date is worse than none"), and the central-bank data carries no
  meeting dates. For that reason **no "next release" countdown was added** to `/markets/events`: a
  countdown needs a real, dated source, and none exists in the repository data. Each explainer
  links to its publisher's own calendar instead.

## 2. The provider contract

Every data service on the site follows the same shape, set by `src/lib/rates.ts`:

```ts
type Result<T> = ({ status: "ok" } & T) | { status: "unavailable"; reason: string };
```

Rules a new provider module must keep:

1. **Server only.** Fetch from a server component or route handler. Keys are read from
   `process.env` without the `NEXT_PUBLIC_` prefix and never reach the browser.
2. **Validate the payload at runtime** before using it, as `getReferenceRates` does. An unexpected
   shape is `unavailable`, not a guess.
3. **Never substitute.** No zeros, no last-known value presented as current, no fallback to an
   invented number. `unavailable` renders the designed unavailable state.
4. **Every number carries source, status and time.** Render through `<DataNote status source
   updated>` (`src/components/ui/Page.tsx`). A live figure needs a status of its own (see 3.4).
5. **The UI depends on the shape, not the vendor.** Components import types and helpers from the
   `src/lib/*` module; switching vendor is a change inside that module.

## 3. Live quotes

### 3.1 New module

`src/lib/quotes.ts`, beside `src/lib/rates.ts`:

```ts
export type Quote = { symbol: string; bid: number; ask: number; time: string /* ISO, from the provider */ };
export type Quotes =
  | { status: "ok"; asOf: string; delayed: boolean; delayMinutes: number; quotes: Record<string, Quote> }
  | { status: "unavailable"; reason: string };

export async function getQuotes(symbols: string[]): Promise<Quotes>;
```

`symbols` are the site's own (`symbol` in `src/data/instruments.ts`). The mapping from a GIO4X
symbol to the vendor's symbol lives in this module (a `providerSymbol` map), not in the data file.

### 3.2 Transport

- **Snapshot (recommended first):** a route handler `src/app/api/quotes/route.ts` that calls
  `getQuotes`, sets a short `s-maxage` (for example 5 to 15 seconds) and is rate limited with
  `src/lib/server` in the same way as the existing public endpoints. Pages fetch it from a small
  client hook (`src/hooks/useQuotes.ts`) and pause when the tab is hidden.
- **Streaming (later, if the licence allows redistribution of a stream):** a server-sent-events
  route. Do not open a browser connection straight to the vendor: it would expose the key and
  needs a `connect-src` entry in the CSP (`next.config.mjs`). Going through this site's own route
  needs no CSP change.

### 3.3 Where it would appear

| Page | File | What changes |
|---|---|---|
| Instrument page | `src/app/(site)/markets/[class]/[instrument]/page.tsx` | A bid / ask / spread panel above the indicative conditions, with its own note |
| Asset-class page | `src/app/(site)/markets/[class]/page.tsx` | A quote column in the instrument list |
| Market Command | `src/app/(site)/markets/page.tsx` | Majors with a live figure beside the ECB fixing (both kept, each labelled) |
| My desk watchlist | `src/components/desk/Desk.tsx` (`Watchlist`) | The "reference fixing" cell gains a quote for instruments the feed covers |
| Tools | `src/components/tools/ui.tsx` (`useConversion`) | Optional: prefill a price field. The ECB fixing stays the default for conversions |
| Morning Room | `src/app/(site)/morning-room/page.tsx` | Optional |

The practice desk (`/labs/simulator`) stays on invented prices. It is a simulation by design and
must not be wired to a feed.

### 3.4 Labelling

- Add a `live` status to `DataNote` only when a real feed is connected. Until then the word "live"
  must not appear on the site.
- A delayed feed is labelled `delayed` (the status already exists) with the delay in minutes.
- A quote older than its expected cadence is shown as unavailable, not as current.
- Prices from the feed are informational. Whether they are GIO4X's own dealing prices is a
  statement only the owner can make; until it is made in writing, the note says "indicative".

### 3.5 What the owner must supply

1. A **provider and a signed licence** that permits display on a public website (many retail data
   licences forbid redistribution). The licence terms decide delay, attribution wording and whether
   a stream may be relayed.
2. **Credentials** for the server environment (Netlify environment variables), for example
   `QUOTES_API_URL` and `QUOTES_API_KEY`. Never `NEXT_PUBLIC_`.
3. The **symbol list** and the mapping to the site's instruments, including which instruments are
   not covered.
4. The **required attribution and disclaimer text**, verbatim.
5. A decision on whether the figures are **GIO4X's own prices** (from the trading server or
   liquidity bridge) or a third-party reference, because the label differs.
6. Expected **cadence and session hours**, so that "stale" can be detected.

### 3.6 Until then

Nothing changes: ECB reference fixings with their date, indicative conditions labelled as such,
TradingView frames on request, and "Reference rates are temporarily unavailable" panels when the
ECB data cannot be loaded.

## 4. Economic calendar

### 4.1 New module

`src/lib/calendar.ts`:

```ts
export type Release = {
  id: string;
  /** slug of the explainer in src/data/knowledge.ts (econEvents), when there is one */
  event?: string;
  title: string;
  area: string;            // "United States", "Euro area", ...
  currency?: string;
  time: string;            // ISO 8601 in UTC, from the provider
  importance: "low" | "medium" | "high";
  previous?: string; forecast?: string; actual?: string;   // as published, never computed here
  source: { name: string; href: string };
};
export type Calendar = { status: "ok"; fetched: string; releases: Release[] } | { status: "unavailable"; reason: string };

export async function getCalendar(from: string, to: string): Promise<Calendar>;
```

Cached with `revalidate` (15 minutes is ample; release times move rarely but do move). The mapping
from a provider's event code to an `econEvents` slug lives in this module.

### 4.2 Where it would appear

| Page | File | What changes |
|---|---|---|
| Economic Events | `src/app/(site)/markets/events/page.tsx` | A dated list above the TradingView frame; the aside that says "GIO4X keeps no economic calendar of its own" is rewritten |
| Event explainer | `src/app/(site)/markets/events/[slug]/page.tsx` | "Next release" with its date, time and source, and the countdown described below |
| Morning Room | `src/app/(site)/morning-room/page.tsx` | Today's releases in place of, or above, the compact TradingView calendar |
| Central Bank Watch | `src/app/(site)/markets/central-banks/**` | Next meeting date, if the provider carries it |

**The countdown.** Server-render the release time as text in UTC (so the page is correct without
JavaScript), then let a client leaf using `src/hooks/useNow.ts` show "in 3 h 12 min" in the
visitor's chosen time zone (`tz` in `gx:prefs`). It must show the source and the time it was
fetched, switch to "released" or "awaiting figures" after the time passes, and disappear, not
guess, when the calendar is unavailable. No countdown is rendered from hand-entered dates.

### 4.3 What the owner must supply

1. A **calendar provider and licence** permitting display (forecast and consensus figures are often
   licensed separately from dates and actual values).
2. **Server credentials**, for example `CALENDAR_API_URL` and `CALENDAR_API_KEY`.
3. The **countries and importance levels** to show (today's TradingView frame uses the United
   States, euro area, United Kingdom, Japan, Switzerland, Australia, Canada, New Zealand and China).
4. **Attribution text**, and whether forecast figures may be shown at all.
5. A named person who is told when the feed fails, since a silent stale calendar is the worst case.

### 4.4 Until then

`/markets/events` keeps its explainers without dates, the publishers' own calendars as links, and
TradingView's dated calendar as a frame the visitor loads. No countdown.

## 5. Checklist for whoever connects either feed

- [ ] Licence read; redistribution, delay and attribution confirmed in writing.
- [ ] Module in `src/lib/` with the `ok | unavailable` contract and runtime validation.
- [ ] Keys in server environment only; `.env.example` updated with empty placeholders.
- [ ] Any new outbound host added to `approvedThirdParties` in `src/config/destinations.ts` and, if
      the browser must reach it, to the CSP in `next.config.mjs` (prefer not to: proxy through a
      route handler).
- [ ] `DataNote` on every module, with status, source and time; unavailable state designed.
- [ ] `/trust/data-methodology`, `docs/ARCHITECTURE.md`, `docs/DESIGN-SYSTEM.md` section 7 and
      `/llms.txt` updated to describe the new source.
- [ ] Rate limiting on any new route handler; no visitor data sent to the provider.
- [ ] The feed switched off in a preview deploy to confirm every page still reads correctly.
