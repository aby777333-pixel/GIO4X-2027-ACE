import type { SwapConfigRow } from "../types/rows";

// Overnight swap for one open position at rollover. triple_day applies the 3x
// multiplier (e.g. Wednesday for fx). Returns swap in the config's rate units.
export function computeSwap(side: "long" | "short", row: SwapConfigRow, volumeLots: number, weekday: number): number {
  const rate = side === "long" ? row.longRate : row.shortRate;
  const mult = weekday === row.tripleDay ? 3 : 1;
  return rate * volumeLots * mult;
}
