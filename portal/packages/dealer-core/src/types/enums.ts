// DEALER-CORE enums — mirror the Postgres enums in schema `dealer` (single source
// of truth). Keep these arrays in lockstep with the migration.

export const BOOK_TYPES = ["a_book", "b_book", "hybrid"] as const;
export type BookType = (typeof BOOK_TYPES)[number];

export const DEALING_MODES = ["semi_auto", "full_dealer", "full_stp", "ecn", "dma"] as const;
export type DealingMode = (typeof DEALING_MODES)[number];

export const EXECUTION_MODELS = ["market", "instant", "stp", "ecn", "dma", "dealer"] as const;
export type ExecutionModel = (typeof EXECUTION_MODELS)[number];

// Scope cascade is shared with PRICING-CORE — re-exported from @gio4x/scope-engine
// so existing `@gio4x/dealer-core` imports of SCOPE_PRECEDENCE/ScopeType keep working.
export { SCOPE_PRECEDENCE, type ScopeType } from "@gio4x/scope-engine";

export const INTERVENTION_ACTIONS = ["accept", "reject", "delay", "requote", "approve", "force_route"] as const;
export type InterventionAction = (typeof INTERVENTION_ACTIONS)[number];

export const SURVEILLANCE_TYPES = [
  "arbitrage", "latency_abuse", "bonus_abuse", "scalping_abuse",
  "news_trading_abuse", "copy_trading_abuse", "wash_trading", "self_trading",
] as const;
export type SurveillanceType = (typeof SURVEILLANCE_TYPES)[number];

export const HEDGE_TYPES = ["full", "partial", "dynamic", "emergency"] as const;
export type HedgeType = (typeof HEDGE_TYPES)[number];

export const HEDGE_METHODS = ["lp", "internal", "cross_symbol", "portfolio"] as const;
export type HedgeMethod = (typeof HEDGE_METHODS)[number];

export const FLAG_STATUSES = ["open", "reviewing", "actioned", "dismissed"] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

export const LP_STATUSES = ["active", "degraded", "offline", "disabled"] as const;
export type LpStatus = (typeof LP_STATUSES)[number];
