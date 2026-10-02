"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { refClass } from "@/lib/pulse";
import { sendView } from "@/lib/pulse-client";

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * Counts a page view: one request to this site's own /api/pulse per page,
 * sent once the page is idle, carrying the path and one word for where the
 * visitor came from. No cookie, no identifier, nothing written to the
 * browser; nothing sent when the visitor has asked not to be counted
 * (src/lib/pulse-client.ts). Rendered by the public shell only: the staff
 * console never mounts it.
 *
 * It draws nothing.
 */
export function Pulse() {
  const pathname = usePathname();
  // false until the first view has been sent: only that one can have come from outside the site
  const sent = useRef(false);

  useEffect(() => {
    if (!pathname) return;
    const w = window as IdleWindow;
    let cancelled = false;
    const send = () => {
      if (cancelled) return;
      const ref = sent.current ? "internal" : refClass(document.referrer, window.location.host);
      sent.current = true;
      sendView(pathname, ref);
    };
    // after the page has settled, so counting never competes with rendering
    const idle = w.requestIdleCallback ? w.requestIdleCallback(send, { timeout: 4000 }) : null;
    const timer = idle === null ? window.setTimeout(send, 1200) : null;
    return () => {
      // a page left before it settled (or React's development double-run) is not counted twice
      cancelled = true;
      if (idle !== null) w.cancelIdleCallback?.(idle);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
