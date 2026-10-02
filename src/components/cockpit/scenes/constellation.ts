/**
 * CONSTELLATION — the knowledge graph as a star globe.
 *
 * A desk armillary: a ball of optical glass held at its poles in a meridian
 * cradle, with one graduated equatorial band. Inside the glass the Labs graph
 * hangs as a star chart: four families of nodes, each a small constellation
 * joined by fine edges. One path runs from family to family through their
 * principal stars and a pulse of light travels it: connecting the dots. Riders
 * set in the band show each family's bearing as the chart turns.
 * Nothing here is data: it is the shape of the graph, lit.
 */
import { TAU, clamp, easeOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { box, callouts, deck, orb, pool, ring, ringPoint, trace, type Callout } from "../kit";

const R = 1;
const CY = 0.16;
const FLOOR = -1.3;
const C: V3 = [0, CY, 0];
/** the polar axis leans, as it does on a desk globe */
const LEAN = 0.3;
const CL = Math.cos(LEAN);
const SL = Math.sin(LEAN);
/** equatorial band, then meridian cradle: inner and outer radii */
const B1 = R * 1.04;
const B2 = R * 1.13;
const M1 = R * 1.23;
const M2 = R * 1.285;
/** the cradle runs half a turn in the plane facing the viewer, from the south pole to the north */
const SOUTH = -0.25 - LEAN / TAU;

const NAMES = ["MARKETS", "CONCEPTS", "EVENTS", "TOOLS"];
const COUNTS = [15, 13, 12, 11];
const HOMES: V3[] = [
  [0.44, 0.34, -0.26],
  [-0.46, 0.16, 0.3],
  [0.3, -0.36, 0.38],
  [-0.28, -0.3, -0.44],
];

type Node = { x: number; y: number; z: number; k: number; r: number };
type Half = { outer: V3[]; inner: V3[]; fill: V3[]; minor: V3[]; major: V3[] };
type State = { nodes: Node[]; edges: [number, number][]; hubs: number[]; path: number[]; pos: [number, number, number][]; order: number[]; far: Half; near: Half; cradle: V3[]; plate: V3[]; step: V3[] };

/** chart space (polar axis = +y) to the world: lean the axis, lift to the orb's centre */
const world = (x: number, y: number, z: number): V3 => [x * CL + y * SL, CY - x * SL + y * CL, z];
const onBand = (r: number, a: number): V3 => world(Math.cos(a) * r, 0, Math.sin(a) * r);
const depth = (z: number) => clamp(0.5 - z / 1.8);
const sweep = (n: number, at: (t: number) => V3): V3[] => Array.from({ length: n + 1 }, (_, i) => at(i / n));
const disc = (y: number, r: number) => sweep(40, (t): V3 => [Math.cos(t * TAU) * r, y, Math.sin(t * TAU) * r]);

/** one half of the equatorial band (from a turn, half a turn round), with its graduations as pairs of points */
function half(from: number, ticks: number): Half {
  const outer = sweep(30, (t) => onBand(B2, (from + t / 2) * TAU));
  const inner = sweep(30, (t) => onBand(B1, (from + t / 2) * TAU));
  const minor: V3[] = [];
  const major: V3[] = [];
  for (let i = 0; i < ticks / 2; i++) {
    const a = (from + i / ticks) * TAU;
    const big = i % 6 === 0;
    (big ? major : minor).push(onBand(B1, a), onBand(B1 + (B2 - B1) * (big ? 1 : 0.42), a));
  }
  return { outer, inner, fill: [...outer, ...inner.slice().reverse()], minor, major };
}

/** many short segments (pairs of points) in a single stroke */
function strokes(f: Frame, pairs: readonly V3[], colour: string, alpha: number): void {
  const { ctx } = f;
  ctx.beginPath();
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const a = f.P(...pairs[i]);
    const b = f.P(...pairs[i + 1]);
    if (!a || !b) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** a fine circle (or an arc of one) facing the viewer: a star's reticle, the light on the rim of the glass */
function reticle(f: Frame, p: V3, r: number, colour: string, alpha: number, width = 1, from = 0, to = TAU): void {
  const q = f.P(p[0], p[1], p[2]);
  if (!q || alpha <= 0.003) return;
  const { ctx } = f;
  ctx.beginPath();
  ctx.arc(q.x, q.y, Math.max(1, r * q.s * f.u), from, to);
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const scale = (f.mobile ? 0.7 : 1) * f.q;
    const nodes: Node[] = [];
    const hubs: number[] = [];
    HOMES.forEach((c, k) => {
      hubs.push(nodes.length);
      for (let i = 0; i < Math.max(5, Math.round(COUNTS[k] * scale)); i++) {
        // the first star of a family is its principal, at the centre; the rest fill a small ball around it
        const id = nodes.length * 4;
        const r = i === 0 ? 0 : 0.15 + 0.25 * Math.cbrt(f.rnd(id));
        const a = f.rnd(id + 1) * TAU;
        const h = f.rnd(id + 2) * 2 - 1;
        const w = Math.sqrt(1 - h * h) * r;
        const p = [c[0] + w * Math.cos(a), c[1] + h * r * 0.85, c[2] + w * Math.sin(a)];
        const fit = Math.min(1, 0.86 / Math.hypot(p[0], p[1], p[2]));
        nodes.push({ x: p[0] * fit, y: p[1] * fit, z: p[2] * fit, k, r: i === 0 ? 0.019 : 0.006 + 0.007 * f.rnd(id + 3) });
      }
    });

    const d2 = (a: Node, b: Node) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
    /** the star nearest to star i among those that pass the test (i itself when none does) */
    const nearest = (i: number, ok: (m: Node) => boolean): number =>
      nodes.reduce((best, m, j) => (j !== i && ok(m) && (best === i || d2(nodes[i], m) < d2(nodes[i], nodes[best])) ? j : best), i);
    const edges: [number, number][] = [];
    const link = (a: number, b: number) => {
      if (a !== b && !edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) edges.push([a, b]);
    };
    // each star joins its nearest neighbour on the way in to the principal (a tree); some join a second
    // neighbour, and a few reach across to another family, so that the whole is one graph
    nodes.forEach((n, i) => {
      const hub = nodes[hubs[n.k]];
      if (n === hub) return;
      link(i, nearest(i, (m) => m.k === n.k && d2(m, hub) < d2(n, hub)));
      if (f.rnd(i + 300) < 0.4) link(i, nearest(i, (m) => m.k === n.k));
      if (i % 9 === 4) link(i, nearest(i, (m) => m.k !== n.k));
    });

    // the path: the four principals in turn (which one leads varies by page), then one step out to a neighbouring star
    const lead = Math.floor(f.rnd(41) * 4) % 4;
    const path = [0, 1, 2, 3].map((i) => hubs[(lead + i) % 4]);
    path.push(nearest(path[3], (m) => m.k === nodes[path[3]].k));

    const ticks = f.mobile ? 36 : 72;
    return {
      nodes,
      edges,
      hubs,
      path,
      pos: nodes.map(() => [0, 0, 0]),
      order: nodes.map((_, i) => i),
      far: half(0, ticks),
      near: half(0.5, ticks),
      cradle: [...sweep(30, (t) => ringPoint(C, M2, SOUTH + t / 2, "z")), ...sweep(30, (t) => ringPoint(C, M1, SOUTH + 0.5 - t / 2, "z"))],
      plate: disc(FLOOR, 0.54),
      step: disc(FLOOR + 0.035, 0.3),
    };
  },

  draw(f, s) {
    const { pal } = f;
    // seen from a little above, as an instrument standing on a desk is (in this engine that is a negative pitch)
    // on a narrow desktop the instrument draws in and moves right a little, to leave the statement its room
    const room = clamp((f.w - 720) / 560);
    f.aim(-0.05 + Math.sin(f.t * 0.06) * 0.04, -0.26, 6.2, f.mobile ? 0.7 : 0.74 + 0.16 * room);
    if (f.mobile) [f.cx, f.cy] = [f.w * 0.5, f.h * 0.255];
    else f.cx += (1 - room) * 0.035 * f.w;

    // the path is the key light; where the families carry the colour it is a neutral thread, and on its own page it is gold
    const universe = f.tag === "market-universe";
    const dots = f.tag === "connect-the-dots";
    const tones = [pal.blue, pal.teal, pal.emerald, pal.gold];
    const tone = (k: number) => (universe ? tones[k] : pal.ink);
    const lead = dots ? pal.gold : universe ? pal.ink : pal.key;

    // the chart turns once in a few minutes about the leaning polar axis
    const spin = f.rnd(11) * TAU + f.t * 0.03;
    const cs = Math.cos(spin);
    const sn = Math.sin(spin);
    s.nodes.forEach((n, i) => {
      const x = n.x * cs + n.z * sn;
      const p = s.pos[i];
      p[0] = x * CL + n.y * SL;
      p[1] = CY - x * SL + n.y * CL;
      p[2] = -n.x * sn + n.z * cs;
    });
    s.order.sort((a, b) => s.pos[b][2] - s.pos[a][2]);

    // ── the stand: deck, a stepped foot, the meridian cradle clamped to it, and the two polar pivots
    const up = f.on(0, 0.45);
    const arm = f.on(0.12, 0.5);
    const foot = FLOOR + 0.035;
    const neck = CY - M2 - 0.02;
    deck(f, { y: FLOOR, alpha: 0.12, half: 4.5 });
    pool(f, [0, FLOOR, 0], 2.3, pal.key, 0.24 * f.boot);
    f.fill(s.plate, pal.bg, 0.72 * up);
    f.fill(s.plate, pal.ink, 0.045 * up);
    f.path(s.plate, pal.ink, 0.3 * up);
    ring(f, [0, FLOOR, 0], 0.54, { colour: pal.key, alpha: 0.55 * up, from: 0.56, to: 0.94, width: 1.5 });
    f.fill(s.step, pal.ink, 0.06 * up);
    f.path(s.step, pal.ink, 0.34 * up);
    f.fill([[-0.055, foot, 0], [0.055, foot, 0], [0.038, neck, 0], [-0.038, neck, 0]], pal.ink, 0.14 * up);
    f.line([-0.055, foot, 0], [-0.038, neck, 0], pal.key, 0.5 * up, 1.25);
    f.line([0.055, foot, 0], [0.038, neck, 0], pal.ink, 0.35 * up);
    f.fill(s.cradle, pal.ink, 0.06 * up * arm);
    ring(f, C, M2, { axis: "z", colour: pal.ink, alpha: 0.34 * up, from: SOUTH, to: SOUTH + 0.5 * arm });
    ring(f, C, M1, { axis: "z", colour: pal.key, alpha: 0.5 * up, width: 1.25, from: SOUTH, to: SOUTH + 0.5 * arm });
    box(f, [-0.09, neck, -0.05], [0.09, CY - M1 + 0.02, 0.05], pal.ink, 0.42 * up, 0.1 * up);
    for (const pole of [R, -R]) {
      f.line(world(0, pole, 0), world(0, pole * M2, 0), pal.ink, 0.5 * up * arm, 1.5);
      f.dot(world(0, pole, 0), 0.011, pal.ink, 0.7 * up * arm);
      f.dot(world(0, (pole * (M1 + M2)) / 2, 0), 0.016, pal.key, 0.9 * up * arm);
    }

    // ── the equatorial band, in two halves so that the glass can sit between them
    const bandHalf = (h: Half, front: boolean) => {
      const k = (front ? 1 : 0.5) * up;
      f.fill(h.fill, pal.ink, 0.05 * k);
      strokes(f, h.minor, pal.ink, 0.22 * k);
      strokes(f, h.major, pal.ink, 0.45 * k);
      f.path(h.inner, pal.ink, 0.22 * k);
      f.path(h.outer, pal.ink, front ? 0.5 * up : 0.16 * up, front ? 1.25 : 1);
      // riders: a jewel set in the band at each family's bearing
      s.hubs.forEach((hub, i) => {
        const n = s.nodes[hub];
        const a = Math.atan2(-n.x * sn + n.z * cs, n.x * cs + n.z * sn);
        if (Math.sin(a) < 0 !== front) return;
        const c = universe ? tones[i] : dots ? pal.ink : pal.key;
        f.line(onBand(B1, a), onBand(B2, a), c, 0.8 * k * arm, 1.5);
        f.dot(onBand((B1 + B2) / 2, a), 0.014, c, 0.95 * k * arm);
      });
    };
    bandHalf(s.far, false);
    orb(f, C, R, pal.key, 0.9 * up);

    // ── the four families' names, laid out first so that no star is drawn underneath one
    const size = f.mobile ? 9 : 10;
    const reach = 22;
    const names: Callout[] = [];
    const tags: { x0: number; x1: number; y: number; a: number }[] = [];
    if (!f.mobile || universe) {
      s.hubs.forEach((h, k) => {
        const p = s.pos[h];
        const q = f.P(p[0], p[1], p[2]);
        if (!q) return;
        // a name fades as its family crosses the centre line, so it never jumps from one side to the other
        const side = clamp((Math.abs(q.x - f.cx) / f.u - 0.05) / 0.12);
        const a = f.on(0.85, 0.3) * side * (0.45 + 0.55 * depth(p[2])) * (universe ? 1 : 0.85);
        const w = NAMES[k].length * size * 0.68;
        const x0 = q.x >= f.cx ? q.x + reach - 5 : q.x - reach - w;
        names.push({ text: NAMES[k], p, colour: universe ? tones[k] : pal.ink, alpha: a });
        tags.push({ x0, x1: x0 + w + 5, y: q.y, a: clamp(a * 1.6) });
      });
    }

    // ── inside the glass: a haze about each family, then the edges
    s.hubs.forEach((h, k) => {
      const p = s.pos[h];
      f.glow(p, 0.46, universe ? tones[k] : pal.key, (universe ? 0.22 : dots ? 0.07 : 0.1) * (0.45 + 0.55 * depth(p[2])) * f.on(0.3, 0.5));
    });
    s.edges.forEach(([a, b], i) => {
      const on = f.on(0.3 + 0.5 * (i / s.edges.length), 0.3);
      if (on <= 0) return;
      const pa = s.pos[a];
      const pb = s.pos[b];
      const d = depth((pa[2] + pb[2]) / 2);
      const same = s.nodes[a].k === s.nodes[b].k;
      const end: V3 = on >= 1 ? pb : [lerp(pa[0], pb[0], on), lerp(pa[1], pb[1], on), lerp(pa[2], pb[2], on)];
      f.line(pa, end, same ? tone(s.nodes[a].k) : pal.ink, (same ? 0.08 + 0.26 * d : 0.05 + 0.13 * d) * (dots ? 0.75 : universe ? 1.35 : 1));
    });

    // ── the path: principal to principal, drawn in at power-on, then carrying one slow pulse
    const hops = s.path.length - 1;
    const run = easeOut((f.boot - 0.55) / 0.45) * hops;
    const pts: V3[] = [];
    for (let j = 0; j <= Math.min(hops, Math.ceil(run)); j++) {
      const p = s.pos[s.path[j]];
      const q = s.pos[s.path[Math.max(0, j - 1)]];
      const k = clamp(run - (j - 1));
      pts.push(k >= 1 ? p : [lerp(q[0], p[0], k), lerp(q[1], p[1], k), lerp(q[2], p[2], k)]);
    }
    trace(f, pts, lead, dots ? 0.95 : universe ? 0.4 : 0.8, (dots ? 2 : universe ? 1 : 1.25) * (f.mobile ? 0.8 : 1), f.boot >= 1 ? f.t / 10 : -1);

    // ── the stars, far to near: further ones smaller and dimmer
    const phase = (f.t / 10) % 1;
    const beat = f.still || f.boot < 1 ? -9 : phase * hops;
    const env = clamp(phase / 0.06) * clamp((1 - phase) / 0.06);
    for (const i of s.order) {
      const n = s.nodes[i];
      const p = s.pos[i];
      const on = f.on(0.15 + 0.5 * f.rnd(i + 500), 0.3);
      if (on <= 0) continue;
      const d = depth(p[2]);
      const a = (0.3 + 0.7 * d) * on;
      const r = n.r * (0.7 + 0.45 * d) * (universe ? 1.2 : 1);
      const step = s.path.indexOf(i);
      if (step < 0) {
        let clear = 1;
        const q = tags.length ? f.P(p[0], p[1], p[2]) : null;
        if (q) for (const t of tags) clear = Math.min(clear, lerp(1, clamp(Math.max(t.x0 - q.x, q.x - t.x1, Math.abs(q.y - t.y) - 8) / 6), t.a));
        f.dot(p, r, tone(n.k), a * clear * (dots ? 0.7 : universe ? 1 : 0.9));
        continue;
      }
      // a star on the path: a lit point in a fine reticle that swells a little as the pulse goes through
      const c = universe ? tones[n.k] : lead;
      const swell = clamp(1 - Math.abs(beat - step) / 0.7) * env;
      const big = r * (step < hops ? 1 : 1.25);
      f.dot(p, big * (2.9 + swell), c, 0.16 * a);
      reticle(f, p, big * (2.2 + 0.4 * swell), c, (0.5 + 0.4 * swell) * a);
      f.dot(p, big, c, a);
      f.dot(p, big * 0.45, pal.ink, 0.9 * a);
    }

    // ── the glass in front: light caught on its shoulder, then the near half of the band and the names
    reticle(f, C, R * 0.985, pal.ink, 0.3 * up, 1.5, Math.PI * 1.1, Math.PI * 1.4);
    bandHalf(s.near, true);
    callouts(f, names, { size, reach });
  },
};

export default scene;
