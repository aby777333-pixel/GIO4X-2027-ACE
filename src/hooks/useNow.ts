"use client";

import { useEffect, useState } from "react";

/**
 * The current time, or null until the component has mounted.
 * Time-dependent UI renders a neutral state on the server and the real state
 * on the client, so there is never a hydration mismatch or a stale
 * server-rendered clock presented as live.
 */
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    let id: number | undefined;
    const tick = () => setNow(new Date());
    const start = () => {
      if (id === undefined) id = window.setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (id !== undefined) {
        window.clearInterval(id);
        id = undefined;
      }
    };
    const onVis = () => {
      if (document.hidden) stop();
      else {
        tick();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);
  return now;
}
