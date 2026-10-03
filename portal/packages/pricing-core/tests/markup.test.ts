import { describe, it, expect } from "vitest";
import { PricingCache, resolveMarkup } from "../src";
import type { PricingContext, MarkupLayerRow, EngineSettings } from "../src";

const ctx = (o?: Partial<PricingContext>): PricingContext => ({
  accountId: "a", accountType: "vip", clientGroup: "c", tradingGroup: "g", whiteLabel: "w",
  country: "IN", symbol: "EURUSD", assetClass: "forex", ...o,
});
const ly = (p: Partial<MarkupLayerRow>): MarkupLayerRow => ({
  id: p.id ?? "x", layer: p.layer ?? "global", scopeRef: p.scopeRef ?? null, side: p.side ?? "dual",
  value: p.value ?? 1, unit: p.unit ?? "pips", pctOfVolume: p.pctOfVolume ?? null, pctOfClients: p.pctOfClients ?? null,
  appliesRegions: p.appliesRegions ?? [], stackOrder: p.stackOrder ?? 100, enabled: p.enabled ?? true,
});
const ENGINE: EngineSettings = { maxTotalMarkupPips: 5, maxTotalSpreadPips: 50, staleFeedAction: "widen", staleFeedMs: 1500 };

describe("markup engine (stacking)", () => {
  it("stacks additive across layers (dual → both sides)", () => {
    const c = new PricingCache({ markupLayers: [ly({ id: "g", value: 1 }), ly({ id: "s", layer: "symbol", scopeRef: "EURUSD", value: 0.5 })] });
    const r = resolveMarkup(ctx(), c, 1.1);
    expect(r.buyMarkup).toBeCloseTo(0.00015, 10);
    expect(r.sellMarkup).toBeCloseTo(0.00015, 10);
  });
  it("buy side hits only buy", () => {
    const r = resolveMarkup(ctx(), new PricingCache({ markupLayers: [ly({ value: 2, side: "buy" })] }), 1.1);
    expect(r.buyMarkup).toBeCloseTo(0.0002, 10);
    expect(r.sellMarkup).toBe(0);
  });
  it("partial volume scales the layer", () => {
    expect(resolveMarkup(ctx(), new PricingCache({ markupLayers: [ly({ value: 2, side: "buy", pctOfVolume: 50 })] }), 1.1).buyMarkup).toBeCloseTo(0.0001, 10);
  });
  it("hard cap clamps a runaway layer", () => {
    const c = new PricingCache({ markupLayers: [ly({ value: 100, side: "buy" })], engine: ENGINE });
    expect(resolveMarkup(ctx(), c, 1.1).buyMarkup).toBeCloseTo(0.0005, 10);
  });
  it("JPY pip sizing applies", () => {
    const c = new PricingCache({ markupLayers: [ly({ value: 2, side: "buy" })] });
    expect(resolveMarkup(ctx({ symbol: "USDJPY", assetClass: "forex" }), c, 150).buyMarkup).toBeCloseTo(0.02, 10);
  });
});
