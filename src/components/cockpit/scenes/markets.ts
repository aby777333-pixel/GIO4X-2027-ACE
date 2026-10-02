/**
 * MARKETS — the orrery.
 *
 * Six asset classes, one system: six machined, graduated rings about a common
 * glass core, each carrying one lit marker on a slim arm from the centre. The
 * assembly leans toward the visitor and every ring sits at its own slight
 * tilt, as the planes of an orrery do. FX rides the largest ring (the deepest
 * market); the others follow in the order the site lists them. Nothing here is
 * a quantity: the graduations are engraving, the speeds are those of clockwork.
 */
import { TAU, clamp, easeOut, rgba, type Frame, type Pt, type Scene, type V3 } from "../engine";
import { deck, lamp, orb, pool } from "../kit";

const DEG = Math.PI / 180;
/** the whole assembly leans its axis toward the viewer, so the rings open into ellipses */
const LEAN = 44 * DEG;
const CL = Math.cos(LEAN);
const SL = Math.sin(LEAN);
const C: V3 = [0, 0.12, 0];
const CORE = 0.26;
/** how thick the rings are machined */
const DEEP = 0.024;
const FLOOR = -1.3;

const NAMES = ["FX", "METALS", "INDICES", "ENERGY", "EQUITIES", "CRYPTO"];
/** each ring's own tilt out of the common plane, degrees: neighbours tip opposite ways, like gimbals */
const INC = [0, 3, -3.5, 4, -4.5, 5];
/** where each marker starts, in turns: 0 right, 0.25 far side, 0.5 left, 0.75 near side */
const PHASE = [0.91, 0.3, 0.63, 0.07, 0.8, 0.43];
/** brushed metal: two soft highlights across the instrument (position, strength) */
const SHEEN = [0, 0.14, 0.24, 0.62, 0.46, 0.2, 0.72, 0.44, 1, 0.12];

type Ring = { r: number; w: number; ticks: number; major: number };
type Orbit = Ring & { name: string; inc: number; node: number; period: number; phase: number };
/** a ring's plane: centre, two in-plane unit vectors (U to the right, V away from the viewer) and the normal */
type Basis = { c: V3; U: V3; V: V3; N: V3 };
type Tag = { text: string; p: V3; alpha: number };
type State = { orbits: Orbit[] };

/** the plane all six share, and the deck under the stand */
const COMMON: Basis = { c: C, U: [1, 0, 0], V: [0, SL, CL], N: [0, CL, -SL] };
const GROUND: Basis = { c: [0, FLOOR, 0], U: [1, 0, 0], V: [0, 0, 1], N: [0, 1, 0] };

function basis(o: Orbit, i: number, t: number): Basis {
  // each plane rocks very slowly about its own node, like a gimbal settling
  const om = o.node + 0.05 * TAU * Math.sin(t * 0.035 + i * 0.9);
  const inc = o.inc * (1 + 0.14 * Math.sin(t * 0.027 + i * 1.3));
  const [co, so, ci, si] = [Math.cos(om), Math.sin(om), Math.cos(inc), Math.sin(inc)];
  // the node line d, and the in-plane perpendicular m tipped out of the common plane by the ring's own tilt
  const d: V3 = [co, so * SL, so * CL];
  const m: V3 = [-so * ci, co * SL * ci + CL * si, co * CL * ci - SL * si];
  return {
    c: C,
    U: [co * d[0] - so * m[0], co * d[1] - so * m[1], co * d[2] - so * m[2]],
    V: [so * d[0] + co * m[0], so * d[1] + co * m[1], so * d[2] + co * m[2]],
    N: [so * si, CL * ci - co * SL * si, -SL * ci - co * CL * si],
  };
}

/** a point of a ring's plane: angle `a`, radius `r`, optionally `drop` below the face */
const at = (b: Basis, a: number, r: number, drop = 0): V3 => {
  const u = Math.cos(a) * r;
  const v = Math.sin(a) * r;
  return [b.c[0] + u * b.U[0] + v * b.V[0] - drop * b.N[0], b.c[1] + u * b.U[1] + v * b.V[1] - drop * b.N[1], b.c[2] + u * b.U[2] + v * b.V[2] - drop * b.N[2]];
};
const proj = (f: Frame, p: V3): Pt | null => f.P(p[0], p[1], p[2]);
/** the near half of the core's equator */
const EQUATOR = Array.from({ length: 25 }, (_, i) => at(COMMON, Math.PI * (1 + i / 24), CORE));

/** add an arc of a ring to the current canvas path */
function sweep(f: Frame, b: Basis, r: number, a0: number, a1: number, n: number, join = false, drop = 0): void {
  for (let i = 0; i <= n; i++) {
    const p = proj(f, at(b, a0 + ((a1 - a0) * i) / n, r, drop));
    if (!p) continue;
    if (i || join) f.ctx.lineTo(p.x, p.y);
    else f.ctx.moveTo(p.x, p.y);
  }
}

/**
 * A machined ring between two angles: a flat face with a brushed sheen and
 * graduations cut into it, a bright outer edge, and the wall that shows its
 * thickness (the outer wall on the near half, the inner wall on the far half).
 */
function band(f: Frame, b: Basis, o: Ring, a0: number, a1: number, sheen: CanvasGradient, level: number, near: boolean, rim = ""): void {
  if (level <= 0.003 || a1 - a0 < 0.01) return;
  const { ctx } = f;
  const n = Math.max(8, Math.round((f.mobile ? 30 : 44) * (0.5 + 0.5 * f.q) * ((a1 - a0) / Math.PI)));
  const r0 = o.r - o.w / 2;
  const r1 = o.r + o.w / 2;
  const wall = near ? r1 : r0;
  // a closed strip between two arcs: smoked body first, then the sheen
  const slab = (ra: number, rb: number, drop: number, shine: number) => {
    ctx.beginPath();
    sweep(f, b, ra, a0, a1, n);
    sweep(f, b, rb, a1, a0, n, true, drop);
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(f.pal.bg, 0.6 * level);
    ctx.fill();
    ctx.globalAlpha = shine * level;
    ctx.fillStyle = sheen;
    ctx.fill();
  };
  const edge = (r: number, style: string | CanvasGradient, alpha: number, width: number) => {
    ctx.beginPath();
    sweep(f, b, r, a0, a1, n);
    ctx.strokeStyle = style;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  ctx.save();
  slab(wall, wall, DEEP, 0.42); // the wall catches the light edge-on
  slab(r1, r0, 0, 0.22); // the face
  edge(r1, sheen, level, 1.25);
  edge(r0, sheen, level * 0.5, 1);
  if (o.ticks) {
    // all the graduations of this half in one stroke (none on the join between the two halves);
    // a phone or a slow device keeps the majors only
    const step = f.mobile || f.q < 0.75 ? o.major : 1;
    ctx.globalAlpha = level * 0.8;
    ctx.beginPath();
    for (let k = 0; k < o.ticks; k += step) {
      const a = ((k + 0.5) / o.ticks) * TAU;
      if (a < a0 || a >= a1) continue;
      const p = proj(f, at(b, a, r0));
      const q = proj(f, at(b, a, r0 + o.w * (k % o.major === 0 ? 0.82 : 0.42)));
      if (!p || !q) continue;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  }
  // the largest ring carries the key light along its outer edge
  if (rim) edge(r1 + 0.032, rgba(rim, 0.55 * level), 1, 1.25);
  ctx.restore();
}

/** The marker riding a ring: an arm from the core, the lit stretch of rim behind it, an index and a lamp. */
function rider(f: Frame, b: Basis, o: Orbit, a: number, colour: string, level: number, breathe: number): void {
  if (level <= 0.003) return;
  const { ctx, pal } = f;
  const r0 = o.r - o.w / 2;
  const r1 = o.r + o.w / 2;
  f.line(at(b, a, CORE + 0.035), at(b, a, r0 - 0.03), pal.ink, 0.16 * level, 1);
  // the lamp lights the rim it has just travelled: brightest at the marker, fading behind it
  const n = f.mobile ? 5 : 8;
  const da = 0.017 * TAU;
  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineWidth = 1.75;
  for (let j = 0; j < n; j++) {
    ctx.beginPath();
    sweep(f, b, r1, a - j * da, a - (j + 1) * da, 3);
    ctx.strokeStyle = rgba(colour, 0.9 * (1 - j / n) ** 2 * level);
    ctx.stroke();
  }
  ctx.restore();
  f.line(at(b, a, r0 - 0.03), at(b, a, r1 + 0.03), pal.ink, 0.85 * level, 1.5);
  lamp(f, at(b, a, o.r), colour, level * breathe, o.w > 0.08 ? 0.028 : 0.022);
}

/**
 * Names beside their markers, in the house lettering, each on a small pad of
 * smoked glass so it never fights the graduations under it. A name rises clear
 * of a neighbour's marker, and two names are parted only if they really overlap.
 */
function tags(f: Frame, items: readonly Tag[]): void {
  const { ctx, pal } = f;
  const reach = 16;
  const gap = 17;
  ctx.save();
  ctx.font = `600 11px ${pal.font}`;
  const pts = items.map((it) => proj(f, it.p));
  const slots = [];
  for (let i = 0; i < items.length; i++) {
    const p = pts[i];
    if (!p) continue;
    const w = ctx.measureText(items[i].text).width;
    // on the outside of its marker; a name that would leave the stage on the right turns inward
    const dir = p.x >= f.cx && p.x + reach + w + 8 < f.w ? 1 : -1;
    const x0 = p.x + (dir > 0 ? reach : -reach - w) - 6;
    const x1 = x0 + w + 12;
    // no name reaches into the statement's column on the left
    const alpha = items[i].alpha * clamp((x0 - 596) / 24);
    if (alpha <= 0.02) continue;
    let ly = p.y;
    for (const q of pts) {
      if (!q || q === p) continue;
      const inside = Math.min(q.x - x0, x1 - q.x, 14 - Math.abs(q.y - p.y));
      if (inside > 0) ly = Math.min(ly, p.y + clamp(inside / 6) * (q.y - gap - p.y));
    }
    slots.push({ text: items[i].text, at: items[i].p, p, w, dir, alpha, ly, x0, x1 });
  }
  // names only ever move upward, so the two rules never fight: lowest first, each clearing those below it
  slots.sort((a, b) => b.ly - a.ly);
  for (let i = 1; i < slots.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = slots[j];
      const b = slots[i];
      if (b.x0 < a.x1 && a.x0 < b.x1 && a.ly - b.ly < gap) b.ly = a.ly - gap;
    }
  }
  for (const s of slots) {
    const lx = s.p.x + s.dir * reach;
    ctx.beginPath();
    ctx.moveTo(lx + s.dir * 2, s.ly);
    ctx.lineTo(lx + s.dir * (s.w - 2), s.ly);
    ctx.strokeStyle = rgba(pal.bg, 0.62 * s.alpha);
    ctx.lineWidth = 17;
    ctx.stroke();
    f.label(s.text, s.at, { dx: s.dir * reach, dy: s.ly - s.p.y, align: s.dir > 0 ? "left" : "right", size: 11, colour: pal.ink, alpha: 0.9 * s.alpha });
  }
  ctx.restore();
}

const scene: Scene<State> = {
  // the composed still is the opening position: every marker where it starts
  pose: 0,
  setup(f) {
    return {
      orbits: NAMES.map((name, i) => ({
        name,
        r: i === 0 ? 1.42 : 1.2 - (i - 1) * 0.16,
        w: i === 0 ? 0.095 : 0.055,
        ticks: 12 * (8 - i),
        major: 8 - i,
        inc: INC[i] * DEG,
        node: (0.25 + (f.rnd(i + 20) - 0.5) * 0.09) * TAU,
        period: 250 - i * 32,
        phase: (PHASE[i] + (f.rnd(i) - 0.5) * 0.03) * TAU,
      })),
    };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    // a narrow desktop stage gets a smaller instrument, kept against the right so the statement stays clear
    const zoom = f.mobile ? 0.72 : 0.92 * clamp(f.w / 1320, 0.78, 1);
    f.aim(-0.1 + Math.sin(f.t * 0.06) * 0.045, 0.14, 6.4, zoom);
    if (f.mobile) [f.cx, f.cy] = [f.w * 0.5, f.h * 0.29];
    else f.cx += (0.92 - zoom) * 1.5 * f.u;
    const k = f.u * zoom;

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, GROUND.c, 2.5, pal.key, 0.2 * f.boot);

    // one sheen shared by every ring, laid across the instrument from the upper left
    const sheen = ctx.createLinearGradient(f.cx - 1.45 * k, f.cy - 0.85 * k, f.cx + 1.45 * k, f.cy + 0.6 * k);
    for (let i = 0; i < SHEEN.length; i += 2) sheen.addColorStop(SHEEN[i], rgba(pal.ink, SHEEN[i + 1]));

    // the stand: a graduated plate and a foot on the deck, a slim post up to the core.
    // On a phone the instrument simply floats over its pool: nothing fine sits low, behind the statement.
    const core = f.on(0, 0.3);
    if (!f.mobile) {
      band(f, GROUND, { r: 1.2, w: 0.03, ticks: 60, major: 10 }, 0, TAU, sheen, 0.5 * f.boot, true);
      band(f, { ...GROUND, c: [0, FLOOR + DEEP * 2, 0] }, { r: 0.17, w: 0.2, ticks: 0, major: 1 }, 0, TAU, sheen, 0.8 * core, true);
      const top = C[1] - CORE + 0.02;
      f.fill([[-0.026, FLOOR, 0], [0.026, FLOOR, 0], [0.012, top, 0], [-0.012, top, 0]], pal.ink, 0.08 * core);
      f.line([-0.026, FLOOR, 0], [-0.012, top, 0], pal.ink, 0.36 * core, 1);
      f.line([0.026, FLOOR, 0], [0.012, top, 0], pal.ink, 0.16 * core, 1);
    }

    const tones = [pal.blue, pal.teal, pal.emerald];
    const live = s.orbits.map((o, i) => {
      const j = 5 - i; // power-on runs from the core outward: each ring draws itself in, then its lamp comes up
      const a = (((o.phase + (f.t / o.period) * TAU) % TAU) + TAU) % TAU;
      return {
        o,
        a,
        b: basis(o, i, f.t),
        open: easeOut((f.boot - 0.1 - j * 0.12) / 0.28),
        lit: easeOut((f.boot - 0.3 - j * 0.12) / 0.1),
        back: Math.sin(a) > 0,
        colour: i === 0 ? pal.key : tones[i % 3],
        rim: i === 0 ? pal.key : "",
        breathe: f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 0.9 + i * 1.7),
      };
    });

    // far halves, outermost first
    for (const m of live) {
      band(f, m.b, m.o, 0, Math.PI * m.open, sheen, 0.84 * m.open, false, m.rim);
      if (m.back) rider(f, m.b, m.o, m.a, m.colour, 0.84 * m.lit, m.breathe);
    }

    // the common centre: a glass core, its equator engraved in the common plane, and inside it
    // a lamp whose light just reaches the innermost ring
    orb(f, C, CORE, pal.key, core);
    f.path(EQUATOR, pal.ink, 0.24 * core, 1);
    f.glow(C, 0.44, pal.key, 0.4 * core * (f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.7)));
    f.dot(C, 0.032, pal.key, core);
    f.dot(C, 0.0135, pal.ink, 0.75 * core);

    // near halves, innermost first
    const names: Tag[] = [];
    for (let i = live.length - 1; i >= 0; i--) {
      const m = live[i];
      band(f, m.b, m.o, TAU - Math.PI * m.open, TAU, sheen, m.open, true, m.rim);
      if (!m.back) rider(f, m.b, m.o, m.a, m.colour, m.lit, m.breathe);
      const here = at(m.b, m.a, m.o.r);
      const p = proj(f, here);
      // a name changes side as its marker passes the centre line: let it fade there rather than jump
      if (p) names.push({ text: m.o.name, p: here, alpha: m.lit * clamp((Math.abs(p.x - f.cx) - 8) / 26) });
    }

    // the axis the whole system turns about, leaning toward the viewer
    const tip = at(COMMON, 0, 0, -0.52);
    f.line(at(COMMON, 0, 0, -CORE), tip, pal.ink, 0.5 * core, 1.25);
    f.dot(tip, 0.014, pal.key, 0.9 * core);

    if (!f.mobile) tags(f, names);
  },
};

export default scene;
