/**
 * PLATFORMS — two screens, one account.
 *
 * Two panes of display glass stand in machined rails, angled toward each other
 * like the two screens of a flight deck. The left is lettered METATRADER 5 and
 * shows what that terminal is known for: one chart on a dotted grid. The right
 * is lettered 777 RAPTOR and shows a modular workspace: four small panes
 * floating just off the glass. Where the two screens face sits one small glass
 * core, lettered GIO4X, with a trace inlaid in the deck to each rail: a single
 * account reaches both platforms. The panes light one after the other.
 *
 * The charts are drawings of charts: fixed schematic series with no symbol, no
 * scale figures and no prices, and both carry the same gentle rise. Neither
 * pane is ranked above the other.
 */
import { TAU, clamp, easeOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, orb, panel, pool, ring, trace, type Panel } from "../kit";

const FLOOR = -1.3;
/** pane size, how far each is turned in toward the other, and where it stands (+/- PX across, PZ back) */
const W = 1.5;
const H = 1.46;
const YAW = 0.52;
const PX = 0.92;
const PZ = 0.42;
/** the rail each pane stands in: its height and half its depth */
const FOOT = 0.1;
const DEPTH = 0.075;
/** the core stands where the two panes face: REACH in front of each, square to both */
const REACH = PX / Math.sin(YAW);
const CORE: V3 = [0, FLOOR, PZ - REACH * Math.cos(YAW)];
const PLINTH = 0.21;
const PLINTH_H = 0.1;
const BALL = 0.135;

type Bar = { o: number; c: number; h: number; l: number };
type State = { bars: Bar[]; area: number[]; routes: V3[][] };
type Stand = (l: number, y: number, d?: number) => V3;

/** a point on a standing plane: `l` along it, `y` up, `d` out of its face toward the viewer */
const stand = (cx: number, cz: number, yaw: number): Stand => {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return (l, y, d = 0) => [cx + l * c - d * s, y, cz - l * s - d * c];
};

/** a quad of light that dies away from its first edge (points 0-1) to its far edge (points 2-3) */
function fade(f: Frame, q: readonly V3[], colour: string, alpha: number): void {
  const a = f.P(...q[0]);
  const b = f.P(...q[1]);
  const c = f.P(...q[2]);
  const d = f.P(...q[3]);
  if (!a || !b || !c || !d || alpha <= 0.003) return;
  const { ctx } = f;
  const g = ctx.createLinearGradient((a.x + b.x) / 2, (a.y + b.y) / 2, (c.x + d.x) / 2, (c.y + d.y) / 2);
  g.addColorStop(0, rgba(colour, alpha));
  g.addColorStop(0.45, rgba(colour, alpha * 0.3));
  g.addColorStop(1, rgba(colour, 0));
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
}

/** the machined rail a pane stands in; the slot the glass sits in leaks the pane's light */
function rail(f: Frame, at: Stand, outer: number, colour: string, lit: number): void {
  const { pal } = f;
  const a = f.boot;
  const l0 = -W / 2 - 0.05;
  const l1 = W / 2 + 0.05;
  const y1 = FLOOR + FOOT;
  const lo = outer < 0 ? l0 : l1;
  const cap: V3[] = [at(lo, FLOOR, -DEPTH), at(lo, FLOOR, DEPTH), at(lo, y1, DEPTH), at(lo, y1, -DEPTH)];
  const top: V3[] = [at(l0, y1, -DEPTH), at(l1, y1, -DEPTH), at(l1, y1, DEPTH), at(l0, y1, DEPTH)];
  const front: V3[] = [at(l0, FLOOR, DEPTH), at(l1, FLOOR, DEPTH), at(l1, y1, DEPTH), at(l0, y1, DEPTH)];
  f.fill(cap, pal.bg, 0.92 * a);
  f.path(cap, pal.ink, 0.16 * a, 1, true);
  f.fill(top, pal.bg, 0.9 * a);
  f.fill(top, pal.ink, 0.11 * a);
  f.fill(front, pal.bg, 0.94 * a);
  f.fill(front, pal.ink, 0.045 * a);
  f.path(front, pal.ink, 0.18 * a, 1, true);
  f.path(top, pal.ink, 0.2 * a, 1, true);
  // the chamfer along the front catches the light
  f.line(at(l0, y1, DEPTH), at(l1, y1, DEPTH), pal.ink, 0.42 * a, 1);
  f.line(at(-W / 2, y1, 0), at(W / 2, y1, 0), colour, 0.8 * lit, 1.5);
}

/** METATRADER 5: one chart on a dotted grid, graduated scales with no figures on them */
function terminal(f: Frame, p: Panel, bars: Bar[], colour: string, k: number): void {
  const { pal, ctx } = f;
  const a = p.on;
  const u0 = 0.05;
  const u1 = 0.88;
  const v0 = 0.15;
  const v1 = 0.82;
  const cols = f.mobile ? 4 : 6;
  const u = (x: number) => lerp(u0, u1, x);
  const v = (x: number) => lerp(v0, v1, x);
  ctx.save();
  ctx.setLineDash([1, 4]);
  for (let i = 1; i < cols; i++) f.line(p.at(u(i / cols), v0), p.at(u(i / cols), v1), pal.ink, 0.34 * a, 1);
  for (let i = 1; i < 4; i++) f.line(p.at(u0, v(i / 4)), p.at(u1, v(i / 4)), pal.ink, 0.34 * a, 1);
  ctx.restore();
  f.path([p.at(u0, v0), p.at(u1, v0), p.at(u1, v1), p.at(u0, v1)], pal.ink, 0.2 * a, 1, true);
  if (!f.mobile) {
    for (let i = 0; i <= 12; i++) f.line(p.at(u1, v(i / 12)), p.at(u1 + (i % 3 ? 0.014 : 0.03), v(i / 12)), pal.ink, 0.3 * a, 1);
    for (let i = 0; i <= cols; i++) f.line(p.at(u(i / cols), v0), p.at(u(i / cols), v0 - 0.025), pal.ink, 0.3 * a, 1);
    // the toolbox tabs along the foot of the terminal
    for (let i = 0; i < 3; i++) f.line(p.at(0.05 + i * 0.14, 0.06), p.at(0.15 + i * 0.14, 0.06), i ? pal.ink : colour, (i ? 0.28 : 0.6) * a * k, 1.5);
  }
  const n = bars.length;
  const drawn = k * n;
  const step = (u1 - u0 - 0.04) / n;
  const y = (x: number) => lerp(v0 + 0.06, v1 - 0.06, x);
  const avg: V3[] = [];
  let m = bars[0].o;
  for (let i = 0; i < n && i < drawn; i++) {
    const b = bars[i];
    const x = u0 + 0.02 + (i + 0.5) * step;
    const al = a * clamp(drawn - i);
    const up = b.c >= b.o;
    f.line(p.at(x, y(b.l)), p.at(x, y(b.h)), up ? pal.ink : colour, 0.5 * al, 1);
    f.line(p.at(x, y(b.o)), p.at(x, y(b.c)), up ? pal.ink : colour, (up ? 0.85 : 0.9) * al, f.mobile ? 2 : 3.5);
    m += (b.c - m) * 0.28;
    avg.push(p.at(x, y(m), 0.02));
  }
  // an average floats just off the glass
  if (avg.length > 2) f.path(avg, colour, 0.75 * a, 1.5);
  // the level line every terminal draws at the last bar, with its marker in the scale
  const last = y(bars[n - 1].c);
  const lv = a * clamp(drawn - n + 1);
  f.line(p.at(u0, last), p.at(u1, last), pal.ink, 0.22 * lv, 1);
  f.fill([p.at(u1, last - 0.018), p.at(u1 + 0.07, last - 0.018), p.at(u1 + 0.07, last + 0.018), p.at(u1, last + 0.018)], colour, 0.55 * lv);
}

/** the four modules of the workspace, in the pane's own 0..1 space: u0, v0, u1, v1 */
const MODULES = [[0.05, 0.46, 0.6, 0.83], [0.64, 0.46, 0.95, 0.83], [0.05, 0.07, 0.4, 0.42], [0.44, 0.07, 0.95, 0.42]] as const;
const LIST = [0.9, 0.5, 0.72, 0.38];
const COLUMNS = [0.35, 0.6, 0.48, 0.82, 0.66, 0.95, 0.55];
const LADDER = [0.3, 0.52, 0.78, 0.6, 0.36];

/** 777 RAPTOR: a modular workspace, four small panes floating just off the glass, lit one after another */
function workspace(f: Frame, p: Panel, area: number[], colour: string, start: number): void {
  const { pal } = f;
  const thick = f.mobile ? 1.5 : 2;
  MODULES.forEach((m, i) => {
    const on = p.on * easeOut((f.boot - start - i * 0.06) / 0.2);
    if (on <= 0.003) return;
    const q = (a: number, b: number): V3 => p.at(lerp(m[0], m[2], a), lerp(m[1], m[3], b), 0.05 * on);
    const quad: V3[] = [q(0, 0), q(1, 0), q(1, 1), q(0, 1)];
    f.fill(quad, pal.bg, 0.62 * on);
    f.fill(quad, pal.ink, 0.05 * on);
    f.path(quad, pal.ink, 0.2 * on, 1, true);
    f.line(q(0, 1), q(1, 1), colour, 0.7 * on, 1.25);
    if (i === 0) {
      // a small chart: one line over its own shade
      const line: V3[] = area.map((v, j) => q(0.06 + (0.88 * j) / (area.length - 1), 0.14 + 0.66 * v));
      f.fill([q(0.06, 0.08), ...line, q(0.94, 0.08)], colour, 0.1 * on);
      f.path(line, colour, 0.9 * on, 1.5);
    } else if (i === 1) {
      // a list
      LIST.forEach((w, j) => {
        const v = 0.78 - j * 0.2;
        f.dot(q(0.1, v), 0.012, colour, 0.9 * on);
        f.line(q(0.2, v), q(0.42, v), pal.ink, 0.5 * on, thick);
        f.line(q(0.52, v), q(0.52 + w * 0.4, v), colour, 0.7 * on, thick);
      });
    } else if (i === 2) {
      // columns
      COLUMNS.forEach((h, j) => f.line(q(0.14 + j * 0.12, 0.16), q(0.14 + j * 0.12, 0.16 + 0.62 * h), j === 5 ? pal.ink : colour, (j === 5 ? 0.8 : 0.6) * on, thick + 1));
    } else {
      // a ladder about its centre line
      f.line(q(0.5, 0.12), q(0.5, 0.86), pal.ink, 0.16 * on, 1);
      LADDER.forEach((w, j) => {
        const v = 0.78 - j * 0.15;
        f.line(q(0.47, v), q(0.47 - w * 0.36, v), colour, 0.7 * on, thick);
        f.line(q(0.53, v), q(0.53 + LADDER[4 - j] * 0.36, v), pal.ink, 0.45 * on, thick);
      });
    }
  });
}

/** the core's plinth: a low machined cylinder with a graduated top */
function plinth(f: Frame, on: number): void {
  const { pal } = f;
  const n = Math.round(32 * f.q);
  const yt = FLOOR + PLINTH_H;
  const rim = (y: number, from: number, to: number): V3[] => {
    const out: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(from, to, i / n) * TAU;
      out.push([CORE[0] + Math.cos(a) * PLINTH, y, CORE[2] + Math.sin(a) * PLINTH]);
    }
    return out;
  };
  const foot = rim(FLOOR, 0.5, 1);
  const face = [...foot, ...rim(yt, 1, 0.5)];
  const top = rim(yt, 0, 1);
  f.fill(face, pal.bg, 0.94 * on);
  f.fill(face, pal.ink, 0.05 * on);
  f.fill(top, pal.bg, 0.9 * on);
  f.fill(top, pal.ink, 0.1 * on);
  f.path(foot, pal.ink, 0.22 * on, 1);
  f.path(top, pal.ink, 0.42 * on, 1);
  ring(f, [CORE[0], yt, CORE[2]], PLINTH * 0.86, { colour: pal.gold, alpha: 0.5 * on, ticks: 36, major: 3, tickLen: 0.03 });
}

const scene: Scene<State> = {
  pose: 13,
  setup(f) {
    // a fixed, schematic series stretched to fill its frame: a drawing of a chart, not a market
    const raw: Bar[] = [];
    const n = f.mobile ? 15 : 24;
    const shape = (t: number) => 0.2 + 0.5 * t + 0.17 * Math.sin(TAU * 1.25 * t + 0.5 + f.rnd(3));
    let lo = 1;
    let hi = 0;
    let v = shape(0);
    for (let i = 0; i < n; i++) {
      const c = shape((i + 1) / n) + (f.rnd(i) - 0.5) * 0.08;
      const b = { o: v, c, h: Math.max(v, c) + f.rnd(i + 60) * 0.05, l: Math.min(v, c) - f.rnd(i + 120) * 0.05 };
      lo = Math.min(lo, b.l);
      hi = Math.max(hi, b.h);
      raw.push(b);
      v = c;
    }
    const fit = (x: number) => (x - lo) / (hi - lo);
    const bars = raw.map((b) => ({ o: fit(b.o), c: fit(b.c), h: fit(b.h), l: fit(b.l) }));
    const area: number[] = [];
    for (let i = 0; i < 18; i++) area.push(clamp(0.3 + i * 0.028 + Math.sin(i * 0.7 + f.rnd(7) * 3) * 0.16 + Math.sin(i * 1.9) * 0.05));
    // the inlaid trace from the plinth to each rail, in equal steps so its pulse travels at one speed
    const steps = f.mobile ? 24 : 44;
    const routes = [-1, 1].map((side) => {
      const at = stand(side * PX, PZ, side * YAW);
      const pts: V3[] = [];
      for (let i = 0; i <= steps; i++) pts.push(at(0, FLOOR, lerp(REACH - PLINTH, DEPTH + 0.02, i / steps)));
      return pts;
    });
    return { bars, area, routes };
  },
  draw(f, s) {
    const { pal } = f;
    // the eye is a little above the glass, as it is when standing at a desk instrument
    const zoom = f.mobile ? 0.7 : Math.min(0.88, (0.52 * f.w) / (3.3 * f.u));
    f.aim(-0.07 + Math.sin(f.t * 0.09) * 0.04, -0.1, 6.4, zoom);
    // the instrument is wide and stands on the deck: keep it clear of the headline, and lift the frame to its middle
    f.cx = f.mobile ? f.w * 0.5 : Math.min(f.w * 0.715, f.w - 24 - 1.65 * f.u * zoom);
    f.cy -= (f.mobile ? 1.12 : 0.72) * f.u * f.cam.zoom;

    const second = pal.key === pal.blue ? pal.teal : pal.blue;
    // idle: the account addresses one platform, then the other, on a slow 18 second round
    const phase = f.still ? 0 : (f.t / 18) % 1;
    const lead = f.still ? 0.7 : 0.5 + 0.5 * Math.cos(TAU * (phase - 0.55));
    const turn = [lead, f.still ? 0.7 : 1 - lead];
    const coreOn = f.on(0, 0.3);
    const paneOn = [f.on(0.25, 0.4), f.on(0.7, 0.4)];

    // the deck is still: the rails and the plinth stand on it
    deck(f, { y: FLOOR, alpha: 0.1, drift: 0 });
    pool(f, [0, FLOOR, 0.2], 2.6, pal.key, 0.2 * f.boot);
    // both rails are tangent to one graduated circle struck from the core: the two screens face a single point
    ring(f, CORE, REACH - DEPTH - 0.02, { colour: pal.ink, alpha: 0.2 * coreOn, from: 0.09, to: 0.41, ticks: f.mobile ? 0 : 32, major: 4, tickLen: 0.05 });

    const panes: Panel[] = [];
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const colour = i ? second : pal.key;
      const at = stand(side * PX, PZ, side * YAW);
      const lit = paneOn[i] * (0.55 + 0.45 * turn[i]);
      // each screen throws its own light onto the deck in front of it
      pool(f, at(0, FLOOR, 0.3), 1.0, colour, 0.17 * lit);

      // the trace runs in a channel in the deck, and arrives before the glass lights
      const wire = easeOut((f.boot - (i ? 0.36 : 0.08)) / 0.25);
      const pts = s.routes[i];
      const span = i ? phase - 0.5 : phase;
      for (const l of [-0.045, 0.045]) f.line(at(l, FLOOR, REACH - PLINTH * 0.9), at(l, FLOOR, DEPTH), pal.ink, 0.13 * f.boot, 1);
      if (wire > 0) trace(f, wire >= 1 ? pts : pts.slice(0, 2 + Math.floor((pts.length - 2) * wire)), pal.gold, 0.7 * coreOn, 1.25, f.boot >= 1 && span >= 0 && span < 0.45 ? span / 0.45 : -1);

      const p = panel(f, [side * PX, FLOOR + FOOT - 0.02 + H / 2, PZ], W, H, { yaw: side * YAW, on: paneOn[i], colour, alpha: 0.4 + 0.3 * turn[i], glass: 0.04, header: true });
      panes.push(p);
      // the glass has thickness: its top face and outer edge carry the light
      f.fill([p.at(0, 1), p.at(1, 1), p.at(1, 1, -0.035), p.at(0, 1, -0.035)], colour, 0.34 * lit);
      f.line(p.at(i, 0.82), p.at(i, 0.02), colour, 0.22 * lit, 1);
      // light enters the glass from the rail and dies away up the pane
      fade(f, [at(-W / 2, FLOOR + FOOT, 0), at(W / 2, FLOOR + FOOT, 0), at(W / 2, FLOOR + FOOT + 0.5, 0), at(-W / 2, FLOOR + FOOT + 0.5, 0)], colour, 0.13 * lit);
      if (p.on > 0) {
        if (i) workspace(f, p, s.area, colour, 0.62);
        else terminal(f, p, s.bars, colour, easeOut((f.boot - 0.36) / 0.4));
      }
      rail(f, at, side, colour, lit);
      // where the account comes in: a port on the face of the rail
      const port = at(0, FLOOR + FOOT * 0.5, DEPTH);
      f.dot(port, 0.022, pal.gold, (0.6 + 0.3 * turn[i]) * wire * coreOn);
      f.dot(port, 0.009, pal.ink, 0.8 * wire * coreOn);
    }

    // lettering: each platform named along the top edge of its own glass
    const size = f.mobile ? 8.5 : 10.5;
    f.label("METATRADER 5", panes[0].at(0.05, 0.94), { size, colour: pal.ink, alpha: 0.85 * panes[0].on });
    f.label("777 RAPTOR", panes[1].at(0.05, 0.94), { size, colour: pal.ink, alpha: 0.85 * panes[1].on });

    // the core: one account, in front of both
    const breathe = f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.9);
    const c: V3 = [CORE[0], FLOOR + PLINTH_H + BALL * 0.92, CORE[2]];
    pool(f, CORE, 0.8, pal.gold, 0.16 * coreOn);
    plinth(f, coreOn);
    orb(f, c, BALL, pal.gold, coreOn);
    f.dot(c, 0.045, pal.gold, 0.22 * coreOn * breathe);
    f.dot(c, 0.022, pal.gold, 0.9 * coreOn * breathe);
    f.dot(c, 0.008, pal.ink, 0.9 * coreOn * breathe);
    f.label("GIO4X", [CORE[0], FLOOR + PLINTH_H * 0.5, CORE[2] - PLINTH], { align: "center", size: f.mobile ? 8 : 10, weight: 700, colour: pal.gold, alpha: 0.9 * coreOn });
  },
};

export default scene;
