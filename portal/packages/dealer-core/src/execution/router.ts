import type { BridgeOrderEvent, ExecutionInstruction } from "../bridge/TradeServerBridge";
import { ExecutionInstruction as EI } from "../bridge/TradeServerBridge";
import type { OrderContext, RoutingDecision, RoutingRule, ClientRiskScore } from "../types/schemas";
import type { ConfigCache } from "../scope/ConfigCache";
import { resolveConfig } from "../scope/resolve";
import { routeOrder } from "../routing/route";

// Dependencies injected so the orchestrator stays pure/testable (no DB/network here).
export interface ExecutionDeps {
  buildContext(raw: BridgeOrderEvent): OrderContext;
  configCache: ConfigCache;
  getRisk(accountId: string): ClientRiskScore | null;
  getRules(ctx: OrderContext): RoutingRule[];
  pickLP(lpId: string | null, symbol: string): { id: string; endpointRef: string } | null;
  persistDecision(decision: RoutingDecision, ctx: OrderContext): Promise<void>;
  enqueueIntervention(ctx: OrderContext, decision: RoutingDecision): Promise<void>;
  onInternalFill(ctx: OrderContext, decision: RoutingDecision): void;
  onHedgeEval(symbol: string): void;
  surveillanceInspect?(ctx: OrderContext, decision: RoutingDecision): void;
}

export interface RouterOutcome {
  instruction: ExecutionInstruction;
  decision: RoutingDecision;
  ctx: OrderContext;
}

// The hot-path entry point. Mirrors §4.8 of the directive.
export async function handleIncomingOrder(raw: BridgeOrderEvent, deps: ExecutionDeps): Promise<RouterOutcome> {
  const ctx = deps.buildContext(raw);
  const cfg = resolveConfig(ctx, deps.configCache);
  const risk = deps.getRisk(ctx.accountId);
  const decision = routeOrder(ctx, cfg, risk, deps.getRules(ctx));

  await deps.persistDecision(decision, ctx); // immutable log + ruleSnapshot
  deps.surveillanceInspect?.(ctx, decision); // async, non-blocking by contract

  if (decision.needsDealer) {
    await deps.enqueueIntervention(ctx, decision);
    return { instruction: EI.HOLD, decision, ctx };
  }

  if (decision.book === "a_book") {
    const lp = deps.pickLP(decision.lpId, ctx.symbol);
    return { instruction: EI.routeToLP(lp?.endpointRef ?? "", decision), decision, ctx };
  }

  // b_book
  deps.onInternalFill(ctx, decision);
  deps.onHedgeEval(ctx.symbol);
  return { instruction: EI.internalize(decision), decision, ctx };
}
