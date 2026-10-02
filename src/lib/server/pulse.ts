/**
 * The server half of the visit counter (see src/lib/pulse.ts for the rules and
 * supabase/migrations/0014_pulse.sql for what is stored).
 *
 * Everything here runs as the anonymous database role and adds 1 to a daily
 * total, or does nothing. It never throws and never logs: a count that cannot
 * be recorded (the migration is not applied yet, the database is slow, the
 * throttle is reached) is simply not recorded, and the visitor's page or form
 * is never affected by it.
 *
 * What is read from a request and what becomes of it:
 *   IP address    in memory, for the per-address rate limit; never stored
 *   User-Agent    to leave out automated visitors; never stored
 *   Sec-GPC, DNT  "do not count me": honoured here as well as in the browser
 *   Origin        the request must come from this site's own pages
 * Nothing else is read. No cookie is read or set.
 */
import { NextResponse } from "next/server";
import { clientKey, isJsonRequest, isSameOrigin, readBodyCapped } from "@/lib/server/http";
import { rateLimit, type RateRule } from "@/lib/server/rate-limit";
import { buildTermMap, normalisePath, type PulseForm, type PulseRef, type TermMap } from "@/lib/pulse";
import { buildSearchIndex } from "@/lib/search-index";
import { SITEMAP_NAMES } from "@/lib/sitemap";
import { sitemapEntries } from "@/lib/sitemap-data";
import { createPublicSupabase } from "@/lib/supabase/server";

/** Per address, in memory. Generous: an office behind one address reads many pages. */
export const PULSE_RULES = {
  views: { limit: 240, windowMs: 10 * 60 * 1000 },
  searches: { limit: 60, windowMs: 10 * 60 * 1000 },
} as const satisfies Record<string, RateRule>;

/** The body is two short fields. */
const MAX_PULSE_BYTES = 512;

/** How long a count may take before it is abandoned. The response does not wait longer than this. */
const COUNT_TIMEOUT_MS = 1500;

/* ---- the site's published pages ------------------------------------------- */

/**
 * Pages that exist and are deliberately left out of the sitemaps. Keep in step
 * with NOT_INDEXED in src/lib/sitemap-data.ts: a page missing from both lists
 * is still counted, but under "(other)" instead of its own path.
 */
const UNLISTED_PAGES = ["/search", "/preferences", "/sign-in", "/open-account", "/desk", "/offline", "/intelligence/blog"];

/** A blog post: its slug is a row in the database, so it is recognised by shape (the pattern of `blog_posts_slug_valid`). */
const BLOG_POST = /^\/intelligence\/blog\/[a-z0-9]+(-[a-z0-9]+)*$/;

let knownPaths: Set<string> | null = null;

function isKnownPath(path: string): boolean {
  if (!knownPaths) {
    const set = new Set<string>(["/", ...UNLISTED_PAGES]);
    for (const name of SITEMAP_NAMES) for (const entry of sitemapEntries(name)) set.add(entry.path);
    knownPaths = set;
  }
  return knownPaths.has(path) || BLOG_POST.test(path);
}

/** The name a page view is counted under, "(other)", or null when it is not counted at all. */
export function countablePath(raw: unknown): string | null {
  return normalisePath(raw, isKnownPath);
}

/* ---- the site's own search terms ------------------------------------------ */

let terms: TermMap | null = null;

/** Built from the same index the search box uses, once per server instance. */
export function siteTerms(): TermMap {
  terms ??= buildTermMap(buildSearchIndex());
  return terms;
}

/* ---- who is asking -------------------------------------------------------- */

/** True when the browser said "do not track me" in either of the two ways browsers say it. */
export function asksNotToBeCounted(headers: Headers): boolean {
  return headers.get("sec-gpc")?.trim() === "1" || headers.get("dnt")?.trim() === "1";
}

const AUTOMATED = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|uptime|curl|wget|python|scrapy|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|phantom|puppeteer|playwright|selenium/i;

/** A user-agent that names itself as automation, or none at all. Read, never stored. */
export function looksAutomated(headers: Headers): boolean {
  const ua = headers.get("user-agent") ?? "";
  return ua.length < 12 || AUTOMATED.test(ua);
}

/* ---- the gate both counting endpoints share -------------------------------- */

/**
 * The answer to every counting request: 204 and nothing else. In development
 * a header says what was decided, so the behaviour can be checked from a
 * script; in production the response never differs, so a sender learns
 * nothing about what was or was not counted.
 */
export function pulseDone(decision: string, status = 204): NextResponse {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (process.env.NODE_ENV !== "production") headers["X-Pulse-Debug"] = decision;
  return new NextResponse(null, { status, headers });
}

export type PulseGate = { ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse };

/**
 * Order (cheapest and least revealing first): wrong content type → not from
 * this site → the browser asks not to be counted → automated → too many from
 * one address → body too large or not an object with exactly `fields`.
 */
export async function openPulse(request: Request, scope: keyof typeof PULSE_RULES, fields: readonly string[]): Promise<PulseGate> {
  if (!isJsonRequest(request)) return { ok: false, response: pulseDone("refused content-type", 415) };

  // Browsers state where a request came from; anything not from this site's own pages is refused.
  const site = request.headers.get("sec-fetch-site");
  if (!isSameOrigin(request) || (site !== null && site !== "same-origin")) {
    return { ok: false, response: pulseDone("refused origin", 403) };
  }

  if (asksNotToBeCounted(request.headers)) return { ok: false, response: pulseDone("skipped do-not-track") };
  if (looksAutomated(request.headers)) return { ok: false, response: pulseDone("skipped automated") };

  // the address is the key of an in-memory window and goes no further
  if (!rateLimit(`pulse:${scope}`, clientKey(request.headers), PULSE_RULES[scope]).ok) {
    return { ok: false, response: pulseDone("skipped rate-limit") };
  }

  const read = await readBodyCapped(request, MAX_PULSE_BYTES);
  if (!read.ok) return { ok: false, response: pulseDone("refused size", 413) };

  let parsed: unknown;
  try {
    parsed = JSON.parse(read.text);
  } catch {
    return { ok: false, response: pulseDone("refused json", 400) };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, response: pulseDone("refused json", 400) };
  }
  // exactly the expected fields: a request carrying anything more is not one this site sends
  const keys = Object.keys(parsed);
  if (keys.length !== fields.length || !fields.every((f) => keys.includes(f))) {
    return { ok: false, response: pulseDone("refused fields", 400) };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

/* ---- adding 1 --------------------------------------------------------------- */

/** Runs one count, bounded in time, and swallows every failure. Resolves to whether the database said it counted. */
async function count(run: (db: NonNullable<ReturnType<typeof createPublicSupabase>>) => PromiseLike<{ data: boolean | null; error: unknown }>): Promise<boolean> {
  try {
    const db = createPublicSupabase();
    if (!db) return false;
    const result = await Promise.race([
      Promise.resolve(run(db)),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), COUNT_TIMEOUT_MS);
      }),
    ]);
    return !!result && !result.error && result.data === true;
  } catch {
    return false; // not configured, not migrated, unreachable: the count is skipped
  }
}

export function countView(path: string, ref: PulseRef): Promise<boolean> {
  return count((db) => db.rpc("pulse_hit", { p_path: path, p_ref: ref }));
}

export function countSearch(term: string | null): Promise<boolean> {
  return count((db) => db.rpc("pulse_search_hit", { p_term: term ?? "" }));
}

/**
 * One accepted form. Called by the form endpoints at the moment a submission
 * has been stored; it cannot fail them. A browser that asks not to be counted
 * is left out here too.
 */
export async function countForm(request: Request, form: PulseForm): Promise<void> {
  if (asksNotToBeCounted(request.headers)) return;
  await count((db) => db.rpc("pulse_form_hit", { p_form: form }));
}
