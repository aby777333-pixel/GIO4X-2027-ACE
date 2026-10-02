"use client";

import { useEffect } from "react";
import { activeRegion } from "@/lib/sessions";

const TILE = ":is(.tiles, .gap-px.bg-line, .gap-px.bg-night-line):not(.flat) > *, .grid.border-l.border-t:not(.flat) > .border-b.border-r";

/**
 * The cockpit's two pieces of shared behaviour. Renders nothing.
 *
 *  1. Key light. The region carrying the trading day (Asia, Europe or the
 *     Americas, from the visitor's clock and the regular timetable in
 *     lib/sessions) is written to <html data-session>. The stage, the header
 *     switches and every scene take their key light from it. It is a schedule,
 *     not a data feed, and nothing on screen claims otherwise.
 *
 *  2. Pointer light. The tile under the pointer is told where the pointer is,
 *     so its highlight and its few degrees of tilt can follow (see cockpit.css).
 *     One passive listener for the whole page; mouse and pen only; off under
 *     reduced motion or low visual effects.
 *
 * Sound: deliberately none. Controls are ordinary buttons and links, so an
 * opt-in sound layer could later listen for `pointerdown` on `.btn`,
 * `[data-nav]` and `[role="switch"]` here. It must stay off unless a visitor
 * turns it on: nothing on this site plays audio by itself.
 */
export function CockpitFx() {
  useEffect(() => {
    const root = document.documentElement;

    const setSession = () => {
      const next = activeRegion(new Date()) ?? "off";
      if (root.dataset.session !== next) {
        root.dataset.session = next;
        window.dispatchEvent(new Event("gx:session"));
      }
    };
    setSession();
    const clock = window.setInterval(setSession, 60_000);

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const calm = () => reduced.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";
    if (fine.matches) root.dataset.cxTilt = "";

    let raf = 0;
    let lit: HTMLElement | null = null;
    let x = 0;
    let y = 0;
    const paint = () => {
      raf = 0;
      if (!lit) return;
      const r = lit.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const mx = Math.min(1, Math.max(0, (x - r.left) / r.width));
      const my = Math.min(1, Math.max(0, (y - r.top) / r.height));
      lit.style.setProperty("--mx", mx.toFixed(3));
      lit.style.setProperty("--my", my.toFixed(3));
      lit.style.setProperty("--tx", (mx * 2 - 1).toFixed(3));
      lit.style.setProperty("--ty", (my * 2 - 1).toFixed(3));
    };
    const clear = (el: HTMLElement) => {
      for (const p of ["--mx", "--my", "--tx", "--ty"]) el.style.removeProperty(p);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !fine.matches || calm()) return;
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>(TILE) : null;
      if (el !== lit) {
        if (lit) clear(lit);
        lit = el;
      }
      if (!lit) return;
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    document.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      window.clearInterval(clock);
      cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove);
      if (lit) clear(lit);
      delete root.dataset.cxTilt;
    };
  }, []);

  return null;
}
