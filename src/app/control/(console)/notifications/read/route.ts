/**
 * POST /control/notifications/read  { "all": true } | { "ids": [1, 2, …] }  →  JSON
 *
 * What the bell sends when a notification is opened or "Mark all read" is
 * pressed. It calls notifications_mark_read() (0018_personal.sql) AS THE
 * SIGNED-IN USER: the function marks only the caller's own rows, so an id
 * that belongs to a colleague changes nothing.
 *
 * It is a write, so it must come from this site (Origin or Referer) as JSON;
 * the cookies are SameSite=Lax as well. Ids are whole numbers and at most 200
 * of them; anything else is refused before the database is asked.
 */
import { fail, isJsonRequest, isSameOrigin, json, readBodyCapped } from "@/lib/server/http";
import { getAccess } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };
const MAX_BYTES = 4 * 1024;
const MAX_IDS = 200;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "That request did not come from this site.", undefined, PRIVATE);
  if (!isJsonRequest(request)) return fail(415, "Send JSON.", undefined, PRIVATE);

  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "Notifications are not available just now.", undefined, PRIVATE);
  if (access.state === "anonymous") return fail(401, "Sign in to continue.", undefined, PRIVATE);
  if (access.state !== "staff") return fail(403, "This account has no access to GIO4X Control.", undefined, PRIVATE);

  const raw = await readBodyCapped(request, MAX_BYTES);
  if (!raw.ok) return fail(413, "That request is too large.", undefined, PRIVATE);
  let input: unknown;
  try {
    input = JSON.parse(raw.text);
  } catch {
    return fail(400, "That request was not valid.", undefined, PRIVATE);
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail(400, "That request was not valid.", undefined, PRIVATE);
  const { all, ids } = input as { all?: unknown; ids?: unknown };

  let args: { p_ids?: number[] };
  if (all === true && ids === undefined) args = {};
  else if (all === undefined && Array.isArray(ids) && ids.length >= 1 && ids.length <= MAX_IDS && ids.every((id) => Number.isSafeInteger(id) && id > 0)) args = { p_ids: ids as number[] };
  else return fail(400, "That request was not valid.", undefined, PRIVATE);

  const { data, error } = await access.supabase.rpc("notifications_mark_read", args);
  if (error) return fail(error.code === "42501" ? 403 : 503, "The notifications could not be marked read just now.", undefined, PRIVATE);
  return json({ ok: true, marked: Number(data ?? 0) }, 200, PRIVATE);
}
