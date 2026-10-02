/**
 * THREADS — the pin board.
 *
 * A felt board on a stand, leaning back and seen from one side: a field of
 * pins of three sizes, joined by threads into a web. Most threads are drawn
 * tight; a few hang slack. Three of the pins are picks, in champagne, and one
 * champagne thread runs between them by the shortest way the web allows, pin
 * to pin: that is what the page does with the things a visitor chooses.
 *
 * The pointer strings the next thread. The pins near the cursor light and
 * their threads pull taut; a new thread runs from the nearest pin to the
 * cursor, with its loose end hanging from the hand that holds it. Move on and
 * it lets go of one pin and takes the next.
 *
 * Nothing here is data: the pins are not named and the web is not the site's
 * graph, only the idea of one.
 */
import { clamp, lerp, type Frame, type Scene, type V3 } from "../engine";
import { deck, pool, trace } from "../kit";

const FLOOR = -1.1;
/** the board: half-width, half-height, where its middle stands (left of the axis, because its near end looms), how far it leans back, its thickness */
const BW = 1.7;
const BH = 0.84;
const XC = -0.17;
const YC = 0.22;
const LEAN = 0.17;
const DEEP = 0.07;
/** how far a pin's head stands off the felt, and the height the pointer holds its thread at */
const HEAD = 0.075;
const HAND = 0.13;
const CL = Math.cos(LEAN);
const SL = Math.sin(LEAN);

type Pin = { u: number; v: number; r: number; pick: boolean; order: number };
type Thread = { a: number; b: number; sag: number; route: boolean };
type State = { pins: Pin[]; threads: Thread[]; route: number[]; hold: number[] };

/** board to world: u across, v up the board, n off its face towards the viewer */
const at = (u: number, v: number, n = 0): V3 => [XC + u, YC + v * CL + n * SL, v * SL - n * CL];

/** where the pointer's ray meets the board, at height n off its face: the engine's projection, run backwards */
function onBoard(f: Frame, n: number): [number, number] | null {
  const { yaw, pitch, dist, zoom } = f.cam;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const k = dist * zoom * f.u;
  const a = (f.mx - f.cx) / k;
  const b = (f.cy - f.my) / k;
  const z1 = cp - b * sp;
  const dx = a * cy - z1 * sy;
  const dy = b * cp + sp;
  const dz = a * sy + z1 * cy;
  const ox = dist * cp * sy;
  const oy = -dist * sp;
  const oz = -dist * cp * cy;
  const den = dy * SL - dz * CL;
  if (Math.abs(den) < 1e-4) return null;
  const s = ((YC + n * SL - oy) * SL - (-n * CL - oz) * CL) / den;
  if (s <= 0) return null;
  return [ox + dx * s - XC, (oy + dy * s - YC) * CL + (oz + dz * s) * SL];
}

/** a thread between two points off the board: straight when taut, hanging down the board when slack */
function strand(a: readonly [number, number], b: readonly [number, number], na: number, nb: number, sag: number): V3[] {
  if (sag < 0.006) return [at(a[0], a[1], na), at(b[0], b[1], nb)];
  const out: V3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    out.push(at(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(na, nb, t)));
  }
  return out;
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const cols = f.mobile ? 5 : 7;
    const rows = f.mobile ? 3 : 4;
    const pins: Pin[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const size = f.rnd(i + 200);
        pins.push({
          u: lerp(-BW + 0.24, BW - 0.24, c / (cols - 1)) + (f.rnd(i) - 0.5) * 0.24,
          v: lerp(BH - 0.2, -BH + 0.2, r / (rows - 1)) + (f.rnd(i + 100) - 0.5) * 0.2,
          r: size < 0.2 ? 0.036 : size < 0.55 ? 0.027 : 0.019,
          pick: false,
          order: (c + r * 0.5) / (cols + rows * 0.5),
        });
      }
    }
    // the web: first one thread to every pin, so that the whole board hangs together; then some more
    const threads: Thread[] = [];
    const link = (a: number, b: number, seed: number) => threads.push({ a, b, sag: f.rnd(seed) < 0.3 ? 0.07 + 0.1 * f.rnd(seed + 1) : 0.004, route: false });
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (!i) continue;
        const left = c > 0 && (r === 0 || f.rnd(i + 300) < 0.55);
        link(i, left ? i - 1 : i - cols, i * 3 + 400);
        if (c > 0 && r > 0 && f.rnd(i + 500) < 0.4) link(i, left ? i - cols : i - 1, i * 3 + 600);
        if (c > 0 && r > 0 && f.rnd(i + 700) < 0.3) link(i, i - cols - 1, i * 3 + 800);
        if (c < cols - 1 && r > 0 && f.rnd(i + 900) < 0.24) link(i, i - cols + 1, i * 3 + 1000);
      }
    }
    // three picks, and the shortest way between them along the threads: breadth first, as the page does it
    const picks = [cols * (rows > 3 ? 1 : 0), (rows - 1) * cols + Math.floor(cols / 2), cols - 1 + (rows > 3 ? cols : 0)];
    const way = (from: number, to: number): number[] => {
      const prev = pins.map(() => -1);
      const queue = [from];
      prev[from] = from;
      for (let q = 0; q < queue.length && prev[to] < 0; q++) {
        for (const t of threads) {
          const next = t.a === queue[q] ? t.b : t.b === queue[q] ? t.a : -1;
          if (next < 0 || prev[next] >= 0) continue;
          prev[next] = queue[q];
          queue.push(next);
        }
      }
      const out = [to];
      while (out[0] !== from) out.unshift(prev[out[0]]);
      return out;
    };
    const route = [...way(picks[0], picks[1]), ...way(picks[1], picks[2]).slice(1)];
    for (const p of picks) {
      pins[p].pick = true;
      pins[p].r = 0.04;
    }
    for (let i = 1; i < route.length; i++) {
      const t = threads.find((k) => (k.a === route[i] && k.b === route[i - 1]) || (k.b === route[i] && k.a === route[i - 1]));
      if (t) {
        t.route = true;
        t.sag = 0;
      }
    }
    return { pins, threads, route, hold: pins.map(() => 0) };
  },
  draw(f, s) {
    const { pal } = f;
    const turn = 0.4 + (f.rnd(1) - 0.5) * 0.08;
    f.cam.parallax = 0.7;
    f.aim(turn + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.04), -0.07, 6.4, f.mobile ? 0.98 : 1);

    // ── the pointer on the board: which pins it is near, and which one the new thread is tied to
    const hit = f.hover > 0.01 ? onBoard(f, HAND) : null;
    const hand: [number, number] | null = hit ? [clamp(hit[0], -BW + 0.06, BW - 0.06), clamp(hit[1], -BH + 0.06, BH - 0.06)] : null;
    const close = s.pins.map((p) => f.near(at(p.u, p.v, HEAD), f.u * 0.62));
    let tied = -1;
    if (hand) {
      let best = 1e9;
      s.pins.forEach((p, i) => {
        const d = Math.hypot(p.u - hand[0], p.v - hand[1]);
        if (d < best) {
          best = d;
          tied = i;
        }
      });
    }
    const ease = f.still ? 1 : 1 - Math.exp(-f.dt * 6);
    s.hold.forEach((h, i) => (s.hold[i] = h + ((i === tied ? f.hover : 0) - h) * ease));

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [XC, FLOOR, 0.1], 2.5, pal.key, 0.2 * f.boot);

    // ── the stand: two legs under the board and a strut behind it
    const body = f.on(0, 0.3);
    f.line(at(0, BH * 0.5, -DEEP), [XC, FLOOR, 0.95], pal.ink, 0.2 * body, 3);
    for (const u of [-BW * 0.62, BW * 0.62]) {
      const foot: V3 = [XC + u * 1.06, FLOOR, -0.16];
      f.line(at(u, -BH, -DEEP / 2), foot, pal.bg, 0.95 * body, 5);
      f.line(at(u, -BH, -DEEP / 2), foot, pal.ink, 0.36 * body, 5);
      f.dot(foot, 0.035, pal.ink, 0.5 * body);
    }

    // ── the board: its back, its frame, the felt
    const slab = (n: number, inset = 0): V3[] => [at(-BW + inset, -BH + inset, n), at(BW - inset, -BH + inset, n), at(BW - inset, BH - inset, n), at(-BW + inset, BH - inset, n)];
    f.fill(slab(-DEEP), pal.bg, 0.96 * body);
    f.fill(slab(-DEEP), pal.ink, 0.06 * body);
    f.path(slab(-DEEP), pal.ink, 0.22 * body, 1, true);
    const face = slab(0);
    f.fill(face, pal.bg, 0.96 * body);
    f.fill(face, pal.ink, 0.13 * body);
    f.path(face, pal.ink, 0.42 * body, 1.25, true);
    const felt = slab(0, 0.075);
    f.fill(felt, pal.bg, 0.8 * body);
    f.fill(felt, pal.key, 0.045 * body);
    f.path(felt, pal.ink, 0.16 * body, 1, true);
    f.line(face[3], face[2], pal.key, 0.7 * body, 1.5);
    pool(f, at(0.2, 0, 0), 1.3, pal.key, 0.1 * body);

    // ── the web: each thread's shadow on the felt, then the thread itself, off the board at the pins' heads
    const sway = (i: number) => (f.still ? 1 : 1 + 0.1 * Math.sin(f.t * 0.6 + i * 1.7));
    s.threads.forEach((t, i) => {
      const a = s.pins[t.a];
      const b = s.pins[t.b];
      const on = f.on(0.3 + 0.5 * Math.max(a.order, b.order), 0.3);
      if (on <= 0.003) return;
      // near the pointer the slack is taken up
      const taut = Math.max(close[t.a], close[t.b]);
      const sag = t.sag * sway(i) * (1 - taut);
      const end: [number, number] = [lerp(a.u, b.u, on), lerp(a.v, b.v, on)];
      f.path(strand([a.u + 0.03, a.v - 0.035], [end[0] + 0.03, end[1] - 0.035], 0, 0, sag), pal.bg, 0.55 * on, 2);
      if (t.route) return;
      const line = strand([a.u, a.v], end, HEAD * 0.8, HEAD * 0.8, sag);
      f.path(line, pal.ink, (t.sag > 0.01 ? 0.3 : 0.4) * on * (1 - 0.7 * taut), 1);
      if (taut > 0.01) trace(f, line, pal.key, 0.95 * taut * on, 1.4);
    });

    // ── the route between the picks, pin to pin, with a light that travels it
    const laid = f.on(0.85, 0.3);
    if (laid > 0.003) {
      const n = Math.max(2, Math.round(1 + (s.route.length - 1) * laid));
      const way = s.route.slice(0, n).map((i) => at(s.pins[i].u, s.pins[i].v, HEAD * 0.9));
      trace(f, way, pal.gold, 0.95, 1.7, laid >= 1 ? f.t / 14 : -1);
    }

    // ── the pins: a shaft, a head, a point of light on the head
    s.pins.forEach((p, i) => {
      const on = f.on(0.18 + 0.5 * p.order, 0.24);
      if (on <= 0.003) return;
      const lit = Math.max(close[i], s.hold[i]);
      const head = at(p.u, p.v, HEAD * on);
      const colour = p.pick || s.hold[i] > 0.5 ? pal.gold : pal.ink;
      f.dot(at(p.u + 0.03, p.v - 0.035), p.r * 0.9, pal.bg, 0.6 * on);
      f.line(at(p.u, p.v), head, pal.ink, 0.5 * on, 1.25);
      if (p.pick) f.glow(head, 0.2, pal.gold, 0.4 * on * (f.still ? 1 : 0.85 + 0.15 * Math.sin(f.t * 0.9 + i)));
      if (lit > 0.01) f.glow(head, 0.24, s.hold[i] > 0.5 ? pal.gold : pal.key, 0.6 * lit * on);
      const r = p.r * (1 + 0.35 * lit);
      f.dot(head, r, pal.bg, 0.95 * on);
      f.dot(head, r, colour, (p.pick ? 0.95 : 0.5 + 0.45 * lit) * on);
      f.dot(at(p.u - p.r * 0.3, p.v + p.r * 0.3, HEAD * on + 0.004), r * 0.34, pal.ink, (0.55 + 0.4 * lit) * on);
    });

    // ── the new thread: from the pin it is tied to, to the hand, and the loose end hanging from the hand
    if (hand) {
      s.pins.forEach((p, i) => {
        const h = s.hold[i];
        if (h <= 0.02) return;
        const reach = Math.hypot(hand[0] - p.u, hand[1] - p.v);
        trace(f, strand([p.u, p.v], hand, HEAD, HAND, 0.05 * clamp(reach * 1.4)), pal.gold, h, 1.7);
      });
      const tail: V3[] = [];
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        const swing = (f.still ? 0 : Math.sin(f.t * 1.1 - k * 2.2) * 0.035) * k;
        tail.push(at(hand[0] + swing + 0.03 * k * k, hand[1] - 0.3 * k, lerp(HAND, 0.02, k * k)));
      }
      f.path(tail, pal.gold, 0.8 * f.hover, 1.4);
      f.dot(at(hand[0], hand[1], HAND), 0.016, pal.gold, f.hover);
    }
  },
};

export default scene;
