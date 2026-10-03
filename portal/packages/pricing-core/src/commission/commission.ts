import { resolveRow } from "@gio4x/scope-engine";
import type { PricingContext } from "../types/schemas";
import type { CommissionConfigRow } from "../types/rows";

// Resolve the single most-specific commission and compute the charge.
export function computeCommission(
  ctx: PricingContext, rows: CommissionConfigRow[], volumeLots: number, notionalUsd: number,
): { amountUsd: number; perSide: boolean } {
  const m = new Map<string, CommissionConfigRow>();
  for (const r of rows) {
    if (!r.enabled) continue;
    const k = `${r.scopeType}:${r.scopeRef ?? "*"}`;
    const cur = m.get(k);
    if (!cur || r.priority < cur.priority) m.set(k, r);
  }
  const res = resolveRow<CommissionConfigRow>(ctx, (st, ref) => m.get(`${st}:${ref ?? "*"}`) ?? null);
  if (!res) return { amountUsd: 0, perSide: true };
  const c = res.row;
  let amt = 0;
  switch (c.model) {
    case "fixed": amt = c.value; break;
    case "per_lot": amt = c.value * volumeLots; break;
    case "percentage": amt = (c.value / 100) * notionalUsd; break;
    case "volume_based": amt = c.value * volumeLots; break;
  }
  return { amountUsd: amt, perSide: c.perSide };
}
