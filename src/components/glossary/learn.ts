"use client";

import { useSyncExternalStore } from "react";

/**
 * Which glossary questions the visitor has answered correctly.
 *
 * Kept only in this browser, under one localStorage key (listed in LOCAL_KEYS
 * in lib/prefs and described on /legal/cookies and /preferences), as a JSON
 * object of slug → true. Nothing is sent anywhere and no score is kept: it
 * only lets the glossary show which terms have been checked. Cleared by
 * "start over" here and by the privacy reset.
 */
export const LEARN_KEY = "gx:learn";

export type Learned = Readonly<Record<string, true>>;

const EVENT = "gx:learn";
const EMPTY: Learned = Object.freeze({});
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
/** far more than the glossary holds: a stored object can never grow without bound */
const LIMIT = 600;

let lastRaw: string | null | undefined;
let last: Learned = EMPTY;

/** What is stored, made safe: only well-formed slugs marked true. The same object is returned until the stored text changes. */
export function readLearned(): Learned {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LEARN_KEY);
  } catch {
    raw = null;
  }
  if (raw === lastRaw) return last;
  lastRaw = raw;
  last = EMPTY;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const out: Record<string, true> = {};
        let n = 0;
        for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (value === true && SLUG.test(slug) && n < LIMIT) {
            out[slug] = true;
            n++;
          }
        }
        if (n > 0) last = out;
      }
    } catch {
      /* not JSON: treated as nothing stored */
    }
  }
  return last;
}

const announce = () => window.dispatchEvent(new Event(EVENT));

export function markLearned(slug: string): void {
  if (!SLUG.test(slug)) return;
  const now = readLearned();
  if (now[slug]) return;
  try {
    window.localStorage.setItem(LEARN_KEY, JSON.stringify({ ...now, [slug]: true }));
  } catch {
    /* storage unavailable: the answer is simply not remembered */
  }
  announce();
}

export function clearLearned(): void {
  try {
    window.localStorage.removeItem(LEARN_KEY);
  } catch {
    /* ignore */
  }
  announce();
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === LEARN_KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  // the privacy reset clears every key, then announces the preferences
  window.addEventListener("gx:prefs", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("gx:prefs", onChange);
  };
}

const onServer = () => null;

/** The checked terms, or null on the server and during hydration: nothing that depends on storage is in the first HTML. */
export function useLearned(): Learned | null {
  return useSyncExternalStore(subscribe, readLearned, onServer);
}

export const countLearned = (learned: Learned | null): number => (learned ? Object.keys(learned).length : 0);
