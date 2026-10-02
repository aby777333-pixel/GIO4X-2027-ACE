/**
 * POST /api/pulse
 *
 * One page view. Sent once per page by src/components/shell/Pulse.tsx, after
 * the page is idle, and only when the visitor has not asked to be left out.
 *
 *   request   { path, ref }     the page's path, and one of "none" | "internal"
 *                               | "search" | "other" for where the visitor came from
 *   204       always, when the request is one this site sends: whether it was
 *             counted, skipped (Global Privacy Control, Do Not Track, an
 *             automated visitor, too many from one address, a surface that is
 *             never counted) or could not be recorded is not revealed
 *   400 / 403 / 413 / 415   not a request this site sends
 *
 * What is stored: +1 on the day's total for that path and class
 * (pulse_hit in supabase/migrations/0014_pulse.sql). Nothing else is stored,
 * nothing is logged, and no cookie is read or set. See src/lib/pulse.ts.
 */
import { isPulseRef } from "@/lib/pulse";
import { countablePath, countView, openPulse, pulseDone } from "@/lib/server/pulse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await openPulse(request, "views", ["path", "ref"]);
  if (!gate.ok) return gate.response;

  const { path, ref } = gate.body;
  if (typeof path !== "string" || !isPulseRef(ref)) return pulseDone("refused fields", 400);

  // the query string and fragment are removed, and the path is checked against the site's own pages
  const counted = countablePath(path);
  if (counted === null) return pulseDone("skipped never-counted");

  const stored = await countView(counted, ref);
  return pulseDone(`${stored ? "counted" : "not-recorded"} path=${counted} ref=${ref}`);
}
