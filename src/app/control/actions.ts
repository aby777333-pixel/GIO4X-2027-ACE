"use server";

/**
 * Server actions for GIO4X Control.
 *
 * Every action:
 *   1. re-establishes who is calling (getAccess → Supabase Auth validates the session);
 *   2. checks the role on the server;
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
import { LEAD_STATUSES } from "@/lib/server/constants";
import { clientKey } from "@/lib/server/http";
import { rateLimit, RULES } from "@/lib/server/rate-limit";
import { canWrite, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { cleanLine, cleanText, isUuid } from "@/lib/server/validate";
import { createServerSupabase } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/supabase/types";

const HOME = "/control";

function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
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
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) outcome = "ok";
    // One answer for every refusal (wrong password, unknown address, unconfirmed
    // or disabled account): the response must not reveal whether an account exists.
    else if (error.status === 429) outcome = "throttled";
    else if (typeof error.status === "number" && error.status >= 400 && error.status < 500) outcome = "invalid";
    else outcome = "unavailable";
  } catch {
    outcome = "unavailable";
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
  if (!canWrite(ctx.role)) redirect(`${back}?error=forbidden`);

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
  if (!canWrite(ctx.role)) redirect(`${back}?error=forbidden`);

  let assignedTo: string | null;
  if (assignee === "" || assignee === "none") assignedTo = null;
  else if (assignee === "me") assignedTo = ctx.userId;
  else if (isUuid(assignee)) assignedTo = assignee;
  else redirect(`${back}?error=invalid`);

  // An agent may take or release a lead; only an admin assigns to someone else.
  // (The database enforces the same rule in a trigger.)
  if (assignedTo !== null && assignedTo !== ctx.userId && ctx.role !== "admin") redirect(`${back}?error=forbidden`);

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
  if (!canWrite(ctx.role)) redirect(`${back}?error=forbidden`);

  const body = typeof raw === "string" ? cleanText(raw) : "";
  if (body.length < 1 || body.length > 4000) redirect(`${back}?error=note`);

  // `author` is not sent: the column defaults to auth.uid() and the policy
  // requires author = auth.uid(), so a note can only be written as oneself.
  const { error } = await ctx.supabase.from("lead_notes").insert({ lead_id: id, body });
  if (error) redirect(`${back}?error=save`);
  redirect(`${back}?notice=note#notes`);
}
