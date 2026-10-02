/**
 * FUNDING — money moving, safely and visibly, between two places.
 *
 * On the left a small glass plinth: YOU. On the right a larger block of smoked
 * glass with a ring door: your trading ACCOUNT. Two lifted rails join them. The
 * upper one carries deposits left to right, the lower one withdrawals right to
 * left, and each threads one graduated checkpoint ring on the way, which
 * brightens for a moment as the light passes through it: verification.
 *
 * Nothing here is a figure: no amounts, no fees, no times, no provider names.
 * It is a drawing of a route, and of the check that stands on it.
 */
import { TAU, clamp, lerp, type Frame, type Scene, type V3 } from "../engine";
import { arc, box, deck, lamp, orb, panel, pool, ring, ringPoint, trace, type Panel } from "../kit";

const FLOOR = -1.3;
/** the plane the transfer happens in: the vault's door face */
const ZF = -0.3;
const YOU_X = -1.2;
const YOU_TOP = -0.88;
const DOOR_R = 0.47;
/** both checkpoints stand on one mast, half way along the route */
const GATE_X = -0.22;
const GATE_R = 0.24;
/** seconds for one pulse to travel a rail */
const PERIOD = 12;
/** how far the door slab stands proud of the vault's face */
const PROUD = 0.09;

type Lane = { a: V3; b: V3; lift: number; pts: V3[]; tg: number; gate: V3; lens: V3[]; phase: number };
type State = { dep: Lane; wd: Lane; door: V3; seat: V3[]; slab: V3[]; hub: V3; lead: number; spin: number };

const along = (l: Lane, t: number): V3 => [lerp(l.a[0], l.b[0], t), lerp(l.a[1], l.b[1], t) + Math.sin(Math.PI * t) * l.lift, lerp(l.a[2], l.b[2], t)];
const frac = (v: number) => v - Math.floor(v);
const disc = (c: V3, r: number, axis: "x" | "z", n: number): V3[] => Array.from({ length: n }, (_, i) => ringPoint(c, r, i / n, axis));

/** A block of smoked glass: far edges seen through it, a lit top, the flank that faces the camera, a pane for a front. */
function glass(f: Frame, min: V3, max: V3, on: number, colour: string): Panel {
  const { pal } = f;
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const lo = y0 + (1 - on) * -0.18;
  const hi = y1 + (1 - on) * -0.18;
  f.path([[x0, lo, z1], [x0, hi, z1], [x1, hi, z1], [x1, lo, z1]], pal.ink, 0.08 * on, 1);
  const camX = Math.sin(f.cam.yaw) * f.cam.dist;
  const sx = camX < x0 ? x0 : camX > x1 ? x1 : null;
  if (sx !== null) {
    const side: V3[] = [[sx, lo, z0], [sx, lo, z1], [sx, hi, z1], [sx, hi, z0]];
    f.fill(side, pal.bg, 0.6 * on);
    f.fill(side, colour, 0.045 * on);
    f.path(side, pal.ink, 0.16 * on, 1, true);
  }
  const top: V3[] = [[x0, hi, z0], [x1, hi, z0], [x1, hi, z1], [x0, hi, z1]];
  f.fill(top, pal.bg, 0.5 * on);
  f.fill(top, colour, 0.1 * on);
  f.path(top, colour, 0.34 * on, 1, true);
  return panel(f, [(x0 + x1) / 2, (y0 + y1) / 2, z0], x1 - x0, y1 - y0, { on, colour, alpha: 0.62, glass: 0.05 });
}

/** The ring door: a graduated seat, a slab standing proud of the face, locking bolts, a handwheel that turns very slowly. */
function door(f: Frame, s: State, dy: number, on: number, turn: number, warm: number): void {
  const { pal } = f;
  const r = DOOR_R;
  const c: V3 = [s.door[0], s.door[1] + dy, ZF];
  const face: V3 = [c[0], c[1], ZF - PROUD];
  const wheel: V3 = [c[0], c[1], ZF - PROUD - 0.08];
  // the discs are computed once; they only move while the vault rises into place
  const seat = dy ? s.seat.map((p): V3 => [p[0], p[1] + dy, p[2]]) : s.seat;
  const slab = dy ? s.slab.map((p): V3 => [p[0], p[1] + dy, p[2]]) : s.slab;
  // light from inside the vault, leaking round the seat
  f.glow(c, r * 1.55, pal.key, (0.13 + 0.05 * warm) * on);
  ring(f, c, r, { axis: "z", colour: pal.ink, alpha: 0.36 * on, ticks: f.mobile || f.q < 0.8 ? 30 : 60, major: 5, tickLen: r * 0.06 });
  // the slab: its machined edge, then its face
  f.fill(seat, pal.bg, 0.8 * on);
  f.fill(seat, pal.ink, 0.09 * on);
  ring(f, c, r * 0.86, { axis: "z", colour: pal.ink, alpha: 0.22 * on });
  f.fill(slab, pal.bg, 0.82 * on);
  f.fill(slab, pal.key, 0.06 * on);
  ring(f, face, r * 0.86, { axis: "z", colour: pal.gold, alpha: (0.62 + 0.3 * warm) * on, width: 1.5 });
  ring(f, face, r * 0.7, { axis: "z", colour: pal.ink, alpha: 0.13 * on });
  for (let k = 0; k < 8; k++) f.line(ringPoint(face, r * 0.73, (k + 0.5) / 8, "z"), ringPoint(face, r * 0.83, (k + 0.5) / 8, "z"), pal.ink, 0.42 * on, 2.5);
  ring(f, wheel, r * 0.36, { axis: "z", colour: pal.ink, alpha: 0.55 * on, width: 1.5 });
  for (let k = 0; k < 5; k++) {
    const a = turn + k / 5;
    f.line(ringPoint(wheel, r * 0.07, a, "z"), ringPoint(wheel, r * 0.46, a, "z"), pal.ink, 0.5 * on, 1.5);
    f.dot(ringPoint(wheel, r * 0.46, a, "z"), 0.014, pal.ink, 0.8 * on);
  }
  f.dot(wheel, 0.036, pal.gold, 0.9 * on);
  f.dot(wheel, 0.014, pal.ink, 0.9 * on);
}

/** One half of a checkpoint: a short machined collar (it is drawn in two passes, so the rail threads it). */
function gate(f: Frame, c: V3, colour: string, hit: number, on: number, near: boolean): void {
  const from = near ? 0.25 : -0.25;
  const o = { axis: "x" as const, from, to: from + 0.5 };
  const k = (near ? 1 : 0.55) * on;
  ring(f, [c[0] + 0.03, c[1], c[2]], GATE_R, { ...o, colour: f.pal.ink, alpha: 0.2 * k });
  ring(f, [c[0] - 0.03, c[1], c[2]], GATE_R, { ...o, colour: f.pal.ink, alpha: (0.38 + 0.3 * hit) * k, ticks: 12, major: 3, tickLen: 0.036 });
  ring(f, c, GATE_R * 0.72, { ...o, colour, alpha: (0.45 + 0.5 * hit) * k, width: 1.5 });
}

/** A small arrowhead on a rail: the direction of travel, legible even in the still frame. */
function chevron(f: Frame, l: Lane, t: number, colour: string, alpha: number): void {
  const p = along(l, t);
  const q = along(l, t + 0.012);
  const m = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  const ux = ((q[0] - p[0]) / m) * 0.042;
  const uy = ((q[1] - p[1]) / m) * 0.042;
  f.path([[p[0] - ux - uy * 0.55, p[1] - uy + ux * 0.55, p[2]], p, [p[0] - ux + uy * 0.55, p[1] - uy - ux * 0.55, p[2]]], colour, alpha, 1.25);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const door: V3 = [1.09, -0.65, ZF];
    const hub: V3 = [YOU_X, YOU_TOP + 0.14, ZF];
    const lane = (a: V3, b: V3, lift: number, ahead: number): Lane => {
      const l: Lane = { a, b, lift, pts: arc(a, b, lift, f.mobile ? 30 : 46), tg: (GATE_X - a[0]) / (b[0] - a[0]), gate: a, lens: [], phase: 0 };
      l.gate = along(l, l.tg);
      l.lens = disc(l.gate, GATE_R * 0.72, "x", 24);
      // at clock 0 (the still frame) a pulse sits `ahead` past this lane's checkpoint
      l.phase = l.tg + ahead;
      return l;
    };
    const n = f.mobile ? 24 : 36;
    return {
      door,
      seat: disc(door, DOOR_R * 0.86, "z", n),
      slab: disc([door[0], door[1], ZF - PROUD], DOOR_R * 0.86, "z", n),
      hub,
      dep: lane(hub, ringPoint(door, DOOR_R, 0.36, "z"), 1.3, 0),
      wd: lane(ringPoint(door, DOOR_R, 0.54, "z"), hub, 0.5, 0.25),
      lead: f.rnd(3),
      spin: f.rnd(5),
    };
  },
  draw(f, s) {
    const { pal } = f;
    const sway = f.still ? 0 : Math.sin(f.t * 0.09 + f.rnd(1) * TAU) * 0.035;
    if (f.mobile) {
      f.aim(-0.45 + sway, 0.17, 6.2, 0.66);
      f.cx = f.w * 0.48;
      f.cy = f.h * 0.27;
    } else {
      // the headline owns the left: on a narrow desktop the instrument draws back and moves right
      // rather than sit under the text or spill off the stage (it spans -1.53 to +1.71 units of zoom)
      const left = Math.max(f.w * 0.46, Math.min(600, f.w * 0.56));
      const right = f.w - 24;
      const zoom = Math.min(0.85, (right - left) / (3.24 * f.u));
      f.aim(-0.45 + sway, 0.17, 6.2, zoom);
      f.cx = clamp(f.cx, left + 1.53 * zoom * f.u, right - 1.71 * zoom * f.u);
    }

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [0.5, FLOOR, 0], 2.7, pal.key, 0.26 * f.boot);

    // the clock of the route: pulses leave at regular intervals, once everything is lit
    const live = f.still ? 1 : clamp((f.t - 1.7) / 1.4);
    const clock = f.still ? 0 : f.t / PERIOD + s.lead;
    const n = f.mobile ? 1 : 2;
    const at = (l: Lane, k: number) => frac(clock + l.phase + k / n);
    const near = (l: Lane, where: number, w: number) => {
      let h = 0;
      for (let k = 0; k < n; k++) {
        const d = Math.abs(at(l, k) - where);
        h = Math.max(h, Math.exp(-((Math.min(d, 1 - d) / w) ** 2)));
      }
      return h * live;
    };
    const hits = [near(s.dep, s.dep.tg, 0.05), near(s.wd, s.wd.tg, 0.05)];

    // the route drawn on the deck, and the foot of the checkpoint mast
    const gOn = f.on(0.4, 0.4);
    f.line([YOU_X + 0.32, FLOOR, ZF], [0.42, FLOOR, ZF], pal.ink, 0.14 * f.boot, 1);
    ring(f, [GATE_X, FLOOR, ZF], 0.34, { colour: pal.ink, alpha: 0.22 * gOn, ticks: 24, major: 6, tickLen: 0.05 });
    ring(f, [GATE_X, FLOOR, ZF], 0.05, { colour: pal.ink, alpha: 0.4 * gOn, seg: 16 });
    // the checkpoints' light reaches the deck while a pulse is inside one
    pool(f, [GATE_X, FLOOR, ZF], 0.55, pal.gold, 0.16 * Math.max(hits[0], hits[1]));

    // ── ACCOUNT: the vault, furthest from the viewer, first to light
    const vOn = f.on(0, 0.4);
    box(f, [0.44, FLOOR, ZF - 0.08], [1.74, FLOOR + 0.08, 0.7], pal.ink, 0.16 * vOn, 0.035 * vOn);
    const front = glass(f, [0.52, FLOOR + 0.08, ZF], [1.66, -0.08, 0.62], vOn, pal.key);
    const dOn = f.on(0.2, 0.4);
    const arrive = near(s.dep, 1, 0.07);
    const home = near(s.wd, 1, 0.07);
    door(f, s, (1 - vOn) * -0.18, dOn, s.spin + (f.still ? 0 : f.t * 0.004), arrive);

    // ── checkpoints: the mast, the lenses and the far halves first, so the rails thread the rings
    for (const [y0, y1] of [[FLOOR, s.wd.gate[1] - GATE_R], [s.wd.gate[1] + GATE_R, s.dep.gate[1] - GATE_R]]) {
      f.line([GATE_X, y0, ZF], [GATE_X, y1, ZF], pal.ink, 0.13 * gOn, 2.5);
      f.line([GATE_X, y0, ZF], [GATE_X, y1, ZF], pal.ink, 0.3 * gOn, 1);
    }
    const lanes: [Lane, string, number][] = [
      [s.dep, pal.blue, f.on(0.55, 0.4)],
      [s.wd, pal.teal, f.on(0.75, 0.4)],
    ];
    lanes.forEach(([l, colour], i) => {
      f.fill(l.lens, pal.bg, 0.35 * gOn);
      f.fill(l.lens, colour, 0.05 * gOn);
      f.fill(l.lens, pal.gold, 0.16 * hits[i]);
      gate(f, l.gate, colour, hits[i], gOn, false);
    });

    // ── the two rails draw in, deposit first
    lanes.forEach(([l, colour, on]) => {
      if (on <= 0) return;
      const pts = on >= 1 ? l.pts : l.pts.slice(0, Math.max(2, Math.round(on * (l.pts.length - 1)) + 1));
      trace(f, pts, colour, 0.68, 1.5);
      if (on >= 1) {
        chevron(f, l, 0.24, colour, 0.7);
        chevron(f, l, 0.8, colour, 0.7);
      }
      // the money: champagne light with a short tail, brighter inside the checkpoint
      for (let k = 0; k < n; k++) {
        const t = at(l, k);
        const fade = clamp(t / 0.05) * clamp((1 - t) / 0.05) * live;
        if (fade <= 0.01) continue;
        const g = Math.exp(-(((t - l.tg) / 0.05) ** 2));
        const tail: V3[] = [];
        for (let i = 0; i <= 6; i++) tail.push(along(l, Math.max(0, t - 0.09 * (1 - i / 6))));
        f.path(tail, pal.gold, 0.32 * fade, 3);
        f.path(tail.slice(3), pal.gold, 0.8 * fade, 1.5);
        f.glow(tail[6], 0.12 + 0.12 * g, pal.gold, (0.6 + 0.3 * g) * fade);
        f.dot(tail[6], 0.013 + 0.006 * g, pal.ink, 0.95 * fade);
      }
    });
    lanes.forEach(([l, colour], i) => gate(f, l.gate, colour, hits[i], gOn, true));

    // the door's two ports: each warms as a pulse arrives or leaves
    f.dot(s.dep.b, 0.022, pal.blue, (0.6 + 0.4 * arrive) * lanes[0][2]);
    f.dot(s.wd.a, 0.022, pal.teal, (0.6 + 0.4 * near(s.wd, 0, 0.06)) * lanes[1][2]);
    f.dot(s.dep.b, 0.008, pal.ink, 0.8 * lanes[0][2]);
    f.dot(s.wd.a, 0.008, pal.ink, 0.8 * lanes[1][2]);

    // ── YOU: a small plinth, nearest the viewer, with a glass bead where both rails meet
    const yOn = f.on(0.12, 0.4);
    box(f, [YOU_X - 0.27, FLOOR, ZF - 0.27], [YOU_X + 0.27, FLOOR + 0.06, ZF + 0.27], pal.ink, 0.16 * yOn, 0.035 * yOn);
    const plinth = glass(f, [YOU_X - 0.21, FLOOR + 0.06, ZF - 0.21], [YOU_X + 0.21, YOU_TOP, ZF + 0.21], yOn, pal.key);
    ring(f, [YOU_X, YOU_TOP, ZF], 0.15, { colour: pal.key, alpha: 0.5 * yOn });
    orb(f, s.hub, 0.11, pal.key, yOn);
    const breathe = f.still ? 1 : 0.85 + 0.15 * Math.sin(f.t * 0.9);
    lamp(f, s.hub, pal.key, yOn * Math.min(1, breathe * 0.85 + 0.3 * home), 0.02);

    // lettering, engraved where it belongs
    const size = f.mobile ? 9 : 10;
    f.label("YOU", plinth.at(0.5, 0.5), { align: "center", size, colour: pal.ink, alpha: 0.82 * yOn });
    f.label("ACCOUNT", front.at(f.mobile ? 1 : 0.95, f.mobile ? 1 : 0.94), { align: "right", dy: f.mobile ? -9 : 0, size, colour: pal.ink, alpha: 0.82 * vOn });
    f.label("DEPOSIT", [GATE_X, s.dep.gate[1] + GATE_R, ZF], { align: "center", dy: -13, size, colour: pal.ink2, alpha: 0.85 * lanes[0][2] });
    f.label("WITHDRAWAL", [GATE_X, s.wd.gate[1] + (f.mobile ? -GATE_R : GATE_R), ZF], { align: f.mobile ? "right" : "left", dx: f.mobile ? -8 : 9, dy: f.mobile ? 12 : -11, size, colour: pal.ink2, alpha: 0.85 * lanes[1][2] });
    if (!f.mobile) f.label("VERIFICATION", [GATE_X, FLOOR, ZF - 0.34], { align: "center", dy: 13, size: 9, colour: pal.ink3, alpha: 0.7 * gOn });
  },
};

export default scene;
