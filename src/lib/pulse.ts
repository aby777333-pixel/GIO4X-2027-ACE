/**
 * PULSE — the website's own visit counter. The rules, in one place.
 *
 * What exists is a set of daily totals (supabase/migrations/0014_pulse.sql):
 * views per page, accepted forms per form, searches per term. There is no row
 * per visit and no identifier of any kind, so nothing here can be joined into
 * a record of a person. This file holds the parts that decide WHAT may be
 * counted, and they are deliberately narrow:
 *
 *   · a path is counted under its own name only when it is one of the site's
 *     published pages; anything else is "(other)"; the query string and the
 *     fragment are removed before anything is looked at;
 *   · where a visitor came from is reduced to one of four words in the
 *     visitor's own browser, so a referring address never reaches the server;
 *   · a search is counted under a term only when what was typed is exactly a
 *     term the site itself publishes; anything else is "(unmatched)" and the
 *     text is neither sent nor stored.
 *
 * No imports, and nothing but functions and constants: the same file runs in
 * the browser, on the server and in scripts/test-pulse.mjs.
 */

/** Where a visitor came from, as a class. Must equal `pulse_pages_ref_valid` in 0014_pulse.sql. */
export const PULSE_REFS = ["none", "internal", "search", "other"] as const;
export type PulseRef = (typeof PULSE_REFS)[number];

export const PULSE_REF_LABEL: Record<PulseRef, string> = {
  none: "No referrer (typed, bookmarked, or withheld by the browser)",
  internal: "Another page of this site",
  search: "A search engine",
  other: "Another website",
};

/** The forms whose acceptance is counted. Must equal `pulse_forms_form_valid` in 0014_pulse.sql. */
export const PULSE_FORMS = ["contact", "interest", "support", "newsletter"] as const;
export type PulseForm = (typeof PULSE_FORMS)[number];

export const PULSE_FORM_LABEL: Record<PulseForm, string> = {
  contact: "Contact form",
  interest: "Account-interest form",
  support: "Support request",
  newsletter: "Newsletter",
};

/**
 * The page that holds each form, or null when no page of the site shows it.
 * The paths must equal the `form_pages` list in pulse_summary() (0014_pulse.sql).
 */
export const PULSE_FORM_PAGE: Record<PulseForm, string | null> = {
  contact: "/contact",
  interest: "/open-account",
  support: "/support",
  newsletter: null,
};

/** A page view of something that is not one of the site's published pages. */
export const PULSE_OTHER = "(other)";

export const PULSE_PATH_MAX = 120;
export const PULSE_TERM_MAX = 48;

/** The periods the console offers, in days. */
export const PULSE_PERIODS = [7, 30, 90, 365] as const;
export type PulsePeriod = (typeof PULSE_PERIODS)[number];
export const DEFAULT_PULSE_PERIOD: PulsePeriod = 30;

/* -------------------------------------------------------------------------- */
/* Paths                                                                      */
/* -------------------------------------------------------------------------- */

/** Surfaces that are never counted at all: the staff console, endpoints, build assets, development previews. */
const NEVER_COUNTED = /^\/(?:(?:control|api|_next)(?:\/|$)|zz-preview)/;

export function isNeverCounted(path: string): boolean {
  return NEVER_COUNTED.test(path);
}

const CLEAN_PATH = /^\/[a-z0-9/_.-]*$/;

/**
 * A path with everything after "?" or "#" removed and no trailing slash, or
 * null when the value is not a same-site path at all. Nothing is decoded: a
 * path that would need decoding is not one of the site's pages.
 */
export function stripPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.length > 2048) return null;
  const path = raw.split(/[?#]/, 1)[0] ?? "";
  if (path.length > 1 && path.endsWith("/")) return path.replace(/\/+$/, "") || "/";
  return path;
}

/**
 * What a page view is counted under:
 *   null        not a path, or a surface that is never counted
 *   "(other)"   a path, but not one of the site's published pages
 *   the path    one of the site's published pages, as `known` says
 */
export function normalisePath(raw: unknown, known: (path: string) => boolean): string | null {
  const path = stripPath(raw);
  if (path === null || isNeverCounted(path)) return null;
  if (path.length > PULSE_PATH_MAX || !CLEAN_PATH.test(path) || path.includes("//") || path.includes("..")) return PULSE_OTHER;
  return known(path) ? path : PULSE_OTHER;
}

/* -------------------------------------------------------------------------- */
/* Where a visitor came from                                                  */
/* -------------------------------------------------------------------------- */

const SEARCH_ENGINE = /(^|\.)(google\.[a-z]{2,3}(\.[a-z]{2})?|bing\.com|duckduckgo\.com|yahoo\.com|yahoo\.co\.jp|yandex\.[a-z]{2,3}|baidu\.com|ecosia\.org|startpage\.com|qwant\.com|kagi\.com|search\.brave\.com)$/;

/**
 * Reduces `document.referrer` to one word. Runs in the visitor's browser, so
 * the referring address itself is never sent anywhere.
 */
export function refClass(referrer: string | null | undefined, ownHost: string): PulseRef {
  if (!referrer) return "none";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "none";
  }
  if (!host) return "none";
  const own = ownHost.toLowerCase().replace(/:\d+$/, "");
  if (host === own) return "internal";
  return SEARCH_ENGINE.test(host) ? "search" : "other";
}

export function isPulseRef(value: unknown): value is PulseRef {
  return typeof value === "string" && (PULSE_REFS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Search terms                                                               */
/* -------------------------------------------------------------------------- */

/** The shape a term is stored in: lower case, letters, digits, dots and single spaces. "EUR/USD" → "eur usd". */
export function termCanonical(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/^[ .]+/, "")
    .trim();
}

/** The form two spellings of the same thing share: "eur usd", "EURUSD" and "eur/usd" → "eurusd". */
export function termKey(value: string): string {
  return termCanonical(value).replace(/ /g, "");
}

const STORABLE_TERM = /^[a-z0-9][a-z0-9 .]*$/;

/** The site's own vocabulary: key → the term as it is stored. */
export type TermMap = ReadonlyMap<string, string>;

/**
 * Builds the vocabulary from the search index: every entry's title and its
 * keywords. These are words GIO4X published; nothing a visitor typed is ever
 * added to this list.
 */
export function buildTermMap(entries: readonly { t: string; k?: string[] }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    for (const candidate of [entry.t, ...(entry.k ?? [])]) {
      const term = termCanonical(candidate);
      if (term.length < 2 || term.length > PULSE_TERM_MAX || !STORABLE_TERM.test(term)) continue;
      const key = term.replace(/ /g, "");
      if (key.length >= 2 && !map.has(key)) map.set(key, term);
    }
  }
  return map;
}

/**
 * The site's term a query is exactly, or null. "Exactly" allows only what the
 * search box itself treats as the same thing: case, accents, punctuation and
 * spacing, and the prefixes `$`, `define:` and `calc:`. A query that is merely
 * close to a term, or contains one, is null: an e-mail address, a name, a
 * sentence or a telephone number can never come back from here.
 */
export function matchTerm(raw: unknown, terms: TermMap): string | null {
  if (typeof raw !== "string") return null;
  const query = raw.trim();
  if (!query || query.length > 120) return null;
  const bare = query.replace(/^\$/, "").replace(/^(define|calc)\s*:\s*/i, "");
  const key = termKey(bare);
  if (key.length < 2) return null;
  return terms.get(key) ?? null;
}

/* -------------------------------------------------------------------------- */
/* The statement                                                              */
/* -------------------------------------------------------------------------- */

/**
 * What is counted and what is not, in the words shown to visitors in the
 * Cookie & Storage Notice (src/data/legal-docs.ts) and to staff at the top of
 * /control/analytics. One text, so the two can never say different things.
 * If the counter changes, change this and bump the notice's version.
 */
export const PULSE_STATEMENT = {
  intro:
    "This website counts how often its pages are viewed, how often its forms are accepted and what its search is used for. It keeps daily totals and nothing else: a total is a number for a day, not a record of you.",
  counted: [
    "Page views. When a page of the public website has loaded, your browser sends one request to this website’s own address with two things: the path of the page (for example /markets/forex, with anything after a question mark or a hash removed) and one word for where you came from: “none”, “internal” (another page of this site), “search” (a search engine) or “other” (another website). The server adds 1 to that day’s total for that page. A path that is not one of the site’s published pages is counted as “other”.",
    "Forms. When a contact, account-interest, support or newsletter form is accepted, the server adds 1 to that day’s total for that form.",
    "Searches. When you use the site search, your browser compares what you typed with the site’s own list of terms, on your device. If it is exactly one of them (a symbol, a glossary term, the name of a tool or a page), that term’s total for the day goes up by 1. If it is anything else, only an “unmatched” total goes up: what you typed is not sent and not stored.",
  ],
  notCollected: [
    "No cookie is set for this, and nothing is written to your browser.",
    "There is no visitor, device or session identifier of any kind, so two page views cannot be linked to each other or to you.",
    "The totals hold no IP address, no browser or device details, no referring address, no query string and no time of day: only a day, a page, form or term, and a number.",
    "The server receives your IP address and your browser’s user-agent with the request, as it does with every request. It uses the address in memory to limit how fast one address can add to the totals, and the user-agent to leave out automated visitors. The counter neither stores nor logs either.",
    "Nothing is sent to any third party. The totals are kept in GIO4X’s own hosted database and are read by GIO4X staff.",
  ],
  controls: [
    "Counting is on by default. You can switch it off with “Count my visits” on the preferences page. The choice is kept in this browser with your display settings (the gx:prefs key); clearing what this website has stored returns it to on.",
    "If your browser sends the Global Privacy Control or Do Not Track signal, nothing is counted, whatever the switch says: your browser sends no page-view or search request, and the server leaves a form you send out of its totals.",
    "With the switch off, your browser sends no page-view or search request. A form you choose to send is still added to that form’s total, because the form itself is stored in order to answer you and the total is only a count of those.",
    "The staff console is never counted. Totals older than 400 days are deleted.",
  ],
} as const;
