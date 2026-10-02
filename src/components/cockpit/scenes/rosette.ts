/**
 * ROSETTE — the house emblem, machined.
 *
 * The GIO4X mark is a rosette: a pinwheel of overlapping blades about a point.
 * Here it is built as an instrument. Eight, ten or thirteen identical blades of
 * glass, each a closed petal made of two circular arcs whose radii stand in the
 * golden ratio, are pitched like turbine blades and turn very slowly inside a
 * fixed, graduated bezel. Three lamps on the bezel carry the brand's colours
 * (teal, blue, emerald) and every blade takes its light from the lamp it is
 * passing, so the emblem's gradient stays put while the rotor turns through it.
 * A shroud ring cuts the blades at 0.618 of the bezel's radius.
 *
 * Nothing here is data. On a company page, that page's own blade is the one
 * picked out in champagne and named on the bezel.
 */
import { TAU, clamp, easeOut, lerp, rgba, type Frame, type Pt, type Scene, type V3 } from "../engine";
import { deck, lamp, orb, pool } from "../kit";

const G = 2 / (1 + Math.sqrt(5)); // 1 / phi
const R = 1.12; // the bezel
const TIP = R * 0.9; // blade tips
const SHROUD = R * G; // the golden ring
const HUB = R * G * G * G;
const DEPTH = 0.2; // how deep the bezel's barrel is
const CY = 0.05; // the instrument hangs just clear of the deck
/** the company pages: each one owns a blade */
const PAGES: [slug: string, name: string][] = [
  ["about", "ABOUT"], ["why-gio4x", "WHY GIO4X"], ["what-we-are", "WHAT WE ARE"], ["careers", "CAREERS"],
  ["media", "MEDIA"], ["design", "DESIGN"], ["whats-new", "WHAT’S NEW"], ["preferences", "PREFERENCES"],
];

type Line = readonly (Pt | null)[];
type Blade = { lead: Line; trail: Line; colour: string; lit: number; own: boolean };
type State = { n: number; phase: number; own: number; root: V3; lead: V3[]; trail: V3[]; minor: V3[]; major: V3[] } & Record<
  "rim" | "lip" | "back" | "well" | "annulus" | "shroud" | "band" | "hub" | "glint" | "glint2",
  V3[]
>;

const polar = (r: number, a: number, z = 0): V3 => [Math.cos(a) * r, CY + Math.sin(a) * r, z];
/** a circle facing the viewer, from the top, clockwise: the order the lamps light in */
const circle = (r: number, z: number, n: number): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) out.push(polar(r, TAU / 4 - (i / n) * TAU, z));
  return out;
};

const seen = new Map<string, number[] | null>();
/** a palette token as numbers (tokens arrive as #rgb, #rrggbb or rgb()) */
function parts(c: string): number[] | null {
  let v = seen.get(c);
  if (v === undefined) {
    const s = c.trim();
    const h = s[0] !== "#" ? "" : s.length <= 5 ? s.slice(1, 4).replace(/./g, "$&$&") : s.slice(1, 7);
    const m = h ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) : (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    v = m.length === 3 && m.every((x) => x >= 0) ? m : null;
    seen.set(c, v);
  }
  return v;
}
/** one palette colour part-way to another: the emblem's gradient, made from the tokens */
function mix(a: string, b: string, t: number): string {
  const p = parts(a);
  const q = parts(b);
  if (!p || !q) return t < 0.5 ? a : b;
  return `rgb(${[0, 1, 2].map((i) => Math.round(lerp(p[i], q[i], t))).join(",")})`;
}

/** one stroke through projected points; a null lifts the pen */
function stroke(f: Frame, pts: Line, colour: string, alpha: number, width: number, from = 0): void {
  if (alpha <= 0.003) return;
  const { ctx } = f;
  ctx.beginPath();
  let pen = false;
  for (let i = from; i < pts.length; i++) {
    const p = pts[i];
    if (p && pen) ctx.lineTo(p.x, p.y);
    else if (p) ctx.moveTo(p.x, p.y);
    pen = !!p;
  }
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

/** add a closed outline (out along `a`, back along `b`) to the current path */
function outline(f: Frame, a: Line, b: Line = []): boolean {
  for (let i = 0; i < a.length + b.length; i++) {
    const p = i < a.length ? a[i] : b[b.length - 1 - (i - a.length)];
    if (!p) return false;
    if (i) f.ctx.lineTo(p.x, p.y);
    else f.ctx.moveTo(p.x, p.y);
  }
  f.ctx.closePath();
  return true;
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = [8, 10, 13][Math.floor(f.rnd(3) * 3) % 3];
    const own = PAGES.findIndex((p) => p[0] === f.tag);
    // one blade, tip at angle 0: a chord from the hub out to the tip, with an arc bowed to either
    // side of it. The root sits round the hub from the tip, the way the emblem's blades lean.
    const rx = Math.cos(1) * HUB * 0.9;
    const ry = Math.sin(1) * HUB * 0.9;
    const dx = TIP - rx;
    const dy = -ry;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    // the two arcs: radii in the golden ratio. More blades, slimmer blades.
    const tight = len * lerp(0.56, 0.62, (n - 8) / 5);
    const bow = (rho: number, t: number) => Math.sqrt(rho * rho - Math.pow(len * (t - 0.5), 2)) - Math.sqrt(rho * rho - len * len * 0.25);
    const m = f.mobile ? 10 : 16;
    const lead: V3[] = [];
    const trail: V3[] = [];
    for (let i = 0; i <= m; i++) {
      const t = i / m;
      // pitched like a turbine blade: steep at the root, flatter at the tip. The rounder edge stands nearer.
      const pitch = lerp(1.0, 0.5, t);
      const a = bow(tight, t);
      const b = bow(tight / G, t);
      const cx = rx + dx * t;
      const cy = ry + dy * t;
      lead.push([cx + nx * a * Math.cos(pitch), cy + ny * a * Math.cos(pitch), -a * Math.sin(pitch)]);
      trail.push([cx - nx * b * Math.cos(pitch), cy - ny * b * Math.cos(pitch), b * Math.sin(pitch)]);
    }
    const seg = f.mobile ? 48 : 84;
    const rim = circle(R, 0, seg);
    const lip = circle(R * 0.94, 0, seg);
    // graduations: twelve long marks, short ones between; the three lamps take the place of a long mark
    const ticks = f.mobile ? 36 : 60;
    const minor: V3[] = [];
    const major: V3[] = [];
    for (let i = 0; i < ticks; i++) {
      const a = TAU / 4 - (i / ticks) * TAU;
      if (i % (ticks / 12)) minor.push(polar(R * 0.955, a), polar(R * 0.978, a));
      else if (i % (ticks / 3)) major.push(polar(R * 0.948, a), polar(R * 0.992, a));
    }
    return {
      n,
      // the page's blade starts high on the right, clear of the headline; otherwise anywhere
      phase: own >= 0 ? 0.55 + f.rnd(5) * 0.6 + (own / n) * TAU : f.rnd(5) * TAU,
      own,
      root: [rx, ry, 0],
      lead,
      trail,
      minor,
      major,
      rim,
      lip,
      back: circle(R, DEPTH, seg),
      well: circle(R * 0.94, DEPTH, seg),
      annulus: [...rim, ...lip.slice().reverse()],
      shroud: circle(SHROUD + 0.013, -0.03, seg),
      band: [...circle(SHROUD + 0.013, -0.03, seg), ...circle(SHROUD - 0.013, -0.03, seg).reverse()],
      hub: circle(HUB, -0.04, seg / 2),
      // where the rim catches the light: upper left, and its echo lower right
      glint: rim.slice(Math.round(seg * 0.79), Math.round(seg * 0.97)),
      glint2: rim.slice(Math.round(seg * 0.3), Math.round(seg * 0.45)),
    };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    f.aim(0.5 + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.05), 0.1, 6, f.mobile ? 0.76 : 0.97);
    // on a phone the instrument is a backdrop: keep it clear of the statement below it
    if (f.mobile) f.cy -= f.h * 0.07;
    const proj = (v: V3) => f.P(v[0], v[1], v[2]);

    const floor = -1.3;
    deck(f, { y: floor, alpha: 0.12 });
    pool(f, [0, floor, DEPTH / 2], 2.2, pal.key, 0.24 * f.boot);

    // the bezel's barrel, and the smoked glass it holds
    const body = f.on(0, 0.4);
    f.fill(s.back, pal.bg, 0.62 * body);
    f.fill(s.back, pal.ink, 0.1 * body);
    f.path(s.back, pal.ink, 0.22 * body, 1);
    f.fill(s.lip, pal.bg, 0.72 * body);
    f.fill(s.lip, pal.key, 0.035 * body);
    f.path(s.well, pal.ink, 0.13 * body, 1);
    // its face: brushed metal, lighter where it turns to the light
    const m0 = f.P(-R, CY + R, 0);
    const m1 = f.P(R, CY - R, 0);
    if (m0 && m1) {
      const metal = ctx.createLinearGradient(m0.x, m0.y, m1.x, m1.y);
      metal.addColorStop(0.12, rgba(pal.ink, 0.2 * body));
      metal.addColorStop(0.4, rgba(pal.ink, 0.045 * body));
      metal.addColorStop(0.68, rgba(pal.ink, 0.13 * body));
      metal.addColorStop(0.9, rgba(pal.ink, 0.03 * body));
      f.fill(s.annulus, pal.bg, 0.7 * body);
      ctx.beginPath();
      if (outline(f, s.annulus.map(proj))) {
        ctx.fillStyle = metal;
        ctx.fill();
      }
    }

    // three lamps on the bezel carry the emblem's colours; their light falls into the glass
    const stops = [pal.teal, pal.blue, pal.emerald];
    const lamps = stops.map((colour, i) => ({ colour, a: TAU / 4 - (i / 3) * TAU, on: easeOut((f.boot - 0.55 - i * 0.12) / 0.2) }));
    for (const l of lamps) f.glow(polar(R * 0.78, l.a), 0.62, l.colour, 0.13 * l.on);
    /** how far round the bezel an angle is, clockwise from the top lamp, 0..1 */
    const round = (a: number) => (((0.25 - a / TAU) % 1) + 1) % 1;
    const tint = (a: number): string => {
      // in small steps, so the turning rotor does not mint a new colour every frame
      const h = (Math.round(round(a) * 72) % 72) / 24;
      const i = Math.floor(h);
      const t = h - i;
      return mix(stops[i], stops[(i + 1) % 3], t * t * (3 - 2 * t));
    };

    // the rotor: clockwise, one turn in about five minutes
    const spin = s.phase - f.t * 0.02 - f.px * 0.08;
    // powering on, the blades open one after another, clockwise from the top
    const wake = (a: number) => f.on(0.1 + 0.62 * round(a), 0.3);
    const blades: Blade[] = [];
    for (let i = 0; i < s.n; i++) {
      const a = spin - (i / s.n) * TAU;
      const on = wake(a);
      if (on <= 0.01) continue;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // each one grows out of the hub
      const put = (p: V3): Pt | null => {
        const x = s.root[0] + (p[0] - s.root[0]) * on;
        const y = s.root[1] + (p[1] - s.root[1]) * on;
        return f.P(x * ca - y * sa, CY + x * sa + y * ca, p[2] * on);
      };
      const own = i === s.own;
      // the bezel faces a little left: blades on the right are nearer, and brighter
      const near = lerp(0.55, 1, (Math.cos(a + 0.3) + 1) / 2);
      blades.push({ lead: s.lead.map(put), trail: s.trail.map(put), colour: own ? pal.gold : tint(a + 0.25), lit: on * near, own });
    }
    // glass first: where blades overlap the glass deepens, as in the emblem
    for (const b of blades) {
      ctx.beginPath();
      if (!outline(f, b.lead, b.trail)) continue;
      ctx.fillStyle = rgba(b.colour, (b.own ? 0.15 : 0.085) * b.lit);
      ctx.fill();
    }
    // one band of reflected light lies across all the blades and stays put while they turn under it
    const g0 = f.P(-TIP, CY + TIP, 0);
    const g1 = f.P(TIP, CY - TIP, 0);
    if (g0 && g1 && blades.length) {
      const at = clamp(0.4 + f.px * 0.2 + (f.still ? 0 : Math.sin(f.t * 0.19) * 0.05), 0.2, 0.8);
      const sheen = ctx.createLinearGradient(g0.x, g0.y, g1.x, g1.y);
      sheen.addColorStop(at - 0.2, rgba(pal.ink, 0));
      sheen.addColorStop(at, rgba(pal.ink, 0.1 * f.boot));
      sheen.addColorStop(at + 0.13, rgba(pal.ink, 0));
      ctx.save();
      ctx.beginPath();
      for (const b of blades) outline(f, b.lead, b.trail);
      ctx.clip();
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, f.w, f.h);
      ctx.restore();
    }
    // far edges quietly, then the near edges lit
    for (const b of blades) stroke(f, b.trail, b.colour, 0.3 * b.lit, 1);
    for (const b of blades) {
      const a = (b.own ? 0.95 : s.own >= 0 ? 0.6 : 0.72) * b.lit;
      const w = b.own ? 1.8 : 1.3;
      if (f.q > 0.6) stroke(f, b.lead, b.colour, a * 0.16, w * 4.5);
      stroke(f, b.lead, b.colour, a, w);
      // the outer half of the edge catches the light
      stroke(f, b.lead, pal.ink, 0.2 * b.lit, 1, b.lead.length >> 1);
    }

    // the golden ring: a shroud band through the blades at 0.618 of the bezel
    const ringOn = easeOut((f.boot - 0.35) / 0.5);
    f.fill(s.band, pal.ink, 0.09 * ringOn);
    f.path(s.band, pal.ink, 0.2 * ringOn, 1);
    f.path(s.shroud, pal.ink, 0.44 * ringOn, 1.1);

    // the hub: a machined seat over the blade roots, a ball of smoked glass in it
    f.fill(s.hub, pal.bg, 0.78 * body);
    f.fill(s.hub, pal.ink, 0.06 * body);
    f.path(s.hub, pal.ink, 0.36 * body, 1);
    orb(f, [0, CY, -0.1], HUB * G, pal.key, body);
    if (f.tag === "design") f.label("φ", [0, CY, -0.1], { align: "center", size: f.mobile ? 12 : 15, alpha: 0.34 * f.boot, colour: pal.ink, weight: 400, display: true });

    // the fixed bezel: two machined edges, graduations between them, three lamps
    const ticks = (v: V3[]): Line => v.flatMap((p, i) => (i % 2 ? [proj(p), null] : [proj(p)]));
    f.path(s.rim, pal.ink, 0.4 * body, 1.5);
    f.path(s.glint, pal.ink, 0.42 * body, 2);
    f.path(s.glint2, pal.ink, 0.2 * body, 2);
    f.path(s.lip, pal.ink, 0.24 * body, 1);
    stroke(f, ticks(s.minor), pal.ink, 0.22 * body, 1);
    stroke(f, ticks(s.major), pal.ink, 0.5 * body, 1.25);
    lamps.forEach((l, i) => lamp(f, polar(R * 0.97, l.a, -0.015), l.colour, l.on * (f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 0.9 + i * 2.1)), 0.02));

    // this page's blade, indexed on the bezel and named; the name fades as it nears the headline's side or the stage edge
    const turn = spin - (s.own / s.n) * TAU;
    const mark = s.own >= 0 && !f.mobile ? proj(polar(R * 1.058, turn)) : null;
    if (mark) {
      const side = Math.cos(turn);
      const name = PAGES[s.own][1];
      const room = side > 0.3 ? f.w - mark.x - name.length * 7.5 - 12 : 24;
      const show = wake(turn) * clamp((side + 0.5) / 0.4);
      f.line(polar(R * 1.014, turn), polar(R * 1.058, turn), pal.gold, 0.9 * show, 1.5);
      const align = side > 0.3 ? "left" : side < -0.3 ? "right" : "center";
      f.label(name, polar(R * 1.058, turn), { colour: pal.gold, alpha: 0.85 * show * clamp(room / 24), size: 10, align, dx: side * 9, dy: -Math.sin(turn) * 11 });
    }
  },
};

export default scene;
