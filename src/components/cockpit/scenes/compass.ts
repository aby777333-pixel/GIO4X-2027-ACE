/**
 * COMPASS — reasons you can take a bearing on.
 *
 * A ship's compass in its binnacle, looked down upon: a card with its rose and
 * a needle, in a bowl slung from a gimbal ring, inside the fixed ring that the
 * binnacle's two arms carry. The page gives six reasons, each with its proof;
 * the fixed ring carries six brass stations, and the one the needle points at
 * is lit. The card names only the four quarters. Nothing here is a heading, a
 * figure or a reading.
 *
 * With the pointer away the gimbals ride a slow swell and the needle rests on
 * north with a natural sway. The pointer is the thing it finds: the needle
 * swings round to point at the cursor, overshoots a little and settles as a
 * real needle does, the bezel lights where it points, and the gimbal rings
 * lean towards the pointer, each about its own pair of pivots.
 */
import { TAU, clamp, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool } from "../kit";

/** the gimbal plane, the deck, and the top of the binnacle's drum */
const OY = 0.39;
const FLOOR = -0.63;
const TOP = -0.25;
/** radii: the card, the bowl's bezel, the gimbal ring, the fixed ring */
const RC = 0.69;
const RB = 0.76;
const R1 = 0.89;
const R2 = 1.03;
const HALF = Math.PI / 2;
const QUARTERS = ["N", "E", "S", "W"];

type Map3 = (x: number, y: number, z: number) => V3;
type State = { ang: number; vel: number; aim: number };

const wrap = (a: number) => a - TAU * Math.round(a / TAU);
const smooth = (k: number) => {
  const x = clamp(k);
  return x * x * (3 - 2 * x);
};

/** where the pointer's ray meets the plane through `o` with normal `n` (the camera of `aim`, inverted) */
function pick(f: Frame, o: V3, n: V3): V3 | null {
  const { yaw, pitch, dist, zoom } = f.cam;
  const k = 1 / (f.u * zoom * dist);
  const X = (f.mx - f.cx) * k;
  const Y = -(f.my - f.cy) * k;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const world = (l: number): V3 => {
    const zc = l - dist;
    const z1 = -Y * l * sp + zc * cp;
    return [X * l * cy - z1 * sy, Y * l * cp + zc * sp, X * l * sy + z1 * cy];
  };
  const a = world(0);
  const b = world(1);
  const den = (b[0] - a[0]) * n[0] + (b[1] - a[1]) * n[1] + (b[2] - a[2]) * n[2];
  if (Math.abs(den) < 1e-5) return null;
  return world(((o[0] - a[0]) * n[0] + (o[1] - a[1]) * n[1] + (o[2] - a[2]) * n[2]) / den);
}

/** an arc of a level circle in some frame; bearings run clockwise from north (the far side) */
function arcOf(m: Map3, r: number, y: number, from: number, to: number, n: number): V3[] {
  const o: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    o.push(m(Math.sin(a) * r, y, Math.cos(a) * r));
  }
  return o;
}

/** a machined band: a dark body between two fine edges, with a little of the key light along it */
function band(f: Frame, pts: readonly V3[], width: number, level: number, tone = 0.14): void {
  if (level <= 0.003) return;
  f.path(pts, f.pal.ink, 0.6 * level, width);
  f.path(pts, f.pal.bg, level, Math.max(1, width - 2));
  f.path(pts, f.pal.ink, tone * level, Math.max(1, width - 2));
}

/** a solid disc or plate: a dark body under a tone */
function plate(f: Frame, pts: readonly V3[], tone: number, level: number, edge = 0.3): void {
  f.fill(pts, f.pal.bg, 0.95 * level);
  f.fill(pts, f.pal.ink, tone * level);
  f.path(pts, f.pal.ink, edge * level, 1, true);
}

const scene: Scene<State> = {
  pose: 10,
  // the needle is found a long way off north at power-on, and swings home
  setup: (f) => ({ ang: 2.1 + f.rnd(3) * 0.8, vel: 0, aim: 0 }),
  draw(f, s) {
    const { pal } = f;
    f.aim(0.1 + (f.still ? 0 : Math.sin(f.t * 0.06) * 0.04), -0.72, 6.4, 1.2);
    const px = f.u * f.cam.zoom;
    const n = Math.round((f.mobile ? 40 : 72) * f.q);

    // ── the pointer, on the gimbal plane
    const hit = f.hover > 0 ? pick(f, [0, OY, 0], [0, 1, 0]) : null;
    const qx = hit ? hit[0] : 0;
    const qz = hit ? hit[2] : 0;
    if (hit && Math.hypot(qx, qz) > 0.07) s.aim = Math.atan2(qx, qz);

    // the rings ride a slow swell; under the pointer each leans towards it about its own pivots
    // (it leans less far away from the viewer than towards, so the card is never lost edge-on)
    const A = (f.still ? 0.03 : Math.sin(f.t * 0.43) * 0.05) * (1 - f.hover) + (qz > 0 ? 0.13 : 0.26) * clamp(qz / 1.1, -1, 1) * f.hover;
    const B = (f.still ? -0.02 : Math.sin(f.t * 0.31 + 1.3) * 0.04) * (1 - f.hover) - 0.24 * clamp(qx / 1.1, -1, 1) * f.hover;
    const ca = Math.cos(A);
    const sa = Math.sin(A);
    const cb = Math.cos(B);
    const sb = Math.sin(B);
    /** fixed to the binnacle */
    const F: Map3 = (x, y, z) => [x, OY + y, z];
    /** the gimbal ring: it turns about the athwartships pivots */
    const O: Map3 = (x, y, z) => [x, OY + y * ca - z * sa, y * sa + z * ca];
    /** the bowl: it turns in the gimbal ring about the fore-and-aft pivots as well */
    const G: Map3 = (x, y, z) => O(x * cb - y * sb, x * sb + y * cb, z);

    // the needle: a damped spring towards north, or towards the pointer
    if (f.still) {
      s.ang = 0;
      s.vel = 0;
    } else {
      const north = Math.sin(f.t * 0.45) * 0.07 + Math.sin(f.t * 1.13) * 0.025;
      const target = north + wrap(s.aim - north) * f.hover;
      const dt = Math.min(f.dt, 0.05);
      s.vel += (wrap(target - s.ang) * 24 - s.vel * 5.2) * dt;
      s.ang += s.vel * dt;
    }
    const ang = s.ang;

    // power-on: the binnacle, its arms, the rings, the card, the needle, the stations
    const base = f.on(0, 0.3);
    const arms = f.on(0.2, 0.3);
    const rings = f.on(0.4, 0.35);
    const card = f.on(0.6, 0.3);
    const live = f.on(0.85, 0.3);
    const wide = 0.05 * px;

    deck(f, { y: FLOOR, half: 4.5, alpha: 0.11 });
    pool(f, [0, FLOOR, 0], 2.3, pal.key, 0.22 * f.boot);
    pool(f, [0, FLOOR, 0], 1.1, pal.gold, 0.1 * card);

    // ── the binnacle: a foot, a tapered drum with a brass band, and two arms that carry the fixed ring
    plate(f, arcOf(F, 0.68, FLOOR - OY, 0, TAU, n), 0.05, base);
    plate(f, arcOf(F, 0.6, FLOOR - OY + 0.05, 0, TAU, n), 0.09, base);
    const side = [...arcOf(F, 0.52, FLOOR - OY + 0.05, HALF, 3 * HALF, n >> 1), ...arcOf(F, 0.43, TOP - OY, 3 * HALF, HALF, n >> 1)];
    plate(f, side, 0.13, base);
    f.path(arcOf(F, 0.48, (FLOOR + TOP) / 2 - OY + 0.03, HALF, 3 * HALF, n >> 1), pal.gold, 0.6 * base, 1.5);
    f.line([-0.52, FLOOR + 0.05, 0], [-0.43, TOP, 0], pal.key, 0.6 * base, 1.25);
    plate(f, arcOf(F, 0.43, TOP - OY, 0, TAU, n), 0.07, base);
    for (const sd of [-1, 1]) {
      const arm: V3[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = (i / 10) * arms;
        const u = 1 - t;
        arm.push([sd * (u * u * 0.36 + 2 * u * t * 1.2 + t * t * (R2 + 0.07)), u * u * TOP + 2 * u * t * (TOP - 0.02) + t * t * OY, 0]);
      }
      band(f, arm, 0.065 * px, arms, 0.2);
    }

    // ── the far halves of the two rings, then everything slung inside them
    band(f, arcOf(F, R2, 0, -HALF, HALF, n >> 1), wide, rings);
    band(f, arcOf(O, R1, 0, -HALF, HALF, n >> 1), wide, rings);
    f.line(G(0, 0, RB), O(0, 0, R1), pal.ink, 0.7 * rings, 3);

    if (card > 0.01) {
      // the bowl: weighted, so it hangs below its rim
      plate(f, arcOf(G, 0.26, -0.43, 0, TAU, n >> 1), 0.05, card);
      plate(f, arcOf(G, 0.54, -0.31, 0, TAU, n), 0.07, card);
      plate(f, arcOf(G, 0.71, -0.15, 0, TAU, n), 0.1, card);
      const face = arcOf(G, RB - 0.02, 0, 0, TAU, n);
      plate(f, face, 0.045, card, 0);
      f.glow(G(0, 0, 0), 0.8, pal.key, 0.1 * card);
      band(f, arcOf(G, RB, 0, 0, TAU, n), wide, card, 0.2);

      // the card: graduations, the rose, the four quarters
      const ticks = f.mobile ? 32 : 64;
      for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * TAU;
        const major = i % (ticks / 8) === 0;
        const r = RC - (major ? 0.075 : 0.035);
        f.line(G(Math.sin(a) * RC, 0, Math.cos(a) * RC), G(Math.sin(a) * r, 0, Math.cos(a) * r), pal.ink, (major ? 0.6 : 0.28) * card, 1);
      }
      f.path(arcOf(G, RC - 0.09, 0, 0, TAU, n), pal.ink, 0.14 * card, 1);
      const hub = G(0, 0, 0);
      for (let i = 0; i < 8; i++) {
        // the four half-points first, then the four quarters over them
        const k = i < 4 ? i * 2 + 1 : (i - 4) * 2;
        const a = (k * TAU) / 8;
        const main = i >= 4;
        const tip = main ? 0.35 : 0.22;
        const sh = main ? 0.09 : 0.065;
        const T = G(Math.sin(a) * tip, 0, Math.cos(a) * tip);
        const L = G(Math.sin(a - 0.785) * sh, 0, Math.cos(a - 0.785) * sh);
        const R = G(Math.sin(a + 0.785) * sh, 0, Math.cos(a + 0.785) * sh);
        const colour = k === 0 ? pal.gold : pal.ink;
        f.fill([hub, L, T], colour, (main ? 0.3 : 0.16) * card);
        f.fill([hub, R, T], colour, (main ? 0.1 : 0.05) * card);
        f.path([L, T, R], colour, (main ? 0.55 : 0.3) * card, 1);
      }
      QUARTERS.forEach((name, i) => {
        const a = (i * TAU) / 4;
        const lit = smooth(1 - Math.abs(wrap(ang - a)) / 0.6) * live;
        f.label(name, G(Math.sin(a) * 0.525, 0, Math.cos(a) * 0.525), { align: "center", display: true, size: f.mobile ? 8 : 12, colour: i === 0 || lit > 0.4 ? pal.gold : pal.ink, alpha: (0.72 + 0.28 * lit) * card });
      });

      // the bezel lights where the needle points
      const bearing = arcOf(G, RB, 0, ang - 0.2, ang + 0.2, 8);
      f.path(bearing, pal.gold, 0.16 * live, wide + 5);
      f.path(bearing, pal.gold, 0.95 * live, 2.25);

      // the needle: champagne to the north, steel to the south, on a jewelled pivot
      const lift = 0.05;
      const along = (y: number, r: number) => G(Math.sin(ang) * r, y, Math.cos(ang) * r);
      const across = (y: number, r: number) => G(Math.cos(ang) * r, y, -Math.sin(ang) * r);
      const T = along(lift, 0.44);
      const S = along(lift, -0.36);
      const L = across(lift, 0.05);
      const R = across(lift, -0.05);
      // its shadow on the card, then the needle standing clear of it
      f.fill([along(0, 0.44), across(0, 0.05), along(0, -0.36), across(0, -0.05)], pal.bg, 0.55 * live);
      f.fill([S, L, R], pal.bg, 0.95 * live);
      f.fill([S, L, R], pal.ink, 0.4 * live);
      f.path([L, S, R], pal.ink, 0.7 * live, 1);
      f.glow(T, 0.13, pal.gold, 0.4 * live);
      f.fill([T, L, R], pal.bg, 0.95 * live);
      f.fill([T, L, R], pal.gold, 0.92 * live);
      f.line(T, S, pal.bg, 0.4 * live, 1);
      f.dot(G(0, lift, 0), 0.05, pal.bg, live);
      f.dot(G(0, lift, 0), 0.05, pal.gold, 0.35 * live);
      lamp(f, G(0, lift, 0), pal.gold, live * (f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.9)), 0.02);

      // the glass over the card catches the room in two short arcs
      f.path(arcOf(G, RC - 0.14, 0.03, 3.75, 4.5, 10), pal.ink, 0.3 * card, 2);
      f.path(arcOf(G, RC - 0.2, 0.03, 0.75, 1.15, 6), pal.ink, 0.16 * card, 1.5);
    }

    // ── the near halves, the pivots, and the six stations on the fixed ring
    f.line(G(0, 0, -RB), O(0, 0, -R1), pal.ink, 0.7 * rings, 3);
    band(f, arcOf(O, R1, 0, HALF, 3 * HALF, n >> 1), wide, rings);
    f.path(arcOf(O, R1, 0, 3.5, 4.4, 10), pal.key, 0.7 * rings, 1.5);
    band(f, arcOf(F, R2, 0, HALF, 3 * HALF, n >> 1), wide, rings);
    f.path(arcOf(F, R2, 0, 3.6, 4.6, 10), pal.key, 0.55 * rings, 1.5);
    for (const sd of [-1, 1]) {
      f.line(O(sd * R1, 0, 0), F(sd * (R2 + 0.07), 0, 0), pal.ink, 0.75 * rings, 3);
      f.dot(F(sd * (R2 + 0.07), 0, 0), 0.04, pal.bg, arms);
      f.dot(F(sd * (R2 + 0.07), 0, 0), 0.04, pal.ink, 0.35 * arms);
      lamp(f, F(sd * (R2 + 0.07), 0, 0), pal.key, 0.7 * arms, 0.014);
      f.dot(O(0, 0, sd * R1), 0.022, pal.ink, 0.7 * rings);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6;
      const lit = smooth(1 - Math.abs(wrap(ang - a)) / 0.55);
      const p = F(Math.sin(a) * R2, 0.012, Math.cos(a) * R2);
      f.line(G(Math.sin(a) * RB, 0, Math.cos(a) * RB), p, pal.gold, 0.5 * lit * live, 1.25);
      lamp(f, p, pal.gold, (0.3 + 0.7 * lit) * live, 0.016 + 0.008 * lit);
    }
  },
};

export default scene;
