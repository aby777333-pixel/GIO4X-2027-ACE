"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Swipe between tools on a touch screen: left for the next tool, right for the
 * previous one. It is a second way to do what the visible "Previous" and
 * "Next" links (ToolPager) already do; a keyboard, a mouse and a screen reader
 * use those links and never need the gesture.
 *
 * It is deliberately hard to trigger by accident. A swipe counts only if it:
 *   - is one finger, starting away from the screen edges (those belong to the
 *     browser's own back and forward gestures);
 *   - does not start in a field, a slider, a drawing, or anything that scrolls
 *     sideways or handles touch itself (tables in .scroll-x, range inputs,
 *     draggable figures);
 *   - travels at least 72px, more than twice as far across as up or down, and
 *     is finished within 0.7 s;
 *   - leaves no text selected.
 * Listeners are passive: vertical scrolling is never delayed or prevented.
 */
const MIN_DISTANCE = 72;
const MAX_MS = 700;
const EDGE = 24;
/** more vertical travel than this at any moment and the touch is a scroll */
const MAX_DRIFT = 34;

/** Elements whose own horizontal gestures must be left alone. */
const OWN_GESTURE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="slider"], canvas, svg, [draggable="true"], [data-no-swipe]';

function ownsHorizontal(start: Element, root: Element): boolean {
  if (start.closest(OWN_GESTURE)) return true;
  for (let el: Element | null = start; el && el !== root; el = el.parentElement) {
    const cs = window.getComputedStyle(el);
    // it scrolls sideways
    if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
    // it has claimed touch for itself (a draggable figure sets touch-action: none or pan-x)
    const ta = cs.touchAction;
    if (ta && ta !== "auto" && ta !== "manipulation" && !ta.includes("pan-y")) return true;
  }
  return false;
}

export function SwipeNav({ prev, next, children }: { prev: string | null; next: string | null; children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || (!prev && !next)) return;
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
      if (!(e.target instanceof Element) || ownsHorizontal(e.target, root)) return;
      start = { x: t.clientX, y: t.clientY, t: e.timeStamp };
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      // a second finger, or a movement that is plainly a scroll: not a swipe
      if (e.touches.length !== 1 || Math.abs(e.touches[0].clientY - start.y) > MAX_DRIFT) start = null;
    };
    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (e.timeStamp - s.t > MAX_MS || Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 2) return;
      if ((window.getSelection()?.toString() ?? "") !== "") return;
      const to = dx < 0 ? next : prev;
      if (to) router.push(to);
    };
    const onCancel = () => {
      start = null;
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: true });
    root.addEventListener("touchend", onEnd, { passive: true });
    root.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onCancel);
    };
  }, [prev, next, router]);

  // display: contents, so the wrapper adds no box of its own: the page's sections lay out exactly as before, and touches still bubble to it
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
