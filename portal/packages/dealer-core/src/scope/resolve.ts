import { resolveFields, type FieldSpec } from "@gio4x/scope-engine";
import type { OrderContext, EffectiveConfig } from "../types/schemas";
import type { BookConfigRow } from "../types/rows";
import type { ConfigCache } from "./ConfigCache";

// scopeRefFor moved to @gio4x/scope-engine; re-exported for back-compat.
export { scopeRefFor } from "@gio4x/scope-engine";

// Field cascade: non-nullable fields take the most-specific enabled row + the
// engine default if none; the two threshold fields are nullable (inherit on null).
const FIELDS: FieldSpec[] = [
  { field: "book", default: "b_book" },
  { field: "dealingMode", default: "full_stp" },
  { field: "executionModel", default: "market" },
  { field: "volumeThresholdLots", nullable: true, default: null },
  { field: "profitThresholdUsd", nullable: true, default: null },
  { field: "maxSlippagePoints", default: 30 },
  { field: "maxDeviationPoints", default: 50 },
  { field: "orderTimeoutMs", default: 3000 },
  { field: "requiresDealer", default: false },
];

// PURE + synchronous. Reads only the in-memory cache; delegates the cascade to the
// shared scope-engine.
export function resolveConfig(ctx: OrderContext, cache: ConfigCache): EffectiveConfig {
  const { values, resolvedFrom } = resolveFields<BookConfigRow>(
    ctx,
    (st, ref) => cache.get(st, ref),
    (r) => r.id,
    FIELDS,
  );
  return {
    book: values.book as EffectiveConfig["book"],
    dealingMode: values.dealingMode as EffectiveConfig["dealingMode"],
    executionModel: values.executionModel as EffectiveConfig["executionModel"],
    requiresDealer: Boolean(values.requiresDealer),
    maxSlippagePoints: values.maxSlippagePoints as number,
    maxDeviationPoints: values.maxDeviationPoints as number,
    orderTimeoutMs: values.orderTimeoutMs as number,
    volumeThresholdLots: (values.volumeThresholdLots as number | null) ?? null,
    profitThresholdUsd: (values.profitThresholdUsd as number | null) ?? null,
    resolvedFrom,
  };
}
