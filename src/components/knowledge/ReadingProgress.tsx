"use client";

import { useEffect, useRef } from "react";

/**
 * A two-pixel line at the top of the window showing how far through the
 * reading column the visitor is. Decorative: hidden from assistive technology
 * and from print, and it writes a CSS variable instead of re-rendering.
 */
export function ReadingProgress({ target }: { target: string }) {
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const span = Math.max(1, rect.height - window.innerHeight * 0.5);
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.25 - rect.top) / span));
      bar.current?.style.setProperty("--p", p.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [target]);

  return (
    <div className="read-progress no-print" aria-hidden>
      <span ref={bar} />
    </div>
  );
}
