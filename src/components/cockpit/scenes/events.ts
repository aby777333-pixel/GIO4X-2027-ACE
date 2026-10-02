/**
 * EVENTS — the economic calendar as a flight plan.
 *
 * A ribbon of smoked glass (two lit rails, cross ties and edge lights, like a
 * runway or a strip of film) sweeps across the deck from the far left toward
 * the visitor. Seven approach gates straddle it, one for each kind of release
 * the calendar carries, and a single point of light flies the route through
 * them: time, moving toward the next release. A gate answers as it is crossed.
 *
 * Nothing here is a schedule: no dates, no figures, no countdown. The gates are
 * simply the release types; on a release's own page its gate is the champagne
 * one, larger, with its light on the deck.
 */
import { TAU, clamp, easeOut, lerp, rgba, type Frame, type Pt, type Scene, type V3 } from "../engine";
import { deck, pool, trace } from "../kit";

const RELEASES: readonly (readonly [string, string])[] = [
  ["cpi", "CPI"],
  ["non-farm-payrolls", "NFP"],
  ["interest-rate-decision", "RATES"],
  ["gdp", "GDP"],
  ["pmi", "PMI"],
  ["unemployment-rate", "JOBS"],
  ["retail-sales", "RETAIL"],
];

const FLOOR = -1.3;
/** the ribbon is a slab of glass lying on the deck: its top face, and half its width */
const TOP = FLOOR + 0.05;
const HALF = 0.22;
/** a gate: width across the ribbon, height above it */
const GW = 0.54;
const GH = 0.6;
/** the slot (0 far .. 6 near) where the page's own gate stands */
const HERO = 4;

type Gate = { name: string; at: number; i: number; gold: boolean };
type State = { n: number; c: V3[]; l: V3[]; r: V3[]; nrm: [number, number][]; gates: Gate[] };
type Quad = readonly [V3, V3, V3, V3];

/** a sheet of light in a pane (bottom-left, bottom-right, top-right, top-left): brightest under the lintel that casts it */
function sheet(f: Frame, q: Quad, colour: string, top: number, bottom: number): void {
  const [a, b, c, d] = [f.P(...q[0]), f.P(...q[1]), f.P(...q[2]), f.P(...q[3])];
  if (!a || !b || !c || !d || top <= 0.003) return;
  const { ctx } = f;
  const g = ctx.createLinearGradient((c.x + d.x) / 2, (c.y + d.y) / 2, (a.x + b.x) / 2, (a.y + b.y) / 2);
  g.addColorStop(0, rgba(colour, top));
  g.addColorStop(0.5, rgba(colour, lerp(top, bottom, 0.72)));
  g.addColorStop(1, rgba(colour, bottom));
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = f.mobile ? 44 : 68;
    // the route: a cubic sweep from far-left-back to near-right, bent a little differently on every page
    const bend = (f.rnd(11) - 0.5) * 0.24;
    const K = [[-1.55, 1.5], [-0.22 + bend, 1.08], [0.62, -0.28 - bend], [1.42, -1.45]];
    const fine = 200;
    const raw: [number, number][] = [];
    const cum: number[] = [0];
    for (let i = 0; i <= fine; i++) {
      const t = i / fine;
      const k = 1 - t;
      const w = [k * k * k, 3 * k * k * t, 3 * k * t * t, t * t * t];
      const axis = (d: number) => K[0][d] * w[0] + K[1][d] * w[1] + K[2][d] * w[2] + K[3][d] * w[3];
      raw.push([axis(0), axis(1)]);
      if (i) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
    }
    // even spacing along the route, so that a tie is a fixed measure of it
    const c: V3[] = [];
    for (let i = 0, j = 0; i <= n; i++) {
      const want = (i / n) * cum[fine];
      while (j < fine - 1 && cum[j + 1] < want) j++;
      const k = (want - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
      c.push([lerp(raw[j][0], raw[j + 1][0], k), TOP, lerp(raw[j][1], raw[j + 1][1], k)]);
    }
    const nrm: [number, number][] = [];
    const l: V3[] = [];
    const r: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = c[Math.max(0, i - 1)];
      const b = c[Math.min(n, i + 1)];
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
      const nx = -(b[2] - a[2]) / len;
      const nz = (b[0] - a[0]) / len;
      nrm.push([nx, nz]);
      l.push([c[i][0] - nx * HALF, TOP, c[i][2] - nz * HALF]);
      r.push([c[i][0] + nx * HALF, TOP, c[i][2] + nz * HALF]);
    }
    // the page's own release stands in the hero slot; with no subject, the page seed chooses who leads
    const own = RELEASES.findIndex((x) => x[0] === f.tag.trim().toLowerCase());
    const lead = own >= 0 ? own - HERO : Math.floor(f.rnd(3) * 7);
    const gates: Gate[] = RELEASES.map((_, slot) => {
      const idx = (((slot + lead) % 7) + 7) % 7;
      const i = Math.round((0.12 + slot * 0.127) * n);
      return { name: RELEASES[idx][1], at: i / n, i, gold: idx === own };
    });
    return { n, c, l, r, nrm, gates };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    // seen from above, as a route is read on a chart table. The route is long, so the pointer swings it less
    // than a compact instrument, and a short phone stage gets a smaller one that stays clear of the headline
    const sway = f.still ? 0 : Math.sin(f.t * 0.06 + f.rnd(4) * TAU) * 0.035;
    const fit = m ? clamp(f.h / 680, 0.72, 1) : 1;
    f.cam.parallax = 0.7;
    f.aim((m ? 0.36 : 0.17) + sway, m ? -0.4 : -0.36, 6.2, m ? 0.72 * fit : 0.88);
    f.cx -= m ? f.w * 0.14 : f.u * 0.08;
    // bring the middle of the route to the focal point (desktop) or to the top of the stage (phone)
    const mid = f.P(0, FLOOR + 0.3, 0);
    if (mid) f.cy += (m ? f.h * 0.05 + f.u * 0.7 * fit + f.scroll * f.h * 0.12 : f.cy + f.h * 0.02) - mid.y;

    const hero = s.gates.find((g) => g.gold);
    // the route draws itself in from the far end, and fades at both ends rather than stopping
    const rev = easeOut(f.boot / 0.55);
    const vis = (t: number) => clamp(t / 0.1) * clamp((1 - t) / 0.1) * lerp(0.42, 1, t) * clamp((rev * 1.25 - t) / 0.25);
    const at = (u: number, lift = 0): V3 => {
      const x = clamp(u) * s.n;
      const i = Math.min(s.n - 1, Math.floor(x));
      return [lerp(s.c[i][0], s.c[i + 1][0], x - i), TOP + lift, lerp(s.c[i][2], s.c[i + 1][2], x - i)];
    };

    // the point of light sets out a little before the page's own gate, so the first thing a visitor sees is an arrival
    const from = (hero ?? s.gates[1 + Math.floor(f.rnd(5) * 5)]).at - 0.09 - f.rnd(1) * 0.04;
    const u = (((from + (f.still ? 0.045 : f.t / 46)) % 1) + 1) % 1;
    const travel = clamp(u / 0.08) * clamp((1 - u) / 0.08) * easeOut((f.boot - 0.82) / 0.18);

    deck(f, { y: FLOOR, alpha: 0.085, drift: 0 });
    pool(f, [0.1, FLOOR, 0], 2.6, pal.key, 0.2 * f.boot);
    if (hero) pool(f, [s.c[hero.i][0], FLOOR, s.c[hero.i][2]], 1.25, pal.gold, 0.42 * f.on(0.3 + 0.7 * (HERO / 6), 0.3));

    // ── the ribbon: a slab of smoked glass between two lit rails
    const L: Pt[] = [];
    const R: Pt[] = [];
    const B: Pt[] = [];
    for (let i = 0; i <= s.n; i++) {
      const a = f.P(...s.l[i]);
      const b = f.P(...s.r[i]);
      const e = f.P(s.l[i][0], FLOOR, s.l[i][2]);
      if (!a || !b || !e) return;
      L.push(a);
      R.push(b);
      B.push(e);
    }
    const ends = [(L[0].x + R[0].x) / 2, (L[0].y + R[0].y) / 2, (L[s.n].x + R[s.n].x) / 2, (L[s.n].y + R[s.n].y) / 2] as const;
    const smoke = ctx.createLinearGradient(...ends);
    const light = ctx.createLinearGradient(...ends);
    for (let i = 0; i <= 10; i++) {
      smoke.addColorStop(i / 10, rgba(pal.bg, vis(i / 10)));
      light.addColorStop(i / 10, rgba(pal.key, vis(i / 10)));
    }
    const run = (pts: Pt[], back?: Pt[]) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (!back) return;
      for (let i = back.length - 1; i >= 0; i--) ctx.lineTo(back[i].x, back[i].y);
      ctx.closePath();
    };
    ctx.save();
    run(L, R);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = smoke;
    ctx.fill();
    ctx.globalAlpha = 0.11;
    ctx.fillStyle = light;
    ctx.fill();
    // the near edge of the slab catches the rail's light
    run(L, B);
    ctx.globalAlpha = 0.22;
    ctx.fill();
    ctx.restore();
    // ties: a full frame every fourth measure, with a runway edge light at each end; short graduations between
    for (let i = 0; i <= s.n; i++) {
      const a = vis(i / s.n);
      if (a <= 0.01) continue;
      const p = s.l[i];
      const q = s.r[i];
      if (i % 4 === 0) {
        f.line(p, q, pal.ink, a * 0.3, 1);
        f.dot(p, 0.009, pal.ink, a * 0.85);
        f.dot(q, 0.009, pal.ink, a * 0.7);
      } else if (f.q >= 0.8 || i % 2 === 0) {
        f.line(p, [lerp(p[0], q[0], 0.2), TOP, lerp(p[2], q[2], 0.2)], pal.ink, a * 0.2, 1);
        f.line(q, [lerp(q[0], p[0], 0.2), TOP, lerp(q[2], p[2], 0.2)], pal.ink, a * 0.2, 1);
      }
    }
    ctx.save();
    ctx.strokeStyle = light;
    for (const pts of [R, L]) {
      run(pts);
      ctx.globalAlpha = 0.11;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.globalAlpha = pts === L ? 0.78 : 0.66;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    ctx.restore();

    // ── the gates, far to near: each straddles the ribbon, feet on the deck
    const drop = FLOOR - TOP;
    s.gates.forEach((g, slot) => {
      const on = f.on(0.3 + 0.7 * (slot / 6), 0.3);
      if (on <= 0.003) return;
      const b = s.c[g.i];
      const [nx, nz] = s.nrm[g.i];
      const k = g.gold ? 1.3 : 1;
      const hw = GW * 0.5 * k;
      const h = GH * k * on;
      const post = 0.026 * k;
      const top = 0.042 * k;
      // a gate answers the light as it passes through, and keeps a little afterglow
      const d = u - g.at;
      const lit = Math.exp(-(d * d) / (d > 0 ? 0.004 : 0.0012)) * travel;
      const level = lerp(0.55, 1, g.at) * (hero && !g.gold ? 0.8 : 1) * on;
      const colour = g.gold ? pal.gold : pal.teal;
      const metal = g.gold ? pal.gold : pal.ink;
      const X = (o: number, y: number, along = 0): V3 => [b[0] + nx * o + nz * along, TOP + y, b[2] + nz * o - nx * along];

      // threshold plate across the ribbon
      const sill = 0.04 * k;
      f.fill([X(-HALF, 0.003, -sill), X(HALF, 0.003, -sill), X(HALF, 0.003, sill), X(-HALF, 0.003, sill)], colour, (g.gold ? 0.38 : 0.2) * level + 0.22 * lit);
      // the pane: smoked glass, the lintel's light falling down it, one streak of sheen
      const pane: Quad = [X(-hw + post, 0), X(hw - post, 0), X(hw - post, h - top), X(-hw + post, h - top)];
      f.fill(pane, pal.bg, 0.28 * on);
      const glass = (g.gold ? 0.28 : 0.17) * level + 0.2 * lit * on;
      if (m || slot < 2) f.fill(pane, colour, glass * 0.45);
      else sheet(f, pane, colour, glass, 0.025 * level);
      f.fill([X(-hw * 0.5, h * 0.06), X(-hw * 0.26, h * 0.06), X(hw * 0.42, h * 0.84), X(hw * 0.18, h * 0.84)], pal.ink, 0.04 * level);
      // the machined frame around it: lit along the lintel and down the shoulders
      const band: V3[] = [X(-hw, drop), X(-hw, h), X(hw, h), X(hw, drop), X(hw - post, drop), X(hw - post, h - top), X(-hw + post, h - top), X(-hw + post, drop)];
      f.fill(band, metal, (g.gold ? 0.42 : 0.22) * level);
      f.path(band, metal, (g.gold ? 0.6 : 0.34) * level, 1, true);
      const edge = clamp((g.gold ? 0.95 : 0.64) * level + 0.35 * lit);
      trace(f, [X(-hw, h), X(hw, h)], colour, edge, g.gold ? 1.5 : 1.3);
      f.line(X(-hw, h), X(-hw, h * 0.8), colour, edge * 0.7, 1);
      f.line(X(hw, h), X(hw, h * 0.8), colour, edge * 0.7, 1);
      // its name, off the far shoulder where the next gate never reaches
      if (!m || g.gold || (!hero && slot % 3 === 0)) {
        f.label(g.name, X(hw, h), { dx: 8, size: g.gold ? 11 : m ? 9 : 10, colour: g.gold ? pal.gold : pal.ink2, alpha: (g.gold ? 0.95 : lerp(0.6, 0.9, g.at) * (hero ? 0.85 : 1)) * on });
      }
    });

    // ── the light, last: it shines through the glass it is about to cross, and spills on the ribbon under it
    if (travel > 0.003) {
      const p = at(u, 0.2);
      pool(f, at(u), 0.32, pal.key, 0.36 * travel);
      for (let k = 0; k < 8; k++) f.line(at(u - k * 0.011, 0.2), at(u - (k + 1) * 0.011, 0.2), k < 2 ? pal.ink : pal.key, 0.75 * travel * (1 - k / 8), 1.5);
      f.glow(p, 0.16, pal.key, 0.8 * travel);
      f.dot(p, 0.026, pal.ink, 0.3 * travel);
      f.dot(p, 0.013, pal.ink, 0.95 * travel);
    }
  },
};

export default scene;
