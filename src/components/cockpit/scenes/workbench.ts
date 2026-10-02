/**
 * WORKBENCH — the toolkit, as a toolmaker's bench.
 *
 * A ruled bench mat seen from above, with four precision instruments laid out
 * square on it: a vernier caliper, a slide rule, a protractor with its arm and
 * a pair of dividers. Each stands for one of the things the page's calculators
 * work out, and is named for it on the mat: size, cost, leverage, margin. The
 * graduations are tick marks only (the slide rule's are true logarithmic
 * scales); there is not a numeral, a reading or a result anywhere on the bench.
 *
 * The pointer: the instrument under the cursor lifts off the mat, leaving its
 * shadow behind, and works: the caliper's jaws open, the slide runs out of the
 * rule and its cursor travels, the protractor's arm sweeps, the dividers open.
 * Left alone, each one moves a hair now and then, as if just set down.
 */
import { clamp, lerp, type Frame, type Scene, type V3 } from "../engine";
import { deck, pool } from "../kit";

/** the mat: its height, and its half-extents across and in depth */
const MAT = 0.1;
const MX = 1.42;
const MZ = 0.92;
/** lengths: the caliper's beam, the slide rule, the protractor's radius, a divider leg */
const BEAM = 1.12;
const RULE = 1.46;
const RP = 0.45;
const LEG = 0.6;

type Poly = readonly (readonly [number, number])[];
type Place = (u: number, v: number) => V3;
/** an instrument in hand: where its plan lands on the bench, where its shadow falls, how lit and how lifted it is */
type Tool = { at: Place; sh: Place; on: number; k: number };
type Spec = { name: string; ox: number; oz: number; rot: number; centre: readonly [number, number]; label: readonly [number, number]; align: CanvasTextAlign; draw: (f: Frame, t: Tool, op: number) => void };
type State = { k: number[] };

const rect = (u0: number, v0: number, u1: number, v1: number): Poly => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
const place = (ox: number, oz: number, rot: number, y: number, slip = 0): Place => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return (u, v) => [ox + u * c - v * s + slip, y, oz + u * s + v * c - slip];
};

/** a logarithmic scale over `decades`: [position 0..1, weight of the mark] */
function logScale(decades: number): [number, number][] {
  const out: [number, number][] = [];
  for (let d = 0; d < decades; d++) {
    for (let i = 0; i < 30; i++) {
      const x = i < 10 ? 1 + i * 0.1 : i < 22 ? 2 + (i - 10) * 0.25 : 5 + (i - 22) * 0.625;
      out.push([(d + Math.log10(x)) / decades, i === 0 ? 3 : i === 10 || i === 22 || i === 5 ? 2 : 1]);
    }
  }
  out.push([1, 3]);
  return out;
}
const LOG1 = logScale(1);
const LOG2 = logScale(2);

/** a machined part: a dark body under a steel tint (or brass), with a bright arris */
function part(f: Frame, t: Tool, poly: Poly, tint = 0.2, colour?: string): void {
  const pts = poly.map(([u, v]) => t.at(u, v));
  f.fill(pts, f.pal.bg, 0.95 * t.on);
  f.fill(pts, colour ?? f.pal.ink, (tint + 0.07 * t.k) * t.on);
  f.path(pts, colour ?? f.pal.ink, (0.55 + 0.3 * t.k) * t.on, 1, true);
}

/** what the parts leave on the mat: the shadow stays put while the instrument rises */
function shadow(f: Frame, t: Tool, polys: readonly Poly[]): void {
  for (const poly of polys) f.fill(poly.map(([u, v]) => t.sh(u, v)), f.pal.bg, (0.45 + 0.3 * t.k) * t.on);
}

/** many graduations in one stroke */
function marks(f: Frame, t: Tool, segs: readonly (readonly [number, number, number, number])[], colour: string, alpha: number, width = 1): void {
  const { ctx } = f;
  ctx.beginPath();
  for (const [u0, v0, u1, v1] of segs) {
    const a = f.P(...t.at(u0, v0));
    const b = f.P(...t.at(u1, v1));
    if (!a || !b) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.strokeStyle = colour;
  ctx.globalAlpha = clamp(alpha * t.on);
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function caliper(f: Frame, t: Tool, op: number): void {
  const { pal } = f;
  const g = 0.04 + 0.36 * op;
  const fixed: Poly = [[-0.075, 0.2], [-0.025, 0.26], [0, 0.26], [0, -0.36], [-0.045, -0.36], [-0.075, -0.3]];
  const jaw: Poly = [[g, 0.26], [g + 0.025, 0.26], [g + 0.075, 0.2], [g + 0.075, -0.3], [g + 0.045, -0.36], [g, -0.36]];
  const beam = rect(-0.075, 0, BEAM, 0.11);
  const slider = rect(g + 0.075, -0.045, g + 0.42, 0.155);
  const rod = rect(BEAM - 0.02, 0.042, BEAM + g - 0.04, 0.068);
  shadow(f, t, [rod, beam, fixed, jaw, slider]);
  part(f, t, rod, 0.3);
  part(f, t, beam, 0.17);
  part(f, t, fixed, 0.24);
  const step = f.mobile ? 0.05 : 0.025;
  const main: [number, number, number, number][] = [];
  for (let i = 0; 0.02 + i * step < BEAM - 0.03; i++) main.push([0.02 + i * step, 0.003, 0.02 + i * step, i % 10 === 0 ? 0.062 : i % 5 === 0 ? 0.046 : 0.03]);
  marks(f, t, main, pal.ink, 0.62);
  part(f, t, slider, 0.25);
  part(f, t, jaw, 0.27);
  // the vernier: ten divisions over nine of the beam's
  const vern: [number, number, number, number][] = [];
  for (let j = 0; j <= 10; j++) vern.push([g + 0.1 + j * step * 0.9, -0.04, g + 0.1 + j * step * 0.9, j % 5 === 0 ? -0.004 : -0.016]);
  marks(f, t, vern, pal.ink, 0.7);
  marks(f, t, [[g + 0.09, 0.012, g + 0.4, 0.012], [g + 0.09, 0.098, g + 0.4, 0.098]], pal.ink, 0.25);
  f.dot(t.at(g + 0.32, -0.05), 0.024, pal.gold, 0.9 * t.on);
  f.dot(t.at(g + 0.2, 0.155), 0.017, pal.gold, 0.8 * t.on);
  // what the jaws hold between them: a span, not a figure
  marks(f, t, [[0, -0.2, g, -0.2], [0.012, -0.225, 0.012, -0.175], [g - 0.012, -0.225, g - 0.012, -0.175]], pal.gold, 0.45 + 0.55 * t.k, 1.5);
}

function slideRule(f: Frame, t: Tool, op: number): void {
  const { pal } = f;
  const sl = 0.02 + 0.3 * op;
  const rails = [rect(0, 0.05, RULE, 0.15), rect(0, -0.15, RULE, -0.05), rect(0, -0.05, 0.03, 0.05), rect(RULE - 0.03, -0.05, RULE, 0.05)];
  const slide = rect(sl, -0.05, sl + RULE, 0.05);
  shadow(f, t, [rect(0, -0.15, RULE, 0.15), slide]);
  for (const r of rails) part(f, t, r, 0.17);
  part(f, t, slide, 0.29);
  // four scales, face to face in pairs: two decades above, one below; the slide's pair travels with it
  const w = RULE - 0.14;
  const fine = f.mobile ? 2 : 1;
  const stock: [number, number, number, number][] = [];
  const moving: [number, number, number, number][] = [];
  for (const [at, wt] of LOG2) {
    if (wt < fine) continue;
    stock.push([0.07 + at * w, 0.055, 0.07 + at * w, 0.068 + 0.014 * wt]);
    moving.push([sl + 0.07 + at * w, 0.045, sl + 0.07 + at * w, 0.034 - 0.011 * wt]);
  }
  for (const [at, wt] of LOG1) {
    if (wt < fine) continue;
    stock.push([0.07 + at * w, -0.055, 0.07 + at * w, -0.068 - 0.014 * wt]);
    moving.push([sl + 0.07 + at * w, -0.045, sl + 0.07 + at * w, -0.034 + 0.011 * wt]);
  }
  marks(f, t, stock, pal.ink, 0.6);
  marks(f, t, moving, pal.ink, 0.72);
  // the cursor: a glass runner with one hairline
  const c = 0.36 + 0.52 * op;
  const glass = rect(c - 0.075, -0.15, c + 0.075, 0.15).map(([u, v]) => t.at(u, v));
  f.fill(glass, pal.key, 0.1 * t.on);
  f.path(glass, pal.ink, 0.5 * t.on, 1, true);
  part(f, t, rect(c - 0.075, 0.15, c + 0.075, 0.178), 0.5, pal.gold);
  part(f, t, rect(c - 0.075, -0.178, c + 0.075, -0.15), 0.5, pal.gold);
  marks(f, t, [[c, -0.15, c, 0.15]], pal.gold, 0.75 + 0.25 * t.k, 1.5);
}

function protractor(f: Frame, t: Tool, op: number): void {
  const { pal } = f;
  const n = f.mobile ? 18 : 30;
  const band: [number, number][] = [];
  for (let i = 0; i <= n; i++) band.push([Math.cos((Math.PI * i) / n) * RP, Math.sin((Math.PI * i) / n) * RP]);
  for (let i = n; i >= 0; i--) band.push([Math.cos((Math.PI * i) / n) * (RP - 0.115), Math.sin((Math.PI * i) / n) * (RP - 0.115)]);
  const base = rect(-RP, -0.075, RP, 0.012);
  const a = lerp(0.5, 2.25, op);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const arm: Poly = [[-0.05 * ca + 0.024 * sa, -0.05 * sa - 0.024 * ca], [(RP + 0.1) * ca + 0.024 * sa, (RP + 0.1) * sa - 0.024 * ca], [(RP + 0.13) * ca, (RP + 0.13) * sa], [(RP + 0.1) * ca - 0.024 * sa, (RP + 0.1) * sa + 0.024 * ca], [-0.05 * ca - 0.024 * sa, -0.05 * sa + 0.024 * ca]];
  shadow(f, t, [band, base, arm]);
  part(f, t, band, 0.17);
  part(f, t, base, 0.22);
  const deg: [number, number, number, number][] = [];
  const every = f.mobile ? 10 : 5;
  for (let d = 0; d <= 180; d += every) {
    const c = Math.cos((d * Math.PI) / 180);
    const s = Math.sin((d * Math.PI) / 180);
    const len = d % 30 === 0 ? 0.08 : d % 10 === 0 ? 0.052 : 0.032;
    deg.push([c * (RP - 0.006), s * (RP - 0.006), c * (RP - len), s * (RP - len)]);
  }
  marks(f, t, deg, pal.ink, 0.62);
  marks(f, t, [[0, 0.012, 0, 0.09], [-RP + 0.04, -0.03, RP - 0.04, -0.03]], pal.ink, 0.4);
  // the angle the arm has opened, as a sector of light: an angle, never a number
  const fan: V3[] = [t.at(0, 0)];
  const steps = Math.max(4, Math.round(a * 7));
  for (let i = 0; i <= steps; i++) fan.push(t.at(Math.cos((a * i) / steps) * 0.25, Math.sin((a * i) / steps) * 0.25));
  f.fill(fan, pal.gold, (0.1 + 0.16 * t.k) * t.on);
  f.path(fan.slice(1), pal.gold, (0.5 + 0.4 * t.k) * t.on, 1.25);
  part(f, t, arm, 0.3);
  marks(f, t, [[0, 0, (RP + 0.1) * ca, (RP + 0.1) * sa]], pal.gold, 0.7 + 0.3 * t.k, 1.25);
  f.dot(t.at(0, 0), 0.03, pal.gold, 0.95 * t.on);
  f.dot(t.at(0, 0), 0.011, pal.bg, 0.9 * t.on);
}

function dividers(f: Frame, t: Tool, op: number): void {
  const { pal } = f;
  const b = 0.07 + 0.38 * op;
  const leg = (side: number): Poly => {
    const dx = side * Math.sin(b);
    const dy = -Math.cos(b);
    // a tapered leg: full width at the joint, a point at the tip
    return [[-dy * 0.026, dx * 0.026], [dx * LEG * 0.86 - dy * 0.009, dy * LEG * 0.86 + dx * 0.009], [dx * LEG, dy * LEG], [dx * LEG * 0.86 + dy * 0.009, dy * LEG * 0.86 - dx * 0.009], [dy * 0.026, -dx * 0.026]];
  };
  const grip = rect(-0.024, 0.03, 0.024, 0.17);
  const joint: [number, number][] = [];
  for (let i = 0; i < 12; i++) joint.push([Math.cos((i * Math.PI) / 6) * 0.052, Math.sin((i * Math.PI) / 6) * 0.052]);
  shadow(f, t, [leg(-1), leg(1), grip, joint]);
  // the wing: the graduated arc the legs open along
  const wing: [number, number, number, number][] = [];
  const r = LEG * 0.46;
  for (let i = -6; i < 6; i++) wing.push([Math.sin((b * i) / 6) * r, -Math.cos((b * i) / 6) * r, Math.sin((b * (i + 1)) / 6) * r, -Math.cos((b * (i + 1)) / 6) * r]);
  marks(f, t, wing, pal.gold, 0.75, 1.5);
  part(f, t, grip, 0.24);
  marks(f, t, [0.07, 0.1, 0.13].map((v) => [-0.024, v, 0.024, v] as const), pal.ink, 0.45);
  part(f, t, leg(-1), 0.24);
  part(f, t, leg(1), 0.28);
  part(f, t, joint, 0.5, pal.gold);
  f.dot(t.at(0, 0), 0.014, pal.bg, 0.9 * t.on);
  // what the points step off between them
  const x = Math.sin(b) * LEG;
  const y = -Math.cos(b) * LEG;
  marks(f, t, [[-x, y, x, y]], pal.gold, 0.4 + 0.6 * t.k, 1.25);
  for (const side of [-1, 1]) f.dot(t.at(side * x, y), 0.014, pal.gold, 0.95 * t.on);
}

/** the bench: the page's own words for what its calculators work out, one instrument each */
const TOOLS: readonly Spec[] = [
  { name: "SIZE", ox: -1.2, oz: 0.42, rot: 0, centre: [0.5, -0.02], label: [0.62, -0.17], align: "left", draw: caliper },
  { name: "LEVERAGE", ox: 0.84, oz: 0.3, rot: 0, centre: [0, 0.2], label: [0, -0.15], align: "center", draw: protractor },
  { name: "COST", ox: -1.27, oz: -0.5, rot: 0, centre: [0.8, 0], label: [0, -0.26], align: "left", draw: slideRule },
  { name: "MARGIN", ox: 1.0, oz: -0.19, rot: 0, centre: [0, -0.3], label: [0.1, 0.1], align: "left", draw: dividers },
];

const scene: Scene<State> = {
  pose: 10,
  setup() {
    return { k: TOOLS.map(() => 0) };
  },
  draw(f, s) {
    const { pal } = f;
    // looked down upon, and held almost still: a bench does not swing about
    f.cam.parallax = 0.5;
    f.aim(0.09 + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.03), -0.8, 6.4, 1.17);
    const ease = 1 - Math.exp(-f.dt * 6);
    const mat = place(0, 0, 0, MAT);

    // ── the pointer: which instrument it is over
    let pick = -1;
    let best = 0.04;
    TOOLS.forEach((spec, i) => {
      const near = f.near(place(spec.ox, spec.oz, spec.rot, MAT)(spec.centre[0], spec.centre[1]), f.u * 1.05);
      if (near > best) {
        best = near;
        pick = i;
      }
    });
    for (let i = 0; i < TOOLS.length; i++) s.k[i] += ((i === pick ? clamp(best * 1.8) : 0) - s.k[i]) * ease;

    // ── the bench top and the mat: a ruled slab with a lit edge
    const matOn = f.on(0, 0.35);
    deck(f, { y: MAT - 0.05, half: 4.25, step: 0.85, alpha: 0.08, drift: 0 });
    pool(f, [0, MAT - 0.05, 0], 2.8, pal.key, 0.2 * f.boot);
    const slab: V3[] = [mat(-MX, -MZ), mat(MX, -MZ), mat(MX, MZ), mat(-MX, MZ)];
    const front: V3[] = [slab[0], slab[1], [MX, MAT - 0.045, -MZ], [-MX, MAT - 0.045, -MZ]];
    f.fill(front, pal.bg, 0.95 * matOn);
    f.fill(front, pal.key, 0.16 * matOn);
    f.fill(slab, pal.bg, 0.88 * matOn);
    f.fill(slab, pal.key, 0.06 * matOn);
    const grid: [number, number, number, number][] = [];
    const cell = f.mobile ? 0.355 : 0.1775;
    for (let i = 1; i * cell < MX * 2 - 0.01; i++) grid.push([-MX + i * cell, -MZ + 0.05, -MX + i * cell, MZ - 0.05]);
    for (let i = 1; i * cell < MZ * 2 - 0.06; i++) grid.push([-MX + 0.05, -MZ + 0.05 + i * cell, MX - 0.05, -MZ + 0.05 + i * cell]);
    const bench: Tool = { at: mat, sh: mat, on: matOn, k: 0 };
    marks(f, bench, grid, pal.ink, 0.07);
    f.path([mat(-MX + 0.05, -MZ + 0.05), mat(MX - 0.05, -MZ + 0.05), mat(MX - 0.05, MZ - 0.05), mat(-MX + 0.05, MZ - 0.05)], pal.ink, 0.22 * matOn, 1, true);
    f.path(slab, pal.key, 0.5 * matOn, 1.25, true);
    f.line(slab[0], slab[1], pal.key, 0.9 * matOn, 1.5);

    // ── the instruments, far row first; each is set down in turn at power-on
    TOOLS.forEach((spec, i) => {
      const on = f.on(0.3 + i * 0.17, 0.3);
      if (on <= 0.003) return;
      const k = s.k[i];
      // at rest it stirs a hair; in hand it works through its whole travel
      const idle = f.still ? 0.3 : 0.24 + 0.1 * Math.sin(f.t * 0.23 + i * 1.9 + f.rnd(i) * 6);
      const op = lerp(idle, 0.5 + 0.5 * Math.sin(f.t * 0.9 + i), k * (f.still ? 0 : 1));
      const y = MAT + 0.012 + 0.1 * k + (1 - on) * 0.14;
      const tool: Tool = { at: place(spec.ox, spec.oz, spec.rot, y), sh: place(spec.ox, spec.oz, spec.rot, MAT + 0.002, 0.012 + 0.03 * k), on, k };
      if (k > 0.02) pool(f, tool.sh(spec.centre[0], spec.centre[1]), 0.75, pal.gold, 0.2 * k);
      spec.draw(f, tool, op);
      const name = tool.sh(spec.label[0], spec.label[1]);
      f.label(spec.name, name, { align: spec.align, size: f.mobile ? 8 : 10, colour: k > 0.5 ? pal.gold : pal.ink2, alpha: (0.55 + 0.45 * k) * on });
    });
  },
};

export default scene;
