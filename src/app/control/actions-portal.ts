"use server";

/**
 * Decisions GIO4X Control makes in the client portal's database.
 *
 * These are the only writes Control makes there. Each one is a single call to
 * a function in the portal's database that only the server's secret key can
 * execute (portal/supabase/migrations/20261003130000_control_actions.sql), and
 * each decides ONE record whose status is still open: a decision is made once.
 *
 * The order is fixed, because the portal's database cannot know who is asking:
 *   1. who is calling (active staff) and whether they hold the capability;
 *   2. the input, reduced to an id, a fixed choice and a short cleaned text;
 *   3. the audit entry, written in THIS database as the signed-in member of
 *      staff (portal_action_record, 0022; for an approval of money, the
 *      request and confirmation functions of 0023). The database checks the
 *      capability again. No audit entry, no decision;
 *   4. the decision, in the portal's database, with the person's name as text;
 *   5. if the portal refused or failed, a second audit entry that says so.
 *
 * Outcomes are fixed codes in the query string. Nothing typed by a caller, and
 * nothing either database said, is echoed back.
 */
import { redirect } from "next/navigation";
import type { Capability } from "@/lib/server/constants";
import { requirePortal } from "@/lib/server/portal-db";
import { cleanText, isUuid } from "@/lib/server/validate";

const KYC = "/control/kyc";
const FUNDS = "/control/funds";
/** Must equal the lengths the portal's functions keep (300 and 120). */
const REASON_MAX = 300;
const REF_MAX = 120;

async function decider(capability: Capability, back: string) {
  const access = await requirePortal(capability);
  if (access.state === "none") redirect("/control");
  if (access.state === "forbidden") redirect(`${back}?error=forbidden`);
  if (access.state === "unconfigured") redirect(`${back}?error=unconfigured`);
  return access;
}

/** The member of staff as the portal records them: a name, and the address when there is one. */
function actorOf(ctx: { displayName: string; email: string | null }): string {
  const name = cleanText(ctx.displayName).slice(0, 80) || "Control staff";
  return ctx.email ? `${name} <${ctx.email}>`.slice(0, 120) : name;
}

type Outcome = { result?: string };

export async function decideKycDocument(formData: FormData): Promise<void> {
  const { ctx, db } = await decider("kyc.decide", KYC);

  const id = formData.get("id");
  const decision = formData.get("decision");
  if (!isUuid(id) || (decision !== "approve" && decision !== "reject")) redirect(`${KYC}?error=invalid`);
  const approve = decision === "approve";
  const reasonRaw = formData.get("reason");
  const reason = typeof reasonRaw === "string" ? cleanText(reasonRaw).replace(/\n+/g, " ").slice(0, REASON_MAX) : "";
  if (!approve && reason.length < 3) redirect(`${KYC}?error=reason`);

  const record = await ctx.supabase.rpc("portal_action_record", { p_action: approve ? "kyc.approve" : "kyc.reject", p_entity_id: id, p_detail: approve ? {} : { reason } });
  if (record.error) redirect(`${KYC}?error=${record.error.code === "42501" ? "forbidden" : "audit"}`);

  const { data, error } = await db.rpc("control_review_kyc_document", { p_doc_id: id, p_approve: approve, p_reason: approve ? null : reason, p_actor: actorOf(ctx) });
  const outcome = (data ?? {}) as Outcome;
  if (error || outcome.result !== "ok") {
    const code = error ? "portal_error" : (outcome.result ?? "unknown");
    await ctx.supabase.rpc("portal_action_record", { p_action: "kyc.failed", p_entity_id: id, p_detail: { attempted: decision, outcome: code } });
    redirect(`${KYC}?error=${code === "already_decided" ? "decided" : code === "not_found" ? "missing" : "portal"}`);
  }
  redirect(`${KYC}?notice=${approve ? "approved" : "rejected"}`);
}

/**
 * A pending deposit or withdrawal. Approving one changes a balance, so it takes
 * two people (0023_portal_four_eyes.sql):
 *
 *   approve   the first person asks. Nothing changes in the portal. If nobody
 *             else on staff could confirm, the database approves it at once and
 *             records it as unreviewed; the change is then made here.
 *   confirm   a second, different person confirms; the database refuses the
 *             requester. Only then is the change made in the portal.
 *   reject    one person is enough. An open request is withdrawn with it.
 *   cancel    an open request is withdrawn; the transaction stays pending.
 *
 * The approval's audit entry is written by the database inside request/confirm,
 * before the portal is touched; a failure afterwards is recorded as funds.failed.
 */
export async function settleWalletTransaction(formData: FormData): Promise<void> {
  const { ctx, db } = await decider("funds.settle", FUNDS);
  const back = `${FUNDS}?status=pending`;

  const id = formData.get("id");
  const decision = formData.get("decision");
  if (!isUuid(id) || (decision !== "approve" && decision !== "confirm" && decision !== "reject" && decision !== "cancel")) redirect(`${FUNDS}?error=invalid`);
  const refRaw = formData.get("reference");
  // a payment reference: letters, digits and the few marks references carry; nothing else survives
  let reference = typeof refRaw === "string" ? refRaw.replace(/[^A-Za-z0-9 ._\-/#:]/g, "").trim().slice(0, REF_MAX) : "";

  if (decision === "cancel") {
    const { data, error } = await ctx.supabase.rpc("portal_approval_cancel", { p_tx: id });
    if (error) redirect(`${FUNDS}?error=${error.code === "42501" ? "forbidden" : "audit"}`);
    redirect(data ? `${back}&notice=cancelled` : `${FUNDS}?error=norequest`);
  }

  // the record must still be an open deposit or withdrawal before anybody is asked to approve it
  const current = await db.from("wallet_transactions").select("type, status").eq("id", id).maybeSingle();
  if (current.error) redirect(`${FUNDS}?error=portal`);
  if (!current.data) redirect(`${FUNDS}?error=missing`);
  if (current.data.type !== "deposit" && current.data.type !== "withdraw") redirect(`${FUNDS}?error=type`);
  if (current.data.status !== "pending" && current.data.status !== "processing") redirect(`${FUNDS}?error=decided`);

  let actor = actorOf(ctx);
  let action: "approve" | "reject";

  if (decision === "reject") {
    const record = await ctx.supabase.rpc("portal_action_record", { p_action: "funds.reject", p_entity_id: id, p_detail: reference ? { reference } : {} });
    if (record.error) redirect(`${FUNDS}?error=${record.error.code === "42501" ? "forbidden" : "audit"}`);
    // a request somebody made earlier is withdrawn with the rejection; there may be none
    await ctx.supabase.rpc("portal_approval_cancel", { p_tx: id });
    action = "reject";
  } else if (decision === "approve") {
    const { data, error } = await ctx.supabase.rpc("portal_approval_request", { p_tx: id, p_reference: reference });
    if (error) redirect(`${FUNDS}?error=${error.code === "42501" ? "forbidden" : "audit"}`);
    if (data === "pending") redirect(`${back}&notice=requested`);
    if (data === "exists") redirect(`${FUNDS}?error=requested`);
    if (data !== "unreviewed") redirect(`${FUNDS}?error=audit`);
    actor = `${actor} (no second approver on staff)`.slice(0, 120);
    action = "approve";
  } else {
    const { data, error } = await ctx.supabase.rpc("portal_approval_confirm", { p_tx: id });
    if (error) redirect(`${FUNDS}?error=${error.code === "42501" ? "forbidden" : "audit"}`);
    const confirmed = (data ?? {}) as { result?: string; reference?: string | null; requested_by_name?: string };
    if (confirmed.result === "own") redirect(`${FUNDS}?error=own`);
    if (confirmed.result !== "confirmed") redirect(`${FUNDS}?error=norequest`);
    reference = confirmed.reference ?? "";
    actor = `${actor}; requested by ${cleanText(confirmed.requested_by_name ?? "").slice(0, 40)}`.slice(0, 120);
    action = "approve";
  }

  const { data, error } = await db.rpc("control_settle_wallet_transaction", { p_tx_id: id, p_action: action, p_gateway_ref: reference || null, p_actor: actor });
  const outcome = (data ?? {}) as Outcome;
  if (error || outcome.result !== "ok") {
    const code = error ? "portal_error" : (outcome.result ?? "unknown");
    await ctx.supabase.rpc("portal_action_record", { p_action: "funds.failed", p_entity_id: id, p_detail: { attempted: decision, outcome: code } });
    const shown: Record<string, string> = { already_decided: "decided", not_found: "missing", insufficient_balance: "balance", wallet_not_active: "wallet", not_settled_here: "type" };
    redirect(`${FUNDS}?error=${shown[code] ?? "portal"}`);
  }
  redirect(`${back}&notice=${action === "reject" ? "rejected" : decision === "approve" ? "unreviewed" : "approved"}`);
}
