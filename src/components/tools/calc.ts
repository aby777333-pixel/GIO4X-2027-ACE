/**
 * TRADER TOOLKIT — shared arithmetic, instrument contracts and number formatting.
 *
 * Nothing in this file is a price. Contract sizes are read from the contract
 * descriptions in src/data/instruments.ts; an instrument whose description does
 * not state a contract size is not offered by name: the visitor uses "Another
 * instrument" and types the contract from their own platform.
 */
import { instruments } from "@/data/instruments";
import { isRateCurrency, RATE_CURRENCIES, type RateCurrency } from "@/lib/rates";

export { RATE_CURRENCIES };
export type { RateCurrency };

/** The latest ECB fixing, reduced on the server to what the tools need. */
export type RatesProp = { status: "ok"; date: string; perEur: Record<RateCurrency, number> } | { status: "unavailable"; reason: string };

/** Units of `to` per one unit of `from` at the reference fixing. */
export function refRate(r: Extract<RatesProp, { status: "ok" }>, from: RateCurrency, to: RateCurrency): number {
  return r.perEur[to] / r.perEur[from];
}

export type Spec = {
  id: string;
  symbol: string;
  name: string;
  group: "Currency pairs" | "Metals" | "Share CFDs";
  fx: boolean;
  base?: RateCurrency;
  quote: RateCurrency;
  /** units of the underlying in one lot, parsed from the published contract description */
  contract: number;
  contractLabel: string;
  /** size of one pip; only fixed by convention for currency pairs */
  pip: number | null;
};

/** Offer by name only the instruments whose published contract description states a lot size. */
export const SPECS: Spec[] = instruments.flatMap((i): Spec[] => {
  const m = /1 (?:standard )?lot = ([\d,]+)/.exec(i.contract);
  if (!m) return [];
  const contract = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(contract) || contract <= 0) return [];
  const quote = isRateCurrency(i.quote) ? i.quote : "USD";
  if (i.class === "forex") {
    if (!isRateCurrency(i.base)) return [];
    return [{ id: i.slug, symbol: i.symbol, name: i.name, group: "Currency pairs", fx: true, base: i.base, quote, contract, contractLabel: i.contract, pip: quote === "JPY" ? 0.01 : 0.0001 }];
  }
  if (i.class === "metals") return [{ id: i.slug, symbol: i.symbol, name: i.name, group: "Metals", fx: false, quote, contract, contractLabel: i.contract, pip: null }];
  if (i.class === "equities") return [{ id: i.slug, symbol: i.symbol, name: i.name, group: "Share CFDs", fx: false, quote, contract, contractLabel: i.contract, pip: null }];
  return [];
});

export const CUSTOM_ID = "custom";
export const DEFAULT_INSTRUMENT = "eur-usd";

/* ---- parsing and validation ------------------------------------------------ */

export type Parsed = { ok: true; n: number; error?: undefined } | { ok: false; n: number; error: string };

type Bounds = { label: string; min?: number; max?: number; gt?: number; integer?: boolean };

/** Parse what the visitor typed. A decimal comma is accepted; thousands separators are not. */
export function parse(raw: string, b: Bounds): Parsed {
  const s = raw.replace(/\s/g, "").replace("−", "-");
  if (s === "") return { ok: false, n: NaN, error: `${b.label} is needed.` };
  if (!/^-?(\d+[.,]?\d*|[.,]\d+)$/.test(s)) return { ok: false, n: NaN, error: `${b.label}: enter a plain number, for example 1250.5` };
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return { ok: false, n: NaN, error: `${b.label}: enter a plain number.` };
  if (b.integer && !Number.isInteger(n)) return { ok: false, n, error: `${b.label} must be a whole number.` };
  if (b.gt !== undefined && !(n > b.gt)) return { ok: false, n, error: `${b.label} must be greater than ${fmt(b.gt)}.` };
  if (b.min !== undefined && n < b.min) return { ok: false, n, error: `${b.label} must be at least ${fmt(b.min, 0, 4)}.` };
  if (b.max !== undefined && n > b.max) return { ok: false, n, error: `${b.label} must be at most ${fmt(b.max, 0, 4)}.` };
  return { ok: true, n };
}

/* ---- formatting ------------------------------------------------------------- */

const cache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number): Intl.NumberFormat {
  const k = `${min}:${max}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", { minimumFractionDigits: min, maximumFractionDigits: Math.max(min, max) });
    cache.set(k, f);
  }
  return f;
}

/** A number with thousands separators and a true minus sign. */
export function fmt(n: number, min = 0, max = 2): string {
  if (!Number.isFinite(n)) return "n/a";
  const v = Object.is(n, -0) ? 0 : n;
  return nf(min, max).format(v).replace("-", "−");
}

/** An amount of money: two decimals (none for yen) followed by the ISO code. */
export function money(n: number, ccy: string): string {
  const dp = ccy === "JPY" ? 0 : 2;
  return `${fmt(n, dp, dp)} ${ccy}`;
}

/** Signed money, with + or − always shown. */
export function signedMoney(n: number, ccy: string): string {
  const s = money(Math.abs(n), ccy);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

/** An exchange rate to six significant figures. */
export function fmtRate(n: number): string {
  if (!Number.isFinite(n)) return "n/a";
  return new Intl.NumberFormat("en-GB", { minimumSignificantDigits: 5, maximumSignificantDigits: 6 }).format(n);
}

/** Decimal places implied by a pip or point size (0.0001 → 4). */
export function decimalsOf(step: number): number {
  if (!(step > 0)) return 2;
  return Math.min(8, Math.max(0, Math.round(-Math.log10(step))));
}

/** A price shown to one decimal beyond the pip. */
export function fmtPrice(n: number, pip: number): string {
  const d = decimalsOf(pip);
  return fmt(n, d, d + 1);
}

export function pct(n: number, max = 2): string {
  return `${fmt(n, 0, max)}%`;
}

/** A plain string for prefilling an input (no separators). */
export function plain(n: number, dp: number): string {
  return n.toFixed(dp);
}

export function fixingDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "1 lot", "0.4 lots". */
export function lotsText(n: number): string {
  return `${fmt(n, 0, 4)} ${n === 1 ? "lot" : "lots"}`;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
