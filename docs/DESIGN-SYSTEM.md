# GIO4X Design System

> INTER × TT NORMS · φ = 1.618 · IVORY × GRAPHITE × CHAMPAGNE · LOGO DNA
>
> Light is the flagship ("the private-wealth office at 10 AM"). Dark is the same building at 10 PM.
> Nothing random, nothing cheap, nothing desperate, nothing out of proportion.

This is the working reference for anyone (human or AI) adding a page or component. If something here
conflicts with a quick idea, this document wins.

## 1. Where things live

| What | Where |
|---|---|
| Colour, motion, density tokens (CSS variables) | `src/styles/tokens.css` |
| Base styles + component classes (`.btn`, `.h1`, `.panel`, `.table-gx`, …) | `src/styles/globals.css` |
| Tailwind mapping of tokens (spacing, type scale, colours) | `tailwind.config.ts` |
| Page primitives (`PageHero`, `SectionHead`, `Breadcrumbs`, `DataNote`, `NextSteps`, `SpecList`, `EmptyState`) | `src/components/ui/Page.tsx` |
| Data primitives (`Change`, `Sparkline`, `RangeBar`) | `src/components/ui/Data.tsx` |
| Signature motif | `src/components/brand/Rosette.tsx` |
| Logo (always the supplied asset) | `src/components/brand/Logo.tsx` |
| Home sequence chart (invented prices, labelled as such; reads a candle under the pointer) | `src/components/home/SequenceChart.tsx`, `sequence-chart-data.ts` |
| Metadata builder | `src/lib/meta.ts` (`pageMeta`) |
| Structured data builders | `src/lib/schema.ts` + `src/components/seo/JsonLd.tsx` |
| Organisation facts | `src/config/site.ts` |
| Navigation / IA (header, footer, sitemap, search all read this) | `src/config/nav.ts` |
| Verified destination registry (portals, socials, approved third parties) | `src/config/destinations.ts` |
| Legal strings carried over verbatim | `src/config/legal.ts` |

## 2. Logo DNA palette

Sampled from the supplied logo (`docs/brief/gio4x-logo-source.png`):

| Role | Raw DNA | Light token | Dark token |
|---|---|---|---|
| Market Blue (the "4") → **brand / information** | `#0870B8` | `--brand #0868AA` | `#4BA6E2` |
| Emerald (the "X") → **positive / success** | `#089040` | `--emerald #067636` | `#3FB872` |
| Teal (rosette mid-tone) → **secondary accent** | `#00A098` | `--teal #00807A` | `#35C2B8` |
| Platinum (the "GIO") → **secondary information** | `#A0A8A8` | `--platinum` | `--platinum` |
| Champagne metal → **prestige only** (numerals, rare rules) | — | `--prestige #B39C6B` | `#CDB98A` |

Neutrals are the stage: `--bg` (warm ivory `#F6F4EE`), `--paper`, `--surface`, `--surface-2`, `--sunken`;
text `--ink`, `--ink-2`, `--ink-3`; lines `--line`, `--line-strong`.
Market semantics: `--pos`, `--neg`, `--neutral`, `--info`, `--warn`.
`--accent` follows the visitor's mood palette (GIO4X, Ivory, Midnight, Ocean, Emerald, Royal, Mono) and
defaults to brand blue. Use `--accent` for interactive emphasis so palettes work.

Rules:
- **Never hard-code a colour** in a component. Use Tailwind token classes (`text-ink-2`, `bg-paper`,
  `border-line`, `text-accent`, `text-pos`) or `var(--token)`.
- Colour is never the only signal. Direction uses ▲ ▼ ◆ and a sign (`<Change/>`); states use shape + label (`.state`).
- Champagne is an accent of authority. If you are using it more than once per screen, remove one.
- Backgrounds never respond to price direction.
- The "night" surface (`.on-night`) is for the footer and deliberate dark chapters (Raptor) in both themes.
  Inside `.on-night` the same token classes automatically resolve to their night values.

## 3. φ spacing, type and layout

**Spacing is a Fibonacci scale.** The Tailwind class number is the pixel value:
`p-5 p-8 p-13 p-21 p-34 p-55 p-89 p-144` (also `1 2 3`). There is no `p-4`, `p-6`, `p-10`, `gap-12` — they do
not exist in this config. For an optical exception use an arbitrary value (`mt-[0.4rem]`) and keep it rare.

**Type scale** (`text-xs 12 · sm 14 · base 16 · md 18 · lg 21 · xl 26 · 2xl 34 · 3xl 43 · 4xl 55 · 5xl 70 · 6xl 89`).
Prefer the semantic classes:

| Class | Use |
|---|---|
| `.display` | homepage hero only |
| `.h1` | page title (one per page) |
| `.h2` | section title |
| `.h3` | sub-section, list row title |
| `.h4` | small heading, card/row heading |
| `.lead` | the paragraph under a title |
| `.eyebrow` | small caps line above a title (draws its own accent rule) |
| `.label` | micro label for groups, table heads |
| `.num` | any number (tabular figures) |
| `.prose-gx` | long-form reading (68ch measure) |

TT Norms (`font-display`) is for brand moments and headings only; Inter (`font-sans`) is for everything
functional. Heading tags are chosen for document structure, classes for size: an `<h2>` may carry `.h3`.

**Layout**
- `.wrap` = page gutters + 1320px composition bound. Every section's content sits in a `.wrap`.
- `.section` (large) / `.section-quiet` (small) give vertical rhythm. Vary them; not every section is the same height.
- `.phi` = 61.8 / 38.2 grid from `lg` up; add `.phi-r` to reverse. Rotate the split according to the story.
  Also `lg:grid-cols-phi`, `lg:grid-cols-phi-r`, `aspect-phi`.
- `.hairline` / `.hairline-b` for section separators. Alternate `bg-bg` and `bg-paper` for chapter rhythm.
- Breakpoints: `sm 560 · md 820 · lg 1080 · xl 1320 · 2xl 1720`. Design mobile as its own composition
  (rails that scroll and snap, tables in `.scroll-x`, re-ordered content), not a shrunken desktop.
- Radius is restrained: `rounded-xs 2px · rounded-sm 3px · rounded 5px · rounded-md 8px`. No pills except
  true toggles.

**Card discipline.** Before making a card ask "does this need a card?" Usually not. Prefer: typographic
rows with hairlines, `border-l border-t` grids with `border-b border-r` cells, definition lists (`SpecList`).
Use `.panel` / `.panel-quiet` only for a real object (a tool, a form, a figure). No three identical cards in a row.

## 4. Components (class API)

```
Buttons   .btn + .btn-primary | .btn-accent | .btn-ghost | .btn-quiet   sizes: .btn-sm .btn-lg
Links     .link (accent, underline grows)  .link-quiet  .go (label + travelling rule; uppercase)
Forms     .field > label + .input | .select | .textarea ; .field-hint ; .field-error ; .check ; input.range ; .seg (segmented)
Data      .table-gx (wrap in .scroll-x) ; .chip ; .state .state-open|.state-pre|.state-overlap|.state-off
Surfaces  .panel ; .panel-quiet ; .glass ; .on-night ; .grid-field ; .dna-light ; hr.dna-rule
Motion    data-reveal on an element (+ style={{"--i": n}} for stagger) ; .skeleton
```

React primitives (import from `@/components/ui/Page`):

```tsx
<PageHero crumbs={[{name:"Markets",href:"/markets"},{name:"Forex",href:"/markets/forex"}]}
          eyebrow="Markets" title="Forex" lead="…" aside={<…/>} quiet? night?>
  <Link className="btn btn-primary" …/>            {/* optional actions */}
</PageHero>
<SectionHead eyebrow="…" title="…" lead="…" action={<Link className="go" …/>} />
<DataNote status="reference|schedule|indicative|simulation|unavailable|delayed" source="…" sourceHref="…" updated="…">note</DataNote>
<SpecList rows={[{label:"Spread from", value:"0.1 pips", note:"indicative"}]} />
<NextSteps items={[{label, href, note, kind}]} />     {/* 1–4 considered next steps: no dead ends */}
<EmptyState title="…" actions={…}>…</EmptyState>
```

Every page: `export const metadata = pageMeta({ title, description, path })`, exactly one `<h1>` (PageHero
provides it), breadcrumbs for anything below the top level, and a `NextSteps` or equivalent at the end.
Do **not** wrap pages in `<main>`: the root layout already does.

## 5. Motion

Durations step by φ: `100 · 160 · 260 · 420 · 680 · 1100 ms` (`duration-instant|fast|DEFAULT|slow|reveal|cinematic`),
easing `ease-out` = `cubic-bezier(.22,.61,.36,1)`. Use those tokens; no stray `duration-300`.
Motion must explain something (a state change, a relationship, a reveal of hierarchy). No bouncing, wobbling,
pulsing CTAs, confetti, parallax for its own sake. Everything must look finished with motion off:
`prefers-reduced-motion`, `[data-motion="reduced"]` and `[data-effects="low"]` are all honoured globally;
canvas scenes must draw one static frame in those modes and pause when off-screen or hidden.

**First view** (`src/components/fx/MicroFx.tsx`, one IntersectionObserver for the page):

- `data-count` on an element whose only content is a number (`<span className="num" data-count>1,320</span>`)
  makes it count up from zero, once, when it scrolls into view. The markup holds the real value, so
  with no script or with motion off it is simply the number. **Only for a constant written in the
  page** (a count of things, a year, a size). Never for a market value, a reference rate, an indicative
  condition or anything that updates: section 7 applies. The script refuses anything inside
  `aria-live`, `.table-gx` or `data-live`.
- Every `<Sparkline/>` draws itself from the left on first view; `data-draw` on any small figure does
  the same, `data-draw="stroke"` on an SVG traces each path along its length, `data-draw="off"` opts out.
  The shape never changes, only when it appears.

**Press.** `.btn:active` sinks 1px (`depth.css`) and, with a mouse or pen, sends a ring of light from the
point pressed (`pointer.css`). Do not add another press effect.

**Theme: Light, Dark, Auto, Sun.** "Sun" (`src/components/fx/sun.ts`) is light by day and dark by night,
estimated from the device's clock, date and time zone only: no location request, no network. It is one
extra field, `sun`, inside `gx:prefs`; the visitor's Light / Dark / Auto choice stays underneath it.
Nothing changes for a visitor who has not chosen it. Components keep reading `data-theme`.

## 6. The signature

`<Rosette/>` is the eight-blade pinwheel from the logo mark, redrawn procedurally with φ-related radii.
It appears, quietly, in: loaders (`spin`), empty states (fewer `blades`), the 404 (seven blades: one
missing), the footer watermark, page heroes without an aside, and the command bar. It is never a substitute
for the logo. `hr.dna-rule` (teal → blue → emerald hairline) opens a chapter; use it at most once per page.

## 7. Data honesty (non-negotiable)

GIO4X does not have a licensed live market-data feed connected to this site. Therefore:

- **Never** render an invented price, spread, rate, forecast, statistic, count, award, testimonial,
  uptime figure, regulator, partner, or "live" label.
- The only market numbers on the site are (a) **ECB daily reference fixings** via `src/lib/rates.ts`
  (label: Reference data), (b) GIO4X's own previously published **indicative trading conditions** from
  `src/data/instruments.ts` / `src/data/accounts.ts` (label: Indicative), (c) **schedules** computed from
  the visitor's clock via `src/lib/sessions.ts` (label: Schedule), (d) the visitor's own inputs in tools
  (label: Simulation / worked example), and (e) third-party **TradingView** chart iframes, attributed.
- Every data module carries a `<DataNote/>` with status, source and date.
- If data cannot be loaded, show an intentional unavailable state. Never zeros, never yesterday's value as today's.
- Explanatory, never predictive: "commonly monitored", "can be sensitive to". No buy/sell language, no
  signals, no scores of trading skill, no "best", "leading", "fastest", "guaranteed".
- Product names: **GIO4X**, **777 Raptor**, **MetaTrader 5** (abbrev. MT5), **The Gentleman's Brokerage House**.
  MetaTrader 5 is a trademark of MetaQuotes; never imply ownership and never rank it below Raptor.
- Portals (Client / Trader / IB / account opening) are **UNCONFIGURED**. Never link to a guessed URL; use
  `/sign-in` and `/open-account`, which read `src/config/destinations.ts`.
- Social links: render nothing until the registry is filled.

## 8. Accessibility baseline

Semantic landmarks and headings; every interactive element reachable and operable by keyboard with a
visible focus ring (built in); labels on every control; `aria-live="polite"` for values that update;
tables have `<caption>` (may be `.sr-only`) and `scope`; charts and canvases have a text equivalent;
touch targets ≥ 44px on mobile; contrast AA in both themes and in high-contrast mode; no information by
colour alone; no autoplaying audio or video, ever.

## 9. Writing

Short, calm, specific. British English. No exclamation marks, no emoji, no "unlock", "revolutionary",
"best-in-class", "seamless", "cutting-edge". Say what a thing is, then why it matters, then where to go
deeper. In JSX text use real characters (’ “ ” – … ×), never `\u` escapes (they are not processed in JSX
text or attribute strings; inside `{"…"}` JavaScript strings they are fine).
