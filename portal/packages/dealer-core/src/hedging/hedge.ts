import type { HedgeType, HedgeMethod } from "../types/enums";

export interface HedgePlan {
  hedgeType: HedgeType;
  method: HedgeMethod;
  symbol: string;
  side: "buy" | "sell"; // direction of the hedge (opposite the book's net)
  volumeLots: number;
  reason: string;
  triggerValue: number;
}

// Plan a hedge when net exposure exceeds a limit. `partial` (0..1) hedges that
// fraction of the overflow; 1 = full hedge of the overflow.
export function planHedge(
  symbol: string,
  netLots: number,
  limitLots: number,
  opts?: { method?: HedgeMethod; partial?: number },
): HedgePlan | null {
  const over = Math.abs(netLots) - limitLots;
  if (over <= 0) return null;
  const partial = opts?.partial ?? 1;
  const vol = +(over * partial).toFixed(2);
  if (vol <= 0) return null;
  return {
    hedgeType: partial < 1 ? "partial" : "full",
    method: opts?.method ?? "lp",
    symbol,
    side: netLots > 0 ? "sell" : "buy",
    volumeLots: vol,
    reason: `net ${netLots} exceeds limit ${limitLots}`,
    triggerValue: netLots,
  };
}

// One-shot flatten of a symbol's entire net exposure.
export function emergencyFlatten(symbol: string, netLots: number): HedgePlan {
  return {
    hedgeType: "emergency",
    method: "lp",
    symbol,
    side: netLots > 0 ? "sell" : "buy",
    volumeLots: Math.abs(+netLots.toFixed(2)),
    reason: "emergency_flatten",
    triggerValue: netLots,
  };
}
