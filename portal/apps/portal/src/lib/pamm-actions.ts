"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";
import { runDispatch } from "./events-actions";
import type { Enums } from "@gio4x/supabase";

// ---------------------------------------------------------------------------
// PAMM / MAM actions (Module 5).
//   • loadFunds()           → public list of active managed pools (NAV stats).
//   • loadMyInvestments()   → the signed-in user's positions across pools.
//   • loadMyFund()          → the signed-in user's own fund profile (if any).
//   • loadMyTradingAccounts() → accounts a manager can attach as the master.
//   • invest()              → buy NAV units in a fund from the main wallet.
//   • redeem()              → redeem units back to the main wallet (net of fees).
//   • createFund()          → apply for / update a money-manager fund profile.
//   • loadAllFunds()        → staff roster of every fund (any status).
//   • setFundStatus()       → staff approve / pause / close a fund.
// NAV repricing, management + performance fees and manager-share accrual all
// happen in tg_pamm_apply_trade() / pamm_redeem(); these actions only gate +
// translate to the RPC layer.
// ---------------------------------------------------------------------------

export type PammActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: "Not signed in." as const };
  const role = user.profile?.role;
  if (role !== "staff" && role !== "admin") return { user: null, error: "Staff access only." as const };
  return { user, error: null };
}

export type FundCard = {
  fund_id: string;
  manager_id: string;
  manager_name: string | null;
  name: string;
  headline: string | null;
  currency: Enums<"wallet_currency">;
  management_fee_bps: number;
  performance_fee_bps: number;
  min_investment: number;
  lockup_days: number;
  nav_per_unit: number;
  aum: number;
  investors: number;
  return_pct: number;
  trades_count: number;
  win_rate: number;
};

// Public leaderboard of active pools, ranked by AUM then NAV.
export async function loadFunds(): Promise<FundCard[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase.rpc("pamm_list_funds");
  return (data ?? []).map((r) => ({
    fund_id: r.fund_id,
    manager_id: r.manager_id,
    manager_name: r.manager_name,
    name: r.name,
    headline: r.headline,
    currency: r.currency,
    management_fee_bps: Number(r.management_fee_bps ?? 0),
    performance_fee_bps: Number(r.performance_fee_bps ?? 0),
    min_investment: Number(r.min_investment ?? 0),
    lockup_days: Number(r.lockup_days ?? 0),
    nav_per_unit: Number(r.nav_per_unit ?? 1),
    aum: Number(r.aum ?? 0),
    investors: Number(r.investors ?? 0),
    return_pct: Number(r.return_pct ?? 0),
    trades_count: Number(r.trades_count ?? 0),
    win_rate: Number(r.win_rate ?? 0),
  }));
}

export type MyInvestment = {
  investment_id: string;
  fund_id: string;
  fund_name: string;
  units: number;
  invested_amount: number;
  nav_per_unit: number;
  current_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  fees_paid: number;
  status: Enums<"pamm_investment_status">;
  currency: Enums<"wallet_currency">;
  locked_until: string | null;
  created_at: string;
};

export async function loadMyInvestments(): Promise<MyInvestment[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase.rpc("pamm_my_investments");
  return (data ?? []).map((r) => ({
    investment_id: r.investment_id,
    fund_id: r.fund_id,
    fund_name: r.fund_name,
    units: Number(r.units ?? 0),
    invested_amount: Number(r.invested_amount ?? 0),
    nav_per_unit: Number(r.nav_per_unit ?? 1),
    current_value: Number(r.current_value ?? 0),
    unrealized_pnl: Number(r.unrealized_pnl ?? 0),
    realized_pnl: Number(r.realized_pnl ?? 0),
    fees_paid: Number(r.fees_paid ?? 0),
    status: r.status,
    currency: r.currency,
    locked_until: r.locked_until,
    created_at: r.created_at,
  }));
}

export type MyFund = {
  id: string;
  name: string;
  headline: string | null;
  currency: Enums<"wallet_currency">;
  management_fee_bps: number;
  performance_fee_bps: number;
  min_investment: number;
  lockup_days: number;
  nav_per_unit: number;
  aum: number;
  units_outstanding: number;
  trading_account_id: string | null;
  status: Enums<"pamm_fund_status">;
};

export async function loadMyFund(): Promise<MyFund | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("pamm_funds")
    .select(
      "id, name, headline, currency, management_fee_bps, performance_fee_bps, min_investment, lockup_days, nav_per_unit, aum, units_outstanding, trading_account_id, status",
    )
    .eq("manager_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    headline: data.headline,
    currency: data.currency,
    management_fee_bps: Number(data.management_fee_bps ?? 0),
    performance_fee_bps: Number(data.performance_fee_bps ?? 0),
    min_investment: Number(data.min_investment ?? 0),
    lockup_days: Number(data.lockup_days ?? 0),
    nav_per_unit: Number(data.nav_per_unit ?? 1),
    aum: Number(data.aum ?? 0),
    units_outstanding: Number(data.units_outstanding ?? 0),
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

export async function invest(fundId: string, amount: number): Promise<PammActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to invest." };
  if (!fundId) return { ok: false, error: "Fund is required." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "Enter a positive amount." };

  const supabase = getSupabaseServer();
  const { error } = await supabase.rpc("pamm_invest", {
    p_fund_id: fundId,
    p_amount: amount,
  });
  if (error) return { ok: false, error: error.message };

  await runDispatch();
  revalidatePath("/pamm");
  return { ok: true, message: "Investment confirmed — your units are now live." };
}

export async function redeem(
  investmentId: string,
  units?: number | null,
): Promise<PammActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!investmentId) return { ok: false, error: "Investment is required." };
  if (units != null && (!Number.isFinite(units) || units <= 0))
    return { ok: false, error: "Enter a positive number of units." };

  const supabase = getSupabaseServer();
  const { error } = await supabase.rpc("pamm_redeem", {
    p_investment_id: investmentId,
    p_units: units ?? undefined,
  });
  if (error) return { ok: false, error: error.message };

  await runDispatch();
  revalidatePath("/pamm");
  return { ok: true, message: "Redemption processed — funds credited to your wallet." };
}

export async function createFund(input: {
  name: string;
  headline?: string;
  tradingAccountId?: string | null;
  managementFeeBps: number;
  performanceFeeBps: number;
  minInvestment: number;
  lockupDays: number;
}): Promise<PammActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to apply." };
  if (!input.name.trim()) return { ok: false, error: "A fund name is required." };

  const supabase = getSupabaseServer();
  const { error } = await supabase.rpc("pamm_create_fund", {
    p_name: input.name.trim(),
    p_headline: input.headline?.trim() || undefined,
    p_trading_account_id: input.tradingAccountId || undefined,
    p_management_fee_bps: input.managementFeeBps,
    p_performance_fee_bps: input.performanceFeeBps,
    p_min_investment: input.minInvestment,
    p_lockup_days: input.lockupDays,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/pamm");
  revalidatePath("/staff/pamm");
  return {
    ok: true,
    message: "Fund submitted — our team will review and activate your pool.",
  };
}

export type StaffFund = {
  id: string;
  manager_id: string;
  name: string;
  headline: string | null;
  currency: Enums<"wallet_currency">;
  management_fee_bps: number;
  performance_fee_bps: number;
  min_investment: number;
  lockup_days: number;
  nav_per_unit: number;
  aum: number;
  units_outstanding: number;
  status: Enums<"pamm_fund_status">;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

// Staff: every fund (any status) with the manager's identity.
export async function loadAllFunds(): Promise<StaffFund[]> {
  const { user } = await requireStaff();
  if (!user) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("pamm_funds")
    .select(
      "id, manager_id, name, headline, currency, management_fee_bps, performance_fee_bps, min_investment, lockup_days, nav_per_unit, aum, units_outstanding, status, created_at, manager:profiles!pamm_funds_manager_id_fkey(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as Array<{
    id: string;
    manager_id: string;
    name: string;
    headline: string | null;
    currency: Enums<"wallet_currency">;
    management_fee_bps: number;
    performance_fee_bps: number;
    min_investment: number;
    lockup_days: number;
    nav_per_unit: number;
    aum: number;
    units_outstanding: number;
    status: Enums<"pamm_fund_status">;
    created_at: string;
    manager: { full_name: string | null; email: string | null } | null;
  }>).map((r) => ({
    id: r.id,
    manager_id: r.manager_id,
    name: r.name,
    headline: r.headline,
    currency: r.currency,
    management_fee_bps: Number(r.management_fee_bps ?? 0),
    performance_fee_bps: Number(r.performance_fee_bps ?? 0),
    min_investment: Number(r.min_investment ?? 0),
    lockup_days: Number(r.lockup_days ?? 0),
    nav_per_unit: Number(r.nav_per_unit ?? 1),
    aum: Number(r.aum ?? 0),
    units_outstanding: Number(r.units_outstanding ?? 0),
    status: r.status,
    full_name: r.manager?.full_name ?? null,
    email: r.manager?.email ?? null,
    created_at: r.created_at,
  }));
}

export async function setFundStatus(
  fundId: string,
  status: Enums<"pamm_fund_status">,
): Promise<PammActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  if (!fundId) return { ok: false, error: "Fund is required." };

  const supabase = getSupabaseServer();
  const { error: rpcErr } = await supabase.rpc("staff_set_fund_status", {
    p_fund_id: fundId,
    p_status: status,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  await runDispatch();
  revalidatePath("/staff/pamm");
  revalidatePath("/pamm");
  return { ok: true, message: `Fund ${status}.` };
}
