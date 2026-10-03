"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";
import { runDispatch } from "./events-actions";
import type { Enums } from "@gio4x/supabase";

// ---------------------------------------------------------------------------
// Copy-trading actions (Module 4).
//   • loadProviders()        → public leaderboard of active signal providers.
//   • loadMySubscriptions()  → strategies the signed-in user follows.
//   • loadMyProvider()       → the signed-in user's own provider profile (if any).
//   • loadMyTradingAccounts()→ accounts the user can publish as a master.
//   • subscribe()            → follow a provider with an allocation + ratio.
//   • setSubscriptionStatus()→ pause / resume / stop a subscription.
//   • becomeProvider()       → apply (or update) a signal-provider profile.
//   • loadPendingProviders() → staff approval queue.
//   • setProviderStatus()    → staff approve / pause / close a provider.
// Mirror fan-out, performance fees + provider commission accrual all happen in
// the tg_mirror_provider_trade() trigger; these actions only gate + translate.
// ---------------------------------------------------------------------------

export type CopyActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: "Not signed in." as const };
  const role = user.profile?.role;
  if (role !== "staff" && role !== "admin") return { user: null, error: "Staff access only." as const };
  return { user, error: null };
}

export type ProviderCard = {
  provider_id: string;
  user_id: string;
  display_name: string;
  headline: string | null;
  risk: Enums<"copy_risk">;
  performance_fee_bps: number;
  min_allocation: number;
  currency: Enums<"wallet_currency">;
  followers: number;
  aum: number;
  trades_count: number;
  win_rate: number;
  total_pnl: number;
};

// Public leaderboard of active providers, ranked by realised P&L + followers.
export async function loadProviders(): Promise<ProviderCard[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase.rpc("copy_list_providers");
  return (data ?? []).map((r) => ({
    provider_id: r.provider_id,
    user_id: r.user_id,
    display_name: r.display_name,
    headline: r.headline,
    risk: r.risk,
    performance_fee_bps: Number(r.performance_fee_bps ?? 0),
    min_allocation: Number(r.min_allocation ?? 0),
    currency: r.currency,
    followers: Number(r.followers ?? 0),
    aum: Number(r.aum ?? 0),
    trades_count: Number(r.trades_count ?? 0),
    win_rate: Number(r.win_rate ?? 0),
    total_pnl: Number(r.total_pnl ?? 0),
  }));
}

export type MySubscription = {
  subscription_id: string;
  provider_id: string;
  provider_name: string;
  allocation: number;
  copy_ratio: number;
  realized_pnl: number;
  fees_paid: number;
  status: Enums<"copy_subscription_status">;
  currency: Enums<"wallet_currency">;
  started_at: string;
};

export async function loadMySubscriptions(): Promise<MySubscription[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase.rpc("copy_my_subscriptions");
  return (data ?? []).map((r) => ({
    subscription_id: r.subscription_id,
    provider_id: r.provider_id,
    provider_name: r.provider_name,
    allocation: Number(r.allocation ?? 0),
    copy_ratio: Number(r.copy_ratio ?? 1),
    realized_pnl: Number(r.realized_pnl ?? 0),
    fees_paid: Number(r.fees_paid ?? 0),
    status: r.status,
    currency: r.currency,
    started_at: r.started_at,
  }));
}

export type MyProvider = {
  id: string;
  display_name: string;
  headline: string | null;
  risk: Enums<"copy_risk">;
  performance_fee_bps: number;
  min_allocation: number;
  trading_account_id: string | null;
  status: Enums<"copy_provider_status">;
};

export async function loadMyProvider(): Promise<MyProvider | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("signal_providers")
    .select("id, display_name, headline, risk, performance_fee_bps, min_allocation, trading_account_id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    display_name: data.display_name,
    headline: data.headline,
    risk: data.risk,
    performance_fee_bps: Number(data.performance_fee_bps ?? 0),
    min_allocation: Number(data.min_allocation ?? 0),
    trading_account_id: data.trading_account_id,
    status: data.status,
  };
}

export type TradingAccountOption = {
  id: string;
  label: string;
};

export async function loadMyTradingAccounts(): Promise<TradingAccountOption[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("trading_accounts")
    .select("id, account_number, account_kind, base_currency")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((a) => ({
    id: a.id,
    label: `${a.account_number} · ${a.account_kind} · ${a.base_currency}`,
  }));
}

export async function subscribe(
  providerId: string,
  allocation: number,
  copyRatio: number,
): Promise<CopyActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to copy a strategy." };
  if (!providerId) return { ok: false, error: "Provider is required." };
  if (!Number.isFinite(allocation) || allocation <= 0)
    return { ok: false, error: "Enter a positive allocation." };
  if (!Number.isFinite(copyRatio) || copyRatio <= 0)
    return { ok: false, error: "Copy ratio must be positive." };

  const supabase = getSupabaseServer();
  const { error } = await supabase.rpc("copy_subscribe", {
    p_provider_id: providerId,
    p_allocation: allocation,
    p_copy_ratio: copyRatio,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/copy/copier");
  revalidatePath("/copy/discover");
  return { ok: true, message: "You're now copying this strategy." };
}

export async function setSubscriptionStatus(
  subscriptionId: string,
  status: Enums<"copy_subscription_status">,
): Promise<CopyActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!subscriptionId) return { ok: false, error: "Subscription is required." };

  const supabase = getSupabaseServer();
  const { error } = await supabase.rpc("copy_set_subscription_status", {
    p_subscription_id: subscriptionId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/copy/copier");
  const verb = status === "active" ? "resumed" : status === "paused" ? "paused" : "stopped";
  return { ok: true, message: `Copying ${verb}.` };
}

export async function becomeProvider(input: {
  displayName: string;
  headline?: string;
  tradingAccountId?: string | null;
  risk: Enums<"copy_risk">;
  performanceFeeBps: number;
  minAllocation: number;
}): Promise<CopyActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to apply." };
  if (!input.displayName.trim()) return { ok: false, error: "A display name is required." };

  const supabase = getSupabaseServer();
  const { error } = await supabase.rpc("become_signal_provider", {
    p_display_name: input.displayName.trim(),
    p_headline: input.headline?.trim() || undefined,
    p_trading_account_id: input.tradingAccountId || undefined,
    p_risk: input.risk,
    p_performance_fee_bps: input.performanceFeeBps,
    p_min_allocation: input.minAllocation,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/copy/signal-provider");
  revalidatePath("/staff/copy");
  return {
    ok: true,
    message: "Application submitted — our team will review and activate your strategy.",
  };
}

export type PendingProvider = {
  id: string;
  user_id: string;
  display_name: string;
  headline: string | null;
  risk: Enums<"copy_risk">;
  performance_fee_bps: number;
  min_allocation: number;
  currency: Enums<"wallet_currency">;
  status: Enums<"copy_provider_status">;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

// Staff: every provider profile (any status) with the applicant's identity.
export async function loadAllProviders(): Promise<PendingProvider[]> {
  const { user } = await requireStaff();
  if (!user) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("signal_providers")
    .select(
      "id, user_id, display_name, headline, risk, performance_fee_bps, min_allocation, currency, status, created_at, owner:profiles!signal_providers_user_id_fkey(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as Array<{
    id: string;
    user_id: string;
    display_name: string;
    headline: string | null;
    risk: Enums<"copy_risk">;
    performance_fee_bps: number;
    min_allocation: number;
    currency: Enums<"wallet_currency">;
    status: Enums<"copy_provider_status">;
    created_at: string;
    owner: { full_name: string | null; email: string | null } | null;
  }>).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    display_name: r.display_name,
    headline: r.headline,
    risk: r.risk,
    performance_fee_bps: Number(r.performance_fee_bps ?? 0),
    min_allocation: Number(r.min_allocation ?? 0),
    currency: r.currency,
    status: r.status,
    full_name: r.owner?.full_name ?? null,
    email: r.owner?.email ?? null,
    created_at: r.created_at,
  }));
}

export async function setProviderStatus(
  providerId: string,
  status: Enums<"copy_provider_status">,
): Promise<CopyActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  if (!providerId) return { ok: false, error: "Provider is required." };

  const supabase = getSupabaseServer();
  const { error: rpcErr } = await supabase.rpc("staff_set_provider_status", {
    p_provider_id: providerId,
    p_status: status,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  await runDispatch();
  revalidatePath("/staff/copy");
  revalidatePath("/copy/discover");
  return { ok: true, message: `Provider ${status}.` };
}
