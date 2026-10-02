# The cockpit

The owner's direction for the visual layer: GIO4X should feel like a precision financial
instrument the visitor steps into. Private-jet cockpit, institutional terminal, engineered
glass and metal, light that comes from real components. Premium, calm, trustworthy. Never a
game, never science fiction, never decoration for its own sake: every light and every motion
serves navigation, hierarchy, understanding, trust or atmosphere.

This document describes how that is built, so it can be extended without breaking it.

## The parts

| Part | Where | What it does |
|---|---|---|
| The stage | `PageHero` in `src/components/ui/Page.tsx`, `.cx-*` in `src/styles/cockpit.css` | Every page opens with the same night stage at the same height (`--hero-h`), statement on the left, that page's instrument on the right. |
| The instruments | `src/components/cockpit/scenes/*.ts` | One small 3D scene per page family, drawn on a single Canvas 2D surface. |
| The engine | `src/components/cockpit/engine.ts`, `kit.ts` | Camera, palette, frame loop, power-on ramp, adaptive quality; the shared parts (deck, glass panes, rings, traces, lamps). |
| The route map | `src/components/cockpit/routes.ts` | Which scene a path opens with, and the page's own subject (`tag`). |
| The overhead panel | `header[data-site-header]` rules in `cockpit.css` | The site header as night switchgear: backlit keys that rise, light and press. |
| Touch | `src/components/cockpit/CockpitFx.tsx`, section 3 of `cockpit.css` | Tiles answer the pointer with light and a few degrees of tilt; sections arrive with depth on scroll. |
| The start-up | `src/components/cockpit/Boot.tsx`, `src/lib/boot.ts`, section 4 of `cockpit.css` | A power-on under two seconds, first visit only. |

No dependency was added. There is no WebGL: the scenes are a few kilobytes each of Canvas 2D
drawing code with a hand-written perspective camera, loaded as separate chunks after first paint.

## One height for every page

`--hero-h` is `clamp(30rem, 100svh − header − 4.5rem, 60rem)`: the first viewport minus the
header, leaving a strip of the page in view. `PageHero`, the homepage hero, the Intelligence
masthead, the article and lesson header and the 777 Raptor header all use `.cx-hero`, so the
stage is the same height on every page.

Two honest exceptions, both content-driven:

- A pane of content beside the statement (`aside`) that is taller than the stage makes that one
  stage taller. Today this happens only on short viewports.
- Below the desktop layout the `aside` leaves the stage and follows it as its own block, so the
  stage itself keeps its height on phones and tablets.

`/search` and the not-found page have no stage: they are tools, and their content is the first
thing on the page by design.

## Adding or changing a scene

A scene is one file exporting `{ pose, setup?, draw }`. Read `engine.ts` (the `Frame` type is the
whole API) and `kit.ts`, then the two reference scenes `forex.ts` and `raptor.ts`.

1. Create `src/components/cockpit/scenes/<id>.ts`.
2. Register it in `scenes/index.ts` and map its paths in `routes.ts`.
3. A page can override the route's choice with `<PageHero scene="...">`.

Rules every scene follows:

- **Honesty first.** A scene is an illustration. No prices, rates, percentages or volumes; no
  symbol beside a chart-like shape; nothing that claims a live status. It may show what is simply
  true (names, codes, geography) and what `src/lib/sessions.ts` computes from the visitor's clock
  (which venues are inside regular hours, the FX session windows). This is the same rule as the
  rest of the site: see `docs/WAITING-FOR-ABE.md`.
- **Tokens only.** Colours come from `f.pal`, which is read from the design tokens. `pal.key` is the
  key light; champagne (`pal.gold`) marks the page's own subject.
- **The statement owns the left.** Keep the instrument inside the box described in `engine.ts`;
  the canvas is masked toward the statement, but do not rely on the mask. A wide instrument reads
  `f.clear` (where the headline ends, measured) and fits itself to the right of it, as `conditions.ts` does.
- **Calm.** Rotations take minutes, pulses seconds. Nothing blinks.
- **A complete still.** Under reduced motion or "low visual effects" exactly one frame is drawn at
  `scene.pose`. It must stand on its own.
- **Cheap.** Counts scale with `f.q`; phones draw less (`f.mobile`). No `shadowBlur`.

## Key light follows the trading day

`CockpitFx` writes the region with the most venues inside regular hours to `<html data-session>`
(`asia`, `europe`, `americas` or `off`), from the visitor's clock and the regular timetable. The
stage, the header keys and every scene take their key light from it (`--cx-key`, `pal.key`). It is
a schedule, not a data feed, and nothing on screen says otherwise.

## Progressive by construction

- Without JavaScript: the stage, the header and the page are complete; there is no canvas.
- Reduced motion (`prefers-reduced-motion` or the site preference): one still frame per scene, no
  start-up, no tilt, no scroll arrival.
- Low visual effects (site preference): the same, and no glass blur.
- A failed chunk or no canvas support: the lit stage stands on its own behind the headline.
- Off-screen and hidden tabs: the frame loop stops. Slow devices: resolution and detail drop
  automatically; phones run at 30 frames a second.
- Print: the stage prints as plain paper (legal documents stay printable).

## The start-up

Shown once per browser, never under reduced motion or low effects. The flag is `gx:boot` in
localStorage; it is listed with every other key in the Cookie & Storage Notice and cleared by the
privacy reset on `/preferences`. The sequence is CSS and ends by itself, so it cannot block the
site; any key, click, touch or wheel ends it at once. Its four lamps are the site's sections coming
up, not connection claims.

## Sound

There is none, and nothing autoplays. If an opt-in sound layer is ever wanted, the hook is
described at the top of `CockpitFx.tsx`: controls are ordinary buttons and links, so a listener
for `pointerdown` on `.btn`, `[data-nav]` and `[role="switch"]` is all it needs. It must default
to off.

## Tiles and rows (`depth.css`)

- A grid of tiles that is really one control or one table opts out with the class `flat`.
- Ledger rows (`li.border-b.border-line`) are padded so that nothing sits under their tone bar;
  a cell that is already a tile is not a row.
- The cycling tone is `--dt` / `--dt-b`. It is not called `--tone`: the Markets pages use `--tone`
  for the asset-class colour.

## Local development

Node 24 loads `tailwind.config.ts` natively as an ES module, where `__dirname` does not exist;
the error takes `next dev` down a few routes in. Start the dev server with native type stripping
off (this is what `.claude/launch.json` does):

```bash
node --no-experimental-strip-types node_modules/next/dist/bin/next dev
```

Node 22 (the version Netlify builds with) is not affected.
