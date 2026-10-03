import { describe, it, expect } from "vitest";
import { SCOPE_PRECEDENCE, scopeRefFor, resolveFields, resolveRow, type ScopeContext, type ScopeType } from "../src";

const ctx: ScopeContext = {
  accountId: "acc1", accountType: "vip", clientGroup: "cg1", tradingGroup: "g1",
  whiteLabel: "wl1", country: "IN", symbol: "EURUSD", assetClass: "forex",
};

type Row = { id: string; scopeType: ScopeType; scopeRef: string | null; value: number; opt: number | null };
function cacheOf(rows: Row[]) {
  const m = new Map<string, Row>();
  for (const r of rows) m.set(`${r.scopeType}:${r.scopeRef ?? "*"}`, r);
  return (st: ScopeType, ref: string | null) => m.get(`${st}:${ref ?? "*"}`) ?? null;
}

describe("scope-engine", () => {
  it("precedence is most-specific-first, global last", () => {
    expect(SCOPE_PRECEDENCE[0]).toBe("account");
    expect(SCOPE_PRECEDENCE[SCOPE_PRECEDENCE.length - 1]).toBe("global");
  });

  it("scopeRefFor maps each scope", () => {
    expect(scopeRefFor(ctx, "account")).toBe("acc1");
    expect(scopeRefFor(ctx, "symbol")).toBe("EURUSD");
    expect(scopeRefFor(ctx, "global")).toBeNull();
  });

  it("resolveFields: most-specific wins per field", () => {
    const get = cacheOf([
      { id: "g", scopeType: "global", scopeRef: null, value: 1, opt: null },
      { id: "a", scopeType: "account", scopeRef: "acc1", value: 9, opt: null },
    ]);
    const r = resolveFields<Row>(ctx, get, (x) => x.id, [{ field: "value", default: 0 }]);
    expect(r.values.value).toBe(9);
    expect(r.resolvedFrom.value.configId).toBe("a");
  });

  it("resolveFields: nullable field inherits up the cascade", () => {
    const get = cacheOf([
      { id: "a", scopeType: "account", scopeRef: "acc1", value: 9, opt: null },
      { id: "tg", scopeType: "trading_group", scopeRef: "g1", value: 5, opt: 42 },
    ]);
    const r = resolveFields<Row>(ctx, get, (x) => x.id, [{ field: "opt", nullable: true, default: null }]);
    expect(r.values.opt).toBe(42);
    expect(r.resolvedFrom.opt.scopeType).toBe("trading_group");
  });

  it("resolveFields: engine default when nothing matches", () => {
    const r = resolveFields<Row>(ctx, () => null, (x) => x.id, [{ field: "value", default: 7 }]);
    expect(r.values.value).toBe(7);
    expect(r.resolvedFrom.value.configId).toBe("engine-default");
  });

  it("resolveRow: returns the single most-specific winner", () => {
    const get = cacheOf([
      { id: "g", scopeType: "global", scopeRef: null, value: 1, opt: null },
      { id: "s", scopeType: "symbol", scopeRef: "EURUSD", value: 3, opt: null },
    ]);
    const r = resolveRow<Row>(ctx, get);
    expect(r?.row.id).toBe("s");
    expect(r?.scopeType).toBe("symbol");
  });

  it("resolveRow: null when no row anywhere", () => {
    expect(resolveRow<Row>(ctx, () => null)).toBeNull();
  });
});
