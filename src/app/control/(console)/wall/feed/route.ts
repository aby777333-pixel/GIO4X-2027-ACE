/**
 * GET /control/wall/feed  →  JSON
 *
 * What the wallboard asks for every twenty seconds: the same counts the page
 * read when it was opened, counted again by the database at this moment.
 *
 * Polling, not Supabase Realtime, for the reason the Live Chats feed gives:
 * the staff session cookies are HttpOnly and scoped to /control, so the
 * browser has no staff session to open a realtime channel with. This route
 * reads as the signed-in member of staff instead.
 *
 * It changes nothing, so it is a plain GET with no same-origin rule; another
 * site cannot read the answer (no CORS headers) and the cookies are
 * SameSite=Lax. The answer holds counts only and is never cached. A signed-out
 * browser is normally turned away by the middleware before it gets here (a
 * redirect to sign-in, which the board does not follow); the 401 below is for
 * a session that ends between the two.
 */
import { readWall } from "@/app/control/(console)/wall/data";
import { fail, json } from "@/lib/server/http";
import { can, getAccess } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET() {
  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "The wallboard is not available just now.", undefined, PRIVATE);
  if (access.state === "anonymous") return fail(401, "Sign in to continue.", undefined, PRIVATE);
  if (access.state !== "staff" || !can(access, "command.read")) return fail(403, "Your role does not include the wallboard.", undefined, PRIVATE);

  const feed = await readWall(access);
  if (!feed) return fail(503, "The figures could not be read just now.", undefined, PRIVATE);
  return json(feed, 200, PRIVATE);
}
