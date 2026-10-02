/**
 * SEAL — the signet press.
 *
 * On the left a small screw press: a bed, two columns, a beam, and a screw with
 * a cross handle that carries the seal die over a card. On the right the
 * reference plate, a pane of glass engraved with the registry's mark: a ring of
 * twelve cut segments, no two cut to the same depth. The card under the die
 * carries a mark of its own. The page does exactly this with an address: it
 * compares what you paste, piece by piece, with the list it publishes.
 *
 * The pointer makes the comparison. Carried from the plate towards the card it
 * draws a ray from one mark to the other through the cursor; the ray goes round
 * both marks together, each segment that agrees lights in champagne on the
 * plate and on the card, one after another, and the screw turns the die down
 * as they do. Taken away, the press rests raised and only a slow index light
 * goes round the two marks in step.
 *
 * Nothing here is a result: the instrument does not say an address is genuine.
 */
import { TAU, clamp, easeInOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, panel, pool, trace } from "../kit";

/** the press: its axis, the deck, the top of the bed, the beam, the columns */
const PX = -0.74;
const FLOOR = -0.8;
const BED = -0.67;
const BEAM0 = 0.4;
const BEAM1 = 0.54;
const COL = 0.56;
/** the die: radius, height, the height it rests at and how far the screw brings it down */
const DR = 0.27;
const DH = 0.15;
const UP = -0.02;
const TRAVEL = 0.31;
const SCREW = 1.0;
/** the two marks: on the card, and on the reference plate */
const RC = 0.3;
const RP = 0.37;
const N = 12;
/** the plate is turned a little towards the press */
const TURN = 0.3;

type Seg = { a0: number; a1: number; r0: number };
type State = { segs: Seg[]; circ: [number, number][]; drop: number };
/** from a mark's own plane (in radii) to the world */
type Plane = (u: number, v: number) => V3;

function tint(f: Frame, q: readonly V3[], style: string | CanvasGradient): void {
  const { ctx } = f;
  ctx.beginPath();
  for (let i = 0; i < q.length; i++) {
    const p = f.P(q[i][0], q[i][1], q[i][2]);
    if (!p) return;
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = style;
  ctx.fill();
}

/** a machined face: a dark body under a tone of the metal, with a fine edge */
function solid(f: Frame, q: readonly V3[], tone: number, level: number, edge = 0.24): void {
  tint(f, q, rgba(f.pal.bg, 0.95 * level));
  f.fill(q, f.pal.ink, tone * level);
  f.path(q, f.pal.ink, edge * level, 1, true);
}

/** a slab: the flank the visitor can see, then its top and its face */
function block(f: Frame, x0: number, x1: number, y0: number, y1: number, hz: number, tone: number, level: number): void {
  if (level <= 0.003) return;
  const xs = Math.sin(f.cam.yaw) * f.cam.dist > (x0 + x1) / 2 ? x1 : x0;
  solid(f, [[xs, y0, -hz], [xs, y0, hz], [xs, y1, hz], [xs, y1, -hz]], tone * 0.6, level);
  solid(f, [[x0, y1, -hz], [x1, y1, -hz], [x1, y1, hz], [x0, y1, hz]], tone * 1.7, level);
  solid(f, [[x0, y0, -hz], [x1, y0, -hz], [x1, y1, -hz], [x0, y1, -hz]], tone, level, 0.32);
}

/** a turned part standing on the press's plane: a column, the screw, the die. Lit from the left. */
function drum(f: Frame, s: State, x: number, y0: number, y1: number, r: number, level: number, cap = 0.12): void {
  if (level <= 0.003 || y1 - y0 < 0.003) return;
  const { ctx, pal } = f;
  const ex = Math.cos(f.cam.yaw) * r;
  const ez = Math.sin(f.cam.yaw) * r;
  const a = f.P(x, y0, 0);
  const b = f.P(x, y1, 0);
  if (!a || !b) return;
  // shaded across its own axis, so that a column that leans in perspective keeps its highlight
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = ((a.y - b.y) / len) * r * a.s * f.u;
  const ny = ((b.x - a.x) / len) * r * a.s * f.u;
  const g = ctx.createLinearGradient(a.x - nx, a.y - ny, a.x + nx, a.y + ny);
  g.addColorStop(0, rgba(pal.key, 0.5 * level));
  g.addColorStop(0.2, rgba(pal.ink, 0.3 * level));
  g.addColorStop(0.62, rgba(pal.ink, 0.03 * level));
  g.addColorStop(1, rgba(pal.ink, 0.2 * level));
  const loop = (y: number): V3[] => s.circ.map(([c, sn]): V3 => [x + c * r, y, sn * r]);
  for (const q of [loop(y0), [[x - ex, y0, -ez], [x + ex, y0, ez], [x + ex, y1, ez], [x - ex, y1, -ez]] as V3[]]) {
    tint(f, q, rgba(pal.bg, 0.96 * level));
    tint(f, q, g);
  }
  const top = loop(y1);
  tint(f, top, rgba(pal.bg, 0.96 * level));
  f.fill(top, pal.ink, cap * level);
  f.path(top, pal.ink, 0.42 * level, 1, true);
}

/** one cut segment of a mark: an outer arc, and an inner arc at that segment's own depth */
function sector(at: Plane, g: Seg, n: number): V3[] {
  const o: V3[] = [];
  for (let i = 0; i <= n; i++) o.push(at(Math.cos(lerp(g.a0, g.a1, i / n)) * 0.95, Math.sin(lerp(g.a0, g.a1, i / n)) * 0.95));
  for (let i = n; i >= 0; i--) o.push(at(Math.cos(lerp(g.a0, g.a1, i / n)) * g.r0, Math.sin(lerp(g.a0, g.a1, i / n)) * g.r0));
  return o;
}

/** a mark: its border, its twelve segments, the device at its centre. `agree` and `index` light single segments. */
function mark(f: Frame, s: State, at: Plane, level: number, cut: (i: number) => number, agree: (i: number) => number, index: (i: number) => number): void {
  if (level <= 0.003) return;
  const { pal } = f;
  const round = (r: number): V3[] => s.circ.map(([c, sn]) => at(c * r, sn * r));
  f.path(round(1.06), pal.ink, 0.42 * level, 1.25, true);
  f.path(round(0.36), pal.ink, 0.3 * level, 1, true);
  f.path([at(0, 0.22), at(0.15, 0), at(0, -0.22), at(-0.15, 0)], pal.ink, 0.45 * level, 1, true);
  s.segs.forEach((g, i) => {
    const on = cut(i) * level;
    if (on <= 0.003) return;
    const q = sector(at, g, f.mobile ? 3 : 5);
    const lit = agree(i);
    f.fill(q, pal.ink, 0.07 * on);
    f.fill(q, pal.key, 0.5 * index(i) * on);
    f.fill(q, pal.gold, 0.72 * lit * on);
    f.path(q, lit > 0.5 ? pal.gold : pal.ink, (0.5 + 0.5 * lit) * on, 1, true);
  });
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    // twelve segments, each cut to its own depth: the same list is engraved on the plate and printed on the card
    const segs: Seg[] = [];
    for (let i = 0; i < N; i++) segs.push({ a0: ((i + 0.1) / N) * TAU, a1: ((i + 0.9) / N) * TAU, r0: 0.5 + 0.3 * f.rnd(i + 40) });
    const n = f.mobile ? 18 : 28;
    const circ: [number, number][] = [];
    for (let i = 0; i < n; i++) circ.push([Math.cos((i / n) * TAU), Math.sin((i / n) * TAU)]);
    return { segs, circ, drop: 0 };
  },
  draw(f, s) {
    const { ctx, pal } = f;
    // looked down upon from a little to the left, so that the card lies open under the die
    f.cam.parallax = 0.6;
    f.aim(-0.16 + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.03), -0.42, 6.4, 1.02);

    deck(f, { y: FLOOR, half: 3.75, alpha: 0.1, drift: 0 });
    pool(f, [0.1, FLOOR, 0], 2.6, pal.key, 0.2 * f.boot);

    // ── the reference plate: a pane of glass on a foot, leaning back, turned towards the press
    const glass = f.on(0.3, 0.4);
    const foot = (y: number): V3[] => [[-0.44, -0.11], [0.44, -0.11], [0.44, 0.11], [-0.44, 0.11]].map(([u, w]): V3 => [1.03 + u * Math.cos(TURN) + w * Math.sin(TURN), y, -0.06 - u * Math.sin(TURN) + w * Math.cos(TURN)]);
    const sole = foot(FLOOR);
    const tread = foot(FLOOR + 0.1);
    solid(f, tread, 0.1, glass);
    solid(f, [sole[0], sole[1], tread[1], tread[0]], 0.06, glass, 0.32);
    const pane = panel(f, [1.03, -0.02, 0.06], 1.0, 1.3, { yaw: TURN, tilt: 0.2, on: glass, colour: pal.gold, alpha: 0.7, header: true });
    const onPlate: Plane = (u, v) => pane.at(0.5 + (u * RP) / 1.0, 0.44 + (v * RP) / 1.3, 0.004);
    const onCard: Plane = (u, v) => [PX + u * RC, BED + 0.014, v * RC];

    // ── the pointer: how far the comparison has been carried from the plate to the card
    const pp = f.P(...onPlate(0, 0));
    const pc = f.P(...onCard(0, 0));
    const carried = pp && pc && f.hover > 0 ? clamp(((pp.x - f.mx) / (pp.x - pc.x) - 0.12) / 0.74) : 0;
    const agree = (i: number) => {
      const k = clamp(carried * N - i);
      return k * k * (3 - 2 * k) * f.hover;
    };
    s.drop = f.still ? 0 : s.drop + (carried * f.hover - s.drop) * (1 - Math.exp(-f.dt * 3.5));
    const down = easeInOut(s.drop);
    // with nobody there an index light goes round both marks in step
    const round = f.still ? 2.4 : f.t / 2.2;
    const index = (i: number) => {
      const d = Math.abs(((round - i - 0.5) % N + N + N / 2) % N - N / 2);
      return f.boot < 1 ? 0 : clamp(1 - d) * (1 - f.hover);
    };
    const cut = (i: number) => f.on(0.6 + 0.4 * (i / N), 0.25);

    mark(f, s, onPlate, glass, cut, agree, index);
    f.label("REGISTRY", pane.at(0.5, 0.94), { align: "center", size: f.mobile ? 8 : 10, colour: pal.gold, alpha: 0.9 * f.on(0.7) });

    // ── the press: bed, card, columns
    const bed = f.on(0, 0.35);
    block(f, PX - 0.72, PX + 0.72, FLOOR, BED, 0.54, 0.06, bed);
    f.line([PX - 0.72, BED, -0.54], [PX + 0.72, BED, -0.54], pal.key, 0.5 * bed, 1.25);
    f.label("ADDRESS", [PX, (FLOOR + BED) / 2, -0.54], { align: "center", size: f.mobile ? 7 : 9, colour: pal.ink2, alpha: 0.8 * f.on(0.7) });
    const card: V3[] = [[PX - 0.44, BED + 0.012, -0.4], [PX + 0.44, BED + 0.012, -0.4], [PX + 0.44, BED + 0.012, 0.4], [PX - 0.44, BED + 0.012, 0.4]];
    const laid = f.on(0.45, 0.3);
    f.fill(card, pal.ink, 0.1 * laid);
    f.fill(card, pal.gold, 0.1 * down * laid);
    f.path(card, pal.ink, 0.5 * laid, 1, true);
    mark(f, s, onCard, laid, cut, agree, index);
    // when every segment agrees, the die's own light falls on the card
    pool(f, [PX, BED + 0.014, 0], 0.62, pal.gold, 0.34 * down * down);
    const rise = f.on(0.15, 0.4);
    for (const side of [-1, 1]) drum(f, s, PX + side * COL, BED, lerp(BED, BEAM0 + 0.02, rise), 0.045, bed);

    // ── the die on its screw, below the beam
    const set = f.on(0.5, 0.4);
    const yd = UP - TRAVEL * down + (1 - set) * 0.12;
    const tip = yd + DH + SCREW;
    // the thread stands still in the nut while the screw runs through it
    const thread = (y0: number, y1: number) => {
      const ex = Math.cos(f.cam.yaw) * 0.042;
      const ez = Math.sin(f.cam.yaw) * 0.042;
      for (let y = Math.ceil(y0 / 0.045) * 0.045; y < y1 - 0.02; y += 0.045) f.line([PX - ex, y + 0.016, -ez], [PX + ex, y, ez], pal.ink, 0.34 * set, 1);
    };
    drum(f, s, PX, yd + DH, BEAM0 + 0.02, 0.042, set, 0);
    thread(yd + DH + 0.06, BEAM0);
    drum(f, s, PX, yd + DH, yd + DH + 0.05, 0.1, set);
    drum(f, s, PX, yd, yd + DH, DR, set, 0.1);
    // the engraved face is underneath: its light shows on the rim as the die comes down
    const rim: V3[] = [];
    for (let i = 0; i <= 14; i++) rim.push([PX + Math.cos(f.cam.yaw + Math.PI + (i / 14) * Math.PI) * DR, yd, Math.sin(f.cam.yaw + Math.PI + (i / 14) * Math.PI) * DR]);
    trace(f, rim, down > 0.02 ? pal.gold : pal.key, (0.4 + 0.6 * down) * set, 1.25 + down);

    // ── the beam, the nut, the screw above it and the cross handle
    const beam = f.on(0.35, 0.35);
    block(f, PX - 0.68, PX + 0.68, BEAM0, BEAM1, 0.12, 0.07, beam);
    f.line([PX - 0.68, BEAM1, -0.12], [PX + 0.68, BEAM1, -0.12], pal.key, 0.55 * beam, 1.25);
    drum(f, s, PX, BEAM1, BEAM1 + 0.045, 0.11, beam);
    drum(f, s, PX, BEAM1 + 0.045, tip, 0.042, set, 0);
    thread(BEAM1 + 0.06, tip - 0.05);
    const turn = 0.5 + down * TAU * 1.25 + (f.still ? 0 : Math.sin(f.t * 0.3) * 0.03);
    const hx = Math.cos(turn) * 0.38;
    const hz = Math.sin(turn) * 0.38;
    f.line([PX - hx, tip - 0.03, -hz], [PX + hx, tip - 0.03, hz], pal.bg, 0.9 * set, 5);
    f.line([PX - hx, tip - 0.03, -hz], [PX + hx, tip - 0.03, hz], pal.ink, 0.6 * set, 3);
    for (const side of [-1, 1]) {
      f.dot([PX + side * hx, tip - 0.03, side * hz], 0.05, pal.bg, 0.95 * set);
      f.dot([PX + side * hx, tip - 0.03, side * hz], 0.05, pal.ink, 0.34 * set);
      f.dot([PX + side * hx - 0.014, tip - 0.016, side * hz], 0.016, pal.key, 0.7 * set);
    }
    f.dot([PX, tip, 0], 0.06, pal.bg, 0.95 * set);
    f.dot([PX, tip, 0], 0.06, pal.ink, 0.3 * set);

    // ── the comparison ray: from the plate's mark, through the cursor, to the card's mark
    const idle = ((round % N) / N) * TAU;
    f.line(onPlate(Math.cos(idle) * 0.8, Math.sin(idle) * 0.8), onCard(Math.cos(idle) * 0.8, Math.sin(idle) * 0.8), pal.key, f.boot < 1 ? 0 : 0.2 * (1 - f.hover));
    const a = (Math.min(carried * N, N - 0.5) / N) * TAU;
    const from = onPlate(Math.cos(a) * 0.8, Math.sin(a) * 0.8);
    const to = onCard(Math.cos(a) * 0.8, Math.sin(a) * 0.8);
    const p = f.P(...from);
    const q = f.P(...to);
    if (p && q && f.hover > 0.003) {
      for (const [width, alpha] of [[5, 0.14], [1.25, 0.9]]) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(f.mx, f.my);
        ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = rgba(pal.gold, alpha * f.hover);
        ctx.lineWidth = width;
        ctx.stroke();
      }
      for (const end of [from, to]) {
        f.glow(end, 0.14, pal.gold, 0.6 * f.hover);
        f.dot(end, 0.012, pal.ink, 0.9 * f.hover);
      }
    }
  },
};

export default scene;
