"use server";

import { revalidatePath } from "next/cache";
import { ConfigCache, resolveConfig, routeOrder } from "@gio4x/dealer-core";
import type { BookConfigRow, OrderContext, ClientRiskScore, EffectiveConfig, RoutingDecision } from "@gio4x/dealer-core";
import { getSupabaseServer } from "./supabase-server";
import type { BookConfigRowDb } from "./dealer-cockpit";
import { buildDealerSyncPayload } from "./raptor-bridge";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

function mapRow(r: BookConfigRowDb): BookConfigRow {
  return {
    id: r.id, scopeType: r.scope_type as BookConfigRow["scopeType"], scopeRef: r.scope_ref,
    book: r.book as BookConfigRow["book"], dealingMode: r.dealing_mode as BookConfigRow["dealingMode"],
    executionModel: r.execution_model as BookConfigRow["executionModel"],
    volumeThresholdLots: r.volume_threshold_lots, profitThresholdUsd: r.profit_threshold_usd,
    maxSlippagePoints: r.max_slippage_points, maxDeviationPoints: r.max_deviation_points,
    orderTimeoutMs: r.order_timeout_ms, requiresDealer: r.requires_dealer, enabled: r.enabled, priority: r.priority,
  };
}

export type PreviewInput = {
  accountId: string; accountType: string; clientGroup: string; tradingGroup: string;
  whiteLabel: string; country: string; symbol: string; assetClass: string; volumeLots: number;
  riskScore?: number | null;
};

export type PreviewResult =
  | { ok: true; config: EffectiveConfig; decision: RoutingDecision }
  | { ok: false; error: string };

// Runs the REAL engine (@gio4x/dealer-core) against the live book_config — proves
// config → resolver → router end to end, with the rule snapshot that decided it.
export async function previewRouting(input: PreviewInput): Promise<PreviewResult> {
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data } = await sb.rpc("dealer_book_configs");
  const rows = ((data as BookConfigRowDb[]) ?? []).map(mapRow);
  const cache = new ConfigCache(rows);

  const ctx: OrderContext = {
    accountId: input.accountId, accountType: input.accountType, clientGroup: input.clientGroup,
    tradingGroup: input.tradingGroup, whiteLabel: input.whiteLabel, country: input.country,
    symbol: input.symbol, assetClass: input.assetClass, volumeLots: Number(input.volumeLots) || 0,
  };
  const config = resolveConfig(ctx, cache);
  const risk: ClientRiskScore | null =
    input.riskScore != null && Number.isFinite(input.riskScore)
      ? { accountId: input.accountId, winRate: null, profitFactor: null, maxDrawdown: null, avgHoldSecs: null, strategyTag: null, lifetimePnl: null, riskScore: input.riskScore, toxic: input.riskScore >= 70 }
      : null;
  const decision = routeOrder(ctx, config, risk, []);
  return { ok: true, config, decision };
}

export type SyncResult = { ok: true; positions: number; exposure: number } | { ok: false; error: string };

// Read live GIO Raptor positions → engine aggregateExposure → write dealer schema.
export async function runDealerSync(): Promise<SyncResult> {
  const payload = await buildDealerSyncPayload();
  if (!payload) return { ok: false, error: "Could not read GIO Raptor positions (check the bridge/terminal connection)." };
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data, error } = await sb.rpc("dealer_ingest_state", { p_positions: payload.positions, p_exposure: payload.exposure });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/dealer");
  const d = data as { positions: number; exposure: number };
  return { ok: true, positions: d.positions, exposure: d.exposure };
}
