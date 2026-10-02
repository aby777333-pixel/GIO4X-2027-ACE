"use client";

import { useEffect, useRef } from "react";

/**
 * The host for a small page figure: a decorative Canvas 2D drawing that sits in
 * a section's short column, beside the text it belongs to.
 *
 * A figure is a client component that passes a `draw` function here. The host
 * owns everything that is the same for all of them: sizing to the device pixel
 * ratio, colours read from the design tokens (so theme and accent follow),
 * pausing off-screen and in hidden tabs, a single composed still frame under
 * reduced motion or "low visual effects", and the pointer.
 *
 * Figures illustrate an idea. They never show a price, a statistic or anything
 * that could be read as live data, and they carry no meaning the text beside
 * them does not also state: the canvas is aria-hidden.
 */

/** red, green, blue (0 to 255) and the token's own alpha */
export type Colour = readonly [number, number, number, number];

export type Palette = {
  ink: Colour;
  ink2: Colour;
  ink3: Colour;
  line: Colour;
  /** the page's accent (follows the accent picker) */
  accent: Colour;
  /** champagne metal */
  gold: Colour;
  teal: Colour;
  emerald: Colour;
  surface: Colour;
  /** the page's text face, for the few labels a figure draws */
  font: string;
};

export type FigureFrame = {
  ctx: CanvasRenderingContext2D;
  /** drawing size in CSS pixels */
  w: number;
  h: number;
  /** seconds since the figure first drew; frozen at STILL_T in a still frame */
  t: number;
  /** seconds since the last frame (0 in a still frame) */
  dt: number;
  /** 0 to 1, eased: how much the pointer is over the figure */
  hover: number;
  /** eased pointer position in CSS pixels; rests at the centre when away */
  mx: number;
  my: number;
  pal: Palette;
  /** true when this is the one composed frame drawn under reduced motion */
  still: boolean;
  /**
   * 0 to 1, eased: how far the figure has "arrived" since it first scrolled
   * into view (about a second). A figure may use it to assemble itself; the
   * host also fades and lifts the whole figure in over the same moment.
   * Always 1 in a still frame.
   */
  enter: number;
};

export type FigureDraw = (f: FigureFrame) => void;

/** a still frame is drawn at this moment of the animation, so a figure can compose it */
export const STILL_T = 2.6;

export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
/** a token colour as a canvas colour, at this share of its own alpha */
export const rgba = (c: Colour, alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(c[3] * alpha)})`;

type Props = {
  draw: FigureDraw;
  /** width divided by height; the golden rectangle by default */
  ratio?: number;
  className?: string;
};

export function Figure({ draw, ratio = 1.618, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isStill = () => reduced.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";
    // with motion reduced by the site's own switch there is no arrival: the figure is simply there
    if (isStill()) canvas.parentElement?.setAttribute("data-arrived", "");

    let w = 1;
    let h = 1;
    let raf = 0;
    let inView = false;
    let disposed = false;
    let last = 0;
    let clock = 0;
    let over = false;
    let tx = 0;
    let ty = 0;
    let mx = 0;
    let my = 0;
    let hover = 0;
    /** 0 to 1: progress of the arrival since the figure first came into view */
    let seen = 0;
    let arrived = false;

    /** Any CSS colour, through the canvas's own parser, as numbers. */
    const parse = (value: string): Colour | null => {
      if (!value) return null;
      ctx.fillStyle = "rgba(1,2,3,0.004)";
      const before = ctx.fillStyle;
      ctx.fillStyle = value;
      const s = String(ctx.fillStyle);
      if (s === before && value.replace(/\s/g, "") !== "rgba(1,2,3,0.004)") return null;
      if (s[0] === "#") return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
      const m = s.match(/-?[\d.]+(?:e-?\d+)?/g);
      if (!m || m.length < 3) return null;
      const k = s.startsWith("color(") ? 255 : 1;
      return [Math.round(Number(m[0]) * k), Math.round(Number(m[1]) * k), Math.round(Number(m[2]) * k), m.length > 3 ? Number(m[3]) : 1];
    };
    const readPalette = (): Palette => {
      const cs = getComputedStyle(canvas);
      const text = parse(cs.color) ?? [128, 128, 128, 1];
      const v = (name: string, fallback: Colour) => parse(cs.getPropertyValue(name).trim()) ?? fallback;
      const ink = v("--ink", text);
      const accent = v("--accent", v("--brand", ink));
      return {
        ink,
        ink2: v("--ink-2", ink),
        ink3: v("--ink-3", ink),
        line: v("--line", [ink[0], ink[1], ink[2], 0.11]),
        accent,
        gold: v("--prestige", ink),
        teal: v("--teal", accent),
        emerald: v("--emerald", accent),
        surface: v("--surface", [255, 255, 255, 1]),
        font: cs.fontFamily || "system-ui, sans-serif",
      };
    };
    let pal = readPalette();

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!over) {
        tx = mx = w / 2;
        ty = my = h / 2;
      }
    };

    const paint = (t: number, dt: number, still: boolean) => {
      ctx.clearRect(0, 0, w, h);
      // hidden (below lg) or not yet laid out: there is nothing to draw on, and a figure's geometry would go negative
      if (w < 24 || h < 24) return;
      ctx.save();
      try {
        drawRef.current({ ctx, w, h, t, dt, hover, mx, my, pal, still, enter: still ? 1 : smooth(seen) });
      } finally {
        ctx.restore();
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (disposed) return;
      if (isStill()) {
        hover = over ? 1 : 0;
        mx = tx;
        my = ty;
        paint(STILL_T, 0, true);
        return;
      }
      if (!inView || document.hidden) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      // the clock runs a little faster under the pointer, as the page instruments do
      clock += dt * (1 + hover * 0.6);
      if (arrived && seen < 1) seen = Math.min(1, seen + dt / 0.9);
      const k = 1 - Math.exp(-dt * 7);
      hover += ((over ? 1 : 0) - hover) * k;
      mx += (tx - mx) * k;
      my += (ty - my) * k;
      paint(clock, dt, false);
      raf = requestAnimationFrame(frame);
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
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      // the first time it scrolls into view the figure arrives: the wrapper fades and lifts in (CSS below)
      if (inView && !arrived) {
        arrived = true;
        canvas.parentElement?.setAttribute("data-arrived", "");
      }
      if (inView) start();
    });
    io.observe(canvas);

    const onVis = () => {
      if (!document.hidden) start();
    };
    const onPrefs = () => {
      // theme, accent or motion changed: re-read the tokens on the next frame
      requestAnimationFrame(() => {
        if (disposed) return;
        pal = readPalette();
        start();
      });
    };
    const onMove = (e: PointerEvent) => {
      // a finger cannot hover, and its last position must not leave the figure lit
      if (e.pointerType === "touch") return;
      const r = canvas.getBoundingClientRect();
      over = true;
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      start();
    };
    const onLeave = () => {
      over = false;
      tx = w / 2;
      ty = h / 2;
      start();
    };

    resize();
    start();
    void document.fonts?.ready.then(start);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("gx:prefs", onPrefs);
    canvas.addEventListener("pointermove", onMove, { passive: true });
    canvas.addEventListener("pointerleave", onLeave, { passive: true });
    reduced.addEventListener("change", onPrefs);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("gx:prefs", onPrefs);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      reduced.removeEventListener("change", onPrefs);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={`relative w-full translate-y-[8px] select-none opacity-0 transition-[opacity,transform] duration-700 ease-out data-[arrived]:translate-y-0 data-[arrived]:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${className}`}
      style={{ aspectRatio: String(ratio) }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

/**
 * A figure with its caption, for a section's short column. The caption is the
 * "related text": one or two plain sentences that add to the section, never
 * a description of the drawing. Hidden below lg, where the columns stack and
 * there is no empty space to fill, unless `always` is set.
 */
export function FigureNote({
  children,
  figure,
  label,
  always = false,
  className = "",
}: {
  children: React.ReactNode;
  figure: React.ReactNode;
  /** a short small-caps label above the text */
  label?: string;
  always?: boolean;
  className?: string;
}) {
  return (
    <aside className={`${always ? "" : "hidden lg:block"} mt-34 max-w-[28rem] ${className}`}>
      <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">{figure}</div>
      {label ? <p className="eyebrow mt-13">{label}</p> : null}
      <p className={`${label ? "mt-5" : "mt-13"} text-sm leading-relaxed text-ink-3`}>{children}</p>
    </aside>
  );
}
