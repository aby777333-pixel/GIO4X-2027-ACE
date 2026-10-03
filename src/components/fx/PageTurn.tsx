"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * THE CUT — a short wipe when the visitor moves from one page to another: a
 * bright edge crosses the screen once, with a thin veil behind it, the way one
 * shot is cut to the next.
 *
 * It plays after the new page is already on screen, so it never delays a
 * page, and it sits above the page without taking the pointer. It is absent
 * on the first page of a visit, when only the part of the address after "#"
 * changes, under reduced motion and under low visual effects (styles/fx.css).
 * It carries no meaning and is hidden from assistive technology.
 */
export function PageTurn() {
  const pathname = usePathname();
  const first = useRef(true);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setRun((n) => n + 1);
  }, [pathname]);

  if (run === 0) return null;
  // a new key each time restarts the animation from its first frame
  return <div key={run} className="gx-cut no-print" aria-hidden />;
}
