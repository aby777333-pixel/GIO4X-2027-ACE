/**
 * BASTION — defence in depth.
 *
 * Seen from above and at an angle: three ring walls, one inside another, each
 * built of separate curved lengths with a gap between one length and the next,
 * and each a little higher than the one outside it. At the centre a small lit
 * plinth carries the thing being kept: a key, standing in its own light.
 *
 * The page makes two kinds of statement, and the walls are named for them: the
 * outer ring is what THIS WEBSITE does (seven lengths, the seven things a
 * visitor can check), the next is YOUR SIDE (seven lengths, the seven habits);
 * the last, the highest and nearest the key, carries no name. The
 * rings turn slowly against one another, so the gaps never stay in line.
 *
 * The pointer is the approach. The length of each wall nearest to it turns to
 * stand square across its path and brightens, the gaps closing against it, so
 * that the line of sight drawn from the cursor towards the key always ends on
 * a wall. Nothing here is a grade, an audit or a measurement.
 */
import { TAU, clamp, lerp, type Frame, type Scene, type V3 } from "../engine";
import { callouts, deck, lamp, pool, ring, trace, type Callout } from "../kit";

/** one wall: its radius, height, thickness, the number of lengths, how fast it turns, and its place in the power-on */
type Wall = { r: number; h: number; w: number; n: number; speed: number; order: number; name: string };
type Piece = { wall: number; k: number; depth: number; lit: number };
type State = { walls: Wall[]; off: number[]; pieces: Piece[]; phase: number[]; placed: boolean };

/** the part of each pitch that is wall; the rest is gap */
const SOLID = 0.74;
const PLINTH = 0.2;

/** where the pointer's line of sight meets the ground, as [x, z] */
function pick(f: Frame): readonly [number, number] | null {
  const { yaw, pitch, dist, zoom } = f.cam;
  const a = (f.mx - f.cx) / (f.u * dist * zoom);
  const b = (f.cy - f.my) / (f.u * dist * zoom);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const den = b * cp + sp;
  if (Math.abs(den) < 1e-4) return null;
  const depth = (dist * sp) / den;
  if (depth < 0.35) return null;
  const x1 = a * depth;
  const z1 = -b * depth * sp + (depth - dist) * cp;
  return [x1 * Math.cos(yaw) - z1 * Math.sin(yaw), x1 * Math.sin(yaw) + z1 * Math.cos(yaw)];
}

/** the smallest turn that carries angle a onto angle b */
const wrap = (a: number, period: number) => a - period * Math.round(a / period);

/** one face of a wall: a dark body under a tint, with a fine edge */
function face(f: Frame, pts: readonly V3[], colour: string, tone: number, edge: number): void {
  f.fill(pts, f.pal.bg, 0.95);
  f.fill(pts, colour, tone);
  f.path(pts, colour, edge, 1, true);
}

const scene: Scene<State> = {
  pose: 14,
  setup(f) {
    const walls: Wall[] = [
      { r: 1.62, h: 0.15, w: 0.085, n: 7, speed: 0.017, order: 0.1, name: "THIS WEBSITE" },
      { r: 1.12, h: 0.24, w: 0.08, n: 7, speed: -0.024, order: 0.3, name: "YOUR SIDE" },
      { r: 0.64, h: 0.33, w: 0.075, n: 3, speed: 0.034, order: 0.5, name: "" },
    ];
    const pieces: Piece[] = [];
    walls.forEach((wl, wall) => {
      for (let k = 0; k < wl.n; k++) pieces.push({ wall, k, depth: 0, lit: 0 });
    });
    return { walls, off: walls.map(() => 0), pieces, phase: walls.map((_, i) => f.rnd(i + 2) * TAU), placed: false };
  },
  draw(f, s) {
    const { pal } = f;
    f.aim(0.22 + (f.still ? 0 : Math.sin(f.t * 0.05) * 0.05), -0.66, 6.6, 0.96);
    const { yaw } = f.cam;
    // the horizontal direction from the scene to the camera: a face is seen when it is turned this way
    const vx = Math.sin(yaw);
    const vz = -Math.cos(yaw);
    const ease = (rate: number) => (s.placed && !f.still ? 1 - Math.exp(-f.dt * rate) : 1);

    // ── the approach: where the pointer stands on the ground, its bearing and its distance from the key
    const hit = f.hover > 0 ? pick(f) : null;
    const bearing = hit ? Math.atan2(hit[1], hit[0]) : 0;
    const range = hit ? Math.hypot(hit[0], hit[1]) : 0;
    // over the key itself there is no approach to stand across
    const reach = f.hover * clamp((range - 0.2) / 0.5);

    deck(f, { y: 0, half: 3.5, step: 0.7, alpha: 0.07, drift: 0 });
    pool(f, [0, 0, 0], 2.6, pal.key, 0.2 * f.boot);
    pool(f, [0, 0, 0], 0.9, pal.gold, 0.22 * f.on(0.8));

    // ── each wall turns by itself; under the pointer it turns further, to set a length square across the approach
    const step = f.mobile ? 5 : 8;
    s.walls.forEach((wl, i) => {
      const pitch = TAU / wl.n;
      const base = s.phase[i] + (f.still ? 0 : f.t * wl.speed);
      let want = 0;
      if (hit) {
        // stay with the length already facing the pointer, until another one is clearly nearer
        const d = wrap(bearing - base, pitch);
        want = d + pitch * Math.round((s.off[i] - d) / pitch);
        if (Math.abs(want) > pitch * 0.8) want = d;
        want *= reach;
      }
      s.off[i] += (want - s.off[i]) * ease(3.2 + i * 1.2);
      // the track it runs on, engraved in the floor
      ring(f, [0, 0.002, 0], wl.r, { colour: pal.ink, alpha: 0.13 * f.on(wl.order), ticks: f.mobile ? 0 : wl.n * 4, tickLen: 0.03 });
    });

    // far lengths first, so that a nearer wall stands in front of a farther one
    for (const p of s.pieces) {
      const wl = s.walls[p.wall];
      const mid = s.phase[p.wall] + (f.still ? 0 : f.t * wl.speed) + s.off[p.wall] + (p.k * TAU) / wl.n;
      p.depth = wl.r * (Math.cos(mid) * vx + Math.sin(mid) * vz);
    }
    s.pieces.sort((a, b) => a.depth - b.depth);

    // the line of sight from the pointer towards the key: it ends on the first wall inside it
    let stop = 0;
    for (const wl of s.walls) if (range > wl.r + 0.06 && wl.r > stop) stop = wl.r + wl.w / 2;
    const sight = hit && stop > 0 ? f.hover * f.on(0.9) : 0;
    const cb = Math.cos(bearing);
    const sb = Math.sin(bearing);
    if (sight > 0.01) f.line([cb * Math.min(range, 2.4), 0.004, sb * Math.min(range, 2.4)], [cb * stop, 0.004, sb * stop], pal.key, 0.8 * sight, 1.25);

    const core = () => {
      // ── the plinth, and on it the key, turned to face whoever looks
      const on = f.on(0.75, 0.3);
      if (on <= 0.003) return;
      const top: V3[] = [];
      const foot: V3[] = [];
      const n = f.mobile ? 20 : 32;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * TAU;
        top.push([Math.cos(a) * PLINTH, 0.09, Math.sin(a) * PLINTH]);
        foot.push([Math.cos(a) * PLINTH * 1.12, 0, Math.sin(a) * PLINTH * 1.12]);
      }
      f.fill(foot, pal.bg, 0.95 * on);
      f.fill(foot, pal.ink, 0.12 * on);
      f.fill(top, pal.bg, 0.95 * on);
      f.fill(top, pal.gold, 0.2 * on);
      f.path(top, pal.gold, 0.8 * on, 1.25, true);
      const breathe = f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.8);
      const K = (u: number, v: number): V3 => [u * Math.cos(yaw), 0.2 + v, u * Math.sin(yaw)];
      f.glow(K(0, 0.3), 0.62, pal.gold, 0.3 * on * breathe);
      // bow, stem, and two wards at the foot
      const bow: V3[] = [];
      for (let j = 0; j <= 20; j++) bow.push(K(Math.sin((j / 20) * TAU) * 0.1, 0.46 - Math.cos((j / 20) * TAU) * 0.1));
      trace(f, bow, pal.gold, 0.95 * on, 2.2);
      trace(f, [K(0, 0.36), K(0, 0)], pal.gold, 0.95 * on, 2.2);
      trace(f, [K(0, 0.1), K(0.085, 0.1)], pal.gold, 0.95 * on, 2.2);
      trace(f, [K(0, 0.015), K(0.065, 0.015)], pal.gold, 0.95 * on, 2.2);
      lamp(f, K(0, 0.46), pal.gold, on * breathe, 0.016);
    };

    let cored = false;
    s.pieces.forEach((p) => {
      // the key stands in the middle of the picture: lengths behind it first, then it, then those in front
      if (!cored && p.depth >= 0) {
        core();
        cored = true;
      }
      const wl = s.walls[p.wall];
      const rise = f.on(wl.order + 0.03 * p.k, 0.3);
      if (rise <= 0.003) return;
      const pitch = TAU / wl.n;
      const mid = s.phase[p.wall] + (f.still ? 0 : f.t * wl.speed) + s.off[p.wall] + p.k * pitch;
      const a0 = mid - (pitch * SOLID) / 2;
      const a1 = mid + (pitch * SOLID) / 2;
      // how squarely this length stands across the approach, and how close the pointer is to its wall
      const facing = hit ? clamp(1 - Math.abs(wrap(mid - bearing, TAU)) / (pitch * 0.5)) * clamp(1.35 - Math.abs(range - wl.r) / 1.4) * reach : 0;
      p.lit += (facing - p.lit) * ease(6);
      const lit = p.lit;
      const h = wl.h * rise * (1 + 0.2 * lit);
      const ri = wl.r - wl.w / 2;
      const ro = wl.r + wl.w / 2;
      const m = Math.max(2, Math.round(((a1 - a0) * 180) / Math.PI / step));
      const at = (r: number, j: number, y: number): V3 => {
        const a = lerp(a0, a1, j / m);
        return [Math.cos(a) * r, y, Math.sin(a) * r];
      };
      const tone = 0.13 + 0.2 * lit;
      const edge = 0.3 + 0.4 * lit;
      // the upright faces: whichever of the inner and outer is turned to the viewer, run by run along the curve
      for (const [r, sign] of [[ri, -1], [ro, 1]] as const) {
        let run: number[] = [];
        const flush = () => {
          if (run.length > 1) face(f, [...run.map((j) => at(r, j, 0)), ...run.reverse().map((j) => at(r, j, h))], pal.ink, tone * (sign > 0 ? 1 : 0.55), edge * 0.5);
          run = [];
        };
        for (let j = 0; j <= m; j++) {
          const a = lerp(a0, a1, j / m);
          if (sign * (Math.cos(a) * vx + Math.sin(a) * vz) > -0.04) run.push(j);
          else flush();
        }
        flush();
      }
      // the two ends, where the gaps are
      for (const [j, sign] of [[0, -1], [m, 1]] as const) {
        const a = j ? a1 : a0;
        if (sign * (-Math.sin(a) * vx + Math.cos(a) * vz) > 0) face(f, [at(ri, j, 0), at(ro, j, 0), at(ro, j, h), at(ri, j, h)], pal.ink, tone * 1.5, edge * 0.6);
      }
      // the walk along the top, lit along its outer edge from the key light
      const walk: V3[] = [];
      const rim: V3[] = [];
      for (let j = 0; j <= m; j++) {
        walk.push(at(ro, j, h));
        rim.push(at(ro, j, h));
      }
      for (let j = m; j >= 0; j--) walk.push(at(ri, j, h));
      face(f, walk, pal.ink, 0.2 + 0.24 * lit, edge);
      f.path(rim, pal.key, (0.55 + 0.45 * lit) * rise, 1.25 + 1.5 * lit);
      if (lit > 0.02) {
        f.path(rim, pal.key, 0.16 * lit, 7);
        // and where the line of sight ends on it
        if (sight > 0.01 && Math.abs(ro - stop) < 0.02) lamp(f, [cb * stop, h * 0.5, sb * stop], pal.key, lit * sight, 0.02);
      }
    });
    if (!cored) core();
    s.placed = true;

    // ── the two named walls: each name stands by its own track, at the front
    const names: Callout[] = [];
    const a = Math.atan2(vz, vx) + 0.7;
    for (const wl of s.walls) if (wl.name) names.push({ text: wl.name, p: [Math.cos(a) * wl.r, 0, Math.sin(a) * wl.r], colour: pal.ink2, alpha: f.on(wl.order + 0.4) });
    callouts(f, names, f.mobile ? { size: 8, reach: 9 } : { size: 10, reach: 18 });
  },
};

export default scene;
