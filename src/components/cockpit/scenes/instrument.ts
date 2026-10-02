/**
 * INSTRUMENT — the circular slide rule.
 *
 * The trader's calculator drawn as the pilot's flight computer: a turned-metal
 * case, a fixed outer scale, a disc of smoked glass turning slowly against it
 * and an inner disc easing the other way, their logarithmic graduations meeting
 * edge to edge. A glass cursor carries the hairline across all of them and a
 * small magnifier rides on it over the join, where a result would be read.
 *
 * Nothing here is a number: the scales carry graduations only, and the one
 * piece of lettering is the name of the tool the page is about.
 */
import { TAU, clamp, easeOut, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, orb, pool, ring, trace } from "../kit";

const TITLES = new Map<string, string>([
  ["position-size", "POSITION SIZE"],
  ["pip-value", "PIP VALUE"],
  ["margin", "MARGIN"],
  ["profit-loss", "PROFIT / LOSS"],
  ["risk-reward", "RISK : REWARD"],
  ["drawdown", "DRAWDOWN"],
  ["compound-growth", "COMPOUND GROWTH"],
  ["currency-converter", "CONVERTER"],
  ["cost-lab", "COST LAB"],
  ["leverage-visualizer", "LEVERAGE"],
  ["spread-visualizer", "SPREAD"],
  ["order-anatomy", "ORDER ANATOMY"],
]);
const NAMES = Array.from(TITLES.keys());

const FLOOR = -1.3;
const TOP = FLOOR + 0.05;
/** the instrument leans back like a dial on a console */
const LEAN = 0.36;
const CL = Math.cos(LEAN);
const SL = Math.sin(LEAN);
/** how far the cursor and the magnifier stand off the face */
const ARM = 0.07;
const LENS = 0.19;
/** height of the pivot above the origin */
const RISE = 0.05;
const MAG = 1.75;

/** face-local to world: u right, v up the face, n off the face toward the reader */
const loc = (u: number, v: number, n = 0): V3 => [u, RISE + v * CL + n * SL, v * SL - n * CL];
/** polar on the face: radius, angle clockwise from twelve o'clock */
const at = (r: number, a: number, n = 0): V3 => loc(Math.sin(a) * r, Math.cos(a) * r, n);

const arcPts = (r: number, n: number, a0: number, a1: number, seg: number): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i <= seg; i++) out.push(at(r, a0 + ((a1 - a0) * i) / seg, n));
  return out;
};

/** a graduation: where it sits on its scale (0..1 of a turn) and its rank (0 fine, 1 half, 2 whole) */
type Tick = { a: number; k: number };
type State = { one: Tick[]; two: Tick[]; knurl: Tick[]; nut: Tick[]; loop: Record<string, V3[]>; lit: V3[]; low: V3[]; stand: V3[][] };

const near = (x: number) => Math.abs(x - Math.round(x)) < 1e-6;

/** a slide rule's scale: graduations crowd together as the decade runs out */
function logTicks(decades: number, bands: number[][]): Tick[] {
  const out: Tick[] = [];
  for (let d = 0; d < decades; d++)
    for (const [lo, hi, st] of bands) {
      const n = Math.round((hi - lo) / st);
      for (let i = 0; i < n; i++) {
        const v = lo + i * st;
        out.push({ a: (d + Math.log10(v)) / decades, k: near(v) ? 2 : near(v * (v < 2 ? 10 : 2)) ? 1 : 0 });
      }
    }
  return out;
}

function shape(f: Frame, pts: readonly V3[], fill: string | CanvasGradient | null, stroke: string | null, width = 1): void {
  const { ctx } = f;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = f.P(pts[i][0], pts[i][1], pts[i][2]);
    if (!p) return;
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

const LEN = [0.028, 0.046, 0.07];
const LIT = [0.5, 0.76, 1];
type Scale = { rot: number; r: number; dir: number; colour: string; alpha: number; n?: number; upTo?: number; lw?: number; len?: number; mul?: number; near?: number; span?: number };

/** one engraved scale: every graduation of a rank goes into a single stroke */
function graduate(f: Frame, ticks: readonly Tick[], o: Scale): void {
  const { ctx } = f;
  if (o.alpha <= 0.004) return;
  const y0 = RISE + (o.n ?? 0) * SL;
  const z0 = (o.n ?? 0) * CL;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let i = 0; i < ticks.length; i++) {
      const t = ticks[i];
      // a slow device gets every other fine graduation
      if (t.k !== k || t.a > (o.upTo ?? 1) || (k === 0 && f.q < 0.75 && i % 2 === 1)) continue;
      const a = t.a * TAU + o.rot;
      if (o.span !== undefined && Math.abs(Math.atan2(Math.sin(a - (o.near ?? 0)), Math.cos(a - (o.near ?? 0)))) > o.span) continue;
      // both ends of the graduation, projected without building points
      const su = Math.sin(a);
      const cv = Math.cos(a);
      const r1 = o.r + o.dir * (o.len ?? LEN[k] * (o.mul ?? 1));
      const p = f.P(su * o.r, y0 + cv * o.r * CL, cv * o.r * SL - z0);
      const q = f.P(su * r1, y0 + cv * r1 * CL, cv * r1 * SL - z0);
      if (!p || !q) continue;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = rgba(o.colour, o.alpha * LIT[k]);
    ctx.lineWidth = (o.lw ?? 1) * (k === 2 ? 1.3 : 1);
    ctx.stroke();
  }
}

const WIDE: { [ch: string]: number | undefined } = { I: 0.5, " ": 0.6, ":": 0.5, "/": 0.6, M: 1.25, W: 1.3 };

/** lettering engraved round the face: each letter is laid into the plane of the disc */
function engrave(f: Frame, text: string, r: number, mid: number, size: number, colour: string, alpha: number, foot = false): void {
  const c = f.P(...loc(0, 0));
  if (!c || alpha <= 0.01) return;
  const { ctx } = f;
  const sgn = foot ? -1 : 1;
  const step = (size * 0.92) / (f.u * c.s) / r;
  let total = 0;
  for (const ch of text) total += WIDE[ch] ?? 1;
  let x = -total / 2;
  for (const ch of text) {
    const w = WIDE[ch] ?? 1;
    const a = mid + sgn * (x + w / 2) * step;
    x += w;
    if (ch === " ") continue;
    const pos = at(r, a);
    const p = f.P(...pos);
    const pt = f.P(...at(r, a + sgn * 0.02));
    const pr = f.P(...at(r - sgn * 0.02, a));
    if (!p || !pt || !pr) continue;
    const k = 1 / (0.02 * f.u * p.s);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.transform(((pt.x - p.x) * k) / r, ((pt.y - p.y) * k) / r, (pr.x - p.x) * k, (pr.y - p.y) * k, 0, 0);
    ctx.translate(-p.x, -p.y);
    f.label(ch, pos, { align: "center", size, colour, alpha });
    ctx.restore();
  }
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const fine = !f.mobile;
    const seg = fine ? 96 : 56;
    const full = (r: number, n = 0) => arcPts(r, n, 0, TAU, seg);
    const even = (n: number): Tick[] => Array.from({ length: n }, (_, i) => ({ a: i / n, k: 0 }));
    return {
      one: logTicks(1, fine ? [[1, 2, 0.02], [2, 5, 0.05], [5, 10, 0.1]] : [[1, 2, 0.05], [2, 5, 0.1], [5, 10, 0.25]]),
      two: logTicks(2, fine ? [[1, 2, 0.05], [2, 4, 0.1], [4, 10, 0.25]] : [[1, 2, 0.1], [2, 5, 0.5], [5, 10, 1]]),
      knurl: even(fine ? 150 : 72),
      nut: even(fine ? 30 : 16),
      loop: { back: full(1.2, -0.1), rim: full(1.2, 0.03), lip: full(1.115, 0.03), face: full(1.11), outer: full(1), fine: full(0.83), inner: full(0.66), ring: full(0.27), hub: full(0.1, ARM) },
      lit: arcPts(1.2, 0.03, -1.75, 0.3, 36),
      low: arcPts(1.2, -0.1, 1.9, 4.3, 36),
      // the stand: a turned foot on the deck [underside, top, lit front edge] and a short neck [side, front]
      stand: [
        ...[FLOOR, TOP, TOP].map((y, j) => Array.from({ length: 41 }, (_, i): V3 => {
          const a = j === 2 ? Math.PI * (1.08 + (0.84 * i) / 40) : (i / 40) * TAU;
          return [Math.cos(a) * 0.56, y, 0.2 + Math.sin(a) * 0.56];
        })),
        [[-0.1, TOP, 0.3], [-0.1, TOP, 0.12], [-0.1, -0.6, 0.12], [-0.1, -0.6, 0.3]],
        [[-0.1, TOP, 0.12], [0.1, TOP, 0.12], [0.1, -0.6, 0.12], [-0.1, -0.6, 0.12]],
      ],
    };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.still ? 0 : f.t;
    // between a phone and a full desktop the rule draws in and moves right, away from the statement
    const wide = clamp((f.w - 720) / 580);
    f.aim((m ? -0.2 : -0.28) + Math.sin(t * 0.08) * 0.035, 0.12, 6.2, m ? 0.8 : 0.8 + 0.18 * wide);
    if (m) {
      // on a phone it sits centred and high, clear of the statement below it
      f.cx = f.w * 0.56;
      f.cy -= f.h * 0.085;
    } else f.cx += (1 - wide) * f.w * 0.04;
    // power-on: the case rises, the scales are cut round from their index, the lights come up, the cursor swings in
    const ramp = (a: number, b: number) => clamp((f.boot - a) / (b - a));
    const body = easeOut(ramp(0, 0.35));
    const drawn = ramp(0.3, 0.9);
    const cut = clamp(drawn * 4);
    const lightsOn = easeOut(ramp(0.6, 0.92)) * (0.92 + 0.08 * Math.sin(t * 0.5));
    const armOn = easeOut(ramp(0.7, 0.97));
    const named = easeOut(ramp(0.88, 0.995));
    f.cy += (1 - body) * 14;

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [0, FLOOR, 0.15], 2.3, pal.key, 0.26 * f.boot);

    if (!m) {
      shape(f, s.stand[0], rgba(pal.bg, 0.9 * body), rgba(pal.ink, 0.14 * body));
      shape(f, s.stand[1], rgba(pal.bg, 0.95 * body), null);
      shape(f, s.stand[1], rgba(pal.ink, 0.07 * body), rgba(pal.ink, 0.22 * body));
      ring(f, [0, TOP, 0.2], 0.4, { colour: pal.ink, alpha: 0.13 * body });
      trace(f, s.stand[2], pal.key, 0.4 * body, 1.2);
      shape(f, s.stand[3], rgba(pal.bg, 0.96 * body), rgba(pal.ink, 0.14 * body));
      shape(f, s.stand[4], rgba(pal.bg, 0.96 * body), null);
      shape(f, s.stand[4], rgba(pal.ink, 0.1 * body), rgba(pal.ink, 0.26 * body));
    }

    const title = TITLES.get(f.tag);
    const second = pal.key === pal.teal ? pal.blue : pal.teal;
    // each page finds the rule set differently; the discs settle into place as it powers on
    const settle = 1 - f.boot;
    const rotM = f.rnd(1) * TAU + t * 0.014 - settle * 0.6;
    const rotI = -Math.sin(t * 0.045) * 0.12 + settle * 0.4;
    const offI = f.rnd(3) * TAU;

    // ── the case: turned metal, seen a little from the side so its thickness shows
    shape(f, s.loop.back, rgba(pal.bg, 0.92 * body), rgba(pal.ink, 0.12 * body));
    f.path(s.low, pal.ink, 0.2 * body, 1);
    shape(f, s.loop.rim, rgba(pal.bg, 0.95 * body), null);
    shape(f, s.loop.rim, rgba(pal.ink, 0.08 * body), rgba(pal.ink, 0.3 * body));
    graduate(f, s.knurl, { rot: 0, r: 1.13, dir: 1, len: 0.055, n: 0.03, colour: pal.ink, alpha: 0.3 * body });
    shape(f, s.loop.lip, null, rgba(pal.ink, 0.24 * body));
    shape(f, s.loop.face, rgba(pal.bg, 0.45 * body), rgba(pal.ink, 0.1 * body));
    // the middle disc is smoked glass, the inner one metal again
    shape(f, s.loop.outer, rgba(pal.bg, 0.6 * body), null);
    shape(f, s.loop.outer, rgba(pal.key, 0.04 * body), null);
    shape(f, s.loop.inner, rgba(pal.bg, 0.6 * body), null);
    shape(f, s.loop.inner, rgba(pal.ink, 0.07 * body), null);

    // light across the face: a soft sheen, and the bow-tie highlight of a turned surface
    const g0 = f.P(...at(1.2, -0.8));
    const g1 = f.P(...at(1.2, Math.PI - 0.8));
    if (g0 && g1) {
      const band = clamp(0.64 + f.px * 0.12 + Math.sin(t * 0.17) * 0.04, 0.46, 0.86);
      const g = ctx.createLinearGradient(g0.x, g0.y, g1.x, g1.y);
      g.addColorStop(0, rgba(pal.ink, 0.1 * body));
      g.addColorStop(0.3, rgba(pal.ink, 0.012 * body));
      g.addColorStop(band - 0.14, rgba(pal.ink, 0));
      g.addColorStop(band, rgba(pal.ink, 0.07 * body));
      g.addColorStop(band + 0.12, rgba(pal.ink, 0));
      shape(f, s.loop.rim, g, null);
    }
    for (let i = 1; i <= 7; i++)
      for (const a of [-0.8, Math.PI - 0.8]) f.fill([loc(0, 0), at(1.11, a - i * 0.06), at(1.11, a), at(1.11, a + i * 0.06)], pal.ink, (a < 0 ? 0.0075 : 0.004) * body);
    trace(f, s.lit, pal.key, 0.55 * body, 1.4);

    // ── the scales. Fixed outer scale and the turning disc meet edge to edge, lit from behind through the join
    graduate(f, s.one, { rot: -2.3, r: 1.003, dir: 1, colour: pal.ink, alpha: 0.7 * cut, upTo: drawn });
    graduate(f, s.one, { rot: rotM, r: 0.992, dir: -1, colour: pal.ink, alpha: 0.8 * cut, upTo: drawn });
    shape(f, s.loop.fine, null, rgba(pal.ink, 0.1 * body));
    graduate(f, s.two, { rot: rotM, r: 0.668, dir: 1, mul: 0.8, colour: pal.ink, alpha: 0.55 * cut, upTo: drawn });
    graduate(f, s.two, { rot: rotI + offI, r: 0.652, dir: -1, mul: 0.8, colour: pal.ink, alpha: 0.65 * cut, upTo: drawn });
    trace(f, s.loop.outer, pal.key, 0.5 * lightsOn, 1.2);
    trace(f, s.loop.inner, second, 0.36 * lightsOn, 1.1);
    // index marks: where each scale begins
    const idx = (r: number, a: number, d: number, colour: string, alpha: number) => f.fill([at(r, a), at(r + d, a - 0.011 / r), at(r + d, a + 0.011 / r)], colour, alpha * cut);
    idx(1.085, -2.3, 0.03, pal.ink, 0.75);
    idx(0.91, rotM, -0.034, pal.key, 0.95);
    idx(0.585, rotI + offI, -0.03, second, 0.9);

    // ── the inner disc: the tool's name, the maker's mark and one detent for each tool in the family
    shape(f, s.loop.ring, null, rgba(pal.ink, 0.12 * body));
    for (let i = 0; i < NAMES.length; i++) {
      const own = NAMES[i] === f.tag;
      const p = at(0.27, rotI + (i / NAMES.length) * TAU);
      if (own) lamp(f, p, pal.gold, named, 0.014);
      else f.dot(p, 0.009, pal.ink, (title ? 0.3 : 0.6) * lightsOn);
    }
    engrave(f, title ?? "TOOLS", m ? 0.47 : 0.44, rotI, m ? 8 : 12, title ? pal.gold : pal.ink, (title ? 0.95 : 0.82) * named);
    if (!m) engrave(f, "GIO4X", 0.46, rotI + Math.PI, 9, pal.ink2, 0.42 * named, true);

    // ── the cursor: a glass arm on the centre pivot, a hairline of light along it
    const cur = (m ? 1.35 : 1.08) + f.rnd(2) * (m ? 0.35 : 1.05) + Math.sin(t * 0.09 + f.rnd(4) * TAU) * 0.09 - (1 - armOn) * 0.8;
    const du = Math.sin(cur);
    const dv = Math.cos(cur);
    const arm = (d: number, w: number, n = ARM): V3 => loc(du * d + dv * w, dv * d - du * w, n);
    // its shadow on the face, then the glass
    f.fill([arm(0, -0.04, 0), arm(0, 0.04, 0), arm(1.26, 0.026, 0), arm(1.26, -0.026, 0)], pal.bg, 0.45 * armOn);
    const blade: V3[] = [arm(-0.06, -0.042), arm(-0.06, 0.042), arm(1.3, 0.026), arm(1.3, -0.026)];
    shape(f, blade, rgba(pal.ink, 0.07 * armOn), rgba(pal.ink, 0.18 * armOn));
    f.line(blade[0], blade[3], pal.ink, 0.42 * armOn, 1);
    const hair: V3[] = [];
    for (let i = 0; i <= 6; i++) hair.push(arm(0.06 + (1.21 * i) / 6, 0));
    trace(f, hair, pal.key, 0.85 * armOn, 1.1, t / 10);
    f.path(hair, pal.ink, 0.45 * armOn, 1);
    // the pivot: a knurled nut with a domed cap
    shape(f, s.loop.hub, rgba(pal.bg, 0.92 * body), rgba(pal.ink, 0.34 * body));
    graduate(f, s.nut, { rot: 0, r: 0.07, dir: 1, len: 0.03, n: ARM, colour: pal.ink, alpha: 0.5 * body });
    orb(f, loc(0, 0, ARM + 0.02), 0.058, pal.key, body);
    lamp(f, arm(1.3, 0), pal.key, armOn * (0.85 + 0.15 * Math.sin(t * 0.9)), 0.012);

    // ── the magnifier: a glass ball riding the cursor over the join, the graduations larger inside it
    const lensOn = named;
    const eye = arm(1, 0);
    const lp = f.P(...eye);
    const under = f.P(...at(1, cur));
    if (lp && under && lensOn > 0.01) {
      const R = LENS * lp.s * f.u;
      ctx.save();
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, R, 0, TAU);
      ctx.fillStyle = rgba(pal.bg, 0.92 * lensOn);
      ctx.fill();
      ctx.clip();
      ctx.translate(lp.x, lp.y);
      ctx.scale(MAG, MAG);
      ctx.translate(-under.x, -under.y);
      const lens = { colour: pal.ink, alpha: lensOn, lw: 1.5 / MAG, near: cur, span: 0.3 };
      graduate(f, s.one, { ...lens, rot: -2.3, r: 1.003, dir: 1 });
      graduate(f, s.one, { ...lens, rot: rotM, r: 0.992, dir: -1 });
      f.path(arcPts(1, 0, cur - 0.3, cur + 0.3, 10), pal.key, 0.9 * lensOn, 1.6 / MAG);
      f.line(arm(0.7, 0, 0), arm(1.3, 0, 0), pal.ink, 0.9 * lensOn, 1 / MAG);
      ctx.restore();
      orb(f, eye, LENS, pal.key, 0.42 * lensOn);
      // its mount: a fine metal bezel, and the glint a curved surface throws
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgba(pal.key, 0.65 * lensOn);
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, R + 1.5, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.ink, 0.5 * lensOn);
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, R * 0.8, 3.5, 4.5);
      ctx.stroke();
    }
  },
};

export default scene;
