"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";
import { runDispatch } from "./events-actions";
import type { Enums } from "@gio4x/supabase";

// ---------------------------------------------------------------------------
// IB multi-tier tree actions.
//   • loadDownline()      → rolled-up downline for the signed-in IB (own tree).
//   • loadUnsettledIbs()  → staff view of IBs with accrued commission to pay.
//   • settleCommissions() → staff pays an IB's accrued commission into wallet.
//   • linkIb()            → staff manually enrols a child under a parent IB.
//   • searchProfiles()    → typeahead helper for the manual-link tool.
// Tree maintenance + money movement live in SECURITY DEFINER RPCs; these
// actions only gate on role and translate results for the UI.
// ---------------------------------------------------------------------------

export type IbActionResult =
  | { ok: true; message?: string; amount?: number }
  | { ok: false; error: string };

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: "Not signed in." as const };
  const role = user.profile?.role;
  if (role !== "staff" && role !== "admin") return { user: null, error: "Staff access only." as const };
  return { user, error: null };
}

export type DownlineMember = {
  member_id: string;
  level: number;
  full_name: string | null;
  member_status: string;
  lots: number;
  commission: number;
  last_activity: string | null;
};

// The signed-in IB's full rolled-up downline (all levels). Returns [] for guests.
export async function loadDownline(): Promise<DownlineMember[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase.rpc("ib_downline_summary", { p_ib_user_id: user.id });
  return (data ?? []).map((r) => ({
    member_id: r.member_id,
    level: r.level,
    full_name: r.full_name,
    member_status: r.member_status,
    lots: Number(r.lots ?? 0),
    commission: Number(r.commission ?? 0),
    last_activity: r.last_activity,
  }));
}

export type UnsettledIb = {
  ib_user_id: string;
  full_name: string | null;
  email: string | null;
  currency: Enums<"wallet_currency">;
  pending: number;
  rows: number;
};

// Staff: IBs that have accrued (unsettled) commission, grouped by IB + currency.
export async function loadUnsettledIbs(): Promise<UnsettledIb[]> {
  const { user } = await requireStaff();
  if (!user) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("commission_ledger")
    .select("ib_user_id, currency, amount, ib:profiles!commission_ledger_ib_user_id_fkey(full_name, email)")
    .eq("settled", false)
    .limit(5000);

  const map = new Map<string, UnsettledIb>();
  for (const r of (data ?? []) as Array<{
    ib_user_id: string;
    currency: Enums<"wallet_currency">;
    amount: number;
    ib: { full_name: string | null; email: string | null } | null;
  }>) {
    const key = `${r.ib_user_id}:${r.currency}`;
    const cur = map.get(key) ?? {
      ib_user_id: r.ib_user_id,
      full_name: r.ib?.full_name ?? null,
      email: r.ib?.email ?? null,
      currency: r.currency,
      pending: 0,
      rows: 0,
    };
    cur.pending += Number(r.amount ?? 0);
    cur.rows += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .filter((x) => x.pending > 0)
    .sort((a, b) => b.pending - a.pending);
}

export async function settleCommissions(
  ibUserId: string,
  currency: Enums<"wallet_currency">,
): Promise<IbActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  if (!ibUserId) return { ok: false, error: "IB is required." };

  const supabase = getSupabaseServer();
  const { data, error: rpcErr } = await supabase.rpc("settle_ib_commissions", {
    p_ib_user_id: ibUserId,
    p_currency: currency,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  const amount = Number(data ?? 0);
  await runDispatch();
  revalidatePath("/staff/ib");
  revalidatePath("/staff/ledger");
  return amount > 0
    ? { ok: true, amount, message: `Settled ${amount.toFixed(2)} ${currency} into the IB wallet.` }
    : { ok: true, amount: 0, message: "Nothing pending to settle." };
}

export async function linkIb(
  parentId: string,
  childId: string,
): Promise<IbActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  if (!parentId || !childId) return { ok: false, error: "Both parent and child are required." };
  if (parentId === childId) return { ok: false, error: "An IB cannot refer themselves." };

  const supabase = getSupabaseServer();
  const { error: rpcErr } = await supabase.rpc("staff_link_ib", {
    p_parent_id: parentId,
    p_child_id: childId,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  revalidatePath("/staff/ib");
  return { ok: true, message: "IB relationship linked — downline rebuilt." };
}

export type ProfileOption = {
  id: string;
  label: string;
};

// Typeahead source for the manual-link tool. Staff-only.
export async function searchProfiles(query: string): Promise<ProfileOption[]> {
  const { user } = await requireStaff();
  if (!user) return [];
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, referral_code")
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,referral_code.ilike.%${q}%`)
    .limit(20);
  return (data ?? []).map((p) => ({
    id: p.id,
    label: `${p.full_name ?? "—"} · ${p.email ?? p.referral_code ?? p.id.slice(0, 8)}`,
  }));
}

// ---------------------------------------------------------------------------
// IB tree management: promote/demote IB role, re-parent, detach, and fetch the
// whole network. These RPCs aren't in the generated Database types yet, so we
// call them through a client cast — keeping it a METHOD call so the SDK's
// `this` binding survives (extracting .rpc into a var throws "reading 'rest'").
// ---------------------------------------------------------------------------

type RpcResult = { data: unknown; error: { message: string } | null };

async function callRpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const supabase = getSupabaseServer();
  const sb = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
  };
  return sb.rpc(fn, args);
}

export type IbNode = {
  id: string;
  parent_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string;
  referral_code: string | null;
  accrued: number;
};

// Whole IB network (flat); the UI nests it by parent_id. Staff-only.
export async function loadIbTree(): Promise<IbNode[]> {
  const { user } = await requireStaff();
  if (!user) return [];
  const { data, error } = await callRpc("ib_network_nodes", {});
  if (error) return [];
  return ((data ?? []) as IbNode[]).map((n) => ({ ...n, accrued: Number(n.accrued ?? 0) }));
}

export async function setIbRole(userId: string, isIb: boolean): Promise<IbActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  if (!userId) return { ok: false, error: "User is required." };
  const { error: e } = await callRpc("staff_set_ib_role", { p_user_id: userId, p_is_ib: isIb });
  if (e) return { ok: false, error: e.message };
  revalidatePath("/staff/ib");
  return { ok: true, message: isIb ? "Promoted to IB." : "Demoted to client." };
}

export async function unlinkIb(childId: string): Promise<IbActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  if (!childId) return { ok: false, error: "Node is required." };
  const { error: e } = await callRpc("staff_unlink_ib", { p_child_id: childId });
  if (e) return { ok: false, error: e.message };
  revalidatePath("/staff/ib");
  return { ok: true, message: "Detached from parent." };
}

export async function reparentIb(childId: string, newParentId: string): Promise<IbActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  if (!childId || !newParentId) return { ok: false, error: "Pick a node and a new parent." };
  if (childId === newParentId) return { ok: false, error: "A node cannot be its own parent." };
  const { error: e } = await callRpc("staff_reparent_ib", { p_child_id: childId, p_new_parent_id: newParentId });
  if (e) return { ok: false, error: e.message };
  revalidatePath("/staff/ib");
  return { ok: true, message: "Moved under the new parent." };
}
