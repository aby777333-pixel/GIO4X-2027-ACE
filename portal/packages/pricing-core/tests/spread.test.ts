import { describe, it, expect } from "vitest";
import { PricingCache, resolveSpread } from "../src";
import type { PricingContext, MarketState, SpreadConfigRow } from "../src";

const ctx = (o?: Partial<PricingContext>): PricingContext => ({
  accountId: "a", accountType: "vip", clientGroup: "c", tradingGroup: "g", whiteLabel: "w",
  country: "IN", symbol: "EURUSD", assetClass: "forex", ...o,
});
const mkt: MarketState = {};
const sc = (p: Partial<SpreadConfigRow>): SpreadConfigRow => ({
  id: p.id ?? "x", scopeType: p.scopeType ?? "global", scopeRef: p.scopeRef ?? null, mode: p.mode ?? "fixed",
  baseValue: p.baseValue ?? 1, unit: p.unit ?? "pips", minSpread: p.minSpread ?? null, maxSpread: p.maxSpread ?? null,
  priority: p.priority ?? 100, enabled: p.enabled ?? true,
});

describe("spread engine", () => {
  it("fixed base → price units", () => {
    const c = new PricingCache({ spreadConfig: [sc({ baseValue: 2 })] });
    expect(resolveSpread(ctx(), c, mkt, 1.1, 0.00005).effectiveSpread).toBeCloseTo(0.0002, 10);
  });
  it("most-specific wins (symbol > global)", () => {
    const c = new PricingCache({ spreadConfig: [sc({ id: "g", baseValue: 5 }), sc({ id: "s", scopeType: "symbol", scopeRef: "EURUSD", baseValue: 1 })] });
    expect(resolveSpread(ctx(), c, mkt, 1.1, 0).effectiveSpread).toBeCloseTo(0.0001, 10);
  });
  it("passthrough raw when no config", () => {
    expect(resolveSpread(ctx(), new PricingCache({}), mkt, 1.1, 0.00007).effectiveSpread).toBeCloseTo(0.00007, 10);
  });
  it("event widening adds when trigger active", () => {
    const c = new PricingCache({
      spreadConfig: [sc({ baseValue: 1 })],
      wideningRules: [{ id: "w", name: "nfp", trigger: "nfp", symbols: [], widenBy: 3, unit: "pips", startsBeforeSecs: 0, endsAfterSecs: 0, enabled: true }],
    });
    expect(resolveSpread(ctx(), c, { activeWidenTriggers: ["nfp"] }, 1.1, 0).effectiveSpread).toBeCloseTo(0.0004, 10);
  });
  it("compression respects floor", () => {
    const c = new PricingCache({
      spreadConfig: [sc({ baseValue: 3 })],
      compressionRules: [{ id: "c", name: "vip", segment: "vip", tradingGroup: null, compressBy: 5, unit: "pips", floorSpread: 1, enabled: true }],
    });
    expect(resolveSpread(ctx({ segment: "vip" }), c, mkt, 1.1, 0).effectiveSpread).toBeCloseTo(0.0001, 10);
  });
  it("clamps to max_spread", () => {
    const c = new PricingCache({ spreadConfig: [sc({ baseValue: 10, maxSpread: 4 })] });
    expect(resolveSpread(ctx(), c, mkt, 1.1, 0).effectiveSpread).toBeCloseTo(0.0004, 10);
  });
});
