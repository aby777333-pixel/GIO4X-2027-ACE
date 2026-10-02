"use server";

/**
 * Server actions for the ticket tools in GIO4X Control: sending a reply that
 * started as a canned reply, escalating a late ticket, and managing canned
 * replies and assignment rules (supabase/migrations/0013_ticket_tools.sql).
 *
 * The same four steps as actions-tickets.ts: who is calling, what they may
 * do, is the input on the allow-list, then the write AS THE SIGNED-IN USER.
 * Row-level security, the column grants and the functions in 0013 have the
 * final say and write the audit entries.
 *
 * Outcomes are fixed codes in the query string. Nothing typed by a caller, and
 * nothing the database said, is echoed back.
 */
import { redirect } from "next/navigation";
import { MACRO_BODY_MAX, MACRO_TITLE_MAX, RULE_NAME_MAX } from "@/components/control/ticket-tools";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/server/constants";
import { can, getAccess, SIGN_IN_PATH, type StaffContext } from "@/lib/server/staff";
import { cleanLine, cleanText, isUuid } from "@/lib/server/validate";
import type { TicketCategory, TicketPriority, TicketStatus } from "@/lib/supabase/types";

const LIST = "/control/tickets";
const MACROS = "/control/tickets/macros";
const RULES = "/control/tickets/rules";

function isStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}

function isPriority(value: unknown): value is TicketPriority {
  return typeof value === "string" && (TICKET_PRIORITIES as readonly string[]).includes(value);
}

function isCategory(value: unknown): value is TicketCategory {
  return typeof value === "string" && (TICKET_CATEGORIES as readonly string[]).includes(value);
}

async function staff(): Promise<StaffContext> {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");
  return access;
}

/** The caller, holding tickets.manage, or a redirect back to the screen with "forbidden". */
async function manager(back: string): Promise<StaffContext> {
  const ctx = await staff();
  if (!can(ctx, "tickets.manage")) redirect(`${back}?error=forbidden`);
  return ctx;
}

/** The database's refusals, as fixed codes. 42501 is a privilege or a policy; 22023 and 23514 are a value it will not take. */
function refusal(code: string | undefined): "forbidden" | "invalid" | "save" {
  if (code === "42501") return "forbidden";
  if (code === "22023" || code === "23514") return "invalid";
  return "save";
}

/** "" (leave as it is) becomes null; anything else must pass the guard. `undefined` means the value was not acceptable. */
function optional<T extends string>(value: FormDataEntryValue | null, guard: (v: unknown) => v is T): T | null | undefined {
  if (value === null || value === "") return null;
  return guard(value) ? value : undefined;
}

/* -------------------------------------------------------------------------- */
/* the reply form on a ticket                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A reply to the customer, with the changes a canned reply offered and the
 * sender left ticked. The reply is written exactly as addTicketReply writes
 * it. The changes are the same single-row update the Triage forms make, so the
 * same triggers audit them; they are applied only after the reply is stored,
 * and every value is checked BEFORE anything is written.
 *
 * Nothing here knows or cares which canned reply the text began as: by the
 * time it arrives it is the sender's own text.
 */
export async function sendTicketReply(formData: FormData): Promise<void> {
  const ctx = await staff();
  const id = formData.get("id");
  if (!isUuid(id)) redirect(`${LIST}?error=invalid`);
  const back = `${LIST}/${id}`;
  if (!can(ctx, "tickets.write")) redirect(`${back}?error=forbidden`);

  const raw = formData.get("body");
  const body = typeof raw === "string" ? cleanText(raw) : "";
  if (body.length < 1 || body.length > MACRO_BODY_MAX) redirect(`${back}?error=body`);

  // a tick box that is not ticked is simply absent from the form
  const status = optional(formData.get("apply_status"), isStatus);
  const priority = optional(formData.get("apply_priority"), isPriority);
  const category = optional(formData.get("apply_category"), isCategory);
  if (status === undefined || priority === undefined || category === undefined) redirect(`${back}?error=invalid`);

  const { error } = await ctx.supabase.from("ticket_messages").insert({ ticket_id: id, body, internal: false });
  if (error) redirect(`${back}?error=${error.code === "42501" ? "forbidden" : "save"}`);

  const changes: { status?: TicketStatus; priority?: TicketPriority; category?: TicketCategory } = {};
  if (status) changes.status = status;
  if (priority) changes.priority = priority;
  if (category) changes.category = category;
  if (Object.keys(changes).length === 0) redirect(`${back}?notice=reply#thread`);

  // The reply is already stored. If this is refused, say exactly that: the
  // reply stands and the ticked changes did not happen.
  const update = await ctx.supabase.from("tickets").update(changes).eq("id", id).select("id");
  if (update.error || !update.data || update.data.length !== 1) redirect(`${back}?error=reply_only#thread`);
  redirect(`${back}?notice=reply_set#thread`);
}

/* -------------------------------------------------------------------------- */
/* escalation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Escalate one late ticket. ticket_escalate() decides whether it is late,
 * whether it has been escalated before, raises the priority one step and
 * writes the audit entry; this only carries its answer back as a fixed code.
 */
export async function escalateTicket(formData: FormData): Promise<void> {
  const ctx = await staff();
  const id = formData.get("id");
  if (!isUuid(id)) redirect(`${LIST}?error=invalid`);
  // pressed in the overdue queue: go back there; otherwise to the ticket
  const fromQueue = formData.get("from") === "queue";
  const back = fromQueue ? `${LIST}?overdue=1&` : `${LIST}/${id}?`;
  if (!can(ctx, "tickets.write")) redirect(`${back}error=forbidden`);

  const { data, error } = await ctx.supabase.rpc("ticket_escalate", { p_id: id });
  if (error) redirect(`${back}error=${error.code === "42501" ? "forbidden" : "save"}`);
  if (data === "escalated") redirect(`${back}notice=escalated`);
  if (data === "flagged") redirect(`${back}notice=flagged`);
  if (data === "already") redirect(`${back}error=escalated_already`);
  if (data === "not_late") redirect(`${back}error=not_late`);
  redirect(`${back}error=${data === "not_found" ? "invalid" : "save"}`);
}

/* -------------------------------------------------------------------------- */
/* canned replies                                                             */
/* -------------------------------------------------------------------------- */

/** Create a canned reply, or change one (when `id` is present). */
export async function saveMacro(formData: FormData): Promise<void> {
  const ctx = await manager(MACROS);
  const id = formData.get("id");
  const editing = typeof id === "string" && id !== "";
  if (editing && !isUuid(id)) redirect(`${MACROS}?error=invalid`);
  // an error on an edit returns to the same editor (the id is a row id, not personal data)
  const back = editing ? `${MACROS}?edit=${id}&` : `${MACROS}?`;

  const rawTitle = formData.get("title");
  const rawBody = formData.get("body");
  const title = typeof rawTitle === "string" ? cleanLine(rawTitle) : "";
  const body = typeof rawBody === "string" ? cleanText(rawBody) : "";
  if (title.length < 1 || title.length > MACRO_TITLE_MAX) redirect(`${back}error=title#editor`);
  if (body.length < 1 || body.length > MACRO_BODY_MAX) redirect(`${back}error=body#editor`);

  const set_status = optional(formData.get("set_status"), isStatus);
  const set_priority = optional(formData.get("set_priority"), isPriority);
  const set_category = optional(formData.get("set_category"), isCategory);
  if (set_status === undefined || set_priority === undefined || set_category === undefined) redirect(`${back}error=invalid#editor`);

  const values = { title, body, set_status, set_priority, set_category };
  if (editing) {
    const { data, error } = await ctx.supabase.from("ticket_macros").update(values).eq("id", id).select("id");
    if (error) redirect(`${back}error=${refusal(error.code)}#editor`);
    if (!data || data.length !== 1) redirect(`${back}error=save#editor`);
    redirect(`${MACROS}?notice=saved`);
  }
  // `created_by` is not sent: the database sets the author to the caller
  const { data, error } = await ctx.supabase.from("ticket_macros").insert(values).select("id");
  if (error) redirect(`${back}error=${refusal(error.code)}#editor`);
  if (!data || data.length !== 1) redirect(`${back}error=save#editor`);
  redirect(`${MACROS}?notice=created`);
}

/** Retire a canned reply (it leaves the reply form) or bring it back. Nothing is deleted. */
export async function setMacroActive(formData: FormData): Promise<void> {
  const ctx = await manager(MACROS);
  const id = formData.get("id");
  const to = formData.get("active");
  if (!isUuid(id) || (to !== "1" && to !== "0")) redirect(`${MACROS}?error=invalid`);
  const active = to === "1";

  const { data, error } = await ctx.supabase.from("ticket_macros").update({ active }).eq("id", id).select("id");
  if (error) redirect(`${MACROS}?error=${refusal(error.code)}`);
  if (!data || data.length !== 1) redirect(`${MACROS}?error=save`);
  redirect(`${MACROS}?notice=${active ? "restored" : "retired"}`);
}

/* -------------------------------------------------------------------------- */
/* assignment rules                                                           */
/* -------------------------------------------------------------------------- */

/** Create an assignment rule (it goes to the end of the list), or change one. */
export async function saveRule(formData: FormData): Promise<void> {
  const ctx = await manager(RULES);
  const id = formData.get("id");
  const editing = typeof id === "string" && id !== "";
  if (editing && !isUuid(id)) redirect(`${RULES}?error=invalid`);
  const back = editing ? `${RULES}?edit=${id}&` : `${RULES}?`;

  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? cleanLine(rawName) : "";
  if (name.length < 1 || name.length > RULE_NAME_MAX) redirect(`${back}error=name#editor`);

  const when_category = optional(formData.get("when_category"), isCategory);
  const when_priority = optional(formData.get("when_priority"), isPriority);
  const set_priority = optional(formData.get("set_priority"), isPriority);
  const assign_to = optional(formData.get("assign_to"), isUuid);
  if (when_category === undefined || when_priority === undefined || set_priority === undefined || assign_to === undefined) redirect(`${back}error=invalid#editor`);
  // The database refuses this too (22023). Said here with its own message,
  // because "choose what the rule does" is more use than "not accepted".
  if (assign_to === null && set_priority === null) redirect(`${back}error=nothing#editor`);

  const values = { name, when_category, when_priority, assign_to, set_priority };
  // 22023 on a rule is the database saying the person named cannot be given tickets (or the rule does nothing)
  const rule = (code: string | undefined) => (code === "22023" ? "assignee" : refusal(code));
  if (editing) {
    const { data, error } = await ctx.supabase.from("ticket_rules").update(values).eq("id", id).select("id");
    if (error) redirect(`${back}error=${rule(error.code)}#editor`);
    if (!data || data.length !== 1) redirect(`${back}error=save#editor`);
    redirect(`${RULES}?notice=saved`);
  }
  const { data, error } = await ctx.supabase.from("ticket_rules").insert(values).select("id");
  if (error) redirect(`${back}error=${rule(error.code)}#editor`);
  if (!data || data.length !== 1) redirect(`${back}error=save#editor`);
  redirect(`${RULES}?notice=created`);
}

/** Switch a rule off (it stops applying to new tickets) or on again. Nothing is deleted. */
export async function setRuleActive(formData: FormData): Promise<void> {
  const ctx = await manager(RULES);
  const id = formData.get("id");
  const to = formData.get("active");
  if (!isUuid(id) || (to !== "1" && to !== "0")) redirect(`${RULES}?error=invalid`);
  const active = to === "1";

  const { data, error } = await ctx.supabase.from("ticket_rules").update({ active }).eq("id", id).select("id");
  // switching a rule back on re-checks the person it names
  if (error) redirect(`${RULES}?error=${error.code === "22023" ? "assignee" : refusal(error.code)}`);
  if (!data || data.length !== 1) redirect(`${RULES}?error=save`);
  redirect(`${RULES}?notice=${active ? "on" : "off"}`);
}

/** Move a rule one place up or down. The order is written only by ticket_rule_move(). */
export async function moveRule(formData: FormData): Promise<void> {
  const ctx = await manager(RULES);
  const id = formData.get("id");
  const dir = formData.get("dir");
  if (!isUuid(id) || (dir !== "up" && dir !== "down")) redirect(`${RULES}?error=invalid`);

  const { data, error } = await ctx.supabase.rpc("ticket_rule_move", { p_id: id, p_up: dir === "up" });
  if (error) redirect(`${RULES}?error=${error.code === "P0002" ? "invalid" : refusal(error.code)}`);
  // false: it was already first (or last); somebody else may have moved it meanwhile
  redirect(data ? `${RULES}?notice=moved` : `${RULES}?error=edge`);
}
