/**
 * POST /control/chats/presence        →  "I am here"   (chat_presence(true))
 * POST /control/chats/presence?on=0   →  "I have left" (chat_presence(false))
 *
 * The heartbeat behind the rule that the website never offers a chat nobody is
 * there to answer. The Live Chats screen calls it once a minute while it is
 * open; the database lets the mark expire by itself after two minutes, so a
 * closed laptop stops counting without anybody doing anything.
 *
 * A route rather than a server action: it is called on a timer and once more
 * as the screen is left (fetch keepalive), and it must not re-render anything.
 * It changes state, so it is a POST with the same-origin check. The database
 * refuses anyone without chats.write whatever this file says.
 */
import { fail, isSameOrigin, json } from "@/lib/server/http";
import { can, getAccess } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "Not allowed.", undefined, PRIVATE);

  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "Live chats are not available just now.", undefined, PRIVATE);
  if (access.state === "anonymous") return fail(401, "Sign in to continue.", undefined, PRIVATE);
  // reading chats is not answering them: a read-only role is never counted as present
  if (access.state !== "staff" || !can(access, "chats.write")) return fail(403, "Your role cannot take chats.", undefined, PRIVATE);

  const on = new URL(request.url).searchParams.get("on") !== "0";
  const { error } = await access.supabase.rpc("chat_presence", { p_on: on });
  if (error) return fail(error.code === "42501" ? 403 : 503, "Your availability could not be recorded.", undefined, PRIVATE);

  return json({ ok: true, on }, 200, PRIVATE);
}
