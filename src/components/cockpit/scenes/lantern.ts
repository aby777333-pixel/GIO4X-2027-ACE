/**
 * LANTERN — questions, and the light that answers them.
 *
 * A signal lantern on a short mast: a drum in a yoke, with a lens at one end
 * and a hood over it. Round it, at different depths and heights, stands a
 * loose arc of plain glass cards on fine stems, and every card carries one
 * question mark. The lantern throws a soft cone of warm light; the card the
 * cone falls on turns over and shows its other face.
 *
 * Most cards turn to a tick. A few turn to an open ring instead, because the
 * page says plainly that some questions are listed as not yet published:
 * the light finds those too, and does not pretend they are answered.
 *
 * Left alone, the lantern sweeps the arc slowly, one card at a time. The
 * pointer takes the lantern over: it turns and tilts in its yoke to throw the
 * beam where the cursor is, the beam strengthens, and the card under it turns.
 * Cards outside the beam stay as questions.
 */
import { TAU, clamp, easeInOut, lerp, rgba, type Pt, type Scene, type V3 } from "../engine";
import { deck, pool, ring, trace } from "../kit";

const FLOOR = -0.9;
/** the lantern: its centre, the drum's radius, where its ends stand along the axis */
const C: V3 = [0, -0.1, 0];
const R = 0.2;
const BACK = -0.16;
const FRONT = 0.17;
const HOOD = 0.3;
/** the beam: how far it reaches, how wide it is there, and the angle inside which a card counts as lit */
const REACH = 1.9;
const SPREAD = 0.4;
const CATCH = 0.3;
/** a card: width and height */
const CW = 0.34;
const CH = 0.46;

/** the two glyphs with a curve in them, in card units */
const HOOK: [number, number][] = [150, 120, 90, 60, 30, 0, -30, -52].map((a): [number, number] => [Math.cos((a * TAU) / 360) * 0.066, 0.078 + Math.sin((a * TAU) / 360) * 0.066]).concat([[0, -0.012], [0, -0.05]]);
const OPEN: [number, number][] = Array.from({ length: 17 }, (_, i): [number, number] => [Math.cos((i * TAU) / 16) * 0.062, 0.012 + Math.sin((i * TAU) / 16) * 0.062]);
const TICK: [number, number][] = [[-0.078, 0.004], [-0.022, -0.064], [0.088, 0.088]];

type Card = { p: V3; face: number; open: boolean };
type State = { cards: Card[]; flip: number[]; order: number[]; az: number; el: number; phase: number };

/** add a polygon to the current path, always wound the same way, so that overlapping pieces fill as one shape */
function wound(ctx: CanvasRenderingContext2D, pts: readonly (Pt | null)[]): void {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (!a || !b) return;
    area += a.x * b.y - b.x * a.y;
  }
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[area < 0 ? n - 1 - i : i] as Pt;
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath();
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = f.mobile ? 7 : 9;
    const cards: Card[] = [];
    for (let i = 0; i < n; i++) {
      // a loose arc behind and beside the lantern, evenly spread across the frame: the middle cards
      // stand furthest back and highest, so none hides behind the lantern, and every other one steps forward
      const x = lerp(-1.48, 1.48, i / (n - 1));
      const z = 1.8 * Math.sqrt(1 - (x / 1.6) ** 2) - 0.92 + (i % 2 ? -0.2 : 0.14) + (f.rnd(i + 40) - 0.5) * 0.14;
      const y = 0.1 + 0.36 * (1 - Math.abs(x) / 1.48) + (f.rnd(i + 60) - 0.5) * 0.26;
      cards.push({ p: [x, y, z], face: -Math.atan2(x, z + 0.6) * 0.5, open: i % 4 === 1 });
    }
    return { cards, flip: cards.map(() => 0), order: cards.map((_, i) => i), az: 0, el: 0.1, phase: f.rnd(3) * TAU };
  },
  draw(f, s) {
    const { ctx, pal } = f;
    f.cam.parallax = 0.7;
    f.aim((f.still ? 0 : Math.sin(f.t * 0.06) * 0.05) + (f.rnd(1) - 0.5) * 0.1, -0.28, 6.4, f.mobile ? 1.12 : 1.08);
    const n = s.cards.length;

    // ── where the beam is thrown: along the arc when left alone, at the cursor under the pointer
    const sweep = f.still ? n - 3 : (0.5 - 0.5 * Math.cos(f.t * 0.11 + s.phase)) * (n - 1);
    const i0 = Math.min(n - 2, Math.floor(sweep));
    const k = easeInOut(sweep - i0);
    const a = s.cards[i0].p;
    const b = s.cards[i0 + 1].p;
    let tx = lerp(a[0], b[0], k);
    let ty = lerp(a[1], b[1], k);
    let tz = lerp(a[2], b[2], k);
    if (f.hover > 0.01) {
      // the cards nearest the cursor on screen share the aim, so the beam glides from one to the next
      let sw = 0;
      let hx = 0;
      let hy = 0;
      let hz = 0;
      for (const c of s.cards) {
        const p = f.P(c.p[0], c.p[1], c.p[2]);
        if (!p) continue;
        const d = Math.hypot(p.x - f.mx, p.y - f.my) / (f.u * 0.42);
        const w = Math.exp(-d * d) + 1e-6;
        sw += w;
        hx += c.p[0] * w;
        hy += c.p[1] * w;
        hz += c.p[2] * w;
      }
      tx = lerp(tx, hx / sw, f.hover);
      ty = lerp(ty, hy / sw, f.hover);
      tz = lerp(tz, hz / sw, f.hover);
    }
    const ease = f.still ? 1 : 1 - Math.exp(-f.dt * 6);
    s.az += (Math.atan2(tx - C[0], tz - C[2]) - s.az) * ease;
    s.el += (Math.atan2(ty - C[1], Math.hypot(tx - C[0], tz - C[2])) - s.el) * ease;
    const ce = Math.cos(s.el);
    const d: V3 = [Math.sin(s.az) * ce, Math.sin(s.el), Math.cos(s.az) * ce];
    const u: V3 = [Math.cos(s.az), 0, -Math.sin(s.az)];
    const v: V3 = [-Math.sin(s.az) * Math.sin(s.el), ce, -Math.cos(s.az) * Math.sin(s.el)];
    /** a point in the lantern's own frame: `along` the beam, then round the axis */
    const L = (along: number, r: number, ang: number): V3 => {
      const cu = Math.cos(ang) * r;
      const cv = Math.sin(ang) * r;
      return [C[0] + d[0] * along + u[0] * cu + v[0] * cv, C[1] + d[1] * along + u[1] * cu + v[1] * cv, C[2] + d[2] * along + u[2] * cu + v[2] * cv];
    };
    const body = f.on(0, 0.3);
    const beam = f.on(0.8, 0.2) * (0.62 + 0.38 * f.hover) * (f.still ? 1 : 0.94 + 0.06 * Math.sin(f.t * 0.9));

    // ── each card: how much of the beam it catches, and how far it has turned
    const lit = s.cards.map((c) => {
      const x = c.p[0] - C[0];
      const y = c.p[1] - C[1];
      const z = c.p[2] - C[2];
      const off = Math.acos(clamp((x * d[0] + y * d[1] + z * d[2]) / Math.hypot(x, y, z), -1, 1));
      const q = clamp((CATCH - off) / (CATCH * 0.6));
      return q * q * (3 - 2 * q) * (beam > 0.2 ? 1 : 0);
    });
    s.flip.forEach((fl, i) => {
      const goal = lit[i] > 0.45 ? 1 : 0;
      s.flip[i] = f.still ? goal : clamp(fl + Math.sign(goal - fl) * f.dt * 2.6, 0, 1);
    });

    deck(f, { y: FLOOR, alpha: 0.1 });
    pool(f, [0, FLOOR, 0], 2.4, pal.key, 0.18 * f.boot);
    pool(f, [d[0] * 1.2, FLOOR, d[2] * 1.2], 1.1, pal.gold, 0.16 * beam);

    const card = (i: number): void => {
      const c = s.cards[i];
      const on = f.on(0.22 + (i / n) * 0.5, 0.26);
      if (on <= 0.003) return;
      const turn = Math.PI * easeInOut(s.flip[i]);
      const shown = Math.cos(turn) < 0;
      const ang = c.face + turn;
      // the answer is written on the other face, so it is drawn the other way round
      const ex = Math.cos(ang) * (shown ? -1 : 1);
      const ez = Math.sin(ang) * (shown ? -1 : 1);
      const y0 = c.p[1] - (1 - on) * 0.16;
      const at = (p: readonly [number, number]): V3 => [c.p[0] + ex * p[0], y0 + p[1], c.p[2] + ez * p[0]];
      const quad: V3[] = [at([-CW / 2, -CH / 2]), at([CW / 2, -CH / 2]), at([CW / 2, CH / 2]), at([-CW / 2, CH / 2])];
      const glow = lit[i];
      // a fine stem down to the deck: the foot says how deep the card stands
      f.line([c.p[0], FLOOR, c.p[2]], [c.p[0], y0 - CH / 2, c.p[2]], pal.ink, 0.2 * on, 1);
      f.dot([c.p[0], FLOOR, c.p[2]], 0.02, pal.ink, 0.4 * on);
      f.fill(quad, pal.bg, 0.86 * on);
      f.fill(quad, pal.ink, 0.05 * on);
      if (glow > 0.01) {
        f.fill(quad, pal.gold, 0.16 * glow * on);
        f.glow(c.p, 0.5, pal.gold, 0.3 * glow * on);
      }
      f.path(quad, pal.ink, 0.3 * on, 1, true);
      f.path(quad, pal.gold, 0.9 * glow * on, 1.25, true);
      f.line(quad[3], quad[2], glow > 0.5 ? pal.gold : pal.key, 0.6 * on, 1.25);
      // edge-on, mid-turn, there is no face to read
      const read = clamp(Math.abs(Math.cos(turn)) * 2.2) * on;
      const wide = f.mobile ? 1.5 : 2;
      if (!shown) {
        f.path(HOOK.map(at), pal.ink, (0.6 + 0.3 * glow) * read, wide);
        f.dot(at([0, -0.122]), 0.014, pal.ink, (0.6 + 0.3 * glow) * read);
      } else if (c.open) f.path(OPEN.map(at), pal.ink, 0.85 * read, wide);
      else trace(f, TICK.map(at), pal.gold, read, wide + 0.5);
    };

    // ── the lantern: mast and foot, the yoke, the drum, and whichever end faces the viewer
    const lantern = (): void => {
      const mast: V3 = [C[0], C[1] - 0.34, C[2]];
      ring(f, [C[0], FLOOR, C[2]], 0.3, { colour: pal.ink, alpha: 0.26 * body, ticks: f.mobile ? 0 : 24, tickLen: 0.04, seg: 40 });
      ring(f, [C[0], FLOOR, C[2]], 0.13, { colour: pal.ink, alpha: 0.5 * body, seg: 24 });
      f.line([C[0], FLOOR, C[2]], mast, pal.bg, 0.95 * body, 7);
      f.line([C[0], FLOOR, C[2]], mast, pal.ink, 0.34 * body, 7);
      f.line([C[0], FLOOR, C[2]], mast, pal.key, 0.5 * body, 1);
      const arm = (side: number): void => {
        const foot: V3 = [mast[0] + u[0] * 0.27 * side, mast[1], mast[2] + u[2] * 0.27 * side];
        const pivot: V3 = [foot[0], C[1], foot[2]];
        f.path([mast, foot, pivot], pal.bg, 0.95 * body, 5);
        f.path([mast, foot, pivot], pal.ink, 0.5 * body, 5);
        f.dot(pivot, 0.03, pal.ink, 0.85 * body);
        f.dot(pivot, 0.012, pal.bg, 0.9 * body);
      };
      const pa = f.P(C[0] + u[0], C[1], C[2] + u[2]);
      const pb = f.P(C[0] - u[0], C[1], C[2] - u[2]);
      const farSide = pa && pb && pa.z > pb.z ? 1 : -1;
      arm(farSide);

      // the drum, facet by facet: only those turned to the viewer, shaded from above
      const { yaw, pitch, dist } = f.cam;
      const eye: V3 = [dist * Math.cos(pitch) * Math.sin(yaw) - C[0], -dist * Math.sin(pitch) - C[1], -dist * Math.cos(pitch) * Math.cos(yaw) - C[2]];
      const facing = d[0] * eye[0] + d[1] * eye[1] + d[2] * eye[2];
      const m = f.mobile ? 12 : 18;
      const shell = (z0: number, r0: number, z1: number, r1: number, tone: number): void => {
        for (let i = 0; i < m; i++) {
          const a0 = (i / m) * TAU;
          const a1 = ((i + 1) / m) * TAU;
          const am = (a0 + a1) / 2;
          const nx = u[0] * Math.cos(am) + v[0] * Math.sin(am);
          const ny = u[1] * Math.cos(am) + v[1] * Math.sin(am);
          const nz = u[2] * Math.cos(am) + v[2] * Math.sin(am);
          if (nx * eye[0] + ny * eye[1] + nz * eye[2] <= 0) continue;
          const quad = [L(z0, r0, a0), L(z0, r0, a1), L(z1, r1, a1), L(z1, r1, a0)];
          f.fill(quad, pal.bg, 0.97 * body);
          f.fill(quad, pal.ink, tone * (0.3 + 0.7 * clamp(0.5 + 0.5 * ny)) * body);
        }
      };
      const loop = (along: number, r: number): V3[] => Array.from({ length: m }, (_, i) => L(along, r, (i / m) * TAU));
      const cap = (along: number, front: boolean): void => {
        const disc = loop(along, R);
        f.fill(disc, pal.bg, 0.97 * body);
        if (!front) {
          f.fill(disc, pal.ink, 0.1 * body);
          f.path(disc, pal.ink, 0.45 * body, 1, true);
          f.path(loop(along, R * 0.5), pal.ink, 0.2 * body, 1, true);
          // the grip the lantern is trained by
          f.line(L(along, R * 0.5, TAU / 4), L(along - 0.09, R * 0.5, TAU / 4), pal.ink, 0.5 * body, 2.5);
          f.line(L(along, R * 0.5, -TAU / 4), L(along - 0.09, R * 0.5, -TAU / 4), pal.ink, 0.5 * body, 2.5);
          f.line(L(along - 0.09, R * 0.5, TAU / 4), L(along - 0.09, R * 0.5, -TAU / 4), pal.ink, 0.7 * body, 3);
          return;
        }
        // the lens: stepped glass, lit from behind
        f.fill(disc, pal.gold, (0.3 + 0.5 * beam) * body);
        f.fill(loop(along, R * 0.62), pal.ink, 0.3 * beam * body);
        for (const r of [0.86, 0.62, 0.36]) f.path(loop(along, R * r), pal.gold, 0.7 * body, 1, true);
        f.path(disc, pal.ink, 0.6 * body, 1.25, true);
      };
      const hood = (): void => {
        shell(FRONT, R * 1.04, HOOD, R * 1.12, 0.2);
        f.path(loop(HOOD, R * 1.12), pal.ink, 0.4 * body, 1, true);
      };
      if (facing > 0) {
        shell(BACK, R * 0.94, FRONT, R, 0.26);
        cap(FRONT, true);
        // seen from the front the hood stands round the lens: its far half first, as a rim
        f.path(loop(HOOD, R * 1.12), pal.ink, 0.5 * body, 1.5, true);
      } else {
        hood();
        shell(BACK, R * 0.94, FRONT, R, 0.26);
        f.path(loop(FRONT, R * 1.04), pal.ink, 0.3 * body, 1, true);
        cap(BACK, false);
      }
      for (const along of [BACK + 0.03, FRONT - 0.03]) f.path(loop(along, R * 0.99), pal.key, 0.26 * body, 1, true);
      arm(-farSide);
      f.glow(L(FRONT, 0, 0), 0.5, pal.gold, 0.5 * beam);
    };

    // ── the beam: a soft cone, three shells of light that thin out with distance
    const cone = (): void => {
      if (beam <= 0.01) return;
      const from = f.P(...L(FRONT, 0, 0));
      const to = f.P(...L(REACH, 0, 0));
      if (!from || !to) return;
      const m = f.mobile ? 10 : 14;
      ctx.globalCompositeOperation = "lighter";
      for (const [wide, alpha] of [[1, 0.1], [0.66, 0.11], [0.34, 0.13]]) {
        const near = Array.from({ length: m }, (_, i) => f.P(...L(FRONT, R * 0.8 * wide, (i / m) * TAU)));
        const far = Array.from({ length: m }, (_, i) => f.P(...L(REACH, SPREAD * wide, (i / m) * TAU)));
        ctx.beginPath();
        wound(ctx, far);
        for (let i = 0; i < m; i++) wound(ctx, [near[i], near[(i + 1) % m], far[(i + 1) % m], far[i]]);
        const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
        g.addColorStop(0, rgba(pal.gold, alpha * 1.7 * beam));
        g.addColorStop(0.55, rgba(pal.gold, alpha * beam));
        g.addColorStop(1, rgba(pal.gold, 0));
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    // far cards, then the lantern and its light, then the cards that stand nearer than it
    const depth = (p: V3) => f.P(p[0], p[1], p[2])?.z ?? 0;
    const here = depth(C);
    s.order.sort((x, y) => depth(s.cards[y].p) - depth(s.cards[x].p));
    for (const i of s.order) if (depth(s.cards[i].p) >= here) card(i);
    if (d[2] > 0) cone();
    lantern();
    if (d[2] <= 0) cone();
    for (const i of s.order) if (depth(s.cards[i].p) < here) card(i);
  },
};

export default scene;
