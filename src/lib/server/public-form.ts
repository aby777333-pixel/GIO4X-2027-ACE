/**
 * The front half of both public form endpoints: everything that happens before
 * a field is looked at. Kept in one place so the two routes cannot drift.
 *
 * Order (cheapest and least revealing first):
 *   415 wrong content type → 403 not same-origin → 429 per-IP attempts
 *   → 413 body too large → 400 not JSON / not an object
 */
import type { NextResponse } from "next/server";
import { GENERIC_RATE_LIMITED, MAX_BODY_BYTES, MIN_FILL_MS } from "@/lib/server/constants";
import { clientKey, fail, isJsonRequest, isSameOrigin, readBodyCapped } from "@/lib/server/http";
import { rateLimit, RULES } from "@/lib/server/rate-limit";

export type Gate = { ok: true; body: Record<string, unknown>; ip: string } | { ok: false; response: NextResponse };

export async function openGate(request: Request, endpoint: string): Promise<Gate> {
  if (!isJsonRequest(request)) {
    return { ok: false, response: fail(415, "Send the form as application/json.") };
  }
  if (!isSameOrigin(request)) {
    return { ok: false, response: fail(403, "This form can only be submitted from the GIO4X website.") };
  }

  const ip = clientKey(request.headers);
  const attempt = rateLimit(`${endpoint}:attempts`, ip, RULES.attempts);
  if (!attempt.ok) {
    return { ok: false, response: fail(429, GENERIC_RATE_LIMITED, undefined, { "Retry-After": String(attempt.retryAfterSeconds) }) };
  }

  const read = await readBodyCapped(request, MAX_BODY_BYTES);
  if (!read.ok) {
    return { ok: false, response: fail(413, "The request is too large.") };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(read.text);
  } catch {
    return { ok: false, response: fail(400, "The request could not be read.") };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, response: fail(400, "The request could not be read.") };
  }

  return { ok: true, body: parsed as Record<string, unknown>, ip };
}

/** The honeypot field is invisible to people. Anything in it means a script filled the form. */
export function honeypotFilled(body: Record<string, unknown>): boolean {
  return typeof body.website === "string" && body.website.trim() !== "";
}

/**
 * A form completed faster than a person can type, or one that claims to have
 * been opened in the future, is treated as automated.
 */
export function tooFast(startedAt: number, now = Date.now()): boolean {
  const elapsed = now - startedAt;
  return elapsed < MIN_FILL_MS;
}

/** Second tier of the per-IP limiter: requests that are about to be stored. */
export function submissionAllowed(endpoint: string, ip: string): { ok: true } | { ok: false; response: NextResponse } {
  const result = rateLimit(`${endpoint}:submissions`, ip, RULES.submissions);
  if (result.ok) return { ok: true };
  return { ok: false, response: fail(429, GENERIC_RATE_LIMITED, undefined, { "Retry-After": String(result.retryAfterSeconds) }) };
}

/** PostgREST / Postgres error → what kind of failure it is. Never exposes the detail. */
export type StorageFailure = "throttled" | "duplicate" | "rejected" | "unavailable";

export function classifyStorageError(error: { code?: string | null } | null, status: number): StorageFailure {
  const code = error?.code ?? "";
  if (code === "PT429" || status === 429) return "throttled"; // database throttle trigger
  if (code === "23505") return "duplicate"; // unique violation
  if (code === "23514" || code === "23502" || code === "22P02" || code === "22001") return "rejected"; // a constraint the API should have caught
  return "unavailable"; // missing table, permission, network, timeout, anything else
}
