/**
 * One change to one enquiry or one ticket, answered with a fixed code instead
 * of a redirect.
 *
 * The single-row screens change a row through the server actions in
 * src/app/control/actions.ts and actions-tickets.ts, which redirect. The boards
 * (a card dropped in another column) and the bulk bar (the same change to many
 * rows) cannot follow a redirect per row, so they call these functions. Each
 * one repeats its action's steps exactly: the same allow-lists, the same
 * capability, and the SAME statement, an UPDATE of one row by id sent AS THE
 * SIGNED-IN USER with `.select("id")`, so that the column grants, row-level
 * security and the triggers in 0003, 0005 and 0007 decide and write the audit
 * entry for each row. There is no other path to the database here and no
 * privileged client.
 *
 * Keep each function in step with its action:
 *   writeLeadStatus      setLeadStatus       (actions.ts)
 *   writeLeadStage       setLeadStage        (actions.ts)
 *   writeLeadAssignee    assignLead          (actions.ts)
 *   writeTicketStatus    setTicketStatus     (actions-tickets.ts)
 *   writeTicketPriority  setTicketPriority   (actions-tickets.ts)
 *   writeTicketAssignee  assignTicket        (actions-tickets.ts)
 *
 * Not a "use server" file: nothing here is callable from a browser. The
 * callers (actions-board.ts, actions-bulk.ts) establish who is calling first.
 */
import { LEAD_STAGES, LEAD_STATUSES, LOST_REASONS, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/server/constants";
import { can, type StaffContext } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";
import type { LeadStage, LeadStatus, LostReason, TicketPriority, TicketStatus } from "@/lib/supabase/types";

/**
 * ok         the row was changed (exactly one row came back)
 * invalid    the input is not on the allow-list; nothing was sent
 * reason     a stage of "lost" without a reason; nothing was sent
 * forbidden  the caller's role does not allow it, or the database said 42501
 * save       the database changed no row or answered with an error
 */
export type WriteCode = "ok" | "invalid" | "reason" | "forbidden" | "save";

type Ctx = Pick<StaffContext, "supabase" | "userId" | "caps">;

const isLeadStatus = (v: unknown): v is LeadStatus => typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
const isLeadStage = (v: unknown): v is LeadStage => typeof v === "string" && (LEAD_STAGES as readonly string[]).includes(v);
const isLostReason = (v: unknown): v is LostReason => typeof v === "string" && (LOST_REASONS as readonly string[]).includes(v);
const isTicketStatus = (v: unknown): v is TicketStatus => typeof v === "string" && (TICKET_STATUSES as readonly string[]).includes(v);
const isTicketPriority = (v: unknown): v is TicketPriority => typeof v === "string" && (TICKET_PRIORITIES as readonly string[]).includes(v);

/**
 * "none" (or empty) releases, "me" takes, an id gives it to that person.
 * Giving a row to somebody else needs leads.assign, for enquiries and tickets
 * alike; the database enforces the same rule in a trigger.
 */
function resolveAssignee(ctx: Ctx, assignee: unknown): { ok: true; value: string | null } | { ok: false; code: "invalid" | "forbidden" } {
  let value: string | null;
  if (assignee === "" || assignee === "none") value = null;
  else if (assignee === "me") value = ctx.userId;
  else if (isUuid(assignee)) value = assignee;
  else return { ok: false, code: "invalid" };
  if (value !== null && value !== ctx.userId && !can(ctx, "leads.assign")) return { ok: false, code: "forbidden" };
  return { ok: true, value };
}

/* -------------------------------------------------------------------------- */
/* enquiries                                                                  */
/* -------------------------------------------------------------------------- */

type LeadChange = { status: LeadStatus } | { assigned_to: string | null } | { stage: LeadStage; lost_reason: LostReason | null };

/**
 * `.select("id")` makes a refusal visible: a row that row-level security
 * filters out is not an error in Postgres, it is simply "0 rows updated".
 */
async function updateLead(ctx: Ctx, id: string, values: LeadChange): Promise<WriteCode> {
  try {
    const { data, error } = await ctx.supabase.from("leads").update(values).eq("id", id).select("id");
    if (error) return error.code === "42501" ? "forbidden" : "save";
    return data && data.length === 1 ? "ok" : "save";
  } catch {
    return "save";
  }
}

export async function writeLeadStatus(ctx: Ctx, id: unknown, status: unknown): Promise<WriteCode> {
  if (!isUuid(id) || !isLeadStatus(status)) return "invalid";
  if (!can(ctx, "leads.write")) return "forbidden";
  return updateLead(ctx, id, { status });
}

export async function writeLeadStage(ctx: Ctx, id: unknown, stage: unknown, reason: unknown): Promise<WriteCode> {
  if (!isUuid(id) || !isLeadStage(stage)) return "invalid";
  if (!can(ctx, "leads.write")) return "forbidden";
  // A lost enquiry always says why (the database has the same constraint).
  let lostReason: LostReason | null = null;
  if (stage === "lost") {
    if (!isLostReason(reason)) return "reason";
    lostReason = reason;
  }
  return updateLead(ctx, id, { stage, lost_reason: lostReason });
}

export async function writeLeadAssignee(ctx: Ctx, id: unknown, assignee: unknown): Promise<WriteCode> {
  if (!isUuid(id)) return "invalid";
  if (!can(ctx, "leads.write")) return "forbidden";
  const to = resolveAssignee(ctx, assignee);
  if (!to.ok) return to.code;
  return updateLead(ctx, id, { assigned_to: to.value });
}

/* -------------------------------------------------------------------------- */
/* tickets                                                                    */
/* -------------------------------------------------------------------------- */

type TicketChange = { status: TicketStatus } | { priority: TicketPriority } | { assigned_to: string | null };

async function updateTicket(ctx: Ctx, id: string, values: TicketChange): Promise<WriteCode> {
  try {
    const { data, error } = await ctx.supabase.from("tickets").update(values).eq("id", id).select("id");
    // 42501 is the database refusing (privilege, policy or the assignment trigger)
    if (error) return error.code === "42501" ? "forbidden" : "save";
    return data && data.length === 1 ? "ok" : "save";
  } catch {
    return "save";
  }
}

/**
 * Status only. What a reply does to a ticket (open becomes waiting for the
 * customer, the first response is stamped) is the database's doing when the
 * reply is written; nothing here imitates it.
 */
export async function writeTicketStatus(ctx: Ctx, id: unknown, status: unknown): Promise<WriteCode> {
  if (!isUuid(id) || !isTicketStatus(status)) return "invalid";
  if (!can(ctx, "tickets.write")) return "forbidden";
  return updateTicket(ctx, id, { status });
}

export async function writeTicketPriority(ctx: Ctx, id: unknown, priority: unknown): Promise<WriteCode> {
  if (!isUuid(id) || !isTicketPriority(priority)) return "invalid";
  if (!can(ctx, "tickets.write")) return "forbidden";
  return updateTicket(ctx, id, { priority });
}

export async function writeTicketAssignee(ctx: Ctx, id: unknown, assignee: unknown): Promise<WriteCode> {
  if (!isUuid(id)) return "invalid";
  if (!can(ctx, "tickets.write")) return "forbidden";
  const to = resolveAssignee(ctx, assignee);
  if (!to.ok) return to.code;
  return updateTicket(ctx, id, { assigned_to: to.value });
}
