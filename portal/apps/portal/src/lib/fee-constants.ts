import type { Enums } from "@gio4x/supabase";
import type { StatusTone } from "@/components/StatusBadge";

export type FeeType = Enums<"fee_type">;
export type FeeCalcMethod = Enums<"fee_calc_method">;
export type FeeChargeStatus = Enums<"fee_charge_status">;
export type LedgerAccountType = Enums<"ledger_account_type">;
export type JournalStatus = Enums<"journal_status">;
export type WalletCurrency = Enums<"wallet_currency">;

// ---------------------------------------------------------------------------
// Fee types
// ---------------------------------------------------------------------------
export const FEE_TYPES: FeeType[] = [
  "deposit",
  "withdrawal",
  "inactivity",
  "conversion",
  "swap",
  "spread",
  "commission_per_lot",
  "management",
  "performance",
  "subscription",
  "rebate",
  "adjustment",
  "custom",
];

export const FEE_TYPE_LABEL: Record<FeeType, string> = {
  deposit: "Deposit fee",
  withdrawal: "Withdrawal fee",
  inactivity: "Inactivity fee",
  conversion: "FX conversion",
  swap: "Swap / rollover",
  spread: "Spread markup",
  commission_per_lot: "Commission / lot",
  management: "Management fee",
  performance: "Performance fee",
  subscription: "Subscription",
  rebate: "Rebate",
  adjustment: "Adjustment",
  custom: "Custom",
};

// ---------------------------------------------------------------------------
// Calculation methods
// ---------------------------------------------------------------------------
export const CALC_METHODS: FeeCalcMethod[] = [
  "flat",
  "percentage",
  "per_lot",
  "spread_markup",
  "tiered",
];

export const CALC_METHOD_LABEL: Record<FeeCalcMethod, string> = {
  flat: "Flat amount",
  percentage: "Percentage of base",
  per_lot: "Per lot",
  spread_markup: "Spread markup / lot",
  tiered: "Tiered",
};

/** Human hint for how the `rate` field is interpreted per method. */
export const RATE_HINT: Record<FeeCalcMethod, string> = {
  flat: "Fixed amount in the rule currency",
  percentage: "Fraction of base amount (e.g. 0.005 = 0.5%)",
  per_lot: "Amount charged per traded lot",
  spread_markup: "Markup amount applied per lot",
  tiered: "Resolved from the tiers table (rate ignored)",
};

// ---------------------------------------------------------------------------
// Charge status
// ---------------------------------------------------------------------------
export const FEE_CHARGE_STATUS_LABEL: Record<FeeChargeStatus, string> = {
  pending: "Pending",
  applied: "Applied",
  waived: "Waived",
  reversed: "Reversed",
};

export function chargeStatusTone(s: FeeChargeStatus): StatusTone {
  switch (s) {
    case "applied":
      return "success";
    case "waived":
      return "neutral";
    case "reversed":
      return "danger";
    case "pending":
    default:
      return "warning";
  }
}

// ---------------------------------------------------------------------------
// Ledger account types
// ---------------------------------------------------------------------------
export const LEDGER_ACCOUNT_TYPES: LedgerAccountType[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
];

export const LEDGER_ACCOUNT_TYPE_LABEL: Record<LedgerAccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
};

export function ledgerTypeTone(t: LedgerAccountType): StatusTone {
  switch (t) {
    case "asset":
      return "info";
    case "revenue":
      return "success";
    case "expense":
      return "danger";
    case "liability":
      return "warning";
    case "equity":
    default:
      return "neutral";
  }
}

export function journalStatusTone(s: JournalStatus): StatusTone {
  return s === "posted" ? "success" : "danger";
}

// ---------------------------------------------------------------------------
// Currencies (mirror of wallet_currency enum)
// ---------------------------------------------------------------------------
export const CURRENCIES: WalletCurrency[] = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "AED",
  "USDT",
  "BTC",
  "ETH",
  "USC",
];

/** Format a numeric(20,8) money value for display, trimming trailing zeros. */
export function formatMoney(value: number | string | null | undefined, currency?: string): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  // up to 8dp but trim — money in this system is numeric(20,8)
  const fixed = n.toFixed(8).replace(/\.?0+$/, "");
  return currency ? `${fixed} ${currency}` : fixed;
}
