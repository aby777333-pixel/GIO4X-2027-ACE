import { z } from "zod";
import {
  BOOK_TYPES, DEALING_MODES, EXECUTION_MODELS, SCOPE_PRECEDENCE,
} from "./enums";

// ── Order context (what the bridge hands us per incoming order) ──────────────
export const OrderContextSchema = z.object({
  accountId: z.string(),
  accountType: z.string(),
  clientGroup: z.string(),
  tradingGroup: z.string(),
  whiteLabel: z.string(),
  country: z.string(), // ISO-3166
  symbol: z.string(),
  assetClass: z.string(),
  volumeLots: z.number().nonnegative(),
});
export type OrderContext = z.infer<typeof OrderContextSchema>;

// ── Resolved config (output of the scope resolver) ──────────────────────────
export const ResolvedFromSchema = z.object({
  scopeType: z.enum(SCOPE_PRECEDENCE),
  scopeRef: z.string().nullable(),
  configId: z.string(),
});
export const EffectiveConfigSchema = z.object({
  book: z.enum(BOOK_TYPES),
  dealingMode: z.enum(DEALING_MODES),
  executionModel: z.enum(EXECUTION_MODELS),
  requiresDealer: z.boolean(),
  maxSlippagePoints: z.number().int(),
  maxDeviationPoints: z.number().int(),
  orderTimeoutMs: z.number().int(),
  volumeThresholdLots: z.number().nullable(),
  profitThresholdUsd: z.number().nullable(),
  // Per-field provenance, for audit: which scope row set each field.
  resolvedFrom: z.record(z.string(), ResolvedFromSchema),
});
export type EffectiveConfig = z.infer<typeof EffectiveConfigSchema>;

// ── Routing rule conditions (validated on write) ────────────────────────────
export const CONDITION_FIELDS = [
  "risk_score", "profit_factor", "win_rate", "account_age_days",
  "equity", "strategy_tag", "country", "lifetime_pnl", "volume_lots",
] as const;
export const CONDITION_OPS = [">", ">=", "<", "<=", "==", "!=", "in", "contains"] as const;

export const PredicateSchema = z.object({
  field: z.enum(CONDITION_FIELDS),
  op: z.enum(CONDITION_OPS),
  value: z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]),
});
export type Predicate = z.infer<typeof PredicateSchema>;

export type ConditionNode = Predicate | { all: ConditionNode[] } | { any: ConditionNode[] };
export const ConditionSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    PredicateSchema,
    z.object({ all: z.array(ConditionSchema) }),
    z.object({ any: z.array(ConditionSchema) }),
  ]),
);

export const RoutingRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  scopeType: z.enum(SCOPE_PRECEDENCE),
  scopeRef: z.string().nullable(),
  priority: z.number().int(),
  condition: ConditionSchema,
  targetBook: z.enum(BOOK_TYPES),
  targetLpId: z.string().nullable(),
  enabled: z.boolean(),
});
export type RoutingRule = z.infer<typeof RoutingRuleSchema>;

// ── Routing decision (immutable, logged with its rule snapshot) ─────────────
export const RoutingDecisionSchema = z.object({
  book: z.enum(BOOK_TYPES),
  lpId: z.string().nullable(),
  executionModel: z.enum(EXECUTION_MODELS),
  needsDealer: z.boolean(),
  matchedRuleId: z.string().nullable(),
  ruleSnapshot: z.unknown(),
  flags: z.array(z.string()),
});
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

// ── Client risk score ───────────────────────────────────────────────────────
export const ClientRiskScoreSchema = z.object({
  accountId: z.string(),
  winRate: z.number().nullable(),
  profitFactor: z.number().nullable(),
  maxDrawdown: z.number().nullable(),
  avgHoldSecs: z.number().nullable(),
  strategyTag: z.string().nullable(),
  lifetimePnl: z.number().nullable(),
  riskScore: z.number().int(),
  toxic: z.boolean(),
});
export type ClientRiskScore = z.infer<typeof ClientRiskScoreSchema>;
