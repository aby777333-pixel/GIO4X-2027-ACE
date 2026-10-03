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
| The instruments | `src/components/cockpit/scenes/*.ts` | One small 3D scene per page (66 of them), drawn on a single Canvas 2D surface. Every page in the menus has its own; only pages generated from data (an instrument, a term, a lesson, an article, a calculator) share their family's scene and pass their subject as `tag`. The four tools under "See it move" each have their own (`spread`, `leverage`, `drawdown`, `order`); the canvas carries the scene's name as `data-scene`. Each scene answers the pointer in its own way. |
| The engine | `src/components/cockpit/engine.ts`, `kit.ts` | Camera, palette, frame loop, power-on ramp, adaptive quality; the shared parts (deck, glass panes, rings, traces, lamps). |
| The route map | `src/components/cockpit/routes.ts` | Which scene a path opens with, and the page's own subject (`tag`). |
| The overhead panel | `header[data-site-header]` rules in `cockpit.css` | The site header as night switchgear: backlit keys that rise, light and press. |
| Touch | `src/components/cockpit/CockpitFx.tsx`, section 3 of `cockpit.css` | Tiles answer the pointer with light and a few degrees of tilt; sections arrive with depth on scroll. |
| The start-up | `src/components/cockpit/Boot.tsx`, `src/lib/boot.ts`, section 4 of `cockpit.css`, section 2 of `transition.css` | First visit only. On the homepage: the intro, the logo forming from particles and handing over to the hero. On any other page: a power-on under two seconds. |
| Page to page | `src/components/cockpit/StageTransition.tsx`, `stage.ts`, section 1 of `transition.css` | Between two pages that both open with a stage, the old instrument turns into the new one instead of cutting. |

No dependency was added. There is no WebGL: the scenes are a few kilobytes each of Canvas 2D
drawing code with a hand-written perspective camera, loaded as separate chunks after first paint.

One exception, at the owner's request: the band "Technology provided by 777 Raptor" on
`/platforms/raptor` runs the owner's pen THE BREACH (`src/components/platforms/RaptorBreach.tsx`,
`breach/scene.ts`, `src/styles/breach.css`). An orb detonates, the 777 Raptor logo is born from the
flash, cools, and flies out of the screen at the viewer; then it loops. It uses Three.js (WebGL), the
project's only such dependency. The library is fetched only when that band comes near the viewport, and
only on that page. Under reduced motion, low visual effects, no WebGL or a failed load, the still logo is
shown instead. It was ported from the 777 Raptor site, where the changes from the pen are recorded
(DECISIONS.md, 48).

## The frame, and the pointer

Every instrument is drawn inside a **golden rectangle** (1.618 : 1) and clipped to it, so nothing runs
under the headline or off the stage. From 1080px the frame is the right-hand 52% of the content column and
the statement keeps to the left 46%; below that it stands at the top of the stage and the statement
begins under it. The engine computes it (`f.box`), draws its champagne hairline, corner marks and the
golden cut on its long sides, and places the scene's focal point at its centre. A scene cannot move its
own focal point out of the frame. The homepage scene (`scenes/flightdeck.ts`) is `free: true` because
its stage is taller and its statement larger, but it is framed like the rest: it composes its whole
instrument inside its own frame, clips it, and hands the rectangle to the engine through `Scene.frame`,
which then hit-tests the pointer against it, clips the pointer's light to it and draws the same champagne
frame round it. Beside the statement that frame uses the height of the stage (34px from the top, room
for the caption below, right edge on the content column, left edge clear of the headline), and its height
is cut at golden sections: the words take 1/phi^4 of it, the globe's field 1/phi, the session timeline
1/phi^3. Below 1080px, with no room beside the headline, it stands above the statement and is wide: the
globe in a square at its left, the words and the timeline beside it. Only the faint field behind (deck,
dust, horizon) runs on outside. The scene keeps its own hues for the globe, for "open" and for champagne,
so it holds its colour in every accent, Mono included.

Over the frame, the pointer does four things to every scene without the scene doing anything: the camera
swings further and leans in, the scene's clock runs faster, a light in the key colour follows the cursor,
and a reticle marks it. A scene that wants its own answer reads `f.hover` (0 to 1), `f.mx` and
`f.my`. Touch has no hover, and a still frame (reduced motion, low effects) ignores the pointer.

Nothing stands in the stage but the statement and the instrument. A page's `aside` (a list, a note, a
screenshot) follows the stage as its own block on the same night material, at every width.

## Accents

The seven accents in the display menu are carried into the header, every stage, the footer, the key
light, the tiles and the scenes by `src/styles/accent.css`. The default, GIO4X, is unchanged, including
the key light that follows the trading region.

## One height for every page

`--hero-h` is `clamp(30rem, 100svh − header − 4.5rem, 60rem)`: the first viewport minus the
header, leaving a strip of the page in view. `PageHero`, the homepage hero, the Intelligence
masthead, the article and lesson header and the 777 Raptor header all use `.cx-hero`, so the
stage is the same height on every page.

One honest exception: below the desktop layout a long statement under the frame can make that one stage
taller than the rest.

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
- **Stay in the frame.** Compose for `f.box`: about 3.9 world units wide and 2.75 tall around the
  origin at zoom 1. Anything outside is clipped. A wide instrument reads
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

Shown once per browser, on the first page of the first visit, never under reduced motion or low
effects. The flag is `gx:boot` in localStorage; it is listed with every other key in the Cookie &
Storage Notice and cleared by the privacy reset on `/preferences`. It is written on that first page
whether or not anything is shown (under reduced motion nothing is, and nothing is shown later
either). The inline script in `lib/boot.ts` decides before first paint and sets `data-boot` on
`<html>`: `intro` on the homepage, `run` anywhere else.

**The intro (homepage).** About three seconds: particles drift in the night (0.6s), gather into the
logo (1.15s), the mark stands while a glint crosses it (0.55s), then the night lifts and the
particles stream to the hero's champagne frame and fade there (0.85s). The hero is running
underneath throughout, so what is left is simply the hero. One Canvas 2D surface the size of the
window, pixel ratio capped at 1.5, 2,600 particles (1,100 below 720px). The shape and the colours
are the real logo's: `public/brand/gio4x-logo` is drawn once to an offscreen canvas and its opaque
pixels read with a single `getImageData`. "Skip" is there from the first frame and has the keyboard;
Escape, any other key, a click, a touch or the wheel also end it, in 220ms. The canvas is
`aria-hidden`; a status line says "GIO4X". Focus is never held and is handed back when it ends.
When it ends it dispatches `gx:intro-end` on `window` (`INTRO_END` in `lib/boot.ts`); the tour's
invitation waits for that. If the script never takes over, the night lifts by itself in CSS.

**The power-on (any other first page).** The sequence is CSS and ends by itself, so it cannot block
the site; any key, click, touch or wheel ends it at once. Its four lamps are the site's sections
coming up, not connection claims. A visitor who arrives here first does not see the intro later.

## Page to page

`StageTransition` is mounted once in the site shell. When the path changes and both pages have a
stage, the picture in the old frame is kept on screen over the new stage, travels to where the new
frame stands (382ms) and dissolves with a 1.0618 enlargement and a blur (618ms) while a line of
light crosses the champagne frame and the new scene powers on underneath; the statement fades up
on its own (382ms).

- It never delays or intercepts navigation. It acts only once the new page is in the document: the
  old canvas, detached by then, still holds its last picture, and that is copied. Links, the command
  bar, the tour and back/forward are therefore all covered.
- It waits at most 600ms for the new stage's first frame; after that the old picture just fades.
- The overlay is one fixed element, `pointer-events: none`, placed with a transform (no layout
  shift), clipped to the new stage, and removed when done.
- Nothing is shown on first load, when either page has no stage, when the old frame was scrolled
  out of view, in a hidden tab, or under reduced motion or low effects. Below 720px it is a plain
  cross-fade.
- The engine's part is one attribute: after each frame it writes the frame's rectangle to the
  canvas as `data-frame="x,y,w,h"` (canvas CSS pixels; only when it changes). `stage.ts` reads it.
  The existing `data-on` marks the first frame.

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
