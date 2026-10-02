/**
 * The customer timeline and the notes about a person: what the page, the
 * "load older" route, the views and the note action share
 * (supabase/migrations/0019_timeline.sql). Nothing here reads the database.
 *
 * person_timeline() decides which kinds of event a caller receives. The lists
 * below only name them, so that a kind this version of the console does not
 * know is dropped instead of being drawn wrongly.
 */
import type { IconName } from "@/components/control/icons";
import type { Json, PersonTimelineRow } from "@/lib/supabase/types";

/** Must equal the kinds person_timeline() returns (0019). */
export const TIMELINE_KINDS = [
  "enquiry_received",
  "enquiry_entered",
  "enquiry_status",
  "enquiry_stage",
  "enquiry_note",
  "followup_created",
  "followup_completed",
  "ticket_opened",
  "ticket_customer_message",
  "ticket_staff_reply",
  "ticket_internal_note",
  "ticket_status",
  "ticket_escalated",
  "newsletter_joined",
  "newsletter_left",
  "person_note",
] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export const TIMELINE_KIND_LABEL: Record<TimelineKind, string> = {
  enquiry_received: "Enquiry received",
  enquiry_entered: "Enquiry entered by staff",
  enquiry_status: "Enquiry status changed",
  enquiry_stage: "Enquiry stage changed",
  enquiry_note: "Note on an enquiry",
  followup_created: "Follow-up created",
  followup_completed: "Follow-up completed",
  ticket_opened: "Ticket opened",
  ticket_customer_message: "Message from the customer",
  ticket_staff_reply: "Reply from staff",
  ticket_internal_note: "Internal note on a ticket",
  ticket_status: "Ticket status changed",
  ticket_escalated: "Ticket escalated",
  newsletter_joined: "Subscribed to the newsletter",
  newsletter_left: "Unsubscribed from the newsletter",
  person_note: "Note about this person",
};

/** One of the console's own icons per kind. Decorative: the label beside it says what happened. */
export const TIMELINE_KIND_ICON: Record<TimelineKind, IconName> = {
  enquiry_received: "leads",
  enquiry_entered: "leads",
  enquiry_status: "clock",
  enquiry_stage: "pipeline",
  enquiry_note: "documents",
  followup_created: "tasks",
  followup_completed: "tasks",
  ticket_opened: "tickets",
  ticket_customer_message: "chats",
  ticket_staff_reply: "emailer",
  ticket_internal_note: "documents",
  ticket_status: "clock",
  ticket_escalated: "command",
  newsletter_joined: "subscribers",
  newsletter_left: "subscribers",
  person_note: "customers",
};

/** The filter in the address (`?show=`). "all" is the default and is not written. */
export const TIMELINE_FILTERS = ["all", "enquiries", "tickets", "notes", "newsletter"] as const;
export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

export const TIMELINE_FILTER_LABEL: Record<TimelineFilter, string> = {
  all: "Everything",
  enquiries: "Enquiries",
  tickets: "Tickets",
  notes: "Internal notes",
  newsletter: "Newsletter",
};

/** What each filter asks person_timeline() for. "Internal notes" gathers the three places staff write about a person. */
export const TIMELINE_FILTER_KINDS: Record<Exclude<TimelineFilter, "all">, readonly TimelineKind[]> = {
  enquiries: ["enquiry_received", "enquiry_entered", "enquiry_status", "enquiry_stage", "enquiry_note", "followup_created", "followup_completed"],
  tickets: ["ticket_opened", "ticket_customer_message", "ticket_staff_reply", "ticket_internal_note", "ticket_status", "ticket_escalated"],
  notes: ["person_note", "enquiry_note", "ticket_internal_note"],
  newsletter: ["newsletter_joined", "newsletter_left"],
};

export function isTimelineFilter(value: unknown): value is TimelineFilter {
  return typeof value === "string" && (TIMELINE_FILTERS as readonly string[]).includes(value);
}

/** How many events a page asks for. A page can be a little longer: events sharing one instant are never split. */
export const TIMELINE_PAGE = 40;

/** The key a person is addressed by (person_key in 0009_insight.sql). */
export const PERSON_KEY = /^[0-9a-f]{32}$/;

/**
 * The paging cursor: a timestamp exactly as the database wrote it (microseconds
 * and all, so that nothing between two pages is skipped). It is a time and
 * nothing else; anything that does not look like one is ignored.
 */
export const TIMELINE_CURSOR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

export const NOTE_MAX = 2000;
/** Must equal `person_notes_mentions_valid` (0019). */
export const NOTE_MENTIONS_MAX = 20;

export type TimelineEvent = {
  id: string;
  at: string;
  kind: TimelineKind;
  /** one line; message and note text is already cut by the database */
  summary: string;
  actor: string | null;
  actor_name: string | null;
  entity: string;
  entity_id: string | null;
  reference: string | null;
  /** small facts about the event (from, to, reason, internal, how, category): strings only, anything else is dropped */
  detail: Record<string, string>;
};

export type TimelinePage = { events: TimelineEvent[]; hasOlder: boolean };

function isKind(value: unknown): value is TimelineKind {
  return typeof value === "string" && (TIMELINE_KINDS as readonly string[]).includes(value);
}

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

function flatDetail(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return out;
  for (const [key, v] of Object.entries(value as { [key: string]: Json | undefined })) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[key] = String(v).slice(0, 200);
  }
  return out;
}

/**
 * Rows of person_timeline(), or the same rows as they come back from the
 * console's own route, checked before anything is drawn. A row that is not an
 * event this console knows is left out.
 */
export function asTimelinePage(rows: unknown): TimelinePage {
  const events: TimelineEvent[] = [];
  let hasOlder = false;
  if (!Array.isArray(rows)) return { events, hasOlder };
  for (const raw of rows as unknown[]) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Partial<Record<keyof PersonTimelineRow, unknown>>;
    if (row.has_older === true) hasOlder = true;
    const id = text(row.id);
    const at = text(row.at);
    if (!id || !at || !isKind(row.kind) || Number.isNaN(new Date(at).getTime())) continue;
    events.push({
      id,
      at,
      kind: row.kind,
      summary: text(row.summary) ?? "",
      actor: text(row.actor),
      actor_name: text(row.actor_name),
      entity: text(row.entity) ?? "",
      entity_id: text(row.entity_id),
      reference: text(row.reference),
      detail: flatDetail(row.detail),
    });
  }
  return { events, hasOlder };
}

/* -------------------------------------------------------------------------- */
/* mentions                                                                   */
/* -------------------------------------------------------------------------- */

const WORD = /[\p{L}\p{N}_]/u;

export type MentionSpan = { start: number; end: number; name: string };

/**
 * Where "@Display Name" stands in a text, for the names given. The longest
 * name wins ("@Ann Lee" is Ann Lee, not Ann), the "@" must not follow a letter
 * or digit (so an e-mail address is never a mention), and the name must end
 * where a word ends. The same function resolves a note on the server and
 * highlights it on the page, so the two cannot disagree.
 */
export function findMentions(body: string, names: readonly string[]): MentionSpan[] {
  const sorted = [...new Set(names)].filter((n) => n.length > 0).sort((a, b) => b.length - a.length);
  const out: MentionSpan[] = [];
  if (!sorted.length) return out;
  let i = body.indexOf("@");
  while (i !== -1) {
    const before = i > 0 ? (body[i - 1] ?? "") : "";
    let found: string | null = null;
    if (!before || !WORD.test(before)) {
      for (const name of sorted) {
        if (!body.startsWith(name, i + 1)) continue;
        const after = body[i + 1 + name.length] ?? "";
        if (!after || !WORD.test(after)) {
          found = name;
          break;
        }
      }
    }
    if (found) {
      out.push({ start: i, end: i + 1 + found.length, name: found });
      i = body.indexOf("@", i + 1 + found.length);
    } else {
      i = body.indexOf("@", i + 1);
    }
  }
  return out;
}

/** A text cut into plain pieces and mentions, in order, for drawing. */
export function splitMentions(body: string, names: readonly string[]): { text: string; mention: boolean }[] {
  const parts: { text: string; mention: boolean }[] = [];
  let at = 0;
  for (const span of findMentions(body, names)) {
    if (span.start > at) parts.push({ text: body.slice(at, span.start), mention: false });
    parts.push({ text: body.slice(span.start, span.end), mention: true });
    at = span.end;
  }
  if (at < body.length) parts.push({ text: body.slice(at), mention: false });
  return parts;
}
