import { getCurrentUser } from "./session";
import { terminalRpc } from "./tech-terminal";

// Tech Hub data loader (server-only, admin-gated). The LP framework lives in the
// terminal Supabase project; we reach it server-side over PostgREST/fetch (see
// tech-terminal) — no supabase-js client, so it's runtime-safe everywhere.

export type LpRow = {
  name: string; connector: string; status: string; markup_bps: string | null;
  tier: string | null; fill_rate: number | null; avg_latency_ms: number | null;
  uptime_pct: number | null; healthy: boolean; last_heartbeat: string | null;
};
export type BookRow = { symbol: string; bid: number; ask: number; spread: number; ts: string };
export type RouteRow = { symbol: string; volume: number; decision: string; a_book_pct: number; reason: string; decided_at: string };
export type BridgeRow = { name: string; schedule: string; active: boolean; last_run: string | null; last_status: string | null };
export type TechHub = {
  generated_at: string;
  lps: LpRow[]; book: BookRow[]; recent_routes: RouteRow[]; bridges: BridgeRow[];
  stats: { lp_total: number; lp_healthy: number; symbols_streamed: number; routes_total: number };
};
export type TechHubResult = { ok: true; data: TechHub } | { ok: false; error: string };

export type ExecSymbol = { symbol: string; positions: number; volume: number; commission: number };
export type ExecDashboard = {
  open_positions: number; open_volume: number; floating_pnl: number; active_traders: number;
  accounts_live: number; accounts_demo: number; equity_total: number; trades_today: number;
  volume_today: number; rev_commission_today: number; rev_swap_today: number; rev_spread_today: number;
  realized_pnl_today: number; volume_7d: number; rev_commission_7d: number; by_symbol: ExecSymbol[];
};

// Executive dashboard metrics from the live trading core (terminal).
export async function loadExecDashboard(): Promise<ExecDashboard | null> {
  const user = await getCurrentUser();
  const isSuper = Boolean((user?.profile as { is_super_admin?: boolean } | null)?.is_super_admin);
  if (user?.profile?.role !== "admin" && !isSuper) return null;
  return await terminalRpc<ExecDashboard>("fn_tech_exec");
}

export type RiskSymbol = { symbol: string; net: number; exposure: number; positions: number; pnl: number };
export type RiskAccount = { account_number: string; equity: number; margin: number; free_margin: number; margin_level_bps: number | null };
export type RiskData = {
  total_exposure_lots: number; net_long_lots: number; net_short_lots: number; floating_pnl: number;
  open_positions: number; accounts_negative_margin: number; by_symbol: RiskSymbol[]; top_accounts: RiskAccount[];
};
export async function loadRisk(): Promise<RiskData | null> {
  const user = await getCurrentUser();
  const isSuper = Boolean((user?.profile as { is_super_admin?: boolean } | null)?.is_super_admin);
  if (user?.profile?.role !== "admin" && !isSuper) return null;
  return await terminalRpc<RiskData>("fn_tech_risk");
}

export async function loadTechHub(): Promise<TechHubResult> {
  const user = await getCurrentUser();
  const isSuper = Boolean((user?.profile as { is_super_admin?: boolean } | null)?.is_super_admin);
  if (user?.profile?.role !== "admin" && !isSuper) return { ok: false, error: "Admin access only." };

  const data = await terminalRpc<TechHub>("fn_tech_hub");
  if (data == null) return { ok: false, error: "Terminal connection unavailable (check bridge_secrets / terminal service)." };
  return { ok: true, data };
}
