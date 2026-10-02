/**
 * Support requests: the small pieces the server routes and the page both need.
 * Nothing here touches the network, the database or the environment, so it is
 * safe to import from a client component.
 */
import type { TicketCategory, TicketPublicView, TicketStatus } from "@/lib/supabase/types";

/** `TK-` + 8 characters of RFC 4648 base32. Must equal `tickets_reference_format` in 0007_support.sql. */
export const TICKET_REFERENCE = /^TK-[A-Z2-7]{8}$/;

/**
 * A reference as a person types it: any case, stray spaces, with or without
 * the `TK-` prefix or its hyphen, and a zero where the letter O was meant
 * (the alphabet has no zero, so that reading is never ambiguous). Returns the
 * stored form, or null when it cannot be a reference at all.
 */
export function normaliseTicketReference(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const compact = value.toUpperCase().replace(/[\s‐-―-]+/g, "").replace(/0/g, "O");
  const body = compact.startsWith("TK") && compact.length === 10 ? compact.slice(2) : compact;
  const reference = `TK-${body}`;
  return TICKET_REFERENCE.test(reference) ? reference : null;
}

const CATEGORIES: readonly TicketCategory[] = ["account", "platform", "funding", "technical", "complaint", "privacy", "security", "other"];
const STATUSES: readonly TicketStatus[] = ["open", "pending", "solved", "closed"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * What ticket_view() returned, checked field by field. Anything that is not
 * exactly the public view (a null for "no such ticket", an unexpected shape)
 * comes back as null, so nothing unchecked is ever passed on or rendered.
 */
export function parseTicketView(value: unknown): TicketPublicView | null {
  if (!isRecord(value)) return null;
  const { reference, created_at, category, subject, message, status, messages } = value;
  if (typeof reference !== "string" || !TICKET_REFERENCE.test(reference)) return null;
  if (typeof created_at !== "string" || typeof subject !== "string" || typeof message !== "string") return null;
  if (typeof category !== "string" || !(CATEGORIES as readonly string[]).includes(category)) return null;
  if (typeof status !== "string" || !(STATUSES as readonly string[]).includes(status)) return null;
  if (!Array.isArray(messages)) return null;

  const thread: TicketPublicView["messages"] = [];
  for (const m of messages) {
    if (!isRecord(m) || typeof m.at !== "string" || typeof m.body !== "string") return null;
    if (m.from !== "customer" && m.from !== "staff") return null;
    thread.push({ at: m.at, from: m.from, body: m.body });
  }

  return { reference, created_at, category: category as TicketCategory, subject, message, status: status as TicketStatus, messages: thread };
}
