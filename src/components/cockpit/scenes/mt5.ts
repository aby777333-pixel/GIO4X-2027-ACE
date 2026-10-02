/**
 * METATRADER 5 — the terminal, engraved in one pane of glass.
 *
 * A single slab of edge-lit glass stands in a machined rail. Fine rules divide
 * it into the regions every MetaTrader user knows by heart: the toolbar with
 * its timeframes, Market Watch down the left, four chart windows in a grid and
 * the Toolbox along the bottom. The regions light in that strict order, and
 * afterwards the terminal's focus keeps walking through them, slowly.
 *
 * The charts are drawings of charts: schematic series with no symbol, no scale
 * and no prices. The only lettering is the terminal's own (timeframes, tab
 * names, the product name on the rail).
 */
import { TAU, clamp, easeInOut, easeOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, panel, pool, trace } from "../kit";

const W = 3.3;
const H = 2.06;
const FLOOR = -1.3;
const RAIL = 0.12;
const THICK = 0.11;

// the engraved frame and its rules, in the pane's own 0..1 space:
// VT under the toolbar, VB above the toolbox, UW right of market watch, UC / VC the cross between the charts
const [U0, U1, V0, V1] = [0.026, 0.974, 0.045, 0.958];
const [VT, VB, UW, UC, VC] = [0.862, 0.25, 0.2, 0.587, 0.556];

type Rect = readonly [number, number, number, number];
/** in lighting order: toolbar, market watch, charts one to four, toolbox */
const CELLS: Rect[] = [
  [U0, VT, U1, V1],
  [U0, VB, UW, VT],
  [UW, VC, UC, VT],
  [UC, VC, U1, VT],
  [UW, VB, UC, VC],
  [UC, VB, U1, VC],
  [U0, V0, U1, VB],
];
const COLS = [0.014, 0.15, 0.29, 0.41, 0.53, 0.67, 0.83];

/** engraved capitals are letterspaced: a hair space between the letters */
const track = (s: string) => s.split("").join(String.fromCharCode(0x200a));
// the terminal's own lettering: timeframes, the toolbox tabs (spaced by their length), two names
const TF = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"].map(track);
const TABS = ["TRADE", "EXPOSURE", "HISTORY", "NEWS", "CALENDAR", "JOURNAL"];
const TAB_AT = TABS.map((_, i) => 0.014 + TABS.slice(0, i).reduce((x, n) => x + n.length * 0.0095 + 0.034, 0));
const TAB_NAMES = TABS.map(track);
const WATCH = track("MARKET WATCH");
const PLATE = track("METATRADER 5");

type Cell = (x: number, y: number, lift?: number) => V3;
type Candle = { o: number; c: number; h: number; l: number };
type State = { up: Candle[]; down: Candle[]; line: number[]; area: number[]; hist: number[]; watch: number[]; kinds: number[]; pick: number };

/** a schematic series, 0..1: a trend, one slow wave and a little grain */
function walk(f: Frame, n: number, salt: number, trend: number, wave: number, grain: number): number[] {
  const raw: number[] = [];
  let drift = 0;
  for (let i = 0; i <= n; i++) {
    drift += (f.rnd(salt * 37 + i) - 0.5) * grain;
    raw.push((trend * i) / n + 0.3 * Math.sin((i / n) * TAU * wave + salt * 1.7) + drift);
  }
  const lo = Math.min(...raw);
  const hi = Math.max(...raw);
  return raw.map((v) => (v - lo) / (hi - lo || 1));
}

function candles(f: Frame, n: number, salt: number, trend: number, wave: number): Candle[] {
  const w = walk(f, n, salt, trend, wave, 0.2);
  return w.slice(0, n).map((o, i) => ({ o, c: w[i + 1], h: Math.max(o, w[i + 1]) + f.rnd(salt * 53 + i) * 0.1, l: Math.min(o, w[i + 1]) - f.rnd(salt * 71 + i) * 0.1 }));
}

/** lettering that lies in the plane of the glass, as engraving does; `size` is in world units */
function engrave(f: Frame, text: string, p: V3, size: number, colour: string, alpha: number, align: CanvasTextAlign = "left", weight = 600, display = false): void {
  const a = f.P(p[0], p[1], p[2]);
  const b = f.P(p[0] + 0.1, p[1], p[2]);
  const c = f.P(p[0], p[1] - 0.1, p[2]);
  if (!a || !b || !c || alpha <= 0.003) return;
  const k = 0.1 * a.s * f.u;
  const { ctx } = f;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.transform((b.x - a.x) / k, (b.y - a.y) / k, (c.x - a.x) / k, (c.y - a.y) / k, 0, 0);
  ctx.translate(-a.x, -a.y);
  f.label(text, p, { size: size * a.s * f.u, colour, alpha, align, weight, display });
  ctx.restore();
}

/** clip to a quad on screen (the caller restores); false when a corner is behind the camera */
function clipTo(f: Frame, quad: readonly V3[]): boolean {
  const pts = quad.map((q) => f.P(q[0], q[1], q[2]));
  if (pts.some((p) => !p)) return false;
  f.ctx.save();
  f.ctx.beginPath();
  for (const p of pts) if (p) f.ctx.lineTo(p.x, p.y);
  f.ctx.closePath();
  f.ctx.clip();
  return true;
}

/** light entering a face from one side: a gradient clipped to the outline */
function wash(f: Frame, quad: readonly V3[], from: V3, to: V3, colour: string, alpha: number): void {
  const a = f.P(from[0], from[1], from[2]);
  const b = f.P(to[0], to[1], to[2]);
  if (!a || !b || alpha <= 0.003 || !clipTo(f, quad)) return;
  const g = f.ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0, rgba(colour, alpha));
  g.addColorStop(0.35, rgba(colour, alpha * 0.3));
  g.addColorStop(1, rgba(colour, 0));
  f.ctx.fillStyle = g;
  f.ctx.fillRect(0, 0, f.w, f.h);
  f.ctx.restore();
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = f.mobile ? 11 : 18;
    const shift = Math.floor(f.rnd(3) * 4);
    return {
      up: candles(f, n, 1, 1.1, 0.7),
      down: candles(f, n, 2, -0.8, 1.2),
      line: walk(f, 30, 3, -0.45, 1.6, 0.05),
      area: walk(f, 30, 4, 0.8, 0.9, 0.04),
      hist: Array.from({ length: Math.round(n * 1.5) }, (_, i) => Math.sin(i * 0.46 + f.rnd(9) * TAU) * 0.8 + (f.rnd(120 + i) - 0.5) * 0.3),
      watch: Array.from({ length: f.mobile ? 7 : 10 }, (_, i) => 0.55 + f.rnd(60 + i) * 0.45),
      // which drawing sits in which window, and which key and row are selected, differ per page
      kinds: [0, 1, 2, 3].map((j) => (j + shift) % 4),
      pick: 1 + Math.floor(f.rnd(5) * 4),
    };
  },
  draw(f, s) {
    const { pal } = f;
    f.aim(-0.26 + (f.still ? 0 : Math.sin(f.t * 0.09) * 0.035), 0.12, 6.4, f.mobile ? 0.6 : 0.78);
    f.cx = f.w * (f.mobile ? 0.53 : 0.712);
    f.cy -= f.h * (f.mobile ? 0.09 : 0.045);
    // lettering only where it can be read: on small stages the same places carry plain bars
    const text = !f.mobile && f.u * f.cam.zoom > 140;
    const b = f.boot;
    const up = f.on(0, 0.4);
    const breathe = f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.7);

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [0, FLOOR, -0.1], 2.7, pal.key, 0.2 * b);

    // the sequence: a cursor walks the seven regions, quickly at power-on, then one region every few seconds
    const LEAD = 0.25;
    const STEP = 0.26;
    const END = LEAD + 7 * STEP;
    const cur = f.still ? 2.5 : f.t < END ? (f.t - LEAD) / STEP : 7 + (f.t - END) / 5.5;
    const lit = (i: number) => (f.still ? 1 : easeOut((f.t - LEAD - i * STEP) / 0.7)) * up;
    const hot = (i: number) => easeInOut(clamp((0.625 - Math.abs(((((cur - i - 0.5) % 7) + 10.5) % 7) - 3.5)) * 4)) * lit(i);

    // ── the rail: a machined block with a lit slot, the light source of the whole instrument
    const rx = W / 2 + 0.12;
    const rz = 0.2;
    const top = FLOOR + RAIL;
    // the pane, faintly mirrored in the deck under the grid
    wash(f, [[-W / 2, FLOOR, 0], [W / 2, FLOOR, 0], [W / 2, FLOOR - 0.6, 0], [-W / 2, FLOOR - 0.6, 0]], [0, FLOOR, 0], [0, FLOOR - 0.6, 0], pal.key, 0.065 * up);
    const front: V3[] = [[-rx, FLOOR, -rz], [rx, FLOOR, -rz], [rx, top, -rz], [-rx, top, -rz]];
    const lid: V3[] = [[-rx, top, -rz], [rx, top, -rz], [rx, top, rz], [-rx, top, rz]];
    const end: V3[] = [[-rx, FLOOR, rz], [-rx, FLOOR, -rz], [-rx, top, -rz], [-rx, top, rz]];
    [end, lid, front].forEach((face, i) => {
      f.fill(face, pal.bg, 0.94 * b);
      f.fill(face, pal.ink, [0.035, 0.085, 0.05][i] * b);
    });
    wash(f, front, [0, top, -rz], [0, FLOOR, -rz], pal.ink, 0.13 * b);
    wash(f, lid, [0, top, 0], [0, top, -rz * 1.6], pal.key, 0.42 * up * breathe);
    for (const face of [end, lid, front]) f.path(face, pal.ink, 0.21 * b, 1, true);
    f.line(front[3], front[2], pal.ink, 0.55 * b, 1.25);
    // index marks on the rail under each vertical rule of the glass
    for (const u of [U0, UW, UC, U1]) f.line([(u - 0.5) * W, top, -rz], [(u - 0.5) * W, top - 0.035, -rz], pal.ink, 0.5 * b, 1);
    if (text) engrave(f, PLATE, [-W / 2, FLOOR + RAIL * 0.5, -rz], 0.046, pal.gold, 0.7 * b);

    // ── the glass: a smoked slab whose polished top and near edges catch the light from the slot
    const { at } = panel(f, [0, top + H / 2, 0], W, H, { on: up, colour: pal.key, alpha: 0.6, glass: 0.04 });
    const glass: V3[] = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
    f.fill([at(0, 1), at(1, 1), at(1, 1, -THICK), at(0, 1, -THICK)], pal.key, 0.3 * up);
    f.fill([at(0, 0), at(0, 1), at(0, 1, -THICK), at(0, 0, -THICK)], pal.key, 0.2 * up);
    f.path([at(0, 0, -THICK), at(0, 1, -THICK), at(1, 1, -THICK), at(1, 1)], pal.ink, 0.26 * up, 1);
    wash(f, glass, at(0.5, 0), at(0.5, 0.62), pal.key, 0.22 * up * breathe);
    trace(f, [at(0, 0), at(1, 0)], pal.key, 0.75 * up * breathe, 1.5);

    // the numeral: large, very faint, engraved in the lower corner and bleeding off the glass
    if (up > 0 && clipTo(f, glass)) {
      engrave(f, "5", at(0.885, 0.31), 1.4, pal.gold, 0.065 * up, "center", 300, true);
      f.ctx.restore();
    }

    // the rules
    const rule = 0.2 * up;
    f.path([at(U0, V0), at(U1, V0), at(U1, V1), at(U0, V1)], pal.ink, rule, 1, true);
    f.line(at(U0, VT), at(lerp(U0, U1, up), VT), pal.ink, rule, 1);
    f.line(at(U0, VB), at(lerp(U0, U1, up), VB), pal.ink, rule, 1);
    f.line(at(UW, VT), at(UW, lerp(VT, VB, up)), pal.ink, rule, 1);
    f.line(at(UC, VT), at(UC, lerp(VT, VB, up)), pal.ink, rule, 1);
    f.line(at(UW, VC), at(lerp(UW, U1, up), VC), pal.ink, rule, 1);

    // each region lights in turn: a tint in the glass and a lit rule along its top; the focused one is brighter
    const cells = CELLS.map((r, i): Cell => {
      const k = lit(i);
      const h = hot(i);
      const quad: V3[] = [at(r[0], r[1]), at(r[2], r[1]), at(r[2], r[3]), at(r[0], r[3])];
      f.fill(quad, pal.key, (0.03 + 0.07 * h) * k);
      f.path(quad, pal.key, 0.42 * h, 1, true);
      f.line(quad[3], at(lerp(r[0], r[2], k), r[3]), pal.key, (0.3 + 0.5 * h) * k, 1.25);
      return (x, y, lift = 0) => at(lerp(r[0], r[2], x), lerp(r[1], r[3], y), lift);
    });

    // ── toolbar: the menu, groups of keys (one pressed), the timeframes, the search field
    let m = cells[0];
    let k = lit(0);
    for (let i = 0; i < 7; i++) f.line(m(0.012 + i * 0.036, 0.78), m(0.012 + i * 0.036 + (0.016 + (i % 3) * 0.005) * k, 0.78), pal.ink, 0.42 * k, 1.5);
    for (let i = 0; i < 3; i++) f.dot(m(0.952 + i * 0.016, 0.78), 0.011, pal.ink, 0.35 * k);
    f.line(m(0, 0.58), m(1, 0.58), pal.ink, 0.07 * k, 1);
    let x = 0.012;
    let key = 0;
    for (const group of f.mobile ? [3, 4] : [4, 3, 5]) {
      for (let j = 0; j < group; j++, key++, x += 0.0255) {
        const down = key === s.pick;
        f.fill([m(x, 0.14), m(x + 0.019, 0.14), m(x + 0.019, 0.44), m(x, 0.44)], down ? pal.key : pal.ink, (down ? 0.55 : 0.13) * k);
      }
      f.line(m(x + 0.004, 0.12), m(x + 0.004, 0.46), pal.ink, 0.14 * k, 1);
      x += 0.014;
    }
    TF.forEach((name, i) => {
      const u = 0.4 + i * 0.047;
      const sel = i === 4;
      if (text) engrave(f, name, m(u, 0.29), 0.046, sel ? pal.key : pal.ink2, (sel ? 0.95 : 0.55) * k, "center");
      else f.line(m(u - 0.012, 0.29), m(u + 0.012, 0.29), sel ? pal.key : pal.ink, (sel ? 0.8 : 0.3) * k, 1.5);
      if (sel && text) f.line(m(u - 0.016, 0.08), m(u + 0.016, 0.08), pal.key, 0.8 * k, 1.5);
    });
    f.path([m(0.86, 0.14), m(0.988, 0.14), m(0.988, 0.44), m(0.86, 0.44)], pal.ink, 0.22 * k, 1, true);

    // ── market watch: a table of rows, one of them selected
    m = cells[1];
    k = lit(1);
    if (text) engrave(f, WATCH, m(0.07, 0.957), 0.042, pal.ink2, 0.7 * k);
    else f.line(m(0.07, 0.957), m(0.5, 0.957), pal.ink, 0.35 * k, 1.5);
    f.line(m(0, 0.918), m(1, 0.918), pal.ink, 0.1 * k, 1);
    f.line(m(0.55, 0.918), m(0.55, 0.03), pal.ink, 0.07 * k, 1);
    f.line(m(0.775, 0.918), m(0.775, 0.03), pal.ink, 0.07 * k, 1);
    const rows = s.watch.length;
    const step = 0.88 / rows;
    for (let i = 0; i < rows; i++) {
      const on = clamp(k * (rows + 3) - i);
      const y = 0.918 - (i + 0.5) * step;
      const sel = i === s.pick + 1;
      if (sel) f.fill([m(0, y - step / 2), m(1, y - step / 2), m(1, y + step / 2), m(0, y + step / 2)], pal.key, 0.14 * on);
      f.dot(m(0.075, y), 0.011, sel ? pal.key : pal.ink, (sel ? 0.9 : 0.4) * on);
      f.line(m(0.15, y), m(0.15 + 0.34 * s.watch[i] * on, y), pal.ink, (sel ? 0.8 : 0.5) * on, 1.5);
      f.line(m(0.6, y), m(0.6 + 0.13 * on, y), pal.teal, 0.6 * on, 1.5);
      f.line(m(0.825, y), m(0.825 + 0.13 * on, y), pal.teal, 0.6 * on, 1.5);
    }

    // ── the four chart windows: no symbol, no scale, each a different drawing
    for (let w = 0; w < 4; w++) {
      m = cells[2 + w];
      k = lit(2 + w);
      if (k <= 0) continue;
      const kind = s.kinds[w];
      const drawn = clamp(k * 1.5 - 0.35);
      f.line(m(0, 0.9), m(1, 0.9), pal.ink, 0.09 * k, 1);
      f.line(m(0.035, 0.95), m(0.035 + 0.12 * k, 0.95), pal.ink, 0.32 * k + 0.4 * hot(2 + w), 1.5);
      for (let i = 1; i < 3; i++) f.line(m(0.03, i * 0.29), m(0.97, i * 0.29), pal.ink, 0.05 * k, 1);
      if (kind === 0 || kind === 3) {
        // candles; the fourth kind stacks an oscillator in its own sub-window, as the terminal does
        const series = kind === 0 ? s.up : s.down;
        const lo = kind === 0 ? 0.14 : 0.45;
        const span = kind === 0 ? 0.6 : 0.34;
        series.forEach((c, i) => {
          const a = clamp(drawn * series.length - i);
          const u = 0.06 + ((i + 0.5) / series.length) * 0.88;
          const colour = c.c >= c.o ? pal.emerald : pal.crimson;
          f.line(m(u, lo + c.l * span), m(u, lo + c.h * span), colour, 0.6 * a, 1);
          f.line(m(u, lo + c.o * span), m(u, lo + c.c * span), colour, 0.85 * a, f.mobile ? 2 : 3.5);
        });
        if (kind === 3) {
          f.line(m(0, 0.36), m(1, 0.36), pal.ink, 0.1 * k, 1);
          s.hist.forEach((v, i) => {
            const u = 0.06 + ((i + 0.5) / s.hist.length) * 0.88;
            f.line(m(u, 0.2), m(u, 0.2 + v * 0.12), pal.teal, 0.55 * clamp(drawn * s.hist.length - i), f.mobile ? 1.5 : 2.5);
          });
        }
      } else {
        // a line of light just off the glass; the area kind is filled down to its floor
        const series = kind === 1 ? s.line : s.area;
        const colour = kind === 1 ? pal.teal : pal.blue;
        const count = Math.round(drawn * series.length);
        const pts: V3[] = [];
        for (let i = 0; i < count; i++) pts.push(m(0.05 + (i / (series.length - 1)) * 0.9, 0.14 + series[i] * 0.62, 0.02));
        if (kind === 2 && count > 1) wash(f, [...pts, m(0.05 + ((count - 1) / (series.length - 1)) * 0.9, 0.04), m(0.05, 0.04)], m(0.5, 0.78), m(0.5, 0.04), colour, 0.3 * k);
        trace(f, pts, colour, 0.8 * k, 1.25, drawn >= 1 ? f.t / (9 + w) : -1);
      }
    }

    // ── toolbox: a table of thin bars and its row of tabs, the first one open
    m = cells[6];
    k = lit(6);
    for (const c of COLS) f.line(m(c, 0.88), m(c + 0.045 * k, 0.88), pal.ink, 0.34 * k, 1.5);
    f.line(m(0, 0.79), m(1, 0.79), pal.ink, 0.08 * k, 1);
    for (let r = 0; r < 3; r++) {
      const on = clamp(k * 5 - 1 - r);
      COLS.forEach((c, j) => f.line(m(c, 0.67 - r * 0.15), m(c + (0.04 + f.rnd(200 + r * 9 + j) * 0.06) * on, 0.67 - r * 0.15), j === 5 ? pal.key : pal.ink, (j === 5 ? 0.7 : j ? 0.32 : 0.55) * on, 1.5));
    }
    f.line(m(0, 0.2), m(1, 0.2), pal.ink, 0.1 * k, 1);
    f.line(m(0.012, 0.2), m(0.012 + 0.054 * k, 0.2), pal.key, 0.8 * k, 1.5);
    TAB_NAMES.forEach((name, i) => {
      if (text) engrave(f, name, m(TAB_AT[i], 0.1), 0.04, i ? pal.ink2 : pal.key, (i ? 0.5 : 0.95) * k);
      else f.line(m(TAB_AT[i], 0.1), m(TAB_AT[i] + TABS[i].length * 0.009, 0.1), i ? pal.ink : pal.key, (i ? 0.3 : 0.8) * k, 1.5);
    });
  },
};

export default scene;
