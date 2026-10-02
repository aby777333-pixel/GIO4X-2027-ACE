/**
 * GET /control/customers/<key>/timeline?before=<time>&show=<filter>  →  JSON
 *
 * The next page of one person's timeline, for "Load older" on the customer
 * page. It is the same reader the page itself uses (src/lib/server/timeline.ts):
 * the caller is established here, customers.read is checked here and again by
 * person_timeline(), which runs as the signed-in user and leaves out every
 * kind of event the caller's role does not include.
 *
 * The person is addressed by the hash key, never by an address. `before` is a
 * timestamp and nothing else; `show` is one of a fixed list. The answer is
 * never cached. A browser that says the request came from another site is
 * refused (other sites cannot read the answer anyway; this only declines to
 * do the work for them).
 */
import { PERSON_KEY } from "@/components/control/timeline";
import { fail, json } from "@/lib/server/http";
import { can, getAccess } from "@/lib/server/staff";
import { readTimeline, timelineCursor, timelineFilter } from "@/lib/server/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return fail(403, "Not allowed.");

  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "The timeline is not available just now.");
  if (access.state === "anonymous") return fail(401, "Sign in to continue.");
  if (access.state !== "staff" || !can(access, "customers.read")) return fail(403, "Your role does not include customers.");

  const { key } = await params;
  if (!PERSON_KEY.test(key)) return fail(404, "Not found.");

  const url = new URL(request.url);
  const before = timelineCursor(url.searchParams.get("before") ?? "");
  // "older than what?" must be said: the first page belongs to the page itself
  if (!before) return fail(400, "That request was not valid.");
  const show = timelineFilter(access, url.searchParams.get("show") ?? "");

  const page = await readTimeline(access, key, show, before);
  if (page.failed) return fail(503, "The timeline is not available just now.");

  return json({ ok: true, events: page.events, hasOlder: page.hasOlder });
}
