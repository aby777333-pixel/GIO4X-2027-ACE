import { describe, it, expect } from "vitest";
import { routeOrder } from "../src";
import type { EffectiveConfig, OrderContext, ClientRiskScore, RoutingRule } from "../src";

function eff(p: Partial<EffectiveConfig>): EffectiveConfig {
  return {
    book: p.book ?? "b_book", dealingMode: p.dealingMode ?? "full_stp", executionModel: p.executionModel ?? "market",
    requiresDealer: p.requiresDealer ?? false, maxSlippagePoints: 30, maxDeviationPoints: 50, orderTimeoutMs: 3000,
    volumeThresholdLots: p.volumeThresholdLots ?? null, profitThresholdUsd: p.profitThresholdUsd ?? null,
    resolvedFrom: { book: { scopeType: "global", scopeRef: null, configId: "g" } },
  };
}
const ctx = (o?: Partial<OrderContext>): OrderContext => ({
  accountId: "a", accountType: "vip", clientGroup: "c", tradingGroup: "g", whiteLabel: "w",
  country: "IN", symbol: "EURUSD", assetClass: "forex", volumeLots: 1, ...o,
});
const risk = (score: number): ClientRiskScore => ({
  accountId: "a", winRate: null, profitFactor: null, maxDrawdown: null, avgHoldSecs: null,
  strategyTag: null, lifetimePnl: null, riskScore: score, toxic: score >= 70,
});

describe("book router", () => {
  it("fixed a_book wins", () => expect(routeOrder(ctx(), eff({ book: "a_book" }), null, []).book).toBe("a_book"));
  it("fixed b_book wins", () => expect(routeOrder(ctx(), eff({ book: "b_book" }), null, []).book).toBe("b_book"));

  it("volume threshold forces a_book", () => {
    const d = routeOrder(ctx({ volumeLots: 12 }), eff({ book: "b_book", volumeThresholdLots: 10 }), null, []);
    expect(d.book).toBe("a_book");
    expect(d.flags).toContain("volume_threshold_force_a_book");
  });

  it("hybrid: matching rule wins", () => {
    const rules: RoutingRule[] = [{ id: "r1", name: "toxic", scopeType: "global", scopeRef: null, priority: 10, condition: { all: [{ field: "risk_score", op: ">=", value: 70 }] }, targetBook: "a_book", targetLpId: null, enabled: true }];
    const d = routeOrder(ctx(), eff({ book: "hybrid" }), risk(80), rules);
    expect(d.book).toBe("a_book");
    expect(d.matchedRuleId).toBe("r1");
  });

  it("hybrid fallthrough: toxic → a_book", () => expect(routeOrder(ctx(), eff({ book: "hybrid" }), risk(75), []).book).toBe("a_book"));
  it("hybrid fallthrough: clean → b_book", () => expect(routeOrder(ctx(), eff({ book: "hybrid" }), risk(40), []).book).toBe("b_book"));
  it("needsDealer when full_dealer", () => expect(routeOrder(ctx(), eff({ book: "b_book", dealingMode: "full_dealer" }), null, []).needsDealer).toBe(true));

  it("rules evaluated priority ascending (first match wins)", () => {
    const always = { all: [{ field: "volume_lots" as const, op: ">=" as const, value: 0 }] };
    const rules: RoutingRule[] = [
      { id: "low", name: "x", scopeType: "global", scopeRef: null, priority: 50, condition: always, targetBook: "b_book", targetLpId: null, enabled: true },
      { id: "high", name: "y", scopeType: "global", scopeRef: null, priority: 5, condition: always, targetBook: "a_book", targetLpId: null, enabled: true },
    ];
    expect(routeOrder(ctx(), eff({ book: "hybrid" }), risk(10), rules).matchedRuleId).toBe("high");
  });

  it("disabled rules are skipped", () => {
    const rules: RoutingRule[] = [{ id: "r", name: "x", scopeType: "global", scopeRef: null, priority: 1, condition: { all: [{ field: "volume_lots", op: ">=", value: 0 }] }, targetBook: "a_book", targetLpId: null, enabled: false }];
    expect(routeOrder(ctx(), eff({ book: "hybrid" }), risk(10), rules).matchedRuleId).toBeNull();
  });

  it("every decision carries a ruleSnapshot", () => expect(routeOrder(ctx(), eff({ book: "a_book" }), null, []).ruleSnapshot).toBeTruthy());
});
