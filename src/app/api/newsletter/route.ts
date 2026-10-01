/**
 * POST /api/newsletter
 *
 *   request   { email, consent: true, source, website: "" (honeypot), startedAt }
 *   200       { ok: true }
 *   400 / 403 / 413 / 415 / 429 / 503   { ok: false, error, fields? }
 *
 * An address that is already subscribed also returns 200 { ok: true }: the
 * response never reveals whether an address is on the list. Same protections
 * as /api/contact (see docs/SECURITY.md).
 */
import { GENERIC_RATE_LIMITED, GENERIC_UNAVAILABLE, PRIVACY_VERSION } from "@/lib/server/constants";
import { fail, json, newId } from "@/lib/server/http";
import { classifyStorageError, honeypotFilled, openGate, submissionAllowed, tooFast } from "@/lib/server/public-form";
import { validateNewsletter } from "@/lib/server/validate";
import { createPublicSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = GENERIC_UNAVAILABLE.replace("record your message", "record your subscription");

export async function POST(request: Request) {
  const gate = await openGate(request, "newsletter");
  if (!gate.ok) return gate.response;

  if (honeypotFilled(gate.body)) return json({ ok: true });

  const checked = validateNewsletter(gate.body);
  if (!checked.ok) return fail(400, "Please check the highlighted fields.", checked.fields);
  const input = checked.value;

  if (tooFast(input.startedAt)) return json({ ok: true });

  const allowed = submissionAllowed("newsletter", gate.ip);
  if (!allowed.ok) return allowed.response;

  const supabase = createPublicSupabase();
  if (!supabase) return fail(503, UNAVAILABLE);

  let error: { code?: string | null } | null = null;
  let status = 0;
  try {
    const result = await supabase.from("newsletter_subscribers").insert({
      id: newId(),
      email: input.email,
      source: input.source,
      consent_at: new Date().toISOString(),
      consent_version: PRIVACY_VERSION,
    });
    error = result.error;
    status = result.status;
  } catch {
    error = { code: "FETCH" };
  }

  if (!error) return json({ ok: true });

  const kind = classifyStorageError(error, status);
  if (kind === "duplicate") return json({ ok: true }); // already subscribed: same answer
  if (kind === "throttled") return fail(429, GENERIC_RATE_LIMITED);
  if (kind === "rejected") return fail(400, "That address could not be accepted. Please check it and try again.");

  console.error(`[api/newsletter] storage failure code=${String(error.code ?? "unknown").slice(0, 20)} status=${status}`);
  return fail(503, UNAVAILABLE);
}
