import { evalCondition, type Facts } from "../rules/condition";
import type { SmartRuleRow } from "../types/rows";

export interface FiredRule {
  rule: SmartRuleRow;
  action: SmartRuleRow["action"]; // e.g. {type:'widen',by:..} | {type:'compress'} | {type:'hedge_and_widen'} | {type:'markup_adjust'}
}

// Evaluate smart rules by priority against the current facts. `hedge_and_widen`
// actions are returned for the worker to dispatch to DEALER-CORE hedging + widen here.
export function evaluateSmartRules(rules: SmartRuleRow[], facts: Facts): FiredRule[] {
  return [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority)
    .filter((r) => evalCondition(r.condition, facts))
    .map((r) => ({ rule: r, action: r.action }));
}
