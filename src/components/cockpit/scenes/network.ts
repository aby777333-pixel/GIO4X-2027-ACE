/**
 * NETWORK — the introducer tree.
 *
 * Three levels laid out in depth on the deck: at the back the house itself, a
 * glass orb held in a ported collar; on the middle rail the partners, a lamp on
 * a small plinth each; in front of every partner the clients they introduced.
 * Light travels inward along the fibres (an introduction) and a fainter bead
 * travels back out (support). On the money-managers page one node is a manager:
 * larger, in champagne, with its allocated accounts on the rim of its own plate.
 *
 * Nothing is counted or priced: no commissions, no rebates, no figures.
 */
import { TAU, clamp, lerp, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, orb, pool, ring, trace } from "../kit";

const FLOOR = -1.3;
const HUB: V3 = [0, 0.15, 1.15];
const HR = 0.36;
/** the ported collar the orb sits in: every partner's fibre lands on it */
const COLLAR = 0.52;
const COLLAR_Y = HUB[1] - 0.14;
/** the partner rail, how far a partner's clients stand in front of it, a manager's plate */
const R1 = 1.32;
const FAN = 0.82;
const PLATE = 0.42;
/** shares of a client's cycle: on its own fibre, then on the partner's; and of the return */
const IN = 0.26;
const UP = 0.28;
const OUT = 0.34;

type Client = { p: V3; link: V3[]; seat: V3[]; ph: number; T: number; u: number };
type Partner = {
  a: number;
  base: V3;
  head: V3;
  half: number;
  top: number;
  /** half the opening of this partner's fan */
  spread: number;
  link: V3[];
  seat: V3[];
  clients: Client[];
  manager: boolean;
  ph: number;
  T: number;
  order: number;
  lit: number;
  v: number;
};
type State = { partners: Partner[]; named: Partner; reach: number; rail: V3[]; dais: V3[] };

/** position on the deck plan: `a` is the bearing from `c`, 0 pointing at the viewer */
const polar = (c: V3, r: number, a: number, y: number): V3 => [c[0] + Math.sin(a) * r, y, c[2] - Math.cos(a) * r];
/** a bearing as a turn on a kit ring lying on the deck */
const turn = (a: number) => a / TAU - 0.25;
const swell = (seconds: number) => Math.exp(-(seconds * seconds) / 3);
const ends = (k: number) => Math.min(1, k * 7, (1 - k) * 7);

function circle(c: V3, r: number, n: number): V3[] {
  const pts: V3[] = [];
  for (let i = 0; i < n; i++) pts.push(polar(c, r, (i / n) * TAU, c[1]));
  return pts;
}

/** a fibre: leaves and arrives level, changing height in between */
function sweep(a: V3, b: V3, n: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t * t * (3 - 2 * t)), lerp(a[2], b[2], t)]);
  }
  return out;
}

function along(pts: readonly V3[], t: number): V3 {
  const x = clamp(t) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(x));
  const a = pts[i];
  const b = pts[i + 1];
  return [lerp(a[0], b[0], x - i), lerp(a[1], b[1], x - i), lerp(a[2], b[2], x - i)];
}

/** a bead of light on a fibre: no gradient, three small discs */
function bead(f: Frame, p: V3, colour: string, a: number, r: number): void {
  f.dot(p, r * 3.4, colour, 0.15 * a);
  f.dot(p, r * 1.8, colour, 0.4 * a);
  f.dot(p, r, f.pal.ink, 0.95 * a);
}

/**
 * A machined block of smoked glass, seen from the front right: solid faces that
 * hide what stands behind, light falling down the front from the lamp it
 * carries, and only the edges that face the viewer.
 */
function block(f: Frame, c: V3, h: number, top: number, colour: string, on: number, dim = 1): void {
  const [x, y, z] = c;
  const a: V3 = [x - h, y, z - h];
  const b: V3 = [x + h, y, z - h];
  const d: V3 = [x + h, y, z + h];
  const A: V3 = [x - h, top, z - h];
  const B: V3 = [x + h, top, z - h];
  const D: V3 = [x + h, top, z + h];
  const E: V3 = [x - h, top, z + h];
  const mid = lerp(top, y, 0.45);
  f.fill([a, b, d, D, E, A], f.pal.bg, 0.86 * on);
  const lit = on * dim;
  f.fill([a, b, B, A], colour, 0.07 * lit);
  f.fill([[x - h, mid, z - h], [x + h, mid, z - h], B, A], colour, 0.1 * lit);
  f.fill([b, d, D, B], colour, 0.035 * lit);
  f.fill([A, B, D, E], colour, 0.3 * lit);
  f.path([A, a, b, d, D], f.pal.ink, 0.26 * lit);
  f.line(b, B, f.pal.ink, 0.36 * lit);
  f.path([A, B, D, E], colour, 0.75 * lit, 1, true);
}

/** the fibres from a node out to its clients, the client points, and the light on those fibres */
function fanOut(f: Frame, p: Partner, colour: string, on: number, dim: number, wake: number): void {
  if (on <= 0) return;
  for (const c of p.clients) {
    const pts = on < 1 ? c.link.slice(0, Math.max(2, Math.ceil(on * c.link.length))) : c.link;
    f.path(pts, colour, (p.manager ? 0.5 : 0.34) * dim, 1);
    if (on < 1) continue;
    if (p.manager) f.dot(c.p, 0.04, colour, 0.16);
    else {
      // a client is a pin standing in its own small seat
      f.path(c.seat, colour, 0.34 * dim, 1, true);
      f.line([c.p[0], FLOOR, c.p[2]], c.p, f.pal.ink, 0.36 * dim, 1);
    }
    f.dot(c.p, p.manager ? 0.017 : 0.014, p.manager ? colour : f.pal.ink, 0.88 * dim);
    if (c.u >= 0 && c.u < IN) bead(f, along(c.link, 1 - c.u / IN), colour, wake * ends(c.u / IN), 0.009);
    const back = (p.v - OUT) / 0.26;
    if (back > 0 && back < 1 && !f.mobile && f.q > 0.7) bead(f, along(c.link, back), f.pal.ink, 0.3 * wake * ends(back), 0.007);
  }
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const m = f.mobile;
    const n = m ? 5 : 5 + (f.rnd(3) > 0.5 ? 1 : 0);
    const mi = f.tag === "money-managers" ? 1 + Math.floor(f.rnd(7) * (n - 2)) : -1;
    const reach = ((n === 6 ? 52 : 47) * Math.PI) / 180;
    // a manager is given more room on the rail than a partner
    const weight = (i: number) => (i === mi ? 2 : 1);
    const at: number[] = [0];
    for (let i = 1; i < n; i++) at.push(at[i - 1] + (weight(i - 1) + weight(i)) / 2);
    const unit = (2 * reach) / at[n - 1];
    // the widest a fan may open before it meets its neighbour's
    const widest = Math.asin(clamp((0.36 * (R1 + FAN) * unit) / FAN, 0, 0.7));

    const partners: Partner[] = at.map((d, i) => {
      const manager = i === mi;
      const a = -reach + d * unit;
      const half = manager ? 0.1 : 0.078;
      const top = FLOOR + (manager ? 0.46 : 0.3);
      const base = polar(HUB, manager ? R1 + 0.16 : R1, a, FLOOR);
      const head: V3 = [base[0], top + (manager ? 0.13 : 0.05), base[2]];
      const count = manager ? (m ? 5 : 6 + Math.floor(f.rnd(40) * 2)) : m ? 3 : 3 + Math.floor(f.rnd(20 + i) * 3);
      // a partner with more clients opens a wider fan
      const spread = m ? widest * 0.8 : widest * (0.55 + 0.225 * (count - 3));
      const clients: Client[] = [];
      for (let j = 0; j < count; j++) {
        // a partner's clients fan out in front of it; a manager's accounts sit on the rim of its plate
        const b = manager ? ((j + 0.5) / count) * TAU : a + spread * ((2 * j) / (count - 1) - 1);
        const p = polar(base, manager ? PLATE : FAN, b, FLOOR + (manager ? 0.015 : 0.07));
        const link = manager ? [polar(base, 0.17, b, FLOOR + 0.015), p] : sweep(head, p, m ? 6 : 9);
        clients.push({ p, link, seat: circle([p[0], FLOOR, p[2]], 0.05, 10), ph: f.rnd(100 + i * 9 + j), T: 24 + f.rnd(200 + i * 9 + j) * 12, u: -1 });
      }
      const link = sweep(polar(HUB, COLLAR, a, COLLAR_Y), head, m ? 10 : 14);
      return { a, base, head, half, top, spread, link, seat: circle(base, half * 2.4, 20), clients, manager, ph: f.rnd(300 + i), T: 28 + f.rnd(320 + i) * 8, order: i / (n - 1), lit: 0, v: -1 };
    });
    // the partner furthest to the right carries the lettering, clear of the headline
    const named = partners[n - 1];
    // far to near: the outer partners stand further back than the centre ones
    partners.sort((p, q) => Math.abs(q.a) - Math.abs(p.a));
    const rail: V3[] = [];
    const seg = m ? 14 : 24;
    for (let i = 0; i <= seg; i++) rail.push(polar(HUB, R1 + 0.17, -reach - 0.2 + ((2 * reach + 0.4) * i) / seg, FLOOR));
    for (let i = seg; i >= 0; i--) rail.push(polar(HUB, R1 - 0.17, -reach - 0.2 + ((2 * reach + 0.4) * i) / seg, FLOOR));
    return { partners, named, reach, rail, dais: circle([HUB[0], FLOOR + 0.03, HUB[2]], 0.24, 28) };
  },

  draw(f, s) {
    const { pal } = f;
    const m = f.mobile;
    const sway = f.still ? 0 : Math.sin(f.t * 0.08) * 0.035;
    f.cx -= m ? f.w * 0.13 : f.u * 0.1;
    // the orb stands tall at the back: lift the tree, but never push the orb out of the top of the stage
    f.cy = m ? Math.max(f.cy - f.u * 0.7, f.u * 0.66 + 12) : f.cy - f.u * 0.32;
    // the tree is wide: on a narrow stage pull back until its right edge and lettering fit
    const fit = m ? 0.8 : clamp((f.w - f.cx - 14) / (1.62 * f.u), 0.7, 1);
    f.aim((m ? 0.14 : 0.24) + (f.rnd(1) - 0.5) * 0.06 + sway, -0.4, 6.4, 0.8 * fit);

    // the beads start once the tree is lit, and come up gently
    const live = !f.still && f.boot >= 1;
    const wake = live ? clamp((f.t - 1.8) / 1.6) : 0;
    const managed = s.partners.some((p) => p.manager);
    const hubOn = f.on(0, 0.3);
    // the partners take the brand colour the key light is not using
    const tone = pal.key === pal.teal ? pal.blue : pal.teal;

    // where every bead is; arrivals make the lamps and the orb swell a little
    let core = f.still ? 0.6 : 0;
    for (const p of s.partners) {
      p.lit = f.still ? 0.7 : 0;
      p.v = live ? (f.t / p.T + p.ph) % 1 : -1;
      for (const c of p.clients) {
        c.u = live ? (f.t / c.T + c.ph) % 1 : -1;
        if (!live) continue;
        p.lit = Math.max(p.lit, wake * swell((c.u - IN) * c.T));
        core = Math.max(core, wake * swell((c.u - IN - UP) * c.T));
      }
    }

    // ── the deck, the light on it, and the rail the partners stand on
    const c0: V3 = [HUB[0], FLOOR, HUB[2]];
    const arc = { from: turn(-s.reach - 0.2), to: turn(s.reach + 0.2) };
    deck(f, { y: FLOOR, alpha: 0.1 });
    pool(f, polar(HUB, 1.1, 0, FLOOR), 2.7, pal.key, 0.17 * f.boot);
    pool(f, c0, 1.1, pal.key, 0.22 * hubOn);
    f.fill(s.rail, pal.ink, 0.04 * f.boot);
    ring(f, c0, R1 + 0.17, { ...arc, colour: pal.ink, alpha: 0.17 * f.boot });
    ring(f, c0, R1 - 0.17, { ...arc, colour: pal.key, alpha: 0.36 * f.boot, ticks: m ? 0 : 30, major: 5, tickLen: 0.035 });

    // ── the hub: a glass orb on a slender column, held in a ported collar
    const stem = FLOOR + 0.03 + (HUB[1] - HR - FLOOR) * hubOn;
    ring(f, c0, 0.44, { colour: pal.ink, alpha: 0.24 * hubOn, ticks: 24, tickLen: 0.05 });
    f.fill(s.dais, pal.bg, 0.7 * hubOn);
    f.fill(s.dais, pal.key, 0.1 * hubOn);
    f.path(s.dais, pal.key, 0.5 * hubOn, 1, true);
    block(f, [HUB[0], FLOOR + 0.03, HUB[2]], 0.034, stem, pal.key, hubOn);
    f.line([HUB[0] - 0.034, FLOOR + 0.03, HUB[2] - 0.034], [HUB[0] - 0.034, stem, HUB[2] - 0.034], pal.key, 0.42 * hubOn, 1);
    const collar: V3 = [HUB[0], COLLAR_Y, HUB[2]];
    // the far side of the collar shows either side of the orb, not through its lettering
    ring(f, collar, COLLAR, { colour: pal.ink, alpha: 0.16 * hubOn, from: 0, to: 0.15, seg: 80 });
    ring(f, collar, COLLAR, { colour: pal.ink, alpha: 0.16 * hubOn, from: 0.39, to: 0.5, seg: 80 });
    orb(f, HUB, HR, pal.key, hubOn);
    f.glow(HUB, HR * 1.05, pal.key, (0.24 + 0.12 * core) * hubOn);
    ring(f, collar, COLLAR + 0.045, { colour: pal.ink, alpha: 0.2 * hubOn, from: 0.5, to: 1, seg: 40 });
    ring(f, collar, COLLAR, { colour: pal.key, alpha: 0.5 * hubOn, from: 0.5, to: 1, seg: 40, width: 1.25, ticks: 20, tickLen: 0.04 });
    f.label("GIO4X", HUB, { align: "center", size: m ? 10 : clamp(Math.round(f.u * 0.047), 10, 14), weight: 600, colour: pal.ink, alpha: 0.92 * hubOn, display: true });

    // ── fibres from the collar out to each partner, drawn outward as the hub powers on
    for (const p of s.partners) {
      const on = f.on(0.3 + p.order * 0.25, 0.3);
      if (on <= 0) continue;
      const pts = on < 1 ? p.link.slice(0, Math.max(2, Math.ceil(on * p.link.length))) : p.link;
      const dim = managed && !p.manager ? 0.7 : 1;
      trace(f, pts, p.manager ? pal.gold : pal.key, (p.manager ? 0.8 : 0.55) * dim, p.manager ? 1.6 : 1.25);
      f.dot(p.link[0], 0.017, p.manager ? pal.gold : pal.key, 0.95 * on);
    }

    // ── partners and their clients, far to near
    for (const p of s.partners) {
      const on = f.on(0.55 + p.order * 0.25, 0.25);
      if (on <= 0) continue;
      const colour = p.manager ? pal.gold : tone;
      const dim = managed && !p.manager ? 0.7 : 1;
      const fan = f.on(0.8 + p.order * 0.2, 0.2);
      const top = FLOOR + (p.top - FLOOR) * on;
      const head: V3 = [p.base[0], top + (p.head[1] - p.top), p.base[2]];
      if (p.manager) {
        // the manager's mandate: a plate of its own, the allocated accounts on its rim
        pool(f, p.base, 0.66, pal.gold, 0.17 * on);
        ring(f, p.base, PLATE, { colour: pal.gold, alpha: 0.6 * fan, ticks: p.clients.length * 4, tickLen: 0.035, seg: 48, width: 1.25 });
        fanOut(f, p, colour, fan, 1, wake);
      } else ring(f, p.base, FAN, { colour, alpha: 0.2 * fan * dim, from: turn(p.a - p.spread - 0.07), to: turn(p.a + p.spread + 0.07), seg: 60 });
      f.fill(p.seat, colour, 0.05 * on * dim);
      f.path(p.seat, colour, 0.32 * on * dim, 1, true);
      block(f, p.base, p.half, top, colour, on, dim);
      if (p.manager) orb(f, head, 0.12, pal.gold, on);
      lamp(f, head, colour, on * (0.72 + 0.28 * p.lit) * dim, p.manager ? 0.04 : 0.03);
      if (!p.manager) fanOut(f, p, colour, fan, dim, wake);
    }

    // ── light on the partners' fibres: introductions travel in, support travels back out
    if (live)
      for (const p of s.partners) {
        for (const c of p.clients) {
          const k = (c.u - IN) / UP;
          if (k > 0 && k < 1) bead(f, along(p.link, 1 - k), p.manager ? pal.gold : pal.key, wake * ends(k), 0.012);
        }
        if (p.v < OUT) bead(f, along(p.link, p.v / OUT), pal.ink, 0.42 * wake * ends(p.v / OUT), 0.008);
      }

    // ── lettering: each level named once
    const text = f.on(1, 0.12);
    const n = s.named;
    f.label("PARTNER", n.head, { dx: 14, dy: -10, size: m ? 9 : 10, alpha: 0.75 * text, colour: pal.ink2 });
    if (!m) f.label("CLIENTS", n.clients[n.clients.length - 1].p, { dx: 13, size: 10, alpha: 0.62 * text, colour: pal.ink2 });
    for (const p of s.partners) {
      if (!p.manager) continue;
      // captioned under the plate, the one place that is clear wherever the manager stands
      const front = polar(p.base, PLATE, 0, FLOOR);
      f.label("MANAGER", front, { dy: 16, align: "center", size: m ? 9 : 10, alpha: 0.95 * text, colour: pal.gold });
      if (!m) f.label("ALLOCATED ACCOUNTS", front, { dy: 30, align: "center", size: 9, alpha: 0.6 * text, colour: pal.gold });
    }
  },
};

export default scene;
