"use client";

import { clearOfflineCopy, OFFLINE_CACHE_PREFIX } from "@/lib/prefs";

/**
 * Page-side helpers for the offline worker (public/sw.js, docs/OFFLINE.md).
 * Everything here reads or removes what the worker keeps in this browser's
 * cache storage. Nothing is sent anywhere.
 */
export const WORKER_URL = "/sw.js";
export const KILL_URL = "/sw-off.txt";
export const SKIP_WAITING = "gx-sw:skip-waiting";
/** asks the worker to read the kill switch and to complete or renew its installed set */
export const UPKEEP = "gx-sw:upkeep";

export const workerSupported = (): boolean => typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof caches !== "undefined";

/** The worker registered for this site, if there is one. */
export async function findWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!workerSupported()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration("/")) ?? null;
  } catch {
    return null;
  }
}

/** True when /sw-off.txt says 1: the worker must not run. A failed request is not a kill. */
export async function killSwitchOn(): Promise<boolean> {
  try {
    const res = await fetch(KILL_URL, { cache: "no-store", credentials: "same-origin" });
    return res.ok && (await res.text()).trim() === "1";
  } catch {
    return false;
  }
}

/** Unregister the worker and delete everything it kept. Used by the preference, the kill switch and "Remove the offline copy". */
export async function removeOfflineCopy(): Promise<void> {
  if (workerSupported()) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* ignore */
    }
  }
  await clearOfflineCopy();
}

export type KeptPage = { h: string; t: string };

const titleOf = (html: string, fallback: string): string => {
  const m = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(html);
  if (!m) return fallback;
  const t = m[1]
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split(" | ")[0]
    .trim();
  return t || fallback;
};

/**
 * The pages kept in this browser, with the title each copy carries. Only
 * same-site page paths are returned; the worker's own bookkeeping entry and
 * the static files are left out.
 */
export async function keptPages(): Promise<KeptPage[]> {
  if (typeof caches === "undefined") return [];
  const out = new Map<string, string>();
  try {
    const names = (await caches.keys()).filter((n) => n.startsWith(OFFLINE_CACHE_PREFIX) && !n.includes("static"));
    for (const name of names) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        const url = new URL(req.url);
        if (url.origin !== window.location.origin || url.pathname.startsWith("/__gx-offline/") || out.has(url.pathname)) continue;
        const res = await cache.match(req);
        if (!res || !(res.headers.get("content-type") ?? "").includes("text/html")) continue;
        out.set(url.pathname, titleOf(await res.text(), url.pathname));
      }
    }
  } catch {
    /* cache storage unavailable: nothing to list */
  }
  return [...out].map(([h, t]) => ({ h, t })).sort((a, b) => a.t.localeCompare(b.t));
}

export type OfflineState = { supported: boolean; active: boolean; pages: number };

/** Whether a worker is registered and how many pages it holds. */
export async function offlineState(): Promise<OfflineState> {
  if (!workerSupported()) return { supported: false, active: false, pages: 0 };
  const reg = await findWorker();
  const pages = (await keptPages()).length;
  return { supported: true, active: !!reg, pages };
}
