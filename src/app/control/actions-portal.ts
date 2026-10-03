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
import { CONFIG_TABLES, isConfigTable, type ConfigField } from "@/components/control/portal/config-fields";
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

/** One posted field, reduced to what its kind allows. `undefined` means "not acceptable". */
function readField(field: ConfigField, raw: FormDataEntryValue | null): string | number | boolean | null | undefined {
  if (field.kind === "flag") return raw === "on";
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return field.required ? undefined : null;
  switch (field.kind) {
    case "text": {
      const clean = cleanText(text).replace(/\n+/g, " ").slice(0, field.max ?? 120);
      return clean || (field.required ? undefined : null);
    }
    // sent as text so that no digit is lost on the way to a numeric column
    case "decimal":
      return /^[0-9]{1,12}([.][0-9]{1,8})?$/.test(text) ? text : undefined;
    case "integer":
      return /^[0-9]{1,6}$/.test(text) ? Number(text) : undefined;
    case "choice":
      return (field.options ?? []).includes(text) ? text : undefined;
    case "row":
      return isUuid(text) ? text : undefined;
    // a datetime-local value, read as UTC like every time the console shows
    case "when":
      return /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(text) ? `${text}:00Z` : undefined;
  }
}

/**
 * Add, change or retire one row of the portal's configuration: a fee schedule,
 * a fee rule, a commission plan or an account type
 * (src/components/control/portal/config-fields.ts). The same order as every
 * write here: who and what they may do, the input against the allow-list, the
 * audit entry in this database (portal_config_record, 0024), then the one call
 * to the portal (control_config_write), which checks the table, the columns and
 * the values again and never deletes.
 */
export async function savePortalConfig(formData: FormData): Promise<void> {
  const table = formData.get("table");
  if (!isConfigTable(table)) redirect("/control");
  const spec = CONFIG_TABLES[table];
  const back = spec.back;
  const { ctx, db } = await decider(spec.capability, back);

  const op = formData.get("op");
  if (op !== "create" && op !== "update" && op !== "retire") redirect(`${back}?error=invalid`);
  const idRaw = formData.get("id");
  const id = op === "create" ? null : isUuid(idRaw) ? idRaw : undefined;
  if (id === undefined) redirect(`${back}?error=invalid`);

  const values: Record<string, string | number | boolean | null> = {};
  if (op !== "retire") {
    for (const field of spec.fields) {
      const value = readField(field, formData.get(field.name));
      if (value === undefined) redirect(`${back}?error=value`);
      values[field.name] = value;
    }
  }

  const record = await ctx.supabase.rpc("portal_config_record", { p_table: table, p_op: op, p_entity_id: id, p_detail: values });
  if (record.error) redirect(`${back}?error=${record.error.code === "42501" ? "forbidden" : "audit"}`);

  const { data, error } = await db.rpc("control_config_write", { p_table: table, p_op: op, p_id: id, p_values: op === "retire" ? null : values, p_actor: actorOf(ctx) });
  const outcome = (data ?? {}) as Outcome;
  if (error || outcome.result !== "ok") {
    const code = error ? "portal_error" : (outcome.result ?? "unknown");
    await ctx.supabase.rpc("portal_config_record", { p_table: table, p_op: "failed", p_entity_id: id, p_detail: { attempted: op, outcome: code } });
    const shown: Record<string, string> = { invalid: "value", duplicate: "duplicate", default_plan: "defaultplan", not_found: "missing" };
    redirect(`${back}?error=${shown[code] ?? "portal"}`);
  }
  redirect(`${back}?notice=${op === "create" ? "created" : op === "update" ? "updated" : "retired"}`);
}

/* ----------------------------------------------------------------------------
 * Introducing brokers (0025_portal_ib.sql; portal: 20261003150000_control_ib.sql)
 * -------------------------------------------------------------------------- */

const IB = "/control/ib";

/** Where an IB form returns to: the person's page when the form names one, the list otherwise. */
function ibBack(formData: FormData): string {
  const at = formData.get("at");
  return isUuid(at) ? `${IB}/${at}` : IB;
}

type IbOutcome = { result?: string; amount?: number | string; currency?: string; requested_by_name?: string };

/** The audit entry first, then one call to the portal; a refusal is recorded and shown as a fixed code. */
async function ibWrite(
  back: string,
  action: "ib.role" | "ib.link" | "ib.unlink" | "ib.plan",
  entity: string,
  detail: Record<string, string | number | boolean | null>,
  fn: string,
  args: Record<string, string | number | boolean | null>,
  done: string,
): Promise<never> {
  const { ctx, db } = await decider("partners.manage", back);
  const record = await ctx.supabase.rpc("portal_ib_record", { p_action: action, p_entity_id: entity, p_detail: detail });
  if (record.error) redirect(`${back}?error=${record.error.code === "42501" ? "forbidden" : "audit"}`);
  const { data, error } = await db.rpc(fn, { ...args, p_actor: actorOf(ctx) });
  const outcome = (data ?? {}) as IbOutcome;
  if (error || outcome.result !== "ok") {
    const code = error ? "portal_error" : (outcome.result ?? "unknown");
    await ctx.supabase.rpc("portal_ib_record", { p_action: "ib.failed", p_entity_id: entity, p_detail: { attempted: action, outcome: code } });
    const shown: Record<string, string> = {
      not_found: "missing", staff_profile: "staff", has_downline: "downline", parent_not_ib: "parent", cycle: "cycle", self: "self",
      plan_not_found: "plan", no_parent: "noparent", invalid: "value",
    };
    redirect(`${back}?error=${shown[code] ?? "portal"}`);
  }
  redirect(`${back}?notice=${done}`);
}

/** Make a client an introducing broker, or an IB a client again (refused while they have a downline). */
export async function setIbRole(formData: FormData): Promise<void> {
  const back = ibBack(formData);
  const id = formData.get("id");
  const make = formData.get("make");
  if (!isUuid(id) || (make !== "ib" && make !== "client")) redirect(`${back}?error=invalid`);
  await ibWrite(back, "ib.role", id, { make }, "control_ib_set_role", { p_user: id, p_is_ib: make === "ib" }, make === "ib" ? "promoted" : "demoted");
}

/** Put a person under an IB. If they already had a parent they are moved, with everyone beneath them. */
export async function linkIb(formData: FormData): Promise<void> {
  const back = ibBack(formData);
  const child = formData.get("child");
  const parent = formData.get("parent");
  const planRaw = formData.get("plan");
  if (!isUuid(child) || !isUuid(parent)) redirect(`${back}?error=invalid`);
  const plan = isUuid(planRaw) ? planRaw : null;
  await ibWrite(back, "ib.link", child, { parent, plan }, "control_ib_link", { p_parent: parent, p_child: child, p_plan: plan }, "linked");
}

/** Detach a person from their parent. Everyone beneath them stays beneath them. */
export async function unlinkIb(formData: FormData): Promise<void> {
  const back = ibBack(formData);
  const child = formData.get("child");
  if (!isUuid(child)) redirect(`${back}?error=invalid`);
  await ibWrite(back, "ib.unlink", child, {}, "control_ib_unlink", { p_child: child }, "unlinked");
}

/** The commission plan and, optionally, a share override on one direct link. */
export async function setIbPlan(formData: FormData): Promise<void> {
  const back = ibBack(formData);
  const child = formData.get("child");
  const parent = formData.get("parent");
  const plan = formData.get("plan");
  if (!isUuid(child) || !isUuid(parent) || !isUuid(plan)) redirect(`${back}?error=invalid`);
  const shareRaw = formData.get("share");
  const shareText = typeof shareRaw === "string" ? shareRaw.trim() : "";
  if (shareText && !/^(0([.][0-9]{1,6})?|1([.]0{1,6})?)$/.test(shareText)) redirect(`${back}?error=value`);
  await ibWrite(back, "ib.plan", child, { parent, plan, share: shareText || null }, "control_ib_set_plan", { p_parent: parent, p_child: child, p_plan: plan, p_share: shareText || null }, "plan");
}

/**
 * Pay an IB the commission awaiting settlement in one currency. It credits a
 * wallet, so it takes two people, exactly as a deposit does: request, then a
 * confirmation by somebody else (portal_ib_settlement writes each audit entry
 * and refuses the requester). Only after that is the portal asked to pay.
 */
export async function settleIb(formData: FormData): Promise<void> {
  const back = ibBack(formData);
  const { ctx, db } = await decider("partners.settle", back);
  const ib = formData.get("ib");
  const decision = formData.get("decision");
  const currencyRaw = formData.get("currency");
  if (!isUuid(ib) || (decision !== "request" && decision !== "confirm" && decision !== "cancel")) redirect(`${back}?error=invalid`);
  const currency = typeof currencyRaw === "string" && /^[A-Z]{3,4}$/.test(currencyRaw) ? currencyRaw : null;
  if (decision === "request" && !currency) redirect(`${back}?error=invalid`);

  const { data, error } = await ctx.supabase.rpc("portal_ib_settlement", { p_op: decision, p_ib: ib, p_currency: currency });
  if (error) redirect(`${back}?error=${error.code === "42501" ? "forbidden" : "audit"}`);
  const step = (data ?? {}) as IbOutcome;
  if (step.result === "pending") redirect(`${back}?notice=requested`);
  if (step.result === "cancelled") redirect(`${back}?notice=cancelled`);
  if (step.result === "exists") redirect(`${back}?error=requested`);
  if (step.result === "own") redirect(`${back}?error=own`);
  if (step.result !== "confirmed" && step.result !== "unreviewed") redirect(`${back}?error=norequest`);

  const actor = step.result === "unreviewed" ? `${actorOf(ctx)} (no second approver on staff)` : `${actorOf(ctx)}; requested by ${cleanText(step.requested_by_name ?? "").slice(0, 40)}`;
  const paid = await db.rpc("control_ib_settle", { p_ib: ib, p_currency: step.currency ?? currency, p_actor: actor.slice(0, 120) });
  const outcome = (paid.data ?? {}) as IbOutcome;
  if (paid.error || outcome.result !== "ok") {
    const code = paid.error ? "portal_error" : (outcome.result ?? "unknown");
    await ctx.supabase.rpc("portal_ib_record", { p_action: "ib.failed", p_entity_id: ib, p_detail: { attempted: "ib.settle", outcome: code } });
    redirect(`${back}?error=${code === "nothing" ? "nothing" : code === "not_found" ? "missing" : "portal"}`);
  }
  redirect(`${back}?notice=${step.result === "unreviewed" ? "paid_unreviewed" : "paid"}`);
}

/* ----------------------------------------------------------------------------
 * The remaining sections (0026_portal_ops.sql; portal: 20261003160000_control_ops.sql)
 * -------------------------------------------------------------------------- */

type OpArgs = Record<string, string | number | boolean | null>;
type OpPlan = { capability: Capability; back: string; action: string; entity: string | null; args: OpArgs; detail: OpArgs; done: string };

const text = (formData: FormData, name: string, max: number): string => {
  const raw = formData.get(name);
  return typeof raw === "string" ? cleanText(raw).replace(/\n+/g, " ").slice(0, max) : "";
};

/** What one posted form asks for, or null when it is not one of the operations or a value is not acceptable. */
function planOp(formData: FormData): OpPlan | "invalid" | "value" | null {
  const op = formData.get("op");
  const id = formData.get("id");
  switch (op) {
    case "provider_status":
    case "fund_status": {
      const status = formData.get("status");
      if (!isUuid(id) || (status !== "active" && status !== "paused" && status !== "closed")) return "invalid";
      const provider = op === "provider_status";
      return { capability: "partners.manage", back: provider ? "/control/copy" : "/control/pamm", action: provider ? "copy.status" : "pamm.status", entity: id, args: { id, status }, detail: { status }, done: "status" };
    }
    case "ledger_account_create": {
      const code = text(formData, "code", 40).toUpperCase();
      const name = text(formData, "name", 120);
      const type = formData.get("type");
      const currency = formData.get("currency");
      if (!/^[A-Z][A-Z0-9_]{2,39}$/.test(code) || !name || typeof type !== "string" || !/^[a-z]{5,9}$/.test(type) || typeof currency !== "string" || !/^[A-Z]{3,4}$/.test(currency)) return "value";
      return { capability: "ledger.manage", back: "/control/ledger", action: "ledger.account", entity: null, args: { code, name, type, currency }, detail: { op: "create", code, type, currency }, done: "account" };
    }
    case "ledger_account_active": {
      const active = formData.get("active");
      if (!isUuid(id) || (active !== "true" && active !== "false")) return "invalid";
      return { capability: "ledger.manage", back: "/control/ledger", action: "ledger.account", entity: id, args: { id, active: active === "true" }, detail: { op: active === "true" ? "on" : "off" }, done: "account" };
    }
    case "journal_post": {
      const debit = formData.get("debit");
      const credit = formData.get("credit");
      const amountRaw = formData.get("amount");
      const amount = typeof amountRaw === "string" ? amountRaw.trim() : "";
      const description = text(formData, "description", 300);
      const reference = text(formData, "reference", 120);
      if (!isUuid(debit) || !isUuid(credit)) return "invalid";
      if (!/^[0-9]{1,12}([.][0-9]{1,8})?$/.test(amount) || Number(amount) <= 0 || description.length < 5) return "value";
      // the amount travels as text so that no digit is lost on the way to a numeric column
      return { capability: "ledger.manage", back: "/control/ledger", action: "ledger.journal", entity: null, args: { debit, credit, amount, description, reference: reference || null }, detail: { debit, credit, amount, reference: reference || null }, done: "journal" };
    }
    case "legal_save": {
      const title = text(formData, "title", 160);
      const bodyRaw = formData.get("body");
      const body = typeof bodyRaw === "string" ? cleanText(bodyRaw).slice(0, 200000) : "";
      if (!title) return "value";
      if (isUuid(id)) return { capability: "documents.manage", back: "/control/documents", action: "legal.save", entity: id, args: { id, title, body }, detail: { title, characters: body.length }, done: "legal" };
      const key = text(formData, "key", 40).toLowerCase();
      if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) return "value";
      return { capability: "documents.manage", back: "/control/documents", action: "legal.save", entity: null, args: { key, title, body }, detail: { key, title, characters: body.length }, done: "legal" };
    }
    case "legal_publish": {
      const published = formData.get("published");
      if (!isUuid(id) || (published !== "true" && published !== "false")) return "invalid";
      return { capability: "documents.manage", back: "/control/documents", action: "legal.publish", entity: id, args: { id, published: published === "true" }, detail: { published: published === "true" }, done: "published" };
    }
    case "events_dispatch":
      return { capability: "events.manage", back: "/control/events", action: "events.dispatch", entity: null, args: { limit: 100 }, detail: { limit: 100 }, done: "dispatched" };
    default:
      return null;
  }
}

/**
 * One change through control_ops: the status of a signal provider or a fund,
 * a ledger account, a manual journal entry, a legal document, or a run of the
 * event queue. Who and what they may do, the input against the allow-list,
 * the audit entry in this database (portal_ops_record), then the one call.
 */
export async function runPortalOp(formData: FormData): Promise<void> {
  const plan = planOp(formData);
  if (plan === null) redirect("/control");
  if (plan === "invalid" || plan === "value") {
    // the form says which screen it came from only through its operation; fall back to the dashboard
    const op = String(formData.get("op") ?? "");
    const back = op.startsWith("provider") ? "/control/copy" : op.startsWith("fund") ? "/control/pamm" : op.startsWith("legal") ? "/control/documents" : op.startsWith("events") ? "/control/events" : "/control/ledger";
    redirect(`${back}?error=${plan}`);
  }
  const { ctx, db } = await decider(plan.capability, plan.back);

  const record = await ctx.supabase.rpc("portal_ops_record", { p_action: plan.action, p_entity_id: plan.entity, p_detail: plan.detail });
  if (record.error) redirect(`${plan.back}?error=${record.error.code === "42501" ? "forbidden" : "audit"}`);

  const { data, error } = await db.rpc("control_ops", { p_op: String(formData.get("op")), p_args: plan.args, p_actor: actorOf(ctx) });
  const outcome = (data ?? {}) as Outcome;
  if (error || outcome.result !== "ok") {
    const code = error ? "portal_error" : (outcome.result ?? "unknown");
    await ctx.supabase.rpc("portal_ops_record", { p_action: "ops.failed", p_entity_id: plan.entity, p_detail: { attempted: plan.action, outcome: code } });
    const shown: Record<string, string> = {
      invalid: "value", not_found: "missing", closed: "closed", in_use: "inuse", duplicate: "duplicate", system: "system",
      same_account: "same", inactive: "inactive", currency: "currency", too_short: "short",
    };
    redirect(`${plan.back}?error=${shown[code] ?? "portal"}`);
  }
  redirect(`${plan.back}?notice=${plan.done}`);
}
