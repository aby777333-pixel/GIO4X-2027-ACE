/**
 * ANNUNCIATOR — the lamp test.
 *
 * A machined annunciator panel, leaning back as it does on a flight deck: twelve
 * small glass tiles in a 4 x 3 field and, on the module beside it, the round key
 * that tests them. At power-on the key is held and one band of light crosses the
 * field, tile by tile; afterwards every tile rests at the same low glow and the
 * test passes again, softly, every eight seconds.
 *
 * It is a lamp test and nothing else. The tiles carry an engraved rule where a
 * legend would be, their lamps are neutral white, and no tile is ever singled
 * out: the hero reports no state. The real statuses are on the page below.
 */
import { TAU, clamp, easeOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, panel, pool, type Panel } from "../kit";

const COLS = 4;
const ROWS = 3;
/** the lamp field */
const W = 2.02;
const H = 1.28;
const C: V3 = [-0.22, 0.03, 0];
/** how far both modules lean back */
const TILT = 0.5;
const CT = Math.cos(TILT);
const ST = Math.sin(TILT);
/** the key module: on the same plane, bolted to the right of the field */
const KW = 0.52;
const KH = 0.68;
const GAP = 0.09;
/** a point of the modules' common plane, measured from the centre of the field */
const onPlane = (lx: number, ly: number, lift = 0): V3 => [C[0] + lx, C[1] + ly * CT + lift * ST, C[2] + ly * ST - lift * CT];
const KC = onPlane(W / 2 + GAP + KW / 2, (KH - H) / 2);
/** seconds between two passes of the test */
const PERIOD = 8;

type Tile = { u0: number; u1: number; v0: number; v1: number; order: number; rule: number };
type State = { tiles: Tile[]; flip: boolean };

const bell = (x: number, w: number) => Math.exp(-(x * x) / (w * w));

/** the body behind a pane: the two faces of the slab the viewer can see */
function slab(f: Frame, p: Panel, key: string): void {
  const d = -0.1;
  const under: V3[] = [p.at(0, 0), p.at(1, 0), p.at(1, 0, d), p.at(0, 0, d)];
  const side: V3[] = [p.at(1, 0), p.at(1, 1), p.at(1, 1, d), p.at(1, 0, d)];
  f.fill(under, f.pal.bg, 0.7 * p.on);
  f.fill(under, f.pal.ink, 0.04 * p.on);
  f.path(under, f.pal.ink, 0.14 * p.on, 1, true);
  // the right flank only while it is turned toward the viewer (the pointer swings the camera)
  const near = f.P(...p.at(1, 0.5));
  const far = f.P(...p.at(1, 0.5, d));
  if (near && far && far.x > near.x + 0.5) {
    f.fill(side, f.pal.bg, 0.7 * p.on);
    f.fill(side, f.pal.ink, 0.1 * p.on);
    f.path(side, f.pal.ink, 0.2 * p.on, 1, true);
  }
  // the lit top edge has a little bloom; the lower edge catches light coming back off the deck
  f.line(p.at(0, 1), p.at(1, 1), key, 0.1 * p.on, 5);
  f.line(p.at(0, 0), p.at(1, 0), key, 0.36 * p.on, 1);
}

/** a circle lying in a pane's plane; `r` in world units */
function loop(f: Frame, p: Panel, w: number, h: number, cu: number, cv: number, r: number, lift = 0, n = 30): V3[] {
  const seg = Math.max(8, Math.round(n * f.q));
  const out: V3[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    out.push(p.at(cu + (Math.cos(a) * r) / w, cv + (Math.sin(a) * r) / h, lift));
  }
  return out;
}

/** a quarter-turn fastener: a small ring with its slot */
function fastener(f: Frame, p: Panel, w: number, h: number, u: number, v: number, turn: number): void {
  const r = 0.023;
  f.path(loop(f, p, w, h, u, v, r, 0, 12), f.pal.ink, 0.3 * p.on, 1, true);
  const dx = (Math.cos(turn) * r * 0.72) / w;
  const dy = (Math.sin(turn) * r * 0.72) / h;
  f.line(p.at(u - dx, v - dy), p.at(u + dx, v + dy), f.pal.ink, 0.36 * p.on, 1);
}

/** one annunciator tile: a smoked glass cap standing proud of the panel, lit from behind */
function tile(f: Frame, p: Panel, t: Tile, level: number, on: number, key: string): void {
  const { pal } = f;
  const cap = 0.05;
  const a = p.at(t.u0, t.v0, cap);
  const b = p.at(t.u1, t.v0, cap);
  const c = p.at(t.u1, t.v1, cap);
  const d = p.at(t.u0, t.v1, cap);
  const mu = 0.008;
  const mv = 0.014;
  // the well it sits in
  f.fill([p.at(t.u0 - mu, t.v0 - mv), p.at(t.u1 + mu, t.v0 - mv), p.at(t.u1 + mu, t.v1 + mv), p.at(t.u0 - mu, t.v1 + mv)], pal.bg, 0.62 * on);
  // the thickness of the glass: the lamp escapes through its edges
  f.fill([p.at(t.u0, t.v0), p.at(t.u1, t.v0), b, a], pal.ink, (0.09 + 0.46 * level) * on);
  f.fill([p.at(t.u1, t.v0), p.at(t.u1, t.v1), c, b], pal.ink, (0.05 + 0.28 * level) * on);
  // the cap, and the wash of the lamp behind it
  f.fill([a, b, c, d], pal.bg, 0.84 * on);
  f.fill([a, b, c, d], pal.ink, (0.03 + 0.2 * level) * on);
  const iu = (t.u1 - t.u0) * 0.13;
  const iv = (t.v1 - t.v0) * 0.2;
  f.fill([p.at(t.u0 + iu, t.v0 + iv, cap), p.at(t.u1 - iu, t.v0 + iv, cap), p.at(t.u1 - iu, t.v1 - iv, cap), p.at(t.u0 + iu, t.v1 - iv, cap)], pal.ink, 0.17 * level * on);
  f.path([a, b, c, d], pal.ink, (0.13 + 0.3 * level) * on, 1, true);
  // its lit edge, in the same key light as the panel's
  f.line(d, c, key, (0.42 + 0.5 * level) * on, 1.25);
  // the legend window: an engraved rule and nothing more
  const um = (t.u0 + t.u1) / 2;
  const vm = (t.v0 + t.v1) / 2;
  const half = (t.u1 - t.u0) * t.rule;
  const l = p.at(um - half, vm, cap);
  const r = p.at(um + half, vm, cap);
  f.line(l, r, pal.ink, 0.2 * level * on, 6);
  f.line(l, r, pal.ink, (0.26 + 0.72 * level) * on, 1.5);
}

/** one reflection travelling over all twelve caps: they are cut from the same sheet of glass */
function sheen(f: Frame, p: Panel, tiles: Tile[], on: number): void {
  const g0 = f.P(...p.at(0, 1));
  const g1 = f.P(...p.at(1, 0));
  if (!g0 || !g1 || on <= 0.003) return;
  const { ctx } = f;
  const band = clamp(0.42 + f.px * 0.24 + (f.still ? 0 : Math.sin(f.t * 0.19) * 0.1), 0.16, 0.84);
  const g = ctx.createLinearGradient(g0.x, g0.y, g1.x, g1.y);
  g.addColorStop(band - 0.16, rgba(f.pal.ink, 0));
  g.addColorStop(band, rgba(f.pal.ink, 0.11 * on));
  g.addColorStop(band + 0.05, rgba(f.pal.ink, 0.02 * on));
  g.addColorStop(band + 0.16, rgba(f.pal.ink, 0));
  ctx.save();
  ctx.beginPath();
  for (const t of tiles) {
    const q = [p.at(t.u0, t.v0, 0.05), p.at(t.u1, t.v0, 0.05), p.at(t.u1, t.v1, 0.05), p.at(t.u0, t.v1, 0.05)].map((v) => f.P(...v));
    if (q.some((v) => !v)) continue;
    q.forEach((v, i) => (i ? ctx.lineTo(v!.x, v!.y) : ctx.moveTo(v!.x, v!.y)));
    ctx.closePath();
  }
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, f.w, f.h);
  ctx.restore();
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const tiles: Tile[] = [];
    const flip = f.rnd(7) > 0.5;
    const u0 = 0.055;
    const u1 = 0.945;
    const v0 = 0.115;
    const v1 = 0.8;
    const gu = 0.03;
    const gv = 0.055;
    const tw = (u1 - u0 - gu * (COLS - 1)) / COLS;
    const th = (v1 - v0 - gv * (ROWS - 1)) / ROWS;
    const span = COLS - 1 + 0.4 * (ROWS - 1);
    // far to near: the panel turns its right side to the viewer and leans its top away
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const u = u0 + c * (tw + gu);
        const v = v1 - th - r * (th + gv);
        tiles.push({ u0: u, u1: u + tw, v0: v, v1: v + th, order: ((flip ? COLS - 1 - c : c) + 0.4 * r) / span, rule: 0.2 + 0.12 * f.rnd(c * ROWS + r) });
      }
    }
    return { tiles, flip };
  },
  draw(f, s) {
    const { pal } = f;
    // No colour here may read as a state. The instrument's own light is the house blue and
    // neutral white, whatever the session; only the air around it follows the key light, and
    // even that never turns green.
    const key = pal.blue;
    const air = pal.key === pal.emerald ? pal.blue : pal.key;
    // On a narrow desktop the headline reaches further right: the instrument shrinks and moves
    // over rather than pass its light behind the text.
    const text = Math.max(630, f.w * 0.45);
    const zoom = f.mobile ? 0.74 : clamp((f.w - 20 - text) / (2.73 * f.u), 0.66, 0.98);
    f.aim(0.3 + (f.rnd(3) - 0.5) * 0.06 + Math.sin(f.t * 0.09) * 0.035, 0.11, 6.4, zoom);
    if (f.mobile) {
      f.cx = f.w * 0.49;
      f.cy = f.h * 0.275;
    } else f.cx = Math.min(Math.max(f.cx, text + 1.27 * zoom * f.u), f.w - 20 - 1.46 * zoom * f.u);

    // the test: once at power-on at full strength, then a soft pass every PERIOD seconds.
    // The still frame holds the band broad and central, a gradient rather than "these tiles".
    const n = Math.floor(f.t / PERIOD);
    const first = n === 0;
    const k = f.still ? 0.5 : (f.t - (first ? 0.25 : n * PERIOD)) / (first ? 1.8 : 3.8);
    const head = -0.45 + 1.9 * k;
    const amp = f.still ? 0.42 : first ? 1 : 0.45;
    const width = f.still ? 0.5 : 0.21;
    const held = f.still ? 0.3 : k >= 0 && k <= 1 ? clamp(k / 0.1) * clamp((1 - k) / 0.3) : 0;

    const floor = -1.3;
    deck(f, { y: floor, alpha: 0.13 });
    pool(f, [0.15, floor, 0], 2.5, air, 0.26 * f.boot);
    // the band of light, coming back off the deck
    const across = s.flip ? 1 - head : head;
    pool(f, [lerp(C[0] - W / 2, C[0] + W / 2, across), floor, -0.5], 1.2, pal.ink, 0.08 * amp * bell(head - 0.5, 0.55) * f.boot);

    // air lit behind the instrument, so the smoked slabs stand out against it
    f.glow(onPlane(0.2, 0.1, -0.5), 1.7, air, 0.1 * f.boot);

    // two ties bolt the key module to the field; they carry the test while the key is held
    const tieOn = f.on(0.3, 0.4);
    for (const ly of [-H / 2 + KH * 0.25, -H / 2 + KH * 0.75]) {
      const a = onPlane(W / 2, ly, -0.05);
      const b = onPlane(W / 2 + GAP, ly, -0.05);
      f.line(a, b, pal.ink, 0.34 * tieOn, 2.5);
      f.line(a, b, key, 0.7 * held * tieOn, 2.5);
    }

    // ── the lamp field
    const m = panel(f, C, W, H, { tilt: TILT, on: f.on(0, 0.42), colour: key, alpha: 0.66, glass: 0.04, header: true });
    if (m.on > 0.003) {
      slab(f, m, key);
      f.path([m.at(0.028, 0.075), m.at(0.972, 0.075), m.at(0.972, 0.84), m.at(0.028, 0.84)], pal.ink, 0.09 * m.on, 1, true);
      if (!f.mobile) for (let i = 0; i < 4; i++) fastener(f, m, W, H, i % 2 ? 0.972 : 0.028, i < 2 ? 0.94 : 0.036, 0.5 + i);
      const up = easeOut((f.boot - 0.16) / 0.4) * m.on;
      const lit: { p: V3; level: number }[] = [];
      for (const t of s.tiles) {
        const level = 0.34 + 0.66 * amp * bell(t.order - head, width);
        tile(f, m, t, level, up, key);
        if (level > 0.45) lit.push({ p: m.at((t.u0 + t.u1) / 2, (t.v0 + t.v1) / 2, 0.06), level });
      }
      sheen(f, m, s.tiles, up);
      // an engraved index for each column, on the header rule
      for (let c = 0; c < COLS; c++) {
        const u = (s.tiles[c * ROWS].u0 + s.tiles[c * ROWS].u1) / 2;
        f.line(m.at(u, 0.88), m.at(u, 0.905), pal.ink, 0.3 * m.on, 1);
      }
      // bloom over the tiles the band is on (a handful at most)
      if (!f.still) for (const g of lit) f.glow(g.p, 0.36, pal.ink, 0.2 * (g.level - 0.3) * up);
    }

    // ── the test key, on its own module
    const km = panel(f, KC, KW, KH, { tilt: TILT, on: f.on(0.4, 0.42), colour: key, alpha: 0.6, glass: 0.045 });
    if (km.on > 0.003) {
      slab(f, km, key);
      const cu = 0.5;
      const cv = 0.41;
      const o = km.on;
      if (!f.mobile) {
        fastener(f, km, KW, KH, 0.09, 0.07, 0.4);
        fastener(f, km, KW, KH, 0.91, 0.07, 1.9);
      }
      // the seat: a knurled ring let into the plate
      const seat = loop(f, km, KW, KH, cu, cv, 0.172);
      const inner = loop(f, km, KW, KH, cu, cv, 0.154);
      f.fill(seat, pal.bg, 0.6 * o);
      f.path(seat, pal.ink, 0.3 * o, 1, true);
      for (let i = 0; i < seat.length; i += 2) f.line(seat[i], inner[i], pal.ink, 0.22 * o, 1);
      // the guard ring, lit
      const guard = loop(f, km, KW, KH, cu, cv, 0.13, 0.015);
      f.path(guard, key, 0.13 * o, 5, true);
      f.path(guard, key, (0.58 + 0.3 * held) * o, 1.5, true);
      // the cap: a short cylinder that sinks a little while it is held
      const top = 0.06 - 0.028 * held;
      for (let i = 0; i <= 2; i++) f.fill(loop(f, km, KW, KH, cu, cv, 0.098, (top * i) / 2), pal.bg, 0.85 * o);
      const face = loop(f, km, KW, KH, cu, cv, 0.098, top);
      f.fill(face, pal.ink, 0.07 * o);
      f.path(face, pal.ink, 0.42 * o, 1, true);
      // its lit centre
      f.glow(km.at(cu, cv, top), 0.2, pal.ink, (0.2 + 0.3 * held) * o);
      f.fill(loop(f, km, KW, KH, cu, cv, 0.042, top, 18), pal.ink, (0.5 + 0.45 * held) * o);
      if (!f.mobile) f.label("LAMP TEST", km.at(0.5, 0.855), { align: "center", size: zoom < 0.85 ? 8 : 9, alpha: 0.62 * o, colour: pal.ink2 });
    }
  },
};

export default scene;
