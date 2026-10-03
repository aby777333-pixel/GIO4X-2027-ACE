# The homepage as one shot, and the two 3D instruments in Labs

Notes for what was added on top of the cockpit (`docs/COCKPIT.md`). Nothing here changes the
shared cockpit files, the shell or the tokens.

## 1. The homepage story (`src/components/home/HomeStory.tsx`)

One client component, mounted last on the homepage, with one passive scroll listener and one
`requestAnimationFrame` loop that runs only when something changed. It renders no text.

| Part | What it does | Where |
|---|---|---|
| The travelling instrument | As the hero leaves, a small instrument comes away from the hero's frame and docks under the header. It is four things in turn, matched to the chapter being read: **the market** (a globe), **one instrument** (the form of a chart), **an order** (entry between target and stop), **the account** (a statement). | `HomeStory.tsx`, `story-scene.ts`, `home.css` section 1 |
| Headings in step | Each section receives `--story-in` (0 to 1) from its position in the window. The eyebrow's rule is drawn and the heading settles 8px. Text is never faded. | `home.css` section 2 |
| Depth | Elements marked `data-depth="n"` shift a few pixels with scroll and with the pointer. Negative is behind the page, positive in front. `data-depth-pointer="off"` keeps the scroll part only. | `home.css` section 3 |

Chapters are found by the id of the heading that opens them (`CHAPTERS` in `HomeStory.tsx`):
`asset-index`, `platforms-chapter`, `tools-home`, `accounts-home`. The instrument stands aside
while the pinned sequence (`.gx-seq`, which has its own picture) fills the window, and leaves at
`intel-home`. Rename a heading id and the list must follow.

Rules it keeps:

- **Scroll is the clock.** The story position, the globe's turn, the flight from the hero and the
  heading values are all functions of the scroll position, so scrubbing back reverses them
  exactly. Only the pointer part of depth eases, and it stops.
- **Without JavaScript** nothing is rendered and no style applies: the page is as it was.
- **Reduced motion / low visual effects:** no depth, no heading motion; the instrument shows whole
  states only (no passage, no flight, no turn).
- **Touch:** no pointer depth. **Below 820px** the instrument is not shown.
- **Honesty:** the instrument is fixed line art: no symbol, no price, no axis value. Its caption
  reads "Form only, not data". It is `aria-hidden`.
- **Amounts:** scroll depth is 8px per unit of depth, pointer depth 4px by 3px. The statement is
  0.5, the hero's far field and the Platforms grid are -2, the hero canvas is -3 (scroll only: its
  scene already turns its camera to the pointer), the Philosophy watermark is -3.

The dock is portalled to `<body>` so that no transformed ancestor can become its containing block.
Its z-index is 30: under the header (40) and under every panel that can open.

## 2. The 3D instruments (`/labs/session-globe`, `/labs/order-book-3d`)

Both use Three.js, like THE BREACH on `/platforms/raptor`; no dependency was added.

| File | Role |
|---|---|
| `src/components/labs/three/stage.ts` | The shared stage: renderer, turning (drag, arrow keys, Home), draw-on-demand, pause, dispose, colours from tokens. Imports Three.js. |
| `src/components/labs/three/useScene.ts` | Client hook: fetches a scene by dynamic import when its frame nears the viewport, re-reads colours on theme or accent change, disposes on leaving. No Three.js. |
| `src/components/labs/three/labs3d.css` | The frame, the still, the labels. Imported by the two pages only. |
| `src/components/labs/session-globe/*` | `scene.ts` (Three.js), `SessionGlobe.tsx` (client: list + frame), `SessionGlobeStill.tsx` (server SVG), `sessions.ts` (the four sessions with coordinates). |
| `src/components/labs/order-book-3d/*` | `scene.ts` (Three.js), `OrderBook3D.tsx` (client: readings + frame), `OrderBookStill.tsx` (server SVG), `book.ts` (the seeded shape and the six readings). |

How they behave:

- **Three.js loads only there.** `scene.ts` and `stage.ts` are reached only through `import()`
  inside `useScene`'s loader. Nothing else imports them.
- **Draw on demand.** There is no free-running loop. A frame is drawn after a turn, a resize, a
  change of data or theme, and while the globe's idle turn runs (one turn in three minutes, until
  the visitor first touches it; never under reduced motion). Nothing is drawn while the tab is
  hidden or the frame is off-screen. Pixel ratio is capped at 2.
- **Disposal.** Every geometry and material, the renderer and the WebGL context are given back on
  unmount. The canvas is created by the stage, not by React, because a canvas whose context has
  been released cannot be reused.
- **No WebGL, no JavaScript, lost context:** the server-drawn still inside the frame is what is
  shown (a flat map; a flat figure of the same seeded book). The text beside it is complete in
  every case.
- **Keyboard:** the frame is focusable; arrow keys turn it by 7.5 degrees, Home returns it. On
  touch, a sideways drag turns it and a vertical one scrolls the page.
- **Colours** are read from the tokens as they resolve on the frame, in both themes and every
  accent.

Honesty:

- The **session globe** reads the clock and the conventional windows in `src/lib/sessions.ts`
  (`fxSessions`, `fxSessionOpen`, `fxWeekOpen`), and the sun from `market-day/earth.ts` (`sunAt`).
  It carries a `DataNote` with status Schedule and says it is computed from the clock.
- The **order book** is labelled "Illustration, not market data" on the picture itself, in its
  caption, in its `DataNote` (status Simulation) and in the page lead. Heights come from
  `mulberry32(777)` in `book.ts`, are relative (0 to 1) and never change per frame. There is no
  price, quantity, symbol or axis value.

Registration: both pages are in `src/config/nav.ts` (Intelligence → Labs), which feeds the menu,
the sitemap (`src/lib/sitemap-data.ts`) and the search index (`src/lib/search-index.ts`), and on
the Labs index as experiments 06 and 07. Their hero scenes are chosen with `PageHero`'s `scene`
prop (`clock`, `spread`); `cockpit/routes.ts` was not changed.
