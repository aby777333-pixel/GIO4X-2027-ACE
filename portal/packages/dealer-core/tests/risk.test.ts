import { describe, it, expect } from "vitest";
import { RuleClassifier, computeRiskScore, isToxic } from "../src";

describe("risk engine", () => {
  it("classifies arb", () => expect(RuleClassifier.classify({ subSecondRoundTrips: true })).toBe("arb"));
  it("classifies scalper", () => expect(RuleClassifier.classify({ avgHoldSecs: 30, tradesPerDay: 20 })).toBe("scalper"));
  it("classifies martingale", () => expect(RuleClassifier.classify({ escalatingLots: true })).toBe("martingale"));
  it("classifies news", () => expect(RuleClassifier.classify({ clusteredAroundNews: true })).toBe("news"));
  it("defaults to swing", () => expect(RuleClassifier.classify({ avgHoldSecs: 5000 })).toBe("swing"));

  it("high win-rate arb is toxic (≥70)", () => {
    const s = computeRiskScore({ winRate: 0.85, profitFactor: 2.5, lifetimePnl: 5000 }, "arb");
    expect(s).toBeGreaterThanOrEqual(70);
    expect(isToxic(s)).toBe(true);
  });
  it("losing martingale is not toxic", () => {
    expect(isToxic(computeRiskScore({ winRate: 0.35, lifetimePnl: -2000 }, "martingale"))).toBe(false);
  });
  it("clamps to 0..100", () => {
    expect(computeRiskScore({ winRate: 1, profitFactor: 10, lifetimePnl: 100000 }, "arb")).toBeLessThanOrEqual(100);
    expect(computeRiskScore({ winRate: 0, profitFactor: 0, lifetimePnl: -99999 }, "martingale")).toBeGreaterThanOrEqual(0);
  });
});
