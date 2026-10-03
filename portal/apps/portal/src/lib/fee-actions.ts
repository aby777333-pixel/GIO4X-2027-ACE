"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";
import type { Enums, Json, Tables } from "@gio4x/supabase";

// ===========================================================================
// Fee Engine + Ledger server actions
// ---------------------------------------------------------------------------
// Config writes (schedules, rules, chart-of-accounts) are admin-gated and
// flow through the cookie-bound client; the DB RLS independently enforces the
// same rule. Money mutations (charge a fee, post a journal, distribute a
// rebate) go through the SECURITY DEFINER staff_* RPCs added in
// 20260529140000 — staff-gated at the DB, no service-role key in the runtime.
// ===========================================================================

export type FeeActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { user: null, isAdmin: false, error: "Not signed in." as const };
  const role = user.profile?.role;
  const isStaff = role === "staff" || role === "admin";
  if (!isStaff) return { user: null, isAdmin: false, error: "Staff access only." as const };
  return { user, isAdmin: role === "admin", error: null };
}

async function requireAdmin() {
  const { user, isAdmin, error } = await requireStaff();
  if (!user) return { user: null, error };
  if (!isAdmin) return { user: null, error: "Admin access only." as const };
  return { user, error: null };
}

function newIdempotencyKey(prefix: string): string {
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${r}`;
}

function revalidateFees() {
  revalidatePath("/staff/fees");
  revalidatePath("/staff/ledger");
}

// ---------------------------------------------------------------------------
// READ helpers (server components call these directly)
// ---------------------------------------------------------------------------

export type ScheduleWithRules = Tables<"fee_schedules"> & {
  rules: Tables<"fee_rules">[];
};

export async function loadFeeSchedules(): Promise<ScheduleWithRules[]> {
  const supabase = getSupabaseServer();
  const { data: schedules } = await supabase
    .from("fee_schedules")
    .select("*")
    .order("precedence", { ascending: true })
    .order("code", { ascending: true })
    .order("version", { ascending: false });
  if (!schedules?.length) return [];

  const { data: rules } = await supabase
    .from("fee_rules")
    .select("*")
    .in(
      "schedule_id",
      schedules.map((s) => s.id),
    )
    .order("priority", { ascending: true });

  const bySchedule = new Map<string, Tables<"fee_rules">[]>();
  for (const r of rules ?? []) {
    const list = bySchedule.get(r.schedule_id) ?? [];
    list.push(r);
    bySchedule.set(r.schedule_id, list);
  }
  return schedules.map((s) => ({ ...s, rules: bySchedule.get(s.id) ?? [] }));
}

export async function loadFeeCharges(limit = 50): Promise<Tables<"fee_charges">[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("fee_charges")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function loadLedgerAccounts(): Promise<Tables<"ledger_account_balances">[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("ledger_account_balances")
    .select("*")
    .order("type", { ascending: true })
    .order("code", { ascending: true });
  return data ?? [];
}

export type JournalEntryWithLines = Tables<"journal_entries"> & {
  lines: Array<Tables<"journal_lines"> & { account_code: string | null }>;
};

export async function loadJournal(limit = 50): Promise<JournalEntryWithLines[]> {
  const supabase = getSupabaseServer();
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("*")
    .order("posted_at", { ascending: false })
    .limit(limit);
  if (!entries?.length) return [];

  const { data: lines } = await supabase
    .from("journal_lines")
    .select("*, account:ledger_accounts(code)")
    .in(
      "entry_id",
      entries.map((e) => e.id),
    );

  const byEntry = new Map<string, JournalEntryWithLines["lines"]>();
  for (const l of (lines ?? []) as Array<
    Tables<"journal_lines"> & { account: { code: string } | null }
  >) {
    const list = byEntry.get(l.entry_id) ?? [];
    list.push({ ...l, account_code: l.account?.code ?? null });
    byEntry.set(l.entry_id, list);
  }
  return entries.map((e) => ({ ...e, lines: byEntry.get(e.id) ?? [] }));
}

// ---------------------------------------------------------------------------
// FEE SCHEDULE config (admin)
// ---------------------------------------------------------------------------

export type CreateScheduleInput = {
  code: string;
  name: string;
  version?: number;
  precedence?: number;
  scope?: Record<string, unknown>;
  description?: string;
  effective_from?: string;
  effective_to?: string | null;
};

export async function createFeeSchedule(
  input: CreateScheduleInput,
): Promise<FeeActionResult<{ id: string }>> {
  const { user, error } = await requireAdmin();
  if (!user) return { ok: false, error };

  const code = input.code?.trim();
  const name = input.name?.trim();
  if (!code) return { ok: false, error: "Schedule code is required." };
  if (!name) return { ok: false, error: "Schedule name is required." };

  const supabase = getSupabaseServer();
  const { data, error: insErr } = await supabase
    .from("fee_schedules")
    .insert({
      code,
      name,
      version: input.version && input.version > 0 ? input.version : 1,
      precedence: input.precedence ?? 100,
      scope: (input.scope ?? {}) as Json,
      description: input.description?.trim() || "",
      effective_from: input.effective_from || undefined,
      effective_to: input.effective_to || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insErr || !data) {
    return { ok: false, error: insErr?.message ?? "Could not create schedule." };
  }
  revalidateFees();
  return { ok: true, data: { id: data.id }, message: "Fee schedule created." };
}

export async function updateFeeSchedule(
  id: string,
  patch: Partial<{
    name: string;
    precedence: number;
    active: boolean;
    scope: Record<string, unknown>;
    description: string;
    effective_to: string | null;
  }>,
): Promise<FeeActionResult> {
  const { user, error } = await requireAdmin();
  if (!user) return { ok: false, error };

  const supabase = getSupabaseServer();
  const { error: updErr } = await supabase
    .from("fee_schedules")
    .update({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.precedence !== undefined ? { precedence: patch.precedence } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.scope !== undefined ? { scope: patch.scope as Json } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
      ...(patch.effective_to !== undefined ? { effective_to: patch.effective_to } : {}),
    })
    .eq("id", id);
  if (updErr) return { ok: false, error: updErr.message };
  revalidateFees();
  return { ok: true, message: "Schedule updated." };
}

// ---------------------------------------------------------------------------
// FEE RULE config (admin)
// ---------------------------------------------------------------------------

export type CreateRuleInput = {
  schedule_id: string;
  fee_type: Enums<"fee_type">;
  calc_method: Enums<"fee_calc_method">;
  rate?: number;
  min_amount?: number | null;
  max_amount?: number | null;
  currency?: Enums<"wallet_currency">;
  tiers?: unknown[];
  is_rebate?: boolean;
  priority?: number;
};

export async function createFeeRule(
  input: CreateRuleInput,
): Promise<FeeActionResult<{ id: string }>> {
  const { user, error } = await requireAdmin();
  if (!user) return { ok: false, error };
  if (!input.schedule_id) return { ok: false, error: "Schedule is required." };

  const supabase = getSupabaseServer();
  const { data, error: insErr } = await supabase
    .from("fee_rules")
    .insert({
      schedule_id: input.schedule_id,
      fee_type: input.fee_type,
      calc_method: input.calc_method,
      rate: Number.isFinite(input.rate) ? Number(input.rate) : 0,
      min_amount: input.min_amount ?? null,
      max_amount: input.max_amount ?? null,
      currency: input.currency ?? "USD",
      tiers: (input.tiers ?? []) as Json,
      is_rebate: input.is_rebate ?? false,
      priority: input.priority ?? 100,
    })
    .select("id")
    .single();
  if (insErr || !data) {
    return { ok: false, error: insErr?.message ?? "Could not create rule." };
  }
  revalidateFees();
  return { ok: true, data: { id: data.id }, message: "Fee rule added." };
}

export async function updateFeeRule(
  id: string,
  patch: Partial<{
    calc_method: Enums<"fee_calc_method">;
    rate: number;
    min_amount: number | null;
    max_amount: number | null;
    currency: Enums<"wallet_currency">;
    tiers: unknown[];
    is_rebate: boolean;
    priority: number;
    active: boolean;
  }>,
): Promise<FeeActionResult> {
  const { user, error } = await requireAdmin();
  if (!user) return { ok: false, error };

  const supabase = getSupabaseServer();
  const { error: updErr } = await supabase
    .from("fee_rules")
    .update({
      ...(patch.calc_method !== undefined ? { calc_method: patch.calc_method } : {}),
      ...(patch.rate !== undefined ? { rate: patch.rate } : {}),
      ...(patch.min_amount !== undefined ? { min_amount: patch.min_amount } : {}),
      ...(patch.max_amount !== undefined ? { max_amount: patch.max_amount } : {}),
      ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
      ...(patch.tiers !== undefined ? { tiers: patch.tiers as Json } : {}),
      ...(patch.is_rebate !== undefined ? { is_rebate: patch.is_rebate } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    })
    .eq("id", id);
  if (updErr) return { ok: false, error: updErr.message };
  revalidateFees();
  return { ok: true, message: "Rule updated." };
}

export async function setFeeRuleActive(
  id: string,
  active: boolean,
): Promise<FeeActionResult> {
  return updateFeeRule(id, { active });
}

// ---------------------------------------------------------------------------
// LEDGER chart of accounts (admin)
// ---------------------------------------------------------------------------

export type CreateAccountInput = {
  code: string;
  name: string;
  type: Enums<"ledger_account_type">;
  currency?: Enums<"wallet_currency">;
  owner_id?: string | null;
};

export async function createLedgerAccount(
  input: CreateAccountInput,
): Promise<FeeActionResult<{ id: string }>> {
  const { user, error } = await requireAdmin();
  if (!user) return { ok: false, error };

  const code = input.code?.trim().toUpperCase();
  const name = input.name?.trim();
  if (!code) return { ok: false, error: "Account code is required." };
  if (!name) return { ok: false, error: "Account name is required." };

  const supabase = getSupabaseServer();
  const { data, error: insErr } = await supabase
    .from("ledger_accounts")
    .insert({
      code,
      name,
      type: input.type,
      currency: input.currency ?? "USD",
      owner_id: input.owner_id ?? null,
      is_system: false,
    })
    .select("id")
    .single();
  if (insErr || !data) {
    return { ok: false, error: insErr?.message ?? "Could not create account." };
  }
  revalidateFees();
  return { ok: true, data: { id: data.id }, message: "Ledger account created." };
}

export async function setLedgerAccountActive(
  id: string,
  active: boolean,
): Promise<FeeActionResult> {
  const { user, error } = await requireAdmin();
  if (!user) return { ok: false, error };
  const supabase = getSupabaseServer();
  const { error: updErr } = await supabase
    .from("ledger_accounts")
    .update({ active })
    .eq("id", id);
  if (updErr) return { ok: false, error: updErr.message };
  revalidateFees();
  return { ok: true, message: active ? "Account activated." : "Account deactivated." };
}

// ---------------------------------------------------------------------------
// SIMULATE — pure resolver, no writes (compute_fee is authenticated-callable)
// ---------------------------------------------------------------------------

export type FeeQuote = {
  matched: boolean;
  schedule_id: string | null;
  rule_id: string | null;
  fee_type: Enums<"fee_type">;
  calc_method: Enums<"fee_calc_method"> | null;
  currency: Enums<"wallet_currency">;
  base_amount: number;
  lots: number;
  is_rebate: boolean;
  amount: number;
};

export async function simulateFee(input: {
  fee_type: Enums<"fee_type">;
  base_amount?: number;
  lots?: number;
  scope?: Record<string, unknown>;
}): Promise<FeeActionResult<FeeQuote>> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };

  const supabase = getSupabaseServer();
  const { data, error: rpcErr } = await supabase.rpc("compute_fee", {
    p_fee_type: input.fee_type,
    p_base_amount: input.base_amount ?? 0,
    p_lots: input.lots ?? 0,
    p_scope: (input.scope ?? {}) as Json,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  const q = data as unknown as FeeQuote;
  return { ok: true, data: q };
}

// ---------------------------------------------------------------------------
// CHARGE — applies a fee/rebate, posts the journal, optionally moves a wallet
// (staff_charge_fee RPC, staff-gated at the DB)
// ---------------------------------------------------------------------------

export async function chargeFeeManual(input: {
  fee_type: Enums<"fee_type">;
  user_id?: string | null;
  wallet_id?: string | null;
  trading_account_id?: string | null;
  base_amount?: number;
  lots?: number;
  scope?: Record<string, unknown>;
  override_amount?: number | null;
  move_wallet?: boolean;
  notes?: string;
}): Promise<FeeActionResult<{ id: string; amount: number; status: string }>> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };

  const supabase = getSupabaseServer();
  const { data, error: rpcErr } = await supabase.rpc("staff_charge_fee", {
    p_fee_type: input.fee_type,
    p_idempotency_key: newIdempotencyKey("fee"),
    p_user_id: input.user_id ?? undefined,
    p_wallet_id: input.wallet_id ?? undefined,
    p_trading_account_id: input.trading_account_id ?? undefined,
    p_base_amount: input.base_amount ?? 0,
    p_lots: input.lots ?? 0,
    p_scope: (input.scope ?? {}) as Json,
    p_override_amount: input.override_amount ?? undefined,
    p_move_wallet: input.move_wallet ?? true,
    p_notes: input.notes ?? undefined,
  });
  if (rpcErr || !data) {
    return { ok: false, error: rpcErr?.message ?? "Could not charge fee." };
  }
  const charge = data as Tables<"fee_charges">;
  revalidateFees();
  revalidatePath("/wallet");
  return {
    ok: true,
    data: { id: charge.id, amount: Number(charge.computed_amount), status: charge.status },
    message: charge.status === "waived" ? "No matching fee — recorded as waived." : "Fee charged.",
  };
}

// ---------------------------------------------------------------------------
// MANUAL JOURNAL — balanced double-entry posting (staff_post_journal_entry)
// ---------------------------------------------------------------------------

export type JournalLineInput = {
  account_code: string;
  direction: "debit" | "credit";
  amount: number;
  currency?: Enums<"wallet_currency">;
  memo?: string;
};

export async function postManualJournal(input: {
  description: string;
  reference?: string;
  lines: JournalLineInput[];
}): Promise<FeeActionResult<{ id: string }>> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };

  const lines = (input.lines ?? []).filter(
    (l) => l.account_code?.trim() && Number(l.amount) > 0,
  );
  if (lines.length < 2) {
    return { ok: false, error: "A journal needs at least two lines." };
  }

  // client-side balance pre-check per currency (DB re-validates authoritatively)
  const net = new Map<string, number>();
  for (const l of lines) {
    const ccy = l.currency ?? "USD";
    const signed = l.direction === "debit" ? Number(l.amount) : -Number(l.amount);
    net.set(ccy, (net.get(ccy) ?? 0) + signed);
  }
  for (const [ccy, v] of net) {
    if (Math.round(v * 1e8) / 1e8 !== 0) {
      return { ok: false, error: `Unbalanced in ${ccy} (net ${v}). Debits must equal credits.` };
    }
  }

  const supabase = getSupabaseServer();
  const { data, error: rpcErr } = await supabase.rpc("staff_post_journal_entry", {
    p_idempotency_key: newIdempotencyKey("jrnl"),
    p_lines: lines.map((l) => ({
      account_code: l.account_code.trim().toUpperCase(),
      direction: l.direction,
      amount: Number(l.amount),
      currency: l.currency ?? "USD",
      memo: l.memo ?? null,
    })) as unknown as Json,
    p_description: input.description?.trim() || "",
    p_reference: input.reference?.trim() || undefined,
  });
  if (rpcErr || !data) {
    return { ok: false, error: rpcErr?.message ?? "Could not post journal." };
  }
  revalidateFees();
  return { ok: true, data: { id: data as string }, message: "Journal posted." };
}

// ---------------------------------------------------------------------------
// REBATE — run a per-lot rebate up the IB tree (staff_distribute_rebate)
// ---------------------------------------------------------------------------

export async function distributeRebateManual(input: {
  source_user_id: string;
  trading_account_id: string;
  lots: number;
}): Promise<FeeActionResult<{ payouts: number }>> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  if (!input.source_user_id || !input.trading_account_id) {
    return { ok: false, error: "Source client and trading account are required." };
  }
  if (!(input.lots > 0)) return { ok: false, error: "Lots must be greater than 0." };

  const supabase = getSupabaseServer();
  const { data, error: rpcErr } = await supabase.rpc("staff_distribute_rebate", {
    p_source_user_id: input.source_user_id,
    p_trading_account_id: input.trading_account_id,
    p_lots: input.lots,
    p_idempotency_prefix: newIdempotencyKey("reb"),
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };
  revalidateFees();
  return {
    ok: true,
    data: { payouts: Number(data ?? 0) },
    message: `Rebate distributed to ${Number(data ?? 0)} IB level(s).`,
  };
}
