/**
 * POST /api/contact
 *
 * Receives an enquiry from the contact form or the account-interest form and
 * stores it as a lead. See docs/SECURITY.md for the full model.
 *
 *   request   { name, email, phone?, country?, topic, message, accountInterest?,
 *               privacyAccepted: true, marketingConsent, website: "" (honeypot),
 *               startedAt, page, utm? }
 *   200       { ok: true, reference }
 *   400       { ok: false, error, fields? }   validation, unknown field, bad JSON
 *   403       { ok: false, error }            not sent from this site
 *   413       { ok: false, error }            body larger than 16 KB
 *   415       { ok: false, error }            not application/json
 *   429       { ok: false, error }            rate limited (Retry-After set when known)
 *   503       { ok: false, error }            storage unavailable (generic message)
 *
 * Nothing about a submission is logged except an error code when storage
 * fails: never the message, the name, the address or the IP.
 */
import { GENERIC_RATE_LIMITED, GENERIC_UNAVAILABLE, PRIVACY_VERSION } from "@/lib/server/constants";
import { fail, json, newId, newReference } from "@/lib/server/http";
import { classifyStorageError, honeypotFilled, openGate, submissionAllowed, tooFast } from "@/lib/server/public-form";
import { countForm } from "@/lib/server/pulse";
import { validateContact } from "@/lib/server/validate";
import { createPublicSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await openGate(request, "contact");
  if (!gate.ok) return gate.response;

  // Automated submissions get the same answer a person would: success and a
  // reference. Nothing is stored, and the sender learns nothing to adapt to.
  if (honeypotFilled(gate.body)) return json({ ok: true, reference: newReference() });

  const checked = validateContact(gate.body);
  if (!checked.ok) return fail(400, "Please check the highlighted fields.", checked.fields);
  const input = checked.value;

  if (tooFast(input.startedAt)) return json({ ok: true, reference: newReference() });

  const allowed = submissionAllowed("contact", gate.ip);
  if (!allowed.ok) return allowed.response;

  const supabase = createPublicSupabase();
  if (!supabase) return fail(503, GENERIC_UNAVAILABLE);

  const now = new Date().toISOString();

  // `id` and `reference` are generated here because the anonymous role cannot
  // read the table back: the insert asks for no returned row (return=minimal).
  // A reference collision (1 in 2^40) is retried once with a new reference.
  for (let attempt = 0; attempt < 2; attempt++) {
    const reference = newReference();
    let error: { code?: string | null } | null = null;
    let status = 0;
    try {
      const result = await supabase.from("leads").insert({
        id: newId(),
        reference,
        name: input.name,
        email: input.email,
        phone: input.phone,
        country: input.country,
        topic: input.topic,
        message: input.message,
        account_interest: input.accountInterest,
        page: input.page,
        utm: input.utm,
        privacy_accepted_at: now,
        privacy_version: PRIVACY_VERSION,
        marketing_consent: input.marketingConsent,
        marketing_consent_at: input.marketingConsent ? now : null,
      });
      error = result.error;
      status = result.status;
    } catch {
      error = { code: "FETCH" };
    }

    if (!error) {
      // +1 on the day's total for this form (a count, nothing about the sender); it cannot fail the request
      await countForm(request, input.accountInterest ? "interest" : "contact");
      return json({ ok: true, reference });
    }

    const kind = classifyStorageError(error, status);
    if (kind === "duplicate" && attempt === 0) continue;
    if (kind === "throttled") return fail(429, GENERIC_RATE_LIMITED);
    if (kind === "rejected") return fail(400, "Your message could not be accepted as written. Please check it and try again.");

    // code only: no message, no row data, nothing personal
    console.error(`[api/contact] storage failure code=${String(error.code ?? "unknown").slice(0, 20)} status=${status}`);
    return fail(503, GENERIC_UNAVAILABLE);
  }

  return fail(503, GENERIC_UNAVAILABLE);
}
