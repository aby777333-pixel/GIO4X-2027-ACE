/**
 * FLIGHT DECK — the cockpit around the globe.
 *
 * The homepage's subject, a live globe of the world's financial centres, is
 * drawn by another component exactly at the focal point. This scene is the
 * cockpit it sits in, and it keeps the disc where the globe lives empty:
 *   - the deck, receding to a horizon, with the light the globe spills on it
 *   - the window the globe is seen through, built like an attitude indicator:
 *     a machined rim with its bank scale, two graduated bezel segments, the
 *     fixed reference wings resting on the horizon line, corner brackets
 *   - the 24-hour UTC day on the outer ring, lit as far as the visitor's
 *     clock has run (one degree per hour on a desk screen)
 *   - three lamp columns on the deck, ASIA, EUROPE and AMERICAS: the one whose
 *     venues carry the trading day right now (f.region) is lit, the others rest
 *
 * Nothing here is market data: it is the real time of day and the real region.
 */
import { TAU, clamp, rgba, type Frame, type Region, type Scene, type V3 } from "../engine";
import { lamp, pool, ring, trace } from "../kit";

const DEG = Math.PI / 180;
const FLOOR = -1.3;
/** the globe's disc, in world units about the origin: nothing of this scene may show inside it */
const VOID = 1.3;
/** the rim of the window the globe is seen through */
const RIM = 1.4;

/** a short row standing on the deck, stepping away to the right of the globe, in the order of the trading day */
const COLUMNS: { name: string; region: Region; base: V3 }[] = [
  { name: "ASIA", region: "asia", base: [1, FLOOR, -0.2] },
  { name: "EUROPE", region: "europe", base: [1.36, FLOOR, 0.55] },
  { name: "AMERICAS", region: "americas", base: [1.79, FLOOR, 1.4] },
];

type Bezel = { mid: number; half: number; r0: number; r1: number; step: number };

/** a point of the head-up frame: polar about the globe's centre, in the vertical plane through it */
const hud = (r: number, deg: number): V3 => [Math.cos(deg * DEG) * r, Math.sin(deg * DEG) * r, 0];

function sweep(r: number, a: number, b: number, n: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) out.push(hud(r, a + ((b - a) * i) / n));
  return out;
}

const pad = (v: number) => (v < 10 ? "0" : "") + v;

/** The deck: a coordinate floor that runs all the way to the horizon and slides slowly toward the viewer. */
function floor(f: Frame, a0: number): void {
  const step = 0.75;
  const n = f.mobile ? 8 : 12;
  const cuts = [-1.6, 1.5, 8, 36];
  const fade = [1, 0.6, 0.24];
  for (let i = -n; i <= n; i++) {
    const edge = Math.pow(1 - Math.abs(i) / (n + 1), 1.5);
    for (let k = 0; k < 3; k++) f.line([i * step, FLOOR, cuts[k]], [i * step, FLOOR, cuts[k + 1]], f.pal.ink, a0 * edge * fade[k], 1);
  }
  const slide = f.still ? 0 : (0.05 * f.t) % step;
  const rows = Math.round((f.mobile ? 14 : 23) * f.q);
  for (let k = 0; k <= rows; k++) {
    const z = -1.5 + k * step - slide;
    const far = clamp(1 - (z + 1.5) / (rows * step));
    f.line([-n * step, FLOOR, z], [n * step, FLOOR, z], f.pal.ink, a0 * far * far, 1);
  }
}

/** A radial wash about the globe's centre between two radii (world units, screen-aligned); `erase` clears instead of painting. */
function wash(f: Frame, r0: number, r1: number, stops: [number, string][], erase = false): void {
  const { ctx } = f;
  const U = f.u * f.cam.zoom;
  const g = ctx.createRadialGradient(f.cx, f.cy, r0 * U, f.cx, f.cy, r1 * U);
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  ctx.save();
  if (erase) ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(f.cx, f.cy, r1 * U, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** The globe stands here: clear its disc, opaque inside r0 and feathered out to r1. */
const clear = (f: Frame, r0: number, r1: number) => wash(f, r0, r1, [[0, rgba(f.pal.bg, 1)], [1, rgba(f.pal.bg, 0)]], true);

/** A line of light in screen space whose strength changes along its length (the horizon). */
function beam(f: Frame, x0: number, x1: number, y: number, colour: string, a0: number, a1: number): void {
  const { ctx } = f;
  const g = ctx.createLinearGradient(x0, y, x1, y);
  g.addColorStop(0, rgba(colour, a0));
  g.addColorStop(1, rgba(colour, a1));
  ctx.save();
  ctx.strokeStyle = g;
  for (const w of [5, 1.25]) {
    ctx.globalAlpha = w > 2 ? 0.16 : 1;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** A machined bezel segment: a band of smoked glass, engraved graduations, a lit inner edge, an index caret. */
function bezel(f: Frame, b: Bezel, on: number, pulse: number, caret: number): void {
  if (on <= 0.01) return;
  const { pal } = f;
  const h = b.half * on;
  const w = b.r1 - b.r0;
  const n = Math.max(10, Math.round(b.half * 0.7 * f.q));
  const inner = sweep(b.r0, b.mid - h, b.mid + h, n);
  const body = [...inner, ...sweep(b.r1, b.mid + h, b.mid - h, n)];
  f.fill(body, pal.bg, 0.5 * on);
  f.fill(body, pal.ink, 0.045 * on);
  f.path(body, pal.ink, 0.2 * on, 1, true);
  const marks = Math.floor(b.half / b.step);
  for (let i = -marks; i <= marks; i++) {
    const deg = b.mid + i * b.step;
    if (Math.abs(i * b.step) > h - 0.5) continue;
    f.line(hud(b.r0 + w * 0.2, deg), hud(b.r0 + w * (i % 4 ? 0.46 : 0.72), deg), pal.ink, (i % 4 ? 0.28 : 0.55) * on, 1);
  }
  trace(f, inner, pal.key, 0.62 * on, 1.25, pulse);
  // the index on the band's outer edge, pointing at the horizon
  f.fill([hud(b.r1 + 0.04, b.mid - 1.2), hud(b.r1 + 0.04, b.mid + 1.2), hud(b.r1 + 0.004, b.mid)], pal.key, 0.85 * on * caret);
}

const scene: Scene = {
  pose: 12,
  draw(f) {
    const { pal, mobile } = f;
    // the frame belongs to the globe: it may lean with the pointer, but only a little
    f.cam.parallax = 0.4;
    const live = f.still ? 0 : 1;
    f.aim(Math.sin(f.t * 0.07 + f.rnd(1) * TAU) * 0.015 * live, Math.sin(f.t * 0.05 + f.rnd(2) * TAU) * 0.003 * live, 6, 1);
    const U = f.u * f.cam.zoom;
    // Stages differ in shape. Measure the room to the right of the globe and above it (world units, at rest)
    // so that on a narrow or a short stage the frame gives way instead of being cut by the edge.
    const room = (f.w - f.cx) / f.u;
    const head = (f.cy - f.scroll * f.h * 0.12) / f.u;
    const fit = clamp((room - 1.5) / 0.14);

    // ── the deck, the light under the globe, and first light where the deck meets the horizon
    floor(f, 0.16 * f.boot);
    pool(f, [0, FLOOR, -0.3], 2.5, pal.key, (mobile ? 0.15 : 0.22) * f.boot);
    pool(f, [0, FLOOR, 60], 28, pal.key, 0.3 * f.boot);

    // the globe stands in front of all of that, and throws a little light on the air around it
    clear(f, VOID, 1.42);
    wash(f, VOID, 1.95, [[0, rgba(pal.key, 0)], [0.14, rgba(pal.key, 0.075 * f.boot)], [1, rgba(pal.key, 0)]]);

    // the horizon line, left and right of the window, drawing outward at power-on
    const far = f.P(0, FLOOR, 4000);
    const hy = far ? far.y : f.cy;
    const edge = Math.sqrt(Math.max(0.01, RIM * RIM - ((hy - f.cy) / U) ** 2)) * U;
    const reach = f.on(0.05, 0.5);
    beam(f, f.cx + edge, f.cx + edge + (2.2 * U - edge) * reach, hy, pal.key, 0.62 * reach, 0.12 * reach);
    beam(f, f.cx - edge, f.cx - edge - (1.62 * U - edge) * reach, hy, pal.key, (mobile ? 0.8 : 0.3 + 0.5 * fit) * reach, 0);

    // ── the rim of the window: a machined ring that catches the cabin light above and the deck's light below
    const rim = f.on(0, 0.5);
    ring(f, [0, 0, 0], RIM, { axis: "z", colour: pal.ink, alpha: 0.14 * rim, seg: 96 });
    f.path(sweep(RIM, 108, 108 + 50 * rim, 14), pal.ink, 0.4 * rim, 1.25);
    if (!mobile) {
      trace(f, sweep(RIM, 270 - 40 * rim, 270 + 40 * rim, 20), pal.key, 0.34 * rim, 1.25);
      // the bank scale across the top, as on an attitude indicator, and its index
      for (const d of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) f.line(hud(RIM, 90 + d), hud(RIM - (d % 30 ? 0.02 : 0.034), 90 + d), pal.ink, 0.45 * rim, 1);
      f.fill([hud(RIM - 0.012, 88.7), hud(RIM - 0.012, 91.3), hud(RIM - 0.05, 90)], pal.ink, 0.75 * rim);
    }

    // ── the bezel segments: left and right of the window on a desk screen; one long segment over the
    // upper left on a phone, starting where the top of the stage lets it
    const rise = mobile && head < 1.57 ? 180 - Math.asin(clamp((head - 0.06) / 1.505)) / DEG : 64;
    const bezels: Bezel[] = mobile
      ? [{ mid: (rise + 164) / 2, half: (164 - rise) / 2, r0: 1.44, r1: 1.505, step: 5 }]
      : [180, 0].map((mid) => ({ mid, half: 25, r0: 1.43 + 0.015 * fit, r1: 1.47 + 0.065 * fit, step: 2.5 }));
    // (on a narrow stage the headline reaches the window, and the segment on its side stands down)
    bezels.forEach((b, i) => bezel(f, b, f.on(0.15 + i * 0.1, 0.5) * (b.mid === 180 ? clamp(fit * 4 - 1) : 1), i === bezels.length - 1 ? f.t / 11 + f.rnd(3) : -1, mobile ? 0 : fit));
    // the plain arc of the outer ring, where the stage has the room for it
    const outer = mobile ? 0 : f.on(0.4, 0.4) * clamp((room - 1.62) / 0.04);
    if (outer > 0.01) {
      f.path(sweep(1.59, -20 * outer, 20 * outer, 16), pal.ink, 0.24 * outer, 1);
      for (let d = -15; d <= 15; d += 5) f.line(hud(1.59, d), hud(1.568, d), pal.ink, 0.4 * outer, 1);
      for (const k of [-20, 20]) trace(f, sweep(1.59, k * outer, k * outer * 0.72, 6), pal.key, 0.5 * outer, 1.25);
    }
    // the fixed reference: the aircraft's wings, level on the horizon
    for (const k of mobile ? [-1] : [-1, 1]) f.path([[k * 1.335, -0.04, 0], [k * 1.335, 0, 0], [k * 1.388, 0, 0]], pal.ink, 0.85 * f.on(0.2, 0.4), 2);

    // ── the day: 24 hours of UTC on the outer ring, lit as far as the clock has run
    const day = f.on(0.5, 0.4);
    const hours = f.now.getUTCHours();
    const minutes = f.now.getUTCMinutes();
    if (day > 0.01) {
      const r = mobile ? 1.56 : 1.59;
      const from = mobile ? 158 : 60;
      const to = mobile ? Math.max(112, 180 - Math.asin(clamp((head - 0.07) / 1.59)) / DEG) : 36;
      const at = (k: number) => from + (to - from) * k;
      const turn = ((hours * 60 + minutes) / 1440) * f.on(0.6, 0.4);
      f.path(sweep(r, from, to, 24), pal.ink, 0.26 * day, 1);
      for (let hr = 0; hr <= 24; hr++) {
        const major = hr % 6 === 0;
        f.line(hud(r, at(hr / 24)), hud(r - (major ? 0.06 : 0.03), at(hr / 24)), pal.ink, (major ? 0.6 : 0.3) * day, 1);
        if (major && !mobile) f.label(pad(hr), hud(r - 0.105, at(hr / 24)), { align: "center", size: 8, alpha: 0.5 * day });
      }
      if (turn > 0.004) trace(f, sweep(r, from, at(turn), 18), pal.key, 0.78 * day, 1.5);
      f.line(hud(r - 0.075, at(turn)), hud(r + 0.03, at(turn)), pal.ink, 0.95 * day, 1.75);
      lamp(f, hud(r, at(turn)), pal.key, day, 0.013);
    }

    // ── corner brackets, a little nearer than the bezel so the frame has depth; the corner beside
    // the day arc carries the time in figures
    const cornerX = Math.min(1.53, (room - (mobile ? 0.1 : 0.035)) / 1.026);
    const cornerY = mobile ? Math.min(1.46, (head - 0.04) / 1.026) : 1.34;
    const left = mobile ? -1.41 : -1.53;
    const corners = mobile ? [[left, cornerY], [cornerX, cornerY]] : [[left, cornerY], [cornerX, cornerY], [left, -cornerY], [cornerX, -cornerY]];
    corners.forEach(([x, y], i) => {
      const on = f.on(0.3 + i * 0.05, 0.4);
      const k = 1 + (1 - on) * 0.08;
      const c: V3 = [x * k, y * k, -0.15];
      f.path([[c[0] - Math.sign(x) * 0.13, c[1], c[2]], c, [c[0], c[1] - Math.sign(y) * 0.13, c[2]]], pal.ink, 0.42 * on, 1.25);
      f.dot(c, 0.009, pal.key, 0.8 * on);
      if (i !== (mobile ? 0 : 1) || (mobile && head < 1.55)) return;
      f.label(`UTC ${pad(hours)}:${pad(minutes)}`, c, { dx: mobile ? 9 : -9, dy: 15, align: mobile ? "left" : "right", size: 9, colour: pal.ink, alpha: 0.72 * day });
    });

    // ── the three regions of the trading day, standing on the deck (desk screens only): far column first
    for (let i = mobile ? -1 : COLUMNS.length - 1; i >= 0; i--) {
      const c = COLUMNS[i];
      const on = f.on(0.55 + i * 0.15, 0.3);
      if (on <= 0.01) continue;
      const lit = f.region === c.region;
      // on a narrow stage the row closes up toward the globe
      const base: V3 = [c.base[0] * (1 - (0.04 + 0.025 * i) * (1 - fit)), FLOOR, c.base[2]];
      const [x, y, z] = base;
      const top: V3 = [x, y + 0.28 * on, z];
      const w = 0.03;
      const breathe = f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.9);
      // a machined plinth on the deck, and the light the column spills on it
      if (lit) pool(f, base, 0.55, pal.key, 0.34 * on);
      ring(f, base, 0.1, { colour: pal.ink, alpha: (lit ? 0.5 : 0.28) * on, seg: 28 });
      ring(f, base, 0.052, { colour: lit ? pal.key : pal.ink, alpha: (lit ? 0.6 : 0.2) * on, seg: 16 });
      // the glass tube and its cap
      f.fill([[x - w, y, z], [x + w, y, z], [x + w, top[1], z], [x - w, top[1], z]], lit ? pal.key : pal.ink, (lit ? 0.1 : 0.05) * on);
      for (const k of [-w, w]) f.line([x + k, y, z], [x + k, top[1], z], pal.ink, 0.26 * on, 1);
      ring(f, top, w, { colour: pal.ink, alpha: 0.42 * on, seg: 12 });
      if (lit) {
        trace(f, [base, top], pal.key, 0.85 * on * breathe, 1.5);
        lamp(f, top, pal.key, on * breathe, 0.02);
      } else {
        f.line(base, top, pal.ink, 0.12 * on, 1);
        f.dot(top, 0.011, pal.ink, 0.3 * on);
      }
      f.label(c.name, base, { dy: 15, align: "center", size: 9, colour: lit ? pal.ink : pal.ink2, alpha: (lit ? 0.9 : 0.5) * on });
    }

    // whatever spilled, the globe's disc is left perfectly clean
    clear(f, VOID - 0.02, VOID + 0.03);
  },
};

export default scene;
