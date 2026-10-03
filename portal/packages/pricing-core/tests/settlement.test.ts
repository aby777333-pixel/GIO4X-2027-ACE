import { describe, it, expect } from "vitest";
import { computeCommission, computeSwap, computeExtraction, pricingRevenueRows } from "../src";
import type { PricingContext, CommissionConfigRow, SwapConfigRow, ExtractionModelRow } from "../src";

const ctx = (o?: Partial<PricingContext>): PricingContext => ({
  accountId: "a", accountType: "vip", clientGroup: "c", tradingGroup: "g", whiteLabel: "w",
  country: "IN", symbol: "EURUSD", assetClass: "forex", ...o,
});
const cc = (p: Partial<CommissionConfigRow>): CommissionConfigRow => ({
  id: "g", scopeType: "global", scopeRef: null, model: p.model ?? "per_lot", value: p.value ?? 0,
  perSide: p.perSide ?? true, currency: "USD", enabled: true, priority: 100,
});

describe("settlement engines", () => {
  it("per_lot commission", () => expect(computeCommission(ctx(), [cc({ model: "per_lot", value: 7 })], 2, 200000).amountUsd).toBe(14));
  it("percentage commission", () => expect(computeCommission(ctx(), [cc({ model: "percentage", value: 0.01 })], 1, 100000).amountUsd).toBeCloseTo(10, 6));

  it("swap triple-day multiplier", () => {
    const row: SwapConfigRow = { id: "s", scopeType: "symbol", scopeRef: "EURUSD", longRate: -2, shortRate: 1, tripleDay: 3, dynamic: false, unit: "points", enabled: true };
    expect(computeSwap("long", row, 1, 3)).toBe(-6);
    expect(computeSwap("long", row, 1, 1)).toBe(-2);
  });

  it("extraction: per-lot + notional bps", () => {
    const models: ExtractionModelRow[] = [{ id: "e", name: "x", scopeType: "global", scopeRef: null, perLotUsd: 0.05, notionalBps: 1, enabled: true }];
    expect(computeExtraction(models, ctx(), 2, 100000)).toBeCloseTo(0.1 + 10, 6);
  });

  it("revenue rows target the shared ledger shape, skipping zeros", () => {
    const rows = pricingRevenueRows({ accountId: "a", symbol: "EURUSD", spreadMarkupUsd: 5, commissionUsd: 3, swapUsd: 0, extractionUsd: 1 });
    expect(rows.map((r) => r.source)).toEqual(["spread_markup", "commission", "extraction"]);
    expect(rows[0].amountUsd).toBe(5);
  });
});
