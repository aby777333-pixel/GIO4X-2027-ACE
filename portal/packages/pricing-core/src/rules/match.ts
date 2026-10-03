import { scopeRefFor, type ScopeType } from "@gio4x/scope-engine";
import type { PricingContext } from "../types/schemas";

// A scoped rule applies if its scopeRef is null (broad) or equals this ctx's ref
// for that scope level.
export function scopeMatches(ctx: PricingContext, scopeType: ScopeType, scopeRef: string | null): boolean {
  if (scopeRef == null) return true;
  return scopeRefFor(ctx, scopeType) === scopeRef;
}

// Deterministic client bucketing for pct_of_clients partial application: hash the
// account id to 0..99 and apply when the bucket falls under the percentage.
export function clientInBucket(accountId: string, pct: number): boolean {
  let h = 0;
  for (let i = 0; i < accountId.length; i++) h = (h * 31 + accountId.charCodeAt(i)) % 100;
  return h < pct;
}
