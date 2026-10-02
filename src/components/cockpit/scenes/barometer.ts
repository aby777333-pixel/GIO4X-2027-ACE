/**
 * BAROMETER — risk, as pressure.
 *
 * An aneroid barometer in a cradle on a stepped foot: a turned bezel, a dial
 * graduated without a single numeral, a champagne needle, a second fine hand
 * that marks where the instrument was set, and in the open centre of the dial
 * the sprung capsule itself, corrugated, behind the glass. Faint rings of
 * pressure stand in the air round it and drift slowly outward.
 *
 * The instrument measures nothing and forecasts nothing: the scale has no
 * figures and no zones, and the needle only rests and breathes. It is the idea
 * of the page (conditions press on a position, and can change quickly), drawn.
 *
 * The pointer is the pressure. Ripples spread from the cursor, the capsule
 * gives under them, and the needle is pushed away from wherever the pointer
 * stands, then swings back and settles on its spring. The set hand never moves.
 */
import { TAU, clamp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, ring } from "../kit";

const FLOOR = -1.2;
/** the dial's centre and radius; every radius below is in dial radii */
const C: V3 = [0, 0.3, 0];
const R = 0.78;
/** the scale: from lower left, clockwise over the top, to lower right */
const A0 = TAU * 0.625;
const SWEEP = TAU * 0.75;
/** depths: case back, dial, hands, glass and bezel face */
const ZB = 0.3;
const ZD = 0.02;
const ZH = -0.025;
const ZG = -0.06;
/** bezel, capsule well, cradle */
const BEZEL = 1.17;
const WELL = 0.47;
const CRADLE = 1.31;
/** the needle's spring and its damping: it swings two or three times before it rests */
const STIFF = 34;
const DAMP = 3.4;

type Tick = { a: V3; b: V3; major: boolean };
type State = { outer: V3[]; inner: V3[]; back: V3[]; dial: V3[]; well: V3[]; ticks: Tick[]; cradle: V3[]; rest: number; set: number; a: number; w: number; press: number };

const at = (r: number, a: number, z: number): V3 => [C[0] + Math.cos(a) * r * R, C[1] + Math.sin(a) * r * R, z];
/** where a position on the scale (0 to 1) stands, as an angle */
const scale = (k: number) => A0 - k * SWEEP;

function outline(f: Frame, pts: readonly V3[]): void {
  const { ctx } = f;
  for (let i = 0; i < pts.length; i++) {
    const p = f.P(pts[i][0], pts[i][1], pts[i][2]);
    if (!p) return;
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath();
}

/** a disc, or the annulus between two loops, in a flat tone or a gradient */
function plate(f: Frame, outer: readonly V3[], inner: readonly V3[] | null, style: string | CanvasGradient): void {
  const { ctx } = f;
  ctx.beginPath();
  outline(f, outer);
  if (inner) outline(f, inner);
  ctx.fillStyle = style;
  ctx.fill("evenodd");
}

/** turned metal: broad highlights opposite one another, which swing a little with the pointer */
function steel(f: Frame, hi: number, turn: number): string | CanvasGradient {
  const { ctx, pal } = f;
  const p = f.P(C[0], C[1], ZG);
  if (!p || typeof ctx.createConicGradient !== "function") return rgba(pal.ink, hi * 0.3);
  const g = ctx.createConicGradient(turn + f.px * 0.3 + (f.still ? 0 : Math.sin(f.t * 0.13) * 0.12), p.x, p.y);
  const stops: [number, number, boolean][] = [[0, 0.08, false], [0.1, 0.75, true], [0.22, 0.08, false], [0.38, 0.3, false], [0.5, 0.08, false], [0.62, 1, false], [0.74, 0.08, false], [0.88, 0.26, false], [1, 0.08, false]];
  for (const [k, v, key] of stops) g.addColorStop(k, rgba(key ? pal.key : pal.ink, hi * v));
  return g;
}

/** a machined step of the foot: its top, its front and the flank the viewer can see */
function step(f: Frame, hx: number, y0: number, y1: number, hz: number, level: number): void {
  if (level <= 0.003) return;
  const { pal } = f;
  const top: V3[] = [[-hx, y1, -hz], [hx, y1, -hz], [hx, y1, hz], [-hx, y1, hz]];
  const flank: V3[] = [[hx, y0, -hz], [hx, y0, hz], [hx, y1, hz], [hx, y1, -hz]];
  const front: V3[] = [[-hx, y0, -hz], [hx, y0, -hz], [hx, y1, -hz], [-hx, y1, -hz]];
  for (const [q, tone] of [[top, 0.07], [flank, 0.04], [front, 0.14]] as const) {
    f.fill(q, pal.bg, 0.94 * level);
    f.fill(q, pal.ink, tone * level);
    f.path(q, pal.ink, 0.26 * level, 1, true);
  }
  f.line(front[3], front[2], pal.key, 0.55 * level, 1.25);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = f.mobile ? 48 : 80;
    const loop = (r: number, z: number): V3[] => {
      const o: V3[] = [];
      for (let i = 0; i < n; i++) o.push(at(r, (i / n) * TAU, z));
      return o;
    };
    // graduations: fine marks, every fifth one longer, and not one figure
    const ticks: Tick[] = [];
    const count = f.mobile ? 30 : 60;
    for (let i = 0; i <= count; i++) {
      const major = i % 5 === 0;
      const a = scale(i / count);
      ticks.push({ a: at(0.92, a, ZD), b: at(major ? 0.79 : 0.855, a, ZD), major });
    }
    const cradle: V3[] = [];
    for (let i = 0; i <= 24; i++) cradle.push(at(CRADLE, TAU * (0.555 + (0.39 * i) / 24), 0.12));
    // where the needle rests differs a little from page to page; the set hand stands a few marks off it
    const rest = 0.4 + f.rnd(3) * 0.1;
    return { outer: loop(BEZEL, ZG), inner: loop(1, ZG), back: loop(BEZEL, ZB), dial: loop(1, ZD), well: loop(WELL, ZD), ticks, cradle, rest, set: rest + 0.24, a: A0, w: 0, press: 0 };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const sway = f.still ? 0 : Math.sin(f.t * 0.08) * 0.04;
    f.aim(0.27 + sway + (f.rnd(1) - 0.5) * 0.06, -0.03, 6.4, 0.94);

    const body = f.on(0, 0.35);
    const lit = f.on(0.3, 0.4);
    const face = f.on(0.45, 0.4);
    const hands = f.on(0.7, 0.3);
    const pc = f.P(C[0], C[1], ZH);
    const px = pc ? R * pc.s * f.u : 1;

    // ── the pointer as pressure: how hard it presses, and from which side of the needle
    const rest = scale(s.rest + (f.still ? 0 : Math.sin(f.t * 0.17) * 0.022 + Math.sin(f.t * 0.43 + 1) * 0.009));
    let push = 0;
    let press = 0;
    if (pc && f.hover > 0) {
      const dx = f.mx - pc.x;
      const dy = pc.y - f.my;
      const d = Math.hypot(dx, dy);
      // full strength over the instrument, fading out across the air round it; nothing at the very hub
      press = f.hover * clamp((2.9 * px - d) / (1.6 * px));
      let off = rest - Math.atan2(dy, dx);
      off -= Math.round(off / TAU) * TAU;
      const k = off / 0.62;
      push = 0.7 * press * clamp(d / (0.22 * px)) * k * Math.exp(0.5 - 0.5 * k * k);
    }
    if (f.still) {
      s.a = rest;
      s.press = 0;
    } else {
      const want = clamp(rest + push, scale(1) + 0.04, A0 - 0.04);
      const h = Math.min(f.dt, 0.05) / 2;
      for (let i = 0; i < 2; i++) {
        s.w += (STIFF * (want - s.a) - DAMP * s.w) * h;
        s.a += s.w * h;
      }
      s.press += (press - s.press) * (1 - Math.exp(-f.dt * 5));
    }

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [0, FLOOR, 0], 2.5, pal.key, 0.2 * f.boot);

    // ── pressure in the air: faint rings round the instrument, drifting outward
    const rings = f.mobile ? 4 : 5;
    for (let k = 0; k < rings; k++) {
      const ph = ((k + (f.still ? 0.35 : f.t * 0.04)) % rings) / rings;
      ring(f, [C[0], C[1], 0.45], R * (1.5 + ph * 2.1), { axis: "z", colour: pal.key, alpha: 0.24 * Math.sin(Math.PI * ph) * lit, seg: 72 });
    }

    // ── the foot, the stem and the cradle
    step(f, 0.56, FLOOR, FLOOR + 0.07, 0.3, body);
    step(f, 0.34, FLOOR + 0.07, FLOOR + 0.14, 0.19, body);
    const low = C[1] - CRADLE * R;
    const wide = Math.max(2, 0.05 * f.u);
    f.line([0, FLOOR + 0.14, 0.12], [0, low, 0.12], pal.bg, 0.95 * body, wide * 1.5);
    f.line([0, FLOOR + 0.14, 0.12], [0, low, 0.12], pal.ink, 0.3 * body, wide * 1.5);
    f.line([-0.022, FLOOR + 0.14, 0.12], [-0.022, low, 0.12], pal.key, 0.55 * body, 1);
    f.path(s.cradle, pal.bg, 0.95 * body, wide);
    f.path(s.cradle, pal.ink, 0.34 * body, wide);
    f.path(s.cradle.slice(0, 9), pal.key, 0.5 * lit, 1.25);
    for (const end of [s.cradle[0], s.cradle[s.cradle.length - 1]]) {
      // the trunnions the case hangs on
      const side = Math.sign(end[0] - C[0]);
      f.line(end, [C[0] + side * BEZEL * R * 0.96, end[1], end[2]], pal.ink, 0.5 * body, wide * 0.6);
      f.dot(end, 0.04, pal.bg, body);
      f.dot(end, 0.04, pal.ink, 0.3 * body);
      f.dot(end, 0.014, pal.gold, 0.9 * lit);
    }

    // ── the case: its back, then the bezel in turned metal
    plate(f, s.back, null, rgba(pal.bg, 0.95 * body));
    plate(f, s.back, null, rgba(pal.ink, 0.06 * body));
    f.path(s.back, pal.ink, 0.2 * body, 1, true);
    plate(f, s.outer, s.inner, rgba(pal.bg, 0.96 * body));
    plate(f, s.outer, s.inner, steel(f, 0.34 * body, 0.6));
    f.path(s.outer, pal.ink, 0.42 * body, 1.25, true);
    f.path(s.inner, pal.ink, 0.3 * body, 1, true);
    const n = s.outer.length;
    f.path(s.outer.slice(Math.round(n * 0.2), Math.round(n * 0.44)), pal.key, 0.6 * lit, 1.5);

    // ── the dial: a ring of graduations round an open centre
    plate(f, s.dial, null, rgba(pal.bg, 0.92 * face));
    plate(f, s.dial, s.well, rgba(pal.ink, 0.05 * face));
    plate(f, s.dial, null, rgba(pal.key, 0.035 * lit));
    ring(f, [C[0], C[1], ZD], 0.92 * R, { axis: "z", colour: pal.ink, alpha: 0.4 * face, from: 0.375, to: 1.125, seg: 64 });
    ring(f, [C[0], C[1], ZD], 0.74 * R, { axis: "z", colour: pal.ink, alpha: 0.13 * face, from: 0.375, to: 1.125, seg: 64 });
    for (const k of s.ticks) f.line(k.a, k.b, pal.ink, (k.major ? 0.85 : 0.5) * face, k.major ? 1.5 : 1);
    f.label("R I S K", at(0.77, TAU * 0.75, ZD), { align: "center", size: f.mobile ? 8 : 10, colour: pal.ink, alpha: 0.8 * face });

    // ── the capsule in the well: corrugated, sprung, and it gives a little under pressure
    const give = 1 - 0.07 * s.press + (f.still ? 0 : Math.sin(f.t * 0.7) * 0.012);
    plate(f, s.well, null, rgba(pal.bg, 0.6 * face));
    plate(f, s.well, null, steel(f, (0.2 + 0.2 * s.press) * face, 2.1));
    f.path(s.well, pal.ink, 0.5 * face, 1.25, true);
    const folds = f.mobile ? 4 : 6;
    for (let i = 1; i <= folds; i++) {
      const r = ((WELL - 0.04) * R * i * give) / folds;
      ring(f, [C[0], C[1], ZD], r, { axis: "z", colour: pal.ink, alpha: (i % 2 ? 0.5 : 0.24) * face, seg: 40 });
      ring(f, [C[0], C[1], ZD], r, { axis: "z", colour: pal.key, alpha: (0.5 + 0.4 * s.press) * lit, from: 0.26, to: 0.44, seg: 40, width: 1.25 });
    }
    // the hairspring at the arbor winds and unwinds with the needle
    const coil: V3[] = [];
    for (let i = 0; i <= 44; i++) coil.push(at(0.035 + 0.0024 * i, s.a + i * 0.4, ZH + 0.01));
    f.path(coil, pal.gold, 0.6 * hands, 1);

    // ── the set hand: fine, open at the tip, and it stays where it was put
    const sa = scale(s.set);
    f.line(at(0.07, sa, ZH), at(0.82, sa, ZH), pal.key, 0.85 * hands, 1.25);
    f.path([at(0.82, sa - 0.035, ZH), at(0.9, sa, ZH), at(0.82, sa + 0.035, ZH)], pal.key, 0.9 * hands, 1.25, true);

    // ── the needle: champagne, with a counterweight behind the arbor
    const tip = at(0.86, s.a, ZH);
    f.glow(tip, 0.2, pal.gold, 0.22 * hands);
    f.fill([tip, at(0.05, s.a + 1.05, ZH), at(0.3, s.a + Math.PI, ZH), at(0.05, s.a - 1.05, ZH)], pal.gold, 0.95 * hands);
    f.dot(at(0.24, s.a + Math.PI, ZH), 0.045 * R, pal.gold, 0.95 * hands);
    f.dot(at(0.24, s.a + Math.PI, ZH), 0.022 * R, pal.bg, 0.9 * hands);
    f.dot(at(0, 0, ZH), 0.062 * R, pal.bg, hands);
    ring(f, at(0, 0, ZH), 0.062 * R, { axis: "z", colour: pal.gold, alpha: 0.9 * hands, seg: 20 });
    lamp(f, at(0, 0, ZH), pal.gold, hands * (f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 0.9)), 0.016);

    // ── the glass over it all: one band of sheen
    if (pc) {
      const band = clamp(0.36 + f.px * 0.2 + (f.still ? 0 : Math.sin(f.t * 0.17) * 0.06), 0.14, 0.8);
      const g = ctx.createLinearGradient(pc.x - px, pc.y - px, pc.x + px, pc.y + px);
      g.addColorStop(band - 0.13, rgba(pal.ink, 0));
      g.addColorStop(band, rgba(pal.ink, 0.085 * face));
      g.addColorStop(band + 0.19, rgba(pal.ink, 0));
      plate(f, s.inner, null, g);
    }

    // ── ripples of pressure spreading from the pointer
    if (f.hover > 0.01) {
      ctx.lineWidth = 1.25;
      for (let k = 0; k < 3; k++) {
        const ph = (f.t * 0.42 + k / 3) % 1;
        ctx.beginPath();
        ctx.arc(f.mx, f.my, (0.16 + ph * 1.5) * f.u, 0, TAU);
        ctx.strokeStyle = rgba(pal.key, 0.5 * f.hover * Math.pow(1 - ph, 1.6) * Math.min(1, ph * 8));
        ctx.stroke();
      }
    }
  },
};

export default scene;
