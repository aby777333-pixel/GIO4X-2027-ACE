"use client";

import { useEffect } from "react";
import { sunTheme, type SunPrefs } from "@/components/fx/sun";
import { customAccentVars, PAGE_BG, setAccentVars } from "@/lib/accent";
import { readPrefs } from "@/lib/prefs";

/**
 * Keeps "Follow the sun" true while the page is open. Renders nothing.
 *
 * The choice is made before first paint by the inline script (fx/sun.ts). This
 * component applies it again whenever the preferences are written (applyPrefs
 * puts the Light / Dark / Auto value back on <html>, and this listener runs in
 * the same task, before the browser paints), and looks at the clock every
 * minute and when the tab comes back, so the theme turns at dusk and at dawn
 * without a reload. For a visitor who has not chosen "Sun" it does nothing.
 */
export function SunTheme() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      let prefs: SunPrefs;
      try {
        prefs = readPrefs();
      } catch {
        return;
      }
      if (prefs.sun !== true) return;
      const theme = sunTheme(new Date());
      const d = root.dataset;
      const turned = d.theme !== theme;
      d.themePref = "sun";
      if (!turned) return;
      d.theme = theme;
      // the two things applyPrefs derives from the theme
      if (prefs.accent === "custom") setAccentVars(root, customAccentVars(prefs.accentHue, prefs.accentHue2, theme));
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PAGE_BG[theme]);
      // the canvases read their palette again on this event; this listener hears it too and finds nothing left to turn
      window.dispatchEvent(new CustomEvent("gx:prefs", { detail: prefs }));
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === "gx:prefs" || e.key === null) apply();
    };
    const onVisible = () => {
      if (!document.hidden) apply();
    };

    apply();
    const clock = window.setInterval(() => {
      if (!document.hidden) apply();
    }, 60_000);
    window.addEventListener("gx:prefs", apply);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(clock);
      window.removeEventListener("gx:prefs", apply);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
