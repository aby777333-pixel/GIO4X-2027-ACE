/**
 * The notifications centre: what the bell, the Notifications page and the two
 * routes behind them share (table `staff_notifications`, 0018_personal.sql).
 *
 * A notification is a kind, a short title written by the database (a fixed
 * sentence and at most a reference: never a customer's name or address), and
 * the thing to open. Nothing here reads the database.
 *
 * It also holds the one thing the centre keeps in the browser: whether this
 * browser should also raise the computer's own notifications. Like the
 * console's look (`gxc:look`, look.ts) it belongs to the console alone, is
 * kept under one localStorage key, `gxc:notify`, as JSON `{ browser }`, is
 * never sent to a server, and neither reads nor changes the public site's
 * preferences (`gx:prefs`). There is no push service and no service worker:
 * a notification can only be raised by a console tab that is open.
 */
import type { StaffNotificationRow } from "@/lib/supabase/types";

/** Must equal `staff_notifications_kind_valid` in 0018_personal.sql. */
export const NOTIFY_KINDS = ["ticket.assigned", "ticket.customer_reply", "lead.assigned", "task.assigned", "staff.approval", "blog.review", "chat.waiting"] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];

/** What each kind is, in a word or two, for the label beside a line. */
export const NOTIFY_KIND_LABEL: Record<NotifyKind, string> = {
  "ticket.assigned": "Ticket",
  "ticket.customer_reply": "Ticket reply",
  "lead.assigned": "Enquiry",
  "task.assigned": "Follow-up",
  "staff.approval": "Approval",
  "blog.review": "Blog review",
  "chat.waiting": "Live chat",
};

/** One notification as the console shows it. `href` is built on the server from an allow-list, never from the title. */
export type NotifyItem = { id: number; kind: NotifyKind; title: string; href: string; at: string; read: boolean };

/** What GET /control/notifications/feed answers. */
export type NotifyFeed = { ok: true; at: string; unread: number; items: NotifyItem[] };

/** How many the bell's panel lists, and how often it asks. */
export const NOTIFY_PANEL_SIZE = 30;
export const NOTIFY_POLL_MS = 30_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isKind(value: string): value is NotifyKind {
  return (NOTIFY_KINDS as readonly string[]).includes(value);
}

/**
 * Where a notification leads. Must know the same entities as
 * `staff_notifications_entity_valid` (0018). An id that is not a uuid, or an
 * entity this console does not know, leads to the Notifications page itself.
 */
export function notifyHref(entity: string, entityId: string): string {
  const id = UUID.test(entityId) ? entityId : "";
  if (entity === "ticket" && id) return `/control/tickets/${id}`;
  if (entity === "lead" && id) return `/control/leads/${id}`;
  if (entity === "blog_post" && id) return `/control/blog/${id}`;
  if (entity === "staff_change") return "/control/staff";
  if (entity === "chat") return "/control/chats";
  return "/control/notifications";
}

/** A row as the console shows it; null for a kind this version of the console does not know. */
export function notifyItem(row: Pick<StaffNotificationRow, "id" | "kind" | "title" | "entity" | "entity_id" | "created_at" | "read_at">): NotifyItem | null {
  if (!isKind(row.kind)) return null;
  return { id: Number(row.id), kind: row.kind, title: row.title, href: notifyHref(row.entity, row.entity_id), at: row.created_at, read: row.read_at !== null };
}

export const NOTIFY_COLUMNS = "id, kind, title, entity, entity_id, created_at, read_at";

/* -------------------------------------------------------------------------- */
/* this browser's choice                                                      */
/* -------------------------------------------------------------------------- */

export const NOTIFY_KEY = "gxc:notify";
/** Dispatched on `window` after the choice changes in this tab. */
export const NOTIFY_EVENT = "gxc:notify";

export type NotifyPref = { browser: boolean };
export const DEFAULT_NOTIFY_PREF: NotifyPref = { browser: false };

/** What was stored, reduced to a choice. Anything unreadable or unknown is "off". */
export function parseNotifyPref(raw: string | null | undefined): NotifyPref {
  if (!raw) return DEFAULT_NOTIFY_PREF;
  try {
    const v = JSON.parse(raw) as { browser?: unknown } | null;
    return { browser: typeof v === "object" && v !== null && v.browser === true };
  } catch {
    return DEFAULT_NOTIFY_PREF;
  }
}

/** The stored value as it is, or "" when there is none or storage cannot be read. */
export function readNotifyRaw(): string {
  try {
    return window.localStorage.getItem(NOTIFY_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Remembers the choice in this browser and tells every bell on the page. Switching it off removes the key. */
export function writeNotifyPref(pref: NotifyPref): void {
  try {
    if (pref.browser) window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(pref));
    else window.localStorage.removeItem(NOTIFY_KEY);
  } catch {
    /* storage unavailable: the choice holds for this page and is not remembered */
  }
  window.dispatchEvent(new CustomEvent<NotifyPref>(NOTIFY_EVENT, { detail: pref }));
}
