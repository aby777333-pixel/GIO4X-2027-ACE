"use client";

import { useEffect, useState } from "react";
import { useFooterLift } from "@/components/shell/ChatWidget";

/**
 * Two small buttons at the right edge: up to the top of the page, down to the
 * end. Each is offered only when there is somewhere to go: "up" once the page
 * has been scrolled, "down" until the end is in view, and neither on a page
 * that fits the window.
 *
 * They sit above the corner the chat launcher uses, one layer below it, so an
 * open chat window covers them instead of competing with them.
 */

/** how far from either end counts as "there" */
const EDGE = 240;

export function ScrollArrows() {
  const [up, setUp] = useState(false);
  const [down, setDown] = useState(false);
  // the chat button rises clear of the footer's last line on wide screens: rise with it
  const lift = useFooterLift();

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      // a page shorter than about a window and a half needs neither
      const worth = max > window.innerHeight * 0.5;
      setUp(worth && y > EDGE);
      setDown(worth && y < max - EDGE);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue, { passive: true });
    // pages grow after load (images, client lists): measure again when the body does
    const ro = new ResizeObserver(queue);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      ro.disconnect();
    };
  }, []);

  const go = (top: number) => {
    const root = document.documentElement;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduced";
    window.scrollTo({ top, behavior: still ? "auto" : "smooth" });
  };

  if (!up && !down) return null;

  const button =
    "flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-[8px] border border-line-strong bg-surface text-ink shadow-2 transition-[opacity,transform,background-color] duration-200 hover:bg-surface-2 hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:pointer-events-none disabled:opacity-0";

  return (
    <div
      style={lift ? { marginBottom: lift } : undefined}
      className="no-print fixed bottom-[calc(max(0.8125rem,env(safe-area-inset-bottom))+3.4375rem)] right-[max(0.8125rem,env(safe-area-inset-right))] z-[38] flex flex-col gap-5 sm:bottom-[calc(max(1.3125rem,env(safe-area-inset-bottom))+3.4375rem)] sm:right-[max(1.3125rem,env(safe-area-inset-right))]"
    >
      <button type="button" className={button} disabled={!up} aria-hidden={!up} tabIndex={up ? 0 : -1} aria-label="Go to the top of the page" title="Top of page" onClick={() => go(0)}>
        <Arrow dir="up" />
      </button>
      <button
        type="button"
        className={button}
        disabled={!down}
        aria-hidden={!down}
        tabIndex={down ? 0 : -1}
        aria-label="Go to the end of the page"
        title="End of page"
        onClick={() => go(document.documentElement.scrollHeight)}
      >
        <Arrow dir="down" />
      </button>
    </div>
  );
}

function Arrow({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className={dir === "down" ? "rotate-180" : undefined}>
      <path d="M9 14.5v-11M4 8.2l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
