/**
 * DRAWERS — what this website keeps in your browser, key by key.
 *
 * A low cabinet of eight shallow drawers, looked down upon so that an open
 * drawer shows its floor. Seven of them stand for the seven local-storage keys
 * the notice lists (the names are read from the same list the page prints, so
 * the cabinet cannot drift from it), and each holds one small key. The eighth
 * is the drawer for cookies, and for a visitor it is empty: the page says the
 * only cookie is the one staff receive.
 *
 * The pointer opens the drawer it is on: that drawer slides out, a light comes
 * on inside it, its key shows on the floor and its label holder is lettered.
 * Every other drawer stays shut. With the pointer away the cabinet looks after
 * itself: one drawer at a time is drawn part of the way out and pushed home.
 *
 * Nothing here says a key is present in this visitor's browser; the page says
 * a key is written only when its feature is used.
 */
import { LOCAL_KEYS } from "@/lib/prefs";
import { TAU, clamp, easeInOut, type Frame, type Scene, type V3 } from "../engine";
import { deck, pool, trace } from "../kit";

const COLS = 4;
const ROWS = 2;
/** one drawer front, and the rail between two */
const DW = 0.6;
const DH = 0.27;
const GAP = 0.045;
/** the carcass: half its width, its height, its depth, its foot and its face */
const X = (COLS * DW + (COLS + 1) * GAP) / 2;
const H = ROWS * DH + (ROWS + 1) * GAP;
const D = 0.95;
const Y0 = 0.03;
const T = Y0 + H;
const FLOOR = Y0 - 0.13;
const ZF = -D / 2;
/** how far a drawer comes out, and where its key lies behind the front */
const PULL = 0.8;
const KEY = 0.5;
/** the order in which the cabinet tries its own drawers when nobody is there */
const ROUND = [2, 1, 7, 0, 6, 3, 5, 4];

type Drawer = { x0: number; x1: number; y0: number; y1: number; name: string; key: boolean };
type State = { drawers: Drawer[]; open: number[]; held: number };

/** a machined face: a dark body under a tone of the metal, with a fine edge */
function solid(f: Frame, q: readonly V3[], tone: number, level: number, edge = 0.22): void {
  f.fill(q, f.pal.bg, 0.95 * level);
  f.fill(q, f.pal.ink, tone * level);
  f.path(q, f.pal.ink, edge * level, 1, true);
}

/** a small key lying flat on a drawer floor: bow, shank and two wards */
function key(f: Frame, x: number, y: number, z: number, level: number): void {
  const { pal } = f;
  const bow: V3[] = [];
  for (let i = 0; i <= 14; i++) bow.push([x - 0.095 + Math.cos((i / 14) * TAU) * 0.042, y, z + Math.sin((i / 14) * TAU) * 0.042]);
  f.glow([x, y, z], 0.34, pal.gold, 0.34 * level);
  f.path(bow, pal.gold, level, 2);
  f.path([[x - 0.053, y, z], [x + 0.135, y, z]], pal.gold, level, 2);
  for (const u of [0.085, 0.125]) f.line([x + u, y, z], [x + u, y, z - 0.04], pal.gold, level, 2);
  f.dot([x - 0.095, y, z], 0.008, pal.ink, 0.7 * level);
}

const scene: Scene<State> = {
  pose: 10.5,
  setup() {
    const drawers: Drawer[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const x0 = -X + GAP + c * (DW + GAP);
        const y1 = T - GAP - r * (DH + GAP);
        // the page's own names: its local-storage keys, then its one section on cookies
        const local = i < LOCAL_KEYS.length;
        drawers.push({ x0, x1: x0 + DW, y0: y1 - DH, y1, name: local ? LOCAL_KEYS[i].toUpperCase() : "COOKIES", key: local });
      }
    }
    return { drawers, open: drawers.map(() => 0), held: -1 };
  },
  draw(f, s) {
    const { pal } = f;
    // looked down upon, and a little from the right, so that an open drawer shows its floor
    // the pointer may only lean the camera a little: a drawer that is out must stay in the frame
    f.cam.parallax = 0.5;
    f.aim(0.15 + (f.still ? 0 : Math.sin(f.t * 0.08) * 0.03), -0.58, 6.4, 1.12);
    const camX = Math.sin(f.cam.yaw) * f.cam.dist;
    const n = s.drawers.length;

    deck(f, { y: FLOOR, half: 3.75, alpha: 0.1, drift: 0 });
    pool(f, [0, FLOOR, -0.5], 2.7, pal.key, 0.22 * f.boot);

    // ── which drawer the pointer is on: its slot in the face or, once it is out, its tray
    let best = -1;
    let most = 0.05;
    const reach = f.u * 0.62;
    for (let i = 0; i < n; i++) {
      const d = s.drawers[i];
      const xm = (d.x0 + d.x1) / 2;
      const ym = (d.y0 + d.y1) / 2;
      const on = Math.max(f.near([xm, ym, ZF], reach), f.near([xm, d.y0, ZF - PULL * 0.6], reach) * s.open[i]) + (i === s.held ? 0.1 * f.hover : 0);
      if (on > most) {
        most = on;
        best = i;
      }
    }
    s.held = best;
    const ease = 1 - Math.exp(-f.dt * 5);
    for (let i = 0; i < n; i++) s.open[i] = f.still ? 0 : s.open[i] + ((i === best ? 1 : 0) - s.open[i]) * ease;

    // with nobody there, one drawer at a time is tried: out most of the way, a pause, home again
    const beat = f.t / 7;
    const tried = ROUND[Math.floor(beat) % n];
    const peek = f.boot < 1 ? 0 : 0.8 * easeInOut(Math.sin(Math.PI * clamp(((beat % 1) - 0.1) / 0.8))) * (1 - f.hover);

    // ── the carcass: a recessed plinth, then top, the flank that faces the visitor, and the face
    const body = f.on(0, 0.4);
    const side = camX > 0 ? 1 : -1;
    const px = X - 0.1;
    const pz = ZF + 0.08;
    solid(f, [[-px, FLOOR, pz], [px, FLOOR, pz], [px, Y0, pz], [-px, Y0, pz]], 0.03, body, 0.12);
    solid(f, [[-X, T, ZF], [X, T, ZF], [X, T, -ZF], [-X, T, -ZF]], 0.085, body);
    // a flank shows only from beyond the end of the cabinet
    if (Math.abs(camX) > X) solid(f, [[side * X, Y0, ZF], [side * X, Y0, -ZF], [side * X, T, -ZF], [side * X, T, ZF]], 0.05, body);
    solid(f, [[-X, Y0, ZF], [X, Y0, ZF], [X, T, ZF], [-X, T, ZF]], 0.03, body);
    // an inlaid line on the top, and the key light along its front edge
    const ix = X - 0.09;
    const iz = D / 2 - 0.09;
    f.path([[-ix, T, -iz], [ix, T, -iz], [ix, T, iz], [-ix, T, iz]], pal.ink, 0.13 * body, 1, true);
    trace(f, [[-X, T, ZF], [X, T, ZF]], pal.key, 0.6 * body, 1.25, f.boot < 1 ? -1 : f.t / 16);

    // ── the drawers: bottom row first, and in each row the far end first, so that an open one covers what it should
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let k = 0; k < COLS; k++) {
        const i = r * COLS + (side > 0 ? k : COLS - 1 - k);
        const d = s.drawers[i];
        const on = f.on(0.25 + 0.6 * (i / n), 0.3);
        if (on <= 0.003) continue;
        const o = Math.max(s.open[i], i === tried ? peek : 0);
        // at power-on each drawer is pushed home in turn
        const out = PULL * o + (1 - on) * 0.12;
        const zf = ZF - 0.014 - out;
        const xm = (d.x0 + d.x1) / 2;
        const lit = d.key ? pal.gold : pal.key;

        if (o > 0.004) {
          // the opening it leaves, then the tray: floor, far wall, what lies in it, near wall
          f.fill([[d.x0, d.y0, ZF], [d.x1, d.y0, ZF], [d.x1, d.y1, ZF], [d.x0, d.y1, ZF]], pal.bg, 0.97);
          const xl = d.x0 + 0.022;
          const xr = d.x1 - 0.022;
          const yf = d.y0 + 0.026;
          const yw = d.y0 + DH * 0.8;
          const tray: V3[] = [[xl, yf, zf], [xr, yf, zf], [xr, yf, ZF], [xl, yf, ZF]];
          const wall = (x: number): V3[] => [[x, d.y0, zf], [x, d.y0, ZF], [x, yw, ZF], [x, yw, zf]];
          solid(f, tray, 0.05, 1, 0.12);
          f.fill(tray, lit, 0.1 * o);
          solid(f, wall(camX > xm ? xl : xr), 0.07, 1, 0.26);
          // the key is seen once it has cleared the face of the cabinet
          const kz = zf + KEY;
          const shown = clamp((ZF - 0.06 - kz) / 0.09);
          if (d.key) key(f, xm, yf + 0.004, kz, shown);
          else f.glow([xm, yf, kz], 0.3, pal.key, 0.16 * shown);
          solid(f, wall(camX > xm ? xr : xl), 0.1, 1, 0.3);
        }

        // the front: a plate, a label holder and a pull that stands proud of it
        const front: V3[] = [[d.x0, d.y0, zf], [d.x1, d.y0, zf], [d.x1, d.y1, zf], [d.x0, d.y1, zf]];
        solid(f, front, 0.075, on, 0.3);
        f.fill(front, lit, 0.06 * o);
        f.line(front[3], front[2], o > 0.004 ? lit : pal.ink, on * (0.3 + 0.6 * o), 1.25);
        const hy0 = d.y0 + DH * 0.55;
        const hy1 = d.y0 + DH * 0.86;
        const holder: V3[] = [[xm - 0.2, hy0, zf], [xm + 0.2, hy0, zf], [xm + 0.2, hy1, zf], [xm - 0.2, hy1, zf]];
        f.fill(holder, pal.ink, (0.05 + 0.05 * o) * on);
        f.path(holder, pal.ink, 0.42 * on, 1, true);
        f.path(holder, lit, 0.8 * o * on, 1, true);
        if (!f.mobile) f.label(d.name, [xm, (hy0 + hy1) / 2, zf], { align: "center", size: 10, colour: d.key ? pal.gold : pal.ink, alpha: 0.95 * clamp(o * 2.4 - 0.4) });
        const py = d.y0 + DH * 0.27;
        const zp = zf - 0.04;
        for (const u of [-0.075, 0.075]) f.line([xm + u, py, zf], [xm + u, py, zp], pal.ink, 0.4 * on, 1.5);
        f.line([xm - 0.075, py, zp], [xm + 0.075, py, zp], pal.ink, (0.7 + 0.3 * o) * on, 2.25);
      }
    }
  },
};

export default scene;
