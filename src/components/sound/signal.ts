/**
 * How any part of the site asks for an interface sound without knowing
 * whether sound is on. It is a window event and nothing else: this file holds
 * no audio code. If the visitor has not switched sound on at /preferences,
 * nobody is listening and the request goes nowhere.
 */

/** tick: a pointer on a control. soft: a tab change. chime: something woke or moved on. knock: an error. */
export type SoundKind = "tick" | "soft" | "chime" | "knock";

export const SOUND_EVENT = "gx:sound";

export function signalSound(kind: SoundKind): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SoundKind>(SOUND_EVENT, { detail: kind }));
}

export function isSoundKind(value: unknown): value is SoundKind {
  return value === "tick" || value === "soft" || value === "chime" || value === "knock";
}
