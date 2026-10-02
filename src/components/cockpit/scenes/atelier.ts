/**
 * ATELIER — a desk waiting for someone.
 *
 * A draughtsman's board on its trestle, an articulated lamp clamped to its
 * corner, and an empty chair turned a little away, as if it had just been left
 * or were about to be taken. On the sheet is an unfinished drawing: the
 * construction of a golden rectangle, the proportion this whole site is set
 * out on, in fine construction lines only. The title block names two things,
 * DRAWN BY and CHECKED, and both rules beside them are blank.
 *
 * Where the lamp falls the drawing is finished: firm outlines, the spiral, the
 * dimension lines (with no figures on them). With the pointer away the lamp
 * drifts slowly over the sheet. The pointer takes the lamp by the head: the
 * arm reaches, the shade turns to follow the cursor, and the cone of light
 * falls on that part of the sheet, where more of the drawing appears.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, pool } from "../kit";

const FLOOR = -1.12;
/** the board: width, height, how far it leans back, its centre, its normal towards the chair */
const W = 2.2;
const H = 1.42;
const TILT = 0.44;
const CT = Math.cos(TILT);
const ST = Math.sin(TILT);
const C: V3 = [-0.36, 0.19, 0.2];
const N: V3 = [0, ST, -CT];
/** the golden rectangle on the sheet, in board units from its bottom-left corner */
const GX = 0.3;
const GY = 0.34;
const GW = 1.4;
const GH = GW / ((1 + Math.sqrt(5)) / 2);
/** the lamp: the length of each arm, and how far its light reaches on the sheet */
const ARM = 0.64;
const REACH = 0.56;
const SEAT = FLOOR + 0.6;
const CHAIR: V3 = [1.2, FLOOR, -0.7];

type V2 = [number, number];
type Seg = { a: V2; b: V2; gold: boolean };
type State = { faint: V2[][]; ink: Seg[] };

/** board-local to world: u across, v up, both 0..1; `lift` stands proud of the board */
const at = (u: number, v: number, lift = 0): V3 => {
  const ly = (v - 0.5) * H;
  return [C[0] + (u - 0.5) * W, C[1] + ly * CT + lift * ST, C[2] + ly * ST - lift * CT];
};
/** the same in board units, for the drawing */
const d = (p: V2, lift = 0): V3 => at(p[0] / W, p[1] / H, lift);
const smooth = (k: number) => {
  const x = clamp(k);
  return x * x * (3 - 2 * x);
};
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

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
  const den = dot(add(b, a, -1), n);
  if (Math.abs(den) < 1e-5) return null;
  return world(dot(add(o, a, -1), n) / den);
}

/** a solid face: a dark body under a tone, with a machined edge */
function face(f: Frame, pts: readonly V3[], tone: number, level: number, edge = 0.28): void {
  f.fill(pts, f.pal.bg, 0.95 * level);
  f.fill(pts, f.pal.ink, tone * level);
  f.path(pts, f.pal.ink, edge * level, 1, true);
}

/** a tube or a bar: a dark body between two fine edges */
function rod(f: Frame, pts: readonly V3[], width: number, level: number, tone = 0.16): void {
  if (level <= 0.003) return;
  f.path(pts, f.pal.ink, 0.6 * level, width);
  f.path(pts, f.pal.bg, level, Math.max(1, width - 2));
  f.path(pts, f.pal.ink, tone * level, Math.max(1, width - 2));
}

/** the empty chair: five feet, a column with a foot ring, a round seat and a curved back, turned by `turn` */
function chair(f: Frame, turn: number, level: number): void {
  if (level <= 0.003) return;
  const { pal } = f;
  const [cx, , cz] = CHAIR;
  const on = (r: number, y: number, a: number): V3 => [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r];
  const loop = (r: number, y: number, from: number, to: number, n: number): V3[] => {
    const o: V3[] = [];
    for (let i = 0; i <= n; i++) o.push(on(r, y, from + ((to - from) * i) / n));
    return o;
  };
  const n = f.mobile ? 14 : 24;
  for (let i = 0; i < 5; i++) {
    const a = turn + 0.4 + (i * TAU) / 5;
    rod(f, [on(0, FLOOR + 0.07, a), on(0.3, FLOOR + 0.03, a)], 3.5, level);
    f.dot(on(0.3, FLOOR + 0.02, a), 0.022, pal.ink, 0.6 * level);
  }
  rod(f, [on(0, FLOOR + 0.07, 0), on(0, SEAT - 0.04, 0)], 5, level, 0.24);
  f.path(loop(0.2, FLOOR + 0.25, 0, TAU, n), pal.ink, 0.5 * level, 2);
  // the seat: its edge towards the viewer, then its top
  face(f, [...loop(0.28, SEAT - 0.07, Math.PI / 2, 1.5 * Math.PI, n >> 1), ...loop(0.28, SEAT, 1.5 * Math.PI, Math.PI / 2, n >> 1)], 0.16, level);
  face(f, loop(0.28, SEAT, 0, TAU, n), 0.08, level);
  f.path(loop(0.28, SEAT, 3.6, 4.6, 8), pal.key, 0.6 * level, 1.25);
  // the back stands on the side away from the board, so the chair faces the drawing
  const mid = turn + Math.PI;
  rod(f, [on(0.2, SEAT - 0.03, mid), on(0.31, SEAT + 0.04, mid), on(0.31, SEAT + 0.24, mid)], 4, level, 0.24);
  // a curved pad with eased corners: its foot, then its head back the other way
  const pad: V3[] = [];
  for (let i = 0; i <= 20; i++) {
    const k = i <= 10 ? i / 10 : (20 - i) / 10;
    const ease = 0.045 * Math.pow(Math.abs(k * 2 - 1), 4);
    pad.push(on(0.31, i <= 10 ? SEAT + 0.17 + ease : SEAT + 0.4 - ease, mid + (k * 2 - 1) * 0.85));
  }
  face(f, pad, 0.13, level, 0.4);
  for (const a of [-0.45, 0, 0.45]) f.line(on(0.31, SEAT + 0.19, mid + a), on(0.31, SEAT + 0.38, mid + a), pal.ink, 0.16 * level, 1);
  f.path(pad.slice(12, 20), pal.key, 0.5 * level, 1.25);
}

const scene: Scene<State> = {
  pose: 14,
  setup(f) {
    const step = f.mobile ? 0.17 : 0.1;
    const faint: V2[][] = [];
    const ink: Seg[] = [];
    // a firm line is laid down in short lengths, so the lamp can find part of it
    const firm = (a: V2, b: V2, gold = false) => {
      const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let i = 0; i < n; i++) ink.push({ a: [lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)], b: [lerp(a[0], b[0], (i + 1) / n), lerp(a[1], b[1], (i + 1) / n)], gold });
    };
    // a construction line overruns both of its ends, as a pencil does along a rule
    const rule = (a: V2, b: V2, over = 0.08) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ex = ((b[0] - a[0]) / l) * over;
      const ey = ((b[1] - a[1]) / l) * over;
      faint.push([[a[0] - ex, a[1] - ey], [b[0] + ex, b[1] + ey]]);
    };
    const x1 = GX + GW;
    const y1 = GY + GH;
    for (const [a, b] of [[[GX, GY], [x1, GY]], [[x1, GY], [x1, y1]], [[x1, y1], [GX, y1]], [[GX, y1], [GX, GY]]] as [V2, V2][]) {
      rule(a, b, 0.12);
      firm(a, b);
    }
    // how the rectangle is found: half the square's base, swung down from its far corner
    const swing: V2[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = (Math.atan2(GH, GH / 2) * (10 - i)) / 10;
      swing.push([GX + GH / 2 + Math.cos(a) * GH * 1.118, GY + Math.sin(a) * GH * 1.118]);
    }
    faint.push(swing);
    rule([GX + GH / 2, GY], [GX + GH, y1], 0.05);
    // the two diagonals that cross at the eye of the spiral
    rule([GX, y1], [x1, GY]);
    rule([GX + GH, GY], [x1, y1]);
    // the squares, cut off one after another, and the quarter turn of the spiral in each
    let x = GX;
    let y = GY;
    let w = GW;
    let h = GH;
    for (let k = 0; k < (f.mobile ? 5 : 7); k++) {
      const dir = k % 4;
      const s = dir % 2 ? w : h;
      let a: V2;
      let b: V2;
      let c: V2;
      if (dir === 0) {
        [a, b, c] = [[x + s, y], [x + s, y + h], [x + s, y]];
        x += s;
        w -= s;
      } else if (dir === 1) {
        [a, b, c] = [[x, y + h - s], [x + w, y + h - s], [x, y + h - s]];
        h -= s;
      } else if (dir === 2) {
        [a, b, c] = [[x + w - s, y], [x + w - s, y + h], [x + w - s, y + h]];
        w -= s;
      } else {
        [a, b, c] = [[x, y + s], [x + w, y + s], [x + w, y + s]];
        y += s;
        h -= s;
      }
      rule(a, b, 0.05);
      firm(a, b);
      const a0 = Math.PI - (dir * Math.PI) / 2;
      const n = Math.max(2, Math.round((s * 1.571) / step));
      const on = (i: number): V2 => [c[0] + Math.cos(a0 - (i / n) * (Math.PI / 2)) * s, c[1] + Math.sin(a0 - (i / n) * (Math.PI / 2)) * s];
      for (let i = 0; i < n; i++) ink.push({ a: on(i), b: on(i + 1), gold: true });
      if (k < 4) {
        firm([c[0] - 0.035, c[1]], [c[0] + 0.035, c[1]]);
        firm([c[0], c[1] - 0.035], [c[0], c[1] + 0.035]);
      }
    }
    // dimension lines, with their witness marks and no figures
    const dy = y1 + 0.075;
    const dx = x1 + 0.085;
    firm([GX, dy], [x1, dy]);
    for (const u of [GX, GX + GH, x1]) firm([u, dy - 0.035], [u, dy + 0.035]);
    firm([dx, GY], [dx, y1]);
    for (const v of [GY, y1]) firm([dx - 0.035, v], [dx + 0.035, v]);
    return { faint, ink };
  },
  draw(f, s) {
    const { ctx, pal } = f;
    f.aim(0.12 + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.03), 0.08, 6.4, 1);
    const px = f.u * f.cam.zoom;

    // power-on: the trestle and the board, the chair, the construction, the lamp's arm, then its light
    const body = f.on(0, 0.3);
    const seat = f.on(0.25, 0.3);
    const drawn = f.on(0.3, 0.45);
    const arm = f.on(0.6, 0.3);
    const lit = f.on(1, 0.3);

    // ── where the lamp is looking: a slow drift of its own, or the pointer on the board
    const hit = f.hover > 0 ? pick(f, C, N) : null;
    const pu = hit ? clamp(0.5 + (hit[0] - C[0]) / W, 0.14, 0.86) : 0.5;
    const pv = hit ? clamp(0.5 + ((hit[1] - C[1]) * CT + (hit[2] - C[2]) * ST) / H, 0.22, 0.8) : 0.5;
    const tu = lerp(f.still ? 0.5 : 0.47 + 0.2 * Math.sin(f.t * 0.13), pu, f.hover);
    const tv = lerp(f.still ? 0.56 : 0.55 + 0.16 * Math.sin(f.t * 0.19 + 1), pv, f.hover);
    const T = at(tu, tv);
    const reach = REACH * (1 + 0.12 * f.hover);

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [C[0], FLOOR, 0.1], 2.5, pal.key, 0.2 * f.boot);
    pool(f, [C[0] + (tu - 0.5) * W * 0.6, FLOOR, -0.5], 1.2, pal.gold, 0.11 * lit);

    // ── the trestle: two frames and a rail, behind the board
    for (const u of [0.12, 0.88]) {
      const x = C[0] + (u - 0.5) * W;
      rod(f, [[x, FLOOR, C[2] - 0.32], [x, FLOOR, C[2] + 0.8]], 4, body);
      rod(f, [[x, FLOOR, C[2] + 0.8], at(u, 0.7, -0.06)], 4, body);
      rod(f, [[x, FLOOR, C[2] - 0.32], at(u, 0.2, -0.06)], 4, body);
    }
    rod(f, [[C[0] - 0.38 * W, FLOOR + 0.3, C[2] + 0.44], [C[0] + 0.38 * W, FLOOR + 0.3, C[2] + 0.44]], 3, body);

    // ── the board, the sheet taped to it, the ledge with a pencil on it
    const board: V3[] = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
    face(f, [at(0, 0, -0.05), at(1, 0, -0.05), at(1, 1, -0.05), at(0, 1, -0.05)], 0.03, body);
    face(f, board, 0.05, body, 0.34);
    f.line(at(0, 1), at(1, 1), pal.key, 0.55 * body, 1.25);
    const sheet: V3[] = [at(0.04, 0.06), at(0.96, 0.06), at(0.96, 0.94), at(0.04, 0.94)];
    f.fill(sheet, pal.ink, 0.07 * body);
    f.path(sheet, pal.ink, 0.22 * body, 1, true);
    for (const [u, v] of [[0.04, 0.06], [0.96, 0.06], [0.96, 0.94], [0.04, 0.94]]) f.line(at(u - 0.014, v + (v > 0.5 ? -0.03 : 0.03)), at(u + 0.014, v + (v > 0.5 ? 0.012 : -0.012)), pal.gold, 0.4 * body, 3);

    // the lamp's light on the board
    const tp = f.P(T[0], T[1], T[2]);
    const corners = board.map((p) => f.P(p[0], p[1], p[2]));
    if (tp && lit > 0.01 && corners.every((p) => p)) {
      ctx.save();
      ctx.beginPath();
      corners.forEach((p, i) => (p && i ? ctx.lineTo(p.x, p.y) : p && ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.clip();
      const R = reach * px * 1.25;
      const g = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, R);
      g.addColorStop(0, rgba(pal.gold, 0.3 * lit));
      g.addColorStop(0.55, rgba(pal.gold, 0.11 * lit));
      g.addColorStop(1, rgba(pal.gold, 0));
      ctx.fillStyle = g;
      ctx.fillRect(tp.x - R, tp.y - R, R * 2, R * 2);
      ctx.restore();
    }

    // ── the drawing: construction lines always, the finished line only where the lamp falls
    const under = (x: number, y: number) => smooth(1.2 - Math.hypot(x - tu * W, y - tv * H) / reach) * lit;
    s.faint.forEach((line, i) => {
      const on = clamp(drawn * (s.faint.length + 3) - i);
      const mid = line[line.length >> 1];
      f.path(line.map((p) => d(p)), pal.ink, (0.2 + 0.14 * under(mid[0], mid[1])) * on, 1);
    });
    for (const g of s.ink) {
      const k = under((g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2);
      if (k > 0.02) f.line(d(g.a), d(g.b), g.gold ? pal.gold : pal.ink, (g.gold ? 1 : 0.85) * k, g.gold ? 1.9 : 1.3);
    }
    // the title block: two names and two blank rules
    const block = drawn * body;
    f.path([d([1.4, 0.115]), d([2.06, 0.115]), d([2.06, 0.275]), d([1.4, 0.275])], pal.ink, 0.36 * block, 1, true);
    f.line(d([1.4, 0.195]), d([2.06, 0.195]), pal.ink, 0.24 * block, 1);
    ["DRAWN BY", "CHECKED"].forEach((name, i) => {
      const y = 0.235 - i * 0.08;
      if (!f.mobile) f.label(name, d([1.43, y]), { size: 8, colour: pal.ink2, alpha: (0.8 + 0.2 * under(1.6, y)) * block });
      f.line(d([f.mobile ? 1.5 : 1.8, y - 0.022]), d([2.02, y - 0.022]), pal.gold, 0.5 * block, 1);
    });
    face(f, [at(-0.01, -0.01, 0), at(1.01, -0.01, 0), at(1.01, -0.01, 0.1), at(-0.01, -0.01, 0.1)], 0.1, body);
    face(f, [at(-0.01, -0.01, 0.1), at(1.01, -0.01, 0.1), at(1.01, -0.05, 0.1), at(-0.01, -0.05, 0.1)], 0.16, body);
    f.line(at(0.56, 0.006, 0.07), at(0.71, 0.006, 0.07), pal.gold, 0.85 * body, 2.5);
    f.line(at(0.71, 0.006, 0.07), at(0.725, 0.006, 0.07), pal.ink, 0.8 * body, 1.5);

    chair(f, -0.55 + (f.still ? 0 : Math.sin(f.t * 0.11) * 0.07), seat);

    // ── the lamp: a clamp on the corner, two arms, and a shade that looks where the light should fall
    const foot = at(0.03, 1, 0.02);
    const shoulder = add(foot, [0, 0.09, 0]);
    const head = at(lerp(0.22, 0.5, tu), lerp(0.74, 1, tv), 0.6);
    const span = add(head, shoulder, -1);
    const half = Math.min(Math.hypot(span[0], span[1], span[2]) / 2, ARM - 0.01);
    const axis = unit(span);
    // the elbow stands up and out to the side, square to the line from shoulder to head
    const up: V3 = [-0.5, 0.8, -0.3];
    const elbow = add(add(shoulder, axis, half), unit(add(up, axis, -dot(up, axis))), Math.sqrt(ARM * ARM - half * half));
    const look = unit(add(T, head, -1));
    const e1 = unit(cross(look, [0, 1, 0]));
    const e2 = cross(look, e1);
    const rim = (c: V3, r: number, n: number): V3[] => {
      const o: V3[] = [];
      for (let i = 0; i < n; i++) o.push(add(add(c, e1, Math.cos((i / n) * TAU) * r), e2, Math.sin((i / n) * TAU) * r));
      return o;
    };
    const mouth = add(head, look, 0.25);
    // the cone of light, from the mouth of the shade to the pool on the sheet
    if (lit > 0.01) {
      const n = f.mobile ? 12 : 20;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU;
        const a1 = ((i + 1) / n) * TAU;
        f.fill([mouth, at(tu + (Math.cos(a0) * reach * 0.6) / W, tv + (Math.sin(a0) * reach * 0.6) / H), at(tu + (Math.cos(a1) * reach * 0.6) / W, tv + (Math.sin(a1) * reach * 0.6) / H)], pal.gold, 0.04 * lit);
      }
      f.glow(mouth, 0.3, pal.gold, 0.5 * lit);
    }
    face(f, [at(0, 0.97, 0.05), at(0.06, 0.97, 0.05), at(0.06, 1.02, 0.05), at(0, 1.02, 0.05)], 0.2, arm);
    rod(f, [foot, shoulder], 4, arm, 0.24);
    rod(f, [shoulder, elbow], 4.5, arm, 0.2);
    rod(f, [elbow, head], 4.5, arm, 0.2);
    f.line(add(shoulder, [0.03, 0.02, 0]), add(elbow, [0.03, 0.02, 0]), pal.ink, 0.4 * arm, 1);
    for (const j of [shoulder, elbow, head]) {
      f.dot(j, 0.034, pal.bg, arm);
      f.dot(j, 0.034, pal.gold, 0.55 * arm);
      f.dot(j, 0.012, pal.bg, arm);
    }
    // the shade, seen from behind: its lit mouth first, then the body over it
    const n = f.mobile ? 10 : 16;
    const wide = rim(mouth, 0.2, n);
    const neck = rim(add(head, look, -0.03), 0.06, n);
    f.fill(wide, pal.gold, 0.55 * lit * arm);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const quad = [neck[i], neck[j], wide[j], wide[i]];
      f.fill(quad, pal.bg, 0.96 * arm);
      f.fill(quad, pal.ink, (0.08 + 0.1 * Math.max(0, Math.cos((i / n) * TAU + 2.2))) * arm);
    }
    f.path(wide, pal.gold, (0.4 + 0.5 * lit) * arm, 1.25, true);
    f.path(neck, pal.ink, 0.5 * arm, 1, true);
  },
};

export default scene;
