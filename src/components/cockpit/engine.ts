/**
 * GIO4X COCKPIT — the scene engine.
 *
 * Every page opening carries one instrument: a small 3D scene drawn on a single
 * Canvas 2D surface. This module owns everything the scenes share, so that a
 * scene is only a `draw` function:
 *   - a perspective camera (orbit, pointer parallax, scroll dolly)
 *   - the palette, read from the design tokens of the element it sits in
 *   - the frame loop: paused off-screen and in hidden tabs, one composed still
 *     under reduced motion or "low visual effects", adaptive resolution when a
 *     device cannot hold the frame rate
 *   - a short power-on ramp (`boot`) so instruments light up instead of popping
 *   - the frame: a golden rectangle (1.618 : 1) beside the statement. A scene
 *     is drawn inside it and clipped to it, so no instrument runs under the
 *     headline or off the stage
 *   - the pointer: over the frame the camera swings further and moves in, the
 *     scene's clock quickens, and a light with a reticle follows the cursor;
 *     scenes can read `hover`, `mx` and `my` to answer in their own way
 *
 * No WebGL and no dependency: the whole engine is a few kilobytes, loaded after
 * first paint, and the page is complete without it.
 */

export type V3 = readonly [number, number, number];
/** A projected point: screen position, scale at that depth, camera distance. */
export type Pt = { x: number; y: number; s: number; z: number };

export type Palette = {
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  faint: string;
  bg: string;
  blue: string;
  teal: string;
  emerald: string;
  gold: string;
  indigo: string;
  crimson: string;
  accent: string;
  /** key light: follows the trading region that is open right now */
  key: string;
  font: string;
  display: string;
};

export type Region = "asia" | "europe" | "americas" | null;

export type Cam = {
  /** orbit about the vertical axis, radians */
  yaw: number;
  /** tilt, radians (positive looks down on the scene) */
  pitch: number;
  /** camera distance from the pivot, world units */
  dist: number;
  zoom: number;
  /** how far the pointer may swing the camera, 0 to 1 */
  parallax: number;
};

export type Frame = {
  ctx: CanvasRenderingContext2D;
  /** canvas size, CSS pixels */
  w: number;
  h: number;
  /** seconds since the scene started (a fixed pose time when `still`) */
  t: number;
  /** seconds since the previous frame */
  dt: number;
  /** one composed frame only: reduced motion or low visual effects */
  still: boolean;
  /** eased pointer position, -1 to 1 */
  px: number;
  py: number;
  /** 0 to 1, eased: how much the pointer is over the instrument's frame (always 0 in a still frame and on touch) */
  hover: number;
  /** eased pointer position in canvas pixels; meaningful while `hover` is above 0 */
  mx: number;
  my: number;
  /** the golden rectangle the instrument is drawn in and clipped to, canvas pixels */
  box: { x: number; y: number; w: number; h: number };
  /** 0 while the hero fills the view, 1 once it has scrolled away */
  scroll: number;
  /** power-on ramp, 0 to 1 */
  boot: number;
  /** detail budget, 0.5 to 1: multiply particle and segment counts by it */
  q: number;
  /** narrow layout: the scene is a backdrop behind the statement */
  mobile: boolean;
  /** where the headline ends, in canvas pixels from the left (0 on the narrow layout or with no headline): a wide instrument keeps to the right of it */
  clear: number;
  /** region with the most venues inside regular hours, from the visitor's clock */
  region: Region;
  now: Date;
  /** stable per-page variant, so two pages sharing a scene never look identical */
  seed: number;
  /** what the page is about, when the scene can use it: an instrument code, a term, a tool ("eur-usd") */
  tag: string;
  pal: Palette;
  /** focal point (screen) and the size of one world unit in pixels */
  cx: number;
  cy: number;
  u: number;
  cam: Cam;
  /**
   * Point the camera. Call once at the top of `draw`; pointer parallax and the
   * scroll dolly are layered on here, so no scene has to think about them.
   */
  aim(yaw: number, pitch: number, dist?: number, zoom?: number): void;
  /** world to screen; null when the point is behind the camera */
  P(x: number, y: number, z: number): Pt | null;
  /**
   * How much the pointer is on a world point: 0 to 1, already multiplied by
   * `hover`, falling off over `radius` screen pixels (default 90). For "the
   * part under the cursor lights up, lifts, opens".
   */
  near(p: V3, radius?: number): number;
  /** deterministic 0..1 noise for index i (varies with the page seed) */
  rnd(i: number): number;
  /** staggered power-on: 0..1 for the element at position `order` (0..1) */
  on(order: number, span?: number): number;
  line(a: V3, b: V3, colour: string, alpha?: number, width?: number): void;
  path(pts: readonly V3[], colour: string, alpha?: number, width?: number, close?: boolean): void;
  fill(pts: readonly V3[], colour: string, alpha?: number): void;
  /** a filled point; `r` is in world units, like everything else */
  dot(p: V3, r: number, colour: string, alpha?: number): void;
  /** a soft pool of light around a point; `r` in world units */
  glow(p: V3, r: number, colour: string, alpha?: number): void;
  /** small-caps instrument lettering at a world position */
  label(text: string, p: V3, o?: LabelOpts): void;
};

export type LabelOpts = {
  size?: number;
  colour?: string;
  alpha?: number;
  align?: CanvasTextAlign;
  weight?: number;
  /** pixel offset from the projected point */
  dx?: number;
  dy?: number;
  display?: boolean;
};

export type Scene<S = unknown> = {
  /** time, in seconds, of the composed still frame */
  pose?: number;
  /**
   * Draw on the whole stage, unframed and unclipped. Only for a scene that is
   * composed with page elements placed over the stage (the homepage globe).
   */
  free?: boolean;
  /**
   * A free scene that frames itself. Called after each `draw`: the rectangle (canvas pixels) the scene
   * composed its instrument in, or null when it drew none. The engine then treats it as it treats its own
   * frame: the pointer counts as over the instrument only inside it, the pointer's light and reticle are
   * clipped to it, and the champagne frame is drawn round it. Scenes without it are not affected.
   */
  frame?(f: Frame): { x: number; y: number; w: number; h: number } | null;
  /** called once, and again when the page seed or the size class changes */
  setup?(f: Frame): S;
  draw(f: Frame, state: S): void;
};

export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

const colourCache = new Map<string, [number, number, number]>();
function rgb(c: string): [number, number, number] {
  let v = colourCache.get(c);
  if (v) return v;
  let r = 238;
  let g = 240;
  let b = 241;
  const s = c.trim();
  if (s[0] === "#") {
    const h = s.length <= 5 ? s.slice(1, 4).replace(/./g, "$&$&") : s.slice(1, 7);
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else {
    const m = s.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      r = Number(m[0]);
      g = Number(m[1]);
      b = Number(m[2]);
    }
  }
  v = [r, g, b];
  colourCache.set(c, v);
  return v;
}

/** Any token colour at an explicit alpha. */
export function rgba(c: string, a: number): string {
  const v = rgb(c);
  return `rgba(${v[0]},${v[1]},${v[2]},${a <= 0 ? 0 : a >= 1 ? 1 : Math.round(a * 1000) / 1000})`;
}

/** FNV-1a: a stable number for a string (page path, instrument code). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function readPalette(el: HTMLElement, region: Region): Palette {
  const cs = getComputedStyle(el);
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  const blue = v("--tone-1", "#4ba6e2");
  const teal = v("--tone-2", "#35c2b8");
  const emerald = v("--tone-3", "#3fb872");
  return {
    ink: v("--ink", "#eef0f1"),
    ink2: v("--ink-2", "#a9b2ba"),
    ink3: v("--ink-3", "#8a949c"),
    line: v("--viz-stroke", "rgba(238,240,241,.26)"),
    faint: v("--viz-faint", "rgba(238,240,241,.09)"),
    bg: v("--bg", "#0c1116"),
    blue,
    teal,
    emerald,
    gold: v("--tone-4", "#d6bd82"),
    indigo: v("--tone-5", "#9aa0f2"),
    crimson: v("--tone-6", "#e5837a"),
    accent: v("--accent", "#5ab0e8"),
    key: region === "asia" ? teal : region === "americas" ? emerald : blue,
    font: cs.fontFamily || "system-ui, sans-serif",
    display: v("--font-norms", "") || cs.fontFamily || "system-ui, sans-serif",
  };
}

/** Which region carries the trading day: read from <html data-session>, set by the shell from the visitor's clock. */
function readRegion(): Region {
  const r = document.documentElement.dataset.session;
  return r === "asia" || r === "europe" || r === "americas" ? r : null;
}

const MAX_PIXELS = 3_400_000;
/** ms: how far into its 1.8 second power-on a scene already is on its first frame (about two fifths lit) */
const BOOT_LEAD = 280;

/**
 * Start a scene on a canvas. Returns the disposer.
 * The canvas is sized by CSS; the engine only sets its backing store.
 */
/**
 * How far to lift a scene's focal point, as a share of its frame's height
 * (negative lowers it). Each scene composes itself around the frame's centre,
 * but several had their subject low in the frame, some far enough that its
 * near end was cut off by the frame's lower edge. The figures come from
 * measuring where the drawn subject actually sat in each frame at 1440 px, and
 * correcting most of the difference. Wide screens only: the narrow
 * compositions are set separately by each scene.
 */
const FRAME_LIFT: Record<string, number> = {
  accounts: 0.23,
  pip: 0.26,
  events: 0.27,
  sizing: 0.18,
  platforms: 0.25,
  threshold: 0.17,
  banks: 0.16,
  compound: 0.13,
  costs: 0.13,
  funding: 0.13,
  leverage: 0.12,
  course: 0.11,
  energy: 0.1,
  equities: 0.1,
  beacon: 0.09,
  metals: 0.09,
  atelier: 0.08,
  mt5: 0.08,
  drawdown: -0.15,
  provenance: -0.14,
  forex: -0.2,
  veil: -0.05,
};

export function mount<S>(canvas: HTMLCanvasElement, scene: Scene<S>, opts: { seed?: number; tag?: string } = {}): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isStill = () => reduced.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";
  const seed = opts.seed ?? 1;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let dprCap = 2;
  let raf = 0;
  let inView = true;
  let disposed = false;
  let started = 0;
  let last = 0;
  let tpx = 0;
  let tpy = 0;
  // raw pointer, canvas pixels, and whether it is over the frame
  let rmx = 0;
  let rmy = 0;
  let over = false;
  let clock = 0;
  let slow = 0;
  let frames = 0;
  let state: S | undefined;
  let stateFor = "";
  // the frame a free scene composed for itself on the last draw (Scene.frame), if any
  let own: { x: number; y: number; w: number; h: number } | null = null;
  // the frame as last published on the canvas (data-frame), so the attribute is written only when it moves
  let frameAt: string | null = null;

  const cam: Cam = { yaw: 0, pitch: 0.18, dist: 6, zoom: 1, parallax: 1 };
  // rotation terms, refreshed by `aim`
  let cyaw = 1;
  let syaw = 0;
  let cpit = 1;
  let spit = 0;

  const f: Frame = {
    ctx,
    w: 0,
    h: 0,
    t: 0,
    dt: 0,
    still: false,
    px: 0,
    py: 0,
    hover: 0,
    mx: 0,
    my: 0,
    box: { x: 0, y: 0, w: 1, h: 1 },
    scroll: 0,
    boot: 0,
    q: 1,
    mobile: false,
    clear: 0,
    region: null,
    now: new Date(),
    seed,
    tag: opts.tag ?? "",
    pal: readPalette(canvas, readRegion()),
    cx: 0,
    cy: 0,
    u: 100,
    cam,
    aim(yaw, pitch, dist = 6, zoom = 1) {
      // under the pointer the camera swings further and leans in
      const swing = cam.parallax * (1 + f.hover * 1.4);
      cam.yaw = yaw + f.px * 0.09 * swing;
      cam.pitch = pitch + f.py * 0.05 * swing;
      cam.dist = dist;
      // scrolling carries the visitor forward, into the instrument
      cam.zoom = zoom * (1 + f.scroll * 0.16) * (1 + f.hover * 0.045);
      cyaw = Math.cos(cam.yaw);
      syaw = Math.sin(cam.yaw);
      cpit = Math.cos(cam.pitch);
      spit = Math.sin(cam.pitch);
    },
    P(x, y, z) {
      const x1 = x * cyaw + z * syaw;
      const z1 = -x * syaw + z * cyaw;
      const y1 = y * cpit - z1 * spit;
      const z2 = y * spit + z1 * cpit + cam.dist;
      if (z2 < 0.35) return null;
      const s = (cam.dist / z2) * cam.zoom;
      return { x: f.cx + x1 * s * f.u, y: f.cy - y1 * s * f.u, s, z: z2 };
    },
    near(p3, radius = 90) {
      if (f.hover <= 0) return 0;
      const p = f.P(p3[0], p3[1], p3[2]);
      if (!p) return 0;
      const d = Math.hypot(p.x - f.mx, p.y - f.my);
      const k = 1 - d / radius;
      return k <= 0 ? 0 : k * k * (3 - 2 * k) * f.hover;
    },
    rnd(i) {
      const n = Math.sin((i + 1) * 127.1 + seed * 0.000311) * 43758.5453;
      return n - Math.floor(n);
    },
    on(order, span = 0.34) {
      return easeOut((f.boot - order * (1 - span)) / span);
    },
    line(a, b, colour, alpha = 1, width = 1) {
      const p = f.P(a[0], a[1], a[2]);
      const q = f.P(b[0], b[1], b[2]);
      if (!p || !q || alpha <= 0.003) return;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.strokeStyle = rgba(colour, alpha);
      ctx.lineWidth = width;
      ctx.stroke();
    },
    path(pts, colour, alpha = 1, width = 1, close = false) {
      if (alpha <= 0.003) return;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < pts.length; i++) {
        const p = f.P(pts[i][0], pts[i][1], pts[i][2]);
        if (!p) {
          pen = false;
          continue;
        }
        if (pen) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
        pen = true;
      }
      if (close) ctx.closePath();
      ctx.strokeStyle = rgba(colour, alpha);
      ctx.lineWidth = width;
      ctx.stroke();
    },
    fill(pts, colour, alpha = 1) {
      if (alpha <= 0.003) return;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = f.P(pts[i][0], pts[i][1], pts[i][2]);
        if (!p) return;
        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(colour, alpha);
      ctx.fill();
    },
    dot(p3, r, colour, alpha = 1) {
      const p = f.P(p3[0], p3[1], p3[2]);
      if (!p || alpha <= 0.003) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, r * p.s * f.u), 0, TAU);
      ctx.fillStyle = rgba(colour, alpha);
      ctx.fill();
    },
    glow(p3, r, colour, alpha = 0.5) {
      const p = f.P(p3[0], p3[1], p3[2]);
      if (!p || alpha <= 0.003) return;
      const R = Math.max(1, r * p.s * f.u);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
      g.addColorStop(0, rgba(colour, alpha));
      g.addColorStop(0.4, rgba(colour, alpha * 0.35));
      g.addColorStop(1, rgba(colour, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, TAU);
      ctx.fill();
    },
    label(text, p3, o = {}) {
      const p = f.P(p3[0], p3[1], p3[2]);
      const alpha = o.alpha ?? 0.7;
      if (!p || alpha <= 0.003) return;
      const size = o.size ?? 10;
      ctx.font = `${o.weight ?? 600} ${size}px ${o.display ? f.pal.display : f.pal.font}`;
      ctx.textAlign = o.align ?? "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(o.colour ?? f.pal.ink2, alpha);
      ctx.fillText(text, p.x + (o.dx ?? 0), p.y + (o.dy ?? 0));
    },
  };

  // The frame owns the instrument's place. Scenes written before the frame
  // existed move their own focal point on narrow screens; inside a frame that
  // would carry them out of it, so while a framed scene draws, the focal point
  // cannot be reassigned.
  let focusX = 0;
  let focusY = 0;
  let focusLocked = false;
  Object.defineProperty(f, "cx", { enumerable: true, get: () => focusX, set: (v: number) => void (focusLocked || (focusX = v)) });
  Object.defineProperty(f, "cy", { enumerable: true, get: () => focusY, set: (v: number) => void (focusLocked || (focusY = v)) });

  // the headline wraps differently at every width and once the display face has loaded
  const measure = () => {
    f.clear = 0;
    const h1 = f.mobile ? null : canvas.closest(".cx-hero")?.querySelector("h1");
    if (!h1) return;
    const range = document.createRange();
    range.selectNodeContents(h1);
    const left = canvas.getBoundingClientRect().left;
    for (const r of range.getClientRects()) f.clear = Math.max(f.clear, r.right - left);
  };

  /**
   * Fit the backing store to the canvas. Returns whether the picture was wiped: assigning a canvas's
   * width or height clears it, even to the same value, so they are assigned only when they change.
   * (The ResizeObserver reports once when it starts observing; that used to clear the first frame
   * just after it was drawn and leave one empty frame on screen.)
   */
  const resize = (): boolean => {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    f.mobile = w < 720;
    dpr = Math.min(dprCap, f.mobile ? 1.5 : 2, window.devicePixelRatio || 1);
    // never hand the GPU more than it needs: cap the backing store
    if (w * h * dpr * dpr > MAX_PIXELS) dpr = Math.max(1, Math.sqrt(MAX_PIXELS / (w * h)));
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    const wiped = canvas.width !== bw || canvas.height !== bh;
    if (wiped) {
      canvas.width = bw;
      canvas.height = bh;
    }
    f.w = w;
    f.h = h;
    measure();
    return wiped;
  };

  const frame = (time: number) => {
    raf = 0;
    if (disposed) return;
    const still = isStill();
    // phones hold 30 frames a second: half the work, no visible loss at this tempo
    if (!still && f.mobile && time - last < 30) {
      raf = requestAnimationFrame(frame);
      return;
    }
    if (!started) started = time;
    // (a frame drawn at once, outside the loop, is stamped a little later than the loop's own: never run backwards)
    const dt = last ? clamp((time - last) / 1000, 0, 0.1) : 0.016;
    last = time;

    f.still = still;
    f.dt = dt;
    f.px += (tpx - f.px) * (still ? 1 : 0.06);
    f.py += (tpy - f.py) * (still ? 1 : 0.06);
    f.hover += ((over && !still ? 1 : 0) - f.hover) * 0.09;
    if (f.hover < 0.002) f.hover = 0;
    f.mx += (rmx - f.mx) * 0.22;
    f.my += (rmy - f.my) * 0.22;
    if (still) {
      f.px = 0;
      f.py = 0;
      f.hover = 0;
    }
    // the scene's own clock: it runs faster while the pointer is over the frame
    clock += dt * (1 + f.hover * 0.7);
    f.t = still ? (scene.pose ?? 9) : clock;
    // the power-on ramp, with a head start: the very first frame already shows the instrument faintly lit instead of an empty pane
    f.boot = still ? 1 : easeOut((time - started + BOOT_LEAD) / 1800);
    f.now = new Date();

    const framed = !scene.free;
    focusLocked = false;
    if (framed) {
      // the instrument's frame: a golden rectangle beside the statement on
      // wide screens, above it on narrow ones
      const gutter = clamp(w * 0.042, 21, 55);
      const contentW = Math.min(w - gutter * 2, 1320);
      const contentL = (w - contentW) / 2;
      const b = f.box;
      if (w >= 1080) {
        b.w = Math.min(contentW * 0.52, 760, (h - 68) * 1.618);
        b.h = b.w / 1.618;
        b.x = contentL + contentW - b.w;
        b.y = (h - b.h) / 2;
      } else {
        // must match --cx-frame-h and the 4.75rem offset in cockpit.css, which keep the statement below it
        b.w = Math.min(contentW, 560);
        b.h = b.w / 1.618;
        b.x = (w - b.w) / 2;
        b.y = 76;
      }
      f.cx = b.x + b.w / 2;
      // on a wide screen, a scene whose subject was measured sitting low (or high) in its frame is re-centred
      f.cy = b.y + b.h / 2 - (w >= 1080 ? (FRAME_LIFT[canvas.dataset.scene ?? ""] ?? 0) * b.h : 0);
      f.u = Math.min(b.w / 3.9, b.h / 2.75);
    } else {
      // free composition: the golden section to the right on wide screens,
      // high and behind the statement on narrow ones
      f.cx = w * (f.mobile ? 0.62 : 0.7);
      f.cy = h * (f.mobile ? 0.36 : 0.5) + f.scroll * h * 0.12;
      f.u = Math.min(w * (f.mobile ? 0.4 : 0.2), h * 0.34);
      f.box.x = 0;
      f.box.y = 0;
      f.box.w = w;
      f.box.h = h;
    }
    cam.parallax = 1;
    f.aim(0, 0.18);

    const key = `${f.mobile ? "m" : "d"}`;
    if (state === undefined || stateFor !== key) {
      state = scene.setup ? scene.setup(f) : (undefined as S);
      stateFor = key;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (framed) {
      const b = f.box;
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x, b.y, b.w, b.h);
      ctx.clip();
      // a pane of darker glass, so the frame reads as an instrument's window
      ctx.fillStyle = "rgba(4, 8, 12, 0.34)";
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    focusLocked = framed;
    scene.draw(f, state as S);
    focusLocked = false;
    own = !framed && scene.frame ? scene.frame(f) : null;

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (own) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(own.x, own.y, own.w, own.h);
      ctx.clip();
    }
    if (f.hover > 0) {
      // the pointer carries a light: what it passes over is lit from the key
      const R = f.u * 1.5;
      const g = ctx.createRadialGradient(f.mx, f.my, 0, f.mx, f.my, R);
      g.addColorStop(0, rgba(f.pal.key, 0.2 * f.hover));
      g.addColorStop(0.45, rgba(f.pal.key, 0.07 * f.hover));
      g.addColorStop(1, rgba(f.pal.key, 0));
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g;
      ctx.fillRect(f.mx - R, f.my - R, R * 2, R * 2);
      ctx.globalCompositeOperation = "source-over";
      // and a reticle, as an instrument's cursor: a ring that turns slowly, four ticks
      const r = 13;
      ctx.strokeStyle = rgba(f.pal.gold, 0.75 * f.hover);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(f.mx, f.my, r, clock * 0.9, clock * 0.9 + TAU * 0.72);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * TAU) / 4;
        ctx.moveTo(f.mx + Math.cos(a) * (r + 4), f.my + Math.sin(a) * (r + 4));
        ctx.lineTo(f.mx + Math.cos(a) * (r + 10), f.my + Math.sin(a) * (r + 10));
      }
      ctx.stroke();
      ctx.fillStyle = rgba(f.pal.ink, 0.9 * f.hover);
      ctx.beginPath();
      ctx.arc(f.mx, f.my, 1.4, 0, TAU);
      ctx.fill();
    }
    if (framed || own) ctx.restore();
    const b = framed ? f.box : own;
    if (b) {
      // the frame itself: a hairline in champagne, heavier at the corners, with
      // the golden cut marked on its long sides. It brightens under the pointer.
      const lit = f.boot * (0.5 + f.hover * 0.5);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(f.pal.gold, 0.22 * lit);
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      const c = Math.min(21, b.w * 0.05);
      ctx.strokeStyle = rgba(f.pal.gold, 0.85 * lit);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [x, y, sx, sy] of [
        [b.x, b.y, 1, 1],
        [b.x + b.w, b.y, -1, 1],
        [b.x, b.y + b.h, 1, -1],
        [b.x + b.w, b.y + b.h, -1, -1],
      ] as const) {
        ctx.moveTo(x + sx * c, y + sy * 0.75);
        ctx.lineTo(x + sx * 0.75, y + sy * 0.75);
        ctx.lineTo(x + sx * 0.75, y + sy * c);
      }
      const cut = b.x + b.w * 0.618;
      ctx.moveTo(cut, b.y - 4);
      ctx.lineTo(cut, b.y + 5);
      ctx.moveTo(cut, b.y + b.h - 5);
      ctx.lineTo(cut, b.y + b.h + 4);
      ctx.stroke();
    }

    if (!canvas.dataset.on) canvas.dataset.on = "1";
    // Where the champagne frame stands, in the canvas's own CSS pixels ("x,y,w,h"; empty when the scene
    // has none). Read by the page-to-page transition and the first-visit intro (StageTransition, Boot),
    // which must find the frame without drawing anything themselves. Written only when it changes.
    const at = b ? `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.w)},${Math.round(b.h)}` : "";
    if (at !== frameAt) {
      frameAt = at;
      canvas.dataset.frame = at;
    }

    if (!still) {
      // adaptive quality: if the device cannot hold the frame, ask less of it
      frames++;
      if (frames > 24) {
        if (dt > 0.03) slow++;
        if (frames % 90 === 0) {
          if (slow > 34 && (f.q > 0.5 || dprCap > 1)) {
            f.q = Math.max(0.5, f.q - 0.25);
            dprCap = 1;
            resize();
          }
          slow = 0;
        }
      }
      if (inView && !document.hidden) raf = requestAnimationFrame(frame);
    }
  };

  const start = () => {
    if (disposed || raf) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  };

  /**
   * Draw one frame now, in this task, instead of asking for the next animation frame. Used for the
   * first picture (so the canvas is never shown before it holds one) and straight after the backing
   * store has been wiped by a resize (so the wiped canvas is never what gets painted). The loop
   * carries on from it as usual.
   */
  const drawNow = () => {
    if (disposed) return;
    cancelAnimationFrame(raf);
    raf = 0;
    const was = last;
    frame(performance.now());
    // phones skip a frame that comes too soon after the last; a wiped canvas must be drawn regardless
    if (last === was && !disposed) {
      cancelAnimationFrame(raf);
      last = 0;
      frame(performance.now());
    }
  };

  const ro = new ResizeObserver(() => {
    if (resize()) drawNow();
    else start();
  });
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView) start();
  });
  io.observe(canvas);

  const onVis = () => {
    if (!document.hidden) start();
  };
  const onPrefs = () => {
    // theme, accent or motion changed: re-read the tokens on the next frame
    requestAnimationFrame(() => {
      f.region = readRegion();
      f.pal = readPalette(canvas, f.region);
      start();
    });
  };
  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    tpx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
    tpy = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
    // a mouse or a pen can hover; a finger cannot, and its last position must not leave a light on
    if (e.pointerType === "touch") {
      over = false;
      return;
    }
    rmx = e.clientX - r.left;
    rmy = e.clientY - r.top;
    const b = f.box;
    const was = over;
    over = own
      ? rmx >= own.x && rmx <= own.x + own.w && rmy >= own.y && rmy <= own.y + own.h
      : scene.free
        ? rmx > r.width * 0.42 && rmy >= 0 && rmy <= r.height
        : rmx >= b.x && rmx <= b.x + b.w && rmy >= b.y && rmy <= b.y + b.h;
    if (over && !was && f.hover === 0) {
      // arrive where the pointer is, not from wherever it last was
      f.mx = rmx;
      f.my = rmy;
    }
  };
  const onLeave = () => {
    tpx = 0;
    tpy = 0;
    over = false;
  };
  const onScroll = () => {
    const r = canvas.getBoundingClientRect();
    f.scroll = clamp(-r.top / Math.max(1, r.height));
  };
  // a still frame has no loop, so refresh it when the clock moves on
  const minute = window.setInterval(() => {
    if (isStill() && inView) start();
  }, 60_000);

  f.region = readRegion();
  f.pal = readPalette(canvas, f.region);
  resize();
  onScroll();
  // the first picture is drawn here, synchronously: by the time the canvas is marked `data-on` and
  // begins to fade in, it already holds a frame, and the page-to-page transition need not wait for one
  drawNow();
  void document.fonts?.ready.then(() => {
    if (disposed) return;
    measure();
    start();
  });
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("gx:prefs", onPrefs);
  window.addEventListener("gx:session", onPrefs);
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerup", onLeave, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  reduced.addEventListener("change", onPrefs);

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    window.clearInterval(minute);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("gx:prefs", onPrefs);
    window.removeEventListener("gx:session", onPrefs);
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("pointerup", onLeave);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("scroll", onScroll);
    reduced.removeEventListener("change", onPrefs);
  };

}
