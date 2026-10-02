/**
 * ENERGY — the pipeline deck.
 *
 * Energy is infrastructure before it is a price. Three glass pipelines cross
 * the deck from back-left to front-right, one for each energy market GIO4X
 * lists: Brent, WTI and natural gas. Each carries a slow stream of light past
 * a valve station (a graduated handwheel on a stem) and into a storage tank.
 *
 * Nothing here is a measurement: no flow rate, no tank level, no price. The
 * three lines run evenly; on an instrument page the valve of the page's own
 * line carries the champagne light.
 */
import { TAU, clamp, easeOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, ring, trace } from "../kit";

const LINES = [
  { tag: "brent", name: "BRENT" },
  { tag: "wti", name: "WTI" },
  { tag: "natural-gas", name: "NATURAL GAS" },
];

const FLOOR = -1.3;
/** height of a pipe's centre line, and its radius */
const AXIS = FLOOR + 0.22;
const PR = 0.07;
/** spacing between the three lines */
const GAP = 0.78;
/** where a line starts, where its valve sits (and half the valve body's length), where its tank stands */
const X0 = -1.95;
const XV = -0.4;
const VB = 0.1;
const XT = 1.2;
/** tank radius and height; the pipe ends at the tank wall */
const TR = 0.25;
const TH = 0.52;
const XE = XT - TR;
const WHEEL = AXIS + 0.44;
/** stations along a line, upstream to downstream: [x, flange radius in pipe radii (0 = a plain cut)] */
const RUN: [number, number][] = [[X0, 0], [-1.68, 0], [-1.38, 1.6], [-0.88, 1.6], [XV - VB, 2], [XV + VB, 2], [0.26, 1.6], [XE, 1.5]];
/** the stretch of RUN that is the valve body */
const BODY = 4;
const HALF = Math.PI / 2;

type State = { phase: number[]; turn: number[]; lead: number };
type Mark = readonly [V3, V3];

/** many short marks in one stroke: graduations, spokes */
function marks(f: Frame, segs: readonly Mark[], colour: string, alpha: number, width = 1): void {
  if (alpha <= 0.003) return;
  const { ctx } = f;
  ctx.beginPath();
  for (const [a, b] of segs) {
    const p = f.P(a[0], a[1], a[2]);
    const q = f.P(b[0], b[1], b[2]);
    if (!p || !q) continue;
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

/** a band along a pipe between two fractions of its radius (-1 the lower edge, 1 the upper), given the upper edge's offset `d` */
const band = (x0: number, x1: number, z: number, d: readonly [number, number], a: number, b: number): V3[] => [
  [x0, AXIS + d[0] * b, z + d[1] * b],
  [x1, AXIS + d[0] * b, z + d[1] * b],
  [x1, AXIS + d[0] * a, z + d[1] * a],
  [x0, AXIS + d[0] * a, z + d[1] * a],
];

/** a length of pipe along x: smoked glass (or cast metal), a broad highlight, a lit upper edge, the stream glowing inside */
function tube(f: Frame, eye: V3, x0: number, x1: number, z: number, r: number, edge: string, a: number, core = "", glass = 0.62, metal = 0.04): void {
  // the two edges of a cylinder are where its surface turns away from the eye
  const vy = eye[1] - AXIS;
  const vz = eye[2] - z;
  const k = r / Math.hypot(vy, vz);
  const d = [-vz * k, vy * k] as const;
  const quad = band(x0, x1, z, d, -1, 1);
  f.fill(quad, f.pal.bg, glass * a);
  f.fill(quad, f.pal.ink, metal * a);
  if (core) f.fill(band(x0, x1, z, d, -0.5, 0.42), core, 0.13 * a);
  f.fill(band(x0, x1, z, d, 0.36, 0.8), f.pal.ink, 0.085 * a);
  f.line(quad[3], quad[2], f.pal.ink, 0.22 * a, 1);
  f.line(quad[0], quad[1], edge, 0.55 * a, 1.25);
}

/** a machined flange: a plate with thickness and a bolt circle, its upper rim catching the light */
function flange(f: Frame, x: number, z: number, r: number, colour: string, a: number): void {
  const { ink, bg } = f.pal;
  const disc: V3[] = [];
  for (let i = 0; i < 18; i++) disc.push([x, AXIS + Math.sin((i / 18) * TAU) * r, z + Math.cos((i / 18) * TAU) * r]);
  ring(f, [x - 0.035, AXIS, z], r, { axis: "x", colour: ink, alpha: 0.3 * a, seg: 30 });
  f.fill(disc, bg, 0.72 * a);
  f.fill(disc, ink, 0.15 * a);
  if (!f.mobile) ring(f, [x, AXIS, z], r * 0.8, { axis: "x", colour: ink, alpha: 0.16 * a, seg: 24 });
  ring(f, [x, AXIS, z], r, { axis: "x", colour: ink, alpha: 0.36 * a, seg: 30 });
  ring(f, [x, AXIS, z], r, { axis: "x", from: 0.03, to: 0.47, colour, alpha: 0.8 * a, width: 1.5, seg: 30 });
}

/** point on a vertical cylinder about `c`, at angle `a` from the direction `phi` (that of the eye, or a wheel's turn) */
const around = (c: V3, r: number, phi: number, a: number, y: number): V3 => [c[0] + Math.cos(phi + a) * r, y, c[2] + Math.sin(phi + a) * r];

/** the valve: a bonnet and stem carrying a graduated handwheel, and the lamp that speaks for the line */
function valve(f: Frame, eye: V3, z: number, colour: string, on: number, turn: number, level: number, size: number): void {
  if (on <= 0.003) return;
  const { ink, bg } = f.pal;
  // powering on, the stem rises out of the bonnet
  const y = lerp(AXIS + 0.2, WHEEL, on);
  const c: V3 = [XV, y, z];
  const phi = Math.atan2(eye[2] - z, eye[0] - XV);
  const base = AXIS + PR * 1.4;
  const neck: V3[] = [-1, 1, 1, -1].map((side, i) => around(c, i < 2 ? 0.052 : 0.02, phi, side * HALF, i < 2 ? base : y));
  f.fill(neck, bg, 0.82 * on);
  f.fill(neck, ink, 0.12 * on);
  f.path(neck, ink, 0.42 * on, 1, true);
  ring(f, [XV, AXIS + 0.25, z], 0.06, { colour: ink, alpha: 0.42 * on, seg: 24 });
  const R = 0.2;
  const n = f.mobile || f.q < 0.75 ? 20 : 40;
  const spokes: Mark[] = [];
  const grads: Mark[] = [];
  for (let i = 0; i < 5; i++) spokes.push([around(c, 0.04, turn, (i / 5) * TAU, y), around(c, R, turn, (i / 5) * TAU, y)]);
  for (let i = 0; i < n; i++) grads.push([around(c, R - (i % 5 ? 0.02 : 0.04), turn, (i / n) * TAU, y), around(c, R, turn, (i / n) * TAU, y)]);
  ring(f, [XV, y - 0.03, z], R, { colour: ink, alpha: 0.3 * on, seg: 48 });
  marks(f, spokes, ink, 0.5 * on, 1.5);
  marks(f, grads, colour, 0.55 * on, 1);
  ring(f, c, R, { colour, alpha: 0.13 * on, width: f.mobile ? 3.5 : 6, seg: 56 });
  ring(f, c, R, { colour, alpha: 0.9 * on, width: 1.75, seg: 56 });
  ring(f, c, 0.04, { colour: ink, alpha: 0.6 * on, seg: 16 });
  lamp(f, [XV, y + 0.03, z], colour, level, size);
}

/** a storage tank: stacked courses around a body of smoked glass, under a graduated glass lid */
function tank(f: Frame, eye: V3, c: V3, colour: string, on: number, a: number): void {
  if (on <= 0.003) return;
  const { ctx } = f;
  const { ink, bg } = f.pal;
  const phi = Math.atan2(eye[2] - c[2], eye[0] - c[0]);
  // powering on, the tank rises course by course
  const top = c[1] + TH * on;
  const n = 12;
  const hoop = (r: number, y: number): V3[] => Array.from({ length: n * 2 }, (_, i) => around(c, r, phi, (Math.PI * i) / n, y));
  // the silhouette: the near half of the base, then the far half of the rim
  const body: V3[] = [];
  for (let i = 0; i <= n; i++) body.push(around(c, TR, phi, HALF - (Math.PI * i) / n, c[1]));
  for (let i = 0; i <= n; i++) body.push(around(c, TR, phi, -HALF - (Math.PI * i) / n, top));
  // the tank's weight on the deck
  f.fill(hoop(TR * 1.42, c[1]), bg, 0.2 * on);
  f.fill(hoop(TR * 1.18, c[1]), bg, 0.3 * on);
  f.fill(body, bg, 0.84 * on);
  f.fill(body, colour, 0.05 * on * a);
  // the light the line delivers, held in the glass
  f.glow([c[0], c[1] + 0.12, c[2]], TR * 1.25, colour, 0.3 * on * a);
  // the curve of the glass: rim light at both sides, one soft sheen, shade toward the right
  const pl = f.P(...around(c, TR, phi, HALF, c[1]));
  const pr = f.P(...around(c, TR, phi, -HALF, c[1]));
  if (pl && pr) {
    const g = ctx.createLinearGradient(Math.min(pl.x, pr.x), 0, Math.max(pl.x, pr.x), 0);
    g.addColorStop(0, rgba(colour, 0.2 * on * a));
    g.addColorStop(0.12, rgba(ink, 0.015));
    g.addColorStop(0.3, rgba(ink, 0.1 * on));
    g.addColorStop(0.46, rgba(ink, 0.012));
    g.addColorStop(0.86, rgba(bg, 0.3 * on));
    g.addColorStop(1, rgba(colour, 0.14 * on * a));
    ctx.beginPath();
    for (const v of body) {
      const p = f.P(v[0], v[1], v[2]);
      if (p) ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }
  for (let j = 0; j < 4; j++) {
    const y = c[1] + (TH * j) / 4;
    if (y > top) break;
    ring(f, [c[0], y, c[2]], TR, { from: -0.25, to: 0.25, rot: phi, colour: ink, alpha: (j ? 0.2 : 0.4) * on, seg: 44 });
  }
  f.line(around(c, TR, phi, HALF, c[1]), around(c, TR, phi, HALF, top), ink, 0.34 * on, 1);
  f.line(around(c, TR, phi, -HALF, c[1]), around(c, TR, phi, -HALF, top), ink, 0.34 * on, 1);
  const o: V3 = [c[0], top, c[2]];
  const lid = hoop(TR, top);
  f.fill(lid, bg, 0.62 * on);
  f.fill(lid, ink, 0.06 * on);
  ring(f, [c[0], top - 0.035, c[2]], TR, { from: -0.25, to: 0.25, rot: phi, colour, alpha: 0.4 * on * a, seg: 44 });
  ring(f, o, TR * 0.76, { colour: ink, alpha: 0.18 * on, seg: 44 });
  if (!f.mobile && f.q >= 0.75) {
    const grads: Mark[] = [];
    for (let i = 0; i < 48; i++) grads.push([around(o, TR * (i % 4 ? 0.93 : 0.88), phi, (i / 48) * TAU, top), around(o, TR, phi, (i / 48) * TAU, top)]);
    marks(f, grads, ink, 0.26 * on, 1);
  }
  // the rim is the lit part: a halo, the machined edge, and a highlight where it turns away
  ring(f, o, TR, { colour, alpha: 0.12 * on * a, width: f.mobile ? 3.5 : 6, seg: 56 });
  ring(f, o, TR, { colour, alpha: 0.9 * on * a, width: 1.75, seg: 56 });
  ring(f, o, TR, { from: 0.3, to: 0.52, rot: phi, colour: ink, alpha: 0.42 * on * a, width: 1.25, seg: 56 });
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    // per page: where each stream's light is, how each wheel was left, which colour leads
    return { phase: LINES.map((_, i) => f.rnd(i + 3)), turn: LINES.map((_, i) => f.rnd(i + 11) * TAU), lead: f.rnd(1) < 0.5 ? 0 : 1 };
  },
  draw(f, s) {
    const { pal } = f;
    const m = f.mobile;
    // the camera stands above the deck and looks down the lines, as over a scale model;
    // looking down puts the deck below the pivot, so the focal point is lifted to centre it
    f.aim(0.86 + Math.sin(f.t * 0.06) * 0.03, -0.4, 6.4, m ? 0.66 : 0.9);
    f.cy -= f.u * (m ? 1.12 : 1.1);
    f.cx = m ? f.w * 0.5 : f.cx - f.u * 0.1;
    const { yaw, pitch, dist } = f.cam;
    const eye: V3 = [dist * Math.cos(pitch) * Math.sin(yaw), -dist * Math.sin(pitch), -dist * Math.cos(pitch) * Math.cos(yaw)];

    deck(f, { y: FLOOR, alpha: 0.1, drift: 0, half: 5.25 });
    pool(f, [0.3, FLOOR, 0], 3.4, pal.key, 0.2 * f.boot);
    pool(f, [XT, FLOOR, 0], 2.4, pal.key, 0.14 * f.boot);

    // base plates: the valve station and the tank farm
    const side = GAP + 0.36;
    for (const [xa, xb] of [[XV - 0.3, XV + 0.3], [XT - 0.38, XT + 0.38]]) {
      const plate: V3[] = [[xa, FLOOR, -side], [xb, FLOOR, -side], [xb, FLOOR, side], [xa, FLOOR, side]];
      f.fill(plate, pal.ink, 0.032 * f.boot);
      f.path(plate, pal.ink, 0.17 * f.boot, 1, true);
    }

    const focus = LINES.findIndex((l) => l.tag === f.tag);
    const lit = easeOut((f.boot - 0.85) / 0.15);

    // back to front: BRENT, WTI, NATURAL GAS
    LINES.forEach((line, k) => {
      const z = (1 - k) * GAP;
      const isFocus = k === focus;
      const colour = isFocus ? pal.gold : focus < 0 && (k + s.lead) % 2 ? pal.teal : pal.key;
      // on an instrument page the other two lines stand back
      const dim = focus >= 0 && !isFocus ? 0.62 : 1;
      const soft = dim + (1 - dim) * 0.4;
      const reach = lerp(X0, XE, clamp((f.boot - 0.1 - k * 0.08) / 0.6));
      const flow = lerp(X0, XE, clamp((f.boot - 0.5 - k * 0.06) / 0.36));

      // the light the stream throws on the deck, and the warm pool under the page's own valve
      f.line([-1.5, FLOOR, z], [Math.min(reach, XE), FLOOR, z], colour, 0.05 * dim * f.boot, m ? 6 : 10);
      if (isFocus) pool(f, [XV, FLOOR, z], 1, pal.gold, 0.32 * lit);

      for (let i = 0; i < RUN.length - 1; i++) {
        const x0 = RUN[i][0];
        if (x0 >= reach) break;
        const x1 = Math.min(RUN[i + 1][0], reach);
        // depth: the lines emerge from the dark at the back
        const a = clamp(0.12 + (x0 - X0) / 0.75);
        if (i === BODY) {
          tube(f, eye, x0, x1, z, PR * 1.5, pal.ink, a, "", 0.72, 0.15);
          const rise = easeOut((f.boot - 0.5 - k * 0.08) / 0.25);
          const breathe = f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 0.9 + k * 2);
          valve(f, eye, z, colour, rise, s.turn[k] + (f.still ? 0 : f.t * 0.035), lit * breathe * dim, isFocus ? 0.032 : 0.024);
        } else {
          tube(f, eye, x0, x1, z, PR, colour, a * soft, flow >= x1 ? colour : "");
          if (flow > x0) trace(f, [[x0, AXIS, z], [Math.min(x1, flow), AXIS, z]], colour, 0.8 * a * dim, 1.25);
        }
        const [xf, fr] = RUN[i + 1];
        if (!fr || x1 < xf) continue;
        const last = i + 2 === RUN.length;
        // a saddle carries the line at every plain flange
        if (fr < 1.9 && !last) {
          const foot: V3[] = [[xf, AXIS, z - 0.045], [xf, AXIS, z + 0.045], [xf, FLOOR, z + 0.09], [xf, FLOOR, z - 0.09]];
          f.fill(foot, pal.bg, 0.7 * a);
          f.fill(foot, pal.ink, 0.1 * a);
          f.path(foot, pal.ink, 0.3 * a, 1, true);
        }
        flange(f, last ? xf - 0.05 : xf, z, PR * fr, colour, a * soft);
      }

      // the stream: slow packets of light travelling down the line, dimming as they pass through the valve
      if (flow >= XE) {
        for (let j = 0; j < (f.q < 0.75 ? 1 : 2); j++) {
          const t = (f.t / (10 + k * 1.5) + s.phase[k] + j * 0.5) % 1;
          const x = lerp(X0 + 0.3, XE - 0.04, t);
          const tail = Math.max(X0 + 0.3, x - 0.36);
          const env = clamp(Math.sin(Math.PI * t) * 3) * clamp((x - X0) / 0.9) * (0.35 + 0.65 * clamp((Math.abs(x - XV) - VB) / 0.2)) * dim;
          f.line([tail, AXIS, z], [x, AXIS, z], colour, 0.2 * env, m ? 6 : 9);
          f.line([tail, AXIS, z], [x, AXIS, z], colour, 0.55 * env, 2.5);
          f.line([lerp(tail, x, 0.55), AXIS, z], [x, AXIS, z], pal.ink, 0.75 * env, 1.25);
          f.dot([x, AXIS, z], 0.011, pal.ink, 0.95 * env);
        }
      }

      tank(f, eye, [XT, FLOOR, z], colour, easeOut((f.boot - 0.58 - k * 0.08) / 0.26), soft);
      // the market's name, engraved on the lid of its tank
      const ink = isFocus ? pal.gold : pal.ink;
      if (!m) f.label(line.name, [XT, FLOOR + TH, z], { align: "center", size: 9, colour: ink, alpha: (isFocus ? 0.95 : 0.8 * dim) * lit });
    });
  },
};

export default scene;
