/**
 * PROOF — the editor's desk.
 *
 * A galley proof lies on the desk under the lamp: a headline, a standfirst and
 * two columns of copy, every word drawn as a stroke. In the margins stand the
 * proof-reader's signs (delete, insert, new paragraph, transpose, close up,
 * space), each beside the line it corrects. A pencil lies across the foot of
 * the sheet, and a reading loupe stands on its three legs over the copy.
 *
 * The page is about how GIO4X Intelligence is written and how a mistake is
 * corrected in the open, so the instrument is the correction itself: seen,
 * marked, and left visible. Nothing here is a text, a date or a figure.
 *
 * The pointer takes the loupe. It glides over the sheet to stand under the
 * cursor, and the copy inside its lens is drawn larger and brighter; the
 * correction nearest to it is struck in champagne, sign and word together.
 * With the pointer away the loupe reads on by itself, slowly.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, pool, ring } from "../kit";

/** the sheet: half its width and depth, its margins, half the gutter, its height over the desk */
const SX = 1.4;
const SZ = 0.92;
const MARGIN = 0.36;
const GUT = 0.07;
const PAPER = 0.012;
/** the loupe: the height of its lens, its radius, its power; and the size of a margin sign */
const LENS_Y = 0.4;
const LENS_R = 0.34;
const MAG = 1.9;
const G = 0.074;

type XZ = readonly [number, number];
type Word = { x0: number; x1: number; z: number; order: number; heavy: number };
type Mark = { kind: number; x: number; z: number; w: number };
type State = { words: Word[]; marks: Mark[]; lit: number[]; unit: XZ[]; lx: number; lz: number; placed: boolean };
/** sheet coordinates to the world: flat on the desk, or enlarged in the plane of the lens */
type Lay = (x: number, z: number) => V3;

/** the proof-reader's signs, as pen strokes in a square of side two; each is followed by its slash */
const SLASH: XZ[] = [[1.3, -0.9], [1.8, 0.9]];
const GLYPHS: XZ[][][] = [
  [[[-1, -0.8], [-0.3, -0.1], [0.2, 0.55], [0.6, 0.85], [0.9, 0.6], [0.8, 0.15], [0.4, 0], [0.1, 0.3], [0.3, 0.75]]],
  [[[-0.7, -0.7], [0, 0.5], [0.7, -0.7]], [[-0.5, 0.9], [0.5, 0.9]]],
  [[[0.5, 0.9], [-0.1, 0.9], [-0.55, 0.6], [-0.55, 0.2], [-0.1, 0], [0.1, 0]], [[0.1, 0.9], [0.1, -0.9]], [[0.5, 0.9], [0.5, -0.9]]],
  [[[-1, 0.5], [-0.6, 0.8], [-0.2, 0.5], [0, 0], [0.2, -0.5], [0.6, -0.8], [1, -0.5]]],
  [[[-0.8, 0.4], [-0.3, 0.85], [0.3, 0.85], [0.8, 0.4]], [[-0.8, -0.4], [-0.3, -0.85], [0.3, -0.85], [0.8, -0.4]]],
  [[[-0.4, -0.9], [-0.1, 0.9]], [[0.2, -0.9], [0.5, 0.9]], [[-0.8, 0.35], [0.9, 0.35]], [[-0.9, -0.35], [0.8, -0.35]]],
];

/** where the pointer's line of sight meets the level plane y = h, as [x, z] */
function pick(f: Frame, h: number): XZ | null {
  const { yaw, pitch, dist, zoom } = f.cam;
  const a = (f.mx - f.cx) / (f.u * dist * zoom);
  const b = (f.cy - f.my) / (f.u * dist * zoom);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const den = b * cp + sp;
  if (Math.abs(den) < 1e-4) return null;
  const depth = (h + dist * sp) / den;
  if (depth < 0.35) return null;
  const x1 = a * depth;
  const z1 = -b * depth * sp + (depth - dist) * cp;
  return [x1 * Math.cos(yaw) - z1 * Math.sin(yaw), x1 * Math.sin(yaw) + z1 * Math.cos(yaw)];
}

/** one face of a solid: a dark body under a tint, with a fine edge */
function face(f: Frame, pts: readonly V3[], colour: string, tone: number, on: number): void {
  f.fill(pts, f.pal.bg, 0.95 * on);
  f.fill(pts, colour, tone * on);
  f.path(pts, colour, Math.min(1, tone + 0.2) * 0.6 * on, 1, true);
}

/** is this face turned the same way as the reference face (both given in the same winding)? */
function turned(f: Frame, pts: readonly V3[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = f.P(...pts[i]);
    const q = f.P(...pts[(i + 1) % pts.length]);
    if (!p || !q) return 0;
    area += p.x * q.y - q.x * p.y;
  }
  return Math.sign(area);
}

/** a six-sided pencil lying on the sheet: sharpened point, champagne barrel, ferrule and rubber */
function pencil(f: Frame, tip: V3, end: V3, r: number, on: number): void {
  if (on <= 0.003) return;
  const { pal } = f;
  const len = Math.hypot(end[0] - tip[0], end[2] - tip[2]);
  const ax = (end[0] - tip[0]) / len;
  const az = (end[2] - tip[2]) / len;
  // corner k of the hexagon at distance d from the point; it rests on a flat
  const at = (d: number, k: number, scale = 1): V3 => {
    const a = (k * TAU) / 6;
    const c = Math.cos(a) * r * scale;
    return [tip[0] + ax * d - az * c, tip[1] + r * 0.87 + Math.sin(a) * r * scale, tip[2] + az * d + ax * c];
  };
  const band = (d0: number, d1: number, s0: number, colour: string, tones: readonly number[]) => {
    const quad = (k: number): V3[] => [at(d0, k, s0), at(d1, k), at(d1, k + 1), at(d0, k + 1, s0)];
    const up = turned(f, quad(1));
    for (const k of [0, 2, 1]) if (turned(f, quad(k)) === up) face(f, quad(k), colour, tones[k], on);
  };
  // its shadow on the paper, then the body from the point backwards
  f.line([tip[0] + ax * 0.1, tip[1], tip[2] + az * 0.1 - 0.03], [end[0], end[1], end[2] - 0.03], pal.bg, 0.5 * on, 5);
  band(0.045, 0.19, 0.3, pal.ink, [0.2, 0.42, 0.3]);
  f.fill([at(0.045, 0, 0.3), at(0.045, 3, 0.3), [tip[0], tip[1] + r * 0.87, tip[2]]], pal.ink, 0.9 * on);
  band(0.19, len - 0.2, 1, pal.gold, [0.3, 0.72, 0.46]);
  band(len - 0.2, len - 0.09, 1, pal.ink, [0.3, 0.62, 0.42]);
  band(len - 0.09, len, 1, pal.crimson, [0.26, 0.5, 0.36]);
  // the catch-light along the upper arris
  f.line(at(0.19, 2), at(len - 0.2, 2), pal.ink, 0.5 * on, 1);
}

/** the copy and its corrections, on the sheet or through the lens */
function copy(f: Frame, s: State, lay: Lay, lens: boolean): void {
  const { pal } = f;
  const reach = LENS_R / MAG + 0.04;
  const fine = f.mobile ? 0.75 : 1;
  for (const w of s.words) {
    if (lens && (Math.abs(w.z - s.lz) > reach || w.x1 < s.lx - reach || w.x0 > s.lx + reach)) continue;
    // the copy is set line by line as the instrument powers on
    const on = f.on(w.order, 0.3);
    if (on <= 0) continue;
    const x1 = lerp(w.x0, w.x1, on);
    const alpha = w.heavy ? 0.82 : lens ? 0.95 : 0.46;
    f.line(lay(w.x0, w.z), lay(x1, w.z), pal.ink, alpha * on, (w.heavy ? 3.2 : 1.5) * (lens ? 2 : fine));
  }
  s.marks.forEach((m, i) => {
    const on = f.on(0.74 + 0.04 * i, 0.2);
    const w = s.words[m.w];
    if (on <= 0 || (lens && Math.abs(m.z - s.lz) > reach + G)) return;
    const lit = s.lit[i];
    const width = (lens ? 2.4 : 1.4) * fine;
    const pen = (pts: readonly XZ[], sx: number, sz: number, k: number) => {
      const out = pts.map(([gx, gz]): V3 => lay(sx + gx * k, sz + gz * k));
      f.path(out, pal.key, 0.85 * (1 - lit) * on, width);
      f.path(out, pal.gold, lit * on, width + 0.5 * lit);
    };
    // the sign in the margin, with its slash
    if (lit > 0.02 && !lens) f.glow(lay(m.x + 0.4 * G, m.z), 0.26, pal.gold, 0.3 * lit * on);
    for (const stroke of GLYPHS[m.kind]) pen(stroke, m.x, m.z, G);
    pen(SLASH, m.x, m.z, G);
    // and the place in the line: a pencil tick at rest, a full strike when it is the one being read
    pen([[-0.012, -0.014], [w.x1 - w.x0 + 0.012, 0.014]], w.x0, w.z, 1);
    if (lit > 0.02) {
      const side = Math.sign(m.x);
      const from = side > 0 ? w.x1 + 0.02 : w.x0 - 0.02;
      f.line(lay(w.x0 - 0.015, w.z), lay(lerp(w.x0, w.x1 + 0.015, lit), w.z), pal.gold, lit * on, width + 1.4);
      f.line(lay(from, w.z - 0.034), lay(m.x - side * 1.3 * G, w.z - 0.034), pal.gold, 0.4 * lit * on, 1);
    }
  });
}

const scene: Scene<State> = {
  pose: 15,
  setup(f) {
    const left = -SX + MARGIN;
    // headline and standfirst, then a rule
    const words: Word[] = [
      { x0: left, x1: 0.3, z: SZ - 0.15, order: 0.08, heavy: 1 },
      { x0: left, x1: -0.18, z: SZ - 0.25, order: 0.12, heavy: 0 },
    ];
    const marks: Mark[] = [];
    const step = f.mobile ? 0.15 : 0.108;
    const rows = Math.floor((2 * SZ - 0.52) / step);
    let n = 0;
    for (let col = 0; col < 2; col++) {
      const a = col ? GUT : left;
      const b = col ? SX - MARGIN : -GUT;
      for (let r = 0; r < rows; r++) {
        const z = SZ - 0.42 - r * step;
        // a paragraph opens with an indent and closes on a short line
        const end = r % 5 === 4 ? lerp(a, b, 0.35 + 0.35 * f.rnd(n + 3)) : b;
        let x = a + (r % 5 === 0 ? 0.07 : 0);
        const first = words.length;
        while (x < end - 0.05) {
          const x1 = Math.min(end, x + 0.07 + 0.17 * f.rnd(n++));
          words.push({ x0: x, x1, z, order: 0.16 + 0.5 * (col * 0.5 + (r / rows) * 0.5), heavy: 0 });
          x = x1 + 0.034;
        }
        // a correction every fourth line, signed in the margin beside its own column
        if (r % 4 === (col ? 3 : 1) && words.length - first > 3) {
          marks.push({ kind: marks.length % GLYPHS.length, x: (col ? 1 : -1) * (SX - MARGIN * 0.56), z, w: col ? words.length - 2 : first + 1 });
        }
      }
    }
    const unit: XZ[] = [];
    const seg = f.mobile ? 28 : 44;
    for (let i = 0; i < seg; i++) unit.push([Math.cos((i / seg) * TAU), Math.sin((i / seg) * TAU)]);
    return { words, marks, lit: marks.map(() => 0), unit, lx: 0, lz: 0, placed: false };
  },
  draw(f, s) {
    const { ctx, pal } = f;
    // looked down upon, as a sheet on a desk is; turned a little so the columns run away from the reader
    f.aim(-0.24 + (f.still ? 0 : Math.sin(f.t * 0.06) * 0.03), -0.8, 6.4, 1.08);

    // ── where the loupe stands: reading on by itself, or under the pointer
    const ix = -0.15 + 0.6 * Math.sin(f.t * 0.11 + 0.6);
    const iz = 0.02 + 0.4 * Math.sin(f.t * 0.073 + 2.1);
    const hit = f.hover > 0 ? pick(f, LENS_Y) : null;
    const tx = hit ? lerp(ix, clamp(hit[0], -SX + 0.1, SX - 0.1), f.hover) : ix;
    const tz = hit ? lerp(iz, clamp(hit[1], -SZ + 0.1, SZ - 0.1), f.hover) : iz;
    const ease = (rate: number) => (s.placed && !f.still ? 1 - Math.exp(-f.dt * rate) : 1);
    s.lx += (tx - s.lx) * ease(9);
    s.lz += (tz - s.lz) * ease(9);
    // the correction nearest the lens is the one being read
    let best = 0;
    let bd = Infinity;
    s.marks.forEach((m, i) => {
      const w = s.words[m.w];
      const d = Math.min(Math.hypot(m.x - s.lx, m.z - s.lz), Math.hypot((w.x0 + w.x1) / 2 - s.lx, w.z - s.lz));
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    for (let i = 0; i < s.lit.length; i++) s.lit[i] += ((i === best ? 1 : 0) - s.lit[i]) * ease(5);
    s.placed = true;
    const { lx, lz } = s;

    // ── the desk, the lamp's pool, and the proof before this one under the sheet
    deck(f, { y: 0, half: 3, step: 0.5, alpha: 0.08, drift: 0 });
    pool(f, [-0.2, 0, 0.15], 2.5, pal.key, 0.2 * f.boot);
    const sheetOn = f.on(0, 0.3);
    const flat: Lay = (x, z) => [x, PAPER, z];
    const under: V3[] = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as XZ[]).map(([u, v]) => [u * SX * 0.99 + 0.13 - v * 0.09, 0.004, v * SZ + 0.1 + u * 0.13]);
    f.fill(under, pal.bg, 0.8 * sheetOn);
    f.fill(under, pal.ink, 0.03 * sheetOn);
    f.path(under, pal.ink, 0.16 * sheetOn, 1, true);

    // ── the galley: a pale sheet, lit along its head, with the margins ruled off
    const sheet: V3[] = [flat(-SX, -SZ), flat(SX, -SZ), flat(SX, SZ), flat(-SX, SZ)];
    f.fill(sheet, pal.bg, 0.92 * sheetOn);
    f.fill(sheet, pal.ink, 0.075 * sheetOn);
    f.path(sheet, pal.ink, 0.34 * sheetOn, 1, true);
    f.line(sheet[3], sheet[2], pal.key, 0.6 * sheetOn, 1.5);
    for (const side of [-1, 1]) f.line(flat(side * (SX - MARGIN + 0.05), -SZ + 0.06), flat(side * (SX - MARGIN + 0.05), SZ - 0.06), pal.ink, 0.09 * sheetOn, 1);
    f.line(flat(-SX + MARGIN, SZ - 0.33), flat(SX - MARGIN, SZ - 0.33), pal.ink, 0.22 * f.on(0.14), 1);
    // a type scale beyond the head of the sheet: graduations only
    const ruleOn = f.on(0.4, 0.3);
    const rule = (u: number, v: number): V3 => [-1.25 + u * 1.9 - v * 0.012, 0.004, 1.13 + u * 0.1 + v * 0.11];
    const strip: V3[] = [rule(0, 0), rule(1, 0), rule(1, 1), rule(0, 1)];
    f.fill(strip, pal.bg, 0.85 * ruleOn);
    f.fill(strip, pal.ink, 0.06 * ruleOn);
    f.path(strip, pal.ink, 0.3 * ruleOn, 1, true);
    const ticks = f.mobile ? 20 : 40;
    for (let i = 1; i < ticks; i++) f.line(rule(i / ticks, 0), rule(i / ticks, i % 5 ? 0.3 : 0.6), pal.ink, (i % 5 ? 0.3 : 0.55) * ruleOn, 1);

    pool(f, [lx, PAPER, lz], LENS_R * 2.2, pal.key, 0.2 * f.on(0.9));
    copy(f, s, flat, false);
    f.label("PROOF", flat(SX - 0.09, SZ - 0.15), { align: "right", size: f.mobile ? 8 : 10, colour: pal.ink2, alpha: 0.8 * f.on(0.3) });

    pencil(f, [0.3, PAPER, -0.8], [1.74, PAPER, -0.3], f.mobile ? 0.04 : 0.034, f.on(0.6, 0.3));

    // ── the loupe: a foot ring on the paper, three legs, and the lens in its collar
    const on = f.on(0.9, 0.3);
    if (on <= 0.003) return;
    const y = LENS_Y + (1 - on) * 0.3;
    const c: V3 = [lx, y, lz];
    ring(f, [lx, PAPER, lz], LENS_R * 0.9, { colour: pal.ink, alpha: 0.26 * on, seg: 40 });
    for (let k = 0; k < 3; k++) {
      const a = 0.5 + (k * TAU) / 3;
      f.line([lx + Math.cos(a) * LENS_R * 0.9, PAPER, lz + Math.sin(a) * LENS_R * 0.9], [lx + Math.cos(a) * LENS_R, y - 0.05, lz + Math.sin(a) * LENS_R], pal.ink, 0.62 * on, 2);
    }
    ring(f, [lx, y - 0.05, lz], LENS_R, { colour: pal.ink, alpha: 0.4 * on, width: 2, seg: 44 });
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < s.unit.length; i++) {
      const p = f.P(lx + s.unit[i][0] * LENS_R, y, lz + s.unit[i][1] * LENS_R);
      if (!p) continue;
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(pal.bg, 0.9 * on);
    ctx.fill();
    ctx.clip();
    // through the glass: the same sheet, enlarged about the point the lens stands over, and better lit
    const big: Lay = (x, z) => [lx + (x - lx) * MAG, y, lz + (z - lz) * MAG];
    const page: V3[] = [big(-SX, -SZ), big(SX, -SZ), big(SX, SZ), big(-SX, SZ)];
    f.fill(page, pal.ink, 0.11 * on);
    f.fill(page, pal.key, 0.1 * on);
    f.path(page, pal.ink, 0.5 * on, 1.5, true);
    copy(f, s, big, true);
    ctx.restore();
    // the collar, a highlight on the glass and the lamp's light on the far rim
    ring(f, c, LENS_R, { colour: pal.ink, alpha: 0.62 * on, width: f.mobile ? 2.4 : 3.4, seg: 44 });
    ring(f, c, LENS_R, { colour: pal.key, alpha: 0.95 * on, width: 1.5, from: 0.08, to: 0.4, seg: 44 });
    ring(f, c, LENS_R * 0.8, { colour: pal.ink, alpha: 0.3 * on, width: 2, from: 0.62, to: 0.74, seg: 44 });
  },
};

export default scene;
