/**
 * ATLAS — the chart table.
 *
 * The directory of the whole site, as a chart lying on a table and seen from
 * above: a sheet with a faint graticule and a graduated neatline, a compass
 * rose, and six raised islands cut in relief, one for each section the page
 * lists (Markets, Trading, Platforms, Intelligence, Academy, Company). A fine
 * course runs through them in the order the page gives them, and a brass
 * parallel rule rests on the sheet.
 *
 * The pointer plots a course. A route is drawn across the chart from the
 * island nearest the cursor to the cursor itself; that island rises out of the
 * sheet, its contours part and its summit lights in champagne; and the rule
 * swings round and opens to lie along the route. Take the pointer away and the
 * rule goes back to its place.
 *
 * Nothing here is a distance, a bearing or a count: it is a list of sections,
 * drawn as places.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Pt, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, ring, trace } from "../kit";

/** the page's six sections, in the page's order: name, place on the sheet (x, z), size */
const SITES: [string, number, number, number][] = [
  ["MARKETS", -1.0, 0.5, 0.27],
  ["TRADING", -0.2, 0.66, 0.23],
  ["PLATFORMS", 0.74, 0.5, 0.26],
  ["INTELLIGENCE", 0.98, -0.42, 0.23],
  ["ACADEMY", 0.1, -0.62, 0.25],
  ["COMPANY", -0.84, -0.44, 0.22],
];
const FLOOR = -1.05;
/** table top, the sheet lying on it, and their half-extents */
const TY = 0.13;
const SY = TY + 0.012;
const TX = 1.66;
const TZ = 1.2;
const HX = 1.46;
const HZ = 1.04;
/** the rule: where it rests, its length, the width of one bar, the length of its links */
const HOME: [number, number, number] = [0.3, -0.03, 0.42];
const LEN = 0.84;
const BAR = 0.062;
const ARM = 0.21;
const ROSE: V3 = [-0.36, SY, 0.02];

type Island = { name: string; x: number; z: number; r: number; layers: [number, number][][] };
type State = { isles: Island[]; order: number[]; lift: number[]; rule: [number, number, number]; open: number; course: V3[] };

/** where the pointer's ray meets the level plane y = h: the engine's projection, run backwards */
function onPlane(f: Frame, h: number): [number, number] | null {
  const { yaw, pitch, dist, zoom } = f.cam;
  const k = dist * zoom * f.u;
  const a = (f.mx - f.cx) / k;
  const b = (f.cy - f.my) / k;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const den = b * cp + sp;
  if (Math.abs(den) < 1e-3) return null;
  const z2 = (h + dist * sp) / den;
  if (z2 < 0.5) return null;
  const x1 = a * z2;
  const z1 = -b * z2 * sp + (z2 - dist) * cp;
  return [x1 * Math.cos(yaw) - z1 * Math.sin(yaw), x1 * Math.sin(yaw) + z1 * Math.cos(yaw)];
}

/** a flat plate on the table: a dark body, a tint, an edge */
function plate(f: Frame, quad: readonly V3[], colour: string, tint: number, edge: number, on: number): void {
  f.fill(quad, f.pal.bg, 0.94 * on);
  f.fill(quad, colour, tint * on);
  f.path(quad, colour, edge * on, 1, true);
}

/** one contour of an island: the walls that face the viewer, then its level top */
function contour(f: Frame, c: Island, shape: readonly [number, number][], y0: number, y1: number, tone: number, lit: number, on: number): void {
  const { ctx, pal } = f;
  const lo: (Pt | null)[] = shape.map((p) => f.P(c.x + p[0], y0, c.z + p[1]));
  const top: V3[] = shape.map((p) => [c.x + p[0], y1, c.z + p[1]]);
  const hi = top.map((p) => f.P(p[0], p[1], p[2]));
  ctx.beginPath();
  for (let i = 0; i < shape.length; i++) {
    const j = (i + 1) % shape.length;
    const a = lo[i];
    const b = lo[j];
    const d = hi[i];
    const e = hi[j];
    if (!a || !b || !d || !e) continue;
    // the far walls are hidden by the top that is drawn next
    if ((b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x) >= 0) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(e.x, e.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
  }
  ctx.fillStyle = rgba(pal.bg, 0.96 * on);
  ctx.fill();
  ctx.fillStyle = rgba(pal.key, 0.1 * on);
  ctx.fill();
  if (lit > 0.01) {
    ctx.fillStyle = rgba(pal.gold, 0.2 * lit * on);
    ctx.fill();
  }
  f.fill(top, pal.bg, 0.96 * on);
  f.fill(top, pal.ink, tone * (1 - lit * 0.6) * on);
  f.fill(top, pal.gold, tone * 2.2 * lit * on);
  f.path(top, pal.ink, (0.4 + tone) * (1 - lit) * on, 1, true);
  f.path(top, pal.gold, 0.95 * lit * on, 1.25, true);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = f.mobile ? 10 : 12;
    const isles = SITES.map(([name, x, z, r], i): Island => {
      // a coastline: a ring of radii, each eased towards its neighbours so that no cape is a spike
      const raw: number[] = [];
      for (let k = 0; k < n; k++) raw.push(0.72 + 0.5 * f.rnd(i * 31 + k));
      const coast = raw.map((v, k) => (raw[(k + n - 1) % n] + 2 * v + raw[(k + 1) % n]) / 4);
      const lean = f.rnd(i * 7 + 3) * TAU;
      const layers = [1, 0.66, 0.34].map((scale, l) =>
        coast.map((v, k): [number, number] => {
          const a = (k / n) * TAU;
          const rad = r * scale * (l ? lerp(1, v, 0.7) : v);
          return [Math.cos(a) * rad * 1.12 + Math.cos(lean) * r * 0.1 * l, Math.sin(a) * rad * 0.9 + Math.sin(lean) * r * 0.1 * l];
        }),
      );
      return { name, x, z, r, layers };
    });
    return { isles, order: isles.map((_, i) => i), lift: isles.map(() => 0), rule: [HOME[0], HOME[1], HOME[2]], open: 0, course: isles.map((c): V3 => [c.x, SY + 0.004, c.z]) };
  },
  draw(f, s) {
    const { ctx, pal } = f;
    // seen square on, as a chart is read: a table a degree off true only looks crooked
    const turn = 0;
    f.cam.parallax = 0.4;
    f.aim(turn + (f.still ? 0 : Math.sin(f.t * 0.06) * 0.018), -0.9, 6.6, f.mobile ? 0.96 : 1);
    const sy = Math.sin(f.cam.yaw);
    const cy = Math.cos(f.cam.yaw);

    // ── the pointer on the sheet, the island nearest to it, and where the rule should lie
    const hit = f.hover > 0.01 ? onPlane(f, SY) : null;
    const cur: [number, number] | null = hit ? [clamp(hit[0], -HX + 0.05, HX - 0.05), clamp(hit[1], -HZ + 0.05, HZ - 0.05)] : null;
    let nearest = -1;
    if (cur) {
      let best = 1e9;
      s.isles.forEach((c, i) => {
        const d = Math.hypot(c.x - cur[0], c.z - cur[1]);
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
    }
    const ease = f.still ? 1 : 1 - Math.exp(-f.dt * 5);
    s.lift.forEach((v, i) => (s.lift[i] = v + ((i === nearest ? f.hover : 0) - v) * ease));
    let goal = HOME;
    if (cur && nearest >= 0) {
      const c = s.isles[nearest];
      // it is laid on the route, towards the pointer's end of it, and kept on the sheet;
      // with the pointer on the island itself there is no bearing to take, so it stays where it lies
      const far = Math.hypot(cur[0] - c.x, cur[1] - c.z) > 0.16;
      goal = far ? [clamp(lerp(c.x, cur[0], 0.74), -HX + 0.36, HX - 0.36), clamp(lerp(c.z, cur[1], 0.74), -HZ + 0.3, HZ - 0.3), Math.atan2(cur[1] - c.z, cur[0] - c.x)] : s.rule;
    }
    // a rule is the same either way round: it turns through the smaller angle
    const swing = ((((goal[2] - s.rule[2] + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI) - Math.PI / 2;
    s.rule[0] += (goal[0] - s.rule[0]) * ease * 0.7;
    s.rule[1] += (goal[1] - s.rule[1]) * ease * 0.7;
    s.rule[2] += swing * ease * 0.7;
    s.open += ((cur ? f.hover : 0) - s.open) * ease;

    deck(f, { y: FLOOR, half: 4.5, alpha: 0.07, drift: 0 });
    pool(f, [0, FLOOR, 0], 3, pal.key, 0.16 * f.boot);

    // ── the table: four legs, then a slab with its near edge lit
    const tab = f.on(0, 0.3);
    for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) f.line([lx * (TX - 0.1), FLOOR, lz * (TZ - 0.1)], [lx * (TX - 0.1), TY - 0.07, lz * (TZ - 0.1)], pal.ink, 0.24 * tab, 4);
    const side = sy > 0 ? TX : -TX;
    plate(f, [[side, TY - 0.07, -TZ], [side, TY - 0.07, TZ], [side, TY, TZ], [side, TY, -TZ]], pal.ink, 0.05, 0.2, tab);
    plate(f, [[-TX, TY - 0.07, -TZ], [TX, TY - 0.07, -TZ], [TX, TY, -TZ], [-TX, TY, -TZ]], pal.ink, 0.1, 0.26, tab);
    plate(f, [[-TX, TY, -TZ], [TX, TY, -TZ], [TX, TY, TZ], [-TX, TY, TZ]], pal.ink, 0.035, 0.22, tab);
    f.line([-TX, TY, -TZ], [TX, TY, -TZ], pal.key, 0.6 * tab, 1.25);

    // ── the sheet: paper, a graticule, a graduated neatline, a compass rose
    const sheet = f.on(0.18, 0.3);
    const rim: V3[] = [[-HX, SY, -HZ], [HX, SY, -HZ], [HX, SY, HZ], [-HX, SY, HZ]];
    f.fill(rim, pal.bg, 0.6 * sheet);
    f.fill(rim, pal.ink, 0.06 * sheet);
    pool(f, [0, SY, 0], 1.5, pal.key, 0.13 * sheet);
    const step = f.mobile ? 0.48 : 0.32;
    for (let x = step / 2; x < HX - 0.08; x += step) for (const k of [-x, x]) f.line([k, SY, -HZ + 0.06], [k, SY, lerp(-HZ + 0.06, HZ - 0.06, sheet)], pal.ink, 0.085 * sheet);
    for (let z = step / 2; z < HZ - 0.08; z += step) for (const k of [-z, z]) f.line([-HX + 0.06, SY, k], [lerp(-HX + 0.06, HX - 0.06, sheet), SY, k], pal.ink, 0.085 * sheet);
    f.path(rim, pal.ink, 0.5 * sheet, 1, true);
    f.path([[-HX + 0.06, SY, -HZ + 0.06], [HX - 0.06, SY, -HZ + 0.06], [HX - 0.06, SY, HZ - 0.06], [-HX + 0.06, SY, HZ - 0.06]], pal.ink, 0.22 * sheet, 1, true);
    if (!f.mobile && f.q > 0.6) {
      // the neatline is graduated the way a chart's border is: alternate divisions filled
      for (let x = -HX + 0.06, i = 0; x < HX - 0.1; x += step / 2, i++) {
        if (i % 2) continue;
        const x1 = Math.min(x + step / 2, HX - 0.06);
        for (const z of [-HZ, HZ - 0.06]) f.fill([[x, SY, z], [x1, SY, z], [x1, SY, z + 0.06], [x, SY, z + 0.06]], pal.ink, 0.16 * sheet);
      }
    }
    const rose = f.on(0.4, 0.3);
    ring(f, ROSE, 0.21, { colour: pal.ink, alpha: 0.3 * rose, ticks: f.mobile ? 16 : 32, major: 4, tickLen: 0.03, seg: 40 });
    ring(f, ROSE, 0.13, { colour: pal.ink, alpha: 0.14 * rose, seg: 28 });
    for (let k = 0; k < 4; k++) {
      const a = (k * TAU) / 4;
      const tip: V3 = [ROSE[0] + Math.cos(a) * 0.26, SY, ROSE[2] + Math.sin(a) * 0.26];
      const wing = (d: number): V3 => [ROSE[0] + Math.cos(a + d) * 0.035, SY, ROSE[2] + Math.sin(a + d) * 0.035];
      // the point that looks up the sheet is the north point: it alone is champagne
      f.fill([tip, wing(TAU / 4), wing(-TAU / 4)], k === 1 ? pal.gold : pal.ink, (k === 1 ? 0.75 : 0.26) * rose);
    }

    // ── the course through the six sections, in the page's order
    const laid = f.on(0.75, 0.25);
    const legs = s.course.slice(0, Math.max(2, Math.round(1 + (s.course.length - 1) * laid)));
    ctx.setLineDash([2, 5]);
    f.path(legs, pal.ink, 0.42 * laid * (1 - 0.4 * s.open), 1);
    ctx.setLineDash([]);
    if (laid >= 1 && !f.still) trace(f, s.course, pal.key, 0.14, 1, f.t / 22);

    // ── the parallel rule: two brass bars on two links; it opens as it comes to the route
    const brass = f.on(0.9, 0.25);
    if (brass > 0.003) {
      const [rx, rz, ra] = s.rule;
      const ax = Math.cos(ra);
      const az = Math.sin(ra);
      const gap = lerp(0.03, 0.1, s.open);
      const shift = Math.sqrt(Math.max(0, ARM * ARM - (gap + BAR) * (gap + BAR)));
      const at = (along: number, across: number, y = SY + 0.022): V3 => [rx + ax * along - az * (across + 0.014), y, rz + az * along + ax * (across + 0.014)];
      const bar = (a0: number, c0: number, y?: number): V3[] => [at(a0, c0, y), at(a0 + LEN, c0, y), at(a0 + LEN, c0 + BAR, y), at(a0, c0 + BAR, y)];
      const bars = [bar(-LEN / 2, 0), bar(-LEN / 2 + shift - ARM, BAR + gap)];
      // its shadow on the paper first, so that it lies on the sheet and not in it
      for (const [a0, c0] of [[-LEN / 2, 0.014], [-LEN / 2 + shift - ARM, BAR + gap + 0.014]]) f.fill(bar(a0 + 0.012, c0, SY + 0.002), pal.bg, 0.6 * brass);
      for (const q of bars) {
        f.fill(q, pal.bg, 0.92 * brass);
        f.fill(q, pal.gold, 0.46 * brass);
        f.path(q, pal.gold, 0.95 * brass, 1, true);
        f.line(q[3], q[2], pal.ink, 0.5 * brass, 1);
      }
      if (!f.mobile) for (let i = 1; i < 21; i++) f.line(at(-LEN / 2 + (LEN * i) / 21, 0), at(-LEN / 2 + (LEN * i) / 21, i % 5 ? 0.016 : 0.028), pal.bg, 0.7 * brass, 1);
      for (const k of [-0.24, 0.24]) {
        const a: V3 = at(k, BAR / 2, SY + 0.03);
        const b: V3 = at(k + shift, BAR * 1.5 + gap, SY + 0.03);
        f.line(a, b, pal.gold, 0.9 * brass, 2.5);
        f.dot(a, 0.016, pal.ink, 0.85 * brass);
        f.dot(b, 0.016, pal.ink, 0.85 * brass);
      }
    }

    // ── the pointer's own route, drawn over the rule that lies along it
    if (cur) {
      const end: V3 = [cur[0], SY + 0.004, cur[1]];
      s.isles.forEach((c, i) => {
        const a = s.lift[i];
        if (a <= 0.02) return;
        const from: V3 = [c.x, SY + 0.004, c.z];
        f.path([from, end], pal.gold, 0.2 * a, 7);
        ctx.setLineDash([7, 5]);
        ctx.lineDashOffset = f.still ? 0 : -f.t * 9;
        f.path([from, end], pal.gold, a, 2);
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      });
      // the fix: where the route ends, marked the way a position is marked on a chart
      ring(f, end, 0.07, { colour: pal.gold, alpha: 0.8 * f.hover, seg: 20 });
      for (let k = 0; k < 4; k++) {
        const a = (k * TAU) / 4 + TAU / 8;
        f.line([end[0] + Math.cos(a) * 0.09, end[1], end[2] + Math.sin(a) * 0.09], [end[0] + Math.cos(a) * 0.13, end[1], end[2] + Math.sin(a) * 0.13], pal.gold, 0.7 * f.hover);
      }
    }

    // ── the islands, far ones first: each a relief of three contours with a light on its summit
    s.order.sort((a, b) => s.isles[a].x * sy - s.isles[a].z * cy - (s.isles[b].x * sy - s.isles[b].z * cy));
    for (const i of s.order) {
      const c = s.isles[i];
      const on = f.on(0.3 + i * 0.08, 0.26);
      if (on <= 0.003) continue;
      const lit = s.lift[i];
      // under the pointer the island stands up out of the sheet and its contours part
      const rise = (0.06 + 0.075 * lit) * on;
      const base = SY + 0.05 * lit;
      if (lit > 0.02) {
        f.fill(c.layers[0].map((p): V3 => [c.x + p[0] * 1.06 + 0.03 * lit, SY + 0.003, c.z + p[1] * 1.06 - 0.03 * lit]), pal.bg, 0.5 * lit);
        pool(f, [c.x, SY, c.z], 0.62, pal.gold, 0.3 * lit);
      }
      const count = f.mobile && f.q < 0.75 ? 2 : 3;
      for (let l = 0; l < count; l++) contour(f, c, c.layers[l], l ? base + l * rise : SY, base + (l + 1) * rise, 0.09 + l * 0.07, lit, on);
      const peak: V3 = [c.x + c.layers[2][0][0] * 0.2, base + count * rise, c.z + c.layers[2][0][1] * 0.2];
      const breathe = f.still ? 1 : 0.85 + 0.15 * Math.sin(f.t * 0.8 + i * 1.9);
      lamp(f, peak, lit > 0.5 ? pal.gold : pal.key, on * (0.5 * breathe + 0.5 * lit), 0.013 + 0.007 * lit);
      const quiet = cur ? 1 - 0.35 * f.hover : 1;
      f.label(c.name, peak, { align: "center", dy: f.mobile ? -11 : -14 - 4 * lit, size: f.mobile ? 8 : 10, colour: lit > 0.4 ? pal.gold : pal.ink, alpha: on * lerp(0.74 * quiet, 1, lit) });
    }
  },
};

export default scene;
