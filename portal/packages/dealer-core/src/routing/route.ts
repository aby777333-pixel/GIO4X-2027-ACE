import type { BookType } from "../types/enums";
import type {
  OrderContext, EffectiveConfig, RoutingDecision, RoutingRule, ClientRiskScore, ConditionNode, Predicate,
} from "../types/schemas";

function needsDealer(cfg: EffectiveConfig): boolean {
  return cfg.requiresDealer || cfg.dealingMode === "semi_auto" || cfg.dealingMode === "full_dealer";
}

type Facts = Record<string, number | string | undefined>;
function buildFacts(ctx: OrderContext, risk: ClientRiskScore | null): Facts {
  return {
    risk_score: risk?.riskScore,
    profit_factor: risk?.profitFactor ?? undefined,
    win_rate: risk?.winRate ?? undefined,
    lifetime_pnl: risk?.lifetimePnl ?? undefined,
    strategy_tag: risk?.strategyTag ?? undefined,
    country: ctx.country,
    volume_lots: ctx.volumeLots,
  };
}

function cmp(a: unknown, op: string, b: unknown): boolean {
  switch (op) {
    case ">": return (a as number) > (b as number);
    case ">=": return (a as number) >= (b as number);
    case "<": return (a as number) < (b as number);
    case "<=": return (a as number) <= (b as number);
    case "==": return a === b;
    case "!=": return a !== b;
    case "in": return Array.isArray(b) && (b as unknown[]).includes(a);
    case "contains": return Array.isArray(a) ? (a as unknown[]).includes(b) : typeof a === "string" ? a.includes(String(b)) : false;
    default: return false;
  }
}

export function evalCondition(node: ConditionNode, facts: Facts): boolean {
  if ("all" in node) return node.all.every((n) => evalCondition(n, facts));
  if ("any" in node) return node.any.some((n) => evalCondition(n, facts));
  const p = node as Predicate;
  const fact = facts[p.field];
  if (fact === undefined) return false;
  return cmp(fact, p.op, p.value);
}

function mk(book: BookType, lpId: string | null, executionModel: EffectiveConfig["executionModel"], nd: boolean, matchedRuleId: string | null, ruleSnapshot: unknown, flags: string[]): RoutingDecision {
  return { book, lpId: lpId ?? null, executionModel, needsDealer: nd, matchedRuleId: matchedRuleId ?? null, ruleSnapshot, flags };
}

// The book routing decision. Always returns its immutable ruleSnapshot.
export function routeOrder(ctx: OrderContext, cfg: EffectiveConfig, risk: ClientRiskScore | null, rules: RoutingRule[]): RoutingDecision {
  const flags: string[] = [];
  const nd = needsDealer(cfg);

  // 1. Threshold flip — volume above the configured cap forces A-book (anti-toxic).
  if (cfg.volumeThresholdLots != null && ctx.volumeLots >= cfg.volumeThresholdLots) {
    flags.push("volume_threshold_force_a_book");
    return mk("a_book", null, cfg.executionModel, nd, null, { reason: "volume_threshold", threshold: cfg.volumeThresholdLots, volume: ctx.volumeLots }, flags);
  }

  // 2. Fixed book wins outright.
  if (cfg.book !== "hybrid") {
    return mk(cfg.book, null, cfg.executionModel, nd, null, { reason: "scope_config", book: cfg.book, from: cfg.resolvedFrom.book }, flags);
  }

  // 3. Hybrid — first matching rule (priority ascending) wins.
  const facts = buildFacts(ctx, risk);
  const sorted = rules.filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);
  for (const r of sorted) {
    if (evalCondition(r.condition, facts)) {
      return mk(r.targetBook, r.targetLpId, cfg.executionModel, nd, r.id, { rule: r.name, priority: r.priority, condition: r.condition, targetBook: r.targetBook }, flags);
    }
  }

  // 4. Fallthrough — prefer an explicit catch-all rule above; this is the safety net.
  const toxic = risk ? risk.toxic || risk.riskScore >= 70 : false;
  flags.push(toxic ? "fallthrough_toxic_a_book" : "fallthrough_b_book");
  return mk(toxic ? "a_book" : "b_book", null, cfg.executionModel, nd, null, { reason: "hybrid_fallthrough", toxic, riskScore: risk?.riskScore ?? null }, flags);
}
