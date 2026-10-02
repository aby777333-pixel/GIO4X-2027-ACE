/**
 * VAULT — trust, as a door.
 *
 * A circular vault door seen almost face-on and slightly turned: a thick frame,
 * a slab of turned steel with a port of smoked glass, three graduated locking
 * rings, eight radial bolts and a hub wheel. The chamber behind it is lit, so
 * the brightest thing in the picture is the thin rim of light round the door.
 *
 * The rings counter-rotate and come to rest with their marks in line with the
 * bolts: that alignment is the whole message. Nothing here is a claim or a
 * figure. On the client-funds page a second, separate chamber stands beside the
 * first (CLIENT, COMPANY); on the transparency pages the glass clears to show a
 * ruled ledger behind it; on the verification page a champagne index marks the
 * line on which the rings agree.
 */
import { TAU, clamp, easeOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, panel, pool, ring, trace } from "../kit";

const FLOOR = -1.3;
const SILL = 0.07;
/** depths through the door, in door radii: frame back, slab back, frame face, bolts, slab face, rings, wheel */
const ZB = 0.36;
const ZD = 0.07;
const ZF = 0;
const ZM = -0.03;
const Z0 = -0.07;
const ZR = -0.082;
const ZW = -0.27;
/** eight bolts, so every ring carries eight major marks: one step is one bolt */
const STEP = TAU / 8;
/** engraved names are tracked out with thin spaces */
const engrave = (name: string) => name.split("").join(String.fromCharCode(0x2009));

type Dial = { r: number; ticks: number; major: number };
type Chamber = { c: V3; R: number; name: string; dials: Dial[]; bands: V3[][]; backO: V3[]; backI: V3[]; faceO: V3[]; faceI: V3[]; bevel: V3[]; lens: V3[]; edge: V3[]; slabB: V3[]; portB: V3[]; slab: V3[]; port: V3[] };
type State = { chambers: Chamber[]; split: boolean; idx: number; spin: number };

const pt = (c: V3, R: number, r: number, a: number, z: number): V3 => [c[0] + Math.cos(a) * r * R, c[1] + Math.sin(a) * r * R, c[2] + z * R];

function build(c: V3, R: number, n: number, name: string, dials: Dial[]): Chamber {
  const loop = (r: number, z: number, start = 0): V3[] => {
    const o: V3[] = [];
    for (let i = 0; i < n; i++) o.push(pt(c, R, r, start + (i / n) * TAU, z));
    return o;
  };
  // the rim of light is drawn in from the far side, so it starts at nine o'clock
  const edge = loop(0.975, ZD, Math.PI);
  edge.push(edge[0]);
  const bands = dials.flatMap((d) => [loop(d.r, ZR), loop(d.r - 0.105, ZR)]);
  return { c, R, name, dials, bands, backO: loop(1.26, ZB), backI: loop(1.07, ZB), faceO: loop(1.26, ZF), faceI: loop(1.07, ZF), bevel: loop(1.115, ZF), lens: loop(0.782, Z0), edge, slabB: loop(0.975, ZD), portB: loop(0.82, ZD), slab: loop(0.975, Z0), port: loop(0.82, Z0) };
}

/** add the closed outline of a loop to the current path */
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

/** a machined plate: a disc, or the annulus between two loops, in a flat tone or a gradient */
function plate(f: Frame, outer: readonly V3[], inner: readonly V3[] | null, style: string | CanvasGradient): void {
  const { ctx } = f;
  ctx.beginPath();
  outline(f, outer);
  if (inner) outline(f, inner);
  ctx.fillStyle = style;
  ctx.fill("evenodd");
}

/** where the highlights fall on a turned face: [position round the plate, strength, lit by the chamber] */
const TURNED: [number, number, boolean][] = [[0, 0.07, false], [0.08, 0.7, true], [0.2, 0.07, false], [0.36, 0.3, false], [0.48, 0.07, false], [0.6, 1, false], [0.72, 0.07, false], [0.87, 0.25, false], [1, 0.07, false]];

/** lathe-turned steel: broad highlights opposite one another that swing a little with the pointer */
function steel(f: Frame, centre: V3, hi: number, turn: number): string | CanvasGradient {
  const { ctx, pal } = f;
  const p = f.P(centre[0], centre[1], centre[2]);
  if (!p || typeof ctx.createConicGradient !== "function") return rgba(pal.ink, hi * 0.3);
  const g = ctx.createConicGradient(turn + f.px * 0.3 + (f.still ? 0 : Math.sin(f.t * 0.13) * 0.12), p.x, p.y);
  for (const [at, k, key] of TURNED) g.addColorStop(at, rgba(key ? pal.key : pal.ink, hi * k));
  return g;
}

/**
 * How far ring i is from rest, in bolts. It settles at power-on; after that,
 * about once a minute, it glides on by exactly one bolt and is in line again.
 */
function turnOf(f: Frame, i: number): number {
  if (f.still) return 0;
  const dir = i % 2 ? -1 : 1;
  const lead = 3 + i * 0.6;
  if (f.t < lead) return dir * (0.45 + 0.4 * f.rnd(i + 5)) * (1 - easeOut(f.t / lead));
  const c = (f.t - 18 - i * 3.5) / 56;
  return c <= 0 ? 0 : dir * (Math.floor(c) + 0.5 - 0.5 * Math.cos(Math.PI * clamp((c % 1) / 0.25)));
}

/** a ruled ledger sheet standing in the chamber, seen only through the glass port */
function ledger(f: Frame, d: Chamber, on: number): void {
  const { ctx, pal } = f;
  const { c, R } = d;
  const z = c[2] + 0.6 * R;
  // set to the left of the axis: from where the viewer stands, depth carries it back to the middle
  const x0 = c[0] - 0.86 * R;
  const x1 = c[0] + 0.44 * R;
  const y0 = c[1] - 0.62 * R;
  const rows = f.mobile ? 7 : 11;
  const dy = (1.3 * R) / (rows + 1);
  const sheet: V3[] = [[x0, y0, z], [x1, y0, z], [x1, y0 + 1.3 * R, z], [x0, y0 + 1.3 * R, z]];
  ctx.save();
  ctx.beginPath();
  outline(f, d.port);
  ctx.clip();
  f.fill(sheet, pal.ink, 0.09 * on);
  f.path(sheet, pal.ink, 0.5 * on, 1, true);
  for (let i = 1; i <= rows; i++) {
    const y = y0 + i * dy;
    f.line([x0, y, z], [x1, y, z], pal.ink, 0.32 * on, 1);
    if (i % 2 || i === rows) continue;
    // entries: schematic strokes for an item and its figure column, never a number
    const ym = y + dy * 0.5;
    f.line([x0 + 0.3 * R, ym, z], [x0 + (0.48 + 0.36 * f.rnd(30 + i)) * R, ym, z], pal.ink, 0.5 * on, 2);
    f.line([x1 - 0.24 * R, ym, z], [x1 - (0.12 - 0.07 * f.rnd(50 + i)) * R, ym, z], pal.gold, 0.75 * on, 2);
  }
  for (const u of [0.2, 0.23]) f.line([x0 + u * R, y0, z], [x0 + u * R, y0 + 1.3 * R, z], pal.gold, 0.6 * on, 1);
  f.line([x1 - 0.3 * R, y0, z], [x1 - 0.3 * R, y0 + 1.3 * R, z], pal.ink, 0.3 * on, 1);
  ctx.restore();
}

function chamber(f: Frame, d: Chamber, s: State, o: { delay: number; clear: boolean; gold: boolean; lead: boolean }): void {
  const { ctx, pal } = f;
  const { c, R } = d;
  const at = (k: number) => f.on(Math.min(1, o.delay + k * (1 - o.delay)), 0.4);
  const body = at(0);
  if (body <= 0.003) return;
  const lit = at(0.3);
  const face = at(0.18);
  const thrown = at(0.85);
  const P = (r: number, a: number, z: number): V3 => pt(c, R, r, a, z);
  const fine = R < 0.6 ? 0.62 : 1;
  const mark = o.gold ? pal.gold : pal.key;
  const idx = s.idx * TAU;
  const n = d.faceO.length;

  // a plinth to stand on: top, front and the side that faces the viewer
  const x0 = c[0] - 0.64 * R;
  const x1 = c[0] + 0.64 * R;
  const y1 = FLOOR + SILL;
  const zn = c[2] - 0.3 * R;
  const zf = c[2] + 0.5 * R;
  const faces: [V3[], number][] = [
    [[[x0, y1, zn], [x1, y1, zn], [x1, y1, zf], [x0, y1, zf]], 0.085],
    [[[x1, FLOOR, zn], [x1, FLOOR, zf], [x1, y1, zf], [x1, y1, zn]], 0.05],
    [[[x0, FLOOR, zn], [x1, FLOOR, zn], [x1, y1, zn], [x0, y1, zn]], 0.03],
  ];
  for (const [quad, tone] of faces) {
    f.fill(quad, pal.bg, 0.92 * body);
    f.fill(quad, pal.ink, tone * body);
    f.path(quad, pal.ink, 0.14 * body, 1, true);
  }
  f.line([x0, y1, zn], [x1, y1, zn], pal.key, 0.4 * lit, 1.25);

  // the frame: the back of its tunnel, the lit chamber seen through it, then its turned face
  plate(f, d.backO, d.backI, rgba(pal.bg, 0.94 * body));
  plate(f, d.backO, d.backI, rgba(pal.ink, 0.045 * body));
  f.path(d.backO, pal.ink, 0.15 * body, 1, true);
  plate(f, d.faceI, null, rgba(pal.key, 0.08 * lit));
  plate(f, d.backI, null, rgba(pal.key, (o.clear ? 0.14 : 0.08) * lit));
  if (o.clear) ledger(f, d, lit);
  plate(f, d.faceO, d.faceI, rgba(pal.bg, 0.96 * body));
  plate(f, d.faceO, d.faceI, steel(f, P(0, 0, ZF), 0.3 * body, 0.6));
  plate(f, d.bevel, d.faceI, rgba(pal.key, 0.1 * lit));
  f.path(d.faceO, pal.ink, 0.38 * body, 1.25, true);
  f.path(d.faceO.slice(Math.round(n * 0.14), Math.round(n * 0.4)), pal.key, 0.5 * lit, 1.5);
  if (!f.mobile && o.lead && f.q > 0.7) for (let k = 0; k < 16; k++) f.dot(P(1.165, (k + 0.5) * (TAU / 16), ZF), 0.011 * R, pal.ink, 0.34 * body);

  // light from behind the door edge: it catches the frame's inner edge, then the back edge of the slab
  f.path(d.faceI, pal.key, 0.34 * lit, 1, true);
  const rim = lit >= 1 ? d.edge : d.edge.slice(0, Math.max(2, Math.round(d.edge.length * lit)));
  f.path(rim, pal.key, 0.13 * lit, 7 * fine);
  trace(f, rim, pal.key, 0.95 * lit, 1.6, o.lead && lit >= 1 ? f.t / 18 + 0.5 : -1);

  // eight bolts, thrown across the lit gap into the frame
  const hw = 0.023;
  const reach = lerp(0.97, 1.078, thrown);
  for (let k = 0; k < 8; k++) {
    const ca = Math.cos(k * STEP);
    const sa = Math.sin(k * STEP);
    const q = (r: number, side: number): V3 => [c[0] + (ca * r - sa * hw * side) * R, c[1] + (sa * r + ca * hw * side) * R, c[2] + ZM * R];
    const bar = [q(0.9, -1), q(reach, -1), q(reach, 1), q(0.9, 1)];
    f.fill(bar, pal.bg, 0.94 * face);
    f.fill(bar, pal.ink, 0.3 * face);
    f.line(bar[3], bar[2], pal.ink, 0.7 * face, 1);
  }

  // the slab: its edge, the glass port, then the turned steel face
  plate(f, d.slabB, d.portB, rgba(pal.bg, 0.95 * face));
  plate(f, d.slabB, d.portB, rgba(pal.ink, 0.1 * face));
  plate(f, d.port, null, rgba(pal.bg, (o.clear ? 0.38 : 0.78) * face));
  const pc = f.P(c[0], c[1], c[2] + Z0 * R);
  if (pc && o.lead) {
    const rad = 0.82 * R * pc.s * f.u;
    const band = clamp(0.36 + f.px * 0.2 + (f.still ? 0 : Math.sin(f.t * 0.17) * 0.06), 0.12, 0.8);
    const g = ctx.createLinearGradient(pc.x - rad, pc.y - rad, pc.x + rad, pc.y + rad);
    g.addColorStop(band - 0.12, rgba(pal.ink, 0));
    g.addColorStop(band, rgba(pal.ink, 0.085 * face));
    g.addColorStop(band + 0.18, rgba(pal.ink, 0));
    plate(f, d.port, null, g);
  }
  plate(f, d.slab, d.port, rgba(pal.bg, 0.97 * face));
  plate(f, d.slab, d.port, steel(f, P(0, 0, Z0), 0.34 * face, -0.5));
  f.path(d.slab, pal.ink, 0.44 * face, 1.25, true);
  f.path(d.port, pal.ink, 0.3 * face, 1, true);
  if (o.lead) f.path(d.lens.slice(Math.round(n * 0.19), Math.round(n * 0.34)), pal.ink, 0.34 * face, 1.5);
  f.path(d.slab.slice(Math.round(n * 0.16), Math.round(n * 0.38)), pal.key, 0.42 * lit, 1.25);
  for (let k = 0; k < 8; k++) {
    f.dot(P(0.9, k * STEP, Z0), 0.02 * R, pal.ink, 0.5 * face);
    f.dot(P(0.9, k * STEP, Z0), 0.009 * R, pal.bg, 0.9 * face);
  }

  // locking rings over the glass; each carries one lit gate, and at rest the gates form a single line
  const hub0: V3 = [c[0], c[1], c[2] + ZR * R];
  const eng = o.clear ? 0.5 : 1;
  const turned = o.lead ? steel(f, hub0, (o.clear ? 0.05 : 0.15) * face, 1.9) : rgba(pal.ink, 0.04 * face);
  let first = 0;
  d.dials.forEach((dial, i) => {
    const off = turnOf(f, i);
    if (!i) first = off * STEP;
    plate(f, d.bands[i * 2], d.bands[i * 2 + 1], turned);
    ring(f, hub0, dial.r * R, { axis: "z", colour: pal.ink, alpha: (0.42 - i * 0.04) * eng * face, ticks: dial.ticks, major: dial.major, tickLen: 0.05 * R, rot: off * STEP });
    f.path(d.bands[i * 2 + 1], pal.ink, 0.14 * eng * face, 1, true);
    // the index lights whichever major mark stands in line with it: one leaves as the next arrives
    const part = off - Math.floor(off);
    for (const [gate, level] of [[part, 1 - part], [part - 1, part]]) {
      const a = idx + gate * STEP;
      if (level > 0.02) trace(f, [P(dial.r + 0.012, a, ZR), P(dial.r - 0.095, a, ZR)], mark, 0.92 * level * face, 2 * fine);
    }
  });

  // the index on the frame, where the gates come to rest
  if (o.gold) {
    f.glow(P(1.15, idx, ZF), 0.26 * R, pal.gold, 0.34 * thrown);
    f.fill([P(1.095, idx, ZF), P(1.205, idx - 0.027, ZF), P(1.205, idx + 0.027, ZF)], pal.gold, 0.95 * thrown);
  } else f.line(P(1.11, idx, ZF), P(1.21, idx, ZF), pal.key, 0.75 * thrown, 1.5);

  // hub wheel, standing proud of the door on its spindle
  const hub = P(0, 0, ZW);
  const wa = s.spin + first * 1.5 + (1 - face) * 0.8;
  f.line(P(0, 0, Z0), hub, pal.ink, 0.3 * face, 3.2 * fine);
  for (let k = 0; k < 5; k++) {
    const a = wa + (k * TAU) / 5;
    f.line(P(0.06, a, ZW), P(0.25, a, ZW), pal.ink, 0.55 * face, 2.25 * fine);
    f.dot(P(0.25, a, ZW), 0.0135 * R, pal.ink, 0.75 * face);
  }
  ring(f, hub, 0.195 * R, { axis: "z", colour: pal.ink, alpha: 0.66 * face, width: 2.5 * fine, seg: 44 });
  ring(f, hub, 0.195 * R, { axis: "z", colour: pal.key, alpha: 0.6 * lit, width: 2.5 * fine, from: 0.16, to: 0.4, seg: 44 });
  f.dot(hub, 0.07 * R, pal.bg, face);
  f.dot(hub, 0.07 * R, pal.ink, 0.16 * face);
  ring(f, hub, 0.07 * R, { axis: "z", colour: pal.ink, alpha: 0.5 * face, seg: 24 });
  lamp(f, hub, mark, thrown * (f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 0.9)), 0.017 * R);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const split = f.tag === "client-funds";
    const n = f.mobile ? 48 : 80;
    const R = split ? 0.84 : 0.93;
    const rest = (r: number) => FLOOR + SILL + 1.26 * r;
    const dials: Dial[] = f.mobile
      ? [{ r: 0.74, ticks: 48, major: 6 }, { r: 0.58, ticks: 40, major: 5 }, { r: 0.42, ticks: 24, major: 3 }]
      : [{ r: 0.74, ticks: 72, major: 9 }, { r: 0.58, ticks: 56, major: 7 }, { r: 0.42, ticks: 40, major: 5 }];
    const chambers = [build([split ? -0.63 : 0, rest(R), 0], R, n, engrave("CLIENT"), dials)];
    if (split) chambers.push(build([1.25, rest(0.37), 0], 0.37, n / 2, engrave("COMPANY"), [{ r: 0.72, ticks: 24, major: 3 }, { r: 0.5, ticks: 16, major: 2 }]));
    // the index sits on one of the three upper bolts, a different one from page to page
    return { chambers, split, idx: (1 + Math.floor(f.rnd(2) * 3)) / 8, spin: f.rnd(4) * TAU };
  },
  draw(f, s) {
    const { pal } = f;
    const turn = 0.34 + (f.rnd(1) - 0.5) * 0.08;
    f.aim(turn + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.035), 0.08, 6.4, f.mobile ? (s.split ? 0.56 : 0.7) : s.split ? 0.86 : 1);
    if (f.mobile) {
      f.cx = f.w * (s.split ? 0.52 : 0.56);
      f.cy = f.h * 0.27 + f.scroll * f.h * 0.12;
    }
    const clear = f.tag === "transparency" || f.tag === "data-methodology";
    const [main, side] = s.chambers;

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [main.c[0], FLOOR, 0.1], 2.4 * main.R, pal.key, 0.2 * f.boot);
    // what escapes at the door's edge falls on the deck in front of it
    if (!side) pool(f, [main.c[0] + 0.5 * main.R, FLOOR, -0.6], 1.1 * main.R, pal.key, 0.16 * f.on(0.5));

    chamber(f, main, s, { delay: 0, clear, gold: f.tag === "verify", lead: true });
    if (side) {
      // segregation: a wall of glass between the two, seen almost edge-on, and a name over each
      const x = (main.c[0] + 1.26 * main.R + side.c[0] - 1.26 * side.R) / 2;
      pool(f, [side.c[0], FLOOR, 0.1], 2.4 * side.R, pal.key, 0.14 * f.on(0.4));
      panel(f, [x, FLOOR + 0.62, 0.1], 1.5, 1.24, { yaw: Math.PI / 2 - turn - 0.13, on: f.on(0.4), colour: pal.gold, alpha: 0.75, glass: 0.03 });
      chamber(f, side, s, { delay: 0.3, clear: false, gold: false, lead: false });
      for (const d of s.chambers) {
        const own = d === main;
        f.label(d.name, [d.c[0], d.c[1] + 1.26 * d.R, d.c[2] + ZF * d.R], { align: "center", dy: -15, size: f.mobile ? 9 : 10, colour: own ? pal.gold : pal.ink2, alpha: 0.9 * f.on(own ? 0.6 : 0.8) });
      }
    }
  },
};

export default scene;
