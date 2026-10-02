/**
 * BEACON — a conversation, drawn as a clean radio link.
 *
 * On the right stands the house: a slim mast with a glass head and a lamp,
 * lettered GIO4X. Nearer the visitor, a smaller station lettered YOU. Wavefronts
 * open from the mast at an unhurried, regular interval and fade as they travel.
 * One message leaves YOU along a lifted arc, carrying a small pane folded like
 * an envelope; the mast takes it in, and after a pause a reply returns.
 *
 * Nothing here is a status or a measurement: it is two names and the shape of
 * a courteous exchange.
 */
import { TAU, clamp, easeInOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { arc, deck, lamp, orb, pool, ring, trace } from "../kit";

const FLOOR = -1.3;
/** the two glass heads: the house's mast stands further back, the visitor's station nearer */
const MAST: V3 = [1.0, 0.8, 0.3];
const YOU: V3 = [-0.74, -0.4, -0.32];
const R_MAST = 0.18;
const R_YOU = 0.125;
/** one exchange: the message goes out, a pause, the reply comes back */
const CYCLE = 9;
const WAVE_EVERY = 4.5;
/** the fan the mast transmits into, in turns, in the upright plane through the mast */
const FAN_FROM = 0.425;
const FAN_TO = 0.575;

type State = { link: V3[]; wire: V3[]; bearing: number; range: number };

/** a soft swell, 0 → 1 → 0 across x = 0..1 */
const bell = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2);

/** a point part-way along a polyline */
const along = (pts: readonly V3[], t: number): V3 => {
  const x = clamp(t) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(x));
  const k = x - i;
  return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k), lerp(pts[i][2], pts[i + 1][2], k)];
};

/** the stretch of the link a pulse has just lit: brightest at `head`, gone by `rear` */
function wake(f: Frame, pts: readonly V3[], rear: number, head: number, colour: string, alpha: number): void {
  if (alpha <= 0.01) return;
  for (let s = 0; s < 3; s++) {
    const seg: V3[] = [];
    for (let j = 0; j <= 5; j++) seg.push(along(pts, lerp(rear, head, (s + j / 5) / 3)));
    trace(f, seg, colour, (alpha * (s + 1)) / 3, 1.3);
  }
}

/** the lamp's own light, thrown toward the visitor: a soft lobe with no edge, for the wavefronts to travel in */
function lobe(f: Frame, c: V3, reach: number, colour: string, alpha: number): void {
  const p = f.P(c[0], c[1], c[2]);
  const q = f.P(c[0] - reach, c[1], c[2]);
  if (!p || !q || alpha <= 0.003) return;
  const { ctx } = f;
  const half = Math.hypot(q.x - p.x, q.y - p.y) / 2;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(q.y - p.y, q.x - p.x));
  ctx.scale(1, 0.62);
  const g = ctx.createRadialGradient(half * 0.08, 0, 0, half, 0, half);
  g.addColorStop(0, rgba(colour, alpha));
  g.addColorStop(0.42, rgba(colour, alpha * 0.4));
  g.addColorStop(1, rgba(colour, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(half, 0, half, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** a machined block: only the faces the viewer can see, the top one catching the light */
function block(f: Frame, lo: V3, hi: V3, colour: string, a: number): void {
  const { pal } = f;
  const [x0, y0, z0] = lo;
  const [x1, y1, z1] = hi;
  const near = f.P(x0, y0, z0);
  const far = f.P(x0, y0, z1);
  if (!near || !far) return;
  // which flank shows depends on where the block stands relative to the eye
  const xs = far.x < near.x ? x0 : x1;
  const faces: V3[][] = [
    [[xs, y0, z0], [xs, y0, z1], [xs, y1, z1], [xs, y1, z0]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]],
    [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]],
  ];
  const tint = [0.04, 0.08, 0.15];
  faces.forEach((q, i) => {
    f.fill(q, pal.bg, 0.96 * a);
    f.fill(q, pal.ink, tint[i] * a);
    f.path(q, i === 2 ? colour : pal.ink, (i === 2 ? 0.6 : 0.26) * a, 1, true);
  });
}

/** a station: a stepped machined foot, a telescoping shaft lit on the side facing the other station, a glass head in a graduated bezel, a lamp */
function station(f: Frame, head: V3, r: number, colour: string, on: number, level: number, sections: number, lit: 1 | -1, halo: boolean): void {
  if (on <= 0.003) return;
  const { pal } = f;
  const [x, y, z] = head;
  const b = r * 1.25;
  const step = b * 0.46;
  block(f, [x - b, FLOOR, z - b], [x + b, FLOOR + step, z + b], pal.ink, on);
  block(f, [x - b * 0.52, FLOOR + step, z - b * 0.52], [x + b * 0.52, FLOOR + step * 1.8, z + b * 0.52], colour, on);

  // the shaft rises as the station powers on, each section slimmer than the one below
  const y0 = FLOOR + step * 1.8;
  const top = lerp(y0, y - r * 0.8, on);
  for (let i = 0; i < sections; i++) {
    const ya = lerp(y0, top, i / sections);
    const yb = lerp(y0, top, (i + 1) / sections);
    const w = r * lerp(0.25, 0.1, sections > 1 ? i / (sections - 1) : 1);
    const quad: V3[] = [[x - w, ya, z], [x + w, ya, z], [x + w, yb, z], [x - w, yb, z]];
    f.fill(quad, pal.bg, 0.92 * on);
    f.fill(quad, pal.ink, 0.12 * on);
    f.line([x - w * lit, ya, z], [x - w * lit, yb, z], pal.ink, 0.26 * on, 1);
    f.line([x + w * lit, ya, z], [x + w * lit, yb, z], colour, 0.72 * on, 1.2);
    // a machined collar where two sections join
    if (i > 0) {
      const cw = w * 1.9;
      f.fill([[x - cw, ya - 0.012, z], [x + cw, ya - 0.012, z], [x + cw, ya + 0.012, z], [x - cw, ya + 0.012, z]], pal.ink, 0.5 * on);
    }
  }

  // head: the bezel's far half, the glass, the lamp, then the bezel's near half
  const bezel = { colour: pal.ink, ticks: 12, major: 3, tickLen: r * 0.22 };
  ring(f, head, r * 1.7, { ...bezel, from: 0, to: 0.5, alpha: 0.2 * on });
  ring(f, head, r * 1.46, { colour: pal.ink, from: 0, to: 0.5, alpha: 0.1 * on });
  if (halo) f.glow(head, r * 4, colour, 0.15 * on * level);
  orb(f, head, r, colour, on);
  lamp(f, head, colour, on * level, r * 0.17);
  ring(f, head, r * 1.46, { colour: pal.ink, from: 0.5, to: 1, alpha: 0.18 * on });
  ring(f, head, r * 1.7, { ...bezel, from: 0.5, to: 1, alpha: 0.4 * on });
}

/** a small flat pane with a V fold: a letter reduced to its outline */
function envelope(f: Frame, c: V3, w: number, h: number, tilt: number, yaw: number, colour: string, a: number): void {
  if (a <= 0.01) return;
  const { pal } = f;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const at = (u: number, v: number): V3 => {
    const x1 = (u * w * ct - v * h * st) / 2;
    return [c[0] + x1 * Math.cos(yaw), c[1] + (u * w * st + v * h * ct) / 2, c[2] + x1 * Math.sin(yaw)];
  };
  const q: V3[] = [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)];
  f.fill(q, pal.bg, 0.78 * a);
  f.fill(q, colour, 0.1 * a);
  f.path(q, pal.ink, 0.3 * a, 1, true);
  f.path([q[3], at(0, -0.14), q[2]], colour, 0.75 * a, 1.1);
  f.line(q[3], q[2], colour, 0.95 * a, 1.5);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const link = arc(YOU, MAST, 0.48, f.mobile ? 30 : 44);
    // the visible wire stops short of the two glass heads
    const wire: V3[] = [];
    const n = f.mobile ? 26 : 40;
    for (let i = 0; i <= n; i++) wire.push(along(link, lerp(0.06, 0.91, i / n)));
    const dx = YOU[0] - MAST[0];
    const dz = YOU[2] - MAST[2];
    return { link, wire, bearing: Math.atan2(dz, dx) / TAU, range: Math.hypot(dx, dz) };
  },
  draw(f, s) {
    const { pal } = f;
    // the eye sits level with the link, so the deck reads as a floor and the mast stands true
    const sway = f.still ? 0 : Math.sin(f.t * 0.09 + f.rnd(1) * TAU) * 0.045;
    // a narrow desktop stage leaves less room beside the headline: draw smaller and further right
    const narrow = f.mobile ? 0 : clamp((1320 - f.w) / 400);
    f.aim(-0.1 + sway, 0.03, 6.2, f.mobile ? 0.68 : lerp(0.93, 0.74, narrow));
    f.cx = f.w * (f.mobile ? 0.48 : 0.7 + 0.07 * narrow);
    f.cy -= f.h * (f.mobile ? 0.1 : 0.025);

    // ── the exchange, on one clock
    const c = f.still ? 3.3 : f.t % CYCLE;
    const out = easeInOut((c - 1.5) / 3.5);
    const back = easeInOut((c - 5.9) / 3);
    const outA = clamp(out / 0.07) * clamp((1 - out) / 0.07);
    const backA = clamp(back / 0.07) * clamp((1 - back) / 0.07);
    const received = bell((c - 4.6) / 1.7);
    const answered = f.still || f.t < CYCLE ? 0 : bell(((c - 8.5 + CYCLE) % CYCLE) / 1.7);
    const breathe = f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 0.9);

    const mastOn = f.on(0.05, 0.5);
    const youOn = f.on(0.4, 0.4);
    const groundOn = f.on(0.6, 0.35);
    const linkOn = f.on(0.95, 0.25);
    const waveOn = f.on(1, 0.2);

    // ── the deck: light under the mast, a graduated foot, a range arc that passes through the visitor
    const footM: V3 = [MAST[0], FLOOR, MAST[2]];
    const footY: V3 = [YOU[0], FLOOR, YOU[2]];
    deck(f, { y: FLOOR, alpha: 0.13 });
    pool(f, footM, 2.4, pal.key, (0.24 + 0.06 * received) * f.boot);
    ring(f, footM, 0.58, { colour: pal.ink, alpha: 0.3 * mastOn, ticks: 36, major: 3, tickLen: 0.07 });
    f.line(footM, footY, pal.ink, 0.12 * groundOn, 1);
    if (!f.mobile) ring(f, footM, s.range * 0.56, { colour: pal.ink, alpha: 0.16 * groundOn, from: s.bearing - 0.11, to: s.bearing + 0.09 });
    ring(f, footM, s.range, { colour: pal.key, alpha: 0.4 * groundOn, from: s.bearing - 0.045, to: s.bearing + 0.075, ticks: 12, tickLen: 0.05 });
    ring(f, footY, 0.33, { colour: pal.gold, alpha: 0.4 * youOn });

    // ── the mast (further back, so first), its lamp throwing light toward the visitor
    if (!f.mobile) lobe(f, MAST, 1.95, pal.key, (0.17 + 0.05 * received) * waveOn);
    station(f, MAST, R_MAST, pal.key, mastOn, breathe + 0.45 * received, 3, -1, true);
    const tip: V3 = [MAST[0], MAST[1] + R_MAST + 0.24 * mastOn, MAST[2]];
    f.line([MAST[0], MAST[1] + R_MAST, MAST[2]], tip, pal.ink, 0.5 * mastOn, 1);
    f.dot(tip, 0.012, pal.key, 0.9 * mastOn);

    // ── wavefronts: arcs opening from the head toward the visitor, each a patch of a sphere
    const waves = f.mobile ? 3 : 4;
    const life = waves * WAVE_EVERY;
    for (let i = 0; i < waves; i++) {
      const k = (f.t / life + i / waves) % 1;
      const r = lerp(0.38, 1.7, k);
      const a = clamp(k / 0.1) * Math.pow(1 - k, 1.35) * waveOn;
      ring(f, MAST, r, { axis: "y", colour: pal.key, alpha: 0.24 * a, from: 0.45, to: 0.55 });
      ring(f, MAST, r, { axis: "z", colour: pal.key, alpha: 0.1 * a, width: 6, from: FAN_FROM, to: FAN_TO });
      ring(f, MAST, r, { axis: "z", colour: pal.key, alpha: 0.7 * a, width: 1.5, from: FAN_FROM, to: FAN_TO });
    }

    // ── the link: a fine wire between the two heads, drawn in from the visitor's side
    const shown = Math.round(linkOn * (s.wire.length - 1)) + 1;
    if (shown > 1) trace(f, s.wire.slice(0, shown), pal.ink, 0.24, 1);

    // the reply: light returning from the mast
    if (backA > 0) {
      const q = 1 - back;
      wake(f, s.link, Math.min(1, q + 0.2), q, pal.key, 0.8 * backA);
      const p = along(s.link, q);
      f.glow(p, 0.16, pal.key, 0.75 * backA);
      f.dot(p, 0.013, pal.ink, backA);
    }
    // the message: light leaving the visitor, a small folded pane riding on it
    if (outA > 0) {
      const a = outA * linkOn;
      wake(f, s.link, Math.max(0, out - 0.2), out, pal.gold, 0.8 * a);
      const p = along(s.link, out);
      const a0 = along(s.link, out - 0.03);
      const a1 = along(s.link, out + 0.03);
      const tilt = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]) * 0.4;
      f.glow(p, 0.17, pal.gold, 0.7 * a);
      f.dot(p, 0.013, pal.ink, a);
      envelope(f, [p[0], p[1] + 0.135, p[2]], 0.28, 0.18, tilt, 0.25, pal.gold, a);
    }

    // ── the visitor's station (nearest, so last)
    station(f, YOU, R_YOU, pal.gold, youOn, breathe + 0.45 * answered, 2, 1, !f.mobile);

    // ── lettering: the house's name beside its head, or above the mast where the stage is too narrow
    const size = f.mobile ? 10 : 11;
    const beside: V3 = [MAST[0] + R_MAST * 2.3, MAST[1], MAST[2]];
    const room = f.P(beside[0], beside[1], beside[2]);
    if (f.mobile || !room || room.x + 60 > f.w) {
      f.label("GIO4X", tip, { dy: -13, align: "center", size, colour: pal.ink, alpha: 0.85 * mastOn });
    } else {
      f.line([MAST[0] + R_MAST * 1.85, MAST[1], MAST[2]], beside, pal.ink, 0.25 * mastOn, 1);
      f.label("GIO4X", beside, { dx: 7, size, colour: pal.ink, alpha: 0.88 * mastOn });
    }
    // the visitor's name sits on the headline side, unless that would run it into the headline's own column
    const aside: V3 = [YOU[0] - R_YOU * 1.85, YOU[1], YOU[2]];
    const edge = f.P(aside[0], aside[1], aside[2]);
    if (!f.mobile && edge && edge.x < 640) f.label("YOU", [YOU[0], YOU[1] - R_YOU * 1.6, YOU[2]], { dx: 10, size, colour: pal.gold, alpha: 0.9 * youOn });
    else f.label("YOU", aside, { dx: -7, align: "right", size, colour: pal.gold, alpha: 0.9 * youOn });
  },
};

export default scene;
