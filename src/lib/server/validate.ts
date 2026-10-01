/**
 * Input validation for the public endpoints. Hand-written, no dependency.
 *
 * Rules
 *  - Allow-list: a top-level field that is not expected is an error (no mass
 *    assignment; `status`, `assigned_to`, `role` and friends can never arrive).
 *  - Every string is normalised before it is measured: Unicode NFC, control
 *    characters and invisible/bidirectional formatting characters removed,
 *    whitespace collapsed, ends trimmed.
 *  - The database repeats these bounds as CHECK constraints
 *    (supabase/migrations/0001_init.sql). Keep the two in step.
 *
 * Messages are written for the visitor and never echo the submitted value.
 */
import { CONTACT_TOPICS, UTM_KEYS, type ContactTopic } from "@/lib/server/constants";

export type FieldErrors = Record<string, string>;
export type Result<T> = { ok: true; value: T } | { ok: false; fields: FieldErrors };

// C0 controls + DEL + C1 controls
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;
// C0 except tab (09) and line feed (0A), + DEL + C1
const CONTROL_KEEP_BREAKS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
// zero-width and bidirectional formatting characters: invisible, and usable to
// disguise what a member of staff reads in the console
// (given as code points so that no invisible character ever sits in this file):
// soft hyphen · zero-width and directional marks · line/paragraph separators
// and embedding/override controls · word joiner and isolates · BOM
const INVISIBLE_RANGES: readonly (readonly [number, number])[] = [
  [0x00ad, 0x00ad],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
];

function stripInvisible(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (!INVISIBLE_RANGES.some(([from, to]) => code >= from && code <= to)) out += ch;
  }
  return out;
}

/** One line of text: no control characters, single spaces, trimmed. */
export function cleanLine(value: string): string {
  return stripInvisible(value.normalize("NFC")).replace(CONTROL, " ").replace(/\s+/g, " ").trim();
}

/** Multi-line text: line feeds kept (at most one blank line in a row), everything else as cleanLine. */
export function cleanText(value: string): string {
  return stripInvisible(value.normalize("NFC").replace(/\r\n?/g, "\n"))
    .replace(CONTROL_KEEP_BREAKS, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ASCII addresses only: local part of RFC 5322 atoms, then at least two domain
// labels. Mirrors the database constraint (which sees the lower-cased value).
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const PHONE = /^[0-9+() ./-]{5,40}$/;

/** Returns the normalised (lower-case) address, or null when it is not acceptable. */
export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = cleanLine(value).toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  if (!EMAIL.test(email)) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain || local.length > 64) return null;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  if (domain.split(".").some((label) => label.length === 0 || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) return null;
  return email;
}

/**
 * A same-site path. Anything that could be read as another origin is refused:
 * protocol-relative (`//host`), backslashes, whitespace, or a scheme. The query
 * string and fragment are dropped: they can carry tracking or personal data
 * and are not needed to know which page a form was on.
 */
export function normalisePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  const path = raw.split(/[?#]/, 1)[0] ?? "";
  if (path.length < 1 || path.length > 300) return null;
  if (/[\s\\\u0000-\u001F\u007F]/.test(path)) return null;
  return path;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reject any key outside the allow-list. */
function unexpected(input: Record<string, unknown>, allowed: readonly string[], fields: FieldErrors): void {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) {
      // the key itself is caller-controlled: bound it and keep it printable
      const safe = key.replace(/[^A-Za-z0-9_.-]/g, "?").slice(0, 40) || "?";
      fields[safe] = "Unexpected field.";
    }
  }
}

function optionalLine(input: Record<string, unknown>, key: string, max: number, label: string, fields: FieldErrors): string | null {
  const raw = input[key];
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    fields[key] = `${label} must be text.`;
    return null;
  }
  const value = cleanLine(raw);
  if (!value) return null;
  if (value.length > max) {
    fields[key] = `${label} must be ${max} characters or fewer.`;
    return null;
  }
  return value;
}

/**
 * utm: at most the five standard keys, short string values. Unknown keys
 * inside `utm` (utm_id and similar, which arrive on real campaign links) are
 * dropped rather than refused, so a visitor is never blocked by a tracking
 * parameter they did not choose. Nothing outside the five keys is stored.
 */
function readUtm(raw: unknown, fields: FieldErrors): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw === undefined || raw === null) return out;
  if (!isPlainObject(raw) || Object.keys(raw).length > 20) {
    fields.utm = "Campaign parameters are not valid.";
    return out;
  }
  for (const key of UTM_KEYS) {
    const v = raw[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string") {
      fields.utm = "Campaign parameters are not valid.";
      return {};
    }
    const value = cleanLine(v).slice(0, 120);
    if (value) out[key] = value;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* contact                                                                    */
/* -------------------------------------------------------------------------- */

export type ContactInput = {
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  topic: ContactTopic;
  message: string;
  accountInterest: string | null;
  marketingConsent: boolean;
  page: string;
  utm: Record<string, string>;
  startedAt: number;
};

const CONTACT_FIELDS = [
  "name",
  "email",
  "phone",
  "country",
  "topic",
  "message",
  "accountInterest",
  "privacyAccepted",
  "marketingConsent",
  "website",
  "startedAt",
  "page",
  "utm",
] as const;

export const NAME_MAX = 120;
export const MESSAGE_MAX = 5000;

export function validateContact(raw: unknown): Result<ContactInput> {
  if (!isPlainObject(raw)) return { ok: false, fields: { _: "The request must be a JSON object." } };
  const fields: FieldErrors = {};
  unexpected(raw, CONTACT_FIELDS, fields);

  let name = "";
  if (typeof raw.name !== "string" || !cleanLine(raw.name)) fields.name = "Please enter your name.";
  else {
    name = cleanLine(raw.name);
    if (name.length > NAME_MAX) fields.name = `Your name must be ${NAME_MAX} characters or fewer.`;
  }

  const email = normaliseEmail(raw.email);
  if (!email) fields.email = "Please enter a valid email address.";

  let phone = optionalLine(raw, "phone", 40, "The phone number", fields);
  if (phone && !PHONE.test(phone)) {
    fields.phone = "Please enter a phone number using digits, spaces and + ( ) - only.";
    phone = null;
  }

  const country = optionalLine(raw, "country", 80, "The country", fields);
  const accountInterest = optionalLine(raw, "accountInterest", 80, "The account type", fields);

  let topic: ContactTopic = "General";
  if (typeof raw.topic === "string" && (CONTACT_TOPICS as readonly string[]).includes(raw.topic)) topic = raw.topic as ContactTopic;
  else fields.topic = "Please choose a topic.";

  let message = "";
  if (typeof raw.message !== "string" || !cleanText(raw.message)) fields.message = "Please write your message.";
  else {
    message = cleanText(raw.message);
    if (message.length > MESSAGE_MAX) fields.message = `Your message must be ${MESSAGE_MAX} characters or fewer.`;
  }

  if (raw.privacyAccepted !== true) fields.privacyAccepted = "Please confirm that you have read how your message is handled.";

  let marketingConsent = false;
  if (raw.marketingConsent === undefined) marketingConsent = false;
  else if (typeof raw.marketingConsent === "boolean") marketingConsent = raw.marketingConsent;
  else fields.marketingConsent = "This choice must be yes or no.";

  if (raw.website !== undefined && typeof raw.website !== "string") fields.website = "Unexpected value.";

  let startedAt = 0;
  if (typeof raw.startedAt === "number" && Number.isFinite(raw.startedAt) && raw.startedAt > 0) startedAt = raw.startedAt;
  else fields.startedAt = "The form could not be verified. Please reload the page and try again.";

  const page = normalisePath(raw.page);
  if (!page) fields.page = "The page reference is not valid.";

  const utm = readUtm(raw.utm, fields);

  if (Object.keys(fields).length || !email || !page) return { ok: false, fields };
  return { ok: true, value: { name, email, phone, country, topic, message, accountInterest, marketingConsent, page, utm, startedAt } };
}

/* -------------------------------------------------------------------------- */
/* newsletter                                                                 */
/* -------------------------------------------------------------------------- */

export type NewsletterInput = { email: string; source: string; startedAt: number };

const NEWSLETTER_FIELDS = ["email", "consent", "source", "website", "startedAt"] as const;
const SOURCE = /^[A-Za-z0-9/_:.-]{1,80}$/;

export function validateNewsletter(raw: unknown): Result<NewsletterInput> {
  if (!isPlainObject(raw)) return { ok: false, fields: { _: "The request must be a JSON object." } };
  const fields: FieldErrors = {};
  unexpected(raw, NEWSLETTER_FIELDS, fields);

  const email = normaliseEmail(raw.email);
  if (!email) fields.email = "Please enter a valid email address.";

  if (raw.consent !== true) fields.consent = "Please confirm that you want to receive the newsletter.";

  // where the form sits (for example "footer" or "/intelligence"): a short token, not free text
  let source = "site";
  if (raw.source !== undefined && raw.source !== null) {
    const s = typeof raw.source === "string" ? cleanLine(raw.source) : "";
    if (!s || !SOURCE.test(s)) fields.source = "The source is not valid.";
    else source = s;
  }

  if (raw.website !== undefined && typeof raw.website !== "string") fields.website = "Unexpected value.";

  let startedAt = 0;
  if (typeof raw.startedAt === "number" && Number.isFinite(raw.startedAt) && raw.startedAt > 0) startedAt = raw.startedAt;
  else fields.startedAt = "The form could not be verified. Please reload the page and try again.";

  if (Object.keys(fields).length || !email) return { ok: false, fields };
  return { ok: true, value: { email, source, startedAt } };
}

/* -------------------------------------------------------------------------- */
/* GIO4X Control inputs                                                       */
/* -------------------------------------------------------------------------- */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * Search text for the leads list. Reduced to characters that can appear in a
 * reference or an email address, so it can be placed inside a PostgREST filter
 * without being able to alter the filter (no commas, parentheses, quotes,
 * backslashes or wildcards).
 */
export function cleanSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/[^A-Za-z0-9@._+-]/g, "")
    .slice(0, 100);
}
