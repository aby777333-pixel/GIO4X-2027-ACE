/**
 * COMPARE — the precision balance.
 *
 * Two panes of glass hang from one beam like the pans of a balance: MT5 on the
 * left, RAPTOR on the right. Behind them stands the comparison matrix as a
 * ladder of rules, read one row at a time, alternately from the left and from
 * the right. A dot is a row that is stated for that platform; an open ring is
 * a row that is not yet published.
 *
 * The two columns are not equally full, and the beam does not care: it rests
 * exactly level and the needle stays on the centre mark, because the page
 * gives no verdict. Nothing here is a score, a count or a measurement.
 */
import { clamp, easeOut, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, panel, pool, ring, trace } from "../kit";

/**
 * The matrix on the page, row for row: 1 = stated, 0 = not yet published.
 * (Thirteen rows; the last one is open on both sides.)
 */
const MT5 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0];
const RAPTOR = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0];
const ROWS = MT5.length;

const FLOOR = -1.3;
/** the pivot: the beam's centreline */
const YB = 0.62;
/** half the beam */
const L = 1.1;
/** the matrix stands behind the balance */
const ZL = 0.55;
const ROW0 = 0.14;
const STEP = 0.066;
const COL = 0.44;
const REACH = 1.58;
/** the graduated limb above the pivot */
const LIMB = 0.56;
const SPAN = 0.52;

type Tick = { a: V3; b: V3; major: boolean };
type State = { outer: V3[]; inner: V3[]; fan: V3[]; ticks: Tick[]; rider: Tick[]; lead: number; start: number; phase: number };

const onLimb = (a: number, r: number): V3 => [Math.sin(a) * r, YB + Math.cos(a) * r, 0];

/** a polished rod standing on the axis: cylinder shading across its width, lit from the left */
function rod(f: Frame, y0: number, y1: number, r: number, level: number): void {
  const a = f.P(-r, y0, 0);
  const b = f.P(r, y0, 0);
  const c = f.P(r, y1, 0);
  const d = f.P(-r, y1, 0);
  if (!a || !b || !c || !d || level <= 0.003) return;
  const { ctx, pal } = f;
  const g = ctx.createLinearGradient(a.x, 0, b.x, 0);
  g.addColorStop(0, rgba(pal.key, 0.8 * level));
  g.addColorStop(0.22, rgba(pal.ink, 0.3 * level));
  g.addColorStop(0.6, rgba(pal.bg, 0.95 * level));
  g.addColorStop(1, rgba(pal.ink, 0.22 * level));
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = rgba(pal.bg, 0.9 * level);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.fill();
}

/** a machined slab on the axis: only the faces the viewer can see, so it reads as solid metal */
function slab(f: Frame, hx: number, y0: number, y1: number, hz: number, level: number, lid = true): void {
  if (level <= 0.003) return;
  const { pal } = f;
  if (lid) {
    const top: V3[] = [[-hx, y1, -hz], [hx, y1, -hz], [hx, y1, hz], [-hx, y1, hz]];
    f.fill(top, pal.bg, 0.92 * level);
    f.fill(top, pal.ink, 0.06 * level);
    f.path(top, pal.ink, 0.2 * level, 1, true);
  }
  const front: V3[] = [[-hx, y0, -hz], [hx, y0, -hz], [hx, y1, -hz], [-hx, y1, -hz]];
  f.fill(front, pal.bg, 0.92 * level);
  f.fill(front, pal.ink, 0.15 * level);
  f.path(front, pal.ink, 0.36 * level, 1, true);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const outer: V3[] = [];
    const inner: V3[] = [];
    const seg = f.mobile ? 14 : 24;
    for (let i = 0; i <= seg; i++) {
      const a = -SPAN + (2 * SPAN * i) / seg;
      outer.push(onLimb(a, LIMB));
      inner.push(onLimb(a, LIMB - 0.06));
    }
    const ticks: Tick[] = [];
    const n = f.mobile ? 5 : 10;
    for (let i = -n; i <= n; i++) {
      if (i === 0) continue;
      const major = i % 5 === 0;
      const a = (SPAN * 0.94 * i) / n;
      ticks.push({ a: onLimb(a, LIMB), b: onLimb(a, LIMB - (major ? 0.06 : 0.032)), major });
    }
    // the beam's own graduations, the same on both arms
    const rider: Tick[] = [];
    const m = f.mobile ? 6 : 12;
    for (let i = 1; i < m; i++) {
      for (const side of [-1, 1]) {
        const x = side * (0.16 + ((L - 0.24) * i) / m);
        const major = i % 4 === 0;
        rider.push({ a: [x, YB + 0.024, -0.03], b: [x, YB + 0.024 - (major ? 0.03 : 0.016), -0.03], major });
      }
    }
    // per page: which side the first row is read from, where the reading starts, the phase of the sway
    return { outer, inner, fan: [[0, YB, 0], ...outer], ticks, rider, lead: f.rnd(3) < 0.5 ? 0 : 1, start: Math.floor(f.rnd(5) * ROWS), phase: f.rnd(7) * 6 };
  },
  draw(f, s) {
    const { pal } = f;
    // seen square on, so that level reads as level; the pointer may only lean it a little
    f.cam.parallax = 0.55;
    // the balance is wide: on narrower desktops it draws in, so the left pan never reaches the headline
    f.aim(f.still ? 0 : Math.sin(f.t * 0.09 + s.phase) * 0.03, 0.07, 6.4, f.mobile ? 0.7 : Math.min(0.9, (0.24 * f.w) / (1.47 * f.u)));
    if (f.mobile) {
      f.cx = f.w * 0.5;
      f.cy -= f.h * 0.1;
    } else f.cx += f.w * 0.02;

    // power-on: the beam runs out from the pivot, then both pans are hung at the same moment
    const reach = L * f.on(0.2, 0.4);
    const hung = f.on(0.55, 0.42) * clamp(reach / L);

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [0, FLOOR, 0], 2.5, pal.key, 0.2 * f.boot);
    for (const side of [-1, 1]) pool(f, [side * L, FLOOR, 0], 0.8, pal.key, 0.1 * hung);
    if (!f.mobile && f.q > 0.6) ring(f, [0, FLOOR, 0], 0.95, { axis: "y", colour: pal.ink, alpha: 0.16 * f.boot, ticks: 48, major: 4, tickLen: 0.05 });

    // ── the matrix: a ladder of rules behind the balance, read one row at a time
    const read = (f.still ? 0.4 : f.t / 5) + s.start;
    const reading = Math.floor(read) % ROWS;
    const ph = read % 1;
    const env = f.boot < 1 ? 0 : f.still ? 1 : Math.pow(Math.sin(Math.PI * ph), 0.7);
    for (const side of [-1, 1]) f.line([side * COL, ROW0 + 0.05, ZL], [side * COL, ROW0 - (ROWS - 1) * STEP - 0.05, ZL], pal.ink, 0.1 * f.on(0.3), 1);
    for (let i = 0; i < ROWS; i++) {
      const on = easeOut((f.boot - 0.3 - i * 0.035) / 0.22);
      if (on <= 0) continue;
      const y = ROW0 - i * STEP;
      // rows are drawn in, and later read, alternately from the left and from the right
      const dir = (i + s.lead) % 2 === 0 ? 1 : -1;
      const active = i === reading ? env : 0;
      const from: V3 = [-dir * REACH, y, ZL];
      const to: V3 = [-dir * REACH + dir * 2 * REACH * on, y, ZL];
      f.line(from, to, pal.ink, 0.13, 1);
      if (active > 0.01) trace(f, [from, to], pal.key, 0.55 * active, 1.1, 0.2 + ph * 0.6);
      for (const side of [-1, 1]) {
        const reached = clamp(on * 2.6 - (side === -dir ? 0.6 : 1.5));
        if (reached <= 0) continue;
        const p: V3 = [side * COL, y, ZL];
        const a = (0.55 + 0.4 * active) * reached;
        if ((side < 0 ? MT5 : RAPTOR)[i]) f.dot(p, 0.015, pal.ink, a);
        else ring(f, p, 0.019, { axis: "z", colour: pal.ink, alpha: a * 0.9, seg: 14 });
      }
    }

    // ── plinth and pillar: machined, standing on the deck
    const base = f.on(0, 0.3);
    slab(f, 0.5, FLOOR, FLOOR + 0.06, 0.3, base);
    // the plumb mark on the plinth answers the centre mark on the limb
    f.line([0, FLOOR + 0.06, -0.3], [0, FLOOR + 0.012, -0.3], pal.gold, 0.8 * base, 1.5);
    slab(f, 0.3, FLOOR + 0.06, FLOOR + 0.12, 0.19, base);
    f.line([-0.3, FLOOR + 0.12, -0.19], [0.3, FLOOR + 0.12, -0.19], pal.key, 0.6 * base, 1.25);
    slab(f, 0.085, FLOOR + 0.12, FLOOR + 0.2, 0.085, base);
    const y0 = FLOOR + 0.2;
    const y1 = y0 + (YB - 0.13 - y0) * easeOut(f.boot / 0.4);
    rod(f, y0, y1, 0.04, base);
    slab(f, 0.072, y1, y1 + 0.035, 0.06, base, false);

    // ── the limb: a graduated arc of glass above the pivot
    const limb = f.on(0.35, 0.35);
    const pivot: V3 = [0, YB, 0];
    if (limb > 0) {
      f.fill(s.fan, pal.bg, 0.55 * limb);
      f.fill(s.fan, pal.ink, 0.035 * limb);
      f.line(pivot, s.outer[0], pal.ink, 0.14 * limb, 1);
      f.line(pivot, s.outer[s.outer.length - 1], pal.ink, 0.14 * limb, 1);
      f.path(s.inner, pal.ink, 0.16 * limb, 1);
      for (const k of s.ticks) f.line(k.a, k.b, pal.ink, (k.major ? 0.6 : 0.3) * limb, 1);
      trace(f, s.outer, pal.key, 0.6 * limb, 1.25);
      // the centre index: the only reading this instrument ever gives
      f.fill([[-0.024, YB + LIMB + 0.075, 0], [0.024, YB + LIMB + 0.075, 0], [0, YB + LIMB + 0.018, 0]], pal.gold, 0.9 * limb);
    }

    // ── the beam: one level bar, deeper at the pivot, lit along its top edge
    const top = YB + 0.024;
    if (reach > 0.02) {
      const k = Math.min(0.18, reach);
      const face: V3[] = [[-reach, top, -0.03], [reach, top, -0.03], [reach, YB - 0.014, -0.03], [k, YB - 0.06, -0.03], [-k, YB - 0.06, -0.03], [-reach, YB - 0.014, -0.03]];
      // the knife edge the beam rests on
      f.fill([[-0.045, YB - 0.095, -0.03], [0.045, YB - 0.095, -0.03], [0, YB - 0.05, -0.03]], pal.key, 0.5 * base);
      f.fill(face, pal.bg, 0.85);
      f.fill(face, pal.ink, 0.12);
      f.path(face, pal.ink, 0.32, 1, true);
      const cut = f.on(0.55);
      if (cut > 0 && f.q > 0.6) for (const g of s.rider) f.line(g.a, g.b, pal.ink, (g.major ? 0.46 : 0.26) * cut, 1);
      trace(f, [[-reach, top, -0.03], [reach, top, -0.03]], pal.key, 0.8, 1.5);
    }

    // ── the needle: dead centre, and it stays there
    const needle = f.on(0.5, 0.4);
    if (needle > 0) {
      trace(f, [[0, YB, -0.03], [0, YB + (LIMB - 0.008) * needle, -0.03]], pal.gold, 0.95, 1.6);
      lamp(f, [0, YB, -0.03], pal.gold, needle * (f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.9)), 0.021);
    }

    // ── the pans: two panes of glass on fine wires, lettered and otherwise clear
    for (const side of [-1, 1]) {
      const x = side * L;
      const pane = panel(f, [x, YB - 0.78, 0], 0.74, 1.04, { yaw: side * 0.26, on: hung, colour: pal.key, alpha: 0.62 });
      if (pane.on <= 0.003) continue;
      const hook: V3 = [x, YB - 0.11, 0];
      f.line([x, YB - 0.014, 0], hook, pal.ink, 0.5 * hung, 1.25);
      f.line(hook, pane.at(0.07, 1), pal.ink, 0.4 * hung, 1);
      f.line(hook, pane.at(0.93, 1), pal.ink, 0.4 * hung, 1);
      f.dot(hook, 0.014, pal.ink, 0.75 * hung);
      f.dot(pane.at(0.07, 1), 0.01, pal.ink, 0.6 * hung);
      f.dot(pane.at(0.93, 1), 0.01, pal.ink, 0.6 * hung);
      lamp(f, [x, top, -0.03], pal.key, 0.8 * hung, 0.015);
      // a bevel inside the edge gives the glass its thickness
      f.path([pane.at(0.04, 0.025), pane.at(0.96, 0.025), pane.at(0.96, 0.975), pane.at(0.04, 0.975)], pal.ink, 0.07 * hung, 1, true);
      f.line(pane.at(0.1, 0.83), pane.at(0.9, 0.83), pal.ink, 0.16 * hung, 1);
      f.line(pane.at(0.02, 0), pane.at(0.98, 0), pal.key, 0.24 * hung, 1);
      f.label(side < 0 ? "MT5" : "RAPTOR", pane.at(0.5, 0.905), { align: "center", size: f.mobile ? 10 : 11, colour: pal.ink, alpha: 0.9 * hung });
    }
  },
};

export default scene;
