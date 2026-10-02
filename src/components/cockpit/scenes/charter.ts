/**
 * CHARTER — what the house is, set down and sealed.
 *
 * An unrolled charter lies on the slope of a reading desk under a brass picture
 * light. Its text is drawn as strokes, never as words, in the two columns the
 * page itself has: on the left the four things GIO4X provides, each marked with
 * a filled point; on the right the three things it does not provide, each
 * marked with an open ring. A ribbon hangs from the wax seal that closes it.
 *
 * With the pointer away a quiet light reads the charter line by line. The
 * pointer takes the reading light into its own hand: the strokes beneath it
 * turn from ink to champagne, a line or two at a time, and when it comes near
 * the seal the seal is pressed into the sheet and glows, leaving its
 * impression round it. Nothing here is a figure, a date or a signature.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, ring } from "../kit";

const FLOOR = -1.2;
/** the sheet: width, height, how far it leans back, and its centre */
const W = 2.7;
const H = 1.72;
const TILT = 0.3;
const CT = Math.cos(TILT);
const ST = Math.sin(TILT);
const C: V3 = [0, 0.14, 0.1];
/** the sheet's normal, towards the reader */
const N: V3 = [0, ST, -CT];
const SEAL = { u: 0.5, v: 0.118, r: 0.135 };
/** the two columns: lines per article, and whether the article is something provided */
const COLS = [
  { u0: 0.085, u1: 0.45, articles: [2, 2, 2, 2], kept: true, gap: 0.024 },
  { u0: 0.55, u1: 0.915, articles: [3, 3, 3], kept: false, gap: 0.032 },
];
const LEAD = 0.044;

type Word = { u0: number; u1: number; v: number; row: number };
type Mark = { u: number; v: number; kept: boolean; row: number };
type State = { words: Word[]; marks: Mark[]; rows: number; scallop: [number, number][] };

/** sheet-local to world: u across, v up, both 0..1; `lift` stands proud of the sheet */
const at = (u: number, v: number, lift = 0): V3 => {
  const ly = (v - 0.5) * H;
  return [C[0] + (u - 0.5) * W, C[1] + ly * CT + lift * ST, C[2] + ly * ST - lift * CT];
};
const smooth = (k: number) => {
  const x = clamp(k);
  return x * x * (3 - 2 * x);
};

/** where the pointer's ray meets the plane through `o` with normal `n` (the camera of `aim`, inverted) */
function pick(f: Frame, o: V3, n: V3): V3 | null {
  const { yaw, pitch, dist, zoom } = f.cam;
  const k = 1 / (f.u * zoom * dist);
  const X = (f.mx - f.cx) * k;
  const Y = -(f.my - f.cy) * k;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const world = (l: number): V3 => {
    const zc = l - dist;
    const z1 = -Y * l * sp + zc * cp;
    return [X * l * cy - z1 * sy, Y * l * cp + zc * sp, X * l * sy + z1 * cy];
  };
  const a = world(0);
  const b = world(1);
  const den = (b[0] - a[0]) * n[0] + (b[1] - a[1]) * n[1] + (b[2] - a[2]) * n[2];
  if (Math.abs(den) < 1e-5) return null;
  return world(((o[0] - a[0]) * n[0] + (o[1] - a[1]) * n[1] + (o[2] - a[2]) * n[2]) / den);
}

/** clip to a polygon in the scene; when it returns true the caller restores */
function clipTo(f: Frame, pts: readonly V3[]): boolean {
  const { ctx } = f;
  const on = pts.map((p) => f.P(p[0], p[1], p[2]));
  if (on.some((p) => !p)) return false;
  ctx.save();
  ctx.beginPath();
  on.forEach((p, i) => (p && i ? ctx.lineTo(p.x, p.y) : p && ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  return true;
}

/** a solid face: a dark body under a tone, with a machined edge */
function face(f: Frame, quad: readonly V3[], tone: number, level: number): void {
  f.fill(quad, f.pal.bg, 0.94 * level);
  f.fill(quad, f.pal.ink, tone * level);
  f.path(quad, f.pal.ink, 0.26 * level, 1, true);
}

/** a block of the desk's stand: its top and the face turned to the reader */
function block(f: Frame, hx: number, y0: number, y1: number, z0: number, z1: number, level: number): void {
  if (level <= 0.003) return;
  face(f, [[-hx, y1, z0], [hx, y1, z0], [hx, y1, z1], [-hx, y1, z1]], 0.07, level);
  face(f, [[-hx, y0, z0], [hx, y0, z0], [hx, y1, z0], [-hx, y1, z0]], 0.14, level);
}

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    const words: Word[] = [];
    const marks: Mark[] = [];
    let row = 0;
    COLS.forEach((col, c) => {
      let v = 0.612;
      const left = col.u0 + 0.034;
      col.articles.forEach((n, a) => {
        marks.push({ u: col.u0 + 0.008, v, kept: col.kept, row });
        for (let j = 0; j < n; j++) {
          // the last line of an article stops short, as a paragraph does
          const stop = left + (col.u1 - left) * (j === n - 1 ? lerp(0.45, 0.8, f.rnd(c * 40 + a * 7 + j)) : 1);
          let u = left;
          let i = 0;
          while (u < stop - 0.014) {
            const len = Math.min(stop - u, (f.mobile ? 0.04 : 0.024) + 0.05 * f.rnd(row * 13 + i++));
            words.push({ u0: u, u1: u + len, v, row });
            u += len + (f.mobile ? 0.016 : 0.011);
          }
          row++;
          v -= LEAD;
        }
        v -= col.gap;
      });
    });
    // the seal's edge: wax pressed out between the fingers of the matrix
    const scallop: [number, number][] = [];
    const n = f.mobile ? 36 : 60;
    for (let i = 0; i < n; i++) scallop.push([(i / n) * TAU, 1 + 0.055 * Math.cos((i / n) * TAU * 12)]);
    return { words, marks, rows: row, scallop };
  },
  draw(f, s) {
    const { ctx, pal } = f;
    f.aim(-0.2 + (f.still ? 0 : Math.sin(f.t * 0.08) * 0.03), 0.05, 6.4, 0.95);
    /** pixels in one world unit at the sheet */
    const px = f.u * f.cam.zoom;

    // where the pointer rests on the sheet, in the sheet's own measure
    const hit = f.hover > 0 ? pick(f, C, N) : null;
    const pu = hit ? 0.5 + (hit[0] - C[0]) / W : 0.5;
    const pv = hit ? 0.5 + ((hit[1] - C[1]) * CT + (hit[2] - C[2]) * ST) / H : 0.5;

    // power-on: the stand, the sheet unrolls from the head, the light, the writing, then the seal
    const stand = f.on(0, 0.3);
    const open = f.on(0.2, 0.45);
    const lit = f.on(0.55, 0.3);
    const sealed = f.on(1, 0.22);
    const v0 = 1 - open;
    const shown = (v: number) => clamp((v - v0) / 0.06);

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [0, FLOOR, 0], 2.5, pal.key, 0.2 * f.boot);
    pool(f, [0, FLOOR, -0.5], 1.3, pal.gold, 0.1 * lit);
    if (!f.mobile && f.q > 0.6) ring(f, [0, FLOOR, 0], 1.05, { axis: "y", colour: pal.ink, alpha: 0.14 * f.boot, ticks: 48, major: 4, tickLen: 0.05 });

    // ── the stand: two steps and a column, then the sloping desk with its ledge
    block(f, 0.62, FLOOR, FLOOR + 0.06, -0.3, 0.42, stand);
    block(f, 0.4, FLOOR + 0.06, FLOOR + 0.12, -0.18, 0.3, stand);
    f.line([-0.4, FLOOR + 0.12, -0.18], [0.4, FLOOR + 0.12, -0.18], pal.key, 0.55 * stand, 1.25);
    block(f, 0.15, FLOOR + 0.12, -0.42, -0.04, 0.2, stand);
    f.line([-0.15, FLOOR + 0.12, -0.04], [-0.15, -0.8, -0.04], pal.key, 0.5 * stand, 1.25);
    face(f, [at(-0.05, -0.085, -0.04), at(1.05, -0.085, -0.04), at(1.05, 1.05, -0.04), at(-0.05, 1.05, -0.04)], 0.055, stand);
    face(f, [at(-0.05, -0.085, -0.04), at(1.05, -0.085, -0.04), at(1.05, -0.085, 0.1), at(-0.05, -0.085, 0.1)], 0.1, stand);
    face(f, [at(-0.05, -0.085, 0.1), at(1.05, -0.085, 0.1), at(1.05, -0.125, 0.1), at(-0.05, -0.125, 0.1)], 0.16, stand);
    f.line(at(-0.05, -0.085, 0.1), at(1.05, -0.085, 0.1), pal.key, 0.6 * stand, 1.25);
    // the arms of the picture light rise from behind the desk
    for (const u of [0.3, 0.7]) f.path([at(u, 1.05, -0.04), at(u, 1.11, 0.06), at(u, 1.075, 0.27)], pal.ink, 0.5 * stand, 2);

    if (open > 0.02) {
      // ── the sheet, lit from its head by the picture light and from the reader's hand by the pointer
      const sheet: V3[] = [at(0, v0), at(1, v0), at(1, 1), at(0, 1)];
      f.fill(sheet, pal.bg, 0.92 * open);
      f.fill(sheet, pal.ink, 0.075 * open);
      f.fill(sheet, pal.gold, 0.035 * open);
      const head = f.P(...at(0.5, 1));
      const foot = f.P(...at(0.5, 0.2));
      if (head && foot && clipTo(f, sheet)) {
        const g = ctx.createLinearGradient(head.x, head.y, foot.x, foot.y);
        g.addColorStop(0, rgba(pal.gold, 0.22 * lit));
        g.addColorStop(1, rgba(pal.gold, 0));
        ctx.fillStyle = g;
        ctx.fillRect(f.box.x, f.box.y, f.box.w, f.box.h);
        if (f.hover > 0) {
          const R = 0.66 * px;
          const r = ctx.createRadialGradient(f.mx, f.my, 0, f.mx, f.my, R);
          r.addColorStop(0, rgba(pal.gold, 0.3 * f.hover));
          r.addColorStop(0.5, rgba(pal.gold, 0.1 * f.hover));
          r.addColorStop(1, rgba(pal.gold, 0));
          ctx.fillStyle = r;
          ctx.fillRect(f.mx - R, f.my - R, R * 2, R * 2);
        }
        ctx.restore();
      }
      f.path(sheet, pal.ink, 0.3 * open, 1, true);
      f.path([at(0.03, v0 + 0.035), at(0.97, v0 + 0.035), at(0.97, 0.965), at(0.03, 0.965)], pal.gold, 0.5 * open, 1, true);
      f.path([at(0.042, v0 + 0.052), at(0.958, v0 + 0.052), at(0.958, 0.948), at(0.042, 0.948)], pal.ink, 0.16 * open, 1, true);

      // the heading: the one thing the house calls itself, between two rules
      const title = shown(0.86) * lit;
      for (const sd of [-1, 1]) {
        f.line(at(0.5 + sd * 0.17, 0.865), at(0.5 + sd * 0.4, 0.865), pal.gold, 0.55 * title, 1);
        f.dot(at(0.5 + sd * 0.17, 0.865), 0.012, pal.gold, 0.8 * title);
      }
      f.label("A BROKER", at(0.5, 0.865), { align: "center", display: true, size: f.mobile ? 10 : 15, colour: pal.gold, alpha: 0.95 * title });
      for (const [a, b] of [[0.33, 0.41], [0.425, 0.53], [0.545, 0.67]]) f.line(at(a, 0.795), at(b, 0.795), pal.ink, 0.4 * shown(0.795) * lit, 1.5);
      f.line(at(0.085, 0.735), at(0.915, 0.735), pal.ink, 0.22 * shown(0.735), 1);
      f.line(at(0.5, 0.7), at(0.5, 0.25), pal.ink, 0.12 * shown(0.25), 1);
      if (!f.mobile) {
        COLS.forEach((col) => {
          const near = smooth(1 - Math.hypot((col.u0 + 0.12 - pu) * W, (0.682 - pv) * H) / 0.5) * f.hover;
          f.label(col.kept ? "PROVIDES" : "DOES NOT PROVIDE", at(col.u0, 0.682), { size: 9, colour: near > 0.3 ? pal.gold : pal.ink2, alpha: (0.7 + 0.3 * near) * shown(0.682) * lit });
        });
      }

      // ── the text: strokes, read a line at a time by the quiet light or by the pointer
      const read = f.still ? 2.5 : f.t / 1.7;
      const cur = Math.floor(read) % s.rows;
      const env = f.boot < 1 ? 0 : (f.still ? 1 : Math.pow(Math.sin(Math.PI * (read % 1)), 0.7)) * (1 - f.hover);
      const under = (u: number, v: number) => smooth(1 - Math.hypot((u - pu) * W, (v - pv) * H * 2.1) / 0.44) * f.hover;
      const wide = f.mobile ? 1.25 : 1.6;
      for (const w of s.words) {
        const on = shown(w.v) * f.on(0.45 + (0.45 * w.row) / s.rows, 0.2);
        if (on <= 0.01) continue;
        const a = at(w.u0, w.v);
        const b = at(w.u1, w.v);
        const glow = Math.max(under((w.u0 + w.u1) / 2, w.v), w.row === cur ? env * 0.7 : 0);
        f.line(a, b, pal.ink, (0.36 - 0.2 * glow) * on, wide);
        if (glow > 0.01) f.line(a, b, pal.gold, glow * on, wide + 0.5);
      }
      for (const m of s.marks) {
        const on = shown(m.v) * f.on(0.45 + (0.45 * m.row) / s.rows, 0.2);
        const p = f.P(...at(m.u, m.v));
        if (!p || on <= 0.01) continue;
        const glow = Math.max(under(m.u, m.v), m.row === cur ? env * 0.7 : 0);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.6, 0.017 * px), 0, TAU);
        if (m.kept) {
          ctx.fillStyle = rgba(pal.gold, (0.75 + 0.25 * glow) * on);
          ctx.fill();
        } else {
          ctx.strokeStyle = rgba(glow > 0.3 ? pal.gold : pal.ink, (0.6 + 0.4 * glow) * on);
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }

      // ── the rolls at head and foot, with their brass ends
      for (const v of [1, v0]) {
        const a = at(-0.025, v, 0.036);
        const b = at(1.025, v, 0.036);
        f.line(a, b, pal.bg, open, 0.07 * px);
        f.line(a, b, pal.ink, 0.2 * open, 0.07 * px);
        f.line(at(-0.02, v + 0.012, 0.062), at(1.02, v + 0.012, 0.062), pal.gold, 0.5 * open, 1.25);
        f.dot(a, 0.03, pal.gold, 0.85 * open);
        f.dot(b, 0.03, pal.gold, 0.85 * open);
      }
    }

    // ── the ribbon and the seal: the pointer presses the seal home
    if (sealed > 0.01) {
      const press = f.near(at(SEAL.u, SEAL.v), 0.62 * f.u);
      const lift = lerp(0.06, 0.008, press);
      const k = SEAL.r * (1 + (1 - sealed) * 0.3) * (1 - 0.05 * press);
      const sp = (r: number, a: number, l: number, drop = 0): V3 => at(SEAL.u + (Math.cos(a) * r * k) / W, SEAL.v - drop + (Math.sin(a) * r * k) / H, l);
      const stir = f.still ? 0 : Math.sin(f.t * 0.6) * 0.006;
      for (const sd of [-1, 1]) {
        const tail = (du: number, v: number, l: number): V3 => at(SEAL.u + sd * (0.012 + (SEAL.v - v) * 0.16) + du + (v < 0 ? stir * sd : 0), v, l);
        const strip: V3[] = [tail(-0.017, SEAL.v, 0.02), tail(-0.017, -0.02, 0.115), tail(-0.017, -0.17, 0.115), tail(0, -0.145, 0.115), tail(0.017, -0.17, 0.115), tail(0.017, -0.02, 0.115), tail(0.017, SEAL.v, 0.02)];
        f.fill(strip, pal.bg, 0.9 * sealed);
        f.fill(strip, pal.crimson, 0.42 * sealed);
        f.path(strip, pal.crimson, 0.85 * sealed, 1, true);
      }
      // the impression it leaves in the sheet
      for (const [r, a] of [[1.2 + 0.16 * press, 0.6], [1.5 + 0.3 * press, 0.26]]) f.path(s.scallop.map(([t]) => sp(r, t, 0)), pal.gold, a * press, 1, true);
      f.fill(s.scallop.map(([t, r]) => sp(r * 1.03, t, 0, 0.016 * (1 - press))), pal.bg, 0.75 * sealed);
      f.glow(at(SEAL.u, SEAL.v, lift), 0.34 + 0.34 * press, pal.gold, (0.22 + 0.5 * press) * sealed);
      const wax = s.scallop.map(([t, r]) => sp(r, t, lift));
      f.fill(wax, pal.bg, 0.94 * sealed);
      f.fill(wax, pal.gold, (0.3 + 0.3 * press) * sealed);
      f.path(wax, pal.gold, 0.95 * sealed, 1.25, true);
      f.path(s.scallop.map(([t]) => sp(0.76, t, lift)), pal.gold, 0.75 * sealed, 1, true);
      f.path(s.scallop.map(([t]) => sp(0.58, t, lift)), pal.gold, 0.4 * sealed, 1, true);
      if (!f.mobile) for (let i = 0; i < 16; i++) f.dot(sp(0.67, (i / 16) * TAU, lift), 0.007, pal.gold, 0.8 * sealed);
      // the device: a four-pointed star, the same on every charter of the house
      const star: V3[] = [];
      for (let i = 0; i < 8; i++) star.push(sp(i % 2 ? 0.14 : 0.46, (i / 8) * TAU + TAU / 4, lift));
      f.fill(star, pal.gold, (0.7 + 0.3 * press) * sealed);
      f.dot(at(SEAL.u, SEAL.v, lift), 0.012, pal.bg, sealed);
    }

    // ── the picture light: a brass tube over the head of the sheet
    const t0 = at(0.2, 1.075, 0.27);
    const t1 = at(0.8, 1.075, 0.27);
    f.line(t0, t1, pal.bg, stand, 0.055 * px);
    f.line(t0, t1, pal.ink, 0.3 * stand, 0.055 * px);
    f.line(at(0.2, 1.06, 0.27), at(0.8, 1.06, 0.27), pal.gold, 0.95 * lit, 1.5);
    f.glow(at(0.5, 1.05, 0.27), 0.5, pal.gold, 0.16 * lit);
    lamp(f, t0, pal.gold, 0.7 * lit, 0.012);
    lamp(f, t1, pal.gold, 0.7 * lit, 0.012);
  },
};

export default scene;
