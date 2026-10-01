"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * One small store for the whole toolkit. What the visitor sets in one tool
 * (instrument, account currency, balance, lots, leverage, risk) is kept in
 * localStorage under `gx:calc` and read by every other tool.
 *
 * Values are kept as the strings the visitor typed, so a half-typed number is
 * never rewritten under their cursor. Hydration-safe: the server and the first
 * client render both use DEFAULTS; the stored values arrive straight after.
 */
export type Calc = {
  instrument: string;
  accountCurrency: string;
  balance: string;
  lots: string;
  leverage: string;
  riskPct: string;
  stopPips: string;
  accountType: string;
  /** point size used for instruments that have no pip convention */
  pointSize: string;
  /** "Another instrument": the visitor's own contract */
  customContract: string;
  customQuote: string;
};

/** Starting figures are placeholders that make the arithmetic visible. They are not suggestions. */
export const DEFAULTS: Calc = {
  instrument: "eur-usd",
  accountCurrency: "USD",
  balance: "10000",
  lots: "1",
  leverage: "100",
  riskPct: "1",
  stopPips: "25",
  accountType: "classic",
  pointSize: "0.01",
  customContract: "1",
  customQuote: "USD",
};

const KEY = "gx:calc";
const FIELDS = Object.keys(DEFAULTS) as (keyof Calc)[];

let state: Calc = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): void {
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return;
    const next: Calc = { ...DEFAULTS };
    for (const f of FIELDS) {
      const v = (data as Record<string, unknown>)[f];
      if (typeof v === "string" && v.length <= 24) next[f] = v;
    }
    state = next;
  } catch {
    // storage blocked or corrupted: the tools still work with the defaults
  }
}

function snapshot(): Calc {
  if (!loaded) load();
  return state;
}

const serverSnapshot = (): Calc => DEFAULTS;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(patch: Partial<Calc>): void {
  state = { ...snapshot(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // not persisted; still applied for this page
  }
  listeners.forEach((l) => l());
}

export function useCalc(): readonly [Calc, (patch: Partial<Calc>) => void, () => void] {
  const calc = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const set = useCallback((patch: Partial<Calc>) => write(patch), []);
  const reset = useCallback(() => write(DEFAULTS), []);
  return [calc, set, reset] as const;
}
