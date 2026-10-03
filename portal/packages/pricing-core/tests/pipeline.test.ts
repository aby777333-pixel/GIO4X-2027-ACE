import { describe, it, expect } from "vitest";
import { PricingCache, transformTick, toClientPayload } from "../src";
import type { PricingContext, RawTick, ClientTick, SpreadConfigRow, MarkupLayerRow } from "../src";

const ctx = (o?: Partial<PricingContext>): PricingContext => ({
  accountId: "a", accountType: "vip", clientGroup: "c", tradingGroup: "g", whiteLabel: "w",
  country: "IN", symbol: "EURUSD", assetClass: "forex", ...o,
});
const raw: RawTick = { symbol: "EURUSD", bid: 1.10000, ask: 1.10010, ts: "t" };
const SC: SpreadConfigRow = { id: "g", scopeType: "global", scopeRef: null, mode: "fixed", baseValue: 2, unit: "pips", minSpread: null, maxSpread: null, priority: 100, enabled: true };
const ML: MarkupLayerRow = { id: "m", layer: "global", scopeRef: null, side: "dual", value: 1, unit: "pips", pctOfVolume: null, pctOfClients: null, appliesRegions: [], stackOrder: 100, enabled: true };

describe("price pipeline", () => {
  it("applies broker spread then sided markup", () => {
    const c = new PricingCache({ spreadConfig: [SC], markupLayers: [ML] });
    const { client, internal } = transformTick(raw, ctx(), c, {});
    // mid 1.10005; 2-pip spread → broker 1.09995/1.10015; 1-pip markup each side → 1.09985 / 1.10025
    expect(client.bid).toBeCloseTo(1.09985, 8);
    expect(client.ask).toBeCloseTo(1.10025, 8);
    expect(internal.markup.buyMarkup).toBeCloseTo(0.0001, 10);
    expect(internal.revenuePerLot).toBeGreaterThan(0);
  });

  it("BLACK GLASS — client payload has exactly the four allowed keys", () => {
    const { client } = transformTick(raw, ctx(), new PricingCache({}), {});
    expect(Object.keys(toClientPayload(client)).sort()).toEqual(["ask", "bid", "symbol", "ts"]);
  });

  it("BLACK GLASS — internal fields are not assignable to ClientTick (compile guard)", () => {
    // @ts-expect-error — adding an internal field to a ClientTick must be a type error.
    const bad: ClientTick = { symbol: "EURUSD", bid: 1, ask: 2, ts: "t", raw: { bid: 1, ask: 2 } };
    expect(bad.symbol).toBe("EURUSD");
  });

  it("staleness flag when feed age exceeds the threshold", () => {
    expect(transformTick(raw, ctx(), new PricingCache({}), { feedAgeMs: 5000 }).internal.stale).toBe(true);
  });
});
