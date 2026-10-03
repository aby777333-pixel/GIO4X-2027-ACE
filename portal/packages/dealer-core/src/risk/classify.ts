// Strategy classification. Rules-based now; the same interface backs a future
// AI classifier (NEXUS / Anthropic) without touching callers.

export interface TradeStats {
  winRate?: number | null;
  profitFactor?: number | null;
  maxDrawdown?: number | null;
  avgHoldSecs?: number | null;
  tradesPerDay?: number | null;
  lifetimePnl?: number | null;
  escalatingLots?: boolean;
  subSecondRoundTrips?: boolean;
  clusteredAroundNews?: boolean;
}

export type Strategy = "scalper" | "news" | "arb" | "martingale" | "swing";

export interface Classifier {
  classify(s: TradeStats): Strategy;
}

export const RuleClassifier: Classifier = {
  classify(s: TradeStats): Strategy {
    if (s.subSecondRoundTrips) return "arb";
    if (s.escalatingLots) return "martingale";
    if (s.avgHoldSecs != null && s.avgHoldSecs < 120 && (s.tradesPerDay ?? 0) >= 10) return "scalper";
    if (s.clusteredAroundNews) return "news";
    return "swing";
  },
};
