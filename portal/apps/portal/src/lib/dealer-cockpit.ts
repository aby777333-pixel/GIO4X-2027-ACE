import { getSupabaseServer } from "./supabase-server";

// Thin read layer for the Dealer Cockpit. The `dealer` schema isn't API-exposed,
// so we go through public SECURITY DEFINER wrappers gated by dealer.can_read().
type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }> };

export type LpHealth = { name: string; status: string; is_primary: boolean; priority: number; reject_rate: number; avg_fill_ms: number | null };
export type DealerOverview = {
  book_configs: number; routing_rules: number; lps: LpHealth[]; lp_active: number; lp_total: number;
  open_interventions: number; open_flags: number; toxic_clients: number;
  recent_switches: { account_id: string; from_book: string | null; to_book: string; reason: string; triggered_by: string; created_at: string }[];
  recent_alerts: { severity: string; category: string; title: string; created_at: string }[];
  exposure: { ref: string; net_lots: number; gross_lots: number }[];
  revenue_today: number;
};

export async function loadDealerOverview(): Promise<DealerOverview | null> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data } = await sb.rpc("dealer_overview");
  const d = data as DealerOverview;
  return d && Object.keys(d).length > 0 ? d : null;
}

export type BookConfigRowDb = {
  id: string; scope_type: string; scope_ref: string | null; book: string; dealing_mode: string;
  execution_model: string; volume_threshold_lots: number | null; profit_threshold_usd: number | null;
  max_slippage_points: number; max_deviation_points: number; order_timeout_ms: number;
  requires_dealer: boolean; enabled: boolean; priority: number;
};

export async function loadBookConfigs(): Promise<BookConfigRowDb[]> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data } = await sb.rpc("dealer_book_configs");
  return (data as BookConfigRowDb[]) ?? [];
}
