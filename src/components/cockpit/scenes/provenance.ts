/**
 * PROVENANCE — where a figure comes from.
 *
 * An optical bench seen from above. At the back stand five source drums, one
 * for each of the page's five data states. A line runs from the top of each to
 * the first of two lens-like filters on a rail, where they converge; one beam
 * goes on through the second filter and lands on a stamped tile at the front:
 * a figure, drawn as blank strokes and a seal, never as a number. Beside the
 * tile stands its tag, which reads only SOURCE.
 *
 * Every figure belongs to exactly one state, so only one line is lit at a time
 * and the lit drum carries the state's own name. Left alone the bench reads the
 * five in turn.
 *
 * The pointer: a tracing light runs back from the tile through both filters to
 * the source nearest the cursor, and that whole path lights; the filter under
 * the cursor turns into focus (its two images slide into one and its mark comes
 * to rest under the index).
 */
import { TAU, clamp, lerp, type Frame, type Scene, type V3 } from "../engine";
import { arc, deck, lamp, pool, ring, ringPoint, trace } from "../kit";

/** the page's five data states, in its own order */
const STATES = ["REFERENCE", "INDICATIVE", "SCHEDULE", "SIMULATION", "CHARTS"];
/** the rail's top, the deck under it, and the bench's axis */
const FY = -0.3;
const DECK = FY - 0.05;
const AX = -0.12;
/** stations along the bench, back to front: sources, two filters, the tile */
const ZS = 1.45;
const Z1 = 0.62;
const Z2 = -0.06;
const ZT = -0.82;
const DRUM = 0.15;
const DRUM_H = 0.4;
/** the height of the beam, and the filters' radius */
const YL = FY + 0.34;
const LENS = 0.235;
const TILE = 0.5;
const LEAN = 0.3;

type State = { src: V3[]; order: number[]; lvl: number[]; lead: number };

const smooth = (k: number) => {
  const x = clamp(k);
  return x * x * (3 - 2 * x);
};
/** a point on the tile's face: u across, v up, both 0..1 */
const onTile = (u: number, v: number): V3 => [AX + (u - 0.5) * TILE, FY + 0.03 + v * TILE * Math.cos(LEAN), ZT + v * TILE * Math.sin(LEAN)];
/** a small circle engraved on the tile */
const seal = (u: number, v: number, r: number): V3[] => {
  const o: V3[] = [];
  for (let i = 0; i < 16; i++) o.push(onTile(u + (Math.cos((i * TAU) / 16) * r) / TILE, v + (Math.sin((i * TAU) / 16) * r) / TILE));
  return o;
};
/** the point a fraction g of the way along a polyline, by length */
function along(pts: readonly V3[], g: number): V3 {
  const len: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    len.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
    total += len[i - 1];
  }
  let d = clamp(g) * total;
  for (let i = 0; i < len.length; i++) {
    if (d <= len[i] || i === len.length - 1) {
      const k = len[i] ? d / len[i] : 0;
      return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k), lerp(pts[i][2], pts[i + 1][2], k)];
    }
    d -= len[i];
  }
  return pts[0];
}

/** solid machined metal: a dark body under a tint, with a hairline round it */
function plate(f: Frame, q: readonly V3[], tone: number, on: number, edge = 0.22): void {
  f.fill(q, f.pal.bg, 0.95 * on);
  f.fill(q, f.pal.ink, tone * on);
  f.path(q, f.pal.ink, edge * on, 1, true);
}

/** a source: a turned drum standing on the deck, lit from the viewer's left, with an emitter on its top */
function drum(f: Frame, c: V3, lit: number, on: number): void {
  const { pal } = f;
  const yaw = f.cam.yaw;
  const n = f.mobile ? 10 : 16;
  const top = c[1] + DRUM_H * on;
  const at = (k: number, y: number): V3 => [c[0] + Math.cos((k * TAU) / n) * DRUM, y, c[2] + Math.sin((k * TAU) / n) * DRUM];
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) * TAU) / n;
    if (Math.sin(a - yaw) >= 0) continue;
    const shade = clamp(Math.cos(a - yaw + Math.PI / 2 + 0.85));
    const q: V3[] = [at(k, c[1]), at(k + 1, c[1]), at(k + 1, top), at(k, top)];
    f.fill(q, pal.bg, 0.95 * on);
    f.fill(q, pal.ink, (0.04 + 0.26 * shade * shade) * on);
    f.fill(q, pal.gold, 0.2 * shade * lit * on);
  }
  const lid: V3[] = [];
  for (let k = 0; k < n; k++) lid.push(at(k, top));
  f.fill(lid, pal.bg, 0.95 * on);
  f.fill(lid, pal.ink, 0.1 * on);
  f.fill(lid, pal.gold, 0.3 * lit * on);
  f.path(lid, pal.ink, 0.5 * on, 1, true);
  f.path(lid, pal.gold, 0.95 * lit * on, 1.5, true);
  const near = { from: yaw / TAU + 0.5, to: yaw / TAU + 1, seg: 40 };
  ring(f, [c[0], c[1], c[2]], DRUM, { ...near, colour: pal.ink, alpha: 0.34 * on });
  ring(f, [c[0], lerp(c[1], top, 0.74), c[2]], DRUM, { ...near, colour: lit > 0.02 ? pal.gold : pal.ink, alpha: (0.26 + 0.5 * lit) * on });
  ring(f, [c[0], top, c[2]], DRUM * 0.5, { colour: pal.ink, alpha: 0.3 * on, seg: 20 });
  lamp(f, [c[0], top, c[2]], lit > 0.02 ? pal.gold : pal.ink, on * (0.3 + 0.7 * lit), 0.016 + 0.01 * lit);
}

/** a filter on its holder: a rim, a graduated ring that turns, and an element whose two images meet when it is in focus */
function lens(f: Frame, z: number, turn: number, focus: number, on: number): void {
  const { pal } = f;
  if (on <= 0.003) return;
  const c: V3 = [AX, YL, z];
  plate(f, [[AX - 0.11, FY, z - 0.06], [AX + 0.11, FY, z - 0.06], [AX + 0.11, FY, z + 0.06], [AX - 0.11, FY, z + 0.06]], 0.14, on, 0.4);
  f.line([AX, FY, z], [AX, YL - LENS, z], pal.ink, 0.55 * on, 3);
  const disc: V3[] = [];
  for (let i = 0; i < 24; i++) disc.push(ringPoint(c, LENS, i / 24, "z"));
  f.fill(disc, pal.bg, 0.34 * on);
  f.fill(disc, pal.key, (0.06 + 0.12 * focus) * on);
  ring(f, c, LENS + 0.035, { axis: "z", colour: pal.ink, alpha: 0.28 * on });
  ring(f, c, LENS, { axis: "z", colour: pal.ink, alpha: 0.72 * on, width: 2.25 });
  ring(f, c, LENS, { axis: "z", colour: pal.key, alpha: (0.5 + 0.4 * focus) * on, width: 2.25, from: 0.27, to: 0.48 });
  ring(f, c, LENS - 0.045, { axis: "z", colour: focus > 0.02 ? pal.gold : pal.ink, alpha: (0.36 + 0.5 * focus) * on, ticks: f.mobile ? 12 : 24, major: f.mobile ? 3 : 6, tickLen: 0.036, rot: Math.PI / 2 + turn });
  f.line(ringPoint(c, LENS - 0.09, 0.25, "z", turn), ringPoint(c, LENS - 0.09, 0.75, "z", turn), pal.ink, 0.16 * on, 1);
  // out of focus the element shows two images; in focus they are one
  const off = 0.05 * (1 - focus);
  for (const side of [-1, 1]) ring(f, [AX + side * off, YL, z], LENS * 0.5, { axis: "z", colour: pal.key, alpha: (0.3 + 0.55 * focus) * on, width: 1 + focus * 0.75, seg: 36 });
  f.glow(c, 0.2 + 0.16 * focus, pal.gold, (0.22 + 0.4 * focus) * on);
  // the index on the holder: the ring's mark comes to rest under it
  const y = YL + LENS + 0.05;
  f.fill([[AX - 0.03, y + 0.06, z], [AX + 0.03, y + 0.06, z], [AX, y, z]], focus > 0.02 ? pal.gold : pal.ink, (0.55 + 0.45 * focus) * on);
}

const scene: Scene<State> = {
  pose: 13,
  setup(f) {
    // the drums stand on a shallow arc that faces the first filter
    const src: V3[] = STATES.map((_, i) => [AX + (i - 2) * 0.5, DECK, ZS - 0.06 * (i - 2) * (i - 2)]);
    return { src, order: [0, 1, 2, 3, 4], lvl: [0, 0, 0, 0, 0], lead: Math.floor(f.rnd(4) * 5) };
  },
  draw(f, s) {
    const { pal } = f;
    // looked down on, as a bench is; turned so that it runs from the back right to the front left
    f.aim(0.42 + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.04), -0.54, 6.4, f.mobile ? 1.22 : 1.3);
    const yaw = f.cam.yaw;
    const l1: V3 = [AX, YL, Z1];
    const l2: V3 = [AX, YL, Z2];
    const hit = onTile(0.5, 0.7);
    const tops = s.src.map((c): V3 => [c[0], c[1] + DRUM_H, c[2]]);

    // which source is being read: each in turn, or the one nearest the pointer
    let sel = (Math.floor(f.t / 6) + s.lead) % STATES.length;
    if (f.hover > 0.35) {
      let best = Infinity;
      tops.forEach((p3, i) => {
        const p = f.P(p3[0], p3[1] - DRUM_H / 2, p3[2]);
        const d = p ? Math.hypot(p.x - f.mx, p.y - f.my) : Infinity;
        if (d < best) {
          best = d;
          sel = i;
        }
      });
    }
    const step = Math.min(1, f.dt * 4.5);
    for (let i = 0; i < s.lvl.length; i++) s.lvl[i] = f.still ? (i === sel ? 1 : 0) : s.lvl[i] + ((i === sel ? 1 : 0) - s.lvl[i]) * step;

    const fan = f.on(0.3, 0.3);
    const beam = f.on(0.6, 0.3);
    const tileOn = f.on(0.75, 0.25);
    const tagOn = f.on(0.95, 0.2);

    deck(f, { y: DECK, half: 3.75, step: 0.5, alpha: 0.1, drift: 0 });
    pool(f, [AX, DECK, ZS - 0.1], 1.9, pal.key, 0.17 * f.boot);
    pool(f, [AX, DECK, ZT], 0.9, pal.gold, 0.2 * tileOn);

    // ── the sources, far ones first
    s.order.sort((a, b) => s.src[b][2] * Math.cos(yaw) - s.src[b][0] * Math.sin(yaw) - (s.src[a][2] * Math.cos(yaw) - s.src[a][0] * Math.sin(yaw)));
    for (const i of s.order) {
      const on = f.on(i * 0.05, 0.3);
      if (on <= 0.003) continue;
      pool(f, s.src[i], 0.42, pal.gold, 0.2 * s.lvl[i] * on);
      drum(f, s.src[i], s.lvl[i], on);
    }

    // ── the rail the filters and the tile stand on
    plate(f, [[AX + 0.06, DECK, ZT - 0.2], [AX + 0.06, DECK, Z1 + 0.2], [AX + 0.06, FY, Z1 + 0.2], [AX + 0.06, FY, ZT - 0.2]], 0.05, f.boot);
    plate(f, [[AX - 0.06, FY, ZT - 0.2], [AX + 0.06, FY, ZT - 0.2], [AX + 0.06, FY, Z1 + 0.2], [AX - 0.06, FY, Z1 + 0.2]], 0.11, f.boot, 0.3);
    f.line([AX - 0.06, FY, ZT - 0.2], [AX - 0.06, FY, Z1 + 0.2], pal.key, 0.5 * f.boot, 1.25);

    // ── every source has a line to the first filter; one of them is lit
    tops.forEach((p, i) => {
      f.line(p, l1, pal.ink, 0.28 * fan, 1);
      if (s.lvl[i] > 0.01) trace(f, [p, l1], pal.gold, 0.95 * s.lvl[i] * fan, 1.5);
    });
    const turn = (j: number, focus: number) => (f.still ? 0.5 - j * 0.8 : Math.sin(f.t * 0.11 + j * 2.1) * 0.75) * (1 - focus);
    const f1 = smooth(f.near(l1, 105) * 1.3);
    const f2 = smooth(f.near(l2, 105) * 1.3);
    lens(f, Z1, turn(0, f1), f1, f.on(0.42, 0.3));
    trace(f, [l1, l2], pal.gold, 0.9 * beam, 1.5);
    lens(f, Z2, turn(1, f2), f2, f.on(0.54, 0.3));
    trace(f, [l2, hit], pal.gold, 0.9 * beam, 1.5);

    // ── the tile: a figure as blank strokes and a seal, standing in a carrier on the rail
    if (tileOn > 0.003) {
      plate(f, [[AX - 0.3, FY, ZT - 0.07], [AX + 0.3, FY, ZT - 0.07], [AX + 0.3, FY, ZT + 0.09], [AX - 0.3, FY, ZT + 0.09]], 0.14, tileOn, 0.4);
      const back = 0.045;
      plate(f, [[AX + TILE / 2, FY + 0.03, ZT], onTile(1, 1), [AX + TILE / 2, onTile(1, 1)[1], onTile(1, 1)[2] + back], [AX + TILE / 2, FY + 0.03, ZT + back]], 0.05, tileOn);
      const face = [onTile(0, 0), onTile(1, 0), onTile(1, 1), onTile(0, 1)];
      f.fill(face, pal.bg, 0.96 * tileOn);
      f.fill(face, pal.gold, 0.12 * tileOn);
      f.path(face, pal.gold, 0.9 * tileOn, 1.5, true);
      f.path([onTile(0.07, 0.07), onTile(0.93, 0.07), onTile(0.93, 0.93), onTile(0.07, 0.93)], pal.gold, 0.3 * tileOn, 1, true);
      f.line(onTile(0.16, 0.44), onTile(0.56, 0.44), pal.ink, 0.75 * tileOn, 3);
      f.line(onTile(0.16, 0.28), onTile(0.42, 0.28), pal.ink, 0.4 * tileOn, 3);
      f.path(seal(0.74, 0.3, 0.085), pal.gold, 0.9 * tileOn, 1.5, true);
      f.path(seal(0.74, 0.3, 0.055), pal.gold, 0.5 * tileOn, 1, true);
      f.dot(onTile(0.74, 0.3), 0.014, pal.gold, 0.9 * tileOn);
    }

    // ── its tag: a card on a stem, tied to the tile by a thread
    const tw = f.mobile ? 0.44 : 0.33;
    const tx = AX + TILE / 2 + 0.16;
    const card = (u: number, v: number): V3 => [tx + u * tw, FY + 0.12 + v * 0.13, ZT - 0.05 + v * 0.03];
    if (tagOn > 0.003) {
      f.line([tx + tw / 2, DECK, ZT - 0.05], card(0.5, 0), pal.ink, 0.5 * tagOn, 1.5);
      f.path(arc(onTile(1, 1), card(0, 0.5), -0.1, 10), pal.ink, 0.4 * tagOn, 1);
      plate(f, [card(0, 0), card(1, 0), card(1, 1), card(0, 1)], 0.12, tagOn, 0.55);
      f.dot(card(0.07, 0.5), 0.011, pal.gold, 0.9 * tagOn);
      f.label("SOURCE", card(0.54, 0.5), { align: "center", size: f.mobile ? 8 : 9, colour: pal.gold, alpha: 0.95 * tagOn });
    }

    // ── the light on the path: outward from the source when left alone, traced back from the tile under the pointer
    f.glow(hit, 0.24, pal.gold, 0.4 * beam * tileOn);
    f.dot(hit, 0.018, pal.ink, 0.9 * beam * tileOn);
    tops.forEach((p, i) => {
      const level = s.lvl[i] * beam * tileOn;
      if (level <= 0.01) return;
      const route = [p, l1, l2, hit];
      const runs: [number, number][] = [[(f.t * 0.2) % 1, 1 - f.hover], [1 - ((f.t * 0.3) % 1), f.hover]];
      for (const [g, part] of runs) {
        const a = level * part * clamp(g * 8) * clamp((1 - g) * 8);
        if (a <= 0.01) continue;
        const q = along(route, g);
        f.glow(q, 0.17, pal.gold, 0.9 * a);
        f.dot(q, 0.017, pal.ink, a);
      }
      f.label(STATES[i], p, { align: "center", dy: f.mobile ? -11 : -16, size: f.mobile ? 8 : 10, colour: pal.gold, alpha: 0.95 * s.lvl[i] * fan });
    });
  },
};

export default scene;
