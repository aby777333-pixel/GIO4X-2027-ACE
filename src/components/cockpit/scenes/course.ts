/**
 * COURSE — a course to fly.
 *
 * The curriculum drawn as a departure: nine waypoints climb from the near left
 * of the deck to the far right, joined by one line of light. The line is the
 * top edge of a curved wall of smoked glass, so the course has a body and a
 * ground track, as a flight profile does. Behind it stand three graduated
 * altitude bands, the levels of the curriculum, lettered I, II, III; the climb
 * eases level as it reaches each of them.
 *
 * The numerals are lesson order, nothing more. On a lesson page one waypoint,
 * chosen from the page itself, is the champagne one: you are here. On the
 * reading list a short shelf of book spines stands on the deck in place of the
 * altitude bands.
 */
import { TAU, clamp, easeOut, hash, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { box, deck, lamp, pool, ring, trace } from "../kit";

const N = 9;
const LEVELS = ["I", "II", "III"];
const FLOOR = -1.3;
const LOW = -0.9;
const HIGH = 1.0;
const GEM = 0.068;
/** the altitude bands share one axis: centre x, centre z, radius */
const BAND = [0.06, 0.05, 1.45] as const;
/** the bookshelf stands on the deck in front of the course: near and far z of the row */
const SHELF = [-0.86, -0.6] as const;

type Book = { x: number; w: number; h: number };
type State = { pts: V3[]; ground: V3[]; runs: V3[][]; strata: V3[][]; dirs: [number, number][]; books: Book[]; per: number; yaw: number; phase: number };

const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
};
/** a step climb: the course eases level as it reaches each third of its height */
const climb = (t: number) => t - 0.022 * Math.sin(LEVELS.length * TAU * t);
const levelY = (k: number) => lerp(LOW, HIGH, (k + 1) / LEVELS.length);

/** one altitude band: a graduated arc standing behind the course, lettered at its lit end */
function band(f: Frame, s: State, y: number, colour: string, on: number, name: string, ink: CanvasGradient | string): void {
  if (on <= 0.003) return;
  const { ctx, pal } = f;
  const at = (i: number, drop = 0) => f.P(BAND[0] + s.dirs[i][0] * BAND[2], y - drop, BAND[1] + s.dirs[i][1] * BAND[2]);
  const last = Math.round((s.dirs.length - 1) * on);
  const stroke = (to: number, style: CanvasGradient | string, width: number, ticks: boolean) => {
    ctx.beginPath();
    for (let i = 0; i <= to; i++) {
      const p = at(i);
      if (!p) continue;
      if (ticks) {
        const q = at(i, i % 4 === 0 ? 0.08 : 0.036);
        if (!q) continue;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  ctx.save();
  ctx.globalAlpha = on;
  stroke(last, ink, 1, false);
  stroke(last, ink, 1, true);
  stroke(Math.min(last, Math.round(s.dirs.length * 0.18)), rgba(colour, 0.62), 1.5, false);
  ctx.restore();
  const end: V3 = [BAND[0] + BAND[2], y, BAND[1]];
  const e = at(0);
  // the letter stands beside the lit end, or above it where the stage is too narrow to hold it
  const tight = f.mobile || !e || e.x + 36 > f.w;
  f.dot(end, 0.015, colour, 0.9 * on);
  f.label(name, end, { dx: tight ? -2 : 11, dy: tight ? -11 : 0, align: tight ? "right" : "left", size: 11, colour: pal.ink, alpha: 0.82 * on });
}

/** a waypoint marker: a small octahedron of glass, its near faces catching the light */
function gem(f: Frame, c: V3, r: number, colour: string, on: number): void {
  if (on <= 0.003) return;
  const h = r * 1.4;
  const T: V3 = [c[0], c[1] + h, c[2]];
  const B: V3 = [c[0], c[1] - h, c[2]];
  const L: V3 = [c[0] - r, c[1], c[2]];
  const R: V3 = [c[0] + r, c[1], c[2]];
  const Nr: V3 = [c[0], c[1], c[2] - r];
  f.fill([T, R, B, L], f.pal.bg, 0.78 * on);
  f.fill([T, L, Nr], colour, 0.3 * on);
  f.fill([T, Nr, R], colour, 0.13 * on);
  f.fill([B, L, Nr], colour, 0.16 * on);
  f.fill([B, Nr, R], colour, 0.05 * on);
  f.path([T, R, B, L], colour, 0.8 * on, 1, true);
  f.path([L, Nr, R], colour, 0.55 * on, 1);
  f.path([T, Nr, B], f.pal.ink, 0.3 * on, 1);
}

/** you are here: half of a graduated champagne collar, tipped toward the eye so it reads at any height */
function collar(f: Frame, c: V3, r: number, front: boolean, on: number): void {
  const at = (a: number, k = 1): V3 => [c[0] + Math.cos(a) * r * k, c[1] + Math.sin(a) * r * k * 0.3, c[2] + Math.sin(a) * r * k * 0.95];
  const from = front ? Math.PI : 0;
  const pts: V3[] = [];
  for (let i = 0; i <= 16; i++) pts.push(at(from + (Math.PI * i) / 16));
  f.path(pts, f.pal.gold, (front ? 0.9 : 0.45) * on, front ? 1.25 : 1);
  if (front) for (let i = 1; i < 8; i++) f.line(at(from + (Math.PI * i) / 8), at(from + (Math.PI * i) / 8, i === 4 ? 0.78 : 0.88), f.pal.gold, 0.8 * on, 1);
}

/** a book standing on the shelf: a solid body, its spine toward the viewer, with raised bands */
function spine(f: Frame, b: Book, y0: number, colour: string, on: number): void {
  const x1 = b.x + b.w;
  const y1 = y0 + b.h * on;
  const faces: [V3[], number][] = [
    [[[b.x, y0, SHELF[1]], [b.x, y0, SHELF[0]], [b.x, y1, SHELF[0]], [b.x, y1, SHELF[1]]], 0.05],
    [[[b.x, y0, SHELF[0]], [x1, y0, SHELF[0]], [x1, y1, SHELF[0]], [b.x, y1, SHELF[0]]], 0.15],
    [[[b.x, y1, SHELF[0]], [x1, y1, SHELF[0]], [x1, y1, SHELF[1]], [b.x, y1, SHELF[1]]], 0.34],
  ];
  for (const [quad, tint] of faces) {
    f.fill(quad, f.pal.bg, 0.94 * on);
    f.fill(quad, colour, tint * on);
    f.path(quad, colour, 0.5 * on, 1, true);
  }
  for (const v of [0.86, 0.78, 0.14]) f.line([b.x, lerp(y0, y1, v), SHELF[0]], [x1, lerp(y0, y1, v), SHELF[0]], f.pal.gold, 0.75 * on, 1);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const per = f.mobile ? 3 : 6;
    const seg = (N - 1) * per;
    const bow = (f.rnd(1) - 0.5) * 0.3;
    const pts: V3[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      pts.push([bez(-1.05, -0.15, 0.8, 1.25, t), lerp(LOW, HIGH, climb(t)), bez(-0.95, -1.0 - bow, 0.05 + bow, 0.95, t)]);
    }
    const ground = pts.map((p): V3 => [p[0], FLOOR, p[2]]);
    const third = seg / LEVELS.length;
    const runs = LEVELS.map((_, k) => pts.slice(k * third, (k + 1) * third + 1));
    const strata = LEVELS.slice(1).map((_, k) => pts.slice((k + 1) * third).map((p): V3 => [p[0], levelY(k), p[2]]));
    const n = Math.round((f.mobile ? 28 : 48) * f.q);
    const dirs: [number, number][] = [];
    for (let i = 0; i <= n; i++) dirs.push([Math.cos((i / n) * 0.47 * TAU), Math.sin((i / n) * 0.47 * TAU)]);
    const books: Book[] = [];
    let x = 0.5;
    for (let i = 0; i < 8; i++) {
      const w = 0.06 + f.rnd(20 + i) * 0.045;
      books.push({ x, w, h: 0.36 + f.rnd(40 + i) * 0.24 });
      x += w + 0.012;
    }
    return { pts, ground, runs, strata, dirs, books, per, yaw: (f.rnd(3) - 0.5) * 0.08, phase: f.rnd(2) };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    // seen from a little above, so the deck carries the ground track of the course
    const sway = f.still ? 0 : Math.sin(f.t * 0.08) * 0.03;
    f.aim(0.12 + s.yaw + sway, -0.13, 6.4, f.mobile ? 0.67 : 0.86);
    if (f.mobile) {
      f.cx = f.w * 0.5;
      f.cy = f.h * 0.235;
    } else f.cy -= f.u * 0.16;

    const shelf = f.tag === "books";
    const pick = f.tag && !shelf ? (hash(f.tag) + f.seed) % N : -1;
    const seg = s.pts.length - 1;
    const third = seg / LEVELS.length;
    const tone = [pal.blue, pal.teal, pal.emerald];
    const toneOf = (i: number) => tone[Math.min(tone.length - 1, Math.floor((i * LEVELS.length) / N))];

    // the levels of the curriculum: three altitude bands behind everything, fading toward the statement
    if (!shelf) {
      const r = f.P(BAND[0] + BAND[2], 0, BAND[1]);
      const l = f.P(BAND[0] - BAND[2], 0, BAND[1]);
      let ink: CanvasGradient | string = rgba(pal.ink, 0.18);
      if (r && l) {
        const g = ctx.createLinearGradient(r.x, 0, l.x, 0);
        g.addColorStop(0, rgba(pal.ink, 0.36));
        g.addColorStop(0.5, rgba(pal.ink, 0.17));
        g.addColorStop(1, rgba(pal.ink, 0));
        ink = g;
      }
      for (let k = 0; k < LEVELS.length; k++) band(f, s, levelY(k), tone[k], f.on(0.1 + k * 0.22, 0.5), LEVELS[k], ink);
      // as a dimension line does, a band breaks where a waypoint's numeral will stand in front of it
      for (let i = 0; i < N; i++) {
        const p = s.pts[i * s.per];
        const q = i === pick || !f.mobile ? f.P(p[0], p[1] + (i === pick ? 1.32 : 1) * GEM * 1.4, p[2]) : null;
        if (q) ctx.clearRect(q.x - 11, q.y - 16, 22, 14);
      }
    }

    // waypoints and books stand on this deck, so it does not slide under them
    deck(f, { y: FLOOR, alpha: 0.12, drift: 0 });
    pool(f, [0.25, FLOOR, 0], 2.5, pal.key, 0.2 * f.boot);

    // the plan comes first: the ground track on the deck. Then the course is flown along it.
    trace(f, s.ground, pal.key, 0.3 * f.on(0, 0.3), 1);
    const drawn = clamp((f.boot - 0.12) / 0.72);
    const m = Math.round(seg * drawn);
    if (m < 1) return;

    // the wall of smoked glass under the course: lit from above, with one slow sheen across it
    const hi = f.P(0, HIGH, 0);
    const lo = f.P(0, FLOOR, 0);
    const p0 = f.P(s.ground[0][0], FLOOR, s.ground[0][2]);
    const p1 = f.P(s.ground[seg][0], FLOOR, s.ground[seg][2]);
    if (hi && lo && p0 && p1) {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= m; i++) {
        const p = f.P(s.pts[i][0], s.pts[i][1], s.pts[i][2]);
        if (p) ctx.lineTo(p.x, p.y);
      }
      for (let i = m; i >= 0; i--) {
        const p = f.P(s.ground[i][0], FLOOR, s.ground[i][2]);
        if (p) ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(pal.bg, 0.46);
      ctx.fill();
      const g = ctx.createLinearGradient(0, hi.y, 0, lo.y);
      g.addColorStop(0, rgba(pal.key, 0.24));
      g.addColorStop(0.5, rgba(pal.key, 0.08));
      g.addColorStop(1, rgba(pal.key, 0.02));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.clip();
      const at = clamp(0.6 + f.px * 0.2 + (f.still ? 0 : Math.sin(f.t * 0.21) * 0.05), 0.2, 0.85);
      const sheen = ctx.createLinearGradient(p0.x, lo.y, p1.x, lo.y - (p1.x - p0.x) * 0.3);
      sheen.addColorStop(at - 0.07, rgba(pal.ink, 0));
      sheen.addColorStop(at, rgba(pal.ink, 0.05 * drawn));
      sheen.addColorStop(at + 0.012, rgba(pal.ink, 0.015 * drawn));
      sheen.addColorStop(at + 0.05, rgba(pal.ink, 0));
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, f.w, f.h);
      ctx.restore();
    }
    if (!shelf) for (let k = 0; k < s.strata.length; k++) f.path(s.strata[k], tone[k], 0.2 * f.on(0.9, 0.3), 1);

    // mullions: each waypoint stands on a hairline down to its pad on the ground track
    for (let i = 0; i < N && i * s.per <= m; i++) {
      const p = s.pts[i * s.per];
      const here = i === pick;
      const under = p[1] - GEM * 1.4;
      f.line([p[0], FLOOR, p[2]], [p[0], under, p[2]], here ? pal.gold : pal.ink, here ? 0.42 : 0.15, 1);
      f.line([p[0], Math.max(FLOOR, under - 0.2), p[2]], [p[0], under, p[2]], here ? pal.gold : toneOf(i), 0.5, 1);
      ring(f, [p[0], FLOOR, p[2]], here ? 0.085 : 0.045, { colour: here ? pal.gold : pal.ink, alpha: here ? 0.8 : 0.34, seg: 14 });
    }

    // the course itself: one line of light, finer as it climbs away
    for (let k = 0; k < LEVELS.length && m > k * third; k++) {
      const run = m >= (k + 1) * third ? s.runs[k] : s.pts.slice(k * third, m + 1);
      trace(f, run, pal.key, (pick >= 0 ? 0.72 : 0.88) - k * 0.08, 1.75 - k * 0.22);
    }

    // a light climbs the course, slowly, and each waypoint warms as it passes
    const ph = f.still ? 0.5625 : (f.t / 28 + s.phase) % 1;
    const fade = f.still ? 1 : clamp(ph / 0.05) * clamp((1 - ph) / 0.05) * clamp((f.boot - 0.9) / 0.1);
    if (fade > 0) {
      const x = ph * seg;
      const i = Math.min(seg - 1, Math.floor(x));
      const a = s.pts[i];
      const b = s.pts[i + 1];
      const p: V3 = [lerp(a[0], b[0], x - i), lerp(a[1], b[1], x - i), lerp(a[2], b[2], x - i)];
      // its wake: three overlaid lengths, so the brightness tapers away behind it
      for (let k = 0; k < 3; k++) f.path([...s.pts.slice(Math.max(0, i - s.per + Math.floor((k * s.per) / 3)), i + 1), p], pal.ink, 0.16 * fade, 2);
      f.glow(p, 0.22, pal.key, 0.6 * fade);
      f.dot(p, 0.016, pal.ink, 0.95 * fade);
    }

    // waypoints, far to near: glass markers with a lamp inside, numbered in lesson order
    for (let i = N - 1; i >= 0; i--) {
      if (i * s.per > m) continue;
      const p = s.pts[i * s.per];
      const here = i === pick;
      const on = easeOut((f.boot - 0.12 - (0.72 * i) / (N - 1)) / 0.14);
      const colour = here ? pal.gold : toneOf(i);
      const size = here ? GEM * 1.32 : GEM;
      const warm = Math.exp(-Math.pow((ph - i / (N - 1)) * (N - 1) * 1.6, 2)) * fade;
      // you are here: a champagne collar round the marker and its light on the deck
      if (here) pool(f, [p[0], FLOOR, p[2]], 0.55, pal.gold, 0.24 * on);
      if (here) collar(f, p, 0.22, false, on);
      gem(f, p, size, colour, on * (pick >= 0 && !here ? 0.72 : 1));
      if (here) lamp(f, p, colour, on * (f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 1.1)), 0.02);
      else {
        // the lamp inside the glass: a steady point, with a halo only while the climbing light is near
        if (warm > 0.01) f.glow(p, 0.13, colour, 0.5 * warm * on);
        f.dot(p, 0.014, colour, (0.75 + 0.25 * warm) * on);
        f.dot(p, 0.006, pal.ink, (0.5 + 0.4 * warm) * on);
      }
      if (here) collar(f, p, 0.22, true, on);
      // lesson order, nothing more; a phone keeps only the page's own numeral
      if (here || !f.mobile) {
        const style = here ? { size: 12, weight: 700, colour: pal.gold, alpha: on } : { size: 10, colour: pal.ink2, alpha: (pick >= 0 ? 0.58 : 0.78) * on };
        f.label(String(i + 1).padStart(2, "0"), [p[0], p[1] + size * 1.4, p[2]], { dy: -9, align: "center", ...style });
      }
    }

    // the reading list: a short shelf of spines on the deck, beside the course
    if (shelf) {
      const on = f.on(0.7, 0.3);
      const end = s.books[s.books.length - 1];
      const y0 = FLOOR + 0.035;
      pool(f, [0.9, FLOOR, -0.7], 0.95, pal.gold, 0.22 * on);
      box(f, [0.44, FLOOR, SHELF[0] - 0.05], [end.x + end.w + 0.06, y0, SHELF[1] + 0.05], pal.ink, 0.34 * on, 0.06 * on);
      // the row is right of the eye, so the far end is drawn first
      for (let i = s.books.length - 1; i >= 0; i--) spine(f, s.books[i], y0, i % 3 === 1 ? pal.ink2 : pal.gold, f.on(0.72 + i * 0.03, 0.25));
    }
  },
};

export default scene;
