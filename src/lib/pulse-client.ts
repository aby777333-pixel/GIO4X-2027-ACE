/**
 * The browser half of the visit counter (rules: src/lib/pulse.ts; what is
 * stored: supabase/migrations/0014_pulse.sql; what visitors are told:
 * /legal/cookies, "Counting visits").
 *
 * Two requests exist, both to this site's own origin, both without cookies and
 * without a Referer header:
 *   POST /api/pulse          { path, ref }   once per page view
 *   POST /api/pulse/search   { term }        once per search
 * Nothing is written to the browser, and nothing is sent at all when the
 * visitor has asked not to be counted.
 */
import { readPrefs } from "@/lib/prefs";
import { buildTermMap, matchTerm, type PulseRef, type TermMap } from "@/lib/pulse";

type SignalNavigator = Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string | null };

/**
 * False when the visitor has said no in any of the three ways they can: the
 * browser's Global Privacy Control, its Do Not Track setting, or "Count my
 * visits" switched off on /preferences. Also false on the staff console.
 */
export function pulseAllowed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nav = navigator as SignalNavigator;
    if (nav.globalPrivacyControl === true) return false;
    const dnt = nav.doNotTrack ?? (window as Window & { doNotTrack?: string | null }).doNotTrack ?? nav.msDoNotTrack;
    if (dnt === "1" || dnt === "yes") return false;
    if (readPrefs().countVisits === false) return false;
    return !window.location.pathname.startsWith("/control");
  } catch {
    return false; // if the choice cannot be read, the visit is not counted
  }
}

// The last thing sent and when, in memory only. A component that mounts twice in quick succession
// (a remount under Suspense, a development refresh) must not turn one view or one search into two.
let last = { key: "", at: 0 };
const REPEAT_MS = 1500;

function post(url: string, body: Record<string, string>, what: string): void {
  const now = Date.now();
  const key = `${url} ${what}`;
  if (last.key === key && now - last.at < REPEAT_MS) return;
  last = { key, at: now };
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // no cookies are attached, and the page's address (which may carry a query string) is not sent as a referrer
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* a count that cannot be sent is simply not counted */
  }
}

/** One page view: the path only (never the query string or the fragment) and the class of referrer. */
export function sendView(pathname: string, ref: PulseRef): void {
  if (!pulseAllowed()) return;
  post("/api/pulse", { path: pathname, ref }, pathname);
}

// one vocabulary per loaded index, built the first time a search is counted
const vocabularies = new WeakMap<object, TermMap>();

/**
 * One search. What was typed is compared here, in the browser, with the
 * site's own terms; only the matching term, or "" for no match, leaves the
 * device.
 */
export function sendSearch(query: string, index: readonly { t: string; k?: string[] }[]): void {
  if (!pulseAllowed() || !query.trim()) return;
  let terms = vocabularies.get(index);
  if (!terms) {
    terms = buildTermMap(index);
    vocabularies.set(index, terms);
  }
  post("/api/pulse/search", { term: matchTerm(query, terms) ?? "" }, query);
}
