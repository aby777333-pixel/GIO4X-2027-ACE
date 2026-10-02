/**
 * THRESHOLD — the way in, one step at a time.
 *
 * A short flight of broad steps, each with a strip of light under its nosing,
 * rises to a landing. On the landing stands a writing desk under a bar lamp,
 * and on the desk's slope lies one blank application card with a pen beside
 * it. The card is empty: ruled fields, an empty box, a line to sign on.
 * Nothing on it is filled in, ticked or stamped, because nothing has been
 * applied for; the instrument only shows where an application begins.
 *
 * The pointer walks the stairs. The steps light in champagne one after
 * another up to the height of the cursor, a pool of light keeping pace on the
 * treads beneath it, and go out again in order when it comes back down. When
 * the pointer reaches the desk the card lifts off the slope, turns its face
 * to the visitor and its outline glows.
 */
import { clamp, easeInOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, trace } from "../kit";

/** five steps and the landing: six risers to climb */
const N = 5;
const RISE = 0.13;
const RUN = 0.22;
const HALF = 1.32;
const FLOOR = -0.76;
const Z0 = -0.95;
const BACK = 1.1;
const LAND = FLOOR + (N + 1) * RISE;
/** the desk: half its width, its front and back, the height of its top */
const DW = 0.86;
const DF = 0.4;
const DB = 0.96;
const TOP = LAND + 0.5;
/** the card rests on a writing slope */
const SLOPE = 0.3;
const CARD: V3 = [-0.12, TOP + 0.085, 0.68];
const CW = 0.33;
const CD = 0.215;

type State = { climb: number };

const stepY = (i: number) => FLOOR + (i + 1) * RISE;
const stepZ = (i: number) => Z0 + i * RUN;

/** a solid face: a dark body under a tone of the metal, with a fine edge */
function face(f: Frame, pts: readonly V3[], tone: number, on: number, edge = 0.2): void {
  if (on <= 0.003) return;
  f.fill(pts, f.pal.bg, 0.95 * on);
  f.fill(pts, f.pal.ink, tone * on);
  f.path(pts, f.pal.ink, edge * on, 1, true);
}

/** a vertical face lit from a strip along its top edge: the light falls off down the face */
function wash(f: Frame, pts: readonly V3[], colour: string, alpha: number): void {
  const a = f.P(pts[2][0], pts[2][1], pts[2][2]);
  const b = f.P(pts[1][0], pts[1][1], pts[1][2]);
  if (!a || !b || alpha <= 0.003) return;
  const { ctx } = f;
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0, rgba(colour, alpha));
  g.addColorStop(1, rgba(colour, alpha * 0.12));
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = f.P(pts[i][0], pts[i][1], pts[i][2]);
    if (!p) return;
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
}

const scene: Scene<State> = {
  pose: 12,
  setup() {
    return { climb: 0 };
  },
  draw(f, s) {
    const { pal } = f;
    f.cam.parallax = 0.6;
    f.aim(0.36 + (f.rnd(1) - 0.5) * 0.05 + (f.still ? 0 : Math.sin(f.t * 0.08) * 0.03), -0.36, 6.4, f.mobile ? 0.8 : 0.84);

    // ── the walk: how many risers stand at or below the pointer; the lights follow at a walking pace
    let target = 0;
    if (f.hover > 0.3) {
      for (let i = 0; i <= N; i++) {
        const p = f.P(0, stepY(i), stepZ(i));
        if (p && f.my <= p.y + 4) target = i + 1;
      }
      const d = f.P(0, TOP, DF);
      if (d && f.my <= d.y + 6) target = N + 2;
    }
    const pace = 6.5 * f.dt;
    s.climb = f.still ? 0 : s.climb + clamp(target - s.climb, -pace, pace);
    const walked = (i: number) => easeInOut(s.climb - i);
    const reach = easeInOut(s.climb - (N + 1));
    const going = clamp(s.climb) * (1 - reach);
    // at rest, a quiet glint climbs the nosings every few seconds
    const glint = f.still || f.boot < 1 ? -9 : ((f.t / 7.5) % 1) * (N + 5) - 2;

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, -0.4], 2.5, pal.key, 0.2 * f.boot);

    // ── two light posts at the back of the landing: the room behind the desk
    const postOn = f.on(0.75, 0.3);
    for (const side of [-1, 1]) {
      const x = side * (HALF - 0.07);
      const foot: V3 = [x, LAND, BACK - 0.04];
      const head: V3 = [x, LAND + 0.98 * postOn, BACK - 0.04];
      f.line(foot, head, pal.ink, 0.3 * postOn, 3);
      trace(f, [[x, LAND + 0.12, BACK - 0.04], head], pal.key, (0.5 + 0.3 * reach) * postOn, 1.25);
      lamp(f, head, pal.key, postOn * (0.7 + 0.3 * reach), 0.014);
    }

    // ── the flight: its flank, then each riser and tread from the landing down
    const body = f.on(0, 0.35);
    const flank: V3[] = [[HALF, FLOOR, Z0]];
    for (let i = 0; i <= N; i++) flank.push([HALF, stepY(i), stepZ(i)], [HALF, stepY(i), i < N ? stepZ(i + 1) : BACK]);
    flank.push([HALF, FLOOR, BACK]);
    face(f, flank, 0.045, body, 0.24);
    // the pool of light that keeps pace with the walker, under the pointer
    const at = s.climb - 0.5;
    const l = f.P(-HALF, stepY(0), stepZ(0));
    const r = f.P(HALF, stepY(0), stepZ(0));
    const wx = l && r ? lerp(-HALF, HALF, clamp((f.mx - l.x) / (r.x - l.x), 0.14, 0.86)) : 0;
    for (let i = N; i >= 0; i--) {
      const on = f.on(0.1 + (i / N) * 0.5, 0.3);
      if (on <= 0.003) continue;
      const y = stepY(i);
      const z = stepZ(i);
      const zb = i < N ? stepZ(i + 1) : BACK;
      const lit = walked(i);
      const idle = (1 - clamp(s.climb)) * Math.exp(-((glint - i) ** 2) * 1.2);
      const tread: V3[] = [[-HALF, y, z], [HALF, y, z], [HALF, y, zb], [-HALF, y, zb]];
      face(f, tread, 0.05 + 0.03 * (i / N), on, 0.14);
      f.fill(tread, pal.gold, 0.1 * lit * on);
      if (going > 0.01 && Math.abs(at - i) < 1.6) pool(f, [wx, y, (z + Math.min(zb, z + RUN)) / 2], 0.42, pal.gold, 0.5 * going * clamp(1.6 - Math.abs(at - i)) * on);
      const riser: V3[] = [[-HALF, y - RISE, z], [HALF, y - RISE, z], [HALF, y, z], [-HALF, y, z]];
      face(f, riser, 0.08, on, 0.16);
      wash(f, riser, pal.key, (0.2 + 0.3 * idle) * (1 - lit) * on);
      wash(f, riser, pal.gold, 0.56 * lit * on);
      // the strip under the nosing
      f.line(riser[3], riser[2], pal.gold, 0.2 * lit * on, 7);
      f.line(riser[3], riser[2], lit > 0.5 ? pal.gold : pal.key, (0.5 + 0.35 * idle + 0.5 * lit) * on, 1.25 + 0.75 * lit);
    }

    // ── the desk: two slab ends, a modesty panel, a top with a lit front edge
    const desk = f.on(0.55, 0.3);
    const dy = (1 - desk) * -0.1;
    const under = TOP - 0.045 + dy;
    const top = TOP + dy;
    const land = LAND;
    pool(f, [0, LAND, (DF + DB) / 2], 1.1, reach > 0.5 ? pal.gold : pal.key, (0.16 + 0.12 * reach) * desk);
    face(f, [[-DW + 0.05, land, DF + 0.04], [-DW + 0.05, land, DB - 0.02], [-DW + 0.05, under, DB - 0.02], [-DW + 0.05, under, DF + 0.04]], 0.05, desk);
    face(f, [[-DW + 0.05, land + 0.14, DB - 0.06], [DW - 0.05, land + 0.14, DB - 0.06], [DW - 0.05, under, DB - 0.06], [-DW + 0.05, under, DB - 0.06]], 0.035, desk, 0.12);
    face(f, [[-DW, land, DF + 0.04], [-DW + 0.05, land, DF + 0.04], [-DW + 0.05, under, DF + 0.04], [-DW, under, DF + 0.04]], 0.12, desk);
    face(f, [[DW, land, DF + 0.04], [DW, land, DB - 0.02], [DW, under, DB - 0.02], [DW, under, DF + 0.04]], 0.1, desk, 0.26);
    face(f, [[DW - 0.05, land, DF + 0.04], [DW, land, DF + 0.04], [DW, under, DF + 0.04], [DW - 0.05, under, DF + 0.04]], 0.14, desk);
    const ox = DW + 0.05;
    face(f, [[ox, under, DF], [ox, under, DB], [ox, top, DB], [ox, top, DF]], 0.12, desk, 0.26);
    face(f, [[-ox, under, DF], [ox, under, DF], [ox, top, DF], [-ox, top, DF]], 0.17, desk, 0.3);
    const slab: V3[] = [[-ox, top, DF], [ox, top, DF], [ox, top, DB], [-ox, top, DB]];
    face(f, slab, 0.085, desk, 0.3);
    f.line(slab[0], slab[1], pal.key, 0.75 * desk, 1.5);

    // the bar lamp: a stem at the back of the desk, an arm over the slope, its light on the leather
    const lampOn = f.on(0.8, 0.25);
    const stem: V3 = [-DW + 0.04, top, DB - 0.05];
    const elbow: V3 = [-DW + 0.04, top + 0.4, DB - 0.05];
    const tip: V3 = [0.22, top + 0.4, DB - 0.12];
    f.line(stem, elbow, pal.ink, 0.5 * lampOn, 2);
    f.line(elbow, tip, pal.ink, 0.4 * lampOn, 3);
    pool(f, [CARD[0], top, CARD[2]], 0.5, pal.key, (0.3 + 0.1 * reach) * lampOn);
    trace(f, [[elbow[0] + 0.12, elbow[1] - 0.012, elbow[2] - 0.01], [tip[0], tip[1] - 0.012, tip[2]]], pal.key, 0.9 * lampOn, 1.5);

    // the writing slope, the pen beside it
    const sx0 = CARD[0] - CW - 0.06;
    const sx1 = CARD[0] + CW + 0.06;
    const sz0 = DF + 0.05;
    const sz1 = DB - 0.08;
    const sh = (sz1 - sz0) * Math.tan(SLOPE);
    face(f, [[sx1, top, sz0], [sx1, top, sz1], [sx1, top + sh, sz1]], 0.1, desk, 0.24);
    face(f, [[sx0, top + 0.004, sz0], [sx1, top + 0.004, sz0], [sx1, top + sh, sz1], [sx0, top + sh, sz1]], 0.055, desk, 0.26);
    const nib: V3 = [sx1 + 0.1, top + 0.012, DF + 0.1];
    const cap: V3 = [sx1 + 0.24, top + 0.012, DF + 0.36];
    const barrel = Math.max(1.5, f.u * 0.014);
    f.line(nib, cap, pal.bg, 0.9 * desk, barrel + 1.5);
    f.line(nib, cap, pal.ink, 0.62 * desk, barrel);
    f.line(nib, [lerp(nib[0], cap[0], 0.2), nib[1], lerp(nib[2], cap[2], 0.2)], pal.gold, 0.95 * desk, barrel);
    f.line([lerp(nib[0], cap[0], 0.66), nib[1], lerp(nib[2], cap[2], 0.66)], [lerp(nib[0], cap[0], 0.72), nib[1], lerp(nib[2], cap[2], 0.72)], pal.gold, 0.9 * desk, barrel);

    // ── the card: blank. It lifts off the slope and faces the visitor when the pointer reaches the desk
    const cardOn = f.on(0.9, 0.25);
    const float = reach * (f.still ? 0 : Math.sin(f.t * 1.1) * 0.012);
    const tilt = SLOPE + 0.74 * reach;
    const cy = CARD[1] + dy + 0.27 * reach + float;
    const st = Math.sin(tilt);
    const ct = Math.cos(tilt);
    const on = (u: number, v: number): V3 => [CARD[0] + u * CW, cy + v * CD * st, CARD[2] + v * CD * ct];
    const sheet: V3[] = [on(-1, -1), on(1, -1), on(1, 1), on(-1, 1)];
    if (cardOn > 0.003) {
      f.glow([CARD[0], CARD[1], CARD[2]], 0.5, pal.gold, (0.1 + 0.24 * reach) * cardOn);
      f.glow(on(0, 0), 0.62, pal.gold, 0.2 * reach * cardOn);
      f.fill(sheet, pal.bg, 0.94 * cardOn);
      f.fill(sheet, pal.ink, (0.25 + 0.07 * reach) * cardOn);
      f.fill(sheet, pal.gold, 0.06 * cardOn);
      // empty fields: an empty box, four ruled lines with nothing on them, and a line to sign on
      const ink = (0.42 + 0.2 * reach) * cardOn;
      f.path([on(-0.84, 0.3), on(-0.52, 0.3), on(-0.52, 0.78), on(-0.84, 0.78)], pal.ink, ink, 1, true);
      f.line(on(-0.36, 0.7), on(0.84, 0.7), pal.ink, ink, 1);
      f.line(on(-0.36, 0.38), on(0.84, 0.38), pal.ink, ink, 1);
      f.line(on(-0.84, 0.02), on(0.84, 0.02), pal.ink, ink, 1);
      f.line(on(-0.84, -0.32), on(0.84, -0.32), pal.ink, ink, 1);
      f.line(on(0.1, -0.7), on(0.84, -0.7), pal.gold, (0.6 + 0.4 * reach) * cardOn, 1.25);
      f.path(sheet, pal.gold, 0.2 * reach * cardOn, 7, true);
      f.path(sheet, pal.gold, (0.8 + 0.2 * reach) * cardOn, 1.25 + 0.6 * reach, true);
      f.label("APPLICATION", on(1, 0), { dx: 12, size: f.mobile ? 8 : 10, colour: pal.gold, alpha: 0.95 * reach * cardOn });
    }
  },
};

export default scene;
