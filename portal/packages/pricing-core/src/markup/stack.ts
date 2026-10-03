import type { PricingContext, MarkupResult, BreakdownItem } from "../types/schemas";
import type { MarkupUnit } from "../types/enums";
import type { PricingCache } from "../cache";
import { toPrice } from "../feed/units";
import { scopeMatches, clientInBucket } from "../rules/match";

// Markup STACKS (unlike spread). Sum all matching layers per side in stack_order,
// add LP markup + segment delta, then HARD-CAP each side. Sided: buy→ask, sell→bid,
// dual→both. All in price units. INTERNAL breakdown.
export function resolveMarkup(
  ctx: PricingContext, cache: PricingCache, refPrice: number, lpId?: string | null,
): MarkupResult {
  const breakdown: BreakdownItem[] = [];
  const norm = (v: number, unit: MarkupUnit) => toPrice(v, unit, ctx.assetClass, ctx.symbol, refPrice);
  let buy = 0;
  let sell = 0;

  const layers = cache.markupLayers
    .filter((l) => scopeMatches(ctx, l.layer, l.scopeRef))
    .filter((l) => l.appliesRegions.length === 0 || l.appliesRegions.includes(ctx.country))
    .filter((l) => l.pctOfClients == null || clientInBucket(ctx.accountId, l.pctOfClients))
    .sort((a, b) => a.stackOrder - b.stackOrder);

  for (const l of layers) {
    let v = norm(l.value, l.unit);
    if (l.pctOfVolume != null) v *= l.pctOfVolume / 100; // partial-volume scaling
    if (l.side === "buy" || l.side === "dual") buy += v;
    if (l.side === "sell" || l.side === "dual") sell += v;
    breakdown.push({ label: `layer:${l.layer}/${l.side}`, valuePrice: v });
  }

  // LP-specific markup for the feeding LP
  for (const m of cache.lpMarkup) {
    if (lpId && m.lpId !== lpId) continue;
    if (m.symbols.length > 0 && !m.symbols.includes(ctx.symbol)) continue;
    const v = norm(m.value, m.unit);
    if (m.side === "buy" || m.side === "dual") buy += v;
    if (m.side === "sell" || m.side === "dual") sell += v;
    breakdown.push({ label: "lp_markup", valuePrice: v });
  }

  // segment markup delta (both sides)
  for (const s of cache.segmentPricing) {
    const segOk = !s.segment || s.segment === ctx.segment;
    const behOk = !s.behaviour || s.behaviour === ctx.behaviour;
    if (segOk && behOk && s.markupDelta) {
      const v = norm(s.markupDelta, s.unit);
      buy += v;
      sell += v;
      breakdown.push({ label: "segment", valuePrice: v });
    }
  }

  // HARD runaway cap per side
  const cap = norm(cache.engine.maxTotalMarkupPips, "pips");
  if (buy > cap) { breakdown.push({ label: "cap_buy", valuePrice: cap - buy }); buy = cap; }
  if (sell > cap) { breakdown.push({ label: "cap_sell", valuePrice: cap - sell }); sell = cap; }

  return { buyMarkup: Math.max(buy, 0), sellMarkup: Math.max(sell, 0), breakdown };
}
