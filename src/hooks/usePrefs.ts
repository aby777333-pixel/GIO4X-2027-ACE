"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PREFS, readPrefs, writePrefs, type Prefs } from "@/lib/prefs";

/** Visitor preferences, kept in sync across components and tabs. */
export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void, boolean] {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(readPrefs());
    setReady(true);
    const onChange = (e: Event) => setPrefs((e as CustomEvent<Prefs>).detail);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "gx:prefs") setPrefs(readPrefs());
    };
    window.addEventListener("gx:prefs", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("gx:prefs", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    const next = { ...readPrefs(), ...patch };
    writePrefs(next);
  }, []);

  return [prefs, update, ready];
}
