"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePrefs } from "@/hooks/usePrefs";
import { ACCENTS, resetLocal, type Prefs } from "@/lib/prefs";

const THEMES: { key: Prefs["theme"]; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "auto", label: "Auto" },
];

const SWATCH: Record<Prefs["accent"], [string, string]> = {
  gio4x: ["#0870b8", "#089040"],
  ivory: ["#b39c6b", "#f6f4ee"],
  midnight: ["#1e3a5c", "#a0a8a8"],
  ocean: ["#0b6a7e", "#0870b8"],
  emerald: ["#0a6a3a", "#b39c6b"],
  royal: ["#3b3f8f", "#b39c6b"],
  mono: ["#14191d", "#a0a8a8"],
};

/** The appearance controls themselves; used in the header popover and on /preferences. */
export function AppearanceControls({ compact = false }: { compact?: boolean }) {
  const [prefs, update] = usePrefs();
  return (
    <div className="grid gap-21">
      <fieldset>
        <legend className="label">Appearance</legend>
        <div className="seg mt-8" role="group">
          {THEMES.map((t) => (
            <button key={t.key} type="button" aria-pressed={prefs.theme === t.key} onClick={() => update({ theme: t.key })}>
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Accent</legend>
        <div className="mt-8 flex flex-wrap gap-8">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-pressed={prefs.accent === a.key}
              onClick={() => update({ accent: a.key })}
              title={a.note}
              className={`group flex items-center gap-8 rounded-sm border px-8 py-5 text-xs font-medium transition-colors duration-fast ${
                prefs.accent === a.key ? "border-ink text-ink" : "border-line text-ink-2 hover:border-line-strong"
              }`}
            >
              <span
                aria-hidden
                className="h-[13px] w-[13px] rounded-full border border-line"
                style={{ background: `linear-gradient(135deg, ${SWATCH[a.key][0]} 0 61.8%, ${SWATCH[a.key][1]} 61.8% 100%)` }}
              />
              {a.label}
            </button>
          ))}
        </div>
      </fieldset>

      {!compact && (
        <fieldset>
          <legend className="label">Density</legend>
          <div className="seg mt-8" role="group">
            {(["relaxed", "standard", "pro"] as const).map((d) => (
              <button key={d} type="button" aria-pressed={prefs.density === d} onClick={() => update({ density: d })}>
                {d}
              </button>
            ))}
          </div>
          <p className="field-hint mt-8">Changes row height in data tables.</p>
        </fieldset>
      )}

      <fieldset>
        <legend className="label">Comfort</legend>
        <div className="mt-8 grid gap-8">
          <Toggle label="Reduce motion" on={prefs.motion === "reduced"} onChange={(v) => update({ motion: v ? "reduced" : "full" })} />
          <Toggle label="Higher contrast" on={prefs.contrast === "high"} onChange={(v) => update({ contrast: v ? "high" : "default" })} />
          <Toggle label="Larger text" on={prefs.text === "large"} onChange={(v) => update({ text: v ? "large" : "default" })} />
          {!compact && (
            <>
              <Toggle label="Low visual effects" hint="Turns off glass, canvas scenes and background animation." on={prefs.effects === "low"} onChange={(v) => update({ effects: v ? "low" : "full" })} />
              <Toggle label="Underline links" on={prefs.links === "underline"} onChange={(v) => update({ links: v ? "underline" : "default" })} />
            </>
          )}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-13 border-t border-line pt-13">
        <button type="button" className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-2 hover:text-ink" onClick={() => resetLocal()}>
          Reset to GIO4X default
        </button>
        {compact && (
          <Link href="/preferences" className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">
            All preferences
          </Link>
        )}
      </div>
    </div>
  );
}

export function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-21">
      <label htmlFor={id} className="cursor-pointer text-sm text-ink-2">
        {label}
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative mt-2 h-[21px] w-[34px] shrink-0 rounded-full border transition-colors duration-fast ${on ? "border-accent bg-accent" : "border-line-strong bg-transparent"}`}
      >
        <span
          aria-hidden
          className={`absolute left-0 top-[3px] h-[13px] w-[13px] rounded-full transition-transform duration-[260ms] ${on ? "translate-x-[16px] bg-[var(--accent-ink)]" : "translate-x-[3px] bg-ink-3"}`}
        />
      </button>
    </div>
  );
}

/** Header button + popover. */
export function AppearanceButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={btn}
        type="button"
        className="btn btn-quiet h-[2.125rem] px-8"
        aria-label="Display settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.25" />
          <path d="M8 2.4a5.6 5.6 0 0 1 0 11.2Z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Display settings"
          className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(21rem,calc(100vw-2.6rem))] rounded-md border border-line-strong bg-paper p-21 shadow-3"
          style={{ animation: "gx-rise 260ms var(--ease-out)" }}
        >
          <AppearanceControls compact />
        </div>
      )}
    </div>
  );
}
