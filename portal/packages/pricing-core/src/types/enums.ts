// PRICING-CORE enums — mirror the Postgres enums in schema `pricing`.

export const SPREAD_MODES = ["fixed", "dynamic"] as const;
export type SpreadMode = (typeof SPREAD_MODES)[number];

export const MARKUP_SIDES = ["buy", "sell", "dual"] as const;
export type MarkupSide = (typeof MARKUP_SIDES)[number];

export const MARKUP_UNITS = ["pips", "points", "percent", "absolute"] as const;
export type MarkupUnit = (typeof MARKUP_UNITS)[number];

export const COMMISSION_MODELS = ["fixed", "per_lot", "percentage", "volume_based"] as const;
export type CommissionModel = (typeof COMMISSION_MODELS)[number];

export const LP_PRICE_ROUTINGS = ["best_price", "weighted", "revenue_optimized", "risk_optimized", "latency_optimized"] as const;
export type LpPriceRouting = (typeof LP_PRICE_ROUTINGS)[number];

export const CLIENT_SEGMENTS = ["retail", "professional", "institutional", "vip", "high_value"] as const;
export type ClientSegment = (typeof CLIENT_SEGMENTS)[number];

export const BEHAVIOUR_TAGS = ["scalper", "swing", "position", "news", "arbitrage", "ea", "manual"] as const;
export type BehaviourTag = (typeof BEHAVIOUR_TAGS)[number];
