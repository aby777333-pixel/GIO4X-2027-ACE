import type { SurveillanceType } from "../types/enums";

// Activity window fed to the detectors (assembled by the sweep job from trade data).
export interface Activity {
  accountId: string;
  avgHoldSecs?: number;
  tradesPerDay?: number;
  subSecondRoundTrips?: number;
  profitAfterNewsMs?: number; // ms after a high-impact event the account opened a winning trade
  offsettingWithLinked?: number; // count of offsetting fills against linked accounts
  linkedAccounts?: string[];
  sameIpAccounts?: string[];
}

export interface Flag {
  type: SurveillanceType;
  accountId: string;
  severity: number; // 1..5
  evidence: Record<string, unknown>;
}

type Detector = (a: Activity) => Flag | null;

export const detectScalpingAbuse: Detector = (a) =>
  a.avgHoldSecs != null && a.avgHoldSecs < 60 && (a.tradesPerDay ?? 0) > 50
    ? { type: "scalping_abuse", accountId: a.accountId, severity: 3, evidence: { avgHoldSecs: a.avgHoldSecs, tradesPerDay: a.tradesPerDay } }
    : null;

export const detectArbitrage: Detector = (a) =>
  (a.subSecondRoundTrips ?? 0) > 5
    ? { type: "arbitrage", accountId: a.accountId, severity: 5, evidence: { subSecondRoundTrips: a.subSecondRoundTrips } }
    : null;

export const detectLatencyAbuse: Detector = (a) =>
  a.profitAfterNewsMs != null && a.profitAfterNewsMs < 300
    ? { type: "latency_abuse", accountId: a.accountId, severity: 4, evidence: { profitAfterNewsMs: a.profitAfterNewsMs } }
    : null;

export const detectWashTrading: Detector = (a) =>
  (a.offsettingWithLinked ?? 0) > 0 && ((a.linkedAccounts?.length ?? 0) > 0 || (a.sameIpAccounts?.length ?? 0) > 0)
    ? { type: "wash_trading", accountId: a.accountId, severity: 5, evidence: { offsetting: a.offsettingWithLinked, linked: a.linkedAccounts, sameIp: a.sameIpAccounts } }
    : null;

export const DETECTORS: Detector[] = [detectScalpingAbuse, detectArbitrage, detectLatencyAbuse, detectWashTrading];

export function runDetectors(a: Activity): Flag[] {
  return DETECTORS.map((d) => d(a)).filter((f): f is Flag => f !== null);
}
