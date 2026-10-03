import { resolveRow } from "@gio4x/scope-engine";
import type { PricingContext, MarketState, SpreadResult, BreakdownItem } from "../types/schemas";
import type { MarkupUnit } from "../types/enums";
import type { PricingCache } from "../cache";
import { toPrice } from "../feed/units";
import { evalCondition } from "../rules/condition";
import { scopeMatches } from "../rules/match";

// Resolve the ONE effective broker spread (price units). Most-specific base wins;
// dynamic deltas, event widening, and cohort compression layer on; clamped to the
// row's min/max and the global cap. Pure + cache-only. INTERNAL breakdown.
export function resolveSpread(
  ctx: PricingContext, cache: PricingCache, market: MarketState, refPrice: number, rawSpread: number,
): SpreadResult {
  const breakdown: BreakdownItem[] = [];
  const norm = (v: number, unit: MarkupUnit) => toPrice(v, unit, ctx.assetClass, ctx.symbol, refPrice);

  // 1. base — most-specific spread_config, else passthrough raw spread
  const base = resolveRow(ctx, (st, ref) => cache.getSpread(st, ref));
  let spread: number;
  let minS: number | null = null;
  let maxS: number | null = null;
  if (base) {
    spread = norm(base.row.baseValue, base.row.unit);
    minS = base.row.minSpread != null ? norm(base.row.minSpread, base.row.unit) : null;
    maxS = base.row.maxSpread != null ? norm(base.row.maxSpread, base.row.unit) : null;
    breakdown.push({ label: `base(${base.scopeType})`, valuePrice: spread });

    // 2. dynamic adjustments (only on a dynamic base)
    if (base.row.mode === "dynamic") {
      const facts = { volatility: market.volatility, liquidity: market.liquidity, session: market.session, exposure: market.netExposureLots };
      for (const r of [...cache.dynamicSpreadRules].sort((a, b) => a.priority - b.priority)) {
        if (scopeMatches(ctx, r.scopeType, r.scopeRef) && evalCondition(r.condition, facts)) {
          const d = norm(r.deltaValue, r.unit);
          spread += d;
          breakdown.push({ label: "dynamic", valuePrice: d });
        }
      }
    }
  } else {
    spread = rawSpread;
    breakdown.push({ label: "passthrough_raw", valuePrice: rawSpread });
  }

  // 3. event widening in force
  for (const r of cache.wideningRules) {
    if ((market.activeWidenTriggers ?? []).includes(r.trigger) && (r.symbols.length === 0 || r.symbols.includes(ctx.symbol))) {
      const w = norm(r.widenBy, r.unit);
      spread += w;
      breakdown.push({ label: `widen:${r.trigger}`, valuePrice: w });
    }
  }

  // 4. cohort compression (respect floor)
  for (const r of cache.compressionRules) {
    const segOk = !r.segment || r.segment === ctx.segment;
    const grpOk = !r.tradingGroup || r.tradingGroup === ctx.tradingGroup;
    if (segOk && grpOk) {
      const floor = r.floorSpread != null ? norm(r.floorSpread, r.unit) : 0;
      const after = Math.max(spread - norm(r.compressBy, r.unit), floor);
      breakdown.push({ label: "compress", valuePrice: after - spread });
      spread = after;
    }
  }

  // 5. clamp to row min/max + global cap
  if (minS != null) spread = Math.max(spread, minS);
  if (maxS != null) spread = Math.min(spread, maxS);
  const globalMax = norm(cache.engine.maxTotalSpreadPips, "pips");
  if (spread > globalMax) {
    breakdown.push({ label: "global_cap", valuePrice: globalMax - spread });
    spread = globalMax;
  }

  return { effectiveSpread: Math.max(spread, 0), breakdown };
}
