import { describe, it, expect } from "vitest";
import { aggregateExposure, decomposeSymbol, getBreaches } from "../src";
import type { Position } from "../src";

function pos(p: Partial<Position>): Position {
  return {
    ticket: p.ticket ?? 1, accountId: p.accountId ?? "a", symbol: p.symbol ?? "EURUSD", side: p.side ?? "buy",
    volumeLots: p.volumeLots ?? 1, openPrice: p.openPrice ?? 1, currentPrice: p.currentPrice, book: p.book ?? "b_book",
    lpId: null, floatingPnl: 0, openedAt: undefined,
  };
}

describe("exposure", () => {
  it("decomposes forex", () => expect(decomposeSymbol("EURUSD")).toEqual({ base: "EUR", quote: "USD" }));
  it("decomposes a cross", () => expect(decomposeSymbol("EURGBP")).toEqual({ base: "EUR", quote: "GBP" }));
  it("decomposes a metal", () => expect(decomposeSymbol("XAUUSD")).toEqual({ base: "XAU", quote: "USD" }));
  it("falls back unknown to USD quote", () => expect(decomposeSymbol("US30")).toEqual({ base: "US", quote: "USD" }));

  it("net/gross per symbol", () => {
    const rows = aggregateExposure([pos({ side: "buy", volumeLots: 3 }), pos({ ticket: 2, side: "sell", volumeLots: 1 })]);
    const sym = rows.find((r) => r.dimension === "symbol" && r.ref === "EURUSD")!;
    expect(sym.long).toBe(3);
    expect(sym.short).toBe(1);
    expect(sym.net).toBe(2);
    expect(sym.gross).toBe(4);
  });

  it("currency legs: long EURUSD ⇒ long EUR, short USD", () => {
    const rows = aggregateExposure([pos({ side: "buy", volumeLots: 75 })]);
    expect(rows.find((r) => r.dimension === "currency" && r.ref === "EUR")!.net).toBe(75);
    expect(rows.find((r) => r.dimension === "currency" && r.ref === "USD")!.net).toBe(-75);
  });

  it("detects a net breach", () => {
    const rows = aggregateExposure([pos({ side: "buy", volumeLots: 10 })]);
    expect(getBreaches(rows, [{ dimension: "symbol", ref: "EURUSD", maxNetLots: 5 }]).length).toBe(1);
    expect(getBreaches(rows, [{ dimension: "symbol", ref: "EURUSD", maxNetLots: 50 }]).length).toBe(0);
  });
});
