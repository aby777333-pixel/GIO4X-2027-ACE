"use server";

/**
 * Server actions for the bulk bars on the Leads and Tickets lists: one change
 * applied to every ticked row.
 *
 * There is no bulk statement. The change is made ROW BY ROW, as the signed-in
 * user, through the same one-row UPDATE the single-row screens send
 * (src/lib/server/crm-writes.ts), so every row passes the same column grants,
 * policies and triggers and writes its own audit entry, exactly as if the
 * person had opened each row and pressed the button. A row the database
 * refuses is counted as refused and the others carry on.
 *
 * Limits and answers: at most 50 rows per request; the whole request is
 * refused, with nothing sent, when the action, its value or any id is not on
 * the allow-list. The answer is a fixed code and two counts. Nothing typed by
 * a caller, and nothing the database said, is returned.
 */
import { BULK_MAX, type BulkState } from "@/components/control/bulk-shared";
import { LEAD_STAGES, LEAD_STATUSES, LOST_REASONS, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/server/constants";
import { writeLeadAssignee, writeLeadStage, writeLeadStatus, writeTicketAssignee, writeTicketPriority, writeTicketStatus, type WriteCode } from "@/lib/server/crm-writes";
import { can, getAccess, type StaffContext } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

/** a few rows at a time: quick enough for fifty, and never fifty connections at once */
const PARALLEL = 5;

const listed = (list: readonly string[], value: unknown): value is string => typeof value === "string" && list.includes(value);

/** "me", "none", or a colleague's id; a colleague needs leads.assign (the database enforces the same rule in a trigger). */
function assigneeAllowed(ctx: StaffContext, value: unknown): "ok" | "invalid" | "forbidden" {
  if (value === "me" || value === "none") return "ok";
  if (!isUuid(value)) return "invalid";
  return value === ctx.userId || can(ctx, "leads.assign") ? "ok" : "forbidden";
}

/** The ticked ids, each once; or why the request stops here (none, something that is not an id, too many). */
function readIds(formData: FormData): { ids: string[] } | { code: "none" | "too-many" | "invalid" } {
  const raw = formData.getAll("id");
  if (raw.length === 0) return { code: "none" };
  // bounded before anything else is done with it
  if (raw.length > BULK_MAX * 4) return { code: "too-many" };
  // both layouts of a list (table and stacked rows) carry a box for the same row
  const ids = [...new Set(raw)].filter(isUuid);
  if (ids.length !== new Set(raw).size) return { code: "invalid" };
  if (ids.length > BULK_MAX) return { code: "too-many" };
  return { ids };
}

async function each(ids: string[], write: (id: string) => Promise<WriteCode>): Promise<BulkState> {
  let changed = 0;
  let refused = 0;
  for (let i = 0; i < ids.length; i += PARALLEL) {
    const codes = await Promise.all(ids.slice(i, i + PARALLEL).map((id) => write(id).catch((): WriteCode => "save")));
    for (const code of codes) {
      if (code === "ok") changed += 1;
      else refused += 1;
    }
  }
  return { code: "done", changed, refused };
}

async function caller(): Promise<{ ctx: StaffContext } | { code: "signed-out" | "unavailable" | "forbidden" }> {
  const access = await getAccess();
  if (access.state === "anonymous") return { code: "signed-out" };
  if (access.state === "unconfigured" || access.state === "unavailable") return { code: "unavailable" };
  if (access.state !== "staff") return { code: "forbidden" };
  return { ctx: access };
}

/** Enquiries: set the status, set the stage (a stage of "lost" needs a reason), or assign. */
export async function bulkLeads(_previous: BulkState | null, formData: FormData): Promise<BulkState> {
  const who = await caller();
  if (!("ctx" in who)) return { code: who.code };
  const { ctx } = who;
  if (!can(ctx, "leads.write")) return { code: "forbidden" };

  const picked = readIds(formData);
  if (!("ids" in picked)) return { code: picked.code };
  const { ids } = picked;

  const op = formData.get("op");
  if (op === "status") {
    const status = formData.get("status");
    if (!listed(LEAD_STATUSES, status)) return { code: "invalid" };
    return each(ids, (id) => writeLeadStatus(ctx, id, status));
  }
  if (op === "stage") {
    const stage = formData.get("stage");
    const reason = formData.get("lost_reason");
    if (!listed(LEAD_STAGES, stage)) return { code: "invalid" };
    if (stage === "lost" && !listed(LOST_REASONS, reason)) return { code: "reason" };
    return each(ids, (id) => writeLeadStage(ctx, id, stage, reason));
  }
  if (op === "assign") {
    const assignee = formData.get("assignee");
    const allowed = assigneeAllowed(ctx, assignee);
    if (allowed !== "ok") return { code: allowed };
    return each(ids, (id) => writeLeadAssignee(ctx, id, assignee));
  }
  return { code: "invalid" };
}

/** Tickets: set the status, set the priority, or assign. */
export async function bulkTickets(_previous: BulkState | null, formData: FormData): Promise<BulkState> {
  const who = await caller();
  if (!("ctx" in who)) return { code: who.code };
  const { ctx } = who;
  if (!can(ctx, "tickets.write")) return { code: "forbidden" };

  const picked = readIds(formData);
  if (!("ids" in picked)) return { code: picked.code };
  const { ids } = picked;

  const op = formData.get("op");
  if (op === "status") {
    const status = formData.get("status");
    if (!listed(TICKET_STATUSES, status)) return { code: "invalid" };
    return each(ids, (id) => writeTicketStatus(ctx, id, status));
  }
  if (op === "priority") {
    const priority = formData.get("priority");
    if (!listed(TICKET_PRIORITIES, priority)) return { code: "invalid" };
    return each(ids, (id) => writeTicketPriority(ctx, id, priority));
  }
  if (op === "assign") {
    const assignee = formData.get("assignee");
    const allowed = assigneeAllowed(ctx, assignee);
    if (allowed !== "ok") return { code: allowed };
    return each(ids, (id) => writeTicketAssignee(ctx, id, assignee));
  }
  return { code: "invalid" };
}
