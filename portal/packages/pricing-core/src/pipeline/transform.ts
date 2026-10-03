import type { RawTick, PricingContext, MarketState, ClientTick, InternalTick } from "../types/schemas";
import type { PricingCache } from "../cache";
import { resolveSpread } from "../spread/resolve";
import { resolveMarkup } from "../markup/stack";

const round = (n: number) => Math.round(n * 1e8) / 1e8;

// PURE per-tick transform. No await, no DB. Returns the Black-Glass client tick and
// the internal reconstruction as SEPARATE values — they cannot mix at the type level.
export function transformTick(
  raw: RawTick, ctx: PricingContext, cache: PricingCache, market: MarketState,
): { client: ClientTick; internal: InternalTick } {
  const mid = (raw.bid + raw.ask) / 2;
  const rawSpread = Math.max(raw.ask - raw.bid, 0);
  const stale = (market.feedAgeMs ?? 0) > cache.engine.staleFeedMs;

  const spread = resolveSpread(ctx, cache, market, mid, rawSpread);
  const brokerBid = mid - spread.effectiveSpread / 2;
  const brokerAsk = mid + spread.effectiveSpread / 2;

  const markup = resolveMarkup(ctx, cache, mid, raw.lpId);
  const finalBid = brokerBid - markup.sellMarkup; // sell hits bid
  const finalAsk = brokerAsk + markup.buyMarkup; // buy hits ask

  // Internal revenue proxy: extra spread captured over the raw LP spread (price units).
  const revenuePerLot = round(finalAsk - finalBid - rawSpread);

  const client: ClientTick = { symbol: raw.symbol, bid: round(finalBid), ask: round(finalAsk), ts: raw.ts };
  const internal: InternalTick = {
    symbol: raw.symbol, ts: raw.ts, lpId: raw.lpId ?? null,
    raw: { bid: raw.bid, ask: raw.ask },
    broker: { bid: round(brokerBid), ask: round(brokerAsk) },
    final: { bid: round(finalBid), ask: round(finalAsk) },
    spread, markup, revenuePerLot, stale,
  };
  return { client, internal };
}

// The ONLY sanctioned client serializer — picks exactly the four Black-Glass fields.
// Typed to ClientTick so the compiler rejects any attempt to add internal fields.
export function toClientPayload(client: ClientTick): ClientTick {
  return { symbol: client.symbol, bid: client.bid, ask: client.ask, ts: client.ts };
}
