import type { ScopeType } from "@gio4x/scope-engine";
import type { SpreadMode, MarkupSide, MarkupUnit, CommissionModel, LpPriceRouting, ClientSegment, BehaviourTag } from "./enums";

export interface SpreadConfigRow {
  id: string; scopeType: ScopeType; scopeRef: string | null; mode: SpreadMode;
  baseValue: number; unit: MarkupUnit; minSpread: number | null; maxSpread: number | null;
  priority: number; enabled: boolean;
}
export interface DynamicSpreadRuleRow {
  id: string; scopeType: ScopeType; scopeRef: string | null; priority: number;
  condition: unknown; deltaValue: number; unit: MarkupUnit; enabled: boolean;
}
export interface WideningRuleRow {
  id: string; name: string; trigger: string; symbols: string[]; widenBy: number;
  unit: MarkupUnit; startsBeforeSecs: number; endsAfterSecs: number; enabled: boolean;
}
export interface CompressionRuleRow {
  id: string; name: string; segment: ClientSegment | null; tradingGroup: string | null;
  compressBy: number; unit: MarkupUnit; floorSpread: number | null; enabled: boolean;
}
export interface MarkupLayerRow {
  id: string; layer: ScopeType; scopeRef: string | null; side: MarkupSide; value: number;
  unit: MarkupUnit; pctOfVolume: number | null; pctOfClients: number | null;
  appliesRegions: string[]; stackOrder: number; enabled: boolean;
}
export interface EngineSettings {
  maxTotalMarkupPips: number; maxTotalSpreadPips: number; staleFeedAction: string; staleFeedMs: number;
}
export interface CommissionConfigRow {
  id: string; scopeType: ScopeType; scopeRef: string | null; model: CommissionModel;
  value: number; perSide: boolean; currency: string; enabled: boolean; priority: number;
}
export interface SwapConfigRow {
  id: string; scopeType: ScopeType; scopeRef: string | null; longRate: number; shortRate: number;
  tripleDay: number; dynamic: boolean; unit: MarkupUnit; enabled: boolean;
}
export interface ExtractionModelRow {
  id: string; name: string; scopeType: ScopeType; scopeRef: string | null;
  perLotUsd: number | null; notionalBps: number | null; enabled: boolean;
}
export interface LpMarkupRow {
  id: string; lpId: string; symbols: string[]; side: MarkupSide; value: number; unit: MarkupUnit; enabled: boolean;
}
export interface LpPriceRoutingRow {
  id: string; scopeType: ScopeType; scopeRef: string | null; mode: LpPriceRouting; enabled: boolean;
}
export interface SegmentPricingRow {
  id: string; segment: ClientSegment | null; behaviour: BehaviourTag | null;
  spreadDelta: number; markupDelta: number; unit: MarkupUnit; enabled: boolean;
}
export interface SmartRuleRow {
  id: string; name: string; priority: number; condition: unknown;
  action: { type: string;[k: string]: unknown }; scopeType: ScopeType; scopeRef: string | null; enabled: boolean;
}
