/**
 * Shared client logic for the two forms that post to /api/contact
 * (the contact form and the account-interest form).
 *
 * Contract:
 *   request  { name, email, phone?, country?, accountInterest?, topic, message, privacyAccepted: true,
 *              marketingConsent, website: "" (honeypot), startedAt, page, utm? }
 *   response 200 { ok: true, reference }  |  4xx/5xx { ok: false, error, fields? }
 *
 * Anything that is not a well-formed success (a 404 while the endpoint is not
 * deployed, a network failure, an HTML error page, a timeout) resolves to a
 * calm failure result. Nothing here throws.
 */

export type ContactPayload = {
  name: string;
  email: string;
  phone?: string;
  /** account-interest form only */
  country?: string;
  /** account-interest form only */
  accountInterest?: string;
  topic: string;
  message: string;
  privacyAccepted: true;
  marketingConsent: boolean;
  /** honeypot: must stay empty */
  website: string;
  /** ms timestamp of when the form was rendered */
  startedAt: number;
  page: string;
  utm?: Record<string, string>;
};

export type SubmitResult =
  | { ok: true; reference: string }
  | { ok: false; kind: "fields"; fields: Record<string, string>; error?: string }
  | { ok: false; kind: "failed"; error?: string };

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^\+?[0-9 ()\-.]{6,24}$/;

/** utm_* parameters from the current address, if any. Values are trimmed and capped. */
export function readUtm(): Record<string, string> | undefined {
  if (typeof window === "undefined") return undefined;
  const out: Record<string, string> = {};
  const params = new URLSearchParams(window.location.search);
  params.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k.startsWith("utm_") && value) out[k.slice(0, 40)] = value.slice(0, 120);
  });
  return Object.keys(out).length ? out : undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function stringFields(v: unknown): Record<string, string> | null {
  if (!isRecord(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) if (typeof val === "string" && val) out[k] = val;
  return Object.keys(out).length ? out : null;
}

export async function submitContact(payload: ContactPayload, timeoutMs = 20_000): Promise<SubmitResult> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("/api/contact", {
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
      data = null; // not JSON (for example an HTML 404): handled as a failure below
    }
    if (res.ok && isRecord(data) && data.ok === true && typeof data.reference === "string" && data.reference) {
      return { ok: true, reference: data.reference };
    }
    const error = isRecord(data) && typeof data.error === "string" ? data.error.slice(0, 240) : undefined;
    const fields = isRecord(data) ? stringFields(data.fields) : null;
    if (res.status >= 400 && res.status < 500 && fields) return { ok: false, kind: "fields", fields, error };
    // only a 4xx carries a message meant for the visitor; a 5xx text is not shown
    return { ok: false, kind: "failed", error: res.status >= 400 && res.status < 500 && res.status !== 404 ? error : undefined };
  } catch {
    return { ok: false, kind: "failed" };
  } finally {
    window.clearTimeout(timer);
  }
}
