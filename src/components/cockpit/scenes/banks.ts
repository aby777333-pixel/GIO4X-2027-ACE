/**
 * CENTRAL BANKS — the portico.
 *
 * A classical bank front, abstracted into engineering: nine fluted glass columns
 * on a three-step plinth, an entablature, and a pediment drawn as a fine truss.
 * Each column is one of the central banks GIO4X covers and carries its short
 * code at the base. On a bank's own page its column is the one lit in champagne,
 * from base to capital, with a pool of light at its foot.
 *
 * Inside, behind the colonnade, a glass stair rises and falls: policy moves in
 * steps. It is a drawing of that idea only: no scale, no numbers, no bank's
 * name on it, and the same on every page.
 */
import { clamp, easeOut, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, panel, pool, ring, trace } from "../kit";

const BANKS = ["FED", "ECB", "BOE", "BOJ", "SNB", "RBA", "BOC", "RBNZ", "RBI"];
const N = BANKS.length;
const GAP = 0.31;
const HALF = ((N - 1) / 2) * GAP;
const colX = (i: number) => (i - (N - 1) / 2) * GAP;

/** heights: the deck, the top of the plinth, the capitals, the top of the entablature, the apex */
const FLOOR = -1.3;
const BASE = -1.0;
const CAP = 0.42;
const TOP = 0.63;
const APEX = 1.06;
/** depths: the colonnade, the face of the entablature, the back wall, the stair between them */
const ZC = -0.3;
const ZF = ZC - 0.12;
const ZB = 0.5;
const SZ0 = -0.02;
const SZ1 = 0.4;
const R = 0.074;
const TAPER = 0.86;
const EAVE = HALF + 0.2;

/** where the arrises of a round fluted shaft fall when it is seen side-on */
const FLUTES = [-1, -0.87, -0.5, 0, 0.5, 0.87, 1];
const ARRISES = FLUTES.slice(1, 6);
const EDGES = [-1, 1];
/** the light each facet of the glass holds: lit rims, one soft highlight left of centre */
const SHADE = [0.26, 0.08, 0.15, 0.02, 0.06, 0.2];
/** the stair: a schematic rise, a landing, a descent. Not a series. */
const PATH = [1, 1, 2, 3, 4, 5, 6, 6, 6, 5, 4, 4, 3, 3];

type Seg = readonly [V3, V3];
type State = { front: V3[]; back: V3[]; treads: [number, number, number][]; truss: Seg[]; frieze: Seg[] };

/** many separate hairlines in one stroke */
function strokes(f: Frame, segs: readonly Seg[], colour: string, alpha: number): void {
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
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * A machined block: only the faces the viewer can see, solid enough to hide
 * what stands behind it, the top front edge catching the light.
 */
function slab(f: Frame, min: V3, max: V3, edge: number, face: number, nose = f.pal.ink): void {
  if (edge <= 0.003) return;
  const { pal } = f;
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const body = 0.94 * clamp(edge * 4);
  if (y1 < f.cam.dist * Math.sin(f.cam.pitch)) {
    const top: V3[] = [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    f.fill(top, pal.bg, body);
    f.fill(top, pal.ink, face);
    f.path([top[0], top[3], top[2]], pal.ink, edge * 0.5, 1);
  }
  if (x1 < f.cam.dist * Math.sin(f.cam.yaw)) {
    const side: V3[] = [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]];
    f.fill(side, pal.bg, body);
    f.fill(side, pal.ink, face * 0.3);
    f.path(side, pal.ink, edge * 0.55, 1);
  }
  const front: V3[] = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
  f.fill(front, pal.bg, body);
  f.fill(front, pal.ink, face * 0.55);
  f.path([front[3], front[0], front[1], front[2]], pal.ink, edge * 0.6, 1);
  f.line(front[3], front[2], nose, edge, 1.15);
}

type Shaft = { grow: number; colour: string; lit: number; glass: number; hot: boolean; spill: number; wash: CanvasGradient | null };

/** A fluted glass shaft: facets that hold the light, fine arrises, two lit edges. Drawn in screen space. */
function shaft(f: Frame, x: number, o: Shaft): void {
  const a = f.P(x, BASE, ZC);
  const b = f.P(x, BASE + (CAP - BASE) * o.grow, ZC);
  if (!a || !b) return;
  const { ctx, pal } = f;
  const wa = R * a.s * f.u;
  const wb = R * (1 - (1 - TAPER) * o.grow) * b.s * f.u;
  const facet = (k0: number, k1: number, style: string | CanvasGradient) => {
    ctx.beginPath();
    ctx.moveTo(a.x + wa * k0, a.y);
    ctx.lineTo(a.x + wa * k1, a.y);
    ctx.lineTo(b.x + wb * k1, b.y);
    ctx.lineTo(b.x + wb * k0, b.y);
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
  };
  const rules = (at: readonly number[], style: string, width: number) => {
    ctx.beginPath();
    for (const k of at) {
      ctx.moveTo(a.x + wa * k, a.y);
      ctx.lineTo(b.x + wb * k, b.y);
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  facet(-1, 1, rgba(pal.bg, 0.62));
  if (o.wash) {
    // washed by the lamp at its foot: strongest at the base, still alight at the capital
    ctx.globalAlpha = clamp(o.glass);
    facet(-1, 1, o.wash);
    ctx.globalAlpha = 1;
  }
  const coarse = f.mobile || f.q < 0.75;
  for (let i = 0; i < 6; i += coarse ? 2 : 1) facet(FLUTES[i], FLUTES[i + (coarse ? 2 : 1)], rgba(o.colour, SHADE[i] * o.glass));
  // the neighbours of the lit column catch its light on the side that faces it
  if (o.spill) facet(o.spill > 0 ? 0.5 : -1, o.spill > 0 ? 1 : -0.5, rgba(pal.gold, Math.abs(o.spill)));
  rules(coarse ? [-0.5, 0.5] : ARRISES, rgba(pal.ink, 0.1 * o.glass), 1);
  if (o.hot) rules(EDGES, rgba(o.colour, o.lit * 0.16), 6);
  rules(EDGES, rgba(o.colour, o.lit), o.hot ? 1.5 : 1.15);
}

const scene: Scene<State> = {
  pose: 12,
  setup() {
    const front: V3[] = [];
    const back: V3[] = [];
    const treads: State["treads"] = [];
    const w = (2 * HALF - 0.06) / PATH.length;
    PATH.forEach((level, i) => {
      const y = BASE + 0.16 + level * 0.17;
      const xa = -HALF + 0.03 + i * w;
      front.push([xa, y, SZ0], [xa + w, y, SZ0]);
      back.push([xa, y, SZ1], [xa + w, y, SZ1]);
      treads.push([xa, xa + w, y]);
    });
    // the pediment's truss: an inner frame, a post over every column, braced toward the centre
    const k = 0.86;
    const mid = TOP + (APEX - TOP) / 3;
    const y0 = mid - (mid - TOP) * k;
    const y1 = mid + (APEX - mid) * k;
    const rafter = (x: number) => y0 + (y1 - y0) * (1 - Math.abs(x) / (EAVE * k));
    const truss: Seg[] = [
      [[-EAVE * k, y0, ZF], [0, y1, ZF]],
      [[EAVE * k, y0, ZF], [0, y1, ZF]],
      [[-EAVE * k, y0, ZF], [EAVE * k, y0, ZF]],
    ];
    const c = (N - 1) / 2;
    for (let i = 1; i < N - 1; i++) {
      const x = colX(i);
      truss.push([[x, y0, ZF], [x, rafter(x), ZF]]);
      if (i === c) continue;
      const xn = colX(i < c ? i + 1 : i - 1);
      truss.push([[x, y0, ZF], [xn, rafter(xn), ZF]]);
    }
    // the frieze, graduated like a rule: a long mark over each column, a short one over each bay
    const frieze: Seg[] = [];
    for (let i = 0; i < N * 2 - 1; i++) {
      const x = -HALF + (i * GAP) / 2;
      frieze.push([[x, TOP - 0.03, ZF], [x, TOP - (i % 2 ? 0.06 : 0.085), ZF]]);
    }
    return { front, back, treads, truss, frieze };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    // a low eye-line, the near end of the colonnade to the right, away from the headline
    const sway = Math.sin(f.t * 0.07 + f.rnd(1) * 6) * 0.045;
    f.aim((f.mobile ? 0.2 : 0.3) + sway, 0.075, 6.6, f.mobile ? 0.6 : 0.84);
    if (f.mobile) {
      f.cx = f.w * 0.5;
      f.cy -= f.h * 0.07;
    } else {
      f.cx -= f.u * 0.06;
      f.cy -= f.u * 0.1;
    }

    const fi = BANKS.indexOf(f.tag.toUpperCase());
    const has = fi >= 0;
    // power-on spreads outward from the page's own bank, or from a column chosen by the page
    const lead = has ? fi : Math.floor(f.rnd(2) * N);

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [0, FLOOR, -0.3], 2.6, pal.key, 0.24 * f.boot);

    // ── the plinth: three wide steps of machined metal, the top one with a lit nosing
    for (let k = 0; k < 3; k++) {
      const on = f.on(k * 0.08, 0.3);
      const out = (2 - k) * 0.11;
      const hw = HALF + 0.2 + out;
      const y0 = FLOOR + k * 0.1;
      slab(f, [-hw, y0, ZC - 0.2 - out * 1.3], [hw, y0 + 0.1, ZB + 0.08 + out * 1.3], (k === 2 ? 0.5 : 0.3) * on, 0.07 * on, k === 2 ? pal.key : pal.ink);
    }

    // ── the back wall, a pane of smoked glass, and the light held inside the building
    panel(f, [0, (BASE + TOP) / 2, ZB], 2 * HALF + 0.24, TOP - BASE, { on: f.on(0.2, 0.4), colour: pal.key, alpha: 0.2, glass: 0.03 });
    f.glow([0, -0.25, 0.2], 1.5, pal.key, 0.13 * f.on(0.3, 0.5));

    // ── the policy path: a folded ribbon of glass that rises and falls. No scale, no numbers.
    const stair = pal.key === pal.teal ? pal.blue : pal.teal;
    const drawn = easeOut((f.boot - 0.4) / 0.55);
    if (drawn > 0) {
      const n = Math.round(s.treads.length * drawn);
      for (let i = 0; i < n; i++) {
        const [xa, xb, y] = s.treads[i];
        const from = i ? s.treads[i - 1][2] : y;
        f.fill([[xa, y, SZ0], [xb, y, SZ0], [xb, y, SZ1], [xa, y, SZ1]], stair, 0.2);
        if (from !== y) f.fill([[xa, from, SZ0], [xa, y, SZ0], [xa, y, SZ1], [xa, from, SZ1]], stair, 0.1);
      }
      f.path(s.back.slice(0, n * 2), stair, 0.3, 1);
      trace(f, s.front.slice(0, n * 2), stair, 0.7 * drawn, 1.25, drawn >= 1 ? f.t / 11 + f.rnd(3) : -1);
    }

    // ── the page's own bank: light at the foot of its column, spilling down the steps
    if (has) {
      const g = f.on(0.18, 0.3);
      f.glow([colX(fi), BASE - 0.03, ZC - 0.2], 0.42, pal.gold, 0.3 * g);
      pool(f, [colX(fi), FLOOR, ZC - 0.8], 0.8, pal.gold, 0.14 * g);
      f.glow([colX(fi), (BASE + CAP) / 2, ZC], 0.9, pal.gold, 0.1 * g);
    }

    // one wash of light shared by every shaft, from the lamps let into the plinth
    const pa = f.P(0, BASE, ZC);
    const pb = f.P(0, CAP, ZC);
    const wash = (colour: string, a0: number, a1: number) => {
      if (!pa || !pb) return null;
      const g = ctx.createLinearGradient(0, pa.y, 0, pb.y);
      g.addColorStop(0, rgba(colour, a0));
      g.addColorStop(1, rgba(colour, a1));
      return g;
    };
    const washKey = wash(pal.key, has ? 0.14 : 0.24, 0.03);
    const washGold = has ? wash(pal.gold, 0.4, 0.12) : null;

    // ── the colonnade, far end first
    for (let i = 0; i < N; i++) {
      const x = colX(i);
      const g = f.on(0.18 + (Math.abs(i - lead) / (N - 1)) * 0.45, 0.3);
      if (g <= 0) continue;
      const hot = has && i === fi;
      const depth = 0.7 + (0.3 * i) / (N - 1);
      const breathe = f.still ? 1 : 0.92 + 0.08 * Math.sin(f.t * 0.6 - i * 0.5);
      const colour = hot ? pal.gold : pal.key;
      const lit = hot ? 0.95 : (has ? 0.3 : 0.55) * depth * breathe;
      const collar = hot ? 0.8 : lit * 0.8;
      const d = has ? i - fi : 0;
      const spill = Math.abs(d) === 1 ? -d * 0.1 * g : Math.abs(d) === 2 ? -d * 0.02 * g : 0;
      ring(f, [x, BASE + 0.012, ZC], R * 1.36, { colour, alpha: collar * g, seg: 18 });
      if (!f.mobile) ring(f, [x, BASE + 0.05, ZC], R * 1.14, { colour: pal.ink, alpha: 0.2 * g, seg: 18 });
      shaft(f, x, { grow: g, colour, lit: lit * g, glass: (hot ? 1 : 0.9 * depth) * g, hot, spill, wash: hot ? washGold : washKey });
      // the capital arrives as the shaft reaches full height
      const cap = clamp((g - 0.8) / 0.2);
      if (cap > 0) {
        if (!f.mobile) ring(f, [x, CAP - 0.05, ZC], R * TAPER * 1.12, { colour: pal.ink, alpha: 0.2 * cap, seg: 18 });
        ring(f, [x, CAP - 0.008, ZC], R * TAPER * 1.34, { colour, alpha: collar * cap, seg: 18 });
        slab(f, [x - 0.1, CAP, ZC - 0.1], [x + 0.1, CAP + 0.04, ZC + 0.1], (hot ? 0.7 : 0.3) * cap, 0.08 * cap, hot ? pal.gold : pal.ink);
      }
      // the lamp let into the plinth at its foot, and the bank's code engraved below it
      const foot: V3 = [x, BASE, ZC - 0.13];
      if (hot) lamp(f, foot, pal.gold, g, 0.016);
      else f.dot(foot, 0.009, pal.key, 0.75 * g * depth * (has ? 0.6 : 1));
      if (f.mobile) continue;
      const ink = hot ? 0.98 : (has ? 0.52 : 0.76) * (0.5 + 0.5 * depth);
      f.label(BANKS[i], [x, BASE - 0.052, ZC - 0.2], { align: "center", size: hot ? 10 : 9, weight: hot ? 700 : 600, colour: hot ? pal.gold : pal.ink2, alpha: ink * g });
    }

    // ── the entablature the columns carry: an architrave that catches their light, a graduated frieze
    const eOn = f.on(0.62, 0.3);
    const pOn = f.on(0.82, 0.25);
    const ew = HALF + 0.13;
    const band = CAP + 0.115;
    slab(f, [-ew, CAP + 0.04, ZF], [ew, TOP, ZB], 0.34 * eOn, 0.07 * eOn);
    f.fill([[-ew, CAP + 0.04, ZF], [ew, CAP + 0.04, ZF], [ew, band, ZF], [-ew, band, ZF]], pal.key, 0.07 * eOn);
    f.line([-ew, band, ZF], [ew, band, ZF], pal.ink, 0.16 * eOn, 1);
    if (!f.mobile) strokes(f, s.frieze, pal.ink, 0.2 * eOn);
    // a phone has no room at the base: the page's own bank is inscribed on the frieze instead
    else if (has) f.label(BANKS[fi], [colX(fi), band + 0.01, ZF], { align: "center", size: 9, weight: 700, colour: pal.gold, alpha: 0.95 * eOn });

    // ── the pediment: a fine truss in a pane of glass, its rafters lit from the eaves to the apex
    const tri: V3[] = [[-EAVE, TOP, ZF], [0, APEX, ZF], [EAVE, TOP, ZF]];
    const reach = clamp(pOn);
    f.fill(tri, pal.bg, 0.7 * pOn);
    f.fill(tri, pal.ink, 0.03 * pOn);
    f.fill([tri[0], tri[1], [0, TOP, ZF]], pal.key, 0.06 * pOn);
    strokes(f, s.truss, pal.ink, 0.22 * pOn);
    f.line(tri[0], tri[2], pal.ink, 0.4 * eOn, 1);
    trace(f, [tri[0], [-EAVE * (1 - reach), TOP + (APEX - TOP) * reach, ZF]], pal.key, 0.62 * pOn, 1.25);
    trace(f, [tri[2], [EAVE * (1 - reach), TOP + (APEX - TOP) * reach, ZF]], pal.key, 0.62 * pOn, 1.25);
  },
};

export default scene;
