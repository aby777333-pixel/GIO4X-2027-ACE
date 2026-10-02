/**
 * PAMM — the allocation wheel.
 *
 * One manager, one pool, many owners. A glass hub (the manager) sits at the
 * centre of a dial carried on two trunnions; around it the pool is cut into
 * seven slabs of glass whose arc lengths are the investors' shares. Every
 * decision leaves the hub along all seven spokes at the same moment, on one
 * expanding wavefront, and lands on each slab with a brightness in proportion
 * to that slab's share: pro rata, drawn as a machine.
 *
 * The shares are schematic proportions. Nothing is printed as a figure: no
 * percentages, no balances, no returns.
 */
import { TAU, clamp, easeInOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { callouts, deck, lamp, orb, pool, ring, trace } from "../kit";

/** seven owners of one pool: schematic shares, visibly unequal */
const SHARES = [0.24, 0.1, 0.17, 0.06, 0.14, 0.08, 0.21];
const TOP = Math.max(...SHARES);
/** gap between neighbouring slabs, in turns */
const GAP = 0.013;

/** the dial leans toward the viewer on its trunnions, like a compass card in a binnacle */
const TILT = 0.86;
const CT = Math.cos(TILT);
const ST = Math.sin(TILT);
const HUB_Y = 0.06;
/** radii: hub collar, slab inner and outer faces, graduated bezel; and the slab thickness */
const RC = 0.44;
const RI = 0.92;
const RO = 1.18;
const RB = 1.3;
const H = 0.12;
/** the cradle: a half ring in the upright plane, resting on the deck at one point */
const RY = 1.36;
const BAND = 0.045;

/** dial coordinates (radius, angle, height off the dial) to world */
const at = (r: number, a: number, h = 0): V3 => {
  const lx = Math.cos(a) * r;
  const lz = Math.sin(a) * r;
  return [lx, HUB_Y + h * CT + lz * ST, -h * ST + lz * CT];
};

const sweep = (r: number, a0: number, a1: number, h: number, n: number): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) out.push(at(r, a0 + ((a1 - a0) * i) / n, h));
  return out;
};

const smooth = (x: number, a: number, b: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

type Seg = { a0: number; a1: number; w: number; k: number };
type State = { segs: Seg[]; order: number[]; start: number; cradle: V3[] };

/** the fixed bezel: a hundred fine divisions, the far half fainter than the near */
function graduations(f: Frame, n: number, alpha: number): void {
  const { ctx } = f;
  const major = n / 10;
  for (const near of [false, true]) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      if (Math.sin(a) < 0 !== near) continue;
      const len = i % major === 0 ? 0.085 : n >= 100 && i % 5 === 0 ? 0.055 : 0.032;
      const p = f.P(...at(RB, a));
      const q = f.P(...at(RB - len, a));
      if (!p || !q) continue;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = rgba(f.pal.ink, alpha * (near ? 1 : 0.55));
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** the dial itself: a plate of smoked glass with one slow sheen across it */
function plate(f: Frame, on: number): void {
  if (on <= 0.003) return;
  const { ctx, pal } = f;
  const rim = sweep(RB, 0, TAU, 0, Math.round(72 * f.q));
  f.fill(rim, pal.bg, 0.55 * on);
  f.fill(rim, pal.ink, 0.02 * on);
  const a = f.P(...at(RB, Math.PI * 1.2));
  const b = f.P(...at(RB, Math.PI * 0.2));
  if (a && b) {
    const band = clamp(0.42 + f.px * 0.2 + (f.still ? 0 : Math.sin(f.t * 0.19) * 0.06), 0.1, 0.85);
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(Math.max(0, band - 0.24), rgba(pal.ink, 0));
    g.addColorStop(band, rgba(pal.ink, 0.055 * on));
    g.addColorStop(Math.min(1, band + 0.16), rgba(pal.ink, 0));
    ctx.save();
    ctx.beginPath();
    let seen = 0;
    for (const v of rim) {
      const p = f.P(...v);
      if (!p) break;
      if (seen++) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    }
    if (seen === rim.length) {
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, f.w, f.h);
    }
    ctx.restore();
  }
  f.path(rim, pal.ink, 0.26 * on, 1, true);
}

/** one investor's share: a slab of smoked glass, its arc length the size of the share */
function slab(f: Frame, s: Seg, rot: number, on: number, wash: number, spread: number): void {
  if (on <= 0.003) return;
  const { pal } = f;
  const a0 = s.a0 + rot;
  const a1 = s.a1 + rot;
  const mid = (a0 + a1) / 2;
  const n = Math.max(3, Math.round(s.w * 76 * f.q));
  // powering on: the slab rises out of the dial into place
  const base = (1 - on) * -0.22;
  const top = base + H;
  const far = Math.sin(mid);
  const dim = (1 - 0.32 * clamp(far)) * on;
  const oT = sweep(RO, a0, a1, top, n);
  const iT = sweep(RI, a1, a0, top, n);

  // the wall that faces the viewer: outer on the near half of the dial, inner on the far half
  if (far < 0.3) {
    const oB = sweep(RO, a1, a0, base, n);
    f.fill([...oT, ...oB], pal.bg, 0.66 * on);
    f.fill([...oT, ...oB], pal.key, (0.05 + 0.05 * s.k) * dim);
    f.path(oB, pal.ink, 0.16 * dim, 1);
  }
  if (far > -0.3) {
    const iB = sweep(RI, a0, a1, base, n);
    f.fill([...iT, ...iB], pal.bg, 0.66 * on);
    f.fill([...iT, ...iB], pal.key, (0.04 + 0.04 * s.k) * dim);
    f.path(iB, pal.ink, 0.13 * dim, 1);
  }
  // the end face that turns toward the viewer, so the slab reads as a solid block
  const ends: [number, boolean][] = [[a0, Math.cos(a0) > 0.1], [a1, Math.cos(a1) < -0.1]];
  for (const [a, seen] of ends) {
    if (!seen) continue;
    const end = [at(RO, a, top), at(RI, a, top), at(RI, a, base), at(RO, a, base)];
    f.fill(end, pal.bg, 0.66 * on);
    f.fill(end, pal.key, (0.075 + 0.04 * s.k) * dim);
  }
  f.line(oT[0], at(RO, a0, base), pal.ink, 0.2 * dim, 1);
  f.line(oT[n], at(RO, a1, base), pal.ink, 0.2 * dim, 1);
  f.line(iT[0], at(RI, a1, base), pal.ink, 0.16 * dim, 1);
  f.line(iT[n], at(RI, a0, base), pal.ink, 0.16 * dim, 1);

  // the top face: smoked glass, a little more luminous the larger the share
  const face = [...oT, ...iT];
  f.fill(face, pal.bg, 0.5 * on);
  f.fill(face, pal.key, (0.045 + 0.075 * s.k) * dim);
  if (wash > 0) f.fill(face, pal.gold, 0.085 * s.k * wash * on);
  // a bevel along the outer rim, where the glass turns to the light
  f.fill([...oT, ...sweep(RO - 0.05, a1, a0, top, n)], pal.key, (0.07 + 0.05 * s.k) * dim);
  f.path(face, pal.ink, 0.2 * dim, 1, true);
  // machined edge: the outer rim catches the key light
  f.path(oT, pal.key, 0.09 * dim, 5.5);
  f.path(oT, pal.key, 0.62 * dim, 1.4);

  // the allocation lands at the spoke and runs along the inner rim to both ends
  if (wash > 0.01) {
    const half = ((a1 - a0) / 2) * spread;
    trace(f, sweep(RI, mid - half, mid + half, top, n), pal.gold, (0.16 + 0.8 * s.k) * wash * on, 1.5);
  }
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const free = 1 - GAP * SHARES.length;
    let turn = 0;
    const segs = SHARES.map((w) => {
      const s = { a0: turn * TAU, a1: (turn + w * free) * TAU, w, k: w / TOP };
      turn += w * free + GAP;
      return s;
    });
    // the cradle's metal: the band between its two edges, as one polygon
    const n = f.mobile ? 28 : 44;
    const cradle: V3[] = [];
    for (let i = 0; i <= n; i++) cradle.push([-Math.cos((Math.PI * i) / n) * RY, HUB_Y - Math.sin((Math.PI * i) / n) * RY, 0]);
    for (let i = n; i >= 0; i--) cradle.push([-Math.cos((Math.PI * i) / n) * (RY + BAND), HUB_Y - Math.sin((Math.PI * i) / n) * (RY + BAND), 0]);
    return { segs, order: SHARES.map((_, i) => i), start: f.rnd(5) * TAU, cradle };
  },
  draw(f, s) {
    const { pal } = f;
    f.aim(-0.14 + (f.still ? 0 : Math.sin(f.t * 0.08) * 0.045), 0.16, 6.2, f.mobile ? 0.74 : 0.95);
    if (f.mobile) {
      // a backdrop on a phone: centred, and high enough to clear the statement
      f.cx = f.w * 0.5;
      f.cy = f.h * 0.235 + f.scroll * f.h * 0.12;
    } else {
      f.cx += f.u * 0.05;
      f.cy -= f.u * 0.17;
    }

    const floor = -1.3;
    deck(f, { y: floor, alpha: 0.12 });
    pool(f, [0, floor, 0], 2.5, pal.key, 0.22 * f.boot);

    // ── the cycle: decide, travel, land, settle. Twelve seconds, one decision at a time.
    const live = !f.still && f.t > 2.2;
    const ph = live ? ((f.t - 2.2) / 12) % 1 : 0;
    const go = f.still ? 0.68 : live ? easeInOut((ph - 0.04) / 0.5) : 0;
    const flight = f.still ? 1 : live ? smooth(ph, 0.02, 0.1) * (1 - smooth(ph, 0.5, 0.57)) : 0;
    const wash = f.still ? 0.55 : live ? smooth(ph, 0.5, 0.6) * (1 - smooth(ph, 0.66, 0.98)) : 0;
    const spread = f.still ? 1 : smooth(ph, 0.5, 0.74);
    const decide = f.still ? 0.6 : live ? 1 - smooth(ph, 0.02, 0.26) + smooth(ph, 0.9, 1) : f.boot;

    // ── the cradle: a half ring standing on the deck, the dial leaning on its two trunnions
    const standOn = f.on(0, 0.5);
    ring(f, [0, floor, 0], 0.24, { axis: "y", colour: pal.ink, alpha: 0.24 * standOn, seg: 28 });
    f.fill(s.cradle, pal.ink, 0.05 * standOn);
    ring(f, [0, HUB_Y, 0], RY, { axis: "z", colour: pal.ink, alpha: 0.3 * standOn, from: 0.5, to: 1 });
    ring(f, [0, HUB_Y, 0], RY + BAND, { axis: "z", colour: pal.key, alpha: 0.42 * standOn, from: 0.5, to: 1, width: 1.25 });
    for (const side of [-1, 1]) {
      f.line([side * (RY + BAND), HUB_Y, 0], [side * RB, HUB_Y, 0], pal.ink, 0.45 * standOn, 2);
      f.dot([side * (RY + BAND / 2), HUB_Y, 0], 0.018, pal.key, 0.75 * standOn);
    }

    // ── the dial: a glass plate with a fixed bezel, graduated in a hundred parts
    const bezelOn = f.on(0.12, 0.45);
    plate(f, bezelOn);
    graduations(f, f.mobile ? 50 : 100, 0.3 * bezelOn);
    f.glow(at(0, 0, 0), 0.95, pal.gold, (0.05 + 0.07 * decide) * bezelOn);

    // ── the wheel: seven shares, far ones first
    const rot = s.start + (f.still ? 0 : f.t * 0.012);
    const midOf = (i: number) => (s.segs[i].a0 + s.segs[i].a1) / 2 + rot;
    s.order.sort((a, b) => Math.sin(midOf(b)) - Math.sin(midOf(a)));
    for (const i of s.order) slab(f, s.segs[i], rot, f.on(0.36 + (i / SHARES.length) * 0.5, 0.32), wash, spread);

    // ── spokes: one from the hub to every share, all the same length
    const spokeOn = f.on(0.28, 0.4);
    for (const i of s.order) {
      const a = midOf(i);
      const seg = s.segs[i];
      const dim = 1 - 0.3 * clamp(Math.sin(a));
      trace(f, [at(RC, a, H), at(lerp(RC, RI, spokeOn), a, H)], pal.key, 0.34 * spokeOn * dim, 1);
      f.dot(at(RI, a, H), 0.013, pal.ink, 0.45 * spokeOn);
      f.dot(at(RI, a, H), 0.013, pal.gold, (0.2 + 0.8 * seg.k) * wash * spokeOn);
      // the decision in flight: same instant, same radius, brightness by share
      if (flight > 0.01) {
        const r = lerp(RC, RI, go);
        const level = (0.14 + 0.82 * seg.k) * flight;
        f.line(at(Math.max(RC, r - 0.2), a, H), at(r, a, H), pal.gold, level * 0.75, 1.75);
        f.glow(at(r, a, H), 0.06 + 0.09 * seg.k, pal.gold, level * 0.8);
        f.dot(at(r, a, H), 0.009 + 0.006 * seg.k, pal.ink, level);
      }
    }
    // the wavefront the seven pulses ride on: one decision, not seven
    if (flight > 0.01) f.path(sweep(lerp(RC, RI, go), 0, TAU, H, Math.round(56 * f.q)), pal.gold, 0.16 * flight, 1);

    // ── the hub: a machined collar and the manager's glass
    const hubOn = f.on(0, 0.4);
    f.path(sweep(RC, 0, TAU, H, 44), pal.key, 0.55 * hubOn, 1.4);
    f.path(sweep(RC - 0.07, 0, TAU, H, 40), pal.ink, 0.2 * hubOn, 1);
    const hub = at(0, 0, 0.16 - (1 - hubOn) * 0.2);
    orb(f, hub, 0.33, pal.key, hubOn);
    f.path(sweep(0.33, Math.PI, TAU, 0.16, 28), pal.ink, 0.14 * hubOn, 1);
    lamp(f, [hub[0], hub[1] + 0.07, hub[2]], pal.gold, hubOn * (0.5 + 0.5 * decide), 0.026);

    // ── lettering: two words, each said once
    const lettersOn = f.on(0.9, 0.3);
    const hp = f.P(...hub);
    if (hp) f.label("MANAGER", hub, { align: "center", dy: 0.33 * hp.s * f.u * 0.5, size: f.mobile ? 9 : 10, colour: pal.ink, alpha: 0.86 * lettersOn });
    callouts(f, [{ text: "INVESTORS", p: at(RB, 0.5), colour: pal.ink2, alpha: lettersOn }], { size: f.mobile ? 9 : 10, reach: 16 });
  },
};

export default scene;
