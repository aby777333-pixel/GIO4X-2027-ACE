"use client";

import { useSyncExternalStore } from "react";

/**
 * THE PLAY RECORD — one key, `gx:play`, for the three things on the site that
 * are played rather than read. It is listed in LOCAL_KEYS (lib/prefs), shown
 * in the privacy controls and removed by the privacy reset.
 *
 *   r   the daily riddle: the last day answered correctly, the run of days in
 *       a row, and the longest run
 *   b   the best score in "Sixty seconds" (the Workshop), in pips
 *   h   the riddle hunt: which of the five hidden riddles have been solved
 *   s   the passport: the stamps collected. Present only once the visitor has
 *       pressed "Start my passport"; until then no page visit is noted
 *
 * Each part is written only by something the visitor does: answering a
 * riddle, finishing a round, starting the passport. Nothing leaves the
 * browser. Whatever is read back is checked against the shapes below.
 */
export const PLAY_KEY = "gx:play";
const EVENT = "gx:play";

export type Play = { r?: { last: string; streak: number; best: number }; b?: number; s?: string[]; h?: string[] };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^[a-z][a-z0-9-]{0,31}$/;
const MAX_STAMPS = 40;

function clean(v: unknown): Play {
  const out: Play = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  const o = v as Record<string, unknown>;
  const r = o.r as Record<string, unknown> | undefined;
  if (r && typeof r === "object" && typeof r.last === "string" && DAY.test(r.last) && Number.isInteger(r.streak) && Number.isInteger(r.best)) {
    out.r = { last: r.last, streak: Math.min(9999, Math.max(0, r.streak as number)), best: Math.min(9999, Math.max(0, r.best as number)) };
  }
  if (typeof o.b === "number" && Number.isFinite(o.b)) out.b = Math.max(-9999, Math.min(9999, Math.round(o.b * 10) / 10));
  if (Array.isArray(o.h)) {
    const h = [...new Set(o.h.filter((x): x is string => typeof x === "string" && x in HUNT))];
    if (h.length) out.h = h;
  }
  if (Array.isArray(o.s)) out.s = [...new Set(o.s.filter((x): x is string => typeof x === "string" && STAMP.test(x)))].slice(0, MAX_STAMPS);
  return out;
}

/**
 * The five hidden riddles: where each is, its couplet, and its answer among
 * three. A riddle describes a thing on this site or an idea it teaches.
 */
export const HUNT = {
  tools: { where: "The Trader Toolkit", href: "/tools", a: "From your stop and from your stake", b: "I work out the size that you should take.", answer: "Position size", options: ["Position size", "Pip value", "Compound growth"] },
  glossary: { where: "The glossary", href: "/glossary", a: "I look the same at every scale,", b: "a path that tells no certain tale.", answer: "A random walk", options: ["A trend line", "A random walk", "A moving average"] },
  trust: { where: "The Trust Centre", href: "/trust", a: "Between two marks I name the site:", b: "read me first, and read me right.", answer: "The domain in an address", options: ["A password", "The domain in an address", "A padlock"] },
  about: { where: "About GIO4X", href: "/about", a: "One in London, one in Chennai:", b: "two published doors, and here am I.", answer: "The two offices", options: ["The two platforms", "The two offices", "The two portals"] },
  labs: { where: "GIO4X Labs", href: "/labs", a: "Poured at the open, drawn high and low,", b: "cooled at the close: what do I show?", answer: "A candlestick", options: ["A candlestick", "A moving average", "A spread"] },
} as const;

let cache: { raw: string | null; value: Play } = { raw: null, value: {} };
const EMPTY: Play = {};

export function readPlay(): Play {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PLAY_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.value;
  let value: Play = {};
  if (raw) {
    try {
      value = clean(JSON.parse(raw));
    } catch {
      value = {};
    }
  }
  cache = { raw, value };
  return value;
}

function write(next: Play): void {
  try {
    if (!next.r && next.b === undefined && !next.s && !next.h) window.localStorage.removeItem(PLAY_KEY);
    else window.localStorage.setItem(PLAY_KEY, JSON.stringify(next));
  } catch {
    /* storage is unavailable: the record is simply not kept */
  }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (fn: () => void) => {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
};

/** The record, kept current. Empty on the server and until the page has loaded. */
export function usePlay(): Play {
  return useSyncExternalStore(subscribe, readPlay, () => EMPTY);
}

/** today as YYYY-MM-DD, in UTC: the riddle changes at the same moment for everyone */
export const today = (now = new Date()) => now.toISOString().slice(0, 10);
const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

/** A riddle answered correctly today: the run grows by one if yesterday was answered too. */
export function noteRiddle(): void {
  const p = readPlay();
  const day = today();
  if (p.r?.last === day) return;
  const streak = p.r?.last === dayBefore(day) ? p.r.streak + 1 : 1;
  write({ ...p, r: { last: day, streak, best: Math.max(streak, p.r?.best ?? 0) } });
}

/** The run that still stands today: it lapses when a day is missed. */
export function standingStreak(p: Play): number {
  if (!p.r) return 0;
  const day = today();
  return p.r.last === day || p.r.last === dayBefore(day) ? p.r.streak : 0;
}

/** A finished round of "Sixty seconds": kept only if it beats the best so far. Returns whether it did. */
export function noteScore(pips: number): boolean {
  const p = readPlay();
  if (p.b !== undefined && pips <= p.b) return false;
  write({ ...p, b: pips });
  return true;
}

export function startPassport(): void {
  const p = readPlay();
  if (!p.s) write({ ...p, s: [] });
}
export function endPassport(): void {
  const p = { ...readPlay() };
  delete p.s;
  write(p);
}
export function stamp(id: string): void {
  const p = readPlay();
  if (!p.s || p.s.includes(id) || !STAMP.test(id)) return;
  write({ ...p, s: [...p.s, id].slice(0, MAX_STAMPS) });
}

/** A hidden riddle solved. When all five are, the passport (if there is one) is stamped for it. */
export function noteHunt(id: keyof typeof HUNT): void {
  const p = readPlay();
  if (p.h?.includes(id)) return;
  const h = [...(p.h ?? []), id];
  const done = h.length === Object.keys(HUNT).length;
  write({ ...p, h, ...(done && p.s && !p.s.includes("hunt") ? { s: [...p.s, "hunt"] } : {}) });
}
