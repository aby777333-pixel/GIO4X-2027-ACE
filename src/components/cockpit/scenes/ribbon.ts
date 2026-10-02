/**
 * RIBBON — the release tape.
 *
 * The change log, as a perforated tape. It comes off a spoked reel at the back,
 * passes under a gate where a lamp reads it, and runs forward over two rollers
 * in one slow curve to end, nearest the viewer, in a champagne leader. Past the
 * gate the tape is notched, and every notch carries a small flag in one of the
 * page's three kinds of entry: new, changed, removed (the last an open outline).
 * The flag nearest the viewer is the current release.
 *
 * The pointer: the notch nearest the cursor raises its flag, lights and gives
 * its kind, and the tape advances a little to bring that notch to the cursor;
 * the reel turns and the perforations run with it. Nothing here is a date, a
 * version or a count.
 */
import { TAU, clamp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, trace } from "../kit";

const FLOOR = -0.6;
/** the height the tape runs at, and how far it sags between its supports */
const Y0 = -0.14;
const SAG = 0.04;
/** half the tape's width */
const HW = 0.15;
/** the reel: its flanges, and the wound pack the tape leaves from */
const RF = 0.58;
const RW = 0.4;
/** the tape's course on plan (x, z): a single slow S from the back left to the front right */
const COURSE: readonly (readonly [number, number])[] = [[-1.36, 0.78], [-0.3, 0.98], [0.1, -0.5], [1.4, -0.74]];
/** where the tape is carried: the reel, the gate, a roller, the last roller */
const STOPS = [0, 0.27, 0.65, 1];
/** the notched run, between the gate and the leader */
const M0 = 0.38;
const M1 = 0.95;
const KINDS = ["NEW", "CHANGED", "REMOVED"];
/** the kind each notch carries, from the gate forward */
const ORDER = [0, 0, 1, 0, 2, 0, 1, 0];
/** every flag flies the same way */
const WIND: V3 = [0.95, 0, -0.3];

type Cut = { p: V3; t: V3; n: V3 };
type State = { n: number; cuts: Cut[]; far: V3[]; near: V3[]; floor: V3[]; tail: V3[]; len: number; count: number; lift: number[]; shift: number };

/** the tape at position s (0 at the reel, 1 at the last roller): centre, direction of travel, and the normal across it */
function at(s: number): Cut {
  const k = clamp(s);
  const m = 1 - k;
  const w = [m * m * m, 3 * m * m * k, 3 * m * k * k, k * k * k];
  const d = [-3 * m * m, 3 * m * m - 6 * m * k, 6 * m * k - 3 * k * k, 3 * k * k];
  let x = 0;
  let z = 0;
  let dx = 0;
  let dz = 0;
  for (let i = 0; i < 4; i++) {
    x += w[i] * COURSE[i][0];
    z += w[i] * COURSE[i][1];
    dx += d[i] * COURSE[i][0];
    dz += d[i] * COURSE[i][1];
  }
  const len = Math.hypot(dx, dz) || 1;
  let i = 0;
  while (i < STOPS.length - 2 && k > STOPS[i + 1]) i++;
  const u = (k - STOPS[i]) / (STOPS[i + 1] - STOPS[i]);
  return { p: [x, Y0 - SAG * Math.sin(Math.PI * u) ** 2, z], t: [dx / len, 0, dz / len], n: [-dz / len, 0, dx / len] };
}

/** a point across the tape from its centre (k along the normal), raised by h */
const off = (c: Cut, k: number, h = 0): V3 => [c.p[0] + c.n[0] * k, c.p[1] + h, c.p[2] + c.n[2] * k];
const along = (p: V3, c: Cut, k: number): V3 => [p[0] + c.t[0] * k, p[1], p[2] + c.t[2] * k];

/** a body that hides what is behind it: a dark face under a tint, with a hairline */
function face(f: Frame, pts: readonly V3[], tint: number, edge: number, level: number, colour?: string): void {
  f.fill(pts, f.pal.bg, 0.93 * level);
  f.fill(pts, colour ?? f.pal.ink, tint * level);
  f.path(pts, colour ?? f.pal.ink, edge * level, 1, true);
}

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    const n = f.mobile ? 36 : 60;
    const cuts: Cut[] = [];
    let len = 0;
    for (let i = 0; i <= n; i++) {
      cuts.push(at(i / n));
      if (i) len += Math.hypot(cuts[i].p[0] - cuts[i - 1].p[0], cuts[i].p[2] - cuts[i - 1].p[2]);
    }
    // the leader: over the last roller and straight down
    const end = cuts[n];
    const tail: V3[] = [];
    for (const side of [1, -1]) {
      const run: V3[] = [];
      for (let k = 0; k <= 5; k++) {
        const a = (k / 5) * (Math.PI / 2);
        run.push(along(off(end, side * HW, -0.06 * (1 - Math.cos(a))), end, 0.06 * Math.sin(a)));
      }
      run.push(along(off(end, side * HW, -0.3), end, 0.06));
      tail.push(...(side > 0 ? run : run.reverse()));
    }
    const count = f.mobile ? 5 : 7;
    return { n, cuts, far: cuts.map((c) => off(c, HW)), near: cuts.map((c) => off(c, -HW)), floor: cuts.map((c) => [c.p[0], FLOOR, c.p[2]] as V3), tail, len, count, lift: new Array<number>(count).fill(0), shift: 0 };
  },
  draw(f, s) {
    const { pal } = f;
    f.cam.parallax = 0.6;
    f.aim(0.15 + (f.still ? 0 : Math.sin(f.t * 0.08) * 0.035), -0.42, 6.4, 1.05);
    const ease = 1 - Math.exp(-f.dt * 6);
    const sp = (M1 - M0) / (s.count - 1);

    // ── the pointer: where along the tape it is, and how closely it holds it
    let grip = 0;
    let pick = -1;
    let want = 0;
    if (f.hover > 0) {
      let best = 1e9;
      let sm = 0;
      for (let i = 0; i <= s.n; i++) {
        const p = f.P(s.cuts[i].p[0], s.cuts[i].p[1] + 0.1, s.cuts[i].p[2]);
        if (!p) continue;
        const d = Math.hypot(p.x - f.mx, p.y - f.my);
        if (d < best) {
          best = d;
          sm = i / s.n;
        }
      }
      // back on the blank tape, by the reel and the gate, there is no notch to raise
      const k = clamp(1 - best / 170) * clamp((sm - STOPS[1]) / (M0 - STOPS[1]) + 0.5);
      grip = k * k * (3 - 2 * k) * f.hover;
      pick = clamp(Math.round((sm - M0) / sp), 0, s.count - 1);
      // the tape runs on to bring the notch under the cursor; half-way between two notches it is at rest again
      want = grip * 0.24 * sp * Math.sin(TAU * clamp((sm - M0 - pick * sp) / sp, -0.5, 0.5));
    }
    s.shift += (want - s.shift) * ease;
    for (let i = 0; i < s.count; i++) s.lift[i] += ((i === pick ? grip : 0) - s.lift[i]) * ease;

    // power-on: the tape is paid out from the reel, and each flag goes up as the tape reaches it
    const run = f.on(0.12, 0.75);
    const shown = Math.max(1, Math.round(run * s.n));
    const body = f.on(0, 0.3);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, 0.1], 2.5, pal.key, 0.2 * f.boot);
    f.path(s.floor.slice(0, shown + 1), pal.key, 0.1, 5);

    // ── the reel: a stand, the far flange, the wound pack, then a spoked flange the pack shows through
    const c0 = s.cuts[0];
    const hub: V3 = [c0.p[0], c0.p[1] + RW, c0.p[2]];
    const turn = -(s.shift * s.len) / RW + (1 - run) * 2.4;
    const rp = (r: number, a: number, side: number): V3 => [hub[0] + c0.t[0] * Math.cos(a) * r + c0.n[0] * side, hub[1] + Math.sin(a) * r, hub[2] + c0.t[2] * Math.cos(a) * r + c0.n[2] * side];
    const disc = (r: number, side: number): V3[] => {
      const seg = f.mobile ? 28 : 44;
      const o: V3[] = [];
      for (let i = 0; i < seg; i++) o.push(rp(r, (i / seg) * TAU, side));
      return o;
    };
    const back = HW * 1.7;
    for (const k of [-0.34, 0.34]) f.line(rp(0, 0, back), [hub[0] + c0.t[0] * k + c0.n[0] * back, FLOOR, hub[2] + c0.t[2] * k + c0.n[2] * back], pal.ink, 0.34 * body, 2.5);
    f.line(rp(0, 0, back), rp(0, 0, -HW * 1.5), pal.ink, 0.5 * body, 3);
    face(f, disc(RF, HW * 1.2), 0.07, 0.3, body);
    face(f, disc(RW, -HW), 0.15, 0.4, body);
    for (const r of [0.86, 0.72, 0.58]) f.path(disc(RW * r, -HW), pal.ink, 0.13 * body, 1, true);
    face(f, disc(0.13, -HW), 0.05, 0.5, body);
    const rim = disc(RF, -HW * 1.2);
    f.fill(rim, pal.ink, 0.03 * body);
    for (let k = 0; k < 6; k++) f.line(rp(0.13, turn + (k * TAU) / 6, -HW * 1.2), rp(RF, turn + (k * TAU) / 6, -HW * 1.2), pal.ink, 0.36 * body, 2);
    f.path(rim, pal.ink, 0.55 * body, 1.5, true);
    f.path(rim.slice(Math.round(rim.length * 0.14), Math.round(rim.length * 0.4)), pal.key, 0.75 * body, 1.75);
    lamp(f, rp(0, 0, -HW * 1.2), pal.key, 0.8 * body, 0.02);

    // ── what carries the tape: two rollers on posts, and the far post of the gate
    const gate = at(STOPS[1]);
    const gateOn = f.on(0.3, 0.3);
    const post = (c: Cut, k: number, top: number, level: number) => f.line([c.p[0] + c.n[0] * k, FLOOR, c.p[2] + c.n[2] * k], off(c, k, top), pal.ink, 0.42 * level, 2.5);
    post(gate, HW * 1.7, 0.56, gateOn);
    for (const stop of [STOPS[2], STOPS[3]]) {
      const c = at(stop);
      const level = clamp((run - stop) / 0.08 + 1);
      post(c, 0, -0.03, level);
      f.line(off(c, HW * 1.3, -0.025), off(c, -HW * 1.3, -0.025), pal.ink, 0.6 * level, 4.5);
    }

    // ── the tape, lit from below through its perforations
    const strip = [...s.far.slice(0, shown + 1), ...s.near.slice(0, shown + 1).reverse()];
    f.fill(strip, pal.bg, 0.94);
    f.fill(strip, pal.ink, 0.14);
    f.fill([...s.far.slice(0, Math.min(shown, Math.round(STOPS[1] * s.n)) + 1), ...s.near.slice(0, Math.min(shown, Math.round(STOPS[1] * s.n)) + 1).reverse()], pal.bg, 0.35);
    f.path(s.far.slice(0, shown + 1), pal.ink, 0.42, 1);
    trace(f, s.near.slice(0, shown + 1), pal.key, 0.7, 1.25, run >= 1 ? f.t / 13 : -1);
    const holes = Math.round((f.mobile ? 34 : 64) * (f.q < 0.8 ? 0.6 : 1));
    const slip = (((s.shift * holes) % 1) + 1) % 1;
    for (let j = 0; j < holes; j++) {
      const at0 = (j + slip) / holes;
      if (at0 > run) break;
      const c = at(at0);
      for (const side of [0.76, -0.76]) f.dot(off(c, HW * side, 0.002), 0.011, pal.key, at0 < STOPS[1] ? 0.3 : 0.62);
    }
    if (run >= 1) {
      face(f, s.tail, 0.42, 0.85, f.on(0.95, 0.2), pal.gold);
      f.line(s.far[s.n], s.near[s.n], pal.gold, 0.9, 1.5);
    }

    // ── the gate: the lamp over the tape reads what passes under it
    if (gateOn > 0) {
      f.glow(gate.p, 0.3, pal.key, (0.3 + 0.25 * grip) * gateOn);
      const lintel: V3[] = [off(gate, HW * 1.7, 0.44), off(gate, -HW * 1.7, 0.44), off(gate, -HW * 1.7, 0.56), off(gate, HW * 1.7, 0.56)];
      face(f, lintel, 0.14, 0.45, gateOn);
      f.line(lintel[3], lintel[2], pal.key, 0.7 * gateOn, 1.5);
      for (const side of [1, -1]) f.line(off(gate, HW * side, 0.035), off(gate, HW * side, 0.44), pal.ink, 0.2 * gateOn, 1);
      f.line(off(gate, HW, 0.035), off(gate, -HW, 0.035), pal.gold, 0.8 * gateOn, 1.5);
      f.fill([off(gate, 0.03, 0.44), off(gate, -0.03, 0.44), off(gate, 0, 0.36)], pal.gold, 0.95 * gateOn);
      post(gate, -HW * 1.7, 0.56, gateOn);
      lamp(f, off(gate, 0, 0.5), pal.gold, gateOn * (f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 0.9)), 0.017);
    }

    // ── the notches and their flags, far to near; the last is the current release
    const tones = [pal.emerald, pal.accent, pal.ink2];
    for (let i = 0; i < s.count; i++) {
      const rest = M0 + i * sp;
      const born = clamp((run - rest) / 0.07);
      if (born <= 0) continue;
      const current = i === s.count - 1;
      const kind = ORDER[i % ORDER.length];
      const colour = current ? pal.gold : tones[kind];
      const up = Math.max(s.lift[i], current ? 0.5 : 0);
      const c = at(rest + s.shift);
      const edge = off(c, -HW);
      f.line(off(c, HW), edge, colour, (0.5 + 0.5 * up) * born, 1.25 + up);
      f.fill([along(edge, c, 0.026), along(edge, c, -0.026), off(c, -HW * 0.62)], pal.bg, 0.95 * born);
      const foot = off(c, HW);
      const h = (0.22 + 0.26 * up) * born;
      const top: V3 = [foot[0], foot[1] + h, foot[2]];
      const fw = 0.17 + 0.1 * up;
      const fh = 0.11 + 0.06 * up;
      const wave = f.still ? 0 : Math.sin(f.t * 1.3 + i * 1.9) * 0.014;
      const tip: V3 = [top[0] + WIND[0] * fw, top[1] - fh / 2 + wave, top[2] + WIND[2] * fw];
      const flag: V3[] = [top, tip, [top[0], top[1] - fh, top[2]]];
      if (up > 0.02) f.glow([top[0] + WIND[0] * fw * 0.4, top[1] - fh / 2, top[2]], 0.34, colour, 0.5 * up * born);
      f.line(foot, top, pal.ink, (0.55 + 0.4 * up) * born, 1.25);
      f.dot(foot, 0.012, colour, 0.9 * born);
      // a removed entry flies an open flag: an outline, with nothing in it
      f.fill(flag, pal.bg, 0.8 * born);
      f.fill(flag, colour, (kind === 2 && !current ? 0.06 : 0.3 + 0.5 * up) * born);
      f.path(flag, colour, (0.75 + 0.25 * up) * born, 1.25, true);
      const size = f.mobile ? 9 : 10;
      if (current) f.label("CURRENT RELEASE", top, { align: "center", dy: -12, size, colour: pal.gold, alpha: 0.92 * born });
      else f.label(KINDS[kind], top, { align: "center", dy: -12, size, colour: rgba(colour, 1), alpha: clamp(up * 1.4) * born });
    }
  },
};

export default scene;
