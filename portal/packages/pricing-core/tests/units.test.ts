import { describe, it, expect } from "vitest";
import { pipSize, toPrice, priceToPips } from "../src";

describe("units / pip normalization", () => {
  it("fx pip = 0.0001", () => expect(pipSize("forex", "EURUSD")).toBe(0.0001));
  it("JPY pip = 0.01", () => expect(pipSize("forex", "USDJPY")).toBe(0.01));
  it("metal pip = 0.01", () => expect(pipSize("metal", "XAUUSD")).toBe(0.01));
  it("index pip = 1", () => expect(pipSize("index", "US30")).toBe(1));
  it("crypto pip = 1", () => expect(pipSize("crypto", "BTCUSD")).toBe(1));

  it("pips → price", () => expect(toPrice(2, "pips", "forex", "EURUSD", 1.1)).toBeCloseTo(0.0002, 10));
  it("points → price (1 pip = 10 points)", () => expect(toPrice(20, "points", "forex", "EURUSD", 1.1)).toBeCloseTo(0.0002, 10));
  it("percent → price", () => expect(toPrice(1, "percent", "crypto", "BTCUSD", 60000)).toBe(600));
  it("absolute → price", () => expect(toPrice(0.5, "absolute", "forex", "EURUSD", 1.1)).toBe(0.5));
  it("pips round-trip", () => expect(priceToPips(toPrice(3, "pips", "forex", "EURUSD", 1.1), "forex", "EURUSD")).toBeCloseTo(3, 10));
});
