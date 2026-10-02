"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readPalette, type EarthPalette } from "./earth";

/**
 * The canvas a globe is drawn on, for the market-day film and the map of GIO4X.
 *
 * It keeps the rules of the shared figure host (components/figures/Figure):
 * colours read from the design tokens, the pixel ratio capped at 2, one
 * composed frame under reduced motion or "low visual effects". It differs in
 * one respect, which is why it is its own hook: the picture is driven from
 * outside (a scrubber, a drag, a choice from a list), so it paints on request,
 * and it keeps painting only for as long as the painter says something is
 * still moving.
 */
export type GlobeFrame = {
  ctx: CanvasRenderingContext2D;
  /** drawing size in CSS pixels */
  w: number;
  h: number;
  /** seconds since the last frame; 0 on the first frame of a run and in a still frame */
  dt: number;
  pal: EarthPalette;
  /** true under reduced motion: draw the settled picture, with nothing in transit */
  still: boolean;
};

/** Paint one frame. Return true to be called again on the next frame. */
export type GlobePaint = (f: GlobeFrame) => boolean | void;

const motionIsReduced = () => {
  const root = document.documentElement;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";
};

/** True when motion is reduced, by the system or by the site's own switches. False until mounted. */
export function useStillMotion(): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // the site applies a changed preference to <html> just after it announces it
    const read = () => requestAnimationFrame(() => setStill(motionIsReduced()));
    setStill(motionIsReduced());
    mq.addEventListener("change", read);
    window.addEventListener("gx:prefs", read);
    return () => {
      mq.removeEventListener("change", read);
      window.removeEventListener("gx:prefs", read);
    };
  }, []);
  return still;
}

export function useGlobeCanvas(paint: GlobePaint): { ref: React.RefObject<HTMLCanvasElement | null>; request: () => void } {
  const ref = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let w = 1;
    let h = 1;
    let raf = 0;
    let last = 0;
    let disposed = false;
    let pal = readPalette(canvas, ctx);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = (now: number) => {
      raf = 0;
      if (disposed) return;
      const still = motionIsReduced();
      const dt = still || !last ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      ctx.clearRect(0, 0, w, h);
      let more = false;
      // not yet laid out: there is nothing to draw on, and the geometry would go negative
      if (w >= 48 && h >= 48) {
        ctx.save();
        try {
          more = paintRef.current({ ctx, w, h, dt, pal, still }) === true;
        } finally {
          ctx.restore();
        }
      }
      if (more && !still && !document.hidden) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const start = () => {
      if (disposed || raf) return;
      raf = requestAnimationFrame(frame);
    };
    kick.current = start;

    const ro = new ResizeObserver(() => {
      resize();
      start();
    });
    ro.observe(canvas);
    const onPrefs = () => {
      // theme, accent or motion changed: re-read the tokens on the next frame
      requestAnimationFrame(() => {
        if (disposed) return;
        pal = readPalette(canvas, ctx);
        start();
      });
    };
    const onVis = () => {
      if (!document.hidden) start();
    };

    resize();
    start();
    void document.fonts?.ready.then(start);
    window.addEventListener("gx:prefs", onPrefs);
    document.addEventListener("visibilitychange", onVis);
    mq.addEventListener("change", onPrefs);

    return () => {
      disposed = true;
      kick.current = () => {};
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("gx:prefs", onPrefs);
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onPrefs);
    };
  }, []);

  const request = useCallback(() => kick.current(), []);
  return { ref, request };
}
