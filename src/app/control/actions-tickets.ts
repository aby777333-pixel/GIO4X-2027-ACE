"use server";

/**
 * Server actions for Tickets in GIO4X Control.
 *
 * The same four steps as src/app/control/actions.ts: who is calling, what they
 * may do, is the input on the allow-list, then the write AS THE SIGNED-IN
 * USER. Column grants, row-level security and the triggers in
 * supabase/migrations/0007_support.sql have the final say and write the audit
 * entries.
 *
 * What the database does by itself, and so is not done here: a reply to the
 * customer stamps the first response, takes the ticket for the replier when
 * nobody holds it, and moves "open" to "waiting for customer"; a status of
 * solved or closed stamps the solved time.
 *
 * Outcomes are fixed codes in the query string. Nothing typed by a caller, and
 * nothing the database said, is echoed back.
 */
import { redirect } from "next/navigation";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/server/constants";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { cleanText, isUuid } from "@/lib/server/validate";
import type { TicketCategory, TicketPriority, TicketStatus } from "@/lib/supabase/types";

const LIST = "/control/tickets";
/** Must equal `ticket_messages_body_valid` in 0007_support.sql. */
const BODY_MAX = 5000;

function isStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}

function isPriority(value: unknown): value is TicketPriority {
  return typeof value === "string" && (TICKET_PRIORITIES as readonly string[]).includes(value);
}

function isCategory(value: unknown): value is TicketCategory {
  return typeof value === "string" && (TICKET_CATEGORIES as readonly string[]).includes(value);
}

async function writer() {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");
  return access;
}

/** The ticket the form is about, or a redirect to the queue when the id is not one. */
function ticketPath(id: FormDataEntryValue | null): { id: string; back: string } {
  if (!isUuid(id)) redirect(`${LIST}?error=invalid`);
  return { id, back: `${LIST}/${id}` };
}

/** 42501 is the database refusing (privilege, policy or the assignment trigger); everything else is "could not be saved". */
function refusal(code: string | undefined): "forbidden" | "save" {
  return code === "42501" ? "forbidden" : "save";
}

type Change = { status: TicketStatus } | { priority: TicketPriority } | { category: TicketCategory } | { assigned_to: string | null };

/**
 * One column, one ticket. `.select("id")` makes a refusal visible: a row that
 * row-level security filters out is not an error in Postgres, it is simply
 * "0 rows updated".
 */
async function change(ctx: Awaited<ReturnType<typeof writer>>, id: string, back: string, values: Change, notice: string): Promise<never> {
  const { data, error } = await ctx.supabase.from("tickets").update(values).eq("id", id).select("id");
  if (error) redirect(`${back}?error=${refusal(error.code)}`);
  if (!data || data.length !== 1) redirect(`${back}?error=save`);
  redirect(`${back}?notice=${notice}`);
}

export async function setTicketStatus(formData: FormData): Promise<void> {
  const ctx = await writer();
  const { id, back } = ticketPath(formData.get("id"));
  const status = formData.get("status");
  if (!isStatus(status)) redirect(`${back}?error=invalid`);
  if (!can(ctx, "tickets.write")) redirect(`${back}?error=forbidden`);
  await change(ctx, id, back, { status }, "status");
}

export async function setTicketPriority(formData: FormData): Promise<void> {
  const ctx = await writer();
  const { id, back } = ticketPath(formData.get("id"));
  const priority = formData.get("priority");
  if (!isPriority(priority)) redirect(`${back}?error=invalid`);
  if (!can(ctx, "tickets.write")) redirect(`${back}?error=forbidden`);
  await change(ctx, id, back, { priority }, "priority");
}

export async function setTicketCategory(formData: FormData): Promise<void> {
  const ctx = await writer();
  const { id, back } = ticketPath(formData.get("id"));
  const category = formData.get("category");
  if (!isCategory(category)) redirect(`${back}?error=invalid`);
  if (!can(ctx, "tickets.write")) redirect(`${back}?error=forbidden`);
  await change(ctx, id, back, { category }, "category");
}

export async function assignTicket(formData: FormData): Promise<void> {
  const ctx = await writer();
  const { id, back } = ticketPath(formData.get("id"));
  const assignee = formData.get("assignee");
  if (!can(ctx, "tickets.write")) redirect(`${back}?error=forbidden`);

  let assignedTo: string | null;
  if (assignee === "" || assignee === "none") assignedTo = null;
  else if (assignee === "me") assignedTo = ctx.userId;
  else if (isUuid(assignee)) assignedTo = assignee;
  else redirect(`${back}?error=invalid`);

  // Anyone who works tickets may take or release one; giving it to somebody
  // else needs leads.assign. (The database enforces the same rule in a trigger.)
  if (assignedTo !== null && assignedTo !== ctx.userId && !can(ctx, "leads.assign")) redirect(`${back}?error=forbidden`);

  await change(ctx, id, back, { assigned_to: assignedTo }, "assigned");
}

/**
 * A message on the thread. `author` and `author_kind` are not sent: the
 * columns default to the caller and "staff", and the policy requires exactly
 * that, so a message can only be written as oneself.
 */
async function addMessage(formData: FormData, internal: boolean): Promise<never> {
  const ctx = await writer();
  const { id, back } = ticketPath(formData.get("id"));
  const raw = formData.get("body");
  if (!can(ctx, "tickets.write")) redirect(`${back}?error=forbidden`);

  const body = typeof raw === "string" ? cleanText(raw) : "";
  if (body.length < 1 || body.length > BODY_MAX) redirect(`${back}?error=body`);

  const { error } = await ctx.supabase.from("ticket_messages").insert({ ticket_id: id, body, internal });
  if (error) redirect(`${back}?error=${refusal(error.code)}`);
  redirect(`${back}?notice=${internal ? "note" : "reply"}#thread`);
}

/** Visible to the customer on the website. The database moves an open ticket to "waiting for customer" itself. */
export async function addTicketReply(formData: FormData): Promise<void> {
  await addMessage(formData, false);
}

/** Staff only. Never returned to the customer, and it does not move the ticket. */
export async function addTicketNote(formData: FormData): Promise<void> {
  await addMessage(formData, true);
}
