import type { Capability } from "@/lib/server/constants";

/**
 * The portal configuration Control manages: which tables, which columns, and
 * what each column may hold. One list, read by the forms that draw the fields
 * (ConfigManager.tsx) and by the server action that checks what was posted
 * (savePortalConfig in src/app/control/actions-portal.ts). The portal's
 * database keeps its own list of the same tables and columns and refuses
 * anything else (control_config_write), so adding a column means adding it in
 * both places.
 *
 * Values must equal the portal's enums (see .from("...") columns in
 * portal/supabase/migrations).
 */
export const FEE_TYPES = ["deposit", "withdrawal", "inactivity", "conversion", "swap", "spread", "commission_per_lot", "management", "performance", "subscription", "rebate", "adjustment", "custom"] as const;
export const FEE_METHODS = ["flat", "percentage", "per_lot", "spread_markup", "tiered"] as const;
export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "USDT", "BTC", "ETH", "USC"] as const;

export type ConfigField = {
  name: string;
  label: string;
  /** text: cleaned, one line. decimal: digits with up to 8 places, sent as text so nothing is rounded. integer: whole number. choice: one of `options`. row: the id of a row offered by the page. flag: a tick box. when: a date and time, UTC. */
  kind: "text" | "decimal" | "integer" | "choice" | "row" | "flag" | "when";
  options?: readonly string[];
  required?: boolean;
  max?: number;
  hint?: string;
};

export type ConfigTable = "fee_schedules" | "fee_rules" | "commission_plans" | "account_types";

export const CONFIG_TABLES: Record<ConfigTable, { capability: Capability; back: string; noun: string; fields: readonly ConfigField[] }> = {
  fee_schedules: {
    capability: "fees.manage",
    back: "/control/fees",
    noun: "fee schedule",
    fields: [
      { name: "code", label: "Code", kind: "text", required: true, max: 40, hint: "Short and lower case, for example: default" },
      { name: "name", label: "Name", kind: "text", required: true, max: 80 },
      { name: "version", label: "Version", kind: "integer", required: true, hint: "A code and version pair is used once" },
      { name: "precedence", label: "Precedence", kind: "integer", hint: "When two schedules apply, the higher number wins" },
      { name: "effective_from", label: "Effective from (UTC)", kind: "when" },
      { name: "effective_to", label: "Effective to (UTC)", kind: "when", hint: "Empty: no end" },
      { name: "description", label: "Description", kind: "text", max: 300 },
      { name: "active", label: "Active", kind: "flag" },
    ],
  },
  fee_rules: {
    capability: "fees.manage",
    back: "/control/fees",
    noun: "fee rule",
    fields: [
      { name: "schedule_id", label: "Schedule", kind: "row", required: true },
      { name: "fee_type", label: "Fee type", kind: "choice", options: FEE_TYPES, required: true },
      { name: "calc_method", label: "Method", kind: "choice", options: FEE_METHODS, required: true },
      { name: "rate", label: "Rate", kind: "decimal", required: true, hint: "Flat: an amount. Per lot: an amount per lot. Percentage: a fraction, so 0.005 is 0.5%" },
      { name: "min_amount", label: "Minimum charge", kind: "decimal", hint: "Empty: none" },
      { name: "max_amount", label: "Maximum charge", kind: "decimal", hint: "Empty: none" },
      { name: "currency", label: "Currency", kind: "choice", options: CURRENCIES, required: true },
      { name: "priority", label: "Priority", kind: "integer", hint: "Lower numbers are tried first" },
      { name: "is_rebate", label: "This is a rebate (paid to the client)", kind: "flag" },
      { name: "active", label: "Active", kind: "flag" },
    ],
  },
  commission_plans: {
    capability: "partners.manage",
    back: "/control/ib",
    noun: "commission plan",
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, max: 80 },
      { name: "rate_per_lot", label: "Rate per lot (USD)", kind: "decimal", required: true },
      { name: "sub_ib_share_l1", label: "Sub-IB share, level 1", kind: "decimal", hint: "A fraction: 0.15 is 15%" },
      { name: "sub_ib_share_l2", label: "Sub-IB share, level 2", kind: "decimal", hint: "A fraction: 0.05 is 5%" },
      { name: "description", label: "Description", kind: "text", max: 300 },
      { name: "is_default", label: "Default plan for new introducing brokers", kind: "flag" },
      { name: "active", label: "Active", kind: "flag" },
    ],
  },
  account_types: {
    capability: "trading.manage",
    back: "/control/broker",
    noun: "account type",
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, max: 60 },
      { name: "leverage", label: "Leverage (1 : N)", kind: "integer", required: true, hint: "The N: 500 means 1:500" },
      { name: "min_deposit", label: "Minimum deposit", kind: "decimal", required: true },
      { name: "base_currency", label: "Base currency", kind: "choice", options: CURRENCIES, required: true },
      { name: "spread_from", label: "Spread from", kind: "text", max: 40, hint: "As shown to clients, for example: 1.5 pips" },
      { name: "commission", label: "Commission", kind: "text", max: 40, hint: "As shown to clients, for example: None" },
      { name: "sort", label: "Order in lists", kind: "integer" },
      { name: "active", label: "Active", kind: "flag" },
    ],
  },
};

export function isConfigTable(value: unknown): value is ConfigTable {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CONFIG_TABLES, value);
}
