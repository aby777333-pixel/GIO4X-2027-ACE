"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The golden grid: a toggleable overlay that draws the page's own proportions
 * over the page. The composition bound, the 61.8 / 38.2 split in both
 * directions and the 55px coordinate field. Press G (outside a text field) or
 * use the button. Purely decorative: hidden from assistive technology.
 */
export function GoldenGrid() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === "g") setOn((v) => !v);
      if (e.key === "Escape") setOn(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button type="button" className="btn btn-ghost" aria-pressed={on} onClick={() => setOn((v) => !v)}>
        <svg width="16" height="10" viewBox="0 0 16.18 10" fill="none" aria-hidden>
          <rect x="0.5" y="0.5" width="15.18" height="9" stroke="currentColor" />
          <path d="M10 0.5v9" stroke="currentColor" />
        </svg>
        {on ? "Hide the golden grid" : "Show the golden grid"}
      </button>
      <span className="hidden text-xs text-ink-3 lg:inline">
        or press <kbd className="font-sans font-semibold text-ink-2">G</kbd>
      </span>

      {on && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-overlay" style={{ animation: "gx-fade 420ms var(--ease-out)" }}>
          {/* horizontal golden sections of the viewport */}
          <div className="absolute inset-x-0 top-[38.2%] border-t border-dashed border-prestige opacity-70" />
          <div className="absolute inset-x-0 top-[61.8%] border-t border-dashed border-prestige opacity-70" />
          <div className="wrap relative h-full">
            <div className="grid-field relative h-full border-x border-prestige">
              {/* 61.8 | 38.2 and its mirror */}
              <div className="absolute inset-y-0 left-[61.8%] border-l border-prestige" />
              <div className="absolute inset-y-0 left-[38.2%] border-l border-dashed border-prestige opacity-70" />
              {/* the next subdivision: 38.2% of 61.8% */}
              <div className="absolute inset-y-0 left-[23.6%] hidden border-l border-dotted border-prestige opacity-50 md:block" />
              <div className="absolute inset-y-0 left-[76.4%] hidden border-l border-dotted border-prestige opacity-50 md:block" />
              <div className="absolute inset-x-0 top-[calc(var(--header-h)+0.5rem)] flex text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-prestige-ink">
                <span className="w-[61.8%] px-8">
                  <span className="glass rounded-xs px-5 py-2">61.8</span>
                </span>
                <span className="px-8">
                  <span className="glass rounded-xs px-5 py-2">38.2</span>
                </span>
              </div>
              <div className="absolute bottom-13 right-8">
                <span className="glass num rounded-xs px-8 py-3 text-xs text-prestige-ink">φ = 1.6180339887…</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function normalise(v: string): string {
  const s = v.trim();
  return /^#[0-9a-f]{3,8}$/i.test(s) ? s.toUpperCase() : s;
}

/**
 * A swatch painted with a CSS variable and labelled with that variable's
 * current value, read from the page. Switch theme or accent and the label
 * follows, so the page documents itself rather than a copy of itself.
 */
export function TokenSwatch({ token, name, role, raw, tall = false }: { token: string; name: string; role: string; raw?: string; tall?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      if (ref.current) setValue(normalise(getComputedStyle(ref.current).getPropertyValue(token)));
    };
    read();
    window.addEventListener("gx:prefs", read);
    return () => window.removeEventListener("gx:prefs", read);
  }, [token]);

  return (
    <div ref={ref}>
      <div className={`${tall ? "aspect-phi-tall max-h-[13rem] w-full" : "h-55"} rounded-xs border border-line`} style={{ background: `var(${token})` }} />
      <p className="mt-8 text-sm font-medium text-ink">{name}</p>
      <p className="text-xs text-ink-3">{role}</p>
      <p className="num mt-3 text-xs text-ink-2">
        <code className="font-mono">{token}</code>
        <span className="block" aria-live="off">
          {value ?? "…"}
          {raw && value && raw.toUpperCase() !== value ? <span className="text-ink-3"> · logo {raw.toUpperCase()}</span> : null}
        </span>
      </p>
    </div>
  );
}
