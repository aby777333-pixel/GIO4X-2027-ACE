import type { LpRow } from "../types/rows";

// Eligible = active/degraded (skip offline/disabled) and symbol allowed (empty = all).
export function eligibleLPs(lps: LpRow[], symbol: string): LpRow[] {
  return lps.filter(
    (lp) => (lp.status === "active" || lp.status === "degraded") && (lp.symbols.length === 0 || lp.symbols.includes(symbol)),
  );
}

// Best-execution pick with failover: honour a preferred LP if still eligible, else
// prefer primary → lower priority number → lower reject rate → faster fill.
export function pickLP(lps: LpRow[], symbol: string, preferredId?: string | null): LpRow | null {
  const elig = eligibleLPs(lps, symbol);
  if (elig.length === 0) return null;
  if (preferredId) {
    const p = elig.find((l) => l.id === preferredId);
    if (p) return p;
  }
  return [...elig].sort(
    (a, b) =>
      Number(b.isPrimary) - Number(a.isPrimary) ||
      a.priority - b.priority ||
      a.rejectRate - b.rejectRate ||
      (a.avgFillMs ?? Number.MAX_SAFE_INTEGER) - (b.avgFillMs ?? Number.MAX_SAFE_INTEGER),
  )[0];
}

// Deterministic percentage-split routing across eligible LPs (bucket 0..99).
export function pickLPSplit(lps: LpRow[], symbol: string, bucket: number): LpRow | null {
  const elig = eligibleLPs(lps, symbol).filter((l) => l.routingPct > 0).sort((a, b) => a.priority - b.priority);
  if (elig.length === 0) return null;
  const total = elig.reduce((s, l) => s + l.routingPct, 0) || 1;
  const target = ((((bucket % 100) + 100) % 100) / 100) * total;
  let acc = 0;
  for (const lp of elig) {
    acc += lp.routingPct;
    if (target < acc) return lp;
  }
  return elig[elig.length - 1];
}
