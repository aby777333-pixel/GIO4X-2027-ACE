"use client";

import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { applyLook, LOOK_EVENT, LOOK_KEY, LOOK_PALETTES, parseLook, readLookRaw, writeLook, type LookPalette, type LookTheme } from "@/components/control/look";

function subscribe(onChange: () => void): () => void {
  // another tab changing the look arrives as a storage event; this tab's own change as LOOK_EVENT
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === LOOK_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOOK_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOOK_EVENT, onChange);
  };
}

const serverSnapshot = () => "";

const MODES: { key: LookTheme; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

function ModeIcon({ mode }: { mode: LookTheme }) {
  return (
    <svg aria-hidden width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {mode === "light" ? (
        <>
          <circle cx="8" cy="8" r="2.75" />
          <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.05 1.05M11.55 11.55l1.05 1.05M3.4 12.6l1.05-1.05M11.55 4.45l1.05-1.05" />
        </>
      ) : (
        <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z" />
      )}
    </svg>
  );
}

/**
 * The console's look switcher: light or dark, and a row of palette swatches.
 * Every control is a real button that says whether it is the one in use
 * (`aria-pressed`), is named in words (its label, and the name printed beside
 * the swatches, which follows the pointer and the keyboard focus), and works
 * from the keyboard. The choice is remembered in this browser only.
 *
 * `variant="side"` sits on the sidebar's colour (the sidebar's foot and the
 * phone menu); `variant="page"` sits on the page (the sign-in page).
 */
export function LookSwitch({ variant = "side" }: { variant?: "side" | "page" }) {
  // the stored string is the snapshot: stable between changes, and "" on the server and before hydration
  const raw = useSyncExternalStore(subscribe, readLookRaw, serverSnapshot);
  const look = parseLook(raw);
  const { theme, palette } = look;
  const [hint, setHint] = useState<LookPalette | null>(null);

  // The boot script has already done this on a full page load. After a move
  // within the app (sign-in to the console, for one) the root is new and no
  // inline script has run: put the look on it before the browser paints.
  // It is read from storage here, not taken from this render: the first render
  // after a page load deliberately shows the default (to match the server),
  // and applying that would undo the boot script for a frame.
  useLayoutEffect(() => {
    applyLook(parseLook(readLookRaw()));
  }, [theme, palette]);

  const hinted = hint ? LOOK_PALETTES.find((p) => p.key === hint) : undefined;

  return (
    <div className={`gxc-look ${variant === "page" ? "gxc-look--page" : ""}`} role="group" aria-label="Appearance of the console">
      <div className="gxc-look-row">
        <span className="gxc-look-label" aria-hidden>
          Appearance
        </span>
        <div className="gxc-look-modes" role="group" aria-label="Light or dark">
          {MODES.map((m) => (
            <button key={m.key} type="button" className="gxc-look-mode" data-mode={m.key} aria-pressed={theme === m.key} aria-label={`${m.label} mode`} title={`${m.label} mode`} onClick={() => writeLook({ theme: m.key, palette })}>
              <ModeIcon mode={m.key} />
              <span className="gxc-look-mode-text">{m.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="gxc-look-row">
        <div className="gxc-look-swatches" role="group" aria-label="Colour palette">
          {LOOK_PALETTES.map((p) => (
            <button
              key={p.key}
              type="button"
              className="gxc-look-swatch"
              data-swatch={p.key}
              aria-pressed={palette === p.key}
              aria-label={`${p.label} palette`}
              title={`${p.label} palette`}
              onClick={() => writeLook({ theme, palette: p.key })}
              onMouseEnter={() => setHint(p.key)}
              onMouseLeave={() => setHint(null)}
              onFocus={() => setHint(p.key)}
              onBlur={() => setHint(null)}
            />
          ))}
        </div>
        {/* The name of the palette under the pointer or the focus, else of the one in use. Printed by the
            stylesheet from the root's attribute (console.css), so it is right before this script has started;
            the buttons carry the same words for a screen reader. */}
        <span className="gxc-look-name" aria-hidden data-hint={hinted?.label} />
      </div>
    </div>
  );
}
