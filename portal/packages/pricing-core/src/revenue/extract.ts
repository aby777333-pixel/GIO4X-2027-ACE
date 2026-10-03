import type { PricingContext } from "../types/schemas";
import type { ExtractionModelRow } from "../types/rows";
import { scopeMatches } from "../rules/match";

// Micro-extraction on fill (per-lot + notional bps). Additive to spread markup; never
// changes a client-visible price beyond the already-applied markup.
export function computeExtraction(
  models: ExtractionModelRow[], ctx: PricingContext, volumeLots: number, notionalUsd: number,
): number {
  let total = 0;
  for (const m of models) {
    if (!m.enabled) continue;
    if (!scopeMatches(ctx, m.scopeType, m.scopeRef)) continue;
    if (m.perLotUsd) total += m.perLotUsd * volumeLots;
    if (m.notionalBps) total += (m.notionalBps / 10000) * notionalUsd;
  }
  return total;
}

// Revenue rows destined for the SHARED dealer.revenue_ledger (one ledger).
export interface PricingFill {
  accountId: string; symbol: string; book?: string; lpId?: string | null;
  spreadMarkupUsd?: number; commissionUsd?: number; swapUsd?: number; extractionUsd?: number;
}
export interface RevenueRow {
  accountId: string; symbol: string; source: string; amountUsd: number; book?: string; lpId?: string | null;
}
export function pricingRevenueRows(f: PricingFill): RevenueRow[] {
  const out: RevenueRow[] = [];
  const add = (source: string, amt?: number) => {
    if (amt != null && amt !== 0) out.push({ accountId: f.accountId, symbol: f.symbol, source, amountUsd: amt, book: f.book, lpId: f.lpId ?? null });
  };
  add("spread_markup", f.spreadMarkupUsd);
  add("commission", f.commissionUsd);
  add("swap", f.swapUsd);
  add("extraction", f.extractionUsd);
  return out;
}
