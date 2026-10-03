import type { ScopeType } from "@gio4x/scope-engine";
import type {
  SpreadConfigRow, DynamicSpreadRuleRow, WideningRuleRow, CompressionRuleRow,
  MarkupLayerRow, EngineSettings, LpMarkupRow, SegmentPricingRow, SmartRuleRow,
} from "./types/rows";

export interface PricingConfig {
  spreadConfig?: SpreadConfigRow[];
  dynamicSpreadRules?: DynamicSpreadRuleRow[];
  wideningRules?: WideningRuleRow[];
  compressionRules?: CompressionRuleRow[];
  markupLayers?: MarkupLayerRow[];
  lpMarkup?: LpMarkupRow[];
  segmentPricing?: SegmentPricingRow[];
  smartRules?: SmartRuleRow[];
  engine?: EngineSettings;
}

export const DEFAULT_ENGINE: EngineSettings = {
  maxTotalMarkupPips: 5, maxTotalSpreadPips: 50, staleFeedAction: "widen", staleFeedMs: 1500,
};

// Invalidatable in-memory cache the worker holds. The hot path reads only this.
export class PricingCache {
  private spreadByScope = new Map<string, SpreadConfigRow>();
  dynamicSpreadRules: DynamicSpreadRuleRow[];
  wideningRules: WideningRuleRow[];
  compressionRules: CompressionRuleRow[];
  markupLayers: MarkupLayerRow[];
  lpMarkup: LpMarkupRow[];
  segmentPricing: SegmentPricingRow[];
  smartRules: SmartRuleRow[];
  engine: EngineSettings;

  constructor(cfg: PricingConfig = {}) {
    for (const r of cfg.spreadConfig ?? []) {
      if (!r.enabled) continue;
      const k = `${r.scopeType}:${r.scopeRef ?? "*"}`;
      const cur = this.spreadByScope.get(k);
      if (!cur || r.priority < cur.priority) this.spreadByScope.set(k, r);
    }
    const on = <T extends { enabled: boolean }>(a?: T[]) => (a ?? []).filter((x) => x.enabled);
    this.dynamicSpreadRules = on(cfg.dynamicSpreadRules);
    this.wideningRules = on(cfg.wideningRules);
    this.compressionRules = on(cfg.compressionRules);
    this.markupLayers = on(cfg.markupLayers);
    this.lpMarkup = on(cfg.lpMarkup);
    this.segmentPricing = on(cfg.segmentPricing);
    this.smartRules = on(cfg.smartRules);
    this.engine = cfg.engine ?? DEFAULT_ENGINE;
  }

  getSpread(st: ScopeType, ref: string | null): SpreadConfigRow | null {
    return this.spreadByScope.get(`${st}:${ref ?? "*"}`) ?? null;
  }
}
