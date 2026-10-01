/**
 * Request and response helpers shared by the public endpoints and the Control
 * route handlers.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { site } from "@/config/site";

export type ApiFailure = { ok: false; error: string; fields?: Record<string, string> };

/** JSON response that is never cached and never sniffed. */
export function json<T extends object>(body: T, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });
}

export function fail(status: number, error: string, fields?: Record<string, string>, headers?: Record<string, string>): NextResponse {
  const body: ApiFailure = fields ? { ok: false, error, fields } : { ok: false, error };
  return json(body, status, headers);
}

/** Only `application/json` (with optional parameters such as charset). */
export function isJsonRequest(request: Request): boolean {
  const type = request.headers.get("content-type") ?? "";
  return type.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

/**
 * Reads the body as text with a hard byte cap. The declared Content-Length is
 * checked first; the stream is then read chunk by chunk and abandoned as soon
 * as it exceeds the cap, so an oversized or mis-declared body is never
 * buffered in full.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false };
  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false };
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder("utf-8", { fatal: false }).decode(all) };
}

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Same-origin check for browser form posts.
 *
 * The `Origin` header (or, failing that, `Referer`) must name this site: the
 * host the request was sent to, or the configured site URL. A request with
 * neither header is refused: every current browser sends `Origin` on a POST.
 *
 * What this is and is not: it stops another website from making a visitor's
 * browser post to these endpoints, and it turns away the laziest scripts. A
 * non-browser client can set any header it likes, so this is not a defence
 * against a deliberate sender; rate limits and the database rules are.
 */
export function isSameOrigin(request: Request): boolean {
  const claimed = hostOf(request.headers.get("origin")) ?? hostOf(request.headers.get("referer"));
  if (!claimed) return false;
  const allowed = new Set<string>();
  const host = request.headers.get("host")?.toLowerCase();
  if (host) allowed.add(host);
  const requestHost = hostOf(request.url);
  if (requestHost) allowed.add(requestHost);
  const siteHost = hostOf(site.url);
  if (siteHost) allowed.add(siteHost);
  return allowed.has(claimed);
}

/**
 * Client address for rate limiting only. It is never stored.
 * Netlify sets `x-nf-client-connection-ip` itself; `x-forwarded-for` is used
 * only as a fallback (local development). IPv6 addresses are reduced to their
 * /64 prefix, because one subscriber usually controls a whole /64.
 */
export function clientKey(headers: Headers): string {
  const raw = headers.get("x-nf-client-connection-ip") ?? headers.get("x-forwarded-for")?.split(",", 1)[0] ?? "";
  const ip = raw.trim().toLowerCase().slice(0, 64);
  if (!ip) return "unknown";
  if (ip.includes(":") && !ip.includes(".")) return ip.split(":").slice(0, 4).join(":");
  return ip;
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** `GX-` + 8 base32 characters from 40 random bits (5 bytes → exactly 8 symbols). */
export function newReference(): string {
  const bytes = randomBytes(5);
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = "";
  for (let i = 7; i >= 0; i--) out += BASE32[Number((bits >> BigInt(i * 5)) & 31n)];
  return `GX-${out}`;
}

export function newId(): string {
  return randomUUID();
}
