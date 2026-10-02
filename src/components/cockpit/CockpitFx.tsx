"use client";

import { useEffect } from "react";
import { activeRegion } from "@/lib/sessions";

/**
 * The cockpit's key light. Renders nothing.
 *
 * The region carrying the trading day (Asia, Europe or the Americas, from the
 * visitor's clock and the regular timetable in lib/sessions) is written to
 * <html data-session>. The stage, the header switches and every scene take
 * their key light from it. It is a schedule, not a data feed, and nothing on
 * screen claims otherwise.
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
    };
    setSession();
    const clock = window.setInterval(setSession, 60_000);

    return () => window.clearInterval(clock);
  }, []);

  return null;
}
