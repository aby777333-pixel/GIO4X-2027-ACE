"use server";

// IB commission plans (§16) — admin CRUD for the tiered rebate plans the
// engine reads: a per-lot rate plus the share each sub-IB level keeps. Writes
// go through the session client and are gated by the commission_plans RLS
// (admin-only ALL) + an explicit admin check here. Shares are stored as
// fractions (0.15 = 15%); the UI works in percent and converts.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";

export type CommissionPlan = {
  id: string;
  name: string;
  rate_per_lot: number;
  sub_ib_share_l1: number;
  sub_ib_share_l2: number;
  is_default: boolean;
  active: boolean;
  description: string | null;
  created_at: string;
};

type Result = { ok: boolean; error?: string };

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const role = user?.profile?.role;
  if (!user || (role !== "admin")) return { ok: false, error: "Admin access only." };
  return { ok: true };
}

function pct(n: unknown): number | null {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0 || v > 100) return null;
  return v / 100;
}

export async function loadCommissionPlans(): Promise<CommissionPlan[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("commission_plans")
    .select("id, name, rate_per_lot, sub_ib_share_l1, sub_ib_share_l2, is_default, active, description, created_at")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return (data ?? []) as CommissionPlan[];
}

export async function createCommissionPlan(input: {
  name: string; ratePerLot: number; l1Pct: number; l2Pct: number; description?: string; makeDefault?: boolean;
}): Promise<Result> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Plan name is required." };
  const rate = Number(input.ratePerLot);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1000) return { ok: false, error: "Rate per lot must be between 0 and 1000." };
  const l1 = pct(input.l1Pct); const l2 = pct(input.l2Pct);
  if (l1 == null) return { ok: false, error: "L1 sub-IB share must be 0–100%." };
  if (l2 == null) return { ok: false, error: "L2 sub-IB share must be 0–100%." };

  const supabase = getSupabaseServer();
  if (input.makeDefault) {
    const r = await supabase.from("commission_plans").update({ is_default: false }).eq("is_default", true);
    if (r.error) return { ok: false, error: r.error.message };
  }
  const { error } = await supabase.from("commission_plans").insert({
    name, rate_per_lot: rate, sub_ib_share_l1: l1, sub_ib_share_l2: l2,
    description: input.description?.trim() || null, is_default: !!input.makeDefault, active: true,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/ib");
  return { ok: true };
}

export async function updateCommissionPlan(id: string, input: {
  name: string; ratePerLot: number; l1Pct: number; l2Pct: number; description?: string;
}): Promise<Result> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Plan name is required." };
  const rate = Number(input.ratePerLot);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1000) return { ok: false, error: "Rate per lot must be between 0 and 1000." };
  const l1 = pct(input.l1Pct); const l2 = pct(input.l2Pct);
  if (l1 == null || l2 == null) return { ok: false, error: "Sub-IB shares must be 0–100%." };

  const supabase = getSupabaseServer();
  const { error } = await supabase.from("commission_plans")
    .update({ name, rate_per_lot: rate, sub_ib_share_l1: l1, sub_ib_share_l2: l2, description: input.description?.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/ib");
  return { ok: true };
}

export async function setPlanActive(id: string, active: boolean): Promise<Result> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = getSupabaseServer();
  const { error } = await supabase.from("commission_plans").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/ib");
  return { ok: true };
}

export async function makePlanDefault(id: string): Promise<Result> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = getSupabaseServer();
  const clear = await supabase.from("commission_plans").update({ is_default: false }).eq("is_default", true);
  if (clear.error) return { ok: false, error: clear.error.message };
  const { error } = await supabase.from("commission_plans").update({ is_default: true, active: true }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/ib");
  return { ok: true };
}
