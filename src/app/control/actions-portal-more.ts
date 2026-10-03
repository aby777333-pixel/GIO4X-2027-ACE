"use server";

/**
 * More changes GIO4X Control makes in the client portal's database
 * (0027_portal_clients_fees.sql; portal: 20261003170000_control_more.sql):
 * marketing materials and campaign links for introducing brokers, a client's
 * account status, and fees charged, waived or reversed by hand.
 *
 * The order is the one src/app/control/actions-portal.ts keeps, for the same
 * reason (the portal's database cannot know who is asking):
 *   1. who is calling (active staff) and whether they hold the capability;
 *   2. the input, reduced to ids, fixed choices and short cleaned text;
 *   3. the audit entry, written in THIS database as the signed-in member of
 *      staff (portal_ops_record; for a charge or a reversal, which move a
 *      client's money, the request and confirmation of portal_two_person).
 *      No audit entry, no change;
 *   4. the change, in ONE call to the portal (control_more), with the
 *      person's name as text;
 *   5. if the portal refused or failed, a second audit entry that says so.
 *
 * Outcomes are fixed codes in the query string (MoreBits.tsx turns them into
 * sentences). Nothing typed by a caller, and nothing either database said, is
 * echoed back. Amounts travel as decimal text from the form to the portal.
 */
import { redirect } from "next/navigation";
import { FEE_TYPES } from "@/components/control/portal/config-fields";
import type { Capability } from "@/lib/server/constants";
import { requirePortal, type PortalDb } from "@/lib/server/portal-db";
import type { StaffContext } from "@/lib/server/staff";
import { cleanText, isUuid } from "@/lib/server/validate";
import type { Json } from "@/lib/supabase/types";

const MARKETING = "/control/marketing";
const IB = "/control/ib";
const CLIENTS = "/control/clients";
const FEES = "/control/fees";
/** Must equal the length the portal's functions keep for a reason or a note. */
const NOTE_MAX = 300;
const NOTE_MIN = 5;
const MATERIAL_KINDS = ["banner", "logo", "video", "document", "copy", "landing_page", "other"] as const;
const DESTINATIONS = ["register", "register-demo", "home", "raptor"] as const;
const CLIENT_STATUSES = ["active", "suspended", "closed"] as const;
const AMOUNT = /^[0-9]{1,9}([.][0-9]{1,2})?$/;

// decider() and actorOf() are copies of the two in src/app/control/actions-portal.ts,
// which does not export them (a "use server" file exports actions only). Keep them the same.
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
type Args = Record<string, string | number | boolean | null>;

/** A posted id, lower case as both databases keep them, or null. */
function uuid(raw: FormDataEntryValue | null): string | null {
  return isUuid(raw) ? raw.toLowerCase() : null;
}

/** One line of cleaned text, cut to `max`. */
function line(raw: FormDataEntryValue | null, max: number): string {
  return typeof raw === "string" ? cleanText(raw).replace(/\n+/g, " ").slice(0, max) : "";
}

function choice<T extends string>(raw: FormDataEntryValue | null, allowed: readonly T[]): T | null {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

/** A refusal or a failure in the portal: recorded here, then shown as a fixed code. */
async function refused(ctx: StaffContext, back: string, entity: string | null, attempted: string, code: string, shown: Record<string, string>): Promise<never> {
  await ctx.supabase.rpc("portal_ops_record", { p_action: "ops.failed", p_entity_id: entity, p_detail: { attempted, outcome: code } });
  redirect(`${back}?error=${shown[code] ?? "portal"}`);
}

/** The audit entry first, then one call to control_more; a refusal is recorded and shown as a fixed code. */
async function write(
  access: { ctx: StaffContext; db: PortalDb },
  back: string,
  action: "marketing.material" | "marketing.link" | "client.status" | "fee.waive",
  entity: string | null,
  detail: Args,
  op: string,
  args: Args,
  done: string,
  shown: Record<string, string>,
): Promise<never> {
  const { ctx, db } = access;
  const record = await ctx.supabase.rpc("portal_ops_record", { p_action: action, p_entity_id: entity, p_detail: detail });
  if (record.error) redirect(`${back}?error=${record.error.code === "42501" ? "forbidden" : "audit"}`);
  const { data, error } = await db.rpc("control_more", { p_op: op, p_args: args, p_actor: actorOf(ctx) });
  const outcome = (data ?? {}) as Outcome;
  if (error || outcome.result !== "ok") await refused(ctx, back, entity, action, error ? "portal_error" : (outcome.result ?? "unknown"), shown);
  redirect(`${back}?notice=${done}`);
}

/* ----------------------------------------------------------------------------
 * Marketing for introducing brokers
 * -------------------------------------------------------------------------- */

/** Add a marketing material, or change one. The file itself is hosted elsewhere: only its https address is kept. */
export async function saveMaterial(formData: FormData): Promise<void> {
  const access = await decider("partners.manage", MARKETING);

  const idRaw = formData.get("id");
  const id = typeof idRaw === "string" && idRaw !== "" ? uuid(idRaw) : null;
  if (idRaw !== null && idRaw !== "" && !id) redirect(`${MARKETING}?error=invalid`);
  const title = line(formData.get("title"), 160);
  const kind = choice(formData.get("kind"), MATERIAL_KINDS);
  const urlRaw = formData.get("url");
  const url = typeof urlRaw === "string" ? urlRaw.trim() : "";
  const description = line(formData.get("description"), 400);
  const languageRaw = formData.get("language");
  const language = typeof languageRaw === "string" && languageRaw.trim() ? languageRaw.trim() : "en";
  const sortRaw = formData.get("sort");
  const sort = typeof sortRaw === "string" && sortRaw.trim() ? sortRaw.trim() : "0";
  if (!title || !kind || url.length > 500 || !/^https:\/\/\S{4,500}$/.test(url) || !/^[a-z-]{2,8}$/.test(language) || !/^[0-9]{1,4}$/.test(sort)) redirect(`${MARKETING}?error=field`);
  const active = formData.get("active") === "on";

  await write(
    access,
    MARKETING,
    "marketing.material",
    id,
    { title, kind },
    "material_save",
    { ...(id ? { id } : {}), title, kind, url, description: description || null, language, sort: Number(sort), active },
    "material_saved",
    { invalid: "field", not_found: "gone" },
  );
}

/** Switch a material off. It stays on record; IBs no longer see it. */
export async function retireMaterial(formData: FormData): Promise<void> {
  const access = await decider("partners.manage", MARKETING);
  const id = uuid(formData.get("id"));
  if (!id) redirect(`${MARKETING}?error=invalid`);
  await write(access, MARKETING, "marketing.material", id, { op: "retire" }, "material_retire", { id }, "material_retired", { not_found: "gone" });
}

/** A campaign link for one IB, made on their behalf. The portal makes the code. */
export async function createCampaignLink(formData: FormData): Promise<void> {
  const at = uuid(formData.get("at"));
  const back = at ? `${IB}/${at}` : IB;
  const access = await decider("partners.manage", back);

  const owner = uuid(formData.get("owner"));
  const destination = choice(formData.get("destination"), DESTINATIONS);
  const name = line(formData.get("name"), 80);
  const subRaw = formData.get("sub_id");
  const subId = typeof subRaw === "string" ? subRaw.trim() : "";
  // the codes below are ones the IB pages already have sentences for (IbBits.tsx), plus not_ib and link_created (MoreBits.tsx)
  if (!owner || !destination || (subId !== "" && !/^[A-Za-z0-9_-]{1,40}$/.test(subId))) redirect(`${back}?error=invalid`);

  await write(
    access,
    back,
    "marketing.link",
    owner,
    { name: name || null, destination, sub_id: subId || null },
    "referral_create",
    { owner, name: name || null, destination, sub_id: subId || null },
    "link_created",
    { not_found: "missing", not_ib: "not_ib", invalid: "invalid" },
  );
}

/* ----------------------------------------------------------------------------
 * Clients
 * -------------------------------------------------------------------------- */

/** Activate, suspend or close a client's portal account. Suspending and closing must say why. */
export async function setClientStatus(formData: FormData): Promise<void> {
  const id = uuid(formData.get("id"));
  const back = id ? `${CLIENTS}/${id}` : CLIENTS;
  const access = await decider("clients.manage", back);

  const status = choice(formData.get("status"), CLIENT_STATUSES);
  if (!id || !status) redirect(`${back}?error=invalid`);
  const reason = line(formData.get("reason"), NOTE_MAX);
  if (status !== "active" && reason.length < NOTE_MIN) redirect(`${back}?error=reason`);

  // An account is closed only when nothing is left in it and nothing is in motion. The
  // portal's database refuses the change itself (profiles_close_guard); asking first lets
  // the screen say what stands in the way. The codes are fixed words, safe in a URL.
  if (status === "closed") {
    const check = await access.db.rpc("client_close_blockers", { p_user: id });
    if (check.error) redirect(`${back}?error=portal`);
    const why = ((check.data ?? []) as unknown[]).filter((c): c is string => typeof c === "string" && /^[a-z_]{3,30}$/.test(c));
    if (why.length > 0) redirect(`${back}?error=blocked&why=${why.join(".")}`);
  }

  await write(access, back, "client.status", id, { status, reason: reason || null }, "client_status", { id, status, reason }, "status", {
    not_found: "gone",
    staff_profile: "staffprofile",
    invalid: "invalid",
  });
}

/* ----------------------------------------------------------------------------
 * Fees by hand
 * -------------------------------------------------------------------------- */

/** A charge that is still pending is waived: one person, once. */
export async function waiveFee(formData: FormData): Promise<void> {
  const access = await decider("fees.charge", FEES);
  const id = uuid(formData.get("id"));
  if (!id) redirect(`${FEES}?error=invalid`);
  await write(access, FEES, "fee.waive", id, {}, "fee_waive", { id }, "waived", { not_found: "gone", already_done: "done" });
}

type Step = { result?: string; payload?: Json; requested_by_name?: string };
type Decision = "request" | "confirm" | "cancel";

/**
 * One step of a two-person change (portal_two_person, 0027). The database
 * writes the audit entry for each step and refuses the requester as the
 * confirmer. Returns only when the server should now act: a confirmation by a
 * second person, or a request made while nobody else on staff could confirm
 * (recorded as unreviewed). Every other outcome redirects from here.
 */
async function twoPerson(ctx: StaffContext, back: string, kind: "fee_charge" | "fee_reverse", decision: Decision, id: string, payload: Json | null): Promise<{ payload: Json; actor: string; unreviewed: boolean }> {
  const { data, error } = await ctx.supabase.rpc("portal_two_person", { p_kind: kind, p_op: decision, p_id: id, p_payload: payload });
  if (error) redirect(`${back}?error=${error.code === "42501" ? "forbidden" : "audit"}`);
  const step = (data ?? {}) as Step;
  if (decision === "cancel") redirect(step.result === "cancelled" ? `${back}?notice=cancelled` : `${back}?error=norequest`);
  if (step.result === "pending") redirect(`${back}?notice=requested`);
  if (step.result === "exists") redirect(`${back}?error=requested`);
  if (step.result === "own") redirect(`${back}?error=own`);
  if (decision === "request" && step.result !== "unreviewed") redirect(`${back}?error=audit`);
  if (decision === "confirm" && step.result !== "confirmed") redirect(`${back}?error=norequest`);
  const unreviewed = step.result === "unreviewed";
  const actor = unreviewed ? `${actorOf(ctx)} (no second approver on staff)` : `${actorOf(ctx)}; requested by ${cleanText(step.requested_by_name ?? "").slice(0, 40)}`;
  return { payload: step.payload ?? {}, actor: actor.slice(0, 120), unreviewed };
}

type Charge = { user_id: string; fee_type: string; amount: string; notes: string };

/** What a charge needs, from the form or from the request the database kept; null when any part is not acceptable. */
function chargeOf(userId: unknown, feeType: unknown, amountRaw: unknown, notesRaw: unknown): Charge | null {
  const amount = typeof amountRaw === "string" ? amountRaw.trim() : "";
  const notes = typeof notesRaw === "string" ? cleanText(notesRaw).replace(/\n+/g, " ").slice(0, NOTE_MAX) : "";
  if (!isUuid(userId) || typeof feeType !== "string" || !(FEE_TYPES as readonly string[]).includes(feeType)) return null;
  // compared with zero only; the amount itself stays text so that no digit is lost on the way to a numeric column
  if (!AMOUNT.test(amount) || !(Number(amount) > 0) || notes.length < NOTE_MIN) return null;
  return { user_id: userId.toLowerCase(), fee_type: feeType, amount, notes };
}

/**
 * Charge a fee of a stated amount to a client's main USD wallet. It debits a
 * client's money, so it takes two people:
 *
 *   request   the first person says whom, which fee, how much and why. Nothing
 *             changes in the portal; the details are kept with the request so
 *             that the second person confirms exactly that.
 *   confirm   a different person confirms; only then is the wallet debited.
 *   cancel    an open request is withdrawn.
 *
 * The request's id is also the charge's idempotency key in the portal, so one
 * request is charged at most once. The audit entries for the charge are
 * written by portal_two_person; a failure afterwards is recorded as ops.failed.
 */
export async function chargeFeeByHand(formData: FormData): Promise<void> {
  const at = uuid(formData.get("at"));
  const back = at ? `${CLIENTS}/${at}` : FEES;
  const { ctx, db } = await decider("fees.charge", back);

  const decision = choice(formData.get("decision"), ["request", "confirm", "cancel"] as const);
  if (!decision) redirect(`${back}?error=invalid`);

  let id: string;
  let asked: Json | null = null;
  if (decision === "request") {
    if (!uuid(formData.get("user_id"))) redirect(`${back}?error=invalid`);
    const charge = chargeOf(formData.get("user_id"), formData.get("fee_type"), formData.get("amount"), formData.get("notes"));
    if (!charge) redirect(`${back}?error=field`);
    // the wallet the fee would come from must exist and be active before anybody is asked to confirm
    const wallet = await db.from("wallets").select("status").eq("user_id", charge.user_id).eq("type", "main").eq("currency", "USD").limit(1).maybeSingle();
    if (wallet.error) redirect(`${back}?error=portal`);
    if (!wallet.data) redirect(`${back}?error=nowallet`);
    if (wallet.data.status !== "active") redirect(`${back}?error=wallet`);
    id = crypto.randomUUID();
    asked = charge;
  } else {
    const posted = uuid(formData.get("id"));
    if (!posted) redirect(`${back}?error=invalid`);
    id = posted;
  }

  const step = await twoPerson(ctx, back, "fee_charge", decision, id, asked);
  const kept = step.payload && typeof step.payload === "object" && !Array.isArray(step.payload) ? step.payload : {};
  // what the database kept is checked again: it is the only thing sent to the portal
  const charge = chargeOf(kept.user_id, kept.fee_type, kept.amount, kept.notes);
  if (!charge) return refused(ctx, back, id, "fee.charge", "bad_request", {});

  const { data, error } = await db.rpc("control_more", { p_op: "fee_charge", p_args: { ...charge, key: id }, p_actor: step.actor });
  const outcome = (data ?? {}) as Outcome;
  if (error || outcome.result !== "ok") {
    await refused(ctx, back, id, "fee.charge", error ? "portal_error" : (outcome.result ?? "unknown"), {
      invalid: "field",
      not_found: "nowallet",
      wallet_not_active: "wallet",
      insufficient_balance: "balance",
      already_done: "done",
    });
  }
  redirect(`${back}?notice=${step.unreviewed ? "charged_unreviewed" : "charged"}`);
}

/**
 * Reverse a fee that was applied: the journal is reversed and the wallet is
 * credited back. Two people, as for a charge; the request is kept against the
 * charge's own id, with a note that says why.
 */
export async function reverseFee(formData: FormData): Promise<void> {
  const { ctx, db } = await decider("fees.charge", FEES);

  const decision = choice(formData.get("decision"), ["request", "confirm", "cancel"] as const);
  const id = uuid(formData.get("id"));
  if (!decision || !id) redirect(`${FEES}?error=invalid`);

  let asked: Json | null = null;
  if (decision === "request") {
    const note = line(formData.get("note"), NOTE_MAX);
    if (note.length < NOTE_MIN) redirect(`${FEES}?error=reason`);
    // the charge must still be an applied fee before anybody is asked to confirm its reversal
    const current = await db.from("fee_charges").select("status, computed_amount").eq("id", id).maybeSingle();
    if (current.error) redirect(`${FEES}?error=portal`);
    if (!current.data) redirect(`${FEES}?error=gone`);
    if (current.data.status !== "applied") redirect(`${FEES}?error=done`);
    if (!(Number(current.data.computed_amount) > 0)) redirect(`${FEES}?error=notfee`);
    asked = { note };
  }

  const step = await twoPerson(ctx, FEES, "fee_reverse", decision, id, asked);

  const { data, error } = await db.rpc("control_more", { p_op: "fee_reverse", p_args: { id }, p_actor: step.actor });
  const outcome = (data ?? {}) as Outcome;
  if (error || outcome.result !== "ok") {
    await refused(ctx, FEES, id, "fee.reverse", error ? "portal_error" : (outcome.result ?? "unknown"), { not_found: "gone", already_done: "done", not_a_fee: "notfee" });
  }
  redirect(`${FEES}?notice=${step.unreviewed ? "reversed_unreviewed" : "reversed"}`);
}
