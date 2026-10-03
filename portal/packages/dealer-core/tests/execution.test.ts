import { describe, it, expect } from "vitest";
import { ConfigCache, handleIncomingOrder } from "../src";
import type { BridgeOrderEvent, ExecutionDeps, OrderContext, RoutingDecision, BookConfigRow } from "../src";

const baseCtx = (symbol = "EURUSD"): OrderContext => ({
  accountId: "a", accountType: "vip", clientGroup: "c", tradingGroup: "g", whiteLabel: "w",
  country: "IN", symbol, assetClass: "forex", volumeLots: 1,
});
function deps(over: Partial<ExecutionDeps>): ExecutionDeps {
  return {
    buildContext: (raw) => baseCtx(raw.symbol),
    configCache: new ConfigCache([]),
    getRisk: () => null,
    getRules: () => [],
    pickLP: () => ({ id: "lp1", endpointRef: "ep1" }),
    persistDecision: async () => {},
    enqueueIntervention: async () => {},
    onInternalFill: () => {},
    onHedgeEval: () => {},
    ...over,
  };
}
const order: BridgeOrderEvent = { orderRef: "o1", accountId: "a", symbol: "EURUSD", side: "buy", volumeLots: 1, ts: "t" };
const row = (p: Partial<BookConfigRow>): BookConfigRow => ({
  id: "g", scopeType: "global", scopeRef: null, book: "b_book", dealingMode: "full_stp", executionModel: "market",
  volumeThresholdLots: null, profitThresholdUsd: null, maxSlippagePoints: 30, maxDeviationPoints: 50,
  orderTimeoutMs: 3000, requiresDealer: false, enabled: true, priority: 100, ...p,
});

describe("execution router", () => {
  it("b_book default → internalize + persists + hedge eval", async () => {
    let persisted: RoutingDecision | null = null, hedged = false, filled = false;
    const r = await handleIncomingOrder(order, deps({
      persistDecision: async (d) => { persisted = d; },
      onHedgeEval: () => { hedged = true; },
      onInternalFill: () => { filled = true; },
    }));
    expect(r.instruction.kind).toBe("internalize");
    expect(persisted).not.toBeNull();
    expect(hedged).toBe(true);
    expect(filled).toBe(true);
  });

  it("a_book → route_to_lp with endpoint", async () => {
    const r = await handleIncomingOrder(order, deps({ configCache: new ConfigCache([row({ book: "a_book", executionModel: "stp" })]) }));
    expect(r.instruction.kind).toBe("route_to_lp");
    if (r.instruction.kind === "route_to_lp") expect(r.instruction.lpRef).toBe("ep1");
  });

  it("needsDealer → hold + enqueues", async () => {
    let enq = false;
    const r = await handleIncomingOrder(order, deps({
      configCache: new ConfigCache([row({ dealingMode: "full_dealer" })]),
      enqueueIntervention: async () => { enq = true; },
    }));
    expect(r.instruction.kind).toBe("hold");
    expect(enq).toBe(true);
  });
});
