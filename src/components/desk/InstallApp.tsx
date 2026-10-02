"use client";

import { useState } from "react";
import { promptInstall, useInstallState } from "./install";

/**
 * "Install GIO4X": shown on My desk and on the preferences page, never as a
 * banner. The button appears only when the browser itself has said the site
 * can be installed; on iPhone and iPad, where Safari has no such offer, the
 * two steps are written out instead. In any other browser nothing is shown.
 */
export function InstallApp({ className }: { className?: string }) {
  const state = useInstallState();
  const [note, setNote] = useState<string | null>(null);

  if (state === "unavailable" && !note) return null;

  return (
    <div className={className}>
      <h3 className="h4">Install GIO4X</h3>
      {state === "installed" ? (
        <p className="mt-8 max-w-measure text-sm text-ink-2">GIO4X is installed on this device and opens in its own window.</p>
      ) : state === "ios" ? (
        <>
          <p className="mt-8 max-w-measure text-sm text-ink-2">On iPhone and iPad the site is added from Safari’s own menu:</p>
          <ol className="mt-8 grid max-w-measure list-decimal gap-3 pl-21 text-sm text-ink-2">
            <li>
              Press <span className="font-medium text-ink">Share</span> in Safari’s toolbar.
            </li>
            <li>
              Choose <span className="font-medium text-ink">Add to Home Screen</span>, then <span className="font-medium text-ink">Add</span>.
            </li>
          </ol>
        </>
      ) : state === "ready" ? (
        <>
          <p className="mt-8 max-w-measure text-sm text-ink-2">
            Adds GIO4X to this device as an app with its own window. It is the same site: the calculators and the pages you have opened are also kept for use without a connection. Nothing more is stored, and it can be removed like any other app.
          </p>
          <button
            type="button"
            className="btn btn-ghost mt-13"
            onClick={async () => {
              const outcome = await promptInstall();
              setNote(outcome === "accepted" ? "Installed." : outcome === "dismissed" ? "Not installed. Your browser will offer it again from its own menu." : "This browser is not offering an installation at the moment.");
            }}
          >
            Install GIO4X
          </button>
        </>
      ) : null}
      <p role="status" aria-live="polite" className="mt-8 text-sm text-ink-3">
        {note}
      </p>
    </div>
  );
}
