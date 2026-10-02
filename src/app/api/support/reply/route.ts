/**
 * POST /api/support/reply
 *
 * Adds a message from the person who opened a support request
 * (ticket_reply() in 0007_support.sql). A reply puts a waiting or solved
 * ticket back in front of staff; a closed ticket takes no more replies.
 *
 *   request   { reference, email, body }
 *   200       { ok: true, ticket? }           stored. `ticket` is the thread as it
 *                                             now stands; it is left out if it
 *                                             could not be read back, and the page
 *                                             then asks /api/support/thread
 *   400       { ok: false, error, fields? }   validation, unknown field, bad JSON
 *   404       { ok: false, error }            no ticket for that pair (one message)
 *   409       { ok: false, error }            the ticket is closed
 *   429       { ok: false, error }            rate limited, here or by the database
 *   403 / 413 / 415 / 503                     as /api/contact
 *
 * Nothing is logged except an error code when storage fails.
 */
import { GENERIC_RATE_LIMITED, GENERIC_UNAVAILABLE } from "@/lib/server/constants";
import { fail, json } from "@/lib/server/http";
import { classifyStorageError, openGate, submissionAllowed } from "@/lib/server/public-form";
import { lookupAllowed, TICKET_CLOSED, TICKET_NOT_FOUND } from "@/lib/server/support";
import { validateTicketReply } from "@/lib/server/validate-support";
import { parseTicketView } from "@/lib/support";
import { createPublicSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await openGate(request, "support-reply");
  if (!gate.ok) return gate.response;

  const checked = validateTicketReply(gate.body);
  if (!checked.ok) return fail(400, "Please check the highlighted fields.", checked.fields);
  const input = checked.value;

  // A reply tests a reference against an address just as a lookup does, so it
  // draws on the same per-IP counter, and then on the one for stored messages.
  const lookup = lookupAllowed(gate.ip);
  if (!lookup.ok) return lookup.response;
  const allowed = submissionAllowed("support-reply", gate.ip);
  if (!allowed.ok) return allowed.response;

  const supabase = createPublicSupabase();
  if (!supabase) return fail(503, GENERIC_UNAVAILABLE);

  let outcome: unknown = null;
  let error: { code?: string | null } | null = null;
  let status = 0;
  try {
    const result = await supabase.rpc("ticket_reply", { p_reference: input.reference, p_email: input.email, p_body: input.body });
    outcome = result.data;
    error = result.error;
    status = result.status;
  } catch {
    error = { code: "FETCH" };
  }

  if (error) {
    const kind = classifyStorageError(error, status);
    if (kind === "throttled") return fail(429, GENERIC_RATE_LIMITED); // PT429 from the database
    if (kind === "rejected") return fail(400, "Your reply could not be accepted as written. Please check it and try again.");
    // code only: no message text, nothing personal
    console.error(`[api/support/reply] storage failure code=${String(error.code ?? "unknown").slice(0, 20)} status=${status}`);
    return fail(503, GENERIC_UNAVAILABLE);
  }

  if (outcome === "not_found") return fail(404, TICKET_NOT_FOUND);
  if (outcome === "closed") return fail(409, TICKET_CLOSED);
  if (outcome !== "ok") {
    console.error("[api/support/reply] unexpected outcome");
    return fail(503, GENERIC_UNAVAILABLE);
  }

  // The reply is stored. Read the thread back so the page can show it without
  // a second request; if that read fails the reply still stands.
  try {
    const view = await supabase.rpc("ticket_view", { p_reference: input.reference, p_email: input.email });
    const ticket = view.error ? null : parseTicketView(view.data);
    if (ticket) return json({ ok: true, ticket });
  } catch {
    /* fall through: stored, not read back */
  }
  return json({ ok: true });
}
