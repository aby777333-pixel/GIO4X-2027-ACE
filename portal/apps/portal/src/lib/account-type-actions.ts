"use server";

// §24 Account types (plans) — admin CRUD over the account_types table (RLS:
// public read, admin write). Consumers read the active list and fall back to
// the hardcoded constant if the table is unavailable, so behaviour never breaks.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";

export type AccountTypeRow = {
  id: string;
  name: string;
  leverage: number;
  min_deposit: number;
  base_currency: string;
  spread_from: string | null;
  commission: string | null;
  sort: number;
  active: boolean;
};

type Result = { ok: boolean; error?: string };

async function requireAdmin(): Promise<Result> {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") return { ok: false, error: "Admin access only." };
  return { ok: true };
}

export async function loadAccountTypes(): Promise<AccountTypeRow[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("account_types")
    .select("id, name, leverage, min_deposit, base_currency, spread_from, commission, sort, active")
    .order("sort", { ascending: true });
  return (data ?? []) as AccountTypeRow[];
}

export type AccountTypeOption = { name: string; leverage: number };

/** Active plans (name + default leverage) for the account-open form. Caller
 *  falls back to the built-in list if this is empty. */
export async function loadActiveAccountTypes(): Promise<AccountTypeOption[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("account_types")
    .select("name, leverage")
    .eq("active", true)
    .order("sort", { ascending: true });
  return (data ?? []).map((r) => ({ name: r.name, leverage: Number(r.leverage) }));
}

function validate(input: { name: string; leverage: number; minDeposit: number }): Result {
  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  if (!Number.isFinite(input.leverage) || input.leverage < 1 || input.leverage > 5000) return { ok: false, error: "Leverage must be 1–5000." };
  if (!Number.isFinite(input.minDeposit) || input.minDeposit < 0) return { ok: false, error: "Minimum deposit must be ≥ 0." };
  return { ok: true };
}

export async function upsertAccountType(input: {
  id?: string; name: string; leverage: number; minDeposit: number;
  baseCurrency?: string; spreadFrom?: string; commission?: string; sort?: number;
}): Promise<Result> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const v = validate(input);
  if (!v.ok) return v;

  const supabase = getSupabaseServer();
  const row = {
    name: input.name.trim(),
    leverage: Math.round(input.leverage),
    min_deposit: input.minDeposit,
    base_currency: (input.baseCurrency || "USD").trim(),
    spread_from: input.spreadFrom?.trim() || null,
    commission: input.commission?.trim() || null,
    sort: input.sort ?? 0,
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await supabase.from("account_types").update(row).eq("id", input.id)
    : await supabase.from("account_types").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/config");
  return { ok: true };
}

export async function setAccountTypeActive(id: string, active: boolean): Promise<Result> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = getSupabaseServer();
  const { error } = await supabase.from("account_types").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/config");
  return { ok: true };
}
