import type { MarkupUnit } from "../types/enums";

// Pip size per asset class / symbol — fx 0.0001, JPY pairs 0.01, metals/commodities
// 0.01, indices/crypto 1. Unit-tested per asset class.
export function pipSize(assetClass: string, symbol: string): number {
  if (symbol.toUpperCase().endsWith("JPY")) return 0.01;
  switch (assetClass) {
    case "forex": return 0.0001;
    case "metal": return 0.01;
    case "commodity": return 0.01;
    case "index": return 1;
    case "crypto": return 1;
    default: return 0.0001;
  }
}

// Normalize a config value (in its unit) to PRICE units for a symbol.
export function toPrice(value: number, unit: MarkupUnit, assetClass: string, symbol: string, refPrice: number): number {
  const pip = pipSize(assetClass, symbol);
  switch (unit) {
    case "pips": return value * pip;
    case "points": return value * (pip / 10); // 5-digit fractional pricing: 1 pip = 10 points
    case "percent": return (value / 100) * refPrice;
    case "absolute": return value;
  }
}

export function priceToPips(price: number, assetClass: string, symbol: string): number {
  return price / pipSize(assetClass, symbol);
}
