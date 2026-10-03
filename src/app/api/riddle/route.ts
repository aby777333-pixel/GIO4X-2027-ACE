/**
 * POST /api/riddle
 *
 *   request   { a, b, slug, by?, website: "" (honeypot), startedAt }
 *   200       { ok: true }
 *   400 / 403 / 413 / 415 / 429 / 503   { ok: false, error, fields? }
 *
 * A reader's riddle: two lines and the glossary term that answers them, with
 * optional initials. It is stored as "pending" and shown to nobody until a
 * member of staff approves it in GIO4X Control (the table makes that so,
 * whatever is sent: supabase/migrations/0029_reader_riddles.sql). No e-mail
 * address is asked for and none is kept. Same protections as /api/contact
 * (see docs/SECURITY.md): the gate, the honeypot, the minimum time, the rate
 * limit.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasTerm } from "@/data/glossary";
import { GENERIC_RATE_LIMITED, GENERIC_UNAVAILABLE } from "@/lib/server/constants";
import { fail, json } from "@/lib/server/http";
import { classifyStorageError, honeypotFilled, openGate, submissionAllowed, tooFast } from "@/lib/server/public-form";
import { cleanLine } from "@/lib/server/validate";
import { createPublicSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = GENERIC_UNAVAILABLE.replace("record your message", "record your riddle");
const FIELDS = new Set(["a", "b", "slug", "by", "website", "startedAt"]);
const LINK = /(https?:|www\.|<|>)/i;

export async function POST(request: Request) {
  const gate = await openGate(request, "riddle");
  if (!gate.ok) return gate.response;
  if (honeypotFilled(gate.body)) return json({ ok: true });

  const raw = gate.body;
  const fields: Record<string, string> = {};
  for (const k of Object.keys(raw)) if (!FIELDS.has(k)) fields[k] = "Unexpected field.";
  const line = (v: unknown, key: string, name: string) => {
    const s = typeof v === "string" ? cleanLine(v) : "";
    if (s.length < 8 || s.length > 120) fields[key] = `${name} must be between 8 and 120 characters.`;
    else if (LINK.test(s)) fields[key] = `${name} cannot contain a web address.`;
    return s;
  };
  const a = line(raw.a, "a", "The first line");
  const b = line(raw.b, "b", "The second line");
  const slug = typeof raw.slug === "string" ? raw.slug : "";
  if (!hasTerm(slug)) fields.slug = "Choose the glossary term that answers the riddle.";
  const by = typeof raw.by === "string" ? cleanLine(raw.by) : "";
  if (by.length > 24 || LINK.test(by) || by.includes("@")) fields.by = "Initials or a first name only, up to 24 characters.";
  const startedAt = typeof raw.startedAt === "number" && Number.isFinite(raw.startedAt) && raw.startedAt > 0 ? raw.startedAt : 0;
  if (!startedAt) fields.startedAt = "The form could not be verified. Please reload the page and try again.";
  if (Object.keys(fields).length) return fail(400, "Please check the highlighted fields.", fields);

  if (tooFast(startedAt)) return json({ ok: true });
  const allowed = submissionAllowed("riddle", gate.ip);
  if (!allowed.ok) return allowed.response;

  const supabase = createPublicSupabase();
  if (!supabase) return fail(503, UNAVAILABLE);

  let error: { code?: string | null } | null = null;
  let status = 0;
  try {
    // the table is newer than the generated types, so it is addressed by name
    const result = await (supabase as unknown as SupabaseClient).from("reader_riddles").insert({ line_a: a, line_b: b, answer_slug: slug, byline: by });
    error = result.error;
    status = result.status;
  } catch {
    error = { code: "FETCH" };
  }
  if (!error) return json({ ok: true });

  const kind = classifyStorageError(error, status);
  if (kind === "throttled") return fail(429, GENERIC_RATE_LIMITED);
  if (kind === "rejected") return fail(400, "That riddle could not be accepted. Please check it and try again.");
  console.error(`[api/riddle] storage failure code=${String(error.code ?? "unknown").slice(0, 20)} status=${status}`);
  return fail(503, UNAVAILABLE);
}
