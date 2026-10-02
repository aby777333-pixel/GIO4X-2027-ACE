/**
 * GET /control/chats/feed?c=<uuid>&after=<last message id>  →  JSON
 *
 * What the Live Chats screen asks for every few seconds: the conversation
 * list, whether the website is offering chat, and the messages that arrived in
 * the selected conversation since the last one the screen already has.
 *
 * Polling, not Supabase Realtime: the staff session cookies are HttpOnly and
 * scoped to /control, so the browser has no staff session to open a realtime
 * channel with. This route reads as the signed-in member of staff instead, so
 * row-level security applies exactly as it does on the page.
 *
 * It changes nothing, so it is a plain GET with no same-origin rule; another
 * site cannot read the answer (no CORS headers) and the cookies are
 * SameSite=Lax. The response is never cached.
 */
import { readBoard, readThread } from "@/app/control/(console)/chats/data";
import type { ChatFeed } from "@/components/control/views/ChatsLive";
import { fail, json } from "@/lib/server/http";
import { can, getAccess } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "Live chats are not available just now.", undefined, PRIVATE);
  if (access.state === "anonymous") return fail(401, "Sign in to continue.", undefined, PRIVATE);
  if (access.state !== "staff" || !can(access, "chats.read")) return fail(403, "Your role does not include live chats.", undefined, PRIVATE);

  const params = new URL(request.url).searchParams;
  const c = params.get("c");
  const afterRaw = params.get("after") ?? "0";
  // message ids are a bigint identity: digits only, and well inside what a JS number holds exactly
  const after = /^\d{1,15}$/.test(afterRaw) ? Number(afterRaw) : 0;

  const [board, thread] = await Promise.all([readBoard(access.supabase), isUuid(c) ? readThread(access.supabase, c, after) : null]);
  if (board.failed || thread?.failed) return fail(503, "Live chats could not be read just now.", undefined, PRIVATE);

  const body: ChatFeed = {
    ok: true,
    at: board.at,
    enabled: board.enabled,
    offered: board.offered,
    present: board.present,
    conversations: board.conversations,
    selected: thread?.selected ?? null,
    messages: thread?.messages ?? [],
  };
  return json(body, 200, PRIVATE);
}
