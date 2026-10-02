"use client";

import { useEffect, useRef } from "react";
import { STILL_T, type Colour } from "@/components/figures/Figure";
import { createScene, type ScenePalette, type SceneTarget } from "./scene";

/**
 * The canvas the Trade Anatomy scene is drawn on.
 *
 * It keeps the same rules as the shared figure host (components/figures/Figure):
 * colours read from the design tokens, the pixel ratio capped at 2, nothing
 * drawn while off-screen or in a hidden tab, and one composed still frame under
 * reduced motion or "low visual effects". It differs in one respect, which is
 * why it is its own component: the scene is driven from outside (the stage and
 * the branches chosen), so a change of target must repaint the still frame.
 *
 * The canvas is decorative. Everything it shows is said in the text beside it.
 */
export function TradeCanvas({ target, className = "" }: { target: SceneTarget; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(target);
  targetRef.current = target;
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isStill = () => reduced.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";
    const draw = createScene();

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
    const readPalette = (): ScenePalette => {
      const cs = getComputedStyle(canvas);
      const text = parse(cs.color) ?? [128, 128, 128, 1];
      const v = (name: string, fallback: Colour) => parse(cs.getPropertyValue(name).trim()) ?? fallback;
      const ink = v("--ink", text);
      const accent = v("--accent", v("--brand", ink));
      const emerald = v("--emerald", accent);
      return {
        ink,
        ink2: v("--ink-2", ink),
        ink3: v("--ink-3", ink),
        line: v("--line", [ink[0], ink[1], ink[2], 0.11]),
        accent,
        gold: v("--prestige", ink),
        teal: v("--teal", accent),
        emerald,
        surface: v("--surface", [255, 255, 255, 1]),
        pos: v("--pos", emerald),
        neg: v("--neg", ink),
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
      if (w < 24 || h < 24) return;
      ctx.save();
      try {
        draw({ ctx, w, h, t, dt, hover, mx, my, pal, still }, targetRef.current);
      } finally {
        ctx.restore();
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (disposed) return;
      if (isStill()) {
        // one settled picture of the stage in view: no flight, no pointer, nothing moving
        hover = 0;
        mx = w / 2;
        my = h / 2;
        paint(STILL_T, 0, true);
        return;
      }
      if (!inView || document.hidden) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      clock += dt;
      const k = 1 - Math.exp(-dt * 6);
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
    kick.current = start;

    const ro = new ResizeObserver(() => {
      resize();
      start();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
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
      // a finger cannot hover, and its last position must not leave the view turned
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
      kick.current = () => {};
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

  // a new stage or branch: wake the loop, or repaint the still frame
  useEffect(() => {
    kick.current();
  }, [target.seq]);

  return (
    <div aria-hidden className={`relative w-full select-none ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
