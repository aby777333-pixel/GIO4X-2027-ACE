/**
 * GET /control/tickets/board-more?status=<status>&limit=<n>  →  JSON
 *
 * What a column of the Tickets board asks for when "Show more" is pressed: the
 * column again, from its first card, with a larger limit, and its real count.
 * Read AS THE SIGNED-IN USER with the board's own query
 * (src/lib/server/boards.ts). A card carries no name and no address, so
 * neither is read here.
 *
 * For holders of tickets.read. Both parameters are checked against
 * allow-lists. It changes nothing, so it is a plain GET with no same-origin
 * rule; another site cannot read the answer (no CORS headers) and the cookies
 * are SameSite=Lax. The response is never cached.
 */
import { BOARD_MAX, type BoardMoreAnswer, type TicketCard } from "@/components/control/board-shared";
import { readTicketColumn } from "@/lib/server/boards";
import { TICKET_STATUSES } from "@/lib/server/constants";
import { fail, json } from "@/lib/server/http";
import { can, getAccess } from "@/lib/server/staff";
import type { TicketStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "The tickets are not available just now.", undefined, PRIVATE);
  if (access.state === "anonymous") return fail(401, "Sign in to continue.", undefined, PRIVATE);
  if (access.state !== "staff" || !can(access, "tickets.read")) return fail(403, "Your role does not include tickets.", undefined, PRIVATE);

  const params = new URL(request.url).searchParams;
  const status = params.get("status") ?? "";
  const rawLimit = params.get("limit") ?? "";
  if (!(TICKET_STATUSES as readonly string[]).includes(status) || !/^\d{1,3}$/.test(rawLimit)) return fail(400, "That request was not valid.", undefined, PRIVATE);
  const limit = Math.min(Math.max(1, Number(rawLimit)), BOARD_MAX);

  const column = await readTicketColumn(access.supabase, status as TicketStatus, limit);
  if (column.failed) return fail(503, "The tickets could not be read just now.", undefined, PRIVATE);

  const body: BoardMoreAnswer<TicketCard> = { ok: true, count: column.count, cards: column.cards };
  return json(body, 200, PRIVATE);
}
