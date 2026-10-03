import { getSupabaseServer } from "./supabase-server";
import type {
  PricingConfig, SpreadConfigRow, DynamicSpreadRuleRow, WideningRuleRow,
  CompressionRuleRow, MarkupLayerRow, LpMarkupRow, SegmentPricingRow, EngineSettings,
  CommissionConfigRow, SwapConfigRow,
} from "@gio4x/pricing-core";

// Thin read layer for the Pricing Terminal. The pricing schema isn't API-exposed,
// so everything goes through public SECURITY DEFINER wrappers gated by pricing.can_read().
type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }> };
type Row = Record<string, unknown>;
const n = (v: unknown): number => Number(v ?? 0);
const ns = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

export type PricingOverview = {
  engine: { max_total_markup_pips: number; max_total_spread_pips: number; stale_feed_action: string; stale_feed_ms: number } | null;
  counts: Record<string, number>;
  audit_24h: number;
};

export async function loadPricingOverview(): Promise<PricingOverview | null> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data } = await sb.rpc("pricing_overview");
  const d = data as PricingOverview;
  return d && Object.keys(d).length > 0 ? d : null;
}

const mapSpread = (r: Row): SpreadConfigRow => ({
  id: String(r.id), scopeType: r.scope_type as SpreadConfigRow["scopeType"], scopeRef: (r.scope_ref as string) ?? null,
  mode: r.mode as SpreadConfigRow["mode"], baseValue: n(r.base_value), unit: r.unit as SpreadConfigRow["unit"],
  minSpread: ns(r.min_spread), maxSpread: ns(r.max_spread), priority: n(r.priority), enabled: r.enabled !== false,
});
const mapMarkup = (r: Row): MarkupLayerRow => ({
  id: String(r.id), layer: r.layer as MarkupLayerRow["layer"], scopeRef: (r.scope_ref as string) ?? null,
  side: r.side as MarkupLayerRow["side"], value: n(r.value), unit: r.unit as MarkupLayerRow["unit"],
  pctOfVolume: ns(r.pct_of_volume), pctOfClients: ns(r.pct_of_clients), appliesRegions: (r.applies_regions as string[]) ?? [],
  stackOrder: n(r.stack_order), enabled: r.enabled !== false,
});
const mapDyn = (r: Row): DynamicSpreadRuleRow => ({
  id: String(r.id), scopeType: r.scope_type as DynamicSpreadRuleRow["scopeType"], scopeRef: (r.scope_ref as string) ?? null,
  priority: n(r.priority), condition: r.condition, deltaValue: n(r.delta_value), unit: r.unit as DynamicSpreadRuleRow["unit"], enabled: r.enabled !== false,
});
const mapWiden = (r: Row): WideningRuleRow => ({
  id: String(r.id), name: String(r.name), trigger: String(r.trigger), symbols: (r.symbols as string[]) ?? [],
  widenBy: n(r.widen_by), unit: r.unit as WideningRuleRow["unit"], startsBeforeSecs: n(r.starts_before_secs), endsAfterSecs: n(r.ends_after_secs), enabled: r.enabled !== false,
});
const mapComp = (r: Row): CompressionRuleRow => ({
  id: String(r.id), name: String(r.name), segment: (r.segment as CompressionRuleRow["segment"]) ?? null,
  tradingGroup: (r.trading_group as string) ?? null, compressBy: n(r.compress_by), unit: r.unit as CompressionRuleRow["unit"], floorSpread: ns(r.floor_spread), enabled: r.enabled !== false,
});
const mapLpMarkup = (r: Row): LpMarkupRow => ({
  id: String(r.id), lpId: String(r.lp_id), symbols: (r.symbols as string[]) ?? [], side: r.side as LpMarkupRow["side"],
  value: n(r.value), unit: r.unit as LpMarkupRow["unit"], enabled: r.enabled !== false,
});
const mapSeg = (r: Row): SegmentPricingRow => ({
  id: String(r.id), segment: (r.segment as SegmentPricingRow["segment"]) ?? null, behaviour: (r.behaviour as SegmentPricingRow["behaviour"]) ?? null,
  spreadDelta: n(r.spread_delta), markupDelta: n(r.markup_delta), unit: r.unit as SegmentPricingRow["unit"], enabled: r.enabled !== false,
});

export async function loadPricingConfig(): Promise<PricingConfig> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data } = await sb.rpc("pricing_engine_config");
  const d = (data ?? {}) as Record<string, Row[] | Row>;
  const e = d.engine as Row | undefined;
  const engine: EngineSettings | undefined = e
    ? { maxTotalMarkupPips: n(e.max_total_markup_pips), maxTotalSpreadPips: n(e.max_total_spread_pips), staleFeedAction: String(e.stale_feed_action), staleFeedMs: n(e.stale_feed_ms) }
    : undefined;
  return {
    engine,
    spreadConfig: ((d.spread_config as Row[]) ?? []).map(mapSpread),
    dynamicSpreadRules: ((d.dynamic_spread_rules as Row[]) ?? []).map(mapDyn),
    wideningRules: ((d.widening_rules as Row[]) ?? []).map(mapWiden),
    compressionRules: ((d.compression_rules as Row[]) ?? []).map(mapComp),
    markupLayers: ((d.markup_layers as Row[]) ?? []).map(mapMarkup),
    lpMarkup: ((d.lp_markup as Row[]) ?? []).map(mapLpMarkup),
    segmentPricing: ((d.segment_pricing as Row[]) ?? []).map(mapSeg),
  };
}

export type SmartRuleUi = { id: string; name: string; priority: number; condition: unknown; action: Record<string, unknown>; scope_type: string; scope_ref: string | null; enabled: boolean };
export type DynamicRuleUi = { id: string; name: string; priority: number; condition: unknown; delta_value: number; unit: string; scope_type: string; scope_ref: string | null; enabled: boolean };

export async function loadPricingRules(): Promise<{ smart: SmartRuleUi[]; dynamic: DynamicRuleUi[] }> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data } = await sb.rpc("pricing_rules");
  const d = (data ?? {}) as { smart?: Row[]; dynamic?: Row[] };
  return {
    smart: (d.smart ?? []).map((r) => ({ id: String(r.id), name: String(r.name), priority: n(r.priority), condition: r.condition, action: (r.action as Record<string, unknown>) ?? {}, scope_type: String(r.scope_type), scope_ref: (r.scope_ref as string) ?? null, enabled: r.enabled !== false })),
    dynamic: (d.dynamic ?? []).map((r) => ({ id: String(r.id), name: String(r.name), priority: n(r.priority), condition: r.condition, delta_value: n(r.delta_value), unit: String(r.unit), scope_type: String(r.scope_type), scope_ref: (r.scope_ref as string) ?? null, enabled: r.enabled !== false })),
  };
}

const mapCommission = (r: Row): CommissionConfigRow => ({
  id: String(r.id), scopeType: r.scope_type as CommissionConfigRow["scopeType"], scopeRef: (r.scope_ref as string) ?? null,
  model: r.model as CommissionConfigRow["model"], value: n(r.value), perSide: r.per_side !== false, currency: String(r.currency ?? "USD"),
  enabled: r.enabled !== false, priority: n(r.priority),
});
const mapSwap = (r: Row): SwapConfigRow => ({
  id: String(r.id), scopeType: r.scope_type as SwapConfigRow["scopeType"], scopeRef: (r.scope_ref as string) ?? null,
  longRate: n(r.long_rate), shortRate: n(r.short_rate), tripleDay: n(r.triple_day), dynamic: r.dynamic === true,
  unit: r.unit as SwapConfigRow["unit"], enabled: r.enabled !== false,
});
export async function loadCommissionSwap(): Promise<{ commission: CommissionConfigRow[]; swap: SwapConfigRow[] }> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data } = await sb.rpc("pricing_commission_swap");
  const d = (data ?? {}) as { commission?: Row[]; swap?: Row[] };
  return { commission: (d.commission ?? []).map(mapCommission), swap: (d.swap ?? []).map(mapSwap) };
}

export type LpHealthRow = { id: string; name: string; status: string; is_primary: boolean; priority: number; reject_rate: number; avg_fill_ms: number | null };
export type RoutingRowUi = { id: string; scope_type: string; scope_ref: string | null; mode: string; enabled: boolean };
export async function loadLpPricing(): Promise<{ lps: LpHealthRow[]; markup: LpMarkupRow[]; routing: RoutingRowUi[] }> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data } = await sb.rpc("pricing_lp");
  const d = (data ?? {}) as { lps?: Row[]; lp_markup?: Row[]; routing?: Row[] };
  return {
    lps: (d.lps ?? []).map((r) => ({ id: String(r.id), name: String(r.name), status: String(r.status), is_primary: r.is_primary === true, priority: n(r.priority), reject_rate: n(r.reject_rate), avg_fill_ms: r.avg_fill_ms == null ? null : n(r.avg_fill_ms) })),
    markup: (d.lp_markup ?? []).map(mapLpMarkup),
    routing: (d.routing ?? []).map((r) => ({ id: String(r.id), scope_type: String(r.scope_type), scope_ref: (r.scope_ref as string) ?? null, mode: String(r.mode), enabled: r.enabled !== false })),
  };
}

export type RevenueData = {
  total: number; today: number; last_7d: number;
  by_source: { source: string; amt: number }[];
  by_symbol: { symbol: string; amt: number }[];
  by_book: { book: string; amt: number }[];
  recent: { symbol: string; source: string; amount: number; book: string | null; occurred_at: string }[];
  rows: number;
};
export async function loadRevenue(): Promise<RevenueData | null> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data } = await sb.rpc("pricing_revenue");
  const d = data as RevenueData;
  return d && Object.keys(d).length > 0 ? d : null;
}

export type PricingAuditRow = { id: string; table: string; action: string; previous: Record<string, unknown> | null; new: Record<string, unknown> | null; ip: string | null; device: string | null; at: string };
export async function loadPricingAudit(): Promise<PricingAuditRow[]> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data } = await sb.rpc("pricing_audit", { p_limit: 60 });
  return (data as PricingAuditRow[]) ?? [];
}

export type EmergencyRow = { symbol: string | null; action: string; reason: string | null; at: string };
export async function loadEmergency(): Promise<EmergencyRow[]> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data } = await sb.rpc("pricing_emergency_recent");
  return (data as EmergencyRow[]) ?? [];
}
