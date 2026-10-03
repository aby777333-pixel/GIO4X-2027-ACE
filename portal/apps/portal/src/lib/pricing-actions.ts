"use server";

import { revalidatePath } from "next/cache";
import { transformTick, PricingCache, pipSize } from "@gio4x/pricing-core";
import type { ClientTick, InternalTick, PricingContext, RawTick } from "@gio4x/pricing-core";
import { getSupabaseServer } from "./supabase-server";
import { loadPricingConfig, loadRevenue, loadPricingAudit } from "./pricing-terminal";
import { terminalSelect, terminalPatch } from "./tech-terminal";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
export type PricingResult = { ok: true; message?: string } | { ok: false; error: string };

export type PricingPreviewInput = {
  symbol: string; assetClass: string; mid: number; rawSpreadPips: number;
  segment?: string; tradingGroup?: string; country?: string; volumeLots?: number; widenTrigger?: string;
};
export type PricingPreviewResult = { ok: true; client: ClientTick; internal: InternalTick } | { ok: false; error: string };

// Runs the REAL pricing engine (transformTick) against the live config — raw → broker
// → final, with the full INTERNAL breakdown. Internal-only.
export async function previewPricing(input: PricingPreviewInput): Promise<PricingPreviewResult> {
  const cfg = await loadPricingConfig();
  const cache = new PricingCache(cfg);
  const pip = pipSize(input.assetClass, input.symbol);
  const rawSpreadPrice = (Number(input.rawSpreadPips) || 0) * pip;
  const mid = Number(input.mid) || 0;
  const raw: RawTick = { symbol: input.symbol, bid: mid - rawSpreadPrice / 2, ask: mid + rawSpreadPrice / 2, ts: new Date().toISOString() };
  const ctx: PricingContext = {
    accountId: "preview", accountType: "vip", clientGroup: "cg", tradingGroup: input.tradingGroup || "g",
    whiteLabel: "gio4x", country: input.country || "IN", symbol: input.symbol, assetClass: input.assetClass,
    segment: input.segment as PricingContext["segment"], volumeLots: input.volumeLots,
  };
  const market = { activeWidenTriggers: input.widenTrigger ? [input.widenTrigger] : [] };
  const { client, internal } = transformTick(raw, ctx, cache, market);
  return { ok: true, client, internal };
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<PricingResult> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc(fn, args);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/spreads");
  return { ok: true };
}

export const upsertSpread = (p: Record<string, unknown>) => rpc("pricing_spread_upsert", { p });
export const toggleSpread = (id: string, enabled: boolean) => rpc("pricing_spread_toggle", { p_id: id, p_enabled: enabled });
export const upsertMarkup = (p: Record<string, unknown>) => rpc("pricing_markup_upsert", { p });
export const toggleMarkup = (id: string, enabled: boolean) => rpc("pricing_markup_toggle", { p_id: id, p_enabled: enabled });
export const deleteMarkup = (id: string) => rpc("pricing_markup_delete", { p_id: id });

export const upsertSmart = (p: Record<string, unknown>) => rpc("pricing_smart_upsert", { p });
export const toggleSmart = (id: string, enabled: boolean) => rpc("pricing_smart_toggle", { p_id: id, p_enabled: enabled });
export const deleteSmart = (id: string) => rpc("pricing_smart_delete", { p_id: id });
export const upsertDynamic = (p: Record<string, unknown>) => rpc("pricing_dynamic_upsert", { p });
export const toggleDynamic = (id: string, enabled: boolean) => rpc("pricing_dynamic_toggle", { p_id: id, p_enabled: enabled });
export const deleteDynamic = (id: string) => rpc("pricing_dynamic_delete", { p_id: id });

export const upsertCommission = (p: Record<string, unknown>) => rpc("pricing_commission_upsert", { p });
export const toggleCommission = (id: string, enabled: boolean) => rpc("pricing_commission_toggle", { p_id: id, p_enabled: enabled });
export const deleteCommission = (id: string) => rpc("pricing_commission_delete", { p_id: id });
export const upsertSwap = (p: Record<string, unknown>) => rpc("pricing_swap_upsert", { p });
export const toggleSwap = (id: string, enabled: boolean) => rpc("pricing_swap_toggle", { p_id: id, p_enabled: enabled });
export const deleteSwap = (id: string) => rpc("pricing_swap_delete", { p_id: id });

export const upsertLpMarkup = (p: Record<string, unknown>) => rpc("pricing_lp_markup_upsert", { p });
export const toggleLpMarkup = (id: string, enabled: boolean) => rpc("pricing_lp_markup_toggle", { p_id: id, p_enabled: enabled });
export const deleteLpMarkup = (id: string) => rpc("pricing_lp_markup_delete", { p_id: id });
export const upsertLpRouting = (p: Record<string, unknown>) => rpc("pricing_lp_routing_upsert", { p });
export const toggleLpRouting = (id: string, enabled: boolean) => rpc("pricing_lp_routing_toggle", { p_id: id, p_enabled: enabled });
export const deleteLpRouting = (id: string) => rpc("pricing_lp_routing_delete", { p_id: id });

// Pull live commission + swap revenue from GIO Raptor into the shared revenue
// ledger (idempotent full-replace of ref='raptor' rows).
type RaptorPos = { symbol: string; commission: number | null; swap_accrued: number | null; routing_mode: string | null };
const r2 = (x: number) => Math.round(x * 100) / 100;
export async function syncRevenue(): Promise<{ ok: true; rows: number } | { ok: false; error: string }> {
  const positions = await terminalSelect<RaptorPos>("positions?select=symbol,commission,swap_accrued,routing_mode&limit=5000");
  if (positions == null) return { ok: false, error: "Could not read GIO Raptor positions." };
  const agg = new Map<string, { symbol: string; book: string | null; commission: number; swap: number }>();
  for (const p of positions) {
    const book = p.routing_mode === "a_book" ? "a_book" : p.routing_mode === "b_book" ? "b_book" : null;
    const key = `${p.symbol}|${book ?? ""}`;
    let a = agg.get(key);
    if (!a) { a = { symbol: p.symbol, book, commission: 0, swap: 0 }; agg.set(key, a); }
    a.commission += Number(p.commission) || 0;
    a.swap += Number(p.swap_accrued) || 0;
  }
  const rows: Record<string, unknown>[] = [];
  for (const a of agg.values()) {
    if (a.commission) rows.push({ account_id: "aggregate", symbol: a.symbol, source: "commission", amount_usd: r2(a.commission), book: a.book });
    if (a.swap) rows.push({ account_id: "aggregate", symbol: a.symbol, source: "swap", amount_usd: r2(a.swap), book: a.book });
  }
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data, error } = await sb.rpc("dealer_revenue_ingest", { p_rows: rows });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/spreads");
  return { ok: true, rows: (data as { rows?: number })?.rows ?? 0 };
}

// ── Audit rollback ──────────────────────────────────────────────────────────
export const rollbackPricing = (auditId: string) => rpc("pricing_rollback", { p_audit_id: auditId });

// ── Analytics & reports export (CSV / JSON) ─────────────────────────────────
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
export async function exportPricingReport(kind: string, format: "csv" | "json"): Promise<{ ok: true; filename: string; mime: string; content: string } | { ok: false; error: string }> {
  let rows: Record<string, unknown>[] = [];
  if (kind === "revenue_by_symbol") { const r = await loadRevenue(); rows = (r?.by_symbol ?? []) as unknown as Record<string, unknown>[]; }
  else if (kind === "revenue_by_source") { const r = await loadRevenue(); rows = (r?.by_source ?? []) as unknown as Record<string, unknown>[]; }
  else if (kind === "spreads") { const c = await loadPricingConfig(); rows = (c.spreadConfig ?? []) as unknown as Record<string, unknown>[]; }
  else if (kind === "markups") { const c = await loadPricingConfig(); rows = (c.markupLayers ?? []) as unknown as Record<string, unknown>[]; }
  else if (kind === "audit") { rows = (await loadPricingAudit()).map((a) => ({ at: a.at, table: a.table, action: a.action, ip: a.ip })); }
  else return { ok: false, error: "Unknown report." };
  if (format === "json") return { ok: true, filename: `gio4x-pricing-${kind}.json`, mime: "application/json", content: JSON.stringify(rows, null, 2) };
  return { ok: true, filename: `gio4x-pricing-${kind}.csv`, mime: "text/csv", content: toCsv(rows) };
}

// ── Dealer override / emergency controls ────────────────────────────────────
export type EmergencyInput = { symbol: string; action: "freeze" | "unfreeze" | "expand_spread"; amount?: number; reason: string };
export async function emergencyControl(input: EmergencyInput): Promise<PricingResult> {
  const enc = encodeURIComponent(input.symbol);
  if (input.action === "freeze" || input.action === "unfreeze") {
    const r = await terminalPatch(`instruments?symbol=eq.${enc}`, { is_active: input.action === "unfreeze" });
    if (!r.ok) return { ok: false, error: r.error ?? "Terminal update failed." };
  } else if (input.action === "expand_spread") {
    const cur = await terminalSelect<{ spread_markup: number | null }>(`instruments?symbol=eq.${enc}&select=spread_markup`);
    const base = Number(cur?.[0]?.spread_markup ?? 0);
    const r = await terminalPatch(`instruments?symbol=eq.${enc}`, { spread_markup: base + (Number(input.amount) || 0) });
    if (!r.ok) return { ok: false, error: r.error ?? "Terminal update failed." };
  }
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("pricing_emergency_log", { p: { symbol: input.symbol, action: input.action, reason: input.reason, detail: { amount: input.amount ?? null } } });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/spreads");
  return { ok: true, message: `${input.action} applied to ${input.symbol} — live + alerted.` };
}
