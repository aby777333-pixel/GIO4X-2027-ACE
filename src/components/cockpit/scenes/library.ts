/**
 * LIBRARY — the reading list, as a shelf.
 *
 * One bay of a curved bookcase, seen from a little to one side: a cupboard
 * base, a shelf with a lit edge, a row of standing books of different heights
 * and thicknesses, a cornice, and a brass rail along the front on which a small
 * reading lamp rides. The page is a bibliography set out by subject, so the
 * shelf edge carries four brass plates with the subjects the page names. The
 * spines carry gilt bands and nothing else: no title, no author, no cover.
 *
 * The pointer: the book under the cursor slides out of the row, tips forward
 * and opens a few degrees, so the ruled edges of its pages show from above; its
 * neighbours lean away to let it out, and the lamp travels along the rail to
 * stand over it. With the pointer away the lamp drifts slowly along the rail.
 */
import { rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, trace } from "../kit";

/** the bay is an arc about a point in front of it: radius to the spines, the half-angle it spans, how far back its middle stands */
const RS = 3.25;
const SPAN = 0.47;
const ZC = 0.3;
/** a book's depth, and the back of the case */
const D = 0.42;
const RB = RS + D + 0.05;
/** the front of the case and of the brass rail */
const RC = RS - 0.1;
const RR = RS - 0.17;
/** heights: floor, shelf, rail, cornice */
const BASE = -0.94;
const SHELF = -0.48;
const EDGE = 0.1;
const RAIL = 0.82;
const TOP = 1;
/** the subjects the page's own description names */
const SUBJECTS = ["ANALYSIS", "RISK", "PSYCHOLOGY", "QUANTITATIVE"];

type Book = { th: number; w: number; h: number; tone: number; shade: number; bands: number };
type State = { books: Book[]; order: number[]; pull: number[]; lamp: number };

/** a point of the case: angle round the bay, radius, height */
const A = (th: number, r: number, y: number): V3 => [r * Math.sin(th), y, ZC - RS + r * Math.cos(th)];
const arcOf = (r: number, y: number, n: number, from = -SPAN, to = SPAN): V3[] => {
  const o: V3[] = [];
  for (let i = 0; i <= n; i++) o.push(A(from + ((to - from) * i) / n, r, y));
  return o;
};
const add = (o: V3, a: V3, ka: number, b: V3, kb: number, c: V3, kc: number): V3 => [o[0] + a[0] * ka + b[0] * kb + c[0] * kc, o[1] + a[1] * ka + b[1] * kb + c[1] * kc, o[2] + a[2] * ka + b[2] * kb + c[2] * kc];

/** a solid face: dark body, a tint, a hairline */
function face(f: Frame, pts: readonly V3[], colour: string, tint: number, edge: number, level: number): void {
  f.fill(pts, f.pal.bg, 0.95 * level);
  f.fill(pts, colour, tint * level);
  f.path(pts, colour, edge * level, 1, true);
}

/**
 * One book. `pull` (0..1) slides it out, tips it forward and opens its boards;
 * `lean` tilts it sideways; `lit` is how much of the lamp falls on it.
 */
function book(f: Frame, b: Book, cam: V3, colour: string, pull: number, lean: number, lit: number, level: number): void {
  const { pal } = f;
  const st = Math.sin(b.th);
  const ct = Math.cos(b.th);
  // across the spine, up it, and back into the shelf; then tipped forward and leaned
  const tip = 0.34 * pull;
  const up0: V3 = [-st * Math.sin(tip), Math.cos(tip), -ct * Math.sin(tip)];
  const R: V3 = [st * Math.cos(tip), Math.sin(tip), ct * Math.cos(tip)];
  const cl = Math.cos(lean);
  const sl = Math.sin(lean);
  const U: V3 = [up0[0] * cl + ct * sl, up0[1] * cl, up0[2] * cl - st * sl];
  const T: V3 = [ct * cl - up0[0] * sl, -up0[1] * sl, -st * cl - up0[2] * sl];
  const O = A(b.th, RS - 0.3 * pull - (1 - level) * 0.3, SHELF);
  const open = Math.tan(0.2 * pull);
  const pt = (side: number, v: number, d: number): V3 => add(O, T, side * (b.w / 2 + d * open), U, v, R, d);
  const mid = pt(0, b.h / 2, D / 2);
  const see: V3 = [cam[0] - mid[0], cam[1] - mid[1], cam[2] - mid[2]];

  // the boards: whichever the viewer can see (both, once the book stands open)
  for (const side of [-1, 1]) {
    if (side * (see[0] * T[0] + see[1] * T[1] + see[2] * T[2]) - open * (see[0] * R[0] + see[1] * R[1] + see[2] * R[2]) <= 0) continue;
    face(f, [pt(side, 0, 0), pt(side, 0, D), pt(side, b.h, D), pt(side, b.h, 0)], colour, b.shade * 0.55 + 0.1 * lit, 0.3, level);
  }
  // the head of the book: the page block, which fans as the boards part
  const head: V3[] = [pt(-1, b.h, 0), pt(1, b.h, 0), pt(1, b.h, D), pt(-1, b.h, D)];
  f.fill(head, pal.bg, 0.95 * level);
  f.fill(head, pal.ink, (0.16 + 0.3 * pull) * level);
  f.fill(head, pal.gold, 0.3 * lit * level);
  f.path(head, pal.ink, 0.3 * level, 1, true);
  if (pull > 0.03) {
    const leaves = f.q < 0.8 ? 5 : 8;
    for (let j = 0; j < leaves; j++) {
      const u = -0.84 + (1.68 * j) / (leaves - 1);
      f.line(add(O, T, u * b.w * 0.46, U, b.h, R, 0.03), add(O, T, u * (b.w * 0.46 + D * open), U, b.h, R, D), pal.bg, 0.8 * pull * level, 1);
    }
  }
  // the spine, lit from the lamp, with its gilt bands
  const spine: V3[] = [pt(-1, 0, 0), pt(1, 0, 0), pt(1, b.h, 0), pt(-1, b.h, 0)];
  face(f, spine, colour, b.shade, 0.5, level);
  f.fill(spine, pal.gold, 0.24 * lit * level);
  f.line(pt(-0.62, 0.02, 0), pt(-0.62, b.h - 0.02, 0), pal.ink, (0.1 + 0.2 * lit) * level, 1);
  const gilt = (0.42 + 0.5 * lit) * level;
  const band = (v: number) => f.line(pt(-1, b.h * v, 0), pt(1, b.h * v, 0), pal.gold, gilt, 1);
  band(0.1);
  band(0.9);
  if (b.bands > 0) band(0.135);
  if (b.bands > 1) band(0.865);
  // some carry an empty label panel: a frame with nothing written in it
  if (b.bands > 2 && !f.mobile) f.path([pt(-0.6, b.h * 0.6, 0), pt(0.6, b.h * 0.6, 0), pt(0.6, b.h * 0.74, 0), pt(-0.6, b.h * 0.74, 0)], pal.gold, gilt * 0.7, 1, true);
}

const scene: Scene<State> = {
  pose: 10,
  setup(f) {
    const books: Book[] = [];
    const base = f.mobile ? 0.15 : 0.105;
    let th = -SPAN + 0.012;
    for (let i = 0; th < SPAN - 0.02; i++) {
      const w = Math.min(base * (1 + 0.95 * f.rnd(i * 3 + 1)), (SPAN - 0.012 - th) * RS);
      if (w > 0.07) books.push({ th: th + w / 2 / RS, w, h: 0.66 + 0.4 * f.rnd(i * 3 + 2), tone: Math.floor(f.rnd(i * 3 + 3) * 6), shade: 0.1 + 0.13 * f.rnd(i * 7 + 5), bands: Math.floor(f.rnd(i * 5 + 9) * 4) });
      th += w / RS + 0.003;
    }
    return { books, order: books.map((_, i) => i), pull: books.map(() => 0), lamp: 0.16 };
  },
  draw(f, s) {
    const { pal } = f;
    f.aim(0.17 + (f.still ? 0 : Math.sin(f.t * 0.075) * 0.035), -0.2, 6.4, 1.03);
    const { yaw, pitch, dist } = f.cam;
    const cam: V3 = [dist * Math.cos(pitch) * Math.sin(yaw), -dist * Math.sin(pitch), -dist * Math.cos(pitch) * Math.cos(yaw)];
    const ease = 1 - Math.exp(-f.dt * 7);
    const seg = f.mobile ? 12 : 22;
    const n = s.books.length;

    // ── the pointer: which spine it is on
    let pick = -1;
    if (f.hover > 0) {
      let best = 30;
      s.books.forEach((b, i) => {
        const lo = f.P(...A(b.th, RS, SHELF));
        const hi = f.P(...A(b.th, RS, SHELF + b.h));
        if (!lo || !hi || f.my < hi.y - 46 || f.my > lo.y + 30) return;
        const d = Math.abs((lo.x + hi.x) / 2 - f.mx);
        if (d < best) {
          best = d;
          pick = i;
        }
      });
    }
    for (let i = 0; i < n; i++) s.pull[i] += ((i === pick ? f.hover : 0) - s.pull[i]) * ease;
    // the lamp goes to the book in hand; otherwise it drifts along the rail, a minute and a half each way
    const home = f.still ? 0.16 : 0.1 + 0.26 * Math.sin(f.t * 0.035 + f.rnd(4) * 6);
    s.lamp += ((pick >= 0 ? s.books[pick].th : home) - s.lamp) * (f.still ? 1 : 1 - Math.exp(-f.dt * 3.2));

    const body = f.on(0, 0.3);
    const glow = f.on(0.85, 0.3);
    deck(f, { y: BASE, alpha: 0.1 });
    pool(f, [0, BASE, -0.5], 2.3, pal.key, 0.18 * f.boot);

    // ── the case: back, cupboard base, shelf, uprights
    const back = [...arcOf(RB, SHELF, seg), ...arcOf(RB, TOP, seg).reverse()];
    f.fill(back, pal.bg, 0.6 * body);
    f.fill(back, pal.ink, 0.03 * body);
    face(f, [...arcOf(RC + 0.04, BASE, seg), ...arcOf(RC + 0.04, SHELF - EDGE, seg).reverse()], pal.ink, 0.05, 0.2, body);
    for (let k = 0; k < 4; k++) {
      const a = -SPAN + 0.03 + (k * (2 * SPAN - 0.06)) / 4;
      const b = a + (2 * SPAN - 0.06) / 4 - 0.02;
      f.path([...arcOf(RC + 0.04, BASE + 0.07, 5, a + 0.02, b), ...arcOf(RC + 0.04, SHELF - EDGE - 0.07, 5, a + 0.02, b).reverse()], pal.ink, 0.14 * body, 1, true);
      f.dot(A((a + b) / 2 + 0.01, RC + 0.04, SHELF - EDGE - 0.13), 0.012, pal.gold, 0.7 * body);
    }
    const board = [...arcOf(RC, SHELF, seg), ...arcOf(RB, SHELF, seg).reverse()];
    f.fill(board, pal.bg, 0.92 * body);
    f.fill(board, pal.ink, 0.09 * body);
    for (const side of [-1, 1]) {
      const e = side * (SPAN + 0.008);
      const o = side * (SPAN + 0.05);
      face(f, [A(e, RC, BASE), A(e, RB, BASE), A(e, RB, TOP), A(e, RC, TOP)], pal.ink, 0.04, 0.16, body);
      face(f, [A(e, RC, BASE), A(o, RC, BASE), A(o, RC, TOP), A(e, RC, TOP)], pal.ink, 0.12, 0.34, body);
    }

    // ── the books, far to near, shelved one after another at power-on
    const tones = [pal.ink, pal.indigo, pal.blue, pal.crimson, pal.teal, pal.ink];
    const far = (i: number) => {
      const b = s.books[i];
      const p = A(b.th, RS + D / 2 - 0.3 * s.pull[i], SHELF + b.h / 2);
      return (p[0] - cam[0]) ** 2 + (p[1] - cam[1]) ** 2 + (p[2] - cam[2]) ** 2;
    };
    s.order.sort((a, b) => far(b) - far(a));
    for (const i of s.order) {
      const b = s.books[i];
      const level = f.on(0.18 + (0.55 * i) / n, 0.26);
      if (level <= 0.003) continue;
      // a book leans away from the one being drawn out beside it
      let lean = 0;
      for (const [k, by] of [[1, 0.075], [2, 0.03]] as const) lean += by * ((s.pull[i - k] ?? 0) - (s.pull[i + k] ?? 0));
      const away = ((b.th - s.lamp) * RS) / 0.3;
      const lit = glow * Math.exp(-away * away) * (0.55 + 0.45 * s.pull[i]);
      book(f, b, cam, tones[b.tone], s.pull[i], lean, lit, level);
    }

    // ── the shelf edge with its subject plates, and the cornice
    face(f, [...arcOf(RC, SHELF - EDGE, seg), ...arcOf(RC, SHELF, seg).reverse()], pal.ink, 0.13, 0.3, body);
    trace(f, arcOf(RC, SHELF, seg), pal.key, 0.7 * body, 1.25);
    SUBJECTS.forEach((name, k) => {
      const at = SPAN * (-0.75 + 0.5 * k);
      const half = f.mobile ? 0.03 : 0.085;
      f.path([A(at - half, RC, SHELF - EDGE + 0.018), A(at + half, RC, SHELF - EDGE + 0.018), A(at + half, RC, SHELF - 0.018), A(at - half, RC, SHELF - 0.018)], pal.gold, 0.6 * glow, 1, true);
      if (!f.mobile) f.label(name, A(at, RC, SHELF - EDGE / 2), { align: "center", size: 8, colour: pal.gold, alpha: 0.9 * glow, dy: 0.5 });
    });
    face(f, [...arcOf(RC - 0.03, TOP, seg, -SPAN - 0.06, SPAN + 0.06), ...arcOf(RC - 0.03, TOP + 0.08, seg, -SPAN - 0.06, SPAN + 0.06).reverse()], pal.ink, 0.12, 0.34, body);
    f.path(arcOf(RC - 0.03, TOP + 0.08, seg, -SPAN - 0.06, SPAN + 0.06), pal.key, 0.55 * body, 1.25);

    // ── the brass rail on its brackets, and the lamp that rides on it
    const railOn = f.on(0.6, 0.3);
    for (const side of [-1, 1]) f.line(A(side * SPAN, RR, RAIL), A(side * (SPAN + 0.03), RC, RAIL), pal.gold, 0.7 * railOn, 2.5);
    trace(f, arcOf(RR, RAIL, seg, -SPAN * railOn, SPAN * railOn), pal.gold, 0.9 * railOn, 2);
    if (glow > 0.003) {
      const th = s.lamp;
      const held = pick >= 0 ? f.hover : 0;
      const hang = A(th, RR - 0.05, RAIL - 0.13);
      const dw = 0.075 / RS;
      // the light: a cone from the shade to the spines and the shelf, and what it leaves on the shelf edge
      const cone = (wide: number, a: number) => f.fill([A(th - dw * 0.6, RR - 0.05, RAIL - 0.13), A(th + dw * 0.6, RR - 0.05, RAIL - 0.13), A(th + wide, RS - 0.02, SHELF), A(th - wide, RS - 0.02, SHELF)], pal.gold, a * glow);
      cone(0.115, 0.04);
      cone(0.06, 0.045);
      pool(f, A(th, RS - 0.12 - 0.2 * held, SHELF), 0.34 + 0.1 * held, pal.gold, (0.26 + 0.3 * held) * glow);
      f.line(A(th, RR, RAIL), A(th, RR - 0.05, RAIL - 0.05), pal.gold, 0.9 * glow, 2);
      const shade: V3[] = [A(th - dw * 0.4, RR - 0.05, RAIL - 0.05), A(th + dw * 0.4, RR - 0.05, RAIL - 0.05), A(th + dw, RR - 0.05, RAIL - 0.13), A(th - dw, RR - 0.05, RAIL - 0.13)];
      f.fill(shade, pal.bg, 0.95 * glow);
      f.fill(shade, pal.gold, 0.45 * glow);
      f.path(shade, pal.gold, 0.95 * glow, 1.25, true);
      f.dot(A(th, RR, RAIL), 0.022, pal.gold, glow);
      lamp(f, hang, pal.gold, glow * (f.still ? 1 : 0.9 + 0.1 * Math.sin(f.t * 0.8)), 0.018);
      f.glow(hang, 0.5, pal.gold, (0.16 + 0.12 * held) * glow);
    }
    // a quiet reflection of the lit shelf edge in the floor
    f.path(arcOf(RC + 0.04, BASE, seg), rgba(pal.key, 1), 0.3 * body, 1);
  },
};

export default scene;
