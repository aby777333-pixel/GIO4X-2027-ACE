"use client";

import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { usePrefs } from "@/hooks/usePrefs";
import { ACCENT_INK, DEFAULT_ACCENT_HUE, NO_SECOND_HUE, PAGE_BG, contrast, customAccent, hueName, normHue, oklchHex, secondHue } from "@/lib/accent";
import { resolveTheme } from "@/lib/prefs";

/** The slider's track: the accent each hue would give, every 30 degrees, at the lightness the page uses. */
function track(theme: "light" | "dark"): string {
  const stops: string[] = [];
  for (let h = 0; h <= 360; h += 30) stops.push(`${theme === "dark" ? oklchHex(0.8, 0.11, h % 360) : oklchHex(0.47, 0.14, h % 360)} ${((h / 360) * 100).toFixed(2)}%`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function HueSlider({ label, hint, value, onChange, theme }: { label: string; hint?: string; value: number; onChange: (h: number) => void; theme: "light" | "dark" }) {
  const id = useId();
  const swatch = theme === "dark" ? oklchHex(0.8, 0.11, value) : oklchHex(0.47, 0.14, value);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="flex items-center gap-13">
        <span aria-hidden className="h-[21px] w-[21px] shrink-0 rounded-full border border-line-strong" style={{ background: swatch }} />
        {/* the thumb and the focus ring take the colour being chosen, not the one in use */}
        <div className="relative min-w-0 flex-1" style={{ "--accent": swatch } as CSSProperties}>
          {/* the colours along the slider are decoration: the degrees and the name beside it say the same in text */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full" style={{ background: track(theme) }} />
          <input
            id={id}
            type="range"
            className="range relative"
            min={0}
            max={359}
            step={1}
            value={value}
            onChange={(e) => onChange(normHue(Number(e.target.value), value))}
            aria-valuetext={`${value} degrees, ${hueName(value)}`}
            aria-describedby={hint ? `${id}-hint` : undefined}
          />
        </div>
        <output htmlFor={id} className="num w-[6.5rem] shrink-0 text-right text-sm text-ink">
          {value}° <span className="text-ink-3">{hueName(value)}</span>
        </output>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * The accent designer, on /preferences: the eighth accent, "Custom".
 *
 * The visitor moves a hue (and, if they wish, a second one for the supporting
 * colour); the preview follows the slider; nothing on the site changes until
 * "Save". What is kept is two numbers in `gx:prefs` (accentHue, accentHue2)
 * and `accent: "custom"`; the colours are worked out from them each time
 * (lib/accent.ts), at fixed lightness, so no hue can cost the text its
 * contrast.
 */
export function AccentDesigner() {
  const [prefs, update, ready] = usePrefs();
  const [hue, setHue] = useState<number>(DEFAULT_ACCENT_HUE);
  const [own2, setOwn2] = useState(false);
  const [hue2, setHue2] = useState<number>(secondHue(DEFAULT_ACCENT_HUE, NO_SECOND_HUE));
  const [said, setSaid] = useState("");
  const checkId = useId();

  // start from what is stored, once it has been read, and follow a reset made elsewhere on the page
  useEffect(() => {
    if (!ready) return;
    const h = normHue(prefs.accentHue, DEFAULT_ACCENT_HUE);
    setHue(h);
    setOwn2(typeof prefs.accentHue2 === "number" && prefs.accentHue2 >= 0);
    setHue2(secondHue(h, prefs.accentHue2));
  }, [ready, prefs.accentHue, prefs.accentHue2]);

  const theme = ready ? resolveTheme(prefs.theme) : "light";
  const second = own2 ? hue2 : NO_SECOND_HUE;
  const f = useMemo(() => customAccent(hue, second), [hue, second]);
  const dark = theme === "dark";

  // the page part of the preview takes the variables a built-in accent would give the page; the night parts take the night ones
  const pageVars = {
    "--accent": dark ? f.mood1 : f.accent,
    "--accent-ink": dark ? ACCENT_INK.dark : ACCENT_INK.light,
    "--accent-2": dark ? f.mood2 : f.accent2,
    "--accent-3": dark ? f.mood3 : f.accent3,
    "--brand": dark ? f.mood1 : f.accent,
    "--info": dark ? f.mood1 : f.accent,
    "--tone-1": dark ? f.mood1 : f.accent,
    "--tone-2": dark ? f.mood2 : f.accent2,
    "--tone-3": dark ? f.mood3 : f.accent3,
    "--grad-accent": `linear-gradient(135deg, ${dark ? f.mood1 : f.accent} 0%, ${dark ? f.mood2 : f.accent2} 100%)`,
    "--mood-1": f.mood1,
    "--mood-2": f.mood2,
    "--mood-3": f.mood3,
  } as CSSProperties;
  const nightVars = {
    "--accent": f.mood1,
    "--accent-ink": ACCENT_INK.dark,
    "--brand": f.mood1,
    "--tone-1": f.mood1,
    "--tone-2": f.mood2,
    "--tone-3": f.mood3,
    "--grad-accent": `linear-gradient(135deg, ${f.mood1} 0%, ${f.mood2} 100%)`,
    "--cx-key": f.mood1,
  } as CSSProperties;
  const stage = {
    background: `radial-gradient(58% 78% at 71% 46%, color-mix(in srgb, ${f.mood1} 15%, transparent), transparent 70%), radial-gradient(38% 58% at 97% 94%, color-mix(in srgb, ${f.mood2} 8%, transparent), transparent 70%), radial-gradient(46% 60% at 0% 0%, color-mix(in srgb, ${f.mood3} 7%, transparent), transparent 72%), linear-gradient(180deg, #090d12 0%, #0c1116 52%, #0e151b 100%)`,
  } as CSSProperties;

  const text = contrast(dark ? f.mood1 : f.accent, PAGE_BG[theme]);
  const label = contrast(dark ? ACCENT_INK.dark : ACCENT_INK.light, dark ? f.mood1 : f.accent);
  const saved = prefs.accent === "custom" && normHue(prefs.accentHue, DEFAULT_ACCENT_HUE) === hue && (own2 ? prefs.accentHue2 === hue2 : !(prefs.accentHue2 >= 0));

  const save = () => {
    update({ accent: "custom", accentHue: hue, accentHue2: second });
    setSaid(`Saved. Your accent, ${hue} degrees (${hueName(hue)}), is now used across the site on this device.`);
  };
  const reset = () => {
    update({ accent: "gio4x", accentHue: DEFAULT_ACCENT_HUE, accentHue2: NO_SECOND_HUE });
    setSaid("Back to GIO4X: market blue, teal and emerald.");
  };

  return (
    <fieldset id="accent-designer" className="scroll-mt-[calc(var(--header-h)+1.3125rem)]">
      <legend className="label">Your own accent</legend>
      <p className="field-hint mt-8">Choose a hue and the site builds the rest: the lightness of every colour is fixed, so text keeps its contrast whichever hue you pick. The preview follows the slider; the site changes when you save.</p>

      <div className="mt-13 grid gap-13">
        <HueSlider label="Hue" value={hue} onChange={setHue} theme={theme} />
        <label className="check" htmlFor={checkId}>
          <input
            id={checkId}
            type="checkbox"
            checked={own2}
            onChange={(e) => {
              setOwn2(e.target.checked);
              if (e.target.checked) setHue2(secondHue(hue, NO_SECOND_HUE));
            }}
          />
          <span>Choose the supporting colour as well</span>
        </label>
        {own2 ? (
          <HueSlider label="Supporting hue" value={hue2} onChange={setHue2} theme={theme} hint="Used beside the accent: the far end of a gradient, the second tone of a tile." />
        ) : (
          <p className="field-hint">The supporting colour follows the first, 40 degrees along the wheel.</p>
        )}
      </div>

      {/* a picture of the site in the chosen accent: not operable, and described in the line beneath it */}
      <div aria-hidden inert className="mt-21 overflow-hidden rounded border border-line-strong" style={pageVars} data-accent-preview>
        <div className="on-night flex items-center justify-between gap-13 px-13 py-8" style={nightVars}>
          <span className="flex items-center gap-13 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">
            <span className="border-b pb-2 text-accent" style={{ borderColor: f.mood1 }}>
              Markets
            </span>
            <span className="text-ink-2">Platforms</span>
            <span className="hidden text-ink-2 sm:inline">Academy</span>
          </span>
          <span className="btn btn-accent btn-sm" style={{ color: ACCENT_INK.dark }}>
            Open account
          </span>
        </div>
        <div className="grid gap-13 bg-bg p-13 sm:grid-cols-[1.618fr_1fr] sm:p-21">
          <div>
            <p className="eyebrow">Preview</p>
            <p className="mt-8 text-sm text-ink-2">
              Text on the page, with <span className="link">a link in it</span>.
            </p>
            <div className="mt-13 flex flex-wrap gap-8">
              <span className="btn btn-accent btn-sm" style={{ color: dark ? ACCENT_INK.dark : ACCENT_INK.light }}>
                A button
              </span>
              <span className="btn btn-ghost btn-sm">Another</span>
            </div>
          </div>
          <div className="tiles grid">
            <div className="p-13">
              <span className="label">Hue</span>
              <span className="num mt-5 block font-display text-xl text-accent">{hue}°</span>
              <span className="block text-xs text-ink-3">{hueName(hue)}</span>
            </div>
          </div>
        </div>
        <div className="relative h-[5.5rem]" style={stage}>
          <svg viewBox="0 0 320 88" preserveAspectRatio="xMaxYMid meet" className="absolute inset-y-0 right-0 h-full w-full" fill="none">
            <circle cx="236" cy="44" r="30" stroke={f.mood3} strokeOpacity="0.35" />
            <path d="M236 14a30 30 0 0 1 26 45" stroke={f.mood1} strokeWidth="2" strokeLinecap="round" />
            <path d="M210 59a30 30 0 0 1 -4 -15" stroke={f.mood2} strokeWidth="2" strokeLinecap="round" />
            <circle cx="236" cy="44" r="3" fill={f.mood1} />
          </svg>
          <span className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, ${f.mood2}, ${f.mood1} 38.2%, ${f.mood3} 61.8%, transparent)` }} />
        </div>
      </div>
      <p className="field-hint mt-8">
        In this {theme} theme: accent text on the page <span className="num text-ink">{text.toFixed(1)} to 1</span>, a button’s label on the accent <span className="num text-ink">{label.toFixed(1)} to 1</span>. The standard asks for 4.5 to 1.
      </p>

      <div className="mt-13 flex flex-wrap items-center gap-8">
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!ready}>
          {saved ? "Saved" : "Save"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={!ready}>
          Reset to GIO4X
        </button>
      </div>
      <p className="mt-8 min-h-[1.25rem] text-sm text-ink-2" role="status" aria-live="polite">
        {said}
      </p>
    </fieldset>
  );
}
