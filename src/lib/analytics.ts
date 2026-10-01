/**
 * ANALYTICS DATA LAYER
 *
 * One consistent vocabulary of meaningful events, pushed to `window.dataLayer`
 * ONLY when the visitor has consented to analytics. No analytics or tag
 * manager is loaded by this site today: the layer exists so that an approved
 * tool can be attached later in one place, without scattering scripts through
 * components and without ever sending sensitive values.
 *
 * Rules
 *  - Never pass names, emails, messages, account identifiers or free text.
 *  - Event properties are short enumerations (a tool slug, a platform key).
 *  - Consent lives in localStorage `gx:consent` = { analytics: boolean, marketing: boolean, at: ISO, v: string }.
 */

export type GxEvent =
  | { event: "account_cta_clicked"; placement: string }
  | { event: "portal_destination_selected"; destination: "client" | "trader" | "ib" | "openAccount" }
  | { event: "platform_explored"; platform: "raptor" | "mt5" | "compare" }
  | { event: "instrument_viewed"; class: string; slug: string }
  | { event: "calculator_used"; tool: string }
  | { event: "article_read"; slug: string; depth: 25 | 50 | 75 | 100 }
  | { event: "search_performed"; kind: "search" | "symbol" | "define" | "calc" | "verify" | "command"; results: number }
  | { event: "link_verified"; verdict: "OFFICIAL" | "APPROVED_THIRD_PARTY" | "NOT_RECOGNIZED" }
  | { event: "contact_submitted"; topic: string }
  | { event: "theme_changed"; theme: string; accent: string };

export const CONSENT_KEY = "gx:consent";
export const CONSENT_VERSION = "2026-10-01";

export type Consent = { analytics: boolean; marketing: boolean; at: string; v: string };

export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Consent;
    return c && c.v === CONSENT_VERSION ? c : null;
  } catch {
    return null;
  }
}

export function writeConsent(c: Pick<Consent, "analytics" | "marketing">): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...c, at: new Date().toISOString(), v: CONSENT_VERSION }));
  } catch {
    /* storage unavailable */
  }
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** Records an event if, and only if, analytics consent has been given. */
export function track(e: GxEvent): void {
  if (typeof window === "undefined") return;
  if (!readConsent()?.analytics) return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ ...e, ts: Date.now() });
}

/** utm_* parameters for attribution on forms. Never written into canonical URLs. */
export function readUtm(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  const p = new URLSearchParams(search);
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = p.get(k);
    if (v) out[k] = v.slice(0, 120);
  }
  return out;
}
