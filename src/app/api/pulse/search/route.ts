/**
 * POST /api/pulse/search
 *
 * One use of the site search. The visitor's browser has already compared what
 * was typed with the site's own list of terms (matchTerm in src/lib/pulse.ts)
 * and sends only the result:
 *
 *   request   { term }     one of the site's own terms, or "" when the query
 *                          was not one. The query itself is never sent.
 *   204       always, when the request is one this site sends (see /api/pulse)
 *   400 / 403 / 413 / 415   not a request this site sends
 *
 * The term is checked again here against the same list, built on the server,
 * so a value that is not one of the site's own words is counted as unmatched
 * and its text is discarded. What is stored: +1 on the day's total for the
 * term, or for "(unmatched)" (pulse_search_hit in 0014_pulse.sql).
 */
import { matchTerm } from "@/lib/pulse";
import { countSearch, openPulse, pulseDone, siteTerms } from "@/lib/server/pulse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await openPulse(request, "searches", ["term"]);
  if (!gate.ok) return gate.response;

  const { term } = gate.body;
  if (typeof term !== "string") return pulseDone("refused fields", 400);

  const matched = matchTerm(term, siteTerms());
  const stored = await countSearch(matched);
  return pulseDone(`${stored ? "counted" : "not-recorded"} term=${matched ?? "(unmatched)"}`);
}
