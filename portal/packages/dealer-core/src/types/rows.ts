import type { BookType, DealingMode, ExecutionModel, ScopeType, LpStatus } from "./enums";

// In-memory shapes of the `dealer` config rows (camelCase mirror of the SQL).
export interface BookConfigRow {
  id: string;
  scopeType: ScopeType;
  scopeRef: string | null;
  book: BookType;
  dealingMode: DealingMode;
  executionModel: ExecutionModel;
  volumeThresholdLots: number | null;
  profitThresholdUsd: number | null;
  maxSlippagePoints: number;
  maxDeviationPoints: number;
  orderTimeoutMs: number;
  requiresDealer: boolean;
  enabled: boolean;
  priority: number;
}

export interface LpRow {
  id: string;
  name: string;
  status: LpStatus;
  isPrimary: boolean;
  priority: number;
  routingPct: number;
  symbols: string[]; // empty = all
  endpointRef: string | null;
  avgFillMs: number | null;
  rejectRate: number;
}
