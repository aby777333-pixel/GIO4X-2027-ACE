"use client";

import { useEffect } from "react";
import { activeRegion, fxOverview } from "@/lib/sessions";

/** The atmosphere behind a page opening, from the conventional FX session windows on the visitor's clock. */
function atmosphere(now: Date): "tokyo" | "london" | "newyork" | "overlap" | "rest" | "closed" {
  const fx = fxOverview(now);
  if (!fx.weekOpen) return "closed";
  if (fx.open.length >= 2) return "overlap";
  const key = fx.open[0]?.key;
  // Sydney and Tokyo are one morning in this picture; between New York's close and Sydney's open the week is running and the room is quiet
  return key === "london" ? "london" : key === "new-york" ? "newyork" : key ? "tokyo" : "rest";
}

/**
 * The cockpit's key light. Renders nothing.
 *
 * The region carrying the trading day (Asia, Europe or the Americas, from the
 * visitor's clock and the regular timetable in lib/sessions) is written to
 * <html data-session>. The stage, the header switches and every scene take
 * their key light from it. It is a schedule, not a data feed, and nothing on
 * screen claims otherwise.
 *
 * The atmosphere: which conventional FX session window the same clock is in
 * (Tokyo, London, New York, an overlap of two, the quiet hour between, or the
 * closed weekend) is written to <html data-atmos>. styles/fx.css hangs a very
 * quiet drifting wash of light behind each page opening from it: a different
 * colour, direction and pace for each. It is decoration. It draws no number,
 * no shape that could be read as data, and no name: the session is named only
 * where the site already names it from the clock (the session figures and the
 * homepage timeline), never by this layer.
 *
 * The pointer light that used to be here (the tile under the pointer is told
 * where the pointer is, so its highlight and its few degrees of tilt can
 * follow: see cockpit.css) is now part of the site's one pointer layer,
 * components/shell/PointerLayer.tsx, with the cursor light and the magnetic
 * buttons. The variables and the `data-cx-tilt` attribute are unchanged.
 *
 * Sound: none here. Interface sounds are components/sound/SoundFx.tsx, and
 * stay off unless a visitor turns them on: nothing on this site plays audio
 * by itself.
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
      const atmos = atmosphere(new Date());
      if (root.dataset.atmos !== atmos) root.dataset.atmos = atmos;
    };
    setSession();
    const clock = window.setInterval(setSession, 60_000);

    return () => {
      window.clearInterval(clock);
      delete root.dataset.atmos;
    };
  }, []);

  return null;
}
