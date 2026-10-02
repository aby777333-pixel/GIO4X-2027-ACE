"use client";

import { useEffect, useState } from "react";
import { Toggle } from "@/components/shell/Appearance";
import { usePrefs } from "@/hooks/usePrefs";

type SignalNavigator = Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string | null };

/** Which "do not track me" signal this browser is sending, if any. Mirrors pulseAllowed() in src/lib/pulse-client.ts. */
function browserSignal(): "gpc" | "dnt" | null {
  try {
    const nav = navigator as SignalNavigator;
    if (nav.globalPrivacyControl === true) return "gpc";
    const dnt = nav.doNotTrack ?? (window as Window & { doNotTrack?: string | null }).doNotTrack ?? nav.msDoNotTrack;
    return dnt === "1" || dnt === "yes" ? "dnt" : null;
  } catch {
    return null;
  }
}

/**
 * "Count my visits": whether this browser adds to the site's anonymous daily
 * totals of page views and searches. On by default; kept in `gx:prefs` with
 * the display preferences. When the browser itself says "do not track me",
 * that is stated here, because it wins over the switch.
 */
export function CountVisitsPreference() {
  const [prefs, update, ready] = usePrefs();
  const [signal, setSignal] = useState<"gpc" | "dnt" | null>(null);

  useEffect(() => setSignal(browserSignal()), []);

  const on = prefs.countVisits !== false;
  const counting = ready && on && !signal;

  return (
    <div>
      <Toggle
        label="Count my visits"
        hint="On: each page you open and each search adds 1 to a daily total. Off: this browser sends nothing for them."
        on={on}
        onChange={(v) => update({ countVisits: v })}
      />
      <p className="mt-8 text-xs text-ink-3" role="status" aria-live="polite">
        {!ready
          ? "…"
          : signal
            ? `Your browser is sending the ${signal === "gpc" ? "Global Privacy Control" : "Do Not Track"} signal, so nothing is counted, whatever this switch says.`
            : counting
              ? "Your page views and searches are being counted from this browser."
              : "Nothing is being counted from this browser."}
      </p>
    </div>
  );
}
