/**
 * ACCOUNTS — three tiers of glass.
 *
 * The three account types stand as three thick slabs of edge-lit glass, carried
 * on machined standoffs as a rising stair: CLASSIC, PREMIUM, ECN. Each has its
 * name engraved in its front edge and its own edge light. A graduated rod stands
 * beside the stair with one index mark per tier: the three are set side by side
 * to be compared. The rod carries no figures, and nothing here states a spread,
 * a leverage or a deposit. A light crosses the three in turn, and the rod's
 * cursor follows it from tier to tier.
 */
import { clamp, easeInOut, rgba, type Frame, type Scene, type V3 } from "../engine";
import { box, deck, lamp, pool, ring, trace } from "../kit";

const NAMES = ["CLASSIC", "PREMIUM", "ECN"];
const FLOOR = -1.3;
/** seconds the light rests on one tier before it moves to the next */
const HOLD = 9;
/** half width of the rod's rule face */
const RW = 0.036;
/** a thin space: the names are letterspaced, as engraving is */
const THIN = String.fromCharCode(0x2009);

type Tier = { name: string; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };
type State = { tiers: Tier[]; rodX: number; rodZ: number; rodTop: number; step: number; lead: number };
type Stop = readonly [number, string, number];

/** fill a face with light that falls off from `from` to `to`; with `edge`, measured square to that edge */
function wash(f: Frame, quad: readonly V3[], from: V3, to: V3, stops: readonly Stop[], edge?: readonly [V3, V3]): void {
  const { ctx } = f;
  const a = f.P(from[0], from[1], from[2]);
  const b = f.P(to[0], to[1], to[2]);
  if (!a || !b) return;
  let gx = b.x - a.x;
  let gy = b.y - a.y;
  if (edge) {
    const e0 = f.P(edge[0][0], edge[0][1], edge[0][2]);
    const e1 = f.P(edge[1][0], edge[1][1], edge[1][2]);
    if (!e0 || !e1) return;
    const len = Math.hypot(e1.x - e0.x, e1.y - e0.y) || 1;
    const nx = -(e1.y - e0.y) / len;
    const ny = (e1.x - e0.x) / len;
    const k = gx * nx + gy * ny;
    gx = nx * k;
    gy = ny * k;
  }
  const g = ctx.createLinearGradient(a.x, a.y, a.x + gx, a.y + gy);
  for (const s of stops) g.addColorStop(clamp(s[0]), rgba(s[1], s[2]));
  ctx.beginPath();
  for (let i = 0; i < quad.length; i++) {
    const p = f.P(quad[i][0], quad[i][1], quad[i][2]);
    if (!p) return;
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
}

/** lettering cut into a face: the line of text follows the face's own perspective */
function engrave(f: Frame, text: string, at: V3, toward: V3, size: number, alpha: number): void {
  const a = f.P(at[0], at[1], at[2]);
  const b = f.P(toward[0], toward[1], toward[2]);
  if (!a || !b) return;
  const { ctx } = f;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.transform(1, (b.y - a.y) / Math.max(1, b.x - a.x), 0, 1, 0, 0);
  ctx.translate(-a.x, -a.y);
  // a dark lower lip under each letter, then the letter: it reads as cut into the glass
  f.label(text, at, { size, alpha: alpha * 0.7, colour: f.pal.bg, weight: 600, dy: 1 });
  f.label(text, at, { size, alpha, colour: f.pal.ink, weight: 600 });
  ctx.restore();
}

/** a machined standoff: a slim polished pin, a soft body under a fine highlight */
function post(f: Frame, x: number, z: number, ya: number, yb: number, a: number): void {
  f.line([x, ya, z], [x, yb, z], f.pal.ink, 0.1 * a, 3.5);
  f.line([x, ya, z], [x, yb, z], f.pal.ink, 0.34 * a, 1);
}

/**
 * One tier: a thick slab of smoked glass, lit from its front top edge.
 * `over` is the colour of the tier above (its light falls on this one's top face, from `cut` back),
 * `sweep` is where the travelling light is along the front edge (0..1), `sa` how strong it is.
 */
function slab(f: Frame, t: Tier, colour: string, lvl: number, on: number, over: string, overLvl: number, cut: number, sweep: number, sa: number): void {
  const { pal } = f;
  const { x0, x1, z0, z1 } = t;
  const w = x1 - x0;
  // powering on, the slab rises the last little way onto its pins
  const y0 = t.y0 - (1 - on) * 0.22;
  const y1 = t.y1 - (1 - on) * 0.22;
  const A: V3 = [x0, y1, z0];
  const B: V3 = [x1, y1, z0];
  const C: V3 = [x1, y1, z1];
  const D: V3 = [x0, y1, z1];
  const E: V3 = [x0, y0, z0];
  const F: V3 = [x1, y0, z0];
  const G: V3 = [x1, y0, z1];
  const front = [E, F, B, A];
  const top = [A, B, C, D];
  const side = [F, G, C, B];
  const k = lvl * on;
  // the end face shows only while the camera stands to its right
  const pb = f.P(x1, y1, z0);
  const pc = f.P(x1, y1, z1);
  const end = !!pb && !!pc && pc.x > pb.x + 1;
  /** a strip across the top face, front edge to back edge, leaning the way a reflection does */
  const strip = (u: number, v: number): V3[] => [[x0 + w * u, y1, z0], [x0 + w * v, y1, z0], [x0 + w * (v + 0.24), y1, z1], [x0 + w * (u + 0.24), y1, z1]];

  // smoked body, then the faint faces and hairline arrises of the block
  f.fill(top, pal.bg, 0.55 * on);
  f.fill(front, pal.bg, 0.7 * on);
  if (end) f.fill(side, pal.bg, 0.7 * on);
  box(f, [x0, y0, z0], [x1, y1, z1], pal.ink, 0.05 * on, 0.03 * on);

  // edge-lit glass: light enters at the top front edge, dies away inside the block
  // and is caught again, faintly, by the polished bottom face
  wash(f, front, A, E, [[0, colour, 0.5 * k], [0.32, colour, 0.19 * k], [0.8, colour, 0.07 * k], [1, colour, 0.17 * k]], [A, B]);
  wash(f, top, A, D, [[0, colour, 0.26 * k], [0.2, colour, 0.06 * k], [cut, over, 0.2 * overLvl * on], [1, over, 0.03 * on]], [A, B]);
  if (end) f.fill(side, colour, 0.11 * k);
  // a sheen lying across the top face, moving a little with the pointer
  const sh = 0.24 + f.px * 0.1;
  f.fill(strip(sh, sh + 0.1), pal.ink, 0.045 * on);
  if (!f.mobile) f.fill(strip(sh + 0.14, sh + 0.16), pal.ink, 0.035 * on);

  // the travelling light, seen through the front face
  if (sa > 0.01) wash(f, front, A, B, [[sweep - 0.26, colour, 0], [sweep, colour, 0.3 * sa * on], [sweep + 0.26, colour, 0]]);

  // polished bevels, then the lit edges: brightest along the front, where the name is
  f.line([x0 + 0.02, y1 - 0.045, z0], [x1 - 0.02, y1 - 0.045, z0], pal.ink, 0.14 * on, 1);
  f.line([x0 + 0.03, y1, z0 + 0.05], [x1 - 0.03, y1, z0 + 0.05], colour, 0.26 * k, 1);
  f.line(E, F, colour, 0.34 * k, 1);
  f.line(D, C, colour, 0.3 * k, 1);
  f.line(A, D, colour, 0.34 * k, 1);
  f.line(A, E, colour, 0.34 * k, 1);
  if (end) {
    f.line(F, G, colour, 0.2 * k, 1);
    f.line(C, G, colour, 0.22 * k, 1);
  }
  f.line(B, C, colour, 0.6 * k, 1.25);
  f.line(B, F, colour, 0.55 * k, 1.25);
  const lit: V3 = [x0 + w * on, y1, z0];
  trace(f, [A, lit], colour, 0.95 * k, 1.8);
  f.line(A, lit, pal.ink, 0.3 * k, 0.75);
  if (sa > 0.01) {
    const p: V3 = [x0 + w * clamp(sweep), y1, z0];
    f.glow(p, 0.32, colour, 0.5 * sa * on);
    f.dot(p, 0.011, pal.ink, 0.9 * sa * on);
  }

  // the name, engraved in the front edge, and a small pilot lamp at the far end of the same face
  const ym = (y0 + y1) / 2;
  engrave(f, t.name, [x0 + 0.1, ym - 0.012, z0], [x1, ym - 0.012, z0], f.mobile ? 9 : 11, (0.45 + 0.5 * lvl) * on);
  const pilot = 0.9 * k * (f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.9 + x0 * 9));
  if (f.mobile) f.dot([x1 - 0.1, ym, z0], 0.014, colour, pilot);
  else lamp(f, [x1 - 0.1, ym, z0], colour, pilot, 0.013);
}

/** the measuring rod: a graduated rule on a machined foot, with no figures on it */
function rod(f: Frame, s: State, on: number): void {
  if (on <= 0.003) return;
  const { pal, ctx } = f;
  const x = s.rodX;
  const z = s.rodZ;
  const top = FLOOR + (s.rodTop - FLOOR) * on;
  const face: V3[] = [[x - RW, FLOOR, z], [x + RW, FLOOR, z], [x + RW, top, z], [x - RW, top, z]];
  ring(f, [x, FLOOR, z], 0.12, { colour: pal.ink, alpha: 0.34 * on, seg: 36 });
  ring(f, [x, FLOOR, z], 0.065, { colour: pal.ink, alpha: 0.2 * on, seg: 28 });
  f.fill(face, pal.bg, 0.6 * on);
  f.fill(face, pal.ink, 0.07 * on);
  f.line(face[0], face[3], pal.ink, 0.46 * on, 1);
  f.line(face[1], face[2], pal.ink, 0.24 * on, 1);
  f.line(face[3], face[2], pal.ink, 0.46 * on, 1);
  // graduations: one batched path for the fine marks, one for the long ones
  const step = s.step * (f.q < 0.75 ? 2 : 1);
  for (const major of [false, true]) {
    ctx.beginPath();
    for (let i = 2; FLOOR + i * step < top - 0.02; i++) {
      if ((i % 5 === 0) !== major) continue;
      const a = f.P(x - RW, FLOOR + i * step, z);
      const b = f.P(x - RW + RW * (major ? 1.5 : 0.8), FLOOR + i * step, z);
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = rgba(pal.ink, (major ? 0.52 : 0.28) * on);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** signed distance, in tiers, between the light and tier i (the light visits 0, 1, 2 and comes round) */
const away = (ph: number, i: number) => ((((ph - i - 0.5) % 3) + 4.5) % 3) - 1.5;

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const m = f.mobile;
    const W = m ? 1.34 : 1.5;
    const dx = m ? 0.2 : 0.24;
    const x0 = m ? -1.0 : -1.04;
    const tiers = NAMES.map((n, i) => ({
      name: n.split("").join(THIN),
      x0: x0 + i * dx,
      x1: x0 + i * dx + W,
      y0: -1.16 + i * 0.52,
      y1: -1.16 + i * 0.52 + 0.26,
      z0: -0.65 + i * 0.4,
      z1: -0.65 + i * 0.4 + 0.9,
    }));
    // the rod stands where all three tiers pass it, so the three sight lines run parallel
    return { tiers, rodX: tiers[2].x1 + (m ? 0.22 : 0.25), rodZ: 0.2, rodTop: 0.64, step: m ? 0.08 : 0.04, lead: Math.floor(f.rnd(0) * 3) };
  },
  draw(f, s) {
    const { pal } = f;
    const m = f.mobile;
    // seen from a little above, so the treads show their top faces
    f.aim(0.26 + f.rnd(1) * 0.03 + (f.still ? 0 : Math.sin(f.t * 0.09) * 0.035), -0.18, 6.4, m ? 0.76 : 0.98);
    f.cy -= f.h * (m ? 0.13 : 0.075);
    if (m) f.cx = f.w * 0.5;

    const cols = [pal.blue, pal.teal, pal.emerald];
    // w: how much of the light each tier holds (the three always sum to one); still, they share it
    const d = [0, 1, 2].map((i) => away(f.t / HOLD + s.lead, i));
    const w = d.map((v) => (f.still ? 0 : easeInOut(clamp(0.5 - (Math.abs(v) - 0.5) * 2.4))));
    const lvl = w.map((v) => (f.still ? 0.86 : 0.66 + 0.34 * v));
    const on = [f.on(0, 0.5), f.on(0.3, 0.5), f.on(0.6, 0.5)];

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0.2, FLOOR, 0.1], 2.5, pal.key, 0.2 * f.boot);
    // the stair's own soft shadow on the deck, then the first tier's light falling in front of it
    const t0 = s.tiers[0];
    pool(f, [(t0.x0 + s.tiers[1].x1) / 2, FLOOR, (t0.z0 + s.tiers[1].z1) / 2], 1.25, pal.bg, 0.6 * on[0]);
    pool(f, [(t0.x0 + t0.x1) / 2, FLOOR, t0.z0 - 0.05], 1.05, cols[0], 0.2 * lvl[0] * on[0]);

    rod(f, s, f.on(0.55, 0.45));

    // far tier first: each stands on four pins, on the tier below it (or on the deck)
    for (let i = 2; i >= 0; i--) {
      const t = s.tiers[i];
      const below = i > 0 ? s.tiers[i - 1] : null;
      const zb = (below ? below.z1 : t.z1) - 0.08;
      for (const px of [t.x0 + 0.09, (below ? below.x1 : t.x1) - 0.09]) {
        for (const pz of [zb, t.z0 + 0.08]) post(f, px, pz, below ? below.y1 : FLOOR, t.y0, on[i] * (pz === zb ? 0.55 : 1));
      }
      const up = Math.min(2, i + 1);
      slab(f, t, cols[i], lvl[i], on[i], cols[up], i < 2 ? lvl[up] * on[up] : 0.2, i < 2 ? (s.tiers[up].z0 - t.z0) / (t.z1 - t.z0) : 0.7, 0.5 + d[i] * 0.8, w[i]);
    }

    // the comparison: one index mark per tier on the rod, and the cursor that follows the light
    const ron = f.on(1, 0.4);
    const rx = s.rodX - RW;
    let yc = 0;
    s.tiers.forEach((t, i) => {
      const a: V3 = [t.x1, t.y1, s.rodZ];
      const b: V3 = [rx, t.y1, s.rodZ];
      f.line(a, b, pal.ink, 0.14 * ron, 1);
      f.line([rx - 0.09, t.y1, s.rodZ], [rx + RW * 2, t.y1, s.rodZ], cols[i], 0.9 * ron, 1.6);
      f.dot(a, 0.012, cols[i], 0.85 * ron);
      const k = f.still ? 0.45 : clamp(w[i] * 2 - 1);
      if (k > 0.01) trace(f, [a, b], cols[i], 0.6 * k * ron, 1.1);
      yc += w[i] * t.y1;
    });
    // at rest (the still frame) the cursor is parked at the head of the rod
    const y = f.still ? s.rodTop - 0.13 : yc;
    const at: V3 = [s.rodX - 0.07, y, s.rodZ - 0.04];
    box(f, [s.rodX - 0.07, y - 0.032, s.rodZ - 0.04], [s.rodX + 0.07, y + 0.032, s.rodZ + 0.04], pal.ink, 0.6 * ron, 0.12 * ron);
    if (f.still) lamp(f, at, pal.ink, 0.4, 0.013);
    else for (let i = 0; i < 3; i++) lamp(f, at, cols[i], w[i] * ron, 0.015);
  },
};

export default scene;
