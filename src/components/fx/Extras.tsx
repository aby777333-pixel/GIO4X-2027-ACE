"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Three small things for the whole site. Each renders nothing of its own, or
 * one button, and each is absent under reduced motion or low visual effects
 * where it would move.
 *
 *   SEASON      marks <html data-season> for three stretches of the year in
 *               which markets are known to be different (styles/fx.css tints
 *               one hairline; nothing else changes)
 *   CURRENCY    type a currency's three-letter code anywhere outside a form
 *     RAIN      field and its symbol falls down the page once, briefly
 *   AMBIENCE    a quiet drone, off until switched on at /preferences, for the
 *               length of the visit only; its pitch belongs to the section
 *               being read. Nothing about it is stored.
 */

/* ---- SEASON ---------------------------------------------------------------- */

export function Season() {
  useEffect(() => {
    const d = new Date();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    const season = m === 11 && day >= 18 ? "year-end" : m === 0 && day <= 7 ? "new-year" : m === 7 ? "summer" : "";
    if (season) document.documentElement.dataset.season = season;
    return () => {
      delete document.documentElement.dataset.season;
    };
  }, []);
  return null;
}

/** One line for a page that wants to say what the season means. Nothing outside a season. */
export function SeasonNote() {
  const [season, setSeason] = useState("");
  useEffect(() => setSeason(document.documentElement.dataset.season ?? ""), []);
  if (!season) return null;
  const text =
    season === "year-end"
      ? "The year-end: many venues keep shorter hours and markets are often thin. Spreads can be wider than usual."
      : season === "new-year"
        ? "The first days of the year: trading is returning after the holidays, and liquidity builds back over the week."
        : "August: the northern summer, when many desks are lightly staffed and markets are often quieter.";
  return <p className="gx-season-note">{text}</p>;
}

/* ---- CURRENCY RAIN --------------------------------------------------------- */

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "₣", AUD: "A$", CAD: "C$", NZD: "NZ$", INR: "₹", CNY: "¥", XAU: "Au", XAG: "Ag", BTC: "₿" };

export function CurrencyRain() {
  useEffect(() => {
    let typed = "";
    let layer: HTMLDivElement | null = null;
    let timer = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      typed = (typed + e.key.toUpperCase()).slice(-3);
      const symbol = SYMBOLS[typed];
      if (!symbol) return;
      typed = "";
      const root = document.documentElement;
      if (root.dataset.motion === "reduced" || root.dataset.effects === "low" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      layer?.remove();
      window.clearTimeout(timer);
      layer = document.createElement("div");
      layer.className = "gx-rain no-print";
      layer.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 34; i++) {
        const s = document.createElement("span");
        s.textContent = symbol;
        s.style.left = `${(i * 37 + 11) % 100}%`;
        s.style.animationDelay = `${((i * 53) % 90) / 100}s`;
        s.style.fontSize = `${1 + ((i * 7) % 5) * 0.35}rem`;
        layer.appendChild(s);
      }
      document.body.appendChild(layer);
      timer = window.setTimeout(() => layer?.remove(), 3200);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
      layer?.remove();
    };
  }, []);
  return null;
}

/* ---- AMBIENCE -------------------------------------------------------------- */

type Rig = { ctx: AudioContext; a: OscillatorNode; b: OscillatorNode; gain: GainNode };
let rig: Rig | null = null;
const listeners = new Set<() => void>();

/** the root note for each part of the site, in hertz: low, and a fourth or fifth apart */
function noteFor(path: string): number {
  if (path.startsWith("/markets")) return 110;
  if (path.startsWith("/trading") || path.startsWith("/platforms")) return 98;
  if (path.startsWith("/academy") || path.startsWith("/glossary") || path.startsWith("/verse")) return 130.81;
  if (path.startsWith("/labs") || path.startsWith("/tools")) return 146.83;
  return 87.31;
}

export const ambienceOn = () => rig !== null;

export function setAmbience(on: boolean, path: string): void {
  if (on && !rig) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    gain.gain.value = 0;
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    a.type = "sine";
    b.type = "triangle";
    const f = noteFor(path);
    a.frequency.value = f;
    b.frequency.value = f * 1.5; // a fifth above, a little flat, so the two beat slowly
    b.detune.value = -7;
    // a slow breath in the loudness
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.08;
    depth.gain.value = 0.008;
    lfo.connect(depth).connect(gain.gain);
    a.connect(filter);
    b.connect(filter);
    filter.connect(gain).connect(ctx.destination);
    a.start();
    b.start();
    lfo.start();
    gain.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 2.5);
    rig = { ctx, a, b, gain };
  } else if (!on && rig) {
    const r = rig;
    rig = null;
    r.gain.gain.cancelScheduledValues(r.ctx.currentTime);
    r.gain.gain.linearRampToValueAtTime(0, r.ctx.currentTime + 0.8);
    window.setTimeout(() => void r.ctx.close(), 1000);
  }
  listeners.forEach((fn) => fn());
}

/** Follows the visitor from section to section while the ambience is on. Renders nothing. */
export function AmbienceFollower() {
  const pathname = usePathname() ?? "/";
  useEffect(() => {
    if (!rig) return;
    const f = noteFor(pathname);
    const at = rig.ctx.currentTime;
    rig.a.frequency.linearRampToValueAtTime(f, at + 2);
    rig.b.frequency.linearRampToValueAtTime(f * 1.5, at + 2);
  }, [pathname]);
  return null;
}

export function AmbienceSwitch() {
  const pathname = usePathname() ?? "/";
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(ambienceOn());
    sync();
    listeners.add(sync);
    return () => void listeners.delete(sync);
  }, []);
  return (
    <div className="mt-21 border-l border-accent pl-13">
      <p className="label">Ambient sound</p>
      <p className="mt-5 text-sm text-ink">A quiet, low drone behind the pages, a different note for each part of the site. For this visit only: it stops when the page is reloaded or closed, and nothing about it is kept.</p>
      <button type="button" className="go mt-8 min-h-[2.75rem]" aria-pressed={on} onClick={() => setAmbience(!on, pathname)}>
        {on ? "Stop the ambient sound" : "Play ambient sound"}
      </button>
    </div>
  );
}
