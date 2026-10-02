/**
 * SIGNAL — research as extraction, on an optical bench.
 *
 * Three ribbons of light carry the same curve toward the reader at three
 * depths. The far one is raw: a frayed bundle, the curve buried in roughness.
 * The middle one is cleaner. The near one is the curve alone. On the way they
 * pass through blades of filter glass standing across the bench, each ribbon
 * through its own machined aperture, and every blade takes some roughness out.
 * Below, engraved in the bench, the result: a title and lines of text.
 *
 * Nothing here is a market: there is no axis, no scale and no symbol, and the
 * curve is drawn from the page's own seed so every article has its own.
 */
import { TAU, clamp, easeOut, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, panel, pool, ring } from "../kit";

/** the sections of GIO4X Intelligence, by slug */
const SECTIONS = new Map<string, string>(
  ["markets", "macro", "forex", "commodities", "crypto", "education", "risk", "technical", "platforms", "gio4x"].map((slug) => [slug, slug === "technical" ? "TECHNICAL ANALYSIS" : slug.toUpperCase()]),
);

const FLOOR = -1.3;
/** the bench: a machined slab the blades of glass stand in */
const TOP = -0.72;
const FRONT = -1.02;
const BACK = 1.02;
const LEFT = -1.28;
const RIGHT = 1.38;
/** half the depth of a blade of glass, its top, and the thickness of its polished edge */
const BLADE = 0.92;
const CROWN = 0.84;
const EDGE = 0.032;
/** leading of the engraved text */
const LINE = 0.06;

type Wave = { k: number; a: number; v: number; p: number };
/** a ribbon's samples along the bench; this frame's screen positions of its lit edge (a) and far edge (b), and the lit edge's world height */
type Drawn = { xs: Float32Array; ax: Float32Array; ay: Float32Array; bx: Float32Array; by: Float32Array; wy: Float32Array };
/**
 * A ribbon: its height and depth, half the tape's width in depth and how far the far edge stands above the lit one
 * (both 0 for a loose strand), its extent along the bench in `n` samples, how much of the shared curve it carries,
 * and its own roughness.
 */
type Ribbon = Drawn & { y: number; z: number; half: number; rise: number; x0: number; x1: number; n: number; curve: number; grain: number; shift: number; noise: Wave[] };
type Word = { u: number; w: number; row: number };
type State = { panes: number[]; curve: Wave[]; grain: Float32Array; ribbons: Ribbon[]; words: Word[] };

const smooth = (v: number) => clamp(v) * clamp(v) * (3 - 2 * clamp(v));

/** the sample at which a ribbon crosses the plane x (a sample sits exactly in the plane of every blade) */
const cross = (r: Ribbon, x: number) => Math.round(clamp((x - r.x0) / (r.x1 - r.x0)) * r.n);

/** a ribbon's light along its length, 0..1: it arrives out of the distance and dissolves past the last blade */
const LIGHT: [number, number][] = [[0, 0], [0.3, 0.45], [0.6, 1], [0.88, 1], [1, 0]];
const lum = (u: number) => {
  for (let i = 1; i < LIGHT.length; i++) {
    if (u <= LIGHT[i][0]) return LIGHT[i - 1][1] + ((LIGHT[i][1] - LIGHT[i - 1][1]) * (u - LIGHT[i - 1][0])) / (LIGHT[i][0] - LIGHT[i - 1][0]);
  }
  return 0;
};
function light(f: Frame, r: Ribbon, colour: string): CanvasGradient {
  const g = f.ctx.createLinearGradient(r.ax[0], r.ay[0], r.ax[r.n], r.ay[r.n]);
  for (const [at, a] of LIGHT) g.addColorStop(at, rgba(colour, a));
  return g;
}

/** move a ribbon to this frame's shape and project it once */
function shape(f: Frame, s: State, r: Ribbon): void {
  const t = f.t;
  for (let i = 0; i <= r.n; i++) {
    const x = r.xs[i];
    let y = 0;
    for (const w of s.curve) y += w.a * Math.sin(w.k * (x - w.v * t) + w.p);
    y = r.y + y * r.curve;
    if (r.noise.length) {
      // every filter the ribbon has passed takes some of the roughness out
      let gain = 1;
      for (const p of s.panes) gain *= 1 - 0.34 * smooth((x - p) / 0.3 + 0.5);
      let n = 0;
      for (const w of r.noise) n += w.a * Math.sin(w.k * (x - w.v * t) + w.p);
      if (r.grain > 0) {
        const g = (x - 0.12 * t) / 0.05 + r.shift;
        const j = Math.floor(g);
        const a = s.grain[((j % 64) + 64) % 64];
        n += r.grain * (a + (s.grain[(((j + 1) % 64) + 64) % 64] - a) * (g - j));
      }
      y += n * gain;
    }
    r.wy[i] = y;
    const a = f.P(x, y, r.z - r.half);
    // the tape turns slowly along its length, as a ribbon does
    const b = r.half > 0 ? f.P(x, y + r.rise * (0.62 + 0.38 * Math.sin(1.25 * (x - 0.1 * t) + r.shift)), r.z + r.half) : a;
    if (!a || !b) continue;
    r.ax[i] = a.x;
    r.ay[i] = a.y;
    r.bx[i] = b.x;
    r.by[i] = b.y;
  }
}

/** one stretch of a ribbon between two samples: a sheet of light standing behind a lit edge */
function stretch(f: Frame, r: Ribbon, from: number, to: number, style: CanvasGradient, level: number, width: number, body: number): void {
  const i0 = Math.max(0, Math.floor(from));
  const i1 = Math.min(r.n, Math.ceil(to));
  if (i1 - i0 < 1 || level <= 0.003) return;
  const { ctx } = f;
  // the lit edge, then back along a line `k` of the way to the far edge
  const run = (k: number, back: boolean) => {
    ctx.beginPath();
    ctx.moveTo(r.ax[i0], r.ay[i0]);
    for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(r.ax[i], r.ay[i]);
    if (back) for (let i = i1; i >= i0; i--) ctx.lineTo(r.ax[i] + (r.bx[i] - r.ax[i]) * k, r.ay[i] + (r.by[i] - r.ay[i]) * k);
  };
  ctx.save();
  ctx.fillStyle = style;
  ctx.strokeStyle = style;
  if (r.half > 0) {
    // the body, twice: the full sheet, then its brighter half next to the lit edge
    ctx.globalAlpha = body * level;
    run(1, true);
    ctx.fill();
    ctx.globalAlpha = 0.26 * level;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.bx[i0], r.by[i0]);
    for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(r.bx[i], r.by[i]);
    ctx.stroke();
    ctx.globalAlpha = body * level;
    run(0.45, true);
    ctx.fill();
    // a soft halo under a fine core, as the kit's traces have
    run(0, false);
    ctx.globalAlpha = 0.16 * level;
    ctx.lineWidth = width * 4.5;
    ctx.stroke();
  } else run(0, false);
  ctx.globalAlpha = level;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** a wash of light across a face: full at `a`, gone at `b` */
function wash(f: Frame, quad: readonly V3[], a: V3, b: V3, colour: string, alpha: number): void {
  const p = f.P(...a);
  const q = f.P(...b);
  if (!p || !q || alpha <= 0.003) return;
  const { ctx } = f;
  const g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
  g.addColorStop(0, rgba(colour, alpha));
  g.addColorStop(1, rgba(colour, 0));
  ctx.beginPath();
  for (let i = 0; i < quad.length; i++) {
    const v = f.P(...quad[i]);
    if (!v) return;
    if (i) ctx.lineTo(v.x, v.y);
    else ctx.moveTo(v.x, v.y);
  }
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
}

/** engraved rules on the bench's front face, as one stroke */
function rules(f: Frame, words: readonly Word[], from: number, to: number, x0: number, y0: number, colour: string, alpha: number): void {
  if (alpha <= 0.003 || to <= from) return;
  const { ctx } = f;
  ctx.beginPath();
  for (let i = Math.max(0, from); i < Math.min(words.length, to); i++) {
    const w = words[i];
    const a = f.P(x0 + w.u, y0 - w.row * LINE, FRONT);
    const b = f.P(x0 + w.u + w.w, y0 - w.row * LINE, FRONT);
    if (!a || !b) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** the bench itself: a solid machined slab, lit along its top edge where the ribbons pass overhead */
function bench(f: Frame, right: number, on: number): void {
  if (on <= 0.003) return;
  const { pal } = f;
  const front: V3[] = [[LEFT, FLOOR, FRONT], [right, FLOOR, FRONT], [right, TOP, FRONT], [LEFT, TOP, FRONT]];
  const side: V3[] = [[right, FLOOR, FRONT], [right, FLOOR, BACK], [right, TOP, BACK], [right, TOP, FRONT]];
  const top: V3[] = [[LEFT, TOP, FRONT], [right, TOP, FRONT], [right, TOP, BACK], [LEFT, TOP, BACK]];
  // the top face shows only while the eye is above it
  if (Math.sin(f.cam.pitch) * f.cam.dist < -TOP) {
    f.fill(top, pal.bg, 0.86 * on);
    f.fill(top, pal.ink, 0.07 * on);
    f.line(top[3], top[2], pal.ink, 0.16 * on, 1);
  }
  f.fill(side, pal.bg, 0.86 * on);
  f.fill(side, pal.ink, 0.022 * on);
  f.fill(front, pal.bg, 0.86 * on);
  f.fill(front, pal.ink, 0.035 * on);
  wash(f, front, [0.2, TOP, FRONT], [0.2, TOP - 0.42, FRONT], pal.key, 0.11 * on);
  f.path(side, pal.ink, 0.14 * on, 1, true);
  f.path(front, pal.ink, 0.2 * on, 1, true);
  f.line([LEFT, TOP - 0.035, FRONT], [right, TOP - 0.035, FRONT], pal.ink, 0.1 * on, 1);
  f.line(front[3], front[2], pal.key, 0.42 * on, 1.25);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const m = f.mobile;
    const panes = m ? [-0.75, 0.3] : [-1.05, -0.2, 0.65];
    const q = (m ? 0.6 : 1) * f.q;
    // on a phone the ribbons must dissolve inside the frame
    const end = m ? 0.95 : 1.2;

    // the curve every ribbon carries: one long swell and a gentler second one, different for every article.
    // About one wavelength shows at a time, so it always reads as a wave and never as a line going up or down.
    const k1 = 2.1 + f.rnd(1) * 0.8;
    const curve: Wave[] = [
      { k: k1, a: 0.125 + f.rnd(2) * 0.03, v: 0.13, p: f.rnd(3) * TAU },
      { k: k1 * (1.6 + f.rnd(4) * 0.6), a: 0.025 + f.rnd(5) * 0.025, v: 0.1, p: f.rnd(6) * TAU },
    ];
    const grain = new Float32Array(64);
    for (let i = 0; i < 64; i++) grain[i] = f.rnd(40 + i) - 0.5;

    // roughness: many small oscillations of irregular size, all drifting the same way at almost the same pace
    const noise = (seed: number, count: number, k0: number, kn: number, amp: number): Wave[] => {
      const out: Wave[] = [];
      for (let i = 0; i < count; i++) {
        const j = seed + i * 3;
        out.push({ k: k0 + (kn - k0) * f.rnd(j), a: amp * (0.35 + 0.65 * f.rnd(j + 1)), v: 0.115 + 0.014 * f.rnd(j + 2), p: f.rnd(j + 2) * TAU });
      }
      return out;
    };
    const mk = (y: number, z: number, half: number, rise: number, x0: number, x1: number, n: number, c: number, g: number, shift: number, waves: Wave[]): Ribbon => {
      const count = Math.max(24, Math.round(n * q));
      const arr = () => new Float32Array(count + 1);
      const r: Ribbon = { y, z, half, rise, x0, x1, n: count, curve: c, grain: g, shift, noise: waves, xs: arr(), ax: arr(), ay: arr(), bx: arr(), by: arr(), wy: arr() };
      for (let i = 0; i <= count; i++) r.xs[i] = x0 + ((x1 - x0) * i) / count;
      // the ribbon is cut where it passes through a blade, so one sample must lie exactly in that plane
      for (const p of panes) if (p > x0 && p < x1) r.xs[cross(r, p)] = p;
      return r;
    };
    const ribbons = [
      // raw: two loose strands and a thin tape, the curve buried in roughness
      mk(0.5, 0.67, 0, 0, -2.3, end, 170, 0.55, 0.1, 17, noise(200, 5, 8, 30, 0.03)),
      mk(0.47, 0.57, 0, 0, -2.3, end, 170, 0.55, 0.09, 39, noise(240, 5, 8, 30, 0.03)),
      mk(0.48, 0.62, 0.07, 0.04, -2.3, end, 170, 0.6, 0.075, 0, noise(280, 6, 7, 28, 0.028)),
      // cleaner
      mk(0.1, 0, 0.12, 0.1, -1.95, end + 0.07, 110, 0.85, 0, 2.1, noise(320, 3, 4.5, 9.5, 0.026)),
      // the curve alone
      mk(-0.28, -0.62, 0.17, 0.15, -1.6, end + 0.15, 80, 1, 0, 4.4, []),
    ];

    // lines of text as rows of words: ragged right, a short last line
    const words: Word[] = [];
    const rows = 5;
    for (let row = 0; row < rows; row++) {
      const limit = 1.6 * (row === rows - 1 ? 0.36 + f.rnd(90) * 0.24 : 0.86 + f.rnd(91 + row) * 0.14);
      let u = 0;
      for (let i = 0; i < 16; i++) {
        const w = 0.045 + f.rnd(100 + row * 20 + i) * 0.115;
        if (u + w > limit) break;
        words.push({ u, w, row });
        u += w + 0.03;
      }
    }
    return { panes, curve, grain, ribbons, words };
  },
  draw(f, s) {
    const { pal } = f;
    // a long lens, low over the deck: the bench runs away to the left, so the ribbons arrive
    // out of the distance and come toward the reader
    f.aim(0.34 + (f.still ? 0 : Math.sin(f.t * 0.09) * 0.03), 0.05, 10, f.mobile ? 0.76 : 0.88);
    // sit a little right of the focal point when the stage has the room, clear of the statement
    if (!f.mobile) f.cx += f.u * clamp((f.w - f.cx) / f.u - 1.5, 0, 0.1);
    f.cy -= f.mobile ? f.h * 0.05 : f.u * 0.1;

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [0.2, FLOOR, -0.8], 3, pal.key, 0.22 * f.boot);
    // a phone gets a shorter, quieter bench: it must end inside the frame and it sits behind the statement
    bench(f, f.mobile ? 0.95 : RIGHT, f.on(0, 0.4) * (f.mobile ? 0.6 : 1));

    for (const r of s.ribbons) shape(f, s, r);
    const [strandA, strandB, raw, mid, near] = s.ribbons;
    const midColour = pal.key === pal.teal ? pal.blue : pal.teal;
    const tones = [pal.ink, midColour, pal.key];
    const lights = [light(f, raw, pal.ink), light(f, mid, midColour), light(f, near, pal.key)];
    // the ribbons draw themselves in, raw first, the clear one last
    const drawn = (order: number) => easeOut((f.boot - order) / 0.6);
    const pulse = f.still || f.boot < 1 ? -1 : ((f.t / 11 + f.rnd(7)) % 1) * near.n;

    const between = (x0: number, x1: number) => {
      const part = (r: Ribbon, tone: number, order: number, level: number, width: number, body: number) => {
        stretch(f, r, cross(r, x0), Math.min(cross(r, x1), drawn(order) * r.n), lights[tone], level, width, body);
      };
      part(strandA, 0, 0.1, 0.17, 1, 0);
      part(strandB, 0, 0.14, 0.13, 1, 0);
      part(raw, 0, 0.12, 0.36, 1, 0.09);
      part(mid, 1, 0.22, 0.68, 1.25, 0.11);
      part(near, 2, 0.34, 0.96, 2.25, 0.15);
      // one slow pulse of light rides the clear ribbon, as bright as the ribbon is there
      if (pulse >= cross(near, x0) && pulse < cross(near, x1)) {
        const i = Math.floor(pulse);
        const j = Math.min(near.n, i + 1);
        const p: V3 = [near.xs[i] + (near.xs[j] - near.xs[i]) * (pulse - i), near.wy[i] + (near.wy[j] - near.wy[i]) * (pulse - i), near.z - near.half];
        const a = lum(pulse / near.n);
        f.glow(p, 0.14, pal.key, 0.8 * a);
        f.dot(p, 0.012, pal.ink, 0.95 * a);
      }
    };

    // ── far to near: a stretch of ribbon, then the blade of filter glass it passes through
    let last = -9;
    s.panes.forEach((x, k) => {
      between(last, x);
      last = x;
      const depth = (k + 1) / s.panes.length;
      const on = f.on(0.08 + k * 0.14, 0.42);
      if (on <= 0.003) return;
      // a light strip in the slot feeds the glass from below: the pane glows at its foot and along its polished near edge
      f.line([x, TOP, -BLADE], [x, TOP, BLADE], pal.key, (0.3 + 0.35 * depth) * on, 1.5);
      const pane = panel(f, [x, (TOP + CROWN) / 2, 0], BLADE * 2, CROWN - TOP, { yaw: Math.PI / 2, on, colour: pal.key, alpha: 0.3 + 0.36 * depth, glass: 0.03 });
      wash(f, [pane.at(0, 0), pane.at(1, 0), pane.at(1, 0.55), pane.at(0, 0.55)], pane.at(0.5, 0), pane.at(0.5, 0.55), pal.key, 0.16 * on * depth);
      const lift = (1 - on) * -0.18;
      const edge: V3[] = [[x, TOP + lift, -BLADE], [x + EDGE, TOP + lift, -BLADE], [x + EDGE, CROWN + lift, -BLADE], [x, CROWN + lift, -BLADE]];
      f.fill(edge, pal.key, (0.1 + 0.2 * depth) * on);
      f.line(edge[1], edge[2], pal.ink, (0.14 + 0.2 * depth) * on, 1);
      f.path([edge[2], [x + EDGE, CROWN + lift, BLADE], [x + EDGE, TOP + lift, BLADE]], pal.ink, 0.11 * on, 1);
      // one machined aperture per ribbon (the clear one's is knurled), and a point of light where the ribbon meets the glass
      [raw, mid, near].forEach((r, i) => {
        ring(f, [x, r.y + lift, r.z], [0.27, 0.25, 0.23][i], { axis: "x", colour: tones[i], alpha: [0.2, 0.32, 0.5][i] * on * (0.55 + 0.45 * depth), ticks: i === 2 && !f.mobile ? 32 : 0, tickLen: 0.02, seg: 44 });
        const at = cross(r, x);
        if (drawn([0.12, 0.22, 0.34][i]) * r.n < at) return;
        const p: V3 = [x, r.wy[at], r.z - r.half];
        const a = on * (0.35 + 0.65 * lum(at / r.n));
        f.dot(p, 0.024, tones[i], [0.2, 0.3, 0.42][i] * a);
        f.dot(p, 0.01, tones[i], [0.5, 0.85, 1][i] * a);
      });
    });
    between(last, 9);

    if (f.mobile) return;

    // ── each ribbon ends in its name: what the desk starts from, what it does, what it publishes
    const names = f.on(0.9, 0.3);
    f.label("SOURCES", [raw.x1 + 0.04, raw.y, raw.z], { size: 10, alpha: 0.5 * names, colour: pal.ink2 });
    f.label("ANALYSIS", [mid.x1 + 0.04, mid.y, mid.z], { size: 10, alpha: 0.62 * names, colour: pal.ink2 });
    f.label("EXPLANATION", [near.x1 + 0.04, near.y, near.z - near.half], { size: 10, alpha: 0.85 * names, colour: pal.ink });

    // ── the result, engraved in the bench: a section, a title, then lines of text lit word by word
    const section = SECTIONS.get(f.tag);
    const x0 = -0.62;
    const head = f.on(0.5, 0.3);
    f.label(section ?? "INTELLIGENCE", [x0, TOP - 0.1, FRONT], { size: 9, alpha: (section ? 0.95 : 0.6) * head, colour: section ? pal.gold : pal.ink2 });
    // the page's own piece is picked out in champagne: its marker and its title rule
    f.line([x0, TOP - 0.175, FRONT], [x0 + 0.66 * head, TOP - 0.175, FRONT], f.tag ? pal.gold : pal.ink, (f.tag ? 0.9 : 0.6) * head, 2);
    if (f.tag) f.line([x0 - 0.055, TOP - 0.07, FRONT], [x0 - 0.055, TOP - 0.07 - 0.125 * head, FRONT], pal.gold, 0.9 * head, 2);
    const y0 = TOP - 0.25;
    rules(f, s.words, 0, s.words.length, x0, y0, pal.ink, 0.1 * f.boot);
    rules(f, s.words, 0, Math.floor(easeOut((f.boot - 0.42) / 0.58) * s.words.length), x0, y0, pal.ink, 0.4);
    if (!f.still && f.boot >= 1) {
      // a slow reading point moves through the text
      const at = Math.floor(((f.t / 26) % 1) * s.words.length);
      rules(f, s.words, at - 2, at, x0, y0, pal.key, 0.35);
      rules(f, s.words, at, at + 1, x0, y0, pal.key, 0.9);
    }
  },
};

export default scene;
