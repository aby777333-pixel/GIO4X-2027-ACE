import type { Position } from "../bridge/TradeServerBridge";

const CURRENCIES = new Set([
  "USD", "EUR", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD", "CNH", "HKD", "SGD", "XAU", "XAG",
]);

// Decompose a symbol into base/quote legs. Forex majors/crosses split 3/3; metals,
// indices and crypto fall back to (asset, quote-or-USD).
export function decomposeSymbol(symbol: string): { base: string; quote: string } {
  const s = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  if (s.length === 6 && CURRENCIES.has(s.slice(0, 3)) && CURRENCIES.has(s.slice(3))) {
    return { base: s.slice(0, 3), quote: s.slice(3) };
  }
  if (s.length >= 4 && CURRENCIES.has(s.slice(-3))) {
    return { base: s.slice(0, s.length - 3), quote: s.slice(-3) };
  }
  return { base: s, quote: "USD" };
}

export interface ExposureRow {
  dimension: string;
  ref: string;
  long: number;
  short: number;
  net: number;
  gross: number;
  netUsd: number;
}

// Aggregate open positions to long/short/net/gross per symbol, currency leg, and total.
export function aggregateExposure(positions: Position[]): ExposureRow[] {
  const acc = new Map<string, ExposureRow>();
  const bump = (dimension: string, ref: string, side: "buy" | "sell", lots: number, usd: number) => {
    const k = `${dimension}:${ref}`;
    let r = acc.get(k);
    if (!r) { r = { dimension, ref, long: 0, short: 0, net: 0, gross: 0, netUsd: 0 }; acc.set(k, r); }
    if (side === "buy") r.long += lots; else r.short += lots;
    r.net = +(r.long - r.short).toFixed(6);
    r.gross = +(r.long + r.short).toFixed(6);
    r.netUsd = +(r.netUsd + (side === "buy" ? usd : -usd)).toFixed(2);
  };

  for (const p of positions) {
    const notionalUsd = p.volumeLots * (p.currentPrice ?? p.openPrice);
    bump("symbol", p.symbol, p.side, p.volumeLots, notionalUsd);
    bump("total", "ALL", p.side, p.volumeLots, notionalUsd);
    const { base, quote } = decomposeSymbol(p.symbol);
    // long the symbol = long the base currency, short the quote currency.
    bump("currency", base, p.side, p.volumeLots, notionalUsd);
    bump("currency", quote, p.side === "buy" ? "sell" : "buy", p.volumeLots, notionalUsd);
  }
  return [...acc.values()];
}

export interface ExposureThreshold {
  dimension: string;
  ref?: string;
  maxNetLots: number;
}

export function getBreaches(rows: ExposureRow[], thresholds: ExposureThreshold[]): { row: ExposureRow; limit: number }[] {
  const out: { row: ExposureRow; limit: number }[] = [];
  for (const t of thresholds) {
    for (const r of rows) {
      if (r.dimension === t.dimension && (!t.ref || r.ref === t.ref) && Math.abs(r.net) > t.maxNetLots) {
        out.push({ row: r, limit: t.maxNetLots });
      }
    }
  }
  return out;
}
