/**
 * The homepage's travelling instrument: one small drawing that is four things
 * in turn, as the page moves through its chapters.
 *
 *   0  the market as a whole   a globe
 *   1  one instrument          the form of a chart
 *   2  an order                an entry between a target and a stop
 *   3  the account             a statement with its rows
 *
 * It has no clock of its own. `s` (0 to 3, fractions are the passage between
 * two states) and `rot` (the globe's turn) both come from the scroll position,
 * so scrolling back draws every picture again in reverse.
 *
 * Honesty: these are forms. There is no symbol, no price, no figure and no
 * axis value anywhere in it; the shapes are fixed constants, the same on every
 * visit.
 */

export const STORY_STATES = 4;

/** the drawing's own box: a golden rectangle about the origin, x in -1..1, y in -0.618..0.618 (y down) */
const HALF_H = 0.618;

type Pt = readonly [number, number];
type Path = {
  /** a point along the path, u in 0..1 */
  at: (u: number, rot: number) => Pt;
  /** share of the points this path gets */
  len: number;
  /** the state's one accented line */
  accent?: boolean;
  closed?: boolean;
};

function poly(points: Pt[], accent = false): Path {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    seg.push(d);
    total += d;
  }
  return {
    len: total,
    accent,
    at: (u) => {
      let want = Math.min(1, Math.max(0, u)) * total;
      for (let i = 0; i < seg.length; i++) {
        if (want <= seg[i] || i === seg.length - 1) {
          const t = seg[i] > 0 ? Math.min(1, want / seg[i]) : 0;
          return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
        }
        want -= seg[i];
      }
      return points[points.length - 1];
    },
  };
}

const TAU = Math.PI * 2;
const R = 0.54;

function ring(rx: (rot: number) => number, ry: number, len: number, accent = false): Path {
  return { len, accent, closed: true, at: (u, rot) => [Math.cos(u * TAU) * rx(rot), Math.sin(u * TAU) * ry] };
}

/** 0: a globe. Its meridians are ellipses whose width follows the turn. */
const GLOBE: Path[] = [
  ring(() => R, R, 3.4, true),
  ring(() => R, R * 0.2, 2.3),
  ring((rot) => R * Math.sin(rot), R, 2.6),
  ring((rot) => R * Math.sin(rot + TAU / 6), R, 2.6),
  ring((rot) => R * Math.sin(rot + TAU / 3), R, 2.6),
];

/** 1: the form of a chart. Fixed heights; they stand for no instrument and no period. */
const FORM = [0.3, 0.38, 0.24, 0.42, 0.34, 0.52, 0.47, 0.4, 0.58, 0.66, 0.55, 0.72, 0.63, 0.6, 0.78, 0.86, 0.74, 0.92];
const CHART: Path[] = [
  poly(FORM.map((v, i) => [-0.8 + (i / (FORM.length - 1)) * 1.6, 0.42 - v * 0.86] as const), true),
  poly([
    [-0.86, -0.46],
    [-0.86, 0.48],
    [0.86, 0.48],
  ]),
  poly([
    [-0.86, 0.17],
    [0.86, 0.17],
  ]),
  poly([
    [-0.86, -0.14],
    [0.86, -0.14],
  ]),
];

/** 2: an order. The path arrives at an entry; a target stands above it and a stop below. */
const ORDER: Path[] = [
  poly(
    [
      [-0.3, 0.02],
      [0.62, 0.02],
    ],
    true,
  ),
  poly([
    [-0.86, 0.3],
    [-0.74, 0.22],
    [-0.66, 0.27],
    [-0.54, 0.12],
    [-0.46, 0.16],
    [-0.3, 0.02],
  ]),
  poly([
    [-0.3, -0.36],
    [0.62, -0.36],
  ]),
  poly([
    [-0.3, 0.32],
    [0.62, 0.32],
  ]),
  poly([
    [0.66, -0.36],
    [0.8, -0.36],
    [0.8, 0.32],
    [0.66, 0.32],
  ]),
];

/** 3: the account. A statement: its edge, its heading rule and three rows of different length. */
const ACCOUNT: Path[] = [
  poly([
    [-0.56, -0.2],
    [0.5, -0.2],
  ], true),
  poly([
    [-0.78, -0.5],
    [0.78, -0.5],
    [0.78, 0.5],
    [-0.78, 0.5],
    [-0.78, -0.5],
  ]),
  poly([
    [-0.78, -0.33],
    [0.78, -0.33],
  ]),
  poly([
    [-0.56, 0.04],
    [0.22, 0.04],
  ]),
  poly([
    [-0.56, 0.28],
    [-0.06, 0.28],
  ]),
];

const STATES: Path[][] = [GLOBE, CHART, ORDER, ACCOUNT];

export type StoryPalette = { ink: string; accent: string; gold: string };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t: number) => t * t * (3 - 2 * t);

export type Story = {
  /** Draw the instrument at story position `s` (0..3) into a w × h box (CSS pixels; the context is already scaled). */
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, s: number, rot: number, pal: StoryPalette) => void;
};

export function createStory(n = 240): Story {
  // which path each point rides in each state, and how far along it
  const where = STATES.map((paths) => {
    const total = paths.reduce((a, p) => a + p.len, 0);
    const path = new Uint8Array(n);
    const u = new Float32Array(n);
    let k = 0;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const want = ((i + 0.5) / n) * total;
      while (k < paths.length - 1 && acc + paths[k].len < want) {
        acc += paths[k].len;
        k++;
      }
      path[i] = k;
      u[i] = clamp01((want - acc) / paths[k].len);
    }
    return { path, u };
  });

  const stroke = (ctx: CanvasRenderingContext2D, paths: Path[], rot: number, sc: number, cx: number, cy: number, pal: StoryPalette, alpha: number) => {
    if (alpha < 0.02) return;
    for (const p of paths) {
      ctx.beginPath();
      const steps = p.closed ? 40 : 24;
      for (let j = 0; j <= steps; j++) {
        const [x, y] = p.at(j / steps, rot);
        if (j === 0) ctx.moveTo(cx + x * sc, cy + y * sc);
        else ctx.lineTo(cx + x * sc, cy + y * sc);
      }
      ctx.globalAlpha = alpha * (p.accent ? 0.95 : 0.5);
      ctx.strokeStyle = p.accent ? pal.gold : pal.ink;
      ctx.lineWidth = p.accent ? 1.4 : 1;
      ctx.stroke();
    }
  };

  return {
    draw(ctx, w, h, s, rot, pal) {
      ctx.clearRect(0, 0, w, h);
      const sc = Math.min(w / 2, h / (HALF_H * 2)) * 0.94;
      const cx = w / 2;
      const cy = h / 2;
      const top = STORY_STATES - 1;
      const pos = Math.min(top, Math.max(0, s));
      const a = Math.min(top - 1, Math.floor(pos));
      const b = a + 1;
      const t = ease(pos - a);
      const A = STATES[a];
      const B = STATES[b];
      const wa = where[a];
      const wb = where[b];

      // the points: line art taken apart and put together again
      const loose = Math.sin(t * Math.PI); // 0 at rest, 1 mid-passage
      ctx.fillStyle = pal.ink;
      const size = 1.2 + loose * 0.5;
      for (let i = 0; i < n; i++) {
        const pa = A[wa.path[i]].at(wa.u[i], rot);
        const pb = B[wb.path[i]].at(wb.u[i], rot);
        // each point leaves a little after the one before it, so a passage reads as a sweep
        const own = ease(clamp01((t * 1.35 - (i / n) * 0.35)));
        const x = cx + (pa[0] + (pb[0] - pa[0]) * own) * sc;
        const y = cy + (pa[1] + (pb[1] - pa[1]) * own) * sc;
        const lit = own < 0.5 ? A[wa.path[i]].accent : B[wb.path[i]].accent;
        ctx.globalAlpha = lit ? 0.9 : 0.34 + loose * 0.36;
        if (lit) ctx.fillStyle = pal.accent;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        if (lit) ctx.fillStyle = pal.ink;
      }

      // at rest the points close up into lines
      stroke(ctx, A, rot, sc, cx, cy, pal, 1 - clamp01(t * 3.2));
      stroke(ctx, B, rot, sc, cx, cy, pal, clamp01((t - 0.6875) * 3.2));
      ctx.globalAlpha = 1;
    },
  };
}
