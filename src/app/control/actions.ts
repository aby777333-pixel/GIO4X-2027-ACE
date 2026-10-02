"use server";

/**
 * Server actions for GIO4X Control.
 *
 * Every action:
 *   1. re-establishes who is calling (getAccess → Supabase Auth validates the session);
 *   2. checks the capability on the server (the database checks it again);
 *   3. validates its input against an allow-list;
 *   4. performs the write AS THE SIGNED-IN USER, so row-level security, column
 *      privileges and the audit triggers apply. There is no privileged client.
 *
 * Next.js refuses a server action whose Origin does not match the Host, which
 * covers cross-site request forgery for these cookie-authenticated writes.
 * Outcomes are reported with fixed codes in the query string; nothing a caller
 * typed is ever echoed back.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LEAD_STAGES, LEAD_STATUSES, LOST_REASONS, STAFF_ROLES } from "@/lib/server/constants";
import { clientKey } from "@/lib/server/http";
import { rateLimit, RULES } from "@/lib/server/rate-limit";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { cleanLine, cleanText, isUuid, normaliseEmail } from "@/lib/server/validate";
import { createServerSupabase } from "@/lib/supabase/server";
import type { LeadStage, LeadStatus, LostReason, StaffRole } from "@/lib/supabase/types";

const HOME = "/control";

function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

function isLeadStage(value: unknown): value is LeadStage {
  return typeof value === "string" && (LEAD_STAGES as readonly string[]).includes(value);
}

function isLostReason(value: unknown): value is LostReason {
  return typeof value === "string" && (LOST_REASONS as readonly string[]).includes(value);
}

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* session                                                                    */
/* -------------------------------------------------------------------------- */

export async function signIn(formData: FormData): Promise<void> {
  const ip = clientKey(await headers());
  if (!rateLimit("control:sign-in", ip, RULES.signIn).ok) redirect(`${SIGN_IN_PATH}?error=throttled`);

  const emailRaw = formData.get("email");
  const password = formData.get("password");
  const email = typeof emailRaw === "string" ? cleanLine(emailRaw).toLowerCase() : "";
  if (!email || email.length > 254 || typeof password !== "string" || password.length < 1 || password.length > 256) {
    redirect(`${SIGN_IN_PATH}?error=invalid`);
  }

  const supabase = await createServerSupabase();
  if (!supabase) redirect(`${SIGN_IN_PATH}?error=unavailable`);

  let outcome: "ok" | "invalid" | "throttled" | "unavailable" = "unavailable";
  // A failure that never produced an answer from the Auth server (a dropped
  // connection, a cold start, a 5xx) is tried once more before giving up.
  for (let attempt = 0; attempt < 2 && outcome === "unavailable"; attempt++) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) outcome = "ok";
      // One answer for every refusal (wrong password, unknown address, unconfirmed
      // or disabled account): the response must not reveal whether an account exists.
      else if (error.status === 429) outcome = "throttled";
      else if (typeof error.status === "number" && error.status >= 400 && error.status < 500) outcome = "invalid";
      // name and status only: never the address or the password
      else console.error("[control] sign-in unavailable", error.name, error.status ?? "no-status");
    } catch (e) {
      console.error("[control] sign-in threw", e instanceof Error ? e.name : "unknown");
    }
  }

  if (outcome !== "ok") redirect(`${SIGN_IN_PATH}?error=${outcome}`);
  redirect(HOME);
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  if (supabase) {
    try {
      // ends this session and clears its cookies; other devices are unaffected
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* the cookies are cleared locally even if the Auth server cannot be reached */
    }
  }
  redirect(`${SIGN_IN_PATH}?notice=signed-out`);
}

/* -------------------------------------------------------------------------- */
/* leads                                                                      */
/* -------------------------------------------------------------------------- */

async function writer() {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect(HOME);
  return access;
}

export async function setLeadStatus(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("id");
  const status = formData.get("status");
  if (!isUuid(id)) redirect("/control/leads?error=invalid");
  const back = `/control/leads/${id}`;
  if (!isLeadStatus(status)) redirect(`${back}?error=invalid`);
  if (!can(ctx, "leads.write")) redirect(`${back}?error=forbidden`);

  // .select() makes a refusal visible: RLS that filters the row out is not an
  // error in Postgres, it is simply "0 rows updated".
  const { data, error } = await ctx.supabase.from("leads").update({ status }).eq("id", id).select("id");
  if (error || !data || data.length !== 1) redirect(`${back}?error=save`);
  redirect(`${back}?notice=status`);
}

export async function assignLead(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("id");
  const assignee = formData.get("assignee");
  if (!isUuid(id)) redirect("/control/leads?error=invalid");
  const back = `/control/leads/${id}`;
  if (!can(ctx, "leads.write")) redirect(`${back}?error=forbidden`);

  let assignedTo: string | null;
  if (assignee === "" || assignee === "none") assignedTo = null;
  else if (assignee === "me") assignedTo = ctx.userId;
  else if (isUuid(assignee)) assignedTo = assignee;
  else redirect(`${back}?error=invalid`);

  // Anyone who works enquiries may take or release one; assigning to someone
  // else needs leads.assign. (The database enforces the same rule in a trigger.)
  if (assignedTo !== null && assignedTo !== ctx.userId && !can(ctx, "leads.assign")) redirect(`${back}?error=forbidden`);

  const { data, error } = await ctx.supabase.from("leads").update({ assigned_to: assignedTo }).eq("id", id).select("id");
  if (error || !data || data.length !== 1) redirect(`${back}?error=save`);
  redirect(`${back}?notice=assigned`);
}

export async function addLeadNote(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("id");
  const raw = formData.get("body");
  if (!isUuid(id)) redirect("/control/leads?error=invalid");
  const back = `/control/leads/${id}`;
  if (!can(ctx, "leads.write")) redirect(`${back}?error=forbidden`);

  const body = typeof raw === "string" ? cleanText(raw) : "";
  if (body.length < 1 || body.length > 4000) redirect(`${back}?error=note`);

  // `author` is not sent: the column defaults to auth.uid() and the policy
  // requires author = auth.uid(), so a note can only be written as oneself.
  const { error } = await ctx.supabase.from("lead_notes").insert({ lead_id: id, body });
  if (error) redirect(`${back}?error=save`);
  redirect(`${back}?notice=note#notes`);
}

export async function setLeadStage(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("id");
  const stage = formData.get("stage");
  const reason = formData.get("lost_reason");
  if (!isUuid(id)) redirect("/control/leads?error=invalid");
  const back = `/control/leads/${id}`;
  if (!isLeadStage(stage)) redirect(`${back}?error=invalid`);
  if (!can(ctx, "leads.write")) redirect(`${back}?error=forbidden`);

  // A lost enquiry always says why (the database has the same constraint).
  let lostReason: LostReason | null = null;
  if (stage === "lost") {
    if (!isLostReason(reason)) redirect(`${back}?error=reason`);
    lostReason = reason;
  }

  const { data, error } = await ctx.supabase.from("leads").update({ stage, lost_reason: lostReason }).eq("id", id).select("id");
  if (error || !data || data.length !== 1) redirect(`${back}?error=save`);
  redirect(`${back}?notice=stage`);
}

/* -------------------------------------------------------------------------- */
/* follow-ups                                                                 */
/* -------------------------------------------------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

/** A due time from the form's UTC date and time fields, or null when it is not a real, near-future moment. */
function parseDue(date: unknown, time: unknown): string | null {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const clock = typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "09:00";
  const due = new Date(`${date}T${clock}:00Z`);
  if (Number.isNaN(due.getTime()) || due.toISOString().slice(0, 10) !== date) return null;
  const now = Date.now();
  // the database allows one day back and three years ahead; stay inside it
  if (due.getTime() < now - DAY_MS + 60_000 || due.getTime() > now + 3 * 365 * DAY_MS) return null;
  return due.toISOString();
}

export async function addLeadTask(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("id");
  const rawTitle = formData.get("title");
  const assignee = formData.get("assignee");
  if (!isUuid(id)) redirect("/control/leads?error=invalid");
  const back = `/control/leads/${id}`;
  if (!can(ctx, "tasks.write")) redirect(`${back}?error=forbidden`);

  const title = typeof rawTitle === "string" ? cleanLine(rawTitle) : "";
  if (title.length < 1 || title.length > 200) redirect(`${back}?error=task`);
  const dueAt = parseDue(formData.get("due_date"), formData.get("due_time"));
  if (!dueAt) redirect(`${back}?error=due`);

  let assignedTo = ctx.userId;
  if (isUuid(assignee) && assignee !== ctx.userId) {
    if (!can(ctx, "leads.assign")) redirect(`${back}?error=forbidden`);
    assignedTo = assignee;
  }

  // `created_by` is not sent: the database sets it to the caller.
  const { error } = await ctx.supabase.from("lead_tasks").insert({ lead_id: id, title, due_at: dueAt, assigned_to: assignedTo });
  if (error) redirect(`${back}?error=save`);
  redirect(`${back}?notice=task#tasks`);
}

export async function setTaskDone(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("task");
  const done = formData.get("done") === "1";
  const from = formData.get("from");
  const list = from === "overview" ? "/control" : "/control/tasks";
  if (!isUuid(id)) redirect(`${list}?error=invalid`);
  if (!can(ctx, "tasks.write")) redirect(`${list}?error=forbidden`);

  const { data, error } = await ctx.supabase.from("lead_tasks").update({ done }).eq("id", id).select("id, lead_id");
  const row = data?.[0];
  const back = from === "lead" && row ? `/control/leads/${row.lead_id}` : list;
  if (error || !data || data.length !== 1) redirect(`${back}?error=save`);
  redirect(`${back}?notice=${done ? "done" : "reopened"}${from === "lead" ? "#tasks" : ""}`);
}

/* -------------------------------------------------------------------------- */
/* staff                                                                      */
/* -------------------------------------------------------------------------- */

const STAFF = "/control/staff";

/** The database's refusals, as fixed codes. Nothing the database said is shown to the caller. */
function staffError(code: string | undefined, kind: "grant" | "change" | "decide"): string {
  if (code === "42501") return "forbidden";
  if (code === "P0002") return kind === "grant" ? "no-account" : "gone";
  if (code === "23505") return kind === "grant" ? "exists" : "pending";
  if (code === "22023") return "nochange";
  if (code === "23514") return "last-manager";
  return "save";
}

/** Whether a request was applied at once (nobody else could approve it) or is waiting for a second person. */
async function staffOutcome(ctx: Awaited<ReturnType<typeof writer>>, changeId: string | null): Promise<"applied" | "requested"> {
  if (!changeId) return "requested";
  const { data } = await ctx.supabase.from("staff_changes").select("status").eq("id", changeId).maybeSingle();
  return data?.status === "applied" ? "applied" : "requested";
}

export async function grantStaff(formData: FormData): Promise<void> {
  const ctx = await writer();
  if (!can(ctx, "staff.manage")) redirect(`${STAFF}?error=forbidden`);

  const email = normaliseEmail(formData.get("email"));
  const role = formData.get("role");
  const rawName = formData.get("display_name");
  const name = typeof rawName === "string" ? cleanLine(rawName) : "";
  if (!email || !isStaffRole(role) || name.length < 1 || name.length > 80) redirect(`${STAFF}?error=invalid`);

  const { data, error } = await ctx.supabase.rpc("staff_propose_grant", { p_email: email, p_role: role, p_display_name: name });
  if (error) redirect(`${STAFF}?error=${staffError(error.code, "grant")}`);
  redirect(`${STAFF}?notice=${await staffOutcome(ctx, typeof data === "string" ? data : null)}`);
}

export async function changeStaff(formData: FormData): Promise<void> {
  const ctx = await writer();
  if (!can(ctx, "staff.manage")) redirect(`${STAFF}?error=forbidden`);

  const user = formData.get("user");
  const role = formData.get("role");
  const rawName = formData.get("display_name");
  const active = formData.get("active");
  const name = typeof rawName === "string" ? cleanLine(rawName) : "";
  if (!isUuid(user) || !isStaffRole(role) || name.length < 1 || name.length > 80 || (active !== "1" && active !== "0")) redirect(`${STAFF}?error=invalid`);
  if (user === ctx.userId) redirect(`${STAFF}?error=self`);

  const { data, error } = await ctx.supabase.rpc("staff_propose_change", { p_user: user, p_role: role, p_display_name: name, p_active: active === "1" });
  if (error) redirect(`${STAFF}?error=${staffError(error.code, "change")}`);
  redirect(`${STAFF}?notice=${await staffOutcome(ctx, typeof data === "string" ? data : null)}`);
}

export async function decideStaffChange(formData: FormData): Promise<void> {
  const ctx = await writer();
  if (!can(ctx, "staff.manage")) redirect(`${STAFF}?error=forbidden`);

  const change = formData.get("change");
  const decision = formData.get("decision");
  if (!isUuid(change) || (decision !== "approve" && decision !== "reject" && decision !== "withdraw")) redirect(`${STAFF}?error=invalid`);

  const { error } =
    decision === "withdraw"
      ? await ctx.supabase.rpc("staff_cancel", { p_change: change })
      : await ctx.supabase.rpc("staff_decide", { p_change: change, p_approve: decision === "approve" });
  if (error) redirect(`${STAFF}?error=${staffError(error.code, "decide")}`);
  redirect(`${STAFF}?notice=${decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "withdrawn"}`);
}
