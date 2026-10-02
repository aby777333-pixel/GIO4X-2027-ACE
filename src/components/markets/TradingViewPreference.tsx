"use client";

import { Toggle } from "@/components/shell/Appearance";
import { usePrefs } from "@/hooks/usePrefs";

/**
 * The one standing choice about third-party frames: whether TradingView
 * charts and panels wait for their button (the default) or load by themselves
 * as each scrolls into view. Kept in `gx:prefs` with the other preferences.
 */
export function TradingViewPreference() {
  const [prefs, update] = usePrefs();
  return (
    <Toggle
      label="Load TradingView panels automatically"
      hint="Off: each chart or panel waits for its button. On: each one loads as it scrolls into view, which connects your browser to TradingView."
      on={prefs.tvAuto === true}
      onChange={(v) => update({ tvAuto: v })}
    />
  );
}
