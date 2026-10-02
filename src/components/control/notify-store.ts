/**
 * The bell's one source of truth in the browser.
 *
 * The console's frame mounts two bells (the sidebar's, and the phone bar's;
 * only one is ever visible), and both read this module, so there is one timer
 * and one request however many bells there are. Polling starts with the first
 * bell that subscribes and stops with the last.
 *
 * What it does
 *   · asks GET /control/notifications/feed every 30 seconds while the tab is
 *     visible, and once more the moment the tab becomes visible again;
 *   · marks notifications read through POST /control/notifications/read;
 *   · when the person has switched on "Also notify me on this computer" and
 *     the browser has given permission, raises a system notification for a
 *     line that is new since the previous answer, but only while the tab is
 *     in the background (hidden, or not the focused window). That choice also
 *     keeps the 30-second question going while the tab is hidden: a tab that
 *     stopped asking could never notice anything new. A browser slows a hidden
 *     tab's timers, so such a notification can be late.
 *
 * What it does not do: there is no push service, no service worker and no
 * request to any other host. Close the last console tab and nothing arrives.
 *
 * Polling, not Supabase Realtime, for the reason the Live Chats feed gives:
 * the staff session cookies are HttpOnly and scoped to /control, so the
 * browser holds no staff session to open a realtime channel with.
 */
import {
  DEFAULT_NOTIFY_PREF,
  NOTIFY_EVENT,
  NOTIFY_KEY,
  NOTIFY_KINDS,
  NOTIFY_POLL_MS,
  parseNotifyPref,
  readNotifyRaw,
  writeNotifyPref,
  type NotifyFeed,
  type NotifyItem,
  type NotifyPref,
} from "@/components/control/notify";

const FEED_URL = "/control/notifications/feed";
const READ_URL = "/control/notifications/read";
/** A burst of new lines becomes one summary instead of a column of pop-ups. */
const MAX_RAISED = 3;

export type NotifyPermission = "unsupported" | "default" | "granted" | "denied";

export type NotifyState = {
  /** "idle" until the first answer; "failed" while the latest request did not get one */
  status: "idle" | "ok" | "failed";
  unread: number;
  items: NotifyItem[];
  /** this browser's choice (gxc:notify) */
  pref: NotifyPref;
  permission: NotifyPermission;
};

const SERVER_STATE: NotifyState = { status: "idle", unread: 0, items: [], pref: DEFAULT_NOTIFY_PREF, permission: "default" };

let state: NotifyState = SERVER_STATE;
const listeners = new Set<() => void>();
let timer: number | undefined;
/** the highest id any answer has carried; null until the first answer, which is the baseline and raises nothing */
let seen: number | null = null;
let inFlight = false;

function set(next: Partial<NotifyState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function readPermission(): NotifyPermission {
  try {
    if (typeof window === "undefined" || typeof window.Notification !== "function") return "unsupported";
    const p = window.Notification.permission;
    return p === "granted" || p === "denied" ? p : "default";
  } catch {
    return "unsupported";
  }
}

const browserOn = () => state.pref.browser && state.permission === "granted";
const inBackground = () => document.visibilityState !== "visible" || !document.hasFocus();

function isItem(v: unknown): v is NotifyItem {
  if (typeof v !== "object" || v === null) return false;
  const i = v as Record<string, unknown>;
  return (
    typeof i.id === "number" &&
    typeof i.title === "string" &&
    typeof i.at === "string" &&
    typeof i.read === "boolean" &&
    typeof i.kind === "string" &&
    (NOTIFY_KINDS as readonly string[]).includes(i.kind) &&
    // a path inside the console and nothing else: this is where a click goes
    typeof i.href === "string" &&
    /^\/control(\/[A-Za-z0-9-]+)*$/.test(i.href)
  );
}

function isFeed(v: unknown): v is NotifyFeed {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return f.ok === true && typeof f.unread === "number" && Array.isArray(f.items) && f.items.every(isItem);
}

/** Raises the computer's own notification for one line. The title is the console's own non-personal sentence. */
function raiseOne(title: string, href: string, tag: string): void {
  try {
    // the same tag in two console tabs is one notification, not two
    const note = new window.Notification(title, { tag, body: "GIO4X Service Console" });
    note.onclick = () => {
      try {
        window.focus();
        note.close();
      } catch {
        /* focusing is a courtesy */
      }
      window.location.assign(href);
    };
  } catch {
    // some browsers allow notifications only from a service worker: say so on the panel instead of failing quietly
    set({ permission: "unsupported" });
  }
}

function raise(fresh: NotifyItem[]): void {
  if (fresh.length > MAX_RAISED) {
    raiseOne(`${fresh.length} new notifications`, "/control/notifications", "gxc-notify-many");
    return;
  }
  // oldest first, so the newest ends on top
  for (const item of [...fresh].sort((a, b) => a.id - b.id)) raiseOne(item.title, item.href, `gxc-notify-${item.id}`);
}

async function poll(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const res = await fetch(FEED_URL, { cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" } });
    const body: unknown = res.ok ? await res.json() : null;
    if (!isFeed(body)) {
      set({ status: "failed" });
      return;
    }
    const top = body.items.reduce((max, item) => Math.max(max, item.id), 0);
    const fresh = seen === null ? [] : body.items.filter((item) => !item.read && item.id > (seen ?? 0));
    seen = Math.max(seen ?? 0, top);
    // the permission can be changed in the browser's own settings at any time; "unsupported" (see raiseOne) stays
    set({ status: "ok", unread: body.unread, items: body.items, permission: state.permission === "unsupported" ? "unsupported" : readPermission() });
    if (fresh.length && browserOn() && inBackground()) raise(fresh);
  } catch {
    set({ status: "failed" });
  } finally {
    inFlight = false;
  }
}

function tick(): void {
  // a hidden tab keeps asking only when the person wants to be told on this computer
  if (document.visibilityState === "visible" || browserOn()) void poll();
}

function onVisibility(): void {
  if (document.visibilityState === "visible") void poll();
}

function onStorage(e: StorageEvent): void {
  // another console tab changed the choice
  if (e.key === null || e.key === NOTIFY_KEY) set({ pref: parseNotifyPref(readNotifyRaw()) });
}

function onPref(e: Event): void {
  const detail = (e as CustomEvent<NotifyPref>).detail;
  set({ pref: { browser: detail?.browser === true } });
}

function start(): void {
  set({ pref: parseNotifyPref(readNotifyRaw()), permission: readPermission() });
  void poll();
  timer = window.setInterval(tick, NOTIFY_POLL_MS);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("storage", onStorage);
  window.addEventListener(NOTIFY_EVENT, onPref);
}

function stop(): void {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("storage", onStorage);
  window.removeEventListener(NOTIFY_EVENT, onPref);
}

export function subscribeNotify(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

export const getNotifyState = (): NotifyState => state;
export const getNotifyServerState = (): NotifyState => SERVER_STATE;

/** Ask now (the panel was opened). */
export function refreshNotify(): void {
  void poll();
}

/**
 * Marks the named notifications read, or all of them. The panel changes at
 * once; the database is then told, and whatever it says next is what stands.
 */
export async function markNotifyRead(ids: number[] | "all"): Promise<void> {
  const hit = (item: NotifyItem) => !item.read && (ids === "all" || ids.includes(item.id));
  const changed = state.items.filter(hit).length;
  if (ids !== "all" && changed === 0) return;
  set({ items: state.items.map((item) => (hit(item) ? { ...item, read: true } : item)), unread: ids === "all" ? 0 : Math.max(0, state.unread - changed) });
  try {
    const res = await fetch(READ_URL, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(ids === "all" ? { all: true } : { ids }),
    });
    if (!res.ok) void poll();
  } catch {
    void poll();
  }
}

/**
 * "Also notify me on this computer". Must be called from the click itself:
 * a browser shows its permission question only in answer to a gesture.
 */
export async function requestBrowserNotify(): Promise<void> {
  if (readPermission() === "unsupported") {
    set({ permission: "unsupported" });
    return;
  }
  let answer: string = window.Notification.permission;
  try {
    if (answer !== "granted") answer = await window.Notification.requestPermission();
  } catch {
    answer = readPermission();
  }
  const permission: NotifyPermission = answer === "granted" || answer === "denied" ? answer : "default";
  set({ permission });
  if (permission === "granted") writeNotifyPref({ browser: true });
}

/** Switch it off for this browser. The browser's own permission is left as it is: only the browser can withdraw it. */
export function stopBrowserNotify(): void {
  writeNotifyPref({ browser: false });
}
