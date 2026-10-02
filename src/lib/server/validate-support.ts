/**
 * Input validation for the support endpoints. Same rules as validate.ts:
 * allow-list of top-level fields, every string normalised before it is
 * measured, messages written for the visitor that never echo what was sent.
 *
 * The database repeats these bounds as CHECK constraints
 * (supabase/migrations/0007_support.sql). Keep the two in step.
 */
import { TICKET_CATEGORIES } from "@/lib/server/constants";
import { cleanLine, cleanText, MESSAGE_MAX, NAME_MAX, normaliseEmail, normalisePath, type FieldErrors, type Result } from "@/lib/server/validate";
import { normaliseTicketReference } from "@/lib/support";
import type { TicketCategory } from "@/lib/supabase/types";

export const SUBJECT_MAX = 160;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reject any key outside the allow-list (no mass assignment: `status`, `priority` and friends can never arrive). */
function unexpected(input: Record<string, unknown>, allowed: readonly string[], fields: FieldErrors): void {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) {
      // the key itself is caller-controlled: bound it and keep it printable
      const safe = key.replace(/[^A-Za-z0-9_.-]/g, "?").slice(0, 40) || "?";
      fields[safe] = "Unexpected field.";
    }
  }
}

const NOT_AN_OBJECT: FieldErrors = { _: "The request must be a JSON object." };

/* -------------------------------------------------------------------------- */
/* open a ticket                                                              */
/* -------------------------------------------------------------------------- */

export type TicketInput = {
  name: string;
  email: string;
  category: TicketCategory;
  subject: string;
  message: string;
  page: string;
  startedAt: number;
};

const TICKET_FIELDS = ["name", "email", "category", "subject", "message", "privacyAccepted", "website", "startedAt", "page"] as const;

export function validateTicket(raw: unknown): Result<TicketInput> {
  if (!isPlainObject(raw)) return { ok: false, fields: NOT_AN_OBJECT };
  const fields: FieldErrors = {};
  unexpected(raw, TICKET_FIELDS, fields);

  let name = "";
  if (typeof raw.name !== "string" || !cleanLine(raw.name)) fields.name = "Please enter your name.";
  else {
    name = cleanLine(raw.name);
    if (name.length > NAME_MAX) fields.name = `Your name must be ${NAME_MAX} characters or fewer.`;
  }

  const email = normaliseEmail(raw.email);
  if (!email) fields.email = "Please enter a valid email address.";

  let category: TicketCategory = "other";
  if (typeof raw.category === "string" && (TICKET_CATEGORIES as readonly string[]).includes(raw.category)) category = raw.category as TicketCategory;
  else fields.category = "Please choose what the request is about.";

  let subject = "";
  if (typeof raw.subject !== "string" || !cleanLine(raw.subject)) fields.subject = "Please give the request a short subject.";
  else {
    subject = cleanLine(raw.subject);
    if (subject.length > SUBJECT_MAX) fields.subject = `The subject must be ${SUBJECT_MAX} characters or fewer.`;
  }

  let message = "";
  if (typeof raw.message !== "string" || !cleanText(raw.message)) fields.message = "Please describe what you need help with.";
  else {
    message = cleanText(raw.message);
    if (message.length > MESSAGE_MAX) fields.message = `Your message must be ${MESSAGE_MAX} characters or fewer.`;
  }

  if (raw.privacyAccepted !== true) fields.privacyAccepted = "Please confirm that you have read how your message is handled.";

  if (raw.website !== undefined && typeof raw.website !== "string") fields.website = "Unexpected value.";

  let startedAt = 0;
  if (typeof raw.startedAt === "number" && Number.isFinite(raw.startedAt) && raw.startedAt > 0) startedAt = raw.startedAt;
  else fields.startedAt = "The form could not be verified. Please reload the page and try again.";

  const page = normalisePath(raw.page);
  if (!page) fields.page = "The page reference is not valid.";

  if (Object.keys(fields).length || !email || !page) return { ok: false, fields };
  return { ok: true, value: { name, email, category, subject, message, page, startedAt } };
}

/* -------------------------------------------------------------------------- */
/* read a thread, reply to it                                                 */
/* -------------------------------------------------------------------------- */

export type TicketLookupInput = { reference: string; email: string };
export type TicketReplyInput = TicketLookupInput & { body: string };

/**
 * Only the SHAPE of the pair is judged here ("that is not what a reference
 * looks like"), which says nothing about whether a ticket exists. Whether the
 * pair matches one is answered by the database, with a single message.
 */
function readPair(raw: Record<string, unknown>, fields: FieldErrors): TicketLookupInput | null {
  const reference = normaliseTicketReference(raw.reference);
  if (!reference) fields.reference = "A reference is TK- followed by eight letters and digits, for example TK-ABCD2345.";
  const email = normaliseEmail(raw.email);
  if (!email) fields.email = "Please enter a valid email address.";
  return reference && email ? { reference, email } : null;
}

export function validateTicketLookup(raw: unknown): Result<TicketLookupInput> {
  if (!isPlainObject(raw)) return { ok: false, fields: NOT_AN_OBJECT };
  const fields: FieldErrors = {};
  unexpected(raw, ["reference", "email"], fields);
  const pair = readPair(raw, fields);
  if (Object.keys(fields).length || !pair) return { ok: false, fields };
  return { ok: true, value: pair };
}

export function validateTicketReply(raw: unknown): Result<TicketReplyInput> {
  if (!isPlainObject(raw)) return { ok: false, fields: NOT_AN_OBJECT };
  const fields: FieldErrors = {};
  unexpected(raw, ["reference", "email", "body"], fields);
  const pair = readPair(raw, fields);

  let body = "";
  if (typeof raw.body !== "string" || !cleanText(raw.body)) fields.body = "Please write your reply.";
  else {
    body = cleanText(raw.body);
    if (body.length > MESSAGE_MAX) fields.body = `Your reply must be ${MESSAGE_MAX} characters or fewer.`;
  }

  if (Object.keys(fields).length || !pair) return { ok: false, fields };
  return { ok: true, value: { ...pair, body } };
}
