"use client";

import { BOOT_KEY } from "@/lib/boot";

/**
 * Plays the opening again. The opening is shown once per browser, on the home
 * page, and only if the home page is the first page of the first visit: so a
 * visitor who arrived on another page, or who has been here before, never
 * sees it. This forgets that it was shown and loads the home page afresh,
 * which is exactly the first-visit case.
 *
 * Under reduced motion or low visual effects the opening is left out by
 * design, and the note beside the button says so.
 */
export function ReplayOpening() {
  const play = () => {
    try {
      window.localStorage.removeItem(BOOT_KEY);
    } catch {
      /* storage is unavailable: the opening cannot be remembered, so it is not shown */
    }
    window.location.assign("/");
  };
  return (
    <div className="mt-21 border-l border-accent pl-13">
      <p className="label">The opening</p>
      <p className="mt-5 text-sm text-ink">A few seconds in which the GIO4X mark forms from points of light. It plays once, on a first visit that begins on the home page.</p>
      <button type="button" className="go mt-8 min-h-[2.75rem]" onClick={play}>
        Play the opening again
      </button>
      <p className="mt-5 text-xs text-ink-3">Not shown while reduced motion or low visual effects is on.</p>
    </div>
  );
}
