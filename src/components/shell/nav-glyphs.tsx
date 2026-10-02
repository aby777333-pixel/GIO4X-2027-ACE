import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";

/**
 * Menu glyphs: one small drawing per navigation item, each ABOUT its item and
 * each moving in its own way when its row is hovered or focused.
 *
 * - Inline SVG on a 20 x 20 grid, stroked with `currentColor`; the accent and
 *   champagne parts take their colour only while the row is lit.
 * - Motion is CSS only (`src/styles/menu.css`). A part names one of a small set
 *   of movements (draw, spin, shift, arrive, rock, pop, fade, grow, pulse,
 *   glint) and passes its numbers as custom properties, so fifty drawings share
 *   ten keyframes. Every movement ENDS at the drawing's rest pose: with motion
 *   off the glyph is simply the finished picture.
 * - Glyphs are looked up by `href`. An item without its own drawing takes its
 *   family's (by URL prefix, then by section), so a new entry in `nav.ts`
 *   never renders bare.
 */

type Move = "draw" | "spin" | "shift" | "from" | "rock" | "pop" | "fade" | "grow" | "pulse" | "glint";
type Tone = "a" | "p";
type Opt = {
  /** offset in px (grid units) for shift / from / glint */
  x?: number;
  y?: number;
  /** degrees for spin / rock */
  r?: number;
  /** scale for pop / pulse / from */
  s?: number;
  /** starting scale per axis for grow (a negative value turns the part over) */
  sx?: number;
  sy?: number;
  /** starting opacity for from */
  o?: number;
  /** delay and duration in ms */
  d?: number;
  t?: number;
  /** transform origin on the 20 x 20 grid */
  at?: [number, number];
  tone?: Tone;
  /** extra classes: "mg-k" (filled with the surface, to sit over a line), "mg-dot" (solid), "mg-fill" (tinted) */
  cls?: string;
};

function m(move: Move, opt: Opt = {}): { className: string; style: CSSProperties; pathLength?: number } {
  const v: Record<string, string> = {};
  if (opt.x !== undefined) v["--x"] = `${opt.x}px`;
  if (opt.y !== undefined) v["--y"] = `${opt.y}px`;
  if (opt.r !== undefined) v["--r"] = `${opt.r}deg`;
  if (opt.s !== undefined) v["--s"] = String(opt.s);
  if (opt.sx !== undefined) v["--sx"] = String(opt.sx);
  if (opt.sy !== undefined) v["--sy"] = String(opt.sy);
  if (opt.o !== undefined) v["--o"] = String(opt.o);
  if (opt.d !== undefined) v["--d"] = `${opt.d}ms`;
  if (opt.t !== undefined) v["--t"] = `${opt.t}ms`;
  if (opt.at) v.transformOrigin = `${opt.at[0]}px ${opt.at[1]}px`;
  const className = `mga mga-${move}${opt.tone ? ` mg-${opt.tone}` : ""}${opt.cls ? ` ${opt.cls}` : ""}`;
  const props = { className, style: v as CSSProperties };
  // a drawn stroke measures its dash against a path length of 1
  return move === "draw" ? { ...props, pathLength: 1 } : props;
}

type Glyph = () => ReactNode;

/* ---- drawings shared by an item and its family --------------------------- */

/** three candles: the markets family */
const candles: Glyph = () => (
  <>
    <path d="M5 4.5v11M10 3v10M15 6.5v10.5" />
    <rect x="3.6" y="7.5" width="2.8" height="5" rx="0.4" {...m("grow", { at: [5, 10], cls: "mg-k" })} />
    <rect x="8.6" y="5.5" width="2.8" height="4.5" rx="0.4" {...m("grow", { at: [10, 7.75], d: 90, tone: "a", cls: "mg-k" })} />
    <rect x="13.6" y="9.5" width="2.8" height="4.5" rx="0.4" {...m("grow", { at: [15, 11.75], d: 180, cls: "mg-k" })} />
  </>
);

/** one arrow up, one down: the trading family */
const twoWay: Glyph = () => (
  <>
    <g {...m("from", { y: 4, o: 0 })}>
      <path d="M7 16V4.5" />
      <path d="M4 7.5l3-3 3 3" />
    </g>
    <g {...m("from", { y: -4, o: 0, d: 140, tone: "a" })}>
      <path d="M13 4v11.5" />
      <path d="M10 12.5l3 3 3-3" />
    </g>
  </>
);

/** a ruler with a marker travelling along it */
const ruler: Glyph = () => (
  <>
    <rect x="2.5" y="9" width="15" height="6" rx="1" />
    <path d="M5.5 9v2.2M8.5 9v3M11.5 9v2.2M14.5 9v3" />
    <path d="M4 4.5 5.5 7 7 4.5Z" {...m("shift", { x: 9, t: 720, tone: "a" })} />
  </>
);

/** a window assembling: frame, title bar, then what it shows */
const windowFrame: Glyph = () => (
  <>
    <rect x="3" y="4" width="14" height="12" rx="1.5" {...m("draw", { t: 520 })} />
    <path d="M3 7.5h14" {...m("grow", { sx: 0, sy: 1, at: [3, 7.5], d: 200, t: 300 })} />
    <path d="M5.5 13.5 8 11l2 1.5 4-3.5" {...m("draw", { d: 380, t: 320, tone: "a" })} />
  </>
);

/** lines of text setting themselves */
const textLines: Glyph = () => (
  <>
    <path d="M4 5h12" {...m("grow", { sx: 0, sy: 1, at: [4, 5], t: 320, tone: "a" })} />
    <path d="M4 9h12" {...m("grow", { sx: 0, sy: 1, at: [4, 9], d: 70, t: 320 })} />
    <path d="M4 12.5h12" {...m("grow", { sx: 0, sy: 1, at: [4, 12.5], d: 140, t: 320 })} />
    <path d="M4 16h7" {...m("grow", { sx: 0, sy: 1, at: [4, 16], d: 210, t: 320 })} />
  </>
);

/** a flask with two bubbles rising */
const flask: Glyph = () => (
  <>
    <path d="M8 3h4" />
    <path d="M8.6 3v5L4.4 15.3a1.1 1.1 0 0 0 1 1.7h9.2a1.1 1.1 0 0 0 1-1.7L11.4 8V3" />
    <path d="M6.6 11.5h6.8" />
    <circle cx="9" cy="14.2" r="0.9" {...m("from", { y: 2, o: 0, tone: "a" })} />
    <circle cx="11.4" cy="13.4" r="0.7" {...m("from", { y: 3, o: 0, d: 160, tone: "a" })} />
  </>
);

/** an open book, one page turning */
const book: Glyph = () => (
  <>
    <path d="M10 5.6C8 4.2 5.2 4 3 4.8v10.6c2.2-.8 5-.6 7 .8 2-1.4 4.8-1.6 7-.8V4.8c-2.2-.8-5-.6-7 .8Z" />
    <path d="M10 5.6v10.6" />
    <path d="M10 7.4c1.5-.9 3.2-1.2 4.8-1v7.4c-1.6-.2-3.3.1-4.8 1" {...m("grow", { sx: -1, sy: 1, at: [10, 10], t: 620, tone: "a" })} />
  </>
);

/** a shield drawn in one stroke, then ticked */
const shield: Glyph = () => (
  <>
    <path d="M10 3 16 5.2v4.6c0 3.6-2.4 6-6 7.2-3.6-1.2-6-3.6-6-7.2V5.2Z" {...m("draw", { t: 560 })} />
    <path d="M7.4 10l1.9 1.9 3.4-3.7" {...m("draw", { d: 380, t: 260, tone: "a" })} />
  </>
);

/** a document, its lines setting */
const documentPage: Glyph = () => (
  <>
    <path d="M5.5 3h6l3 3v11h-9Z" />
    <path d="M11.5 3v3h3" />
    <path d="M7.8 9.5h4.4" {...m("grow", { sx: 0, sy: 1, at: [7.8, 9.5], t: 300 })} />
    <path d="M7.8 12h4.4" {...m("grow", { sx: 0, sy: 1, at: [7.8, 12], d: 90, t: 300 })} />
    <path d="M7.8 14.5h2.4" {...m("grow", { sx: 0, sy: 1, at: [7.8, 14.5], d: 180, t: 300, tone: "a" })} />
  </>
);

/** the four-blade wheel turning half a turn: the company family */
const wheel: Glyph = () => (
  <>
    <g {...m("spin", { r: -180, t: 760 })}>
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d="M10 10c0-3.6 1.6-6 4.6-6.6.3 3-1.4 5.4-4.6 6.6Z" transform={`rotate(${a} 10 10)`} className={a === 0 ? "mg-a" : undefined} />
      ))}
    </g>
    <circle cx="10" cy="10" r="0.9" className="mg-dot" />
  </>
);

/** an arrow stepping forward: the last resort */
const arrow: Glyph = () => (
  <g {...m("shift", { x: 2.5, t: 420 })}>
    <path d="M4 10h11" />
    <path d="M11.5 6.5 15 10l-3.5 3.5" className="mg-a" />
  </g>
);

/** two links of a chain closing, then a tick */
const chain: Glyph = () => (
  <>
    <rect x="2.5" y="5.4" width="8.5" height="5.6" rx="2.8" />
    <rect x="9" y="5.4" width="8.5" height="5.6" rx="2.8" {...m("from", { x: 2.5, o: 1, tone: "a" })} />
    <path d="M7.2 15l1.8 1.8 3.6-3.8" {...m("draw", { d: 260, t: 260, tone: "a" })} />
  </>
);

/* ---- one drawing per destination ----------------------------------------- */

const GLYPHS: Record<string, Glyph> = {
  /* Markets: asset classes */
  // two coins in orbit around each other
  "/markets/forex": () => (
    <g {...m("spin", { t: 760 })}>
      <circle cx="6.5" cy="10" r="3.5" />
      <circle cx="13.5" cy="10" r="3.5" className="mg-a" />
    </g>
  ),
  // a bar catching a glint
  "/markets/metals": () => (
    <>
      <path d="M3.5 14.5 6.5 7h7l3 7.5Z" className="mg-p" />
      <path d="M8.5 11.5h3" className="mg-p" />
      <path d="M7.5 13l2-4.5" {...m("glint", { x: 5, t: 620 })} />
    </>
  ),
  // bars stepping up
  "/markets/indices": () => (
    <>
      <path d="M4.5 16.5v-4" {...m("grow", { at: [4.5, 16.5], t: 300 })} />
      <path d="M8.2 16.5v-7" {...m("grow", { at: [8.2, 16.5], d: 70, t: 300 })} />
      <path d="M11.9 16.5v-10" {...m("grow", { at: [11.9, 16.5], d: 140, t: 300 })} />
      <path d="M15.6 16.5v-13" {...m("grow", { at: [15.6, 16.5], d: 210, t: 300, tone: "a" })} />
    </>
  ),
  // a flame leaning in a draught
  "/markets/energy": () => (
    <>
      <path
        d="M10 2.8c.4 3 4.6 4.6 4.6 8.9a4.6 4.6 0 0 1-9.2 0c0-2 1-3.2 2-4.2.3 1.2.9 1.8 1.6 2 .1-2.4.3-4.6 1-6.7Z"
        {...m("rock", { r: 6, at: [10, 16.3], t: 680 })}
      />
      <path
        d="M10 12.2c.9 1 1.6 1.7 1.6 2.6a1.6 1.6 0 0 1-3.2 0c0-.9.7-1.6 1.6-2.6Z"
        {...m("pulse", { s: 1.3, at: [10, 16], d: 80, t: 520, tone: "a" })}
      />
    </>
  ),
  // a building, its windows lighting one by one
  "/markets/equities": () => (
    <>
      <path d="M5.5 17V4.5h9V17" />
      <path d="M3.5 17h13" />
      <path d="M10 17v-3" />
      <path d="M8 7.5h.9" {...m("fade", { t: 200, tone: "a" })} />
      <path d="M11.1 7.5h.9" {...m("fade", { d: 90, t: 200, tone: "a" })} />
      <path d="M8 10.5h.9" {...m("fade", { d: 180, t: 200, tone: "a" })} />
      <path d="M11.1 10.5h.9" {...m("fade", { d: 270, t: 200, tone: "a" })} />
    </>
  ),
  // one block linked to the next
  "/markets/crypto": () => (
    <>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <path d="M9 9l2 2" {...m("draw", { d: 160, t: 240 })} />
      <rect x="11" y="11" width="6" height="6" rx="1" {...m("from", { x: 2, y: 2, o: 0, tone: "a" })} />
    </>
  ),

  /* Markets: Market Command */
  // a globe turning
  "/markets": () => (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14" />
      <ellipse cx="10" cy="10" rx="3.2" ry="7" {...m("grow", { sx: -1, sy: 1, t: 700, tone: "a" })} />
    </>
  ),
  // clock hands turning
  "/markets/clock": () => (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 10V5.6" {...m("spin", { t: 820 })} />
      <path d="M10 10l3 1.6" {...m("spin", { r: -60, t: 820, tone: "a" })} />
    </>
  ),
  // bars sorting themselves into rank
  "/markets/currency-strength": () => (
    <>
      <path d="M4 5.5h12" {...m("from", { y: 9, o: 1, t: 460, tone: "a" })} />
      <path d="M4 10h8" />
      <path d="M4 14.5h4.5" {...m("from", { y: -9, o: 1, t: 460 })} />
    </>
  ),
  // columns rising under a pediment
  "/markets/central-banks": () => (
    <>
      <path d="M3.5 7.5 10 3.5l6.5 4Z" />
      <path d="M3.5 16.5h13" />
      <path d="M6 14.5v-5" {...m("grow", { at: [6, 14.5], t: 320 })} />
      <path d="M10 14.5v-5" {...m("grow", { at: [10, 14.5], d: 90, t: 320, tone: "a" })} />
      <path d="M14 14.5v-5" {...m("grow", { at: [14, 14.5], d: 180, t: 320 })} />
    </>
  ),
  // a calendar leaf turning over
  "/markets/events": () => (
    <>
      <rect x="3.5" y="4.5" width="13" height="12" rx="1.5" />
      <path d="M7 3v3M13 3v3" />
      <path d="M3.5 8.5h13" />
      <path d="M6.5 11h7v3h-7Z" {...m("grow", { sx: 1, sy: -1, at: [10, 8.5], t: 560, tone: "a" })} />
    </>
  ),

  /* Trading: accounts */
  // plates stacking
  "/trading/accounts": () => (
    <>
      <path d="M3.5 14 10 17l6.5-3" {...m("from", { y: -4, o: 0, t: 320 })} />
      <path d="M3.5 10.5 10 13.5l6.5-3" {...m("from", { y: -4, o: 0, d: 100, t: 320 })} />
      <path d="M10 4l6.5 3L10 10 3.5 7Z" {...m("from", { y: -4, o: 0, d: 200, t: 320, tone: "a" })} />
    </>
  ),
  // two dials being set
  "/trading/conditions": () => (
    <>
      <circle cx="6.5" cy="7" r="3.5" />
      <path d="M6.5 7V4.8" {...m("spin", { r: -140, at: [6.5, 7], t: 620 })} />
      <circle cx="13.5" cy="13" r="3.5" />
      <path d="M13.5 13l1.6-1.5" {...m("spin", { r: 120, at: [13.5, 13], d: 80, t: 620, tone: "a" })} />
    </>
  ),
  // an arrow out and an arrow back
  "/trading/funding": () => (
    <>
      <g {...m("from", { x: -5, o: 0, t: 340 })}>
        <path d="M3.5 7h12" />
        <path d="M12.5 4l3 3-3 3" />
      </g>
      <g {...m("from", { x: 5, o: 0, d: 240, t: 340, tone: "a" })}>
        <path d="M16.5 13h-12" />
        <path d="M7.5 10l-3 3 3 3" />
      </g>
    </>
  ),

  /* Trading: ways to participate */
  // one stroke, then a second that follows it
  "/trading/copy-trading": () => (
    <>
      <path d="M3 11l4-5 3.5 3.5L14 5" {...m("draw", { t: 420 })} />
      <path d="M6 16l4-5 3.5 3.5L17 10" {...m("draw", { d: 220, t: 420, tone: "a" })} />
    </>
  ),
  // strands joining into one
  "/trading/pamm": () => (
    <>
      <path d="M3 5c5 0 5 5 9 5" {...m("draw", { t: 360 })} />
      <path d="M3 10h9" {...m("draw", { d: 60, t: 360 })} />
      <path d="M3 15c5 0 5-5 9-5" {...m("draw", { d: 120, t: 360 })} />
      <path d="M12 10h5" {...m("draw", { d: 400, t: 240, tone: "a" })} />
    </>
  ),
  // one introduces two
  "/partners": () => (
    <>
      <path d="M10 7 5.4 13" {...m("draw", { d: 60, t: 260 })} />
      <path d="M10 7l4.6 6" {...m("draw", { d: 160, t: 260 })} />
      <circle cx="10" cy="5" r="2.2" className="mg-a mg-k" />
      <circle cx="4.5" cy="15" r="2.2" {...m("pop", { at: [4.5, 15], d: 260, t: 260, cls: "mg-k" })} />
      <circle cx="15.5" cy="15" r="2.2" {...m("pop", { at: [15.5, 15], d: 360, t: 260, cls: "mg-k" })} />
    </>
  ),
  // allocation sliders being moved
  "/partners/money-managers": () => (
    <>
      <path d="M5 3.5v13M10 3.5v13M15 3.5v13" />
      <circle cx="5" cy="12.5" r="1.9" {...m("shift", { y: -5, t: 640, cls: "mg-k" })} />
      <circle cx="10" cy="7" r="1.9" {...m("shift", { y: 5, t: 640, d: 60, tone: "a", cls: "mg-k" })} />
      <circle cx="15" cy="11" r="1.9" {...m("shift", { y: -4, t: 640, d: 120, cls: "mg-k" })} />
    </>
  ),

  /* Trading: toolkit */
  "/tools": ruler,
  // a position resized inside its frame
  "/tools/position-size": () => (
    <>
      <path d="M3.5 7V3.5H7M13 3.5h3.5V7M16.5 13v3.5H13M7 16.5H3.5V13" />
      <rect x="7" y="7" width="6" height="6" rx="0.8" {...m("pulse", { s: 1.55, t: 640, tone: "a" })} />
    </>
  ),
  // the price moves one step
  "/tools/pip-value": () => (
    <>
      <path d="M3 13.5h8v-5h6" {...m("draw", { t: 460 })} />
      <circle cx="11" cy="8.5" r="1.5" {...m("pop", { at: [11, 8.5], d: 300, t: 260, tone: "a", cls: "mg-k" })} />
    </>
  ),
  // margin filling its container
  "/tools/margin": () => (
    <>
      <rect x="4" y="3.5" width="12" height="13" rx="1.5" />
      <path d="M4 7.5h2M14 7.5h2" />
      <rect x="6.2" y="9.5" width="7.6" height="4.8" rx="0.6" {...m("grow", { at: [10, 14.3], t: 520, tone: "a", cls: "mg-fill" })} />
    </>
  ),
  // a receipt itemising its lines
  "/tools/cost-lab": () => (
    <>
      <path d="M5 3h10v14l-1.7-1.3-1.6 1.3-1.7-1.3L8.3 17l-1.6-1.3L5 17Z" />
      <path d="M7.5 6.5h5" {...m("grow", { sx: 0, sy: 1, at: [7.5, 6.5], t: 280 })} />
      <path d="M7.5 9.5h5" {...m("grow", { sx: 0, sy: 1, at: [7.5, 9.5], d: 100, t: 280 })} />
      <path d="M7.5 12.5h2.8" {...m("grow", { sx: 0, sy: 1, at: [7.5, 12.5], d: 200, t: 280, tone: "a" })} />
    </>
  ),

  /* Platforms */
  // a bird of prey beating its wings once
  "/platforms/raptor": () => (
    <>
      <path d="M10 12.5C8 9.2 5.5 7.6 2.5 8" {...m("rock", { r: 16, at: [10, 12.5], t: 620, tone: "a" })} />
      <path d="M10 12.5c2-3.3 4.5-4.9 7.5-4.5" {...m("rock", { r: -16, at: [10, 12.5], t: 620, tone: "a" })} />
      <path d="M8.6 16 10 12.5l1.4 3.5" />
    </>
  ),
  "/platforms/metatrader-5": windowFrame,
  // first, second, third step
  "/platforms/metatrader-5#getting-started": () => (
    <>
      <path d="M4.5 10h11" {...m("grow", { sx: 0, sy: 1, at: [4.5, 10], t: 520 })} />
      <circle cx="4.5" cy="10" r="2" {...m("pop", { at: [4.5, 10], t: 240, cls: "mg-k" })} />
      <circle cx="10" cy="10" r="2" {...m("pop", { at: [10, 10], d: 170, t: 240, cls: "mg-k" })} />
      <circle cx="15.5" cy="10" r="2" {...m("pop", { at: [15.5, 10], d: 340, t: 240, tone: "a", cls: "mg-k" })} />
    </>
  ),
  // two panels weighed in turn
  "/platforms/compare": () => (
    <>
      <path d="M10 3.5v13" />
      <rect x="3" y="4.5" width="5" height="11" rx="1" {...m("pulse", { s: 0.8, at: [5.5, 10], t: 380 })} />
      <rect x="12" y="4.5" width="5" height="11" rx="1" {...m("pulse", { s: 0.8, at: [14.5, 10], d: 240, t: 380, tone: "a" })} />
    </>
  ),
  "/trust/verify": chain,

  /* Intelligence */
  "/intelligence": textLines,
  // a pen making its stroke
  "/intelligence/blog": () => (
    <>
      <path d="M13 3.5 16.5 7 8 15.5l-4.5 1 1-4.5Z" {...m("rock", { r: -8, at: [3.5, 16.5], t: 560 })} />
      <path d="M9.5 17h7.5" {...m("draw", { d: 100, t: 420, tone: "a" })} />
    </>
  ),
  // the sun coming up
  "/morning-room": () => (
    <>
      <path d="M3 14.5h14" />
      <path d="M5.5 14.5a4.5 4.5 0 0 1 9 0" {...m("pop", { s: 0.35, at: [10, 14.5], t: 460, tone: "a" })} />
      <path d="M10 7V5" {...m("fade", { d: 280, t: 220 })} />
      <path d="M4.7 9.2 3.3 7.8" {...m("fade", { d: 350, t: 220 })} />
      <path d="M15.3 9.2l1.4-1.4" {...m("fade", { d: 420, t: 220 })} />
    </>
  ),
  "/labs": flask,
  // a moon going round its planet
  "/labs/market-universe": () => (
    <>
      <circle cx="10" cy="10" r="3.4" />
      <ellipse cx="10" cy="10" rx="7.6" ry="2.4" transform="rotate(-20 10 10)" />
      <g {...m("spin", { t: 900 })}>
        <circle cx="15.6" cy="4.6" r="1.2" className="mg-a mg-dot" />
      </g>
    </>
  ),
  // a line finding its way through the dots
  "/labs/connect-the-dots": () => (
    <>
      <path d="M4 14.5 8 6l5 6 3.5-7" {...m("draw", { t: 600, tone: "a" })} />
      <circle cx="4" cy="14.5" r="1.3" className="mg-k" />
      <circle cx="8" cy="6" r="1.3" className="mg-k" />
      <circle cx="13" cy="12" r="1.3" className="mg-k" />
      <circle cx="16.5" cy="5" r="1.3" className="mg-k" />
    </>
  ),
  // a day turning: light half, dark half
  "/labs/market-day": () => (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3a7 7 0 0 1 0 14Z" {...m("spin", { t: 900, tone: "a", cls: "mg-fill" })} />
    </>
  ),
  // a balance finding its level
  "/labs/trade-anatomy": () => (
    <>
      <path d="M10 4v12.5M7 16.5h6" />
      <g {...m("rock", { r: 10, at: [10, 6], t: 720 })}>
        <path d="M4 6h12" />
        <path d="M4 6 2.5 10.5h3Z" />
        <path d="M16 6l-1.5 4.5h3Z" className="mg-a" />
      </g>
    </>
  ),
  // a practice chart plotted on its axes
  "/labs/simulator": () => (
    <>
      <path d="M3.5 3.5v13h13" />
      <path d="M6 13l3-3.5 2.5 2 4-5" {...m("draw", { t: 520, tone: "a" })} />
      <circle cx="15.5" cy="6.5" r="1.2" {...m("pop", { at: [15.5, 6.5], d: 420, t: 240, tone: "a", cls: "mg-dot" })} />
    </>
  ),

  /* Academy: learn */
  "/academy": book,
  // a letter, underlined
  "/glossary": () => (
    <>
      <path d="M6 13.5 10 3.5l4 10M7.4 10h5.2" />
      <path d="M4.5 16.8h11" {...m("draw", { t: 380, tone: "a" })} />
    </>
  ),
  // a book settling on the shelf
  "/academy/books": () => (
    <>
      <path d="M3 16.5h14" />
      <rect x="4" y="5.5" width="3" height="11" rx="0.5" />
      <rect x="7" y="3.5" width="3" height="13" rx="0.5" />
      <path d="M11.3 16.5 13.5 6.1l2.9.6-2.1 9.8" {...m("rock", { r: -12, at: [11.3, 16.5], t: 600, tone: "a" })} />
    </>
  ),
  // a question, then its point
  "/faq": () => (
    <>
      <path d="M7 7.2a3 3 0 1 1 4.6 2.5c-1 .7-1.6 1.3-1.6 2.8" {...m("draw", { t: 460 })} />
      <circle cx="10" cy="15.6" r="1" {...m("pop", { at: [10, 15.6], d: 380, t: 240, tone: "a", cls: "mg-dot" })} />
    </>
  ),

  /* Academy: see it move */
  // bid and ask part, then close
  "/tools/spread-visualizer": () => (
    <>
      <path d="M3 8.3c2.5-1.4 4.5 1.4 7 0s4.5-1.4 7 0" {...m("shift", { y: -3.4, t: 640, tone: "a" })} />
      <path d="M3 11.7c2.5-1.4 4.5 1.4 7 0s4.5-1.4 7 0" {...m("shift", { y: 3.4, t: 640 })} />
    </>
  ),
  // a lever tipping on its fulcrum
  "/tools/leverage-visualizer": () => (
    <>
      <path d="M10.5 16.5 13 12.3l2.5 4.2Z" />
      <g {...m("rock", { r: -11, at: [13, 11.5], t: 680 })}>
        <path d="M2.5 11.5h15" />
        <rect x="14.3" y="7.6" width="3" height="3" rx="0.5" className="mg-a" />
      </g>
    </>
  ),
  // a line that drops, then climbs back part of the way
  "/tools/drawdown": () => (
    <>
      <path d="M3 5.5h4l4.5 9.5 3-5.5h1" {...m("draw", { t: 640 })} />
      <circle cx="16.5" cy="9.5" r="1.2" {...m("pop", { at: [16.5, 9.5], d: 500, t: 240, tone: "a", cls: "mg-dot" })} />
    </>
  ),
  // a ticket being stamped
  "/tools/order-anatomy": () => (
    <>
      <rect x="3" y="9" width="14" height="8" rx="1" />
      <path d="M5.5 12h4M5.5 14.5h2.5" />
      <g {...m("shift", { y: 3, t: 420 })}>
        <path d="M13.5 2.5V5" />
        <path d="M11 5h5v2h-5Z" />
      </g>
      <circle cx="13.5" cy="13" r="1.9" {...m("pop", { s: 1.8, at: [13.5, 13], d: 200, t: 280, tone: "a" })} />
    </>
  ),

  /* Company: GIO4X */
  "/about": wheel,
  // reasons ticked off
  "/about/why-gio4x": () => (
    <>
      <path d="M10 5.5h6.5M10 10h6.5M10 14.5h6.5" />
      <path d="M3.5 5.5 5 7l2.5-3" {...m("draw", { t: 240, tone: "a" })} />
      <path d="M3.5 10 5 11.5l2.5-3" {...m("draw", { d: 140, t: 240, tone: "a" })} />
      <path d="M3.5 14.5 5 16l2.5-3" {...m("draw", { d: 280, t: 240, tone: "a" })} />
    </>
  ),
  // a definition closing around its subject
  "/about/what-we-are": () => (
    <>
      <path d="M7 4H4.5v12H7" {...m("from", { x: -2, o: 0.3, t: 360 })} />
      <path d="M13 4h2.5v12H13" {...m("from", { x: 2, o: 0.3, t: 360 })} />
      <path d="M10 7.2 12.8 10 10 12.8 7.2 10Z" {...m("pop", { d: 160, t: 300, tone: "a" })} />
    </>
  ),
  // a pin dropping onto the map
  "/about/world": () => (
    <>
      <path d="M4 16.5h12" />
      <g {...m("from", { y: -4, o: 0, t: 380 })}>
        <path d="M10 15s-4.5-4-4.5-7.3a4.5 4.5 0 0 1 9 0C14.5 11 10 15 10 15Z" />
        <circle cx="10" cy="7.7" r="1.5" className="mg-a" />
      </g>
    </>
  ),
  // a ladder, rung by rung
  "/careers": () => (
    <>
      <path d="M6.5 3v14M13.5 3v14" />
      <path d="M6.5 14h7" {...m("grow", { sx: 0, sy: 1, at: [6.5, 14], t: 260 })} />
      <path d="M6.5 10h7" {...m("grow", { sx: 0, sy: 1, at: [6.5, 10], d: 120, t: 260 })} />
      <path d="M6.5 6h7" {...m("grow", { sx: 0, sy: 1, at: [6.5, 6], d: 240, t: 260, tone: "a" })} />
    </>
  ),
  // an announcement carrying
  "/media": () => (
    <>
      <path d="M3.5 8.5v3h2.6l4.4 3.2V5.3L6.1 8.5Z" />
      <path d="M13 8a3 3 0 0 1 0 4" {...m("fade", { d: 60, t: 240, tone: "a" })} />
      <path d="M15 6a6 6 0 0 1 0 8" {...m("fade", { d: 240, t: 240, tone: "a" })} />
    </>
  ),
  // an envelope's flap folding shut
  "/contact": () => (
    <>
      <rect x="3" y="5" width="14" height="10.5" rx="1.5" />
      <path d="M3.6 6 10 11l6.4-5" {...m("grow", { sx: 1, sy: -0.5, at: [10, 6], t: 520, tone: "a" })} />
    </>
  ),

  /* Company: trust */
  // a seal pressed onto its ribbon
  "/trust": () => (
    <>
      <path d="M7.4 12.6 6.5 17.5 10 15.6l3.5 1.9-.9-4.9" />
      <circle cx="10" cy="8.2" r="5.2" {...m("pop", { s: 1.35, at: [10, 8.2], t: 320, tone: "p", cls: "mg-k" })} />
      <path d="M7.8 8.3l1.6 1.6 2.9-3.2" {...m("draw", { d: 280, t: 260, tone: "a" })} />
    </>
  ),
  // a vault wheel turning
  "/trust/client-funds": () => (
    <>
      <rect x="3.5" y="4" width="13" height="11.5" rx="1.5" />
      <path d="M6 15.5V17M14 15.5V17" />
      <g {...m("spin", { r: -90, at: [10, 9.75], t: 640, tone: "a" })}>
        <circle cx="10" cy="9.75" r="2.8" />
        <path d="M10 6.2v7.1M6.45 9.75h7.1" />
      </g>
    </>
  ),
  // a padlock closing
  "/trust/security": () => (
    <>
      <rect x="5" y="9" width="10" height="8" rx="1.5" />
      <path d="M7 9V6.8a3 3 0 0 1 6 0V9" {...m("from", { y: -2.4, o: 1, t: 380 })} />
      <circle cx="10" cy="13" r="1.1" {...m("pop", { at: [10, 13], d: 260, t: 240, tone: "a", cls: "mg-dot" })} />
    </>
  ),
  "/legal": documentPage,

  /* Pages outside the primary navigation (footer, directory, command bar) */
  // a lifebuoy turning
  "/support": () => (
    <g {...m("spin", { r: -90, t: 700 })}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3" className="mg-a" />
      <path d="M12.1 7.9 15 5M7.9 7.9 5 5M7.9 12.1 5 15M12.1 12.1 15 15" />
    </g>
  ),
  // a screen set down on a desk
  "/desk": () => (
    <>
      <path d="M2.5 12h15M4.5 12v5M15.5 12v5" />
      <path d="M10 9.5V12" />
      <rect x="6" y="3.5" width="8" height="6" rx="0.8" {...m("from", { y: -3, o: 0, t: 360, tone: "a" })} />
    </>
  ),
  // a route traced to its end
  "/#tour": () => (
    <>
      <path d="M4 15.5c4 0 2-10 6-10s2 6 5.5 6" {...m("draw", { t: 600 })} />
      <circle cx="16" cy="11.5" r="1.3" {...m("pop", { at: [16, 11.5], d: 480, t: 240, tone: "a", cls: "mg-dot" })} />
    </>
  ),
  // a pulse crossing the trace
  "/status": () => <path d="M2.5 10.5h4l1.8-4.5 3 9 2-4.5h4.2" {...m("draw", { t: 640, tone: "a" })} />,
  // a switch being thrown
  "/preferences": () => (
    <>
      <rect x="2.5" y="6" width="15" height="8" rx="4" />
      <circle cx="13" cy="10" r="2.2" {...m("from", { x: -6, o: 1, t: 320, tone: "a" })} />
    </>
  ),
  // something new catching the light
  "/whats-new": () => (
    <path
      d="M10 3.5c.5 3.6 2.4 5.6 6 6.5-3.6.9-5.5 2.9-6 6.5-.5-3.6-2.4-5.6-6-6.5 3.6-.9 5.5-2.9 6-6.5Z"
      {...m("pulse", { s: 1.15, t: 520, tone: "a" })}
    />
  ),
  // a compass needle settling
  "/explore": () => (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M12.8 7.2 11.2 11.2 7.2 12.8 8.8 8.8Z" {...m("rock", { r: 40, t: 700, tone: "a" })} />
    </>
  ),
};

/** Family drawings by URL prefix (longest match wins), for an item with no drawing of its own. */
const FAMILY: [prefix: string, glyph: Glyph][] = [
  ["/markets", candles],
  ["/trading", twoWay],
  ["/partners", twoWay],
  ["/tools", ruler],
  ["/platforms", windowFrame],
  ["/intelligence", textLines],
  ["/morning-room", textLines],
  ["/labs", flask],
  ["/academy", book],
  ["/glossary", book],
  ["/faq", book],
  ["/trust", shield],
  ["/legal", documentPage],
  ["/about", wheel],
];

/** Family drawings by primary section, for a new kind of URL filed under an existing menu. */
const SECTION: Record<string, Glyph> = {
  markets: candles,
  trading: twoWay,
  platforms: windowFrame,
  intelligence: textLines,
  academy: book,
  company: wheel,
};

function resolve(href: string, section?: string): Glyph {
  const exact = GLYPHS[href];
  if (exact) return exact;
  const path = href.split(/[?#]/)[0] ?? href;
  const plain = GLYPHS[path];
  if (plain) return plain;
  let best: Glyph | undefined;
  let length = 0;
  for (const [prefix, glyph] of FAMILY) {
    if ((path === prefix || path.startsWith(`${prefix}/`)) && prefix.length > length) {
      best = glyph;
      length = prefix.length;
    }
  }
  return best ?? (section ? SECTION[section] : undefined) ?? arrow;
}

/**
 * The glyph for a navigation item. Decorative: the row's label says what it is.
 * `once` (a position in its list) plays the movement a single time on mount,
 * staggered by that position: the phone menu, where nothing hovers.
 */
export function NavGlyph({ href, section, once }: { href: string; section?: string; once?: number }) {
  const glyph = resolve(href, section);
  return (
    <svg
      className={once === undefined ? "mg" : "mg mg-once"}
      style={once === undefined ? undefined : ({ "--i": once } as CSSProperties)}
      viewBox="0 0 20 20"
      width="20"
      height="20"
      aria-hidden
      focusable="false"
    >
      {glyph()}
    </svg>
  );
}

/**
 * Row treatments. A column keeps one treatment for all its rows, and columns
 * that sit side by side never share one: the step by section keeps the same
 * position in two different menus from behaving alike.
 */
const ROW_FX = ["slide", "wipe", "edge", "light"] as const;
export type RowFx = (typeof ROW_FX)[number];
export function rowFx(sectionIndex: number, groupIndex: number): RowFx {
  return ROW_FX[(sectionIndex + groupIndex) % ROW_FX.length] ?? "slide";
}

/* ---- the pointer's light on the open panel ------------------------------- */

let frame = 0;
let pending: { panel: HTMLElement; row: HTMLElement | null; x: number; y: number } | null = null;

/**
 * `onPointerMove` for the open menu panel. Writes the pointer's position to
 * `--mg-x` / `--mg-y` on the panel (px) and to `--rx` / `--ry` on the row
 * under it (per cent), at most once a frame; the stylesheet draws the light.
 * Nothing is stored and nothing is read back: a touch never reaches here.
 */
export function panelLight(e: ReactPointerEvent<HTMLElement>) {
  if (e.pointerType === "touch") return;
  const target = e.target;
  pending = {
    panel: e.currentTarget,
    row: target instanceof Element ? target.closest<HTMLElement>(".mg-row") : null,
    x: e.clientX,
    y: e.clientY,
  };
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    const p = pending;
    pending = null;
    if (!p) return;
    const box = p.panel.getBoundingClientRect();
    const rowBox = p.row?.getBoundingClientRect();
    p.panel.style.setProperty("--mg-x", `${Math.round(p.x - box.left)}px`);
    p.panel.style.setProperty("--mg-y", `${Math.round(p.y - box.top)}px`);
    if (p.row && rowBox && rowBox.width > 0 && rowBox.height > 0) {
      p.row.style.setProperty("--rx", `${Math.round(((p.x - rowBox.left) / rowBox.width) * 100)}%`);
      p.row.style.setProperty("--ry", `${Math.round(((p.y - rowBox.top) / rowBox.height) * 100)}%`);
    }
  });
}
