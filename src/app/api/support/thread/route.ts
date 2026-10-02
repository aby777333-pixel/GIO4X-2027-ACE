/**
 * POST /api/support/thread
 *
 * Returns a support request to the person who opened it. Both the reference
 * and the address must match (ticket_view() in 0007_support.sql); internal
 * notes are never returned and staff are never named.
 *
 * It is a POST, not a GET, so that neither value can end up in an address, a
 * history entry, a referrer or an access log.
 *
 *   request   { reference, email }
 *   200       { ok: true, ticket }            the public view of the ticket
 *   400       { ok: false, error, fields? }   not shaped like a reference or an address
 *   404       { ok: false, error }            no ticket for that pair: ONE message,
 *                                             whichever of the two was wrong
 *   403 / 413 / 415 / 429 / 503               as /api/contact
 */
import { GENERIC_RATE_LIMITED } from "@/lib/server/constants";
import { fail, json } from "@/lib/server/http";
import { classifyStorageError, openGate } from "@/lib/server/public-form";
import { lookupAllowed, TICKET_NOT_FOUND, TICKET_UNREADABLE } from "@/lib/server/support";
import { validateTicketLookup } from "@/lib/server/validate-support";
import { parseTicketView } from "@/lib/support";
import { createPublicSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await openGate(request, "support-thread");
  if (!gate.ok) return gate.response;

  const checked = validateTicketLookup(gate.body);
  if (!checked.ok) return fail(400, "Please check the highlighted fields.", checked.fields);
  const input = checked.value;

  // the guessable path: counted per IP before the database is asked anything
  const allowed = lookupAllowed(gate.ip);
  if (!allowed.ok) return allowed.response;

  const supabase = createPublicSupabase();
  if (!supabase) return fail(503, TICKET_UNREADABLE);

  let data: unknown = null;
  let error: { code?: string | null } | null = null;
  let status = 0;
  try {
    const result = await supabase.rpc("ticket_view", { p_reference: input.reference, p_email: input.email });
    data = result.data;
    error = result.error;
    status = result.status;
  } catch {
    error = { code: "FETCH" };
  }

  if (error) {
    if (classifyStorageError(error, status) === "throttled") return fail(429, GENERIC_RATE_LIMITED);
    // code only: nothing personal
    console.error(`[api/support/thread] read failure code=${String(error.code ?? "unknown").slice(0, 20)} status=${status}`);
    return fail(503, TICKET_UNREADABLE);
  }

  const ticket = parseTicketView(data);
  if (!ticket) return fail(404, TICKET_NOT_FOUND);

  return json({ ok: true, ticket });
}
