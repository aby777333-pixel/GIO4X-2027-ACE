/**
 * COMPOUND — one rate, applied again and again.
 *
 * A row of columns stands on a rail, one for each period. Every column is the
 * one before it with the rate applied: its body is what it started with, and
 * the cap on top, in champagne, is what the rate added. Because each cap is a
 * share of a taller column than the last, the caps grow, and the line through
 * the tops bends upward instead of running straight.
 *
 * The rate works in both directions, and the scene shows both. When it turns
 * negative the caps become hollow outlines, the part each period took away, and
 * the row sinks along the same kind of curve. A dashed line carries the
 * starting height across the row, so the two cases can be told apart at once.
 *
 * The columns carry no amounts and the rate is nobody's return: this is the
 * arithmetic of the page's formula, start x (1 + rate)^n, and nothing else.
 *
 * The pointer: above the middle of the frame the rate is positive, below it
 * negative, and stronger the further from the middle it is held.
 */
import { clamp, lerp, type Scene, type V3 } from "../engine";
import { deck, eyeX, lamp, pool, slab, trace } from "../kit";

const FLOOR = -0.92;
const RAIL = FLOOR + 0.08;
/** the row: its first and last column, half a column's width and depth */
const [X0, X1, CW, CD] = [-1.12, 1.28, 0.1, 0.13];
/** the starting height, and the rate at its most in either direction */
const [H0, RMAX] = [0.8, 0.11];

type State = { r: number; phase: number };

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { r: 0.08, phase: f.rnd(2) * 6 };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    const count = m ? 7 : 9;
    f.aim(0.2 + (f.still ? 0 : Math.sin(t * 0.08 + s.phase) * 0.035), -0.15, 6.3, 1.08);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, 0], 2.7, pal.key, 0.22 * f.boot);

    // ── the rate: it swings slowly from growth to decay and back; under the pointer it is set by hand
    const auto = RMAX * (f.still ? 0.8 : Math.sin(t * 0.24 + s.phase));
    const held = lerp(-RMAX, RMAX, clamp(1 - (f.my - f.box.y) / f.box.h));
    const want = lerp(auto, held, f.hover);
    s.r = f.still ? want : s.r + (want - s.r) * (1 - Math.exp(-f.dt * 2.5));
    // the row is one period shorter on a phone, so the rate is a little stronger there to reach the same height
    const r = s.r * (m ? 1.3 : 1);
    const grows = r >= 0;
    const tone = grows ? pal.gold : pal.crimson;
    const height = (i: number) => H0 * Math.pow(1 + r, i);
    const xAt = (i: number) => lerp(X0, X1, i / (count - 1));

    // ── the rail, and the starting height carried across the row
    const railOn = f.on(0, 0.35);
    slab(f, [X0 - 0.25, FLOOR, -CD - 0.07], [X1 + 0.25, RAIL, CD + 0.07], pal.ink, 0.07, railOn);
    const dashes = m ? 16 : 26;
    for (let i = 0; i < dashes; i++) {
      const a = lerp(X0 - CW, X1 + CW, i / dashes);
      f.line([a, RAIL + H0, -CD], [a + ((X1 - X0 + 2 * CW) / dashes) * 0.5, RAIL + H0, -CD], pal.ink, 0.4 * railOn, 1);
    }

    // ── the columns, from the one farthest from the camera to the nearest
    const eye = eyeX(f);
    const order = Array.from({ length: count }, (_, i) => i).sort((p, q) => Math.abs(xAt(q) - eye) - Math.abs(xAt(p) - eye));
    for (const i of order) {
      const on = f.on(0.15 + 0.5 * (i / count), 0.3);
      const x = xAt(i);
      const h = height(i) * on;
      const before = (i ? height(i - 1) : height(0)) * on;
      const body = Math.min(h, before);
      slab(f, [x - CW, RAIL, -CD], [x + CW, RAIL + body, CD], pal.key, 0.13 + 0.04 * f.hover, on);
      if (h - before > 0.004) slab(f, [x - CW, RAIL + before, -CD], [x + CW, RAIL + h, CD], pal.gold, 0.26, on);
      // what a negative rate took away: the outline of the part that is no longer there
      if (before - h > 0.004) {
        const gone: V3[] = [[x - CW, RAIL + h, -CD], [x + CW, RAIL + h, -CD], [x + CW, RAIL + before, -CD], [x - CW, RAIL + before, -CD]];
        f.fill(gone, pal.crimson, 0.07 * on);
        f.path(gone, pal.crimson, 0.6 * on, 1, true);
      }
    }

    // ── the line through the tops: it bends, upward or downward, and is never straight
    const drawn = f.on(0.6, 0.4);
    const n = Math.max(12, Math.round(40 * f.q));
    const curve: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * drawn * (count - 1);
      curve.push([xAt(u), RAIL + height(u), -CD]);
    }
    trace(f, curve, tone, 0.95 * drawn, 1.6, f.still ? -1 : t / 9);
    lamp(f, curve[0], pal.ink, drawn, 0.012);
    lamp(f, curve[n], tone, drawn, 0.015);

    // ── time runs along the rail
    const z = -CD - 0.22;
    f.line([X0, FLOOR, z], [X1, FLOOR, z], pal.ink, 0.4 * drawn, 1);
    f.line([X1, FLOOR, z], [X1 - 0.07, FLOOR, z - 0.05], pal.ink, 0.4 * drawn, 1);
    f.line([X1, FLOOR, z], [X1 - 0.07, FLOOR, z + 0.05], pal.ink, 0.4 * drawn, 1);

    const named = f.on(0.85, 0.15);
    const size = m ? 9 : 10;
    const last = Math.max(height(count - 1), height(count - 2));
    ctx.save();
    ctx.letterSpacing = "1.5px";
    f.label("START", [X0 - CW, RAIL + H0, -CD], { align: "right", size, colour: pal.ink, alpha: 0.85 * named, dx: -8 });
    f.label(grows ? "GROWTH" : "DECAY", [X1 + CW, RAIL + last, -CD], { align: "right", size, colour: tone, alpha: 0.95 * named * clamp(Math.abs(r) / 0.03), dy: -14 });
    f.label("TIME", [(X0 + X1) / 2, FLOOR, z], { align: "center", size, colour: pal.ink2, alpha: 0.85 * named, dy: 12 });
    ctx.restore();
  },
};

export default scene;
