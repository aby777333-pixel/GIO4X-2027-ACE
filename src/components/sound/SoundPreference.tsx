"use client";

import { signalSound } from "@/components/sound/signal";
import { Toggle } from "@/components/shell/Appearance";
import { usePrefs } from "@/hooks/usePrefs";
import type { Prefs } from "@/lib/prefs";

const LEVELS: { key: Prefs["soundLevel"]; label: string }[] = [
  { key: "quiet", label: "Quiet" },
  { key: "normal", label: "Normal" },
];

/**
 * The sound switch and its volume, on /preferences. Both are fields of
 * `gx:prefs`, kept with the display preferences. Off is the default: nothing
 * on this site makes a sound until this switch is turned on.
 */
export function SoundPreference() {
  const [prefs, update] = usePrefs();
  const on = prefs.sound === true;
  const level = prefs.soundLevel === "normal" ? "normal" : "quiet";
  const muted = on && prefs.effects === "low";

  return (
    <div className="grid gap-21">
      <Toggle
        label="Interface sounds"
        hint="Off: the site is silent. On: a short, quiet click or tone when you reach a main button, change a tab or move through the tour. The sounds are made in your browser; no audio file is downloaded."
        on={on}
        onChange={(v) => update({ sound: v })}
      />

      <fieldset disabled={!on} className={on ? undefined : "opacity-50"}>
        <legend className="label">Volume</legend>
        <div className="mt-8 flex flex-wrap items-center gap-13">
          <div className="seg" role="group">
            {LEVELS.map((l) => (
              <button key={l.key} type="button" aria-pressed={level === l.key} onClick={() => update({ soundLevel: l.key })}>
                {l.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => signalSound("chime")}>
            Play a sample
          </button>
        </div>
        <p className="field-hint mt-8">{on ? "Both are quiet; “Normal” is the louder of the two. Choosing one plays a sample." : "Switch interface sounds on to choose a volume."}</p>
      </fieldset>

      {muted && (
        <p className="border-l border-accent pl-13 text-sm text-ink-2" role="status">
          Sounds are silent while “Low visual effects” is on in Display.
        </p>
      )}
    </div>
  );
}
