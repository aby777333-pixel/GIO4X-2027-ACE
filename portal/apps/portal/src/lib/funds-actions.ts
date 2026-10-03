"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";
import { runDispatch } from "./events-actions";
import type { Enums, Tables } from "@gio4x/supabase";

// ---------------------------------------------------------------------------
// Staff money-flow actions: settle pending deposits/withdrawals (which fires the
// Fee Engine auto-charge trigger) and book trades (which fires commission +
// IB rebate distribution). All gated on staff role; the heavy lifting + money
// movement happens inside SECURITY DEFINER RPCs.
// ---------------------------------------------------------------------------

export type FundsActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: "Not signed in." as const };
  const isStaff = user.profile?.role === "staff" || user.profile?.role === "admin";
  if (!isStaff) return { user: null, error: "Staff access only." as const };
  return { user, error: null };
}

export type PendingTx = {
  id: string;
  type: Enums<"transaction_type">;
  amount: number;
  currency: Enums<"wallet_currency">;
  status: Enums<"transaction_status">;
  gateway: string | null;
  gateway_ref: string | null;
  created_at: string;
  wallet_id: string;
  user: { id: string; full_name: string; email: string | null } | null;
};

// Pending deposits + withdrawals awaiting staff settlement.
export async function loadPendingSettlements(limit = 60): Promise<PendingTx[]> {
  const { user } = await requireStaff();
  if (!user) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("wallet_transactions")
    .select(
      "id, type, amount, currency, status, gateway, gateway_ref, created_at, wallet_id, wallets!inner(user_id, profiles:user_id(id, full_name, email))",
    )
    .in("type", ["deposit", "withdraw"])
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data ?? []).map((r) => {
    const w = r.wallets as unknown as {
      user_id: string;
      profiles: { id: string; full_name: string; email: string | null } | null;
    };
    return {
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      gateway: r.gateway,
      gateway_ref: r.gateway_ref,
      created_at: r.created_at,
      wallet_id: r.wallet_id,
      user: w?.profiles ?? null,
    };
  });
}

export async function settleTransaction(
  txId: string,
  action: "approve" | "reject",
  gatewayRef?: string,
): Promise<FundsActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  if (!txId) return { ok: false, error: "Transaction id required." };

  const supabase = getSupabaseServer();
  const { error: rpcErr } = await supabase.rpc("staff_settle_wallet_transaction", {
    p_tx_id: txId,
    p_action: action,
    p_gateway_ref: gatewayRef && gatewayRef.trim() ? gatewayRef.trim() : undefined,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  // Fan out the fee.charged / *.failed events this settlement just emitted.
  await runDispatch();

  revalidatePath("/staff/funds");
  revalidatePath("/staff/ledger");
  revalidatePath("/staff/fees");
  return {
    ok: true,
    message: action === "approve" ? "Settled — fee auto-charged." : "Request rejected.",
  };
}

// ---------------------------------------------------------------------------
// Trade booking — the portal integration point for the trading platform.
// Booking a closed trade fires per-lot commission + IB rebate distribution.
// ---------------------------------------------------------------------------
export type TradingAccountOption = {
  id: string;
  label: string;
};

export async function loadTradingAccountOptions(): Promise<TradingAccountOption[]> {
  const { user } = await requireStaff();
  if (!user) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("trading_accounts")
    .select("id, account_number, plan_name, base_currency, profiles:user_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((a) => {
    const p = a.profiles as unknown as { full_name: string } | null;
    return {
      id: a.id,
      label: `#${a.account_number} · ${a.plan_name} · ${p?.full_name ?? "—"} (${a.base_currency})`,
    };
  });
}

export type RecordTradeInput = {
  tradingAccountId: string;
  symbol: string;
  side: Enums<"trade_side">;
  lots: number;
  openPrice?: number | null;
  closePrice?: number | null;
  pnl?: number;
};

export async function recordTrade(input: RecordTradeInput): Promise<FundsActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  if (!input.tradingAccountId) return { ok: false, error: "Trading account required." };
  if (!Number.isFinite(input.lots) || input.lots <= 0)
    return { ok: false, error: "Lots must be greater than 0." };

  const supabase = getSupabaseServer();
  const { error: rpcErr } = await supabase.rpc("staff_record_trade", {
    p_trading_account_id: input.tradingAccountId,
    p_symbol: input.symbol || "XAUUSD",
    p_side: input.side,
    p_lots: input.lots,
    p_open_price: input.openPrice ?? undefined,
    p_close_price: input.closePrice ?? undefined,
    p_pnl: input.pnl ?? 0,
    p_status: "closed",
    p_source: "manual",
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  // Fan out the trade.closed / rebate.distributed events this booking emitted.
  await runDispatch();

  revalidatePath("/staff/funds");
  revalidatePath("/staff/ledger");
  revalidatePath("/staff/fees");
  return { ok: true, message: "Trade booked — commission + rebate applied." };
}

export type RecentTrade = Pick<
  Tables<"trades">,
  "id" | "symbol" | "side" | "lots" | "pnl" | "currency" | "status" | "created_at"
> & { account_number: string | null; full_name: string | null };

export async function loadRecentTrades(limit = 30): Promise<RecentTrade[]> {
  const { user } = await requireStaff();
  if (!user) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("trades")
    .select(
      "id, symbol, side, lots, pnl, currency, status, created_at, trading_accounts:trading_account_id(account_number), profiles:user_id(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((t) => {
    const acc = t.trading_accounts as unknown as { account_number: string } | null;
    const p = t.profiles as unknown as { full_name: string } | null;
    return {
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      lots: t.lots,
      pnl: t.pnl,
      currency: t.currency,
      status: t.status,
      created_at: t.created_at,
      account_number: acc?.account_number ?? null,
      full_name: p?.full_name ?? null,
    };
  });
}
