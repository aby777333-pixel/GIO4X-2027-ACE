/**
 * Server-side pieces shared by the three support endpoints
 * (/api/support, /api/support/thread, /api/support/reply).
 */
import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { GENERIC_RATE_LIMITED } from "@/lib/server/constants";
import { fail } from "@/lib/server/http";
import { rateLimit, type RateRule } from "@/lib/server/rate-limit";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** `TK-` + 8 base32 characters from 40 random bits: the ticket twin of newReference() in http.ts. */
export function newTicketReference(): string {
  const bytes = randomBytes(5);
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = "";
  for (let i = 7; i >= 0; i--) out += BASE32[Number((bits >> BigInt(i * 5)) & 31n)];
  return `TK-${out}`;
}

/**
 * Per-IP rule for anything that tests a reference against an address: reading
 * a thread and replying to one. It is the guessable path, so its sustained
 * rate (20 an hour) is lower than the one for storing a new message (30 an
 * hour in RULES.submissions), over a longer window. The two endpoints share
 * one counter: a reply answers "does this pair exist?" just as a lookup does.
 *
 * Best effort, like every in-memory limit here (see rate-limit.ts). What makes
 * guessing pointless is the reference itself: 40 random bits, and an address
 * alone finds nothing.
 */
export const SUPPORT_RULES = {
  lookups: { limit: 10, windowMs: 30 * 60 * 1000 },
} as const satisfies Record<string, RateRule>;

export function lookupAllowed(ip: string): { ok: true } | { ok: false; response: NextResponse } {
  const result = rateLimit("support:lookups", ip, SUPPORT_RULES.lookups);
  if (result.ok) return { ok: true };
  return { ok: false, response: fail(429, GENERIC_RATE_LIMITED, undefined, { "Retry-After": String(result.retryAfterSeconds) }) };
}

/** One answer for a wrong reference and a wrong address, so neither can be probed. */
export const TICKET_NOT_FOUND = "We could not find a request with that reference and email address. Please check both and try again.";
export const TICKET_CLOSED = "This request is closed and takes no more replies. If you still need help, please open a new request.";
export const TICKET_UNREADABLE = "We could not read your request just now. Please try again shortly.";
