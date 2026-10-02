/**
 * CONDITIONS — the instrument cluster.
 *
 * Three round gauges set in a machined panel that wraps toward the pilot:
 * SPREAD, LEVERAGE, MARGIN, the three things the page sets out. At power-on
 * each needle makes the classic self-test sweep (off the stop, to full scale,
 * and back) and then rests on the neutral index at twelve o'clock.
 *
 * The scales carry graduations but no numerals, and a resting needle indicates
 * nothing: this is a drawing of instruments, never a reading. The figures
 * themselves belong to the page's own tables.
 */
import { TAU, clamp, easeInOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, pool, trace } from "../kit";

const DEG = Math.PI / 180;
/** half-width of the centre facet, width of each wing, and how far the wings turn in */
const HALF = 0.72;
const WING = 0.94;
const BEND = 0.45;
const TOP = 0.86;
const BOT = -0.78;
/** depth of the brow that overhangs the panel, like a glareshield */
const BROW = 0.17;
const FLOOR = -1.3;

type Plane = (x: number, y: number, lift?: number) => V3;
type Tone = "teal" | "blue" | "emerald";
type Gauge = {
  name: string;
  tone: Tone;
  R: number;
  /** half of the scale's sweep, radians either side of twelve o'clock */
  half: number;
  /** polar position on the dial: angle clockwise from twelve, radius, lift off the panel */
  at(a: number, r: number, lift?: number): V3;
  /** closed outlines, from the panel inward: seat, bezel rim, bezel lip, dial face, inner engraved circle */
  rings: V3[][];
  /** the bezel's lit and counter-lit arcs, the scale arc, and the graduations as pairs of end points */
  hi: V3[];
  lo: V3[];
  scale: V3[];
  minor: V3[];
  major: V3[];
};
type State = { facets: V3[][]; top: V3[]; brow: V3[]; grain: V3[]; studs: V3[]; gauges: Gauge[]; phase: number };

/** a flat facet of the panel, turned about the vertical: local x, y and lift toward the viewer */
const plane = (o: V3, yaw: number): Plane => {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return (x, y, lift = 0) => [o[0] + x * c - lift * s, o[1] + y, o[2] - x * s - lift * c];
};

function gauge(f: Frame, name: string, tone: Tone, pl: Plane, gx: number, gy: number, R: number, sweep: number, div: number, sub: number): Gauge {
  const at = (a: number, r: number, lift = 0): V3 => pl(gx + Math.sin(a) * r, gy + Math.cos(a) * r, lift);
  const n = f.mobile ? 36 : 64;
  const circle = (r: number, lift: number): V3[] => Array.from({ length: n }, (_, i) => at((i / n) * TAU, r, lift));
  const span = (a0: number, a1: number, r: number, lift: number, m: number): V3[] => Array.from({ length: m + 1 }, (_, i) => at(lerp(a0, a1, i / m) * DEG, r, lift));
  const half = (sweep / 2) * DEG;
  const minor: V3[] = [];
  const major: V3[] = [];
  const total = div * sub;
  for (let i = 0; i <= total; i++) {
    const a = lerp(-half, half, i / total);
    if (i % sub === 0) major.push(at(a, R * 0.77, 0.004), at(a, R * (i === total / 2 ? 0.6 : 0.64), 0.004));
    else minor.push(at(a, R * 0.77, 0.004), at(a, R * 0.71, 0.004));
  }
  return {
    name, tone, R, half, at, minor, major,
    rings: [circle(R * 1.08, 0), circle(R, 0.05), circle(R * 0.9, 0.05), circle(R * 0.88, 0), circle(R * 0.5, 0.004)],
    hi: span(-105, 25, R, 0.05, 16),
    lo: span(95, 175, R * 0.9, 0.05, 10),
    scale: span(-sweep / 2, sweep / 2, R * 0.77, 0.004, f.mobile ? 30 : 48),
  };
}

/** trace a closed outline on the context; false when a point falls behind the camera */
function shape(f: Frame, pts: readonly V3[]): boolean {
  f.ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = f.P(pts[i][0], pts[i][1], pts[i][2]);
    if (!p) return false;
    if (i) f.ctx.lineTo(p.x, p.y);
    else f.ctx.moveTo(p.x, p.y);
  }
  f.ctx.closePath();
  return true;
}

/** many short strokes (graduations, the grain of the metal) in a single path: `segs` holds pairs of end points */
function strokes(f: Frame, segs: readonly V3[], colour: string, alpha: number, width: number): void {
  if (alpha <= 0.003) return;
  f.ctx.beginPath();
  for (let i = 0; i + 1 < segs.length; i += 2) {
    const a = f.P(segs[i][0], segs[i][1], segs[i][2]);
    const b = f.P(segs[i + 1][0], segs[i + 1][1], segs[i + 1][2]);
    if (!a || !b) continue;
    f.ctx.moveTo(a.x, a.y);
    f.ctx.lineTo(b.x, b.y);
  }
  f.ctx.strokeStyle = rgba(colour, alpha);
  f.ctx.lineWidth = width;
  f.ctx.stroke();
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const mid = plane([0, 0, 0], 0);
    const right = plane([HALF, 0, 0], BEND);
    const left = plane([-HALF, 0, 0], -BEND);
    // each wing tapers toward its outer edge, with the corners chamfered off
    const wing = (pl: Plane, d: number, lift = 0): V3[] => [pl(0, BOT, lift), pl(d * (WING - 0.1), BOT + 0.2, lift), pl(d * WING, BOT + 0.3, lift), pl(d * WING, TOP - 0.32, lift), pl(d * (WING - 0.1), TOP - 0.22, lift), pl(0, TOP, lift)];
    const l = wing(left, -1);
    const r = wing(right, 1);
    const lb = wing(left, -1, BROW);
    const rb = wing(right, 1, BROW);
    // the brow meets itself in a mitre over each bend
    const mitre = BROW * Math.tan(BEND / 2);
    // brushed metal: a few long strokes of grain across each facet
    const grain: V3[] = [];
    for (let i = 0; i < (f.mobile ? 0 : 9); i++) {
      const y = lerp(BOT + 0.12, TOP - 0.1, (i + f.rnd(20 + i) * 0.7) / 9);
      // on the wings a stroke runs out only as far as the taper allows at its height
      const reach = y > BOT + 0.34 && y < TOP - 0.36 ? WING - 0.03 : WING * 0.45;
      grain.push(mid(-HALF + 0.03, y), mid(HALF - 0.03, y), left(-reach, y), left(-0.03, y), right(0.03, y), right(reach, y));
    }
    const sub = f.mobile ? 2 : 5;
    return {
      facets: [[mid(-HALF, BOT), mid(HALF, BOT), mid(HALF, TOP), mid(-HALF, TOP)], l, r],
      top: [l[3], l[4], l[5], r[5], r[4], r[3]],
      // it runs out to nothing at the outer corners
      brow: [l[3], lb[4], [-HALF + mitre, TOP, -BROW], [HALF - mitre, TOP, -BROW], rb[4], r[3]],
      grain,
      studs: [mid(-HALF + 0.07, TOP - 0.07, 0.01), mid(HALF - 0.07, TOP - 0.07, 0.01), mid(-HALF + 0.07, BOT + 0.07, 0.01), mid(HALF - 0.07, BOT + 0.07, 0.01), left(-WING + 0.08, TOP - 0.4, 0.01), left(-WING + 0.08, BOT + 0.38, 0.01), right(WING - 0.08, TOP - 0.4, 0.01), right(WING - 0.08, BOT + 0.38, 0.01)],
      gauges: [
        gauge(f, "SPREAD", "teal", left, -0.47, 0.1, 0.38, 240, 8, sub),
        gauge(f, "LEVERAGE", "blue", mid, 0, 0.14, 0.6, 270, 12, sub),
        gauge(f, "MARGIN", "emerald", right, 0.47, 0.1, 0.38, 240, 6, sub),
      ],
      phase: 0.12 + f.rnd(3) * 0.1,
    };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    // the cluster is wide (about 1.7 units either side at zoom 1), so it is fitted to the room the
    // stage leaves it: clear of the headline's column on the left and of the stage edge on the right
    // (on a phone, and on a tall tablet stage, it sits above the statement instead of beside it)
    const tall = !f.mobile && f.h > f.w;
    const span = 1.7 * f.u;
    // never under the headline, but never squeezed below a legible size either
    const xl = f.mobile ? 10 : Math.max(f.w * 0.43, tall ? 0 : Math.min(f.w * 0.6, Math.max(610, f.clear + 24)));
    const xr = f.w - (f.mobile ? 10 : 28);
    const reach = Math.min(0.9 * span, (xr - xl) / 2);
    const cx = f.mobile ? f.w / 2 : clamp(f.cx, xl + reach, xr - reach);
    f.aim(-0.1 + Math.sin(f.t * 0.09 + s.phase * 9) * 0.05, 0.15, 6.2, reach / span);
    f.cx = cx;
    if (f.mobile || tall) f.cy = f.h * (tall ? 0.19 : 0.28) + f.scroll * f.h * 0.12;

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [0, FLOOR, -0.2], 2.5, pal.key, 0.17 * f.boot);
    // each instrument's own light reaches the deck beneath it
    if (!f.mobile && f.q > 0.7) {
      for (const g of s.gauges) {
        const c = g.at(0, 0, 0);
        pool(f, [c[0] * 0.9, FLOOR, c[2] - 0.35], g.R * 1.9, pal[g.tone], 0.13 * f.on(0.5, 0.5));
      }
    }

    // ── the panel: three machined facets, the wings turned in toward the pilot
    const on = f.on(0, 0.5);
    const pt = f.P(0, TOP, 0);
    const pb = f.P(0, BOT, 0);
    if (pt && pb) {
      const metal = ctx.createLinearGradient(0, pt.y, 0, pb.y);
      metal.addColorStop(0, rgba(pal.ink, 0.03 * on));
      metal.addColorStop(0.1, rgba(pal.ink, 0.085 * on));
      metal.addColorStop(0.5, rgba(pal.ink, 0.032 * on));
      metal.addColorStop(1, rgba(pal.ink, 0.012 * on));
      s.facets.forEach((q, i) => {
        f.fill(q, pal.bg, 0.88 * on);
        if (shape(f, q)) {
          ctx.fillStyle = metal;
          ctx.fill();
        }
        // the wing that faces the key light is a shade brighter
        if (i === 2) f.fill(q, pal.ink, 0.022 * on);
        f.path(q, pal.ink, 0.16 * on, 1, true);
      });
    }
    if (f.q > 0.7) strokes(f, s.grain, pal.ink, 0.03 * on, 1);
    // the brow: the top of the slab overhangs the instruments and carries the lit edge
    for (let i = 0; i < 5; i++) {
      const q: V3[] = [s.top[i], s.top[i + 1], s.brow[i + 1], s.brow[i]];
      f.fill(q, pal.bg, 0.92 * on);
      f.fill(q, pal.ink, (i === 2 ? 0.13 : 0.09) * on);
    }
    f.path(s.top, pal.ink, 0.22 * on, 1);
    f.path(s.brow, pal.key, 0.7 * on, 1.25);
    for (const p of s.studs) {
      f.dot(p, 0.016, pal.ink, 0.3 * on);
      f.dot(p, 0.008, pal.bg, 0.9 * on);
    }

    // ── one reflection crosses the three glasses, slowly, then the glass is dark for a while
    const edgeL = f.P(...s.facets[1][2]);
    const edgeR = f.P(...s.facets[2][2]);
    let glint: CanvasGradient | null = null;
    if (edgeL && edgeR && pt) {
      const bw = 0.42 * f.u * f.cam.zoom;
      const k = f.still ? 0.57 : ((f.t / 16 + s.phase) % 1) / 0.75;
      const bx = lerp(edgeL.x - bw, edgeR.x + bw, k) + f.px * 24;
      glint = ctx.createLinearGradient(bx - bw, pt.y, bx + bw, pt.y + bw * 0.72);
      glint.addColorStop(0, rgba(pal.ink, 0));
      glint.addColorStop(0.4, rgba(pal.ink, 0.11 * f.boot));
      glint.addColorStop(0.5, rgba(pal.ink, 0.025 * f.boot));
      glint.addColorStop(0.58, rgba(pal.ink, 0.06 * f.boot));
      glint.addColorStop(0.74, rgba(pal.ink, 0));
    }

    s.gauges.forEach((g, i) => {
      const tone = pal[g.tone];
      const lit = f.on(0.2 + i * 0.14, 0.42);
      const [seat, rim, lip, face, inner] = g.rings;
      const pc = f.P(...g.at(0, 0, 0));
      if (!pc || on <= 0.003) return;

      // bezel: a raised ring of metal on its seat; then the recess and the glass face at the bottom of it
      f.fill(seat, pal.bg, 0.5 * on);
      f.path(seat, pal.ink, 0.07 * on, 1, true);
      f.fill(rim, pal.bg, 0.94 * on);
      f.fill(rim, pal.ink, 0.085 * on);
      f.fill(lip, pal.bg, 0.97 * on);
      if (shape(f, face)) {
        const Rp = g.R * 0.88 * pc.s * f.u;
        const glass = ctx.createRadialGradient(pc.x - Rp * 0.3, pc.y - Rp * 0.4, Rp * 0.05, pc.x, pc.y, Rp);
        glass.addColorStop(0, rgba(tone, 0.17 * lit));
        glass.addColorStop(0.6, rgba(tone, 0.035 * lit));
        glass.addColorStop(1, rgba(tone, 0.085 * lit));
        ctx.fillStyle = glass;
        ctx.fill();
      }
      f.path(rim, pal.ink, 0.34 * on, 1, true);
      f.path(lip, pal.ink, 0.15 * on, 1, true);
      f.path(g.hi, pal.key, 0.75 * on, 1.5);
      f.path(g.lo, pal.ink, 0.3 * on, 1);

      // self-test: the needle leaves the low stop for full scale, then returns to neutral and stays there
      const t0 = 0.45 + i * 0.16;
      const up = easeInOut((f.t - t0) / 1.05);
      const a = lerp(lerp(-g.half, g.half, up), 0, easeInOut((f.t - t0 - 1.05) / 0.95));

      // scale: graduations without numerals, an arc that lights in the needle's wake, the neutral index at twelve
      f.path(inner, pal.ink, 0.08 * lit, 1, true);
      const drawn = Math.round(up * (g.scale.length - 1));
      if (drawn > 0) trace(f, up < 1 ? g.scale.slice(0, drawn + 1) : g.scale, tone, 0.62 * lit, 1.25);
      strokes(f, g.minor, pal.ink, 0.36 * lit, 1);
      strokes(f, g.major, pal.ink, 0.82 * lit, 1.5);
      f.dot(g.at(-g.half, g.R * 0.77, 0.004), 0.011, pal.ink, 0.7 * lit);
      f.dot(g.at(g.half, g.R * 0.77, 0.004), 0.011, pal.ink, 0.7 * lit);
      const index: V3[] = [g.at(-0.05, g.R * 0.865, 0.004), g.at(0.05, g.R * 0.865, 0.004), g.at(0, g.R * 0.795, 0.004)];
      f.glow(g.at(0, g.R * 0.83, 0.004), g.R * 0.2, pal.key, 0.34 * lit * (f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.7 + i * 1.9)));
      f.fill(index, pal.key, 0.95 * lit);

      // needle: a white pointer carried just above the dial, in a little of the dial's own light
      const L = 0.03;
      const tip = g.at(a, g.R * 0.73, L);
      f.path([g.at(a, g.R * 0.12, L), tip], tone, 0.16 * lit, 6);
      f.fill([g.at(a + Math.PI + 0.12, g.R * 0.17, L), g.at(a + Math.PI - 0.12, g.R * 0.17, L), g.at(a + 90 * DEG, g.R * 0.03, L), g.at(a - 90 * DEG, g.R * 0.03, L)], pal.ink, 0.45 * on * clamp(0.25 + lit));
      f.fill([g.at(a + 90 * DEG, g.R * 0.03, L), tip, g.at(a - 90 * DEG, g.R * 0.03, L)], pal.ink, 0.94 * on * clamp(0.25 + lit));
      const hub = g.at(0, 0, L + 0.01);
      f.dot(hub, g.R * 0.1, pal.ink, 0.5 * on);
      f.dot(hub, g.R * 0.078, pal.bg, on);
      f.dot(hub, g.R * 0.028, tone, 0.9 * lit);

      // the glass over it all, catching the passing reflection
      if (glint && shape(f, lip)) {
        ctx.fillStyle = glint;
        ctx.fill();
      }
      ctx.save();
      ctx.letterSpacing = "1.5px";
      f.label(g.name, g.at(Math.PI, g.R + 0.15, 0), { align: "center", size: f.mobile ? 9 : 10, alpha: 0.78 * lit, colour: pal.ink2, dx: 1 });
      ctx.restore();
    });
  },
};

export default scene;
