/**
 * MARKET DATA SERVICE — reference foreign-exchange rates.
 *
 * Source: the European Central Bank's euro foreign exchange reference rates,
 * retrieved through the open Frankfurter API. They are published once per
 * TARGET working day (around 16:00 CET) and are reference fixings: NOT live
 * prices, not tradable quotes and not GIO4X prices. Every component that uses
 * this module says so.
 *
 * The UI depends only on the `ReferenceRates` shape below, so the provider can
 * be replaced (e.g. by a licensed feed) without touching components.
 */

export const RATE_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"] as const;
export type RateCurrency = (typeof RATE_CURRENCIES)[number];

export const RATES_SOURCE = {
  name: "European Central Bank reference rates",
  href: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
  via: "Frankfurter API",
  cadence: "Once per working day, around 16:00 CET",
};

export type ReferenceRates =
  | {
      status: "ok";
      /** ISO date of the most recent fixing */
      date: string;
      /** all fixing dates, oldest first */
      dates: string[];
      /** units of each currency per 1 EUR, by date index */
      perEur: Record<RateCurrency, number[]>;
    }
  | { status: "unavailable"; reason: string };

const ENDPOINT = "https://api.frankfurter.dev/v1";

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** ~3 months of daily fixings. Cached for an hour; a failure is reported, never papered over. */
export async function getReferenceRates(): Promise<ReferenceRates> {
  const symbols = RATE_CURRENCIES.filter((c) => c !== "EUR").join(",");
  try {
    const res = await fetch(`${ENDPOINT}/${isoDaysAgo(100)}..?symbols=${symbols}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { status: "unavailable", reason: `Provider responded ${res.status}` };
    const json: unknown = await res.json();
    // runtime validation of an external payload
    if (!json || typeof json !== "object" || !("rates" in json) || typeof (json as { rates: unknown }).rates !== "object") {
      return { status: "unavailable", reason: "Unexpected response shape" };
    }
    const rates = (json as { rates: Record<string, Record<string, unknown>> }).rates;
    const dates = Object.keys(rates)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    if (dates.length < 2) return { status: "unavailable", reason: "Not enough fixings returned" };
    const perEur = Object.fromEntries(RATE_CURRENCIES.map((c) => [c, [] as number[]])) as Record<RateCurrency, number[]>;
    const kept: string[] = [];
    for (const d of dates) {
      const row = rates[d];
      const values = RATE_CURRENCIES.map((c) => (c === "EUR" ? 1 : Number(row?.[c])));
      if (values.some((v) => !Number.isFinite(v) || v <= 0)) continue;
      kept.push(d);
      RATE_CURRENCIES.forEach((c, i) => perEur[c].push(values[i]));
    }
    if (kept.length < 2) return { status: "unavailable", reason: "No complete fixings returned" };
    return { status: "ok", date: kept[kept.length - 1], dates: kept, perEur };
  } catch (e) {
    return { status: "unavailable", reason: e instanceof Error && e.name === "TimeoutError" ? "Provider timed out" : "Provider unreachable" };
  }
}

type Ok = Extract<ReferenceRates, { status: "ok" }>;

export function isRateCurrency(c: string | undefined): c is RateCurrency {
  return !!c && (RATE_CURRENCIES as readonly string[]).includes(c);
}

/** Price of 1 `base` in `quote` at fixing index `i` (default: latest). */
export function crossRate(r: Ok, base: RateCurrency, quote: RateCurrency, i = r.dates.length - 1): number {
  return r.perEur[quote][i] / r.perEur[base][i];
}

/** The pair's fixing history, oldest first. */
export function crossSeries(r: Ok, base: RateCurrency, quote: RateCurrency): number[] {
  return r.dates.map((_, i) => crossRate(r, base, quote, i));
}

/** Percentage change of the pair over the last `n` fixings (1 = previous fixing). */
export function crossChange(r: Ok, base: RateCurrency, quote: RateCurrency, n = 1): number | null {
  const last = r.dates.length - 1;
  if (last - n < 0) return null;
  const now = crossRate(r, base, quote, last);
  const then = crossRate(r, base, quote, last - n);
  return (now / then - 1) * 100;
}

export const PERIODS = [
  { key: "1D", label: "1 fixing", n: 1 },
  { key: "1W", label: "5 fixings", n: 5 },
  { key: "1M", label: "21 fixings", n: 21 },
  { key: "3M", label: "63 fixings", n: 63 },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

/**
 * Relative strength: for each currency, the average percentage change against
 * the other seven over `n` fixings. A descriptive statistic of what already
 * happened in reference rates: not a signal and not a forecast.
 */
export function strength(r: Ok, n: number): { code: RateCurrency; value: number }[] {
  return RATE_CURRENCIES.map((c) => {
    let sum = 0;
    let k = 0;
    for (const o of RATE_CURRENCIES) {
      if (o === c) continue;
      const ch = crossChange(r, c, o, n);
      if (ch === null) continue;
      sum += ch;
      k++;
    }
    return { code: c, value: k ? sum / k : 0 };
  }).sort((a, b) => b.value - a.value);
}

/** Pearson correlation of daily log returns between two pairs over the available window. */
export function correlation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 12) return null;
  const ra: number[] = [];
  const rb: number[] = [];
  for (let i = 1; i < n; i++) {
    ra.push(Math.log(a[i] / a[i - 1]));
    rb.push(Math.log(b[i] / b[i - 1]));
  }
  const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
  const ma = mean(ra);
  const mb = mean(rb);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < ra.length; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    va += (ra[i] - ma) ** 2;
    vb += (rb[i] - mb) ** 2;
  }
  if (va === 0 || vb === 0) return null;
  return cov / Math.sqrt(va * vb);
}

export function formatRate(v: number, quote: string): string {
  const dp = quote === "JPY" ? 3 : 5;
  return v.toFixed(v >= 100 ? 2 : v >= 10 ? 3 : dp > 4 ? 4 : dp);
}

export function formatFixingDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatPct(v: number): string {
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${Math.abs(v).toFixed(2)}%`;
}
