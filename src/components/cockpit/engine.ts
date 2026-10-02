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

/**
 * Start a scene on a canvas. Returns the disposer.
 * The canvas is sized by CSS; the engine only sets its backing store.
 */
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
  let slow = 0;
  let frames = 0;
  let state: S | undefined;
  let stateFor = "";

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
      cam.yaw = yaw + f.px * 0.09 * cam.parallax;
      cam.pitch = pitch + f.py * 0.05 * cam.parallax;
      cam.dist = dist;
      // scrolling carries the visitor forward, into the instrument
      cam.zoom = zoom * (1 + f.scroll * 0.16);
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

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    f.mobile = w < 720;
    dpr = Math.min(dprCap, f.mobile ? 1.5 : 2, window.devicePixelRatio || 1);
    // never hand the GPU more than it needs: cap the backing store
    if (w * h * dpr * dpr > MAX_PIXELS) dpr = Math.max(1, Math.sqrt(MAX_PIXELS / (w * h)));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    f.w = w;
    f.h = h;
    measure();
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
    const dt = last ? Math.min(0.1, (time - last) / 1000) : 0.016;
    last = time;

    f.still = still;
    f.dt = dt;
    f.t = still ? (scene.pose ?? 9) : (time - started) / 1000;
    f.boot = still ? 1 : easeOut(f.t / 1.8);
    f.now = new Date();
    f.px += (tpx - f.px) * (still ? 1 : 0.06);
    f.py += (tpy - f.py) * (still ? 1 : 0.06);
    if (still) {
      f.px = 0;
      f.py = 0;
    }

    // default composition: the instrument sits in the golden section to the
    // right on wide screens, high and behind the statement on narrow ones
    f.cx = w * (f.mobile ? 0.62 : 0.7);
    f.cy = h * (f.mobile ? 0.36 : 0.5) + f.scroll * h * 0.12;
    f.u = Math.min(w * (f.mobile ? 0.4 : 0.2), h * 0.34);
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

    scene.draw(f, state as S);

    if (!canvas.dataset.on) canvas.dataset.on = "1";

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

  const ro = new ResizeObserver(() => {
    resize();
    start();
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
  };
  const onLeave = () => {
    tpx = 0;
    tpy = 0;
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
  start();
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
