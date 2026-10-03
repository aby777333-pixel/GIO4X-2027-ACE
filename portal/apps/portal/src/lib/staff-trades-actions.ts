"use server";

import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";

// ---------------------------------------------------------------------------
// Staff Trade Log — an immutable, MT5-style record of every trade placed by
// GIO4X traders. Read-only audit surface: ticket, trader, account/server,
// symbol, side, volume, open/close price, commission, swap, P&L, status and
// source — the evidence needed to settle an execution dispute.
//
// Reads through the trades_staff_all (is_staff()) RLS policy, so no service
// role is involved and existing per-user trade access is untouched.
// ---------------------------------------------------------------------------

export type StaffTrade = {
  id: string;
  ticket: string;
  trader: string;
  traderEmail: string | null;
  account: string;
  server: string | null;
  symbol: string;
  side: "BUY" | "SELL";
  lots: number;
  open: number | null;
  close: number | null;
  commission: number;
  swap: number;
  pnl: number;
  currency: string;
  status: "open" | "closed" | "cancelled";
  source: string;
  openedAt: string;
  closedAt: string | null;
};

// Precise UTC stamp (YYYY-MM-DD HH:MM:SS) — the resolution disputes need.
function fmt(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toISOString().slice(0, 19).replace("T", " ");
}

export async function loadStaffTrades(): Promise<StaffTrade[]> {
  const user = await getCurrentUser();
  const role = user?.profile?.role;
  if (role !== "staff" && role !== "admin") return [];

  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("trades")
    .select(
      "id, ticket, symbol, side, lots, open_price, close_price, commission, swap, pnl, currency, status, source, opened_at, closed_at, trader:profiles!trades_user_id_fkey(full_name, email), account:trading_accounts!trades_trading_account_id_fkey(account_number, server)",
    )
    .order("opened_at", { ascending: false })
    .limit(1000);

  return ((data ?? []) as unknown as Array<{
    id: string;
    ticket: number | null;
    symbol: string;
    side: "buy" | "sell";
    lots: number;
    open_price: number | null;
    close_price: number | null;
    commission: number;
    swap: number;
    pnl: number;
    currency: string;
    status: "open" | "closed" | "cancelled";
    source: string;
    opened_at: string;
    closed_at: string | null;
    trader: { full_name: string | null; email: string | null } | null;
    account: { account_number: string | null; server: string | null } | null;
  }>).map((t) => ({
    id: t.id,
    ticket: t.ticket ? String(t.ticket) : t.id.slice(0, 8),
    trader: t.trader?.full_name ?? t.trader?.email ?? "—",
    traderEmail: t.trader?.email ?? null,
    account: t.account?.account_number ?? "—",
    server: t.account?.server ?? null,
    symbol: t.symbol,
    side: t.side === "sell" ? "SELL" : "BUY",
    lots: Number(t.lots),
    open: t.open_price !== null ? Number(t.open_price) : null,
    close: t.close_price !== null ? Number(t.close_price) : null,
    commission: Number(t.commission ?? 0),
    swap: Number(t.swap ?? 0),
    pnl: Number(t.pnl ?? 0),
    currency: t.currency,
    status: t.status,
    source: t.source,
    openedAt: fmt(t.opened_at),
    closedAt: t.closed_at ? fmt(t.closed_at) : null,
  }));
}
