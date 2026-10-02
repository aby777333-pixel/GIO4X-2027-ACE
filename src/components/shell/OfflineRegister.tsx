"use client";

import { useEffect, useRef, useState } from "react";
import { captureInstallPrompt } from "@/components/desk/install";
import { killSwitchOn, removeOfflineCopy, SKIP_WAITING, UPKEEP, WORKER_URL, workerSupported } from "@/components/desk/offline";
import { usePrefs } from "@/hooks/usePrefs";

/**
 * Registers the offline worker (public/sw.js) for the public site.
 *
 *  - Production builds only. In development nothing is registered, so hot
 *    reload is never served from a cache.
 *  - Never from GIO4X Control: the console does not render the site shell, and
 *    the worker itself ignores every /control and /api request.
 *  - Only while the "offline copy" preference is on (the default). Switched
 *    off at /preferences, the worker is unregistered and its caches deleted.
 *  - Kill switch: before registering, and on every full page load, the file
 *    /sw-off.txt is read. It normally contains 0. If it returns 1 the worker
 *    is unregistered and its caches are deleted (see docs/OFFLINE.md).
 *  - A new version of the worker waits. The small notice below is shown, and
 *    the worker takes over only when the visitor presses "Reload", so a page
 *    is never swapped while someone is using it.
 *
 * It also holds the browser's install offer for the "Install GIO4X" control
 * (components/desk/InstallApp), in every environment.
 */
export function OfflineRegister() {
  const [prefs, , ready] = usePrefs();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [later, setLater] = useState(false);
  const accepted = useRef(false);

  useEffect(() => captureInstallPrompt(), []);

  useEffect(() => {
    if (!ready || process.env.NODE_ENV !== "production" || !workerSupported()) return;
    if (window.location.pathname.startsWith("/control")) return;
    let alive = true;

    if (!prefs.offline) {
      void removeOfflineCopy();
      return;
    }

    const onControllerChange = () => {
      // only after "Reload" was pressed: the first install also changes the controller, and must not reload anything
      if (accepted.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const start = async () => {
      if (await killSwitchOn()) {
        await removeOfflineCopy();
        return;
      }
      if (!alive) return;
      try {
        const reg = await navigator.serviceWorker.register(WORKER_URL, { scope: "/", updateViaCache: "none" });
        if (!alive) return;
        // once per full page load: moving between pages inside the site is not a navigation the worker sees,
        // so this is what lets it read the kill switch and complete or renew the tools it keeps
        void navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: UPKEEP })).catch(() => undefined);
        // a version that finished installing while an older one is in charge
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (alive && next.state === "installed" && navigator.serviceWorker.controller) setWaiting(next);
          });
        });
      } catch {
        /* registration refused (private mode, policy): the site works as before, without an offline copy */
      }
    };

    // after the page has finished loading, so the worker never competes with it
    let idle = 0;
    const whenLoaded = () => {
      idle = window.setTimeout(() => void start(), 2600);
    };
    if (document.readyState === "complete") whenLoaded();
    else window.addEventListener("load", whenLoaded, { once: true });

    return () => {
      alive = false;
      window.clearTimeout(idle);
      window.removeEventListener("load", whenLoaded);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [ready, prefs.offline]);

  if (!waiting || later) return null;

  return (
    <div
      role="status"
      className="panel no-print fixed bottom-[max(0.8125rem,env(safe-area-inset-bottom))] left-[max(0.8125rem,env(safe-area-inset-left))] z-[38] flex max-w-[calc(100vw-5.5rem)] flex-wrap items-center gap-x-13 gap-y-8 px-13 py-8 shadow-2 sm:max-w-[26rem]"
    >
      <p className="text-sm text-ink-2">A newer version of this site is ready.</p>
      <div className="flex items-center gap-8">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            accepted.current = true;
            waiting.postMessage({ type: SKIP_WAITING });
            // the page reloads when the new worker takes over; if that never comes, a plain reload still honours the press
            window.setTimeout(() => window.location.reload(), 4200);
          }}
        >
          Reload
        </button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setLater(true)}>
          Later
        </button>
      </div>
    </div>
  );
}
