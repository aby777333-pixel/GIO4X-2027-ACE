"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePrefs } from "@/hooks/usePrefs";
import { offlineState, removeOfflineCopy, type OfflineState } from "./offline";

/**
 * The offline copy, on the preferences page: whether one is being kept in this
 * browser, how many pages it holds, and the control that removes it.
 *
 * "Remove the offline copy" unregisters the worker, deletes its caches and
 * sets the `offline` preference to off, so it is not started again on the next
 * page. "Keep an offline copy" sets it back on; the worker is registered again
 * by the site shell (components/shell/OfflineRegister) after the page loads.
 */
export function OfflineCopy() {
  const [prefs, update, ready] = usePrefs();
  const [state, setState] = useState<OfflineState | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    offlineState()
      .then(setState)
      .catch(() => setState({ supported: false, active: false, pages: 0 }));
  }, []);

  useEffect(() => {
    refresh();
    // the privacy reset empties the copy, then announces the preferences
    const onPrefs = () => window.setTimeout(refresh, 400);
    window.addEventListener("gx:prefs", onPrefs);
    return () => window.removeEventListener("gx:prefs", onPrefs);
  }, [refresh]);

  if (!ready || !state) return <p className="text-xs text-ink-3">…</p>;

  if (!state.supported) {
    return <p className="text-sm text-ink-2">This browser does not support an offline copy, so none is kept.</p>;
  }

  const kept = state.active || state.pages > 0;

  return (
    <div>
      <p>
        {kept ? (
          <span className="state state-open">
            Kept{" "}
            <span className="num font-normal normal-case tracking-normal text-ink-3">
              {state.pages} {state.pages === 1 ? "page" : "pages"}
            </span>
          </span>
        ) : (
          <span className="state state-off">Nothing kept</span>
        )}
      </p>
      <p className="mt-8 max-w-measure text-sm text-ink-2">
        {prefs.offline
          ? kept
            ? "The calculators and the pages you have opened are kept in this browser’s cache storage, so they open without a connection."
            : "An offline copy is allowed but none is being kept at the moment. It is made a few seconds after a page has loaded, on the published site."
          : "Switched off. No offline copy is kept and none will be made."}{" "}
        <Link href="/offline" className="link">
          What is kept
        </Link>
      </p>
      <div className="mt-13 flex flex-wrap items-center gap-13">
        {prefs.offline || kept ? (
          <button
            type="button"
            className="btn btn-ghost h-auto min-h-[2.75rem] whitespace-normal py-8"
            onClick={async () => {
              update({ offline: false });
              await removeOfflineCopy();
              setNote("The offline copy was removed from this browser and will not be made again unless you switch it back on.");
              refresh();
            }}
          >
            Remove the offline copy
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost h-auto min-h-[2.75rem] whitespace-normal py-8"
            onClick={() => {
              update({ offline: true });
              setNote("An offline copy will be kept again, starting a few seconds after the next page loads.");
            }}
          >
            Keep an offline copy
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-8 max-w-measure text-sm text-ink-3">
        {note}
      </p>
    </div>
  );
}
