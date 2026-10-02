"use server";

/**
 * Server action for the enquiry import: one batch of at most 25 rows.
 *
 * The file is read and checked in the browser; this receives rows, never a
 * file. The same rules as src/app/control/actions.ts: who is calling is
 * established again, the capabilities (leads.write AND leads.import) are
 * checked here and again in the database, every row is validated again with
 * the rules of "Add an enquiry", and the write runs AS THE SIGNED-IN USER
 * through leads_import() (supabase/migrations/0017_bulk.sql). That function
 * marks each row as staff-entered with NO consent evidence, skips duplicates,
 * reports each row's outcome and writes one audit entry with counts only.
 *
 * It answers instead of redirecting, because the screen sends several batches
 * and shows the outcome of every row. The answer is fixed codes: nothing a
 * caller sent and nothing the database said is returned. The rows travel in
 * the request body, never in a URL, and are not logged.
 */
import { IMPORT_BATCH, IMPORT_FIELDS, IMPORT_REASONS, validateImportRow, type ImportBatchResult, type ImportField, type ImportOutcome, type ImportReason, type ImportRow } from "@/lib/lead-import";
import { can, getAccess } from "@/lib/server/staff";
import type { Json } from "@/lib/supabase/types";

/** Longer than any field may be after cleaning: a bound on what is even looked at. */
const FIELD_CAP = 20_000;

const isPlain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A row as sent by the screen: exactly the seven fields, each a string. */
function readRow(value: unknown): Record<ImportField, string> | null {
  if (!isPlain(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== IMPORT_FIELDS.length) return null;
  const row = {} as Record<ImportField, string>;
  for (const field of IMPORT_FIELDS) {
    const v = value[field];
    if (typeof v !== "string" || v.length > FIELD_CAP) return null;
    row[field] = v;
  }
  return row;
}

function readOutcome(value: unknown): ImportOutcome | null {
  if (!isPlain(value)) return null;
  if (value.result === "ok" || value.result === "duplicate") return { result: value.result };
  if (value.result !== "invalid") return null;
  const reason = (IMPORT_REASONS as readonly unknown[]).includes(value.reason) ? (value.reason as ImportReason) : "other";
  return { result: "invalid", reason };
}

export async function importLeadBatch(rows: unknown): Promise<ImportBatchResult> {
  const access = await getAccess();
  if (access.state === "anonymous") return { code: "signed-out" };
  if (access.state === "unconfigured" || access.state === "unavailable") return { code: "unavailable" };
  if (access.state !== "staff" || !can(access, "leads.write") || !can(access, "leads.import")) return { code: "forbidden" };

  if (!Array.isArray(rows) || rows.length < 1 || rows.length > IMPORT_BATCH) return { code: "invalid" };

  // every row is checked again here; one that fails is reported and not sent
  const results: (ImportOutcome | null)[] = [];
  const send: ImportRow[] = [];
  for (const raw of rows) {
    const read = readRow(raw);
    if (!read) return { code: "invalid" };
    const checked = validateImportRow(read);
    if (checked.ok) {
      send.push(checked.row);
      results.push(null);
    } else {
      results.push({ result: "invalid", reason: checked.reasons[0] ?? "other" });
    }
  }

  if (send.length > 0) {
    const payload: Json = send.map((row) => ({ name: row.name, email: row.email, phone: row.phone || null, country: row.country || null, topic: row.topic, message: row.message, how: row.how }));
    let answer: unknown;
    try {
      const { data, error } = await access.supabase.rpc("leads_import", { p_rows: payload });
      if (error) {
        // The database's refusals as fixed codes; nothing the database said is shown.
        if (error.code === "42501") return { code: "forbidden" };
        if (error.code === "22023") return { code: "invalid" };
        return { code: "save" };
      }
      answer = data;
    } catch {
      return { code: "save" };
    }

    // one outcome per row sent, in order; anything else is not an answer this code understands
    if (!Array.isArray(answer) || answer.length !== send.length) return { code: "save" };
    let next = 0;
    for (let i = 0; i < results.length; i++) {
      if (results[i] !== null) continue;
      const outcome = readOutcome(answer[next]);
      next += 1;
      if (!outcome) return { code: "save" };
      results[i] = outcome;
    }
  }

  return { code: "ok", results: results.map((r) => r ?? { result: "invalid", reason: "other" }) };
}
