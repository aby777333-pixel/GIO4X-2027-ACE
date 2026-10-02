/**
 * GET /control/pipeline/more?stage=<stage>&limit=<n>  →  JSON
 *
 * What a Pipeline column asks for when "Show more" is pressed: the column
 * again, from its first card, with a larger limit, and its real count. Read
 * AS THE SIGNED-IN USER with the page's own query (src/lib/server/boards.ts),
 * so the order is the page's order and row-level security decides.
 *
 * For holders of leads.read. Both parameters are checked against allow-lists.
 * It changes nothing, so it is a plain GET with no same-origin rule; another
 * site cannot read the answer (no CORS headers) and the cookies are
 * SameSite=Lax. The response is never cached.
 */
import { BOARD_MAX, type BoardMoreAnswer, type LeadCard } from "@/components/control/board-shared";
import { readLeadColumn } from "@/lib/server/boards";
import { LEAD_STAGES } from "@/lib/server/constants";
import { fail, json } from "@/lib/server/http";
import { can, getAccess } from "@/lib/server/staff";
import type { LeadStage } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "The pipeline is not available just now.", undefined, PRIVATE);
  if (access.state === "anonymous") return fail(401, "Sign in to continue.", undefined, PRIVATE);
  if (access.state !== "staff" || !can(access, "leads.read")) return fail(403, "Your role does not include the pipeline.", undefined, PRIVATE);

  const params = new URL(request.url).searchParams;
  const stage = params.get("stage") ?? "";
  const rawLimit = params.get("limit") ?? "";
  if (!(LEAD_STAGES as readonly string[]).includes(stage) || !/^\d{1,3}$/.test(rawLimit)) return fail(400, "That request was not valid.", undefined, PRIVATE);
  const limit = Math.min(Math.max(1, Number(rawLimit)), BOARD_MAX);

  const column = await readLeadColumn(access.supabase, stage as LeadStage, limit);
  if (column.failed) return fail(503, "The pipeline could not be read just now.", undefined, PRIVATE);

  const body: BoardMoreAnswer<LeadCard> = { ok: true, count: column.count, cards: column.cards };
  return json(body, 200, PRIVATE);
}
