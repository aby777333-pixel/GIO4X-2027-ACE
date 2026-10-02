/**
 * STRONGROOM — two bodies, and the gap between them.
 *
 * On the left a wall of safe-deposit compartments: a grid of small doors, each
 * with two hinges, a keyhole and a blank plate, set in one machined carcass. On
 * the right, across a clear strip of deck, a single plain block on its own
 * plinth. The two never touch. A line of light lies on the deck between them.
 *
 * That is all the picture says: two things, kept apart. The page reports one
 * statement that GIO4X has published and is careful to say that it is not
 * verified and that the arrangements are not published in detail, so the
 * instrument carries no words, no names and no mark of protection.
 *
 * The pointer: the compartment under the cursor opens (its door swings on its
 * hinges and the tin inside slides out as a drawer, lit from within) while its
 * neighbours stay shut; and the gap is traced from front to back by a line of
 * champagne light that catches the two edges facing it.
 */
import { clamp, lerp, type Frame, type Scene, type V3 } from "../engine";
import { deck, pool, ring, trace } from "../kit";

const FLOOR = -0.66;
const SILL = 0.06;
const COLS = 5;
const ROWS = 4;
/** one compartment's pitch, the carcass margin round the grid, half a door */
const DW = 0.32;
const DH = 0.34;
const M = 0.07;
const HW = DW / 2 - 0.022;
const HH = DH / 2 - 0.022;
/** the wall of compartments */
const WX0 = -1.75;
const WX1 = WX0 + COLS * DW + 2 * M;
const WY0 = FLOOR + SILL;
const WY1 = WY0 + ROWS * DH + 2 * M;
/** both bodies have the same depth: front face and back */
const ZF = -0.3;
const ZB = 0.3;
/** the single block, and the middle of the gap */
const BX0 = WX1 + 0.74;
const BX1 = BX0 + 0.8;
const BY1 = WY0 + 1.12;
const GX = (WX1 + BX0) / 2;
const G0 = -0.9;
const G1 = 0.95;

type Door = { x: number; y: number; c: number; r: number; tone: number };
type State = { doors: Door[]; open: number[]; lead: number };

const smooth = (k: number) => {
  const x = clamp(k);
  return x * x * (3 - 2 * x);
};

/** a machined face: a dark body under a tint, with a hairline round it */
function plate(f: Frame, q: readonly V3[], tone: number, on: number, edge = 0.24): void {
  f.fill(q, f.pal.bg, 0.95 * on);
  f.fill(q, f.pal.ink, tone * on);
  f.path(q, f.pal.ink, edge * on, 1, true);
}

/** a solid block between two corners: the top, the flank and the front, which are the faces the viewer sees */
function block(f: Frame, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, tone: number, on: number): void {
  plate(f, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], tone * 1.35, on);
  plate(f, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], tone * 0.5, on);
  plate(f, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], tone, on, 0.34);
}

/** a shut door: its leaf, two hinges on the left, a keyhole on the right, a blank plate */
function door(f: Frame, d: Door, sheen: number, on: number): void {
  const { pal } = f;
  const q: V3[] = [[d.x - HW, d.y - HH, ZF], [d.x + HW, d.y - HH, ZF], [d.x + HW, d.y + HH, ZF], [d.x - HW, d.y + HH, ZF]];
  plate(f, q, 0.06 + 0.05 * d.tone + 0.13 * sheen, on, 0.3);
  f.line(q[3], q[2], pal.ink, (0.32 + 0.4 * sheen) * on, 1);
  for (const v of [-0.56, 0.56]) f.line([d.x - HW - 0.014, d.y + v * HH, ZF], [d.x - HW + 0.036, d.y + v * HH, ZF], pal.ink, 0.62 * on, 2.5);
  const key: V3 = [d.x + HW * 0.52, d.y - HH * 0.08, ZF];
  if (!f.mobile) {
    ring(f, key, 0.036, { axis: "z", colour: pal.ink, alpha: 0.34 * on, seg: 14 });
    f.path([[d.x - HW * 0.62, d.y + HH * 0.36, ZF], [d.x - HW * 0.02, d.y + HH * 0.36, ZF], [d.x - HW * 0.02, d.y + HH * 0.66, ZF], [d.x - HW * 0.62, d.y + HH * 0.66, ZF]], pal.ink, 0.22 * on, 1, true);
  }
  f.dot(key, 0.011, pal.ink, 0.8 * on);
  f.line(key, [key[0], key[1] - 0.026, ZF], pal.ink, 0.7 * on, 1.5);
}

/** an open compartment: the lit cavity, the tin drawn out of it, and the door standing open on its hinges */
function drawer(f: Frame, d: Door, o: number): void {
  const { pal } = f;
  const x0 = d.x - HW;
  const x1 = d.x + HW;
  const y0 = d.y - HH;
  const y1 = d.y + HH;
  const hole: V3[] = [[x0, y0, ZF], [x1, y0, ZF], [x1, y1, ZF], [x0, y1, ZF]];
  f.fill(hole, pal.bg, 0.97);
  f.fill(hole, pal.gold, 0.3 * o);
  f.path(hole, pal.gold, 0.7 * o, 1, true);
  // the tin: a drawer, open at the top, its inside lit
  const out = 0.42 * smooth((o - 0.15) / 0.85);
  const bx0 = x0 + 0.028;
  const bx1 = x1 - 0.028;
  const by0 = y0 + 0.028;
  const by1 = y1 - 0.06;
  const z = ZF - out;
  plate(f, [[bx1, by0, z], [bx1, by0, ZF], [bx1, by1, ZF], [bx1, by1, z]], 0.06, 1);
  const mouth: V3[] = [[bx0, by1, z], [bx1, by1, z], [bx1, by1, ZF], [bx0, by1, ZF]];
  f.fill(mouth, pal.bg, 0.9);
  f.fill(mouth, pal.gold, 0.62 * o);
  f.glow([d.x, by1, ZF - out * 0.5], 0.42, pal.gold, 0.5 * o);
  plate(f, [[bx0, by0, z], [bx1, by0, z], [bx1, by1, z], [bx0, by1, z]], 0.13, 1, 0.4);
  f.path(mouth, pal.gold, 0.95 * o, 1.25, true);
  f.line([d.x - 0.04, (by0 + by1) / 2, z], [d.x + 0.04, (by0 + by1) / 2, z], pal.ink, 0.75, 2.5);
  // the door leaf, swung clear on its two hinges
  const a = 1.6 * smooth(o / 0.55);
  const lx = x0 + 2 * HW * Math.cos(a);
  const lz = ZF - 2 * HW * Math.sin(a);
  plate(f, [[x0, y0, ZF], [lx, y0, lz], [lx, y1, lz], [x0, y1, ZF]], 0.14, 1, 0.5);
  f.line([lx, y0, lz], [lx, y1, lz], pal.gold, 0.6 * o, 1.25);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const doors: Door[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) doors.push({ x: WX0 + M + (c + 0.5) * DW, y: WY0 + M + (r + 0.5) * DH, c, r, tone: f.rnd(r * COLS + c + 11) });
    }
    return { doors, open: doors.map(() => 0), lead: f.rnd(2) };
  },
  draw(f, s) {
    const { pal } = f;
    // seen from the block's side and a little above, so the strip of deck between the two lies open to the eye
    f.cam.parallax = 0.7;
    f.aim(0.23 + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.03), -0.36, 6.4, f.mobile ? 0.96 : 1.03);

    // which compartment the pointer is on: one at a time, and each eases open or shut at its own pace
    let pick = -1;
    let best = Infinity;
    if (f.hover > 0.4) {
      s.doors.forEach((d, i) => {
        const p = f.P(d.x, d.y, ZF);
        if (!p) return;
        const dist = Math.hypot(p.x - f.mx, p.y - f.my);
        if (dist < best && dist < DW * 0.8 * p.s * f.u) {
          best = dist;
          pick = i;
        }
      });
    }
    const step = Math.min(1, f.dt * 6);
    for (let i = 0; i < s.open.length; i++) {
      s.open[i] = f.still ? 0 : s.open[i] + ((i === pick ? 1 : 0) - s.open[i]) * step;
      if (s.open[i] < 0.003) s.open[i] = 0;
    }
    const gap = f.hover * (0.62 + 0.38 * f.near([GX, FLOOR + 0.25, -0.2], 200));

    const wallOn = f.on(0, 0.3);
    const blockOn = f.on(0.55, 0.3);
    const lineOn = f.on(0.9, 0.3);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [(WX0 + WX1) / 2, FLOOR, -0.2], 2, pal.key, 0.2 * f.boot);
    pool(f, [(BX0 + BX1) / 2, FLOOR, -0.2], 1, pal.key, 0.12 * blockOn);

    // the deck is polished: each body leaves a short reflection in it, and the two reflections do not meet either
    for (const [x0, x1, on] of [[WX0, WX1, wallOn], [BX0, BX1, blockOn]] as const) {
      for (const drop of [0.34, 0.16]) f.fill([[x0 - 0.05, FLOOR, ZF - 0.06], [x1 + 0.05, FLOOR, ZF - 0.06], [x1 + 0.05, FLOOR - drop, ZF - 0.06], [x0 - 0.05, FLOOR - drop, ZF - 0.06]], pal.ink, 0.028 * on);
    }

    // ── the wall of compartments: plinth, carcass, then the doors
    block(f, WX0 - 0.05, FLOOR, WX1 + 0.05, WY0, ZF - 0.06, ZB + 0.05, 0.06, wallOn);
    block(f, WX0, WY0, WX1, WY1, ZF, ZB, 0.085, wallOn);
    f.fill([[WX1, WY0, ZF], [WX1, WY0, ZB], [WX1, WY1, ZB], [WX1, WY1, ZF]], pal.gold, 0.1 * gap * wallOn);
    for (const v of [0.34, 0.67]) f.line([WX1, lerp(WY0, WY1, v), ZF], [WX1, lerp(WY0, WY1, v), ZB], pal.ink, 0.16 * wallOn, 1);
    trace(f, [[WX0, WY1, ZF], [WX1, WY1, ZF]], pal.key, 0.75 * wallOn, 1.4);
    f.line([WX1, WY1, ZF], [WX1, WY1, ZB], pal.key, 0.4 * wallOn, 1.25);
    // a lamp passes slowly over the polished doors
    const band = f.still ? -0.75 : lerp(-2.6, 1.3, (f.t / 15 + s.lead) % 1);
    s.doors.forEach((d, i) => {
      const on = f.on(0.16 + (d.c + ROWS - 1 - d.r) * 0.06, 0.3);
      if (on > 0.003 && s.open[i] === 0) door(f, d, smooth(1 - Math.abs(d.x + d.y * 0.45 - band) / 0.5), on);
    });

    // ── the gap: a line of light on the deck, which the pointer traces from front to back in champagne
    trace(f, [[GX, FLOOR, G0], [GX, FLOOR, G1]], pal.key, 0.42 * lineOn * (1 - 0.6 * gap), 1.1, lineOn >= 1 && gap < 0.05 ? f.t / 11 : -1);
    if (gap > 0.01) {
      const run = smooth(f.hover * 1.15);
      pool(f, [GX, FLOOR, lerp(G0, 0, run)], 0.62, pal.gold, 0.34 * gap);
      trace(f, [[GX, FLOOR, G0], [GX, FLOOR, lerp(G0, G1, run)]], pal.gold, 0.95 * gap, 1.9, f.t / 3.2);
      f.line([WX1, WY0, ZF], [WX1, WY1, ZF], pal.gold, 0.85 * gap, 1.5);
    }

    // ── the single block: plain, on its own plinth, with nothing on it to open
    block(f, BX0 - 0.05, FLOOR, BX1 + 0.05, WY0, ZF - 0.06, ZB + 0.05, 0.06, blockOn);
    block(f, BX0, WY0, BX1, BY1, ZF, ZB, 0.1, blockOn);
    const inset = 0.06;
    f.path([[BX0 + inset, WY0 + inset, ZF], [BX1 - inset, WY0 + inset, ZF], [BX1 - inset, BY1 - inset, ZF], [BX0 + inset, BY1 - inset, ZF]], pal.ink, 0.2 * blockOn, 1, true);
    for (const v of [0.34, 0.67]) f.line([BX1, lerp(WY0, BY1, v), ZF], [BX1, lerp(WY0, BY1, v), ZB], pal.ink, 0.16 * blockOn, 1);
    trace(f, [[BX0, BY1, ZF], [BX1, BY1, ZF]], pal.key, 0.6 * blockOn, 1.25);
    f.line([BX1, BY1, ZF], [BX1, BY1, ZB], pal.key, 0.32 * blockOn, 1.25);
    f.line([BX0, WY0, ZF], [BX0, BY1, ZF], pal.gold, 0.85 * gap * blockOn, 1.5);

    // ── the open compartment stands proud of everything else, so it is drawn last
    s.doors.forEach((d, i) => {
      if (s.open[i] > 0) drawer(f, d, s.open[i]);
    });
  },
};

export default scene;
