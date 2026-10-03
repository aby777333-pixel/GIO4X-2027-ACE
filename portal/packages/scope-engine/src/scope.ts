// The one most-specific-wins scope cascade, shared by DEALER-CORE and PRICING-CORE.
// account → account_type → client_group → trading_group → white_label → country →
// symbol → asset_class → global.

export const SCOPE_PRECEDENCE = [
  "account", "account_type", "client_group", "trading_group",
  "white_label", "country", "symbol", "asset_class", "global",
] as const;
export type ScopeType = (typeof SCOPE_PRECEDENCE)[number];

// The minimum context any scoped resolution needs. Both OrderContext (dealer) and
// PricingContext satisfy this structurally.
export interface ScopeContext {
  accountId: string;
  accountType: string;
  clientGroup: string;
  tradingGroup: string;
  whiteLabel: string;
  country: string;
  symbol: string;
  assetClass: string;
}

export function scopeRefFor(ctx: ScopeContext, st: ScopeType): string | null {
  switch (st) {
    case "account": return ctx.accountId;
    case "account_type": return ctx.accountType;
    case "client_group": return ctx.clientGroup;
    case "trading_group": return ctx.tradingGroup;
    case "white_label": return ctx.whiteLabel;
    case "country": return ctx.country;
    case "symbol": return ctx.symbol;
    case "asset_class": return ctx.assetClass;
    case "global": return null;
  }
}

export interface ResolvedFrom {
  scopeType: ScopeType;
  scopeRef: string | null;
  configId: string;
}
export interface FieldSpec {
  field: string;
  nullable?: boolean; // null value → keep inheriting up the cascade
  default?: unknown; // used when no enabled row provides the field
}

// Per-field resolution: for each field the most-specific enabled row that PROVIDES
// it wins (nullable fields skip null and inherit). Returns per-field provenance.
export function resolveFields<Row>(
  ctx: ScopeContext,
  get: (st: ScopeType, ref: string | null) => Row | null,
  idOf: (row: Row) => string,
  fields: FieldSpec[],
): { values: Record<string, unknown>; resolvedFrom: Record<string, ResolvedFrom> } {
  const values: Record<string, unknown> = {};
  const resolvedFrom: Record<string, ResolvedFrom> = {};
  for (const f of fields) {
    let picked = false;
    for (const st of SCOPE_PRECEDENCE) {
      const ref = scopeRefFor(ctx, st);
      const row = get(st, ref);
      if (!row) continue;
      const v = (row as unknown as Record<string, unknown>)[f.field];
      if (f.nullable && (v === null || v === undefined)) continue;
      values[f.field] = v;
      resolvedFrom[f.field] = { scopeType: st, scopeRef: ref, configId: idOf(row) };
      picked = true;
      break;
    }
    if (!picked) {
      values[f.field] = f.default ?? null;
      resolvedFrom[f.field] = { scopeType: "global", scopeRef: null, configId: "engine-default" };
    }
  }
  return { values, resolvedFrom };
}

// Single-winner resolution: the most-specific enabled row wins as a unit. Used by
// spread / commission / swap / segment (which resolve to ONE row, unlike markup).
export function resolveRow<Row>(
  ctx: ScopeContext,
  get: (st: ScopeType, ref: string | null) => Row | null,
): { row: Row; scopeType: ScopeType; scopeRef: string | null } | null {
  for (const st of SCOPE_PRECEDENCE) {
    const ref = scopeRefFor(ctx, st);
    const row = get(st, ref);
    if (row) return { row, scopeType: st, scopeRef: ref };
  }
  return null;
}
