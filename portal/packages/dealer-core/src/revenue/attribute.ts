import type { BookType } from "../types/enums";

export interface FillEvent {
  accountId: string;
  symbol: string;
  book: BookType;
  lpId?: string | null;
  ref?: string;
  spreadMarkupUsd?: number;
  commissionUsd?: number;
  swapUsd?: number;
  overnightUsd?: number;
  conversionUsd?: number;
  withdrawalFeeUsd?: number;
}

export interface RevenueEntry {
  accountId: string;
  symbol?: string;
  source: string; // spread_markup | commission | swap | overnight | conversion | withdrawal
  amountUsd: number;
  book?: BookType;
  lpId?: string | null;
  ref?: string;
}

// Attribute a fill/close to revenue-ledger entries by source (one row per non-zero source).
export function attributeRevenue(e: FillEvent): RevenueEntry[] {
  const out: RevenueEntry[] = [];
  const add = (source: string, amt?: number) => {
    if (amt != null && amt !== 0) out.push({ accountId: e.accountId, symbol: e.symbol, source, amountUsd: amt, book: e.book, lpId: e.lpId ?? null, ref: e.ref });
  };
  add("spread_markup", e.spreadMarkupUsd);
  add("commission", e.commissionUsd);
  add("swap", e.swapUsd);
  add("overnight", e.overnightUsd);
  add("conversion", e.conversionUsd);
  add("withdrawal", e.withdrawalFeeUsd);
  return out;
}
