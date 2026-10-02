/**
 * The rules of the enquiry import, shared by the screen (which previews every
 * row before anything is sent) and the server action (which checks every row
 * again before the database does, a third time, with the table's own
 * constraints in leads_import(), 0017).
 *
 * A row is held to the same rules as "Add an enquiry"
 * (src/app/control/actions-leads.ts): the same cleaning, the same limits, the
 * same lists. Pure functions and plain data: safe in the browser and on the
 * server.
 */
import { CONTACT_TOPICS, MANUAL_LEAD_SOURCE_LABEL, MANUAL_LEAD_SOURCES } from "@/lib/server/constants";
import { cleanLine, cleanText, MESSAGE_MAX, NAME_MAX, normaliseEmail } from "@/lib/server/validate";

/** A file may hold this many enquiries (the header row not counted). */
export const IMPORT_MAX_ROWS = 500;
/** 1 MB. */
export const IMPORT_MAX_BYTES = 1024 * 1024;
/** Rows per call of leads_import(); the database refuses more. */
export const IMPORT_BATCH = 25;
/** Rows shown before importing. Every row is checked; this many are drawn. */
export const IMPORT_PREVIEW = 20;

export const IMPORT_FIELDS = ["name", "email", "phone", "country", "topic", "message", "how"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABEL: Record<ImportField, string> = {
  name: "Name",
  email: "E-mail address",
  phone: "Phone",
  country: "Country",
  topic: "Topic",
  message: "Note",
  how: "How it came about",
};

/** The source recorded when a row does not say how the enquiry came about. Must equal the default in leads_import() (0017). */
export const IMPORT_SOURCE = "import";
export const IMPORT_SOURCES = [...MANUAL_LEAD_SOURCES, IMPORT_SOURCE] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];
export const IMPORT_SOURCE_LABEL: Record<ImportSource, string> = { ...MANUAL_LEAD_SOURCE_LABEL, import: "Imported from a file" };

/** One enquiry as it is sent: cleaned, with "" for a phone or country that was not given. */
export type ImportRow = Record<ImportField, string>;

/**
 * Why a row was not imported. The first eight are a field of the row; the
 * database answers with the same codes (leads_import, 0017).
 *   address_limit  the address already has three enquiries in the last hour
 *   shape          the row is not seven pieces of text
 *   other          the database refused it for a reason this list does not name
 */
export const IMPORT_REASONS = ["name", "email", "phone", "country", "topic", "message", "how", "address_limit", "shape", "other"] as const;
export type ImportReason = (typeof IMPORT_REASONS)[number];

export const IMPORT_REASON_TEXT: Record<ImportReason, string> = {
  name: `The name is missing or longer than ${NAME_MAX} characters.`,
  email: "The e-mail address is missing or not valid. Plain letters and digits only, for example name@example.com.",
  phone: "The phone number must be 5 to 40 digits, spaces and + ( ) . / - only, or left empty.",
  country: "The country is longer than 80 characters.",
  topic: "The topic is missing or is not one of the console’s topics.",
  message: `The note is missing or longer than ${MESSAGE_MAX.toLocaleString("en-GB")} characters.`,
  how: "“How it came about” is not one of the console’s choices.",
  address_limit: "This address already has three enquiries in the last hour. Add a note to the existing enquiry instead, or import the row later.",
  shape: "The row could not be read.",
  other: "The database did not accept the row.",
};

/** What happened to one row that was sent. */
export type ImportOutcome = { result: "ok" } | { result: "duplicate" } | { result: "invalid"; reason: ImportReason };

/**
 * What importLeadBatch() answers with. `ok` carries one outcome per row sent,
 * in order; every other code means that nothing in the batch was imported.
 */
export type ImportBatchResult = { code: "ok"; results: ImportOutcome[] } | { code: "signed-out" | "forbidden" | "invalid" | "unavailable" | "save" };

// the same pattern as the public contact form, "Add an enquiry" and `leads_phone_valid`
const PHONE = /^[0-9+() ./-]{5,40}$/;
const COUNTRY_MAX = 80;

const TOPIC_BY_LOWER = new Map<string, string>(CONTACT_TOPICS.map((t) => [t.toLowerCase(), t]));
// a file may say "telephone" or "Telephone call": the key or the label, in any case
const SOURCE_BY_LOWER = new Map<string, ImportSource>(IMPORT_SOURCES.flatMap((s) => [[s, s] as const, [IMPORT_SOURCE_LABEL[s].toLowerCase(), s] as const]));

/** The topic as the console spells it, or null when it is not one of the console's topics. */
export function matchTopic(value: string): string | null {
  return TOPIC_BY_LOWER.get(cleanLine(value).toLowerCase()) ?? null;
}

/** The source key for what a file says; empty means "imported from a file"; null when it is not a choice the console offers. */
export function matchSource(value: string): ImportSource | null {
  const v = cleanLine(value).toLowerCase();
  if (!v) return IMPORT_SOURCE;
  return SOURCE_BY_LOWER.get(v) ?? null;
}

/**
 * One row against the rules of "Add an enquiry". Returns the cleaned row, or
 * every field that is wrong. Never echoes a value.
 */
export function validateImportRow(input: Record<ImportField, string>): { ok: true; row: ImportRow } | { ok: false; reasons: ImportReason[] } {
  const reasons: ImportReason[] = [];

  const name = cleanLine(input.name);
  if (!name || name.length > NAME_MAX) reasons.push("name");

  const email = normaliseEmail(input.email);
  if (!email) reasons.push("email");

  const phone = cleanLine(input.phone);
  if (phone && !PHONE.test(phone)) reasons.push("phone");

  const country = cleanLine(input.country);
  if (country.length > COUNTRY_MAX) reasons.push("country");

  const topic = matchTopic(input.topic);
  if (!topic) reasons.push("topic");

  const message = cleanText(input.message);
  if (!message || message.length > MESSAGE_MAX) reasons.push("message");

  const how = matchSource(input.how);
  if (!how) reasons.push("how");

  if (reasons.length || !email || !topic || !how) return { ok: false, reasons: reasons.length ? reasons : ["other"] };
  return { ok: true, row: { name, email, phone, country, topic, message, how } };
}

/** What makes two rows the same enquiry: the address and the note (the rule leads_import() applies). */
export function importKey(row: ImportRow): string {
  return `${row.email}\n${row.message}`;
}
