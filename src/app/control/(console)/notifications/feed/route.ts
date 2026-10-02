/**
 * GET /control/notifications/feed  →  JSON
 *
 * What the bell asks for every 30 seconds: how many of the caller's
 * notifications are unread, and the latest thirty.
 *
 * For any member of staff, about themselves only: the table is read AS THE
 * SIGNED-IN USER, and row-level security (staff_notifications_own_select in
 * 0018_personal.sql) returns nobody else's rows. There is no privileged
 * client, and nothing in the answer is personal data about a customer: a
 * title is the database's own fixed sentence with, at most, a reference.
 *
 * Polling, not Supabase Realtime, for the reason the Live Chats feed gives:
 * the staff session cookies are HttpOnly and scoped to /control, so the
 * browser holds no staff session to open a realtime channel with.
 *
 * It changes nothing, so it is a plain GET with no same-origin rule; another
 * site cannot read the answer (no CORS headers) and the cookies are
 * SameSite=Lax. The response is never cached.
 */
import { NOTIFY_PANEL_SIZE, type NotifyFeed } from "@/components/control/notify";
import { fail, json } from "@/lib/server/http";
import { readNotifications } from "@/lib/server/personal";
import { getAccess } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET() {
  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "Notifications are not available just now.", undefined, PRIVATE);
  if (access.state === "anonymous") return fail(401, "Sign in to continue.", undefined, PRIVATE);
  if (access.state !== "staff") return fail(403, "This account has no access to GIO4X Control.", undefined, PRIVATE);

  const result = await readNotifications(access.supabase, NOTIFY_PANEL_SIZE);
  if (result.failed) return fail(503, "Notifications could not be read just now.", undefined, PRIVATE);

  const body: NotifyFeed = { ok: true, at: new Date().toISOString(), unread: result.unread, items: result.items };
  return json(body, 200, PRIVATE);
}
