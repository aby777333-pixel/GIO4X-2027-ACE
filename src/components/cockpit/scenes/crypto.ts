/**
 * CRYPTO — the chain of blocks.
 *
 * A row of machined blocks, coupled end to end, recedes into the distance along
 * a gentle curve. At the near end a new block is assembled: its edges are drawn,
 * the metal fills in, it settles onto the line, the coupling closes and the
 * whole chain moves on by one place. Around it lies the week, a wide graduated
 * bezel lit all the way round, because this market has no closing day.
 *
 * The lines engraved on each block are a drawing of records, not data. There
 * are no hashes, no prices and no logos here; the only lettering is the five
 * coins GIO4X lists and the seven days.
 */
import { TAU, clamp, easeInOut, easeOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, panel, pool, ring, ringPoint, trace } from "../kit";

const COINS = ["BTC", "ETH", "LTC", "XRP", "SOL"];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** the dial everything stands on; the camera looks down on it, so it sits at the pivot */
const FLOOR = 0;
/** a block and a coupling: length along the chain, height, depth */
const BLOCK: V3 = [0.5, 0.36, 0.42];
const LINK: V3 = [0.3, 0.1, 0.12];
const STEP = BLOCK[0] + 0.26;
const SLOTS = 6;
const HOVER = FLOOR + 0.07 + BLOCK[1] / 2;
/** the chain is lost to the distance over FADE, and gone at REACH */
const REACH = 5.2 * STEP;
const FADE = 2.8 * STEP;
/** seconds for one block to be assembled and the chain to move on */
const CYCLE = 11;
/** the week bezel: inner and outer radius, and the turn at which Monday begins */
const R0 = 1.42;
const R1 = 1.62;
const WEEK0 = 0.325;

/** a block's six faces (far end, near end, bottom, top, two long sides) as vertex indices */
const FACES = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]];
/** its edges as [vertex, vertex, face, face], in the order a block is built: base, uprights, top */
const EDGES = [
  [0, 1, 2, 4], [4, 5, 2, 5], [0, 4, 0, 2], [1, 5, 1, 2],
  [0, 2, 0, 4], [1, 3, 1, 4], [4, 6, 0, 5], [5, 7, 1, 5],
  [2, 3, 3, 4], [6, 7, 3, 5], [2, 6, 0, 3], [3, 7, 1, 3],
];
const TINT = [0.03, 0.03, 0.02, 0.105, 0.05, 0.05];

type State = { phi0: number; kappa: number; base: number; band: V3[]; disc: V3[] };

/**
 * How one block looks this frame. `a` is its presence (the fade into the
 * distance), `edge` and `body` (0..1) how much of the outline and of the metal
 * is there yet, `seam` the lit edge along the top, `rows` the engraved record
 * lines (0 makes a plain coupling), `sheen` the brushed highlight on top, and
 * `id` keeps a block's engraving its own as it travels down the chain.
 */
type Look = { a: number; edge: number; body: number; seam: number; rows: number; sheen: number; id: number };

/** where the chain is, `d` world units along it from the near end: a point and a heading */
function along(s: State, d: number): { p: V3; phi: number } {
  const phi = s.phi0 - s.kappa * d;
  return { p: [0.7 - (Math.cos(phi) - Math.cos(s.phi0)) / s.kappa, HOVER, -0.62 - (Math.sin(phi) - Math.sin(s.phi0)) / s.kappa], phi };
}

/** several separate segments in a single stroke (pairs of points) */
function segs(f: Frame, pts: readonly V3[], colour: string, alpha: number, width = 1): void {
  if (alpha <= 0.003 || pts.length < 2) return;
  const { ctx } = f;
  ctx.beginPath();
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const a = f.P(pts[i][0], pts[i][1], pts[i][2]);
    const b = f.P(pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]);
    if (!a || !b) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

/**
 * A machined cuboid turned to follow the chain. Unlike the kit's box it is
 * solid: only the faces that look at the camera are drawn, so blocks hide what
 * is behind them and read as metal rather than as wire.
 */
function block(f: Frame, eye: V3, c: V3, phi: number, size: V3, o: Look): void {
  if (o.a <= 0.01 || o.edge <= 0) return;
  const { pal, ctx } = f;
  const ax = -Math.sin(phi);
  const az = Math.cos(phi);
  const [hl, hh, hd] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const at = (u: number, v: number, w: number): V3 => [c[0] + ax * u * hl + az * w * hd, c[1] + v * hh, c[2] + az * u * hl - ax * w * hd];
  const v: V3[] = [];
  for (let i = 0; i < 8; i++) v.push(at(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1));
  // which faces look at the camera
  const da = (eye[0] - c[0]) * ax + (eye[2] - c[2]) * az;
  const dn = (eye[0] - c[0]) * az - (eye[2] - c[2]) * ax;
  const vis = [da < -hl, da > hl, eye[1] - c[1] < -hh, eye[1] - c[1] > hh, dn < -hd, dn > hd];
  const side = vis[4] ? -1 : vis[5] ? 1 : 0;
  const end = vis[0] ? -1 : vis[1] ? 1 : 0;
  const plain = o.rows === 0;
  const ba = o.body * o.a;

  // the metal: a dark body, a little lighter on top, a breath of indigo on the long face
  if (ba > 0.003) {
    for (let k = 0; k < 6; k++) {
      if (!vis[k]) continue;
      const q = [v[FACES[k][0]], v[FACES[k][1]], v[FACES[k][2]], v[FACES[k][3]]];
      f.fill(q, pal.bg, 0.94 * ba);
      f.fill(q, pal.ink, TINT[k] * ba);
      if (k > 3 && !plain) f.fill(q, pal.indigo, 0.04 * ba);
    }
    const q = [f.P(...v[2]), f.P(...v[3]), f.P(...v[7]), f.P(...v[6])];
    if (o.sheen > 0.003 && vis[3] && q[0] && q[1] && q[2] && q[3]) {
      const g = ctx.createLinearGradient(q[0].x, q[0].y, q[2].x, q[2].y);
      g.addColorStop(0.12, rgba(pal.ink, 0));
      g.addColorStop(0.5, rgba(pal.ink, 0.1 * o.sheen * ba));
      g.addColorStop(0.88, rgba(pal.ink, 0));
      ctx.beginPath();
      ctx.moveTo(q[0].x, q[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(q[i]!.x, q[i]!.y);
      ctx.fillStyle = g;
      ctx.fill();
    }
  }

  // the outline, drawn in the order the block is built; the top edges catch the light
  const dim: V3[] = [];
  const lit: V3[] = [];
  for (let k = 0; k < 12; k++) {
    const e = EDGES[k];
    const p = easeOut(o.edge * 3 - (k >> 2));
    if (p <= 0 || (!vis[e[2]] && !vis[e[3]])) continue;
    const a = v[e[0]];
    const b = v[e[1]];
    (k >= 8 ? lit : dim).push(a, p >= 1 ? b : [lerp(a[0], b[0], p), lerp(a[1], b[1], p), lerp(a[2], b[2], p)]);
  }
  segs(f, dim, pal.ink, 0.24 * o.a);
  segs(f, lit, pal.ink, 0.5 * o.a);
  if (side && plain) f.line(at(-1, 1, 0), at(1, 1, 0), pal.indigo, o.seam * o.a, 1);
  else if (side) trace(f, [at(-1, 1, side), at(1, 1, side)], pal.indigo, o.seam * o.a, 1.25);
  if (plain || ba <= 0.003) return;

  // a machined pocket in the top face, a socket in the end face
  f.path([at(-0.78, 1, -0.68), at(0.78, 1, -0.68), at(0.78, 1, 0.68), at(-0.78, 1, 0.68)], pal.ink, 0.13 * ba, 1, true);
  if (end) f.path([at(end, -0.3, -0.26), at(end, 0.3, -0.26), at(end, 0.3, 0.26), at(end, -0.3, 0.26)], pal.ink, 0.2 * ba, 1, true);
  // the records: a few fine engraved lines, each with its index mark
  if (!side) return;
  const rule: V3[] = [];
  const mark: V3[] = [];
  for (let j = 0; j < o.rows; j++) {
    const y = 0.5 - j * 0.36;
    rule.push(at(-0.6, y, side), at(-0.6 + (0.45 + 0.9 * f.rnd(o.id * 7 + j)) * o.body, y, side));
    mark.push(at(-0.8, y, side), at(-0.72, y, side));
  }
  segs(f, rule, pal.ink, 0.32 * ba);
  segs(f, mark, pal.indigo, 0.7 * ba, 1.5);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = f.mobile ? 48 : 80;
    const C: V3 = [0, FLOOR, 0];
    const band: V3[] = [];
    const disc: V3[] = [];
    for (let i = 0; i <= n; i++) band.push(ringPoint(C, R1, i / n));
    for (let i = n; i >= 0; i--) band.push(ringPoint(C, R0, i / n));
    for (let i = 0; i < n; i++) disc.push(ringPoint(C, R0, i / n));
    // each page bends its chain a little differently and starts on different blocks
    return { phi0: 1.12 + (f.rnd(3) - 0.5) * 0.08, kappa: 0.27 + (f.rnd(4) - 0.5) * 0.03, base: Math.floor(f.rnd(5) * 40), band, disc };
  },
  draw(f, s) {
    const { pal } = f;
    // read from above, like a model on a table (in this engine a negative pitch lifts the camera)
    f.aim(-0.12 + (f.still ? 0 : Math.sin(f.t * 0.08) * 0.045), -0.48, 6.6, f.mobile ? 0.6 : 0.85);
    if (f.mobile) {
      f.cx = f.w * 0.5;
      f.cy = f.h * 0.3;
    }
    const { yaw, pitch, dist } = f.cam;
    const eye: V3 = [dist * Math.cos(pitch) * Math.sin(yaw), -dist * Math.sin(pitch), -dist * Math.cos(pitch) * Math.cos(yaw)];

    // one block every CYCLE seconds: outline, metal, settle, couple, advance. Still: the block settled.
    const tau = f.still ? 7.4 : f.t % CYCLE;
    const cycle = f.still ? 0 : Math.floor(f.t / CYCLE);
    const edge = clamp(tau / 3.6);
    const body = easeInOut((tau - 2.6) / 2.2);
    const settle = easeInOut((tau - 4.6) / 1.8);
    const link = easeInOut((tau - 6) / 1.4);
    const shift = easeInOut((tau - 7.6) / (CYCLE - 7.6));

    // ── the week: a smoked dial with a wide bezel, every day lit
    const C: V3 = [0, FLOOR, 0];
    const RM = (R0 + R1) / 2;
    deck(f, { y: FLOOR, alpha: 0.06, half: 5, step: 0.75, drift: 0 });
    f.fill(s.disc, pal.bg, 0.45 * f.boot);
    pool(f, C, 2.7, pal.key, 0.2 * f.boot);
    ring(f, C, R0 - 0.1, { colour: pal.ink, alpha: 0.09 * f.boot });
    f.fill(s.band, pal.bg, 0.55 * f.boot);
    f.fill(s.band, pal.ink, 0.04 * f.boot);
    ring(f, C, R1, { colour: pal.ink, alpha: 0.3 * f.boot, ticks: 28, major: 4, tickLen: 0.06, rot: WEEK0 * TAU });
    ring(f, C, R0, { colour: pal.ink, alpha: 0.32 * f.boot });
    const bounds: V3[] = [];
    for (let i = 0; i < 7; i++) {
      const on = f.on(0.1 + (i / 7) * 0.55, 0.3);
      const from = WEEK0 - (i + 0.94) / 7;
      const to = WEEK0 - (i + 0.06) / 7;
      ring(f, C, RM, { colour: pal.blue, alpha: 0.1 * on, width: 5, from, to });
      ring(f, C, RM, { colour: pal.blue, alpha: 0.62 * on, width: 1.5, from, to });
      bounds.push(ringPoint(C, R0, WEEK0 - i / 7), ringPoint(C, R1, WEEK0 - i / 7));
      if (!f.mobile) f.label(DAYS[i], ringPoint(C, R1 + 0.14, WEEK0 - (i + 0.5) / 7), { align: "center", size: 10, alpha: 0.85 * on, colour: pal.ink2 });
    }
    segs(f, bounds, pal.ink, 0.42 * f.boot);
    // where in the week the visitor's own clock is
    const week = (((f.now.getDay() + 6) % 7) + (f.now.getHours() + f.now.getMinutes() / 60) / 24) / 7;
    f.line(ringPoint(C, R0, WEEK0 - week), ringPoint(C, R1, WEEK0 - week), pal.key, 0.95 * f.boot, 2);

    // ── the chain, far to near; the newest block throws its own light on the dial
    const fresh = along(s, shift * STEP).p;
    f.glow([fresh[0], FLOOR, fresh[2]], 0.75, pal.indigo, 0.24 * easeOut(tau / 3) * (1 - shift) * f.boot);
    for (let i = SLOTS - 1; i >= 0; i--) {
      const d = (i + shift) * STEP;
      const { p, phi } = along(s, d);
      const on = i === 0 ? 1 : f.on(0.05 + ((SLOTS - i) / SLOTS) * 0.45, 0.4);
      const a = clamp((REACH - d) / FADE) * on;
      const made = i === 0 ? body : 1;
      // its shadow on the dial
      const sx = -Math.sin(phi) * BLOCK[0] * 0.54;
      const sz = Math.cos(phi) * BLOCK[0] * 0.54;
      const nx = Math.cos(phi) * BLOCK[2] * 0.56;
      const nz = Math.sin(phi) * BLOCK[2] * 0.56;
      const foot: V3[] = [[p[0] - sx - nx, FLOOR, p[2] - sz - nz], [p[0] + sx - nx, FLOOR, p[2] + sz - nz], [p[0] + sx + nx, FLOOR, p[2] + sz + nz], [p[0] - sx + nx, FLOOR, p[2] - sz + nz]];
      f.fill(foot, pal.bg, 0.5 * a * made);
      // a new block hangs just above the line until it settles; the others came down at power-on
      const lift = i === 0 ? (1 - settle) * 0.1 : (1 - on) * 0.12;
      block(f, eye, [p[0], p[1] + lift, p[2]], phi, BLOCK, {
        a,
        edge: i === 0 ? edge : 1,
        body: made,
        seam: i === 0 ? lerp(0.3 * body + 0.65 * link, 0.62, shift) : 0.62,
        rows: f.mobile || f.q < 0.75 ? 3 : 4,
        sheen: clamp((2.2 - d) / 0.6) * made,
        id: s.base + cycle - i,
      });
      // the coupling to the block in front of it; the newest one closes last
      if (i > 0) {
        const grow = i === 1 ? link : 1;
        const mid = along(s, d - STEP / 2 + (1 - grow) * 0.1);
        block(f, eye, mid.p, mid.phi, [LINK[0] * grow, LINK[1], LINK[2]], { a: a * clamp(grow * 3), edge: 1, body: 1, seam: 0.65, rows: 0, sheen: 0, id: 0 });
      }
    }

    // ── the coins: five lamps on a rail of glass at the front, the page's own in champagne
    const focus = COINS.indexOf(f.tag.split("-")[0].toUpperCase());
    const rail = panel(f, [-0.5, FLOOR + 0.11, -1.06], 0.92, 0.28, { yaw: 0.34, tilt: 0.8, on: f.on(0.5, 0.35), colour: pal.blue, alpha: 0.45, glass: 0.04 });
    if (rail.on <= 0) return;
    f.line(rail.at(0.07, 0.66), rail.at(0.93, 0.66), pal.ink, 0.16 * rail.on, 1);
    COINS.forEach((name, i) => {
      const on = easeOut((f.boot - 0.62 - i * 0.06) / 0.14);
      const u = 0.14 + i * 0.18;
      const mine = i === focus;
      const breathe = f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 1.1 + i * 1.3);
      lamp(f, rail.at(u, 0.66, 0.012), mine ? pal.gold : pal.blue, on * breathe * (mine ? 1 : focus < 0 ? 0.85 : 0.5), mine ? 0.022 : 0.018);
      if (!f.mobile || mine) f.label(name, rail.at(u, 0.27), { align: "center", size: 9, alpha: (mine ? 0.95 : focus < 0 ? 0.66 : 0.45) * on, colour: mine ? pal.gold : pal.ink2 });
    });
  },
};

export default scene;
