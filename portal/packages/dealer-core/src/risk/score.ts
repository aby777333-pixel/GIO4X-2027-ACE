import type { TradeStats, Strategy } from "./classify";

// Client risk score: 0 (house-favourable) .. 100 (toxic to the house). Higher win
// rate / profit factor / sustained profitability and arb/scalper behaviour push up;
// martingale (usually house-favourable) pushes down. Clamped + rounded.
export function computeRiskScore(s: TradeStats, strategy: Strategy): number {
  let score = 50;
  if (s.winRate != null) score += (s.winRate - 0.5) * 60; // 50% → 0, 80% → +18
  if (s.profitFactor != null) score += Math.min((s.profitFactor - 1) * 20, 25);
  if (s.lifetimePnl != null && s.lifetimePnl > 0) score += Math.min(s.lifetimePnl / 1000, 15);
  if (strategy === "arb") score += 30;
  else if (strategy === "scalper") score += 15;
  else if (strategy === "news") score += 10;
  else if (strategy === "martingale") score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isToxic(score: number): boolean {
  return score >= 70;
}
