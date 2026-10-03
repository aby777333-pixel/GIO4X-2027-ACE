import type { ScopeContext } from "@gio4x/scope-engine";
import type { ClientSegment, BehaviourTag } from "./enums";

// Per-order/per-account pricing context (satisfies the shared ScopeContext).
export interface PricingContext extends ScopeContext {
  segment?: ClientSegment;
  behaviour?: BehaviourTag;
  volumeLots?: number;
}

// Market conditions supplied by the worker (never read from DB on the hot path).
export interface MarketState {
  volatility?: number;
  session?: string;
  liquidity?: number;
  feedAgeMs?: number;
  netExposureLots?: number; // from DEALER-CORE BrokerRiskState
  activeWidenTriggers?: string[]; // e.g. ['nfp','market_open']
}

export interface RawTick {
  symbol: string;
  bid: number;
  ask: number;
  ts: string;
  lpId?: string | null;
}

// Every breakdown value is in PRICE units. INTERNAL ONLY.
export interface BreakdownItem { label: string; valuePrice: number }
export interface SpreadResult { effectiveSpread: number; breakdown: BreakdownItem[] }
export interface MarkupResult { buyMarkup: number; sellMarkup: number; breakdown: BreakdownItem[] }

// ── BLACK GLASS ─────────────────────────────────────────────────────────────
// The ONLY shape that may ever reach a client channel. Exactly these four fields.
// Nothing here can carry raw price, breakdowns, or revenue.
export interface ClientTick {
  symbol: string;
  bid: number;
  ask: number;
  ts: string;
}

// Internal — full reconstruction. Must NEVER be serialized to a client channel.
export interface InternalTick {
  symbol: string;
  ts: string;
  lpId?: string | null;
  raw: { bid: number; ask: number };
  broker: { bid: number; ask: number };
  final: { bid: number; ask: number };
  spread: SpreadResult;
  markup: MarkupResult;
  revenuePerLot: number;
  stale: boolean;
}
