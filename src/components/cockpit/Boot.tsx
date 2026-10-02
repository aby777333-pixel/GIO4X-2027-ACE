"use client";

import { useEffect } from "react";

const SECTIONS = ["Markets", "Platforms", "Tools", "Intelligence"];

/**
 * THE START-UP — a short power-on, first visit only.
 *
 * The markup is always in the page and always hidden; the boot script (lib/boot) decides
 * before first paint whether this visit shows it. The sequence itself is CSS
 * (cockpit.css) and ends on its own in under two seconds, so it cannot hold
 * the site back: this component only lets a key, a click, a touch or the
 * wheel end it sooner, and clears the flag afterwards.
 *
 * The four lamps are the site's own sections coming up, not connection
 * claims: nothing here says a market feed is live.
 */
export function CockpitBoot() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.boot !== "run") return;
    const end = () => {
      delete root.dataset.boot;
    };
    const timer = window.setTimeout(end, 1800);
    const skip = () => {
      window.clearTimeout(timer);
      end();
    };
    const opts = { once: true, passive: true } as const;
    window.addEventListener("keydown", skip, opts);
    window.addEventListener("pointerdown", skip, opts);
    window.addEventListener("wheel", skip, opts);
    window.addEventListener("touchstart", skip, opts);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
    };
  }, []);

  return (
    <div className="cx-boot" aria-hidden>
      <div className="cx-boot-inner">
        <picture className="cx-boot-logo">
          <source srcSet="/brand/gio4x-logo.webp" type="image/webp" />
          <img src="/brand/gio4x-logo.png" alt="" width={177} height={55} decoding="async" style={{ height: 55, width: "auto" }} />
        </picture>
        <span className="cx-boot-rule" />
        <p className="cx-boot-lamps">
          {SECTIONS.map((s, i) => (
            <span key={s} style={{ ["--i" as string]: i }}>
              {s}
            </span>
          ))}
        </p>
        <p className="cx-boot-ready">System ready</p>
      </div>
    </div>
  );
}
