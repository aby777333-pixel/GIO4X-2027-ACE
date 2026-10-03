import { describe, it, expect } from "vitest";
import { pickLP, pickLPSplit, eligibleLPs } from "../src";
import type { LpRow } from "../src";

function lp(p: Partial<LpRow>): LpRow {
  return {
    id: p.id ?? "l", name: p.name ?? "LP", status: p.status ?? "active", isPrimary: p.isPrimary ?? false,
    priority: p.priority ?? 100, routingPct: p.routingPct ?? 100, symbols: p.symbols ?? [],
    endpointRef: p.endpointRef ?? null, avgFillMs: p.avgFillMs ?? null, rejectRate: p.rejectRate ?? 0,
  };
}

describe("LP selection", () => {
  it("skips offline/disabled (failover)", () => {
    const lps = [lp({ id: "a", status: "offline", isPrimary: true }), lp({ id: "b", status: "active", priority: 50 })];
    expect(pickLP(lps, "EURUSD")?.id).toBe("b");
  });
  it("prefers primary", () => expect(pickLP([lp({ id: "a", priority: 10 }), lp({ id: "b", isPrimary: true, priority: 99 })], "EURUSD")?.id).toBe("b"));
  it("honours preferred if eligible", () => expect(pickLP([lp({ id: "a" }), lp({ id: "b" })], "EURUSD", "b")?.id).toBe("b"));
  it("falls back when preferred is offline", () => expect(pickLP([lp({ id: "a", status: "active" }), lp({ id: "b", status: "offline" })], "EURUSD", "b")?.id).toBe("a"));
  it("respects symbol allow-list", () => expect(eligibleLPs([lp({ id: "a", symbols: ["GBPUSD"] })], "EURUSD").length).toBe(0));
  it("returns null when none eligible", () => expect(pickLP([lp({ status: "offline" })], "EURUSD")).toBeNull());
  it("tie-break by reject rate then fill latency", () => {
    const lps = [lp({ id: "a", priority: 10, rejectRate: 0.2 }), lp({ id: "b", priority: 10, rejectRate: 0.01 })];
    expect(pickLP(lps, "EURUSD")?.id).toBe("b");
  });
  it("percentage split is deterministic", () => {
    const lps = [lp({ id: "a", routingPct: 30, priority: 1 }), lp({ id: "b", routingPct: 70, priority: 2 })];
    expect(pickLPSplit(lps, "EURUSD", 10)?.id).toBe("a");
    expect(pickLPSplit(lps, "EURUSD", 50)?.id).toBe("b");
  });
});
