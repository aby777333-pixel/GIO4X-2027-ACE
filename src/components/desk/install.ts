"use client";

import { useSyncExternalStore } from "react";

/**
 * The browser's own "install this site" offer.
 *
 * Chromium browsers announce that a site can be installed with a
 * `beforeinstallprompt` event, usually before any page component has mounted.
 * The site shell calls captureInstallPrompt() once, so the event is held here
 * until a page that offers "Install GIO4X" (My desk, Preferences) is opened.
 * Holding the event also stops the browser's own banner: the offer is shown
 * only where the visitor went looking for it. Nothing is stored.
 */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export type InstallState = "unavailable" | "ready" | "ios" | "installed";

let held: InstallPromptEvent | null = null;
let state: InstallState = "unavailable";
let listening = false;
const listeners = new Set<() => void>();

const set = (next: InstallState) => {
  state = next;
  listeners.forEach((l) => l());
};

function standalone(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/** Safari on iPhone and iPad has no install event: the visitor adds the site from the Share menu. */
function iosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function captureInstallPrompt(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  if (standalone()) set("installed");
  else if (iosSafari()) set("ios");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    held = e as InstallPromptEvent;
    set("ready");
  });
  window.addEventListener("appinstalled", () => {
    held = null;
    set("installed");
  });
}

/** Show the browser's install dialog. Resolves to what the visitor chose. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const e = held;
  if (!e) return "unavailable";
  // an install event can be used once
  held = null;
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    set(outcome === "accepted" ? "installed" : "unavailable");
    return outcome;
  } catch {
    set("unavailable");
    return "unavailable";
  }
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** "unavailable" on the server and until the browser says otherwise. */
export const useInstallState = (): InstallState => useSyncExternalStore(subscribe, () => state, () => "unavailable");
