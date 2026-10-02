/**
 * Client calls for the support page.
 *
 *   POST /api/support          { name, email, category, subject, message, privacyAccepted: true,
 *                                website: "" (honeypot), startedAt, page }   -> { ok, reference }
 *   POST /api/support/thread   { reference, email }                          -> { ok, ticket }
 *   POST /api/support/reply    { reference, email, body }                    -> { ok, ticket? }
 *
 * The reference and the address travel in the request body only: never in an
 * address, never in storage. Anything that is not a well-formed answer (a
 * network failure, an HTML error page, a timeout) resolves to a calm failure
 * result. Nothing here throws.
 */
import { parseTicketView } from "@/lib/support";
import type { TicketPublicView } from "@/lib/supabase/types";

export type Failure =
  | { ok: false; kind: "fields"; fields: Record<string, string>; error?: string }
  /** no ticket for that reference and address (one answer for both) */
  | { ok: false; kind: "not_found"; error: string }
  /** the ticket takes no more replies */
  | { ok: false; kind: "closed"; error: string }
  | { ok: false; kind: "failed"; error?: string };

export type OpenPayload = {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  privacyAccepted: true;
  /** honeypot: must stay empty */
  website: string;
  /** ms timestamp of when the form was rendered */
  startedAt: number;
  page: string;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function stringFields(v: unknown): Record<string, string> | null {
  if (!isRecord(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) if (typeof val === "string" && val) out[k] = val;
  return Object.keys(out).length ? out : null;
}

type Answer = { status: number; ok: boolean; data: unknown };

async function post(path: string, payload: object, timeoutMs = 20_000): Promise<Answer | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      cache: "no-store",
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null; // not JSON (for example an HTML error page): handled as a failure by the caller
    }
    return { status: res.status, ok: res.ok, data };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function failure(answer: Answer | null): Failure {
  if (!answer || !isRecord(answer.data) || answer.data.ok !== false) return { ok: false, kind: "failed" };
  const { status, data } = answer;
  const error = typeof data.error === "string" ? data.error.slice(0, 240) : undefined;
  const fields = stringFields(data.fields);
  if (status >= 400 && status < 500 && fields) return { ok: false, kind: "fields", fields, error };
  if (status === 404 && error) return { ok: false, kind: "not_found", error };
  if (status === 409 && error) return { ok: false, kind: "closed", error };
  // only a 4xx carries a message meant for the visitor; a 5xx text is not shown
  return { ok: false, kind: "failed", error: status >= 400 && status < 500 ? error : undefined };
}

export async function openTicket(payload: OpenPayload): Promise<{ ok: true; reference: string } | Failure> {
  const answer = await post("/api/support", payload);
  if (answer?.ok && isRecord(answer.data) && answer.data.ok === true && typeof answer.data.reference === "string" && answer.data.reference) {
    return { ok: true, reference: answer.data.reference };
  }
  return failure(answer);
}

export async function readTicket(reference: string, email: string): Promise<{ ok: true; ticket: TicketPublicView } | Failure> {
  const answer = await post("/api/support/thread", { reference, email });
  if (answer?.ok && isRecord(answer.data) && answer.data.ok === true) {
    const ticket = parseTicketView(answer.data.ticket);
    if (ticket) return { ok: true, ticket };
    return { ok: false, kind: "failed" };
  }
  return failure(answer);
}

/** `ticket` is null when the reply was stored but the thread could not be read back. */
export async function replyToTicket(reference: string, email: string, body: string): Promise<{ ok: true; ticket: TicketPublicView | null } | Failure> {
  const answer = await post("/api/support/reply", { reference, email, body });
  if (answer?.ok && isRecord(answer.data) && answer.data.ok === true) {
    return { ok: true, ticket: parseTicketView(answer.data.ticket) };
  }
  return failure(answer);
}
