import { describe, it, expect } from "vitest";
import { ConfigCache, resolveConfig } from "../src";
import type { BookConfigRow } from "../src";
import type { OrderContext } from "../src";

function cfg(p: Partial<BookConfigRow>): BookConfigRow {
  return {
    id: p.id ?? "x", scopeType: p.scopeType ?? "global", scopeRef: p.scopeRef ?? null,
    book: p.book ?? "b_book", dealingMode: p.dealingMode ?? "full_stp", executionModel: p.executionModel ?? "market",
    volumeThresholdLots: p.volumeThresholdLots ?? null, profitThresholdUsd: p.profitThresholdUsd ?? null,
    maxSlippagePoints: p.maxSlippagePoints ?? 30, maxDeviationPoints: p.maxDeviationPoints ?? 50,
    orderTimeoutMs: p.orderTimeoutMs ?? 3000, requiresDealer: p.requiresDealer ?? false,
    enabled: p.enabled ?? true, priority: p.priority ?? 100,
  };
}
const ctx: OrderContext = {
  accountId: "acc1", accountType: "vip", clientGroup: "cg1", tradingGroup: "g1",
  whiteLabel: "wl1", country: "IN", symbol: "EURUSD", assetClass: "forex", volumeLots: 1,
};

describe("scope resolver", () => {
  it("most-specific wins (account > symbol > global)", () => {
    const cache = new ConfigCache([
      cfg({ id: "g", scopeType: "global", book: "b_book" }),
      cfg({ id: "s", scopeType: "symbol", scopeRef: "EURUSD", book: "a_book" }),
      cfg({ id: "a", scopeType: "account", scopeRef: "acc1", book: "hybrid" }),
    ]);
    const r = resolveConfig(ctx, cache);
    expect(r.book).toBe("hybrid");
    expect(r.resolvedFrom.book.scopeType).toBe("account");
    expect(r.resolvedFrom.book.configId).toBe("a");
  });

  it("symbol wins when no account row", () => {
    const cache = new ConfigCache([
      cfg({ id: "g", scopeType: "global", book: "b_book" }),
      cfg({ id: "s", scopeType: "symbol", scopeRef: "EURUSD", book: "a_book" }),
    ]);
    expect(resolveConfig(ctx, cache).book).toBe("a_book");
  });

  it("nullable threshold inherits from a less-specific row", () => {
    const cache = new ConfigCache([
      cfg({ id: "a", scopeType: "account", scopeRef: "acc1", book: "hybrid", volumeThresholdLots: null }),
      cfg({ id: "tg", scopeType: "trading_group", scopeRef: "g1", volumeThresholdLots: 5 }),
    ]);
    const r = resolveConfig(ctx, cache);
    expect(r.book).toBe("hybrid");
    expect(r.volumeThresholdLots).toBe(5);
    expect(r.resolvedFrom.volumeThresholdLots.scopeType).toBe("trading_group");
  });

  it("engine default when cache empty", () => {
    const r = resolveConfig(ctx, new ConfigCache([]));
    expect(r.book).toBe("b_book");
    expect(r.resolvedFrom.book.configId).toBe("engine-default");
  });

  it("disabled rows are ignored", () => {
    const cache = new ConfigCache([
      cfg({ id: "a", scopeType: "account", scopeRef: "acc1", book: "a_book", enabled: false }),
      cfg({ id: "g", scopeType: "global", book: "b_book" }),
    ]);
    expect(resolveConfig(ctx, cache).book).toBe("b_book");
  });

  it("lower priority number wins within a scope", () => {
    const cache = new ConfigCache([
      cfg({ id: "hi", scopeType: "symbol", scopeRef: "EURUSD", book: "a_book", priority: 200 }),
      cfg({ id: "lo", scopeType: "symbol", scopeRef: "EURUSD", book: "hybrid", priority: 10 }),
    ]);
    expect(resolveConfig(ctx, cache).resolvedFrom.book.configId).toBe("lo");
  });

  it("fields can resolve from different scopes (book=account, slippage=global)", () => {
    const cache = new ConfigCache([
      cfg({ id: "a", scopeType: "account", scopeRef: "acc1", book: "hybrid", maxSlippagePoints: 30 }),
      cfg({ id: "g", scopeType: "global", book: "b_book", maxSlippagePoints: 99 }),
    ]);
    const r = resolveConfig(ctx, cache);
    expect(r.resolvedFrom.book.scopeType).toBe("account");
    // maxSlippage is non-nullable so the most-specific row (account=30) still wins here
    expect(r.maxSlippagePoints).toBe(30);
  });
});
