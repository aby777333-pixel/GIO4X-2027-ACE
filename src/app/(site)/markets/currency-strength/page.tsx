import Link from "next/link";
import { bankHref, formatCorr, instrumentBySlug, ratePair } from "@/components/markets/graph";
import { Head } from "@/components/markets/Head";
import { RatesUnavailable } from "@/components/markets/RatesTable";
import { StrengthBoard, type StrengthPeriod } from "@/components/markets/StrengthBoard";
import { JsonLd } from "@/components/seo/JsonLd";
import { DataNote, NextSteps, PageHero } from "@/components/ui/Page";
import { instrumentHref } from "@/data/instruments";
import { getCurrency } from "@/data/knowledge";
import { correlation, crossChange, crossSeries, formatFixingDate, getReferenceRates, PERIODS, RATE_CURRENCIES, RATES_SOURCE, strength } from "@/lib/rates";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "How the eight major currencies have moved against each other over 1, 5, 21 and 63 ECB reference fixings: a ranked view, the full cross-change matrix and the correlation of the seven US dollar pairs. Descriptive statistics of published reference rates, not a signal or a forecast.";

export const metadata = pageMeta({ title: "Currency Strength", description: DESCRIPTION, path: "/markets/currency-strength" });
export const revalidate = 3600;

const USD_PAIRS = ["eur-usd", "gbp-usd", "usd-jpy", "usd-chf", "aud-usd", "usd-cad", "nzd-usd"];
const CORR_WINDOW = 63;

export default async function CurrencyStrengthPage() {
  const rates = await getReferenceRates();

  const currencies = RATE_CURRENCIES.map((code) => {
    const c = getCurrency(code);
    return { code, name: c?.name ?? code, href: c ? `${bankHref(c.bank)}#currency` : "/markets/central-banks" };
  });

  let periods: StrengthPeriod[] = [];
  let corr: { labels: { symbol: string; href: string }[]; m: (number | null)[][]; n: number } | null = null;

  if (rates.status === "ok") {
    const last = rates.dates.length - 1;
    periods = PERIODS.filter((p) => last - p.n >= 0).map((p) => ({
      key: p.key,
      label: p.label,
      n: p.n,
      from: formatFixingDate(rates.dates[last - p.n]),
      ranked: strength(rates, p.n),
      matrix: RATE_CURRENCIES.map((row) => RATE_CURRENCIES.map((col) => (row === col ? null : crossChange(rates, row, col, p.n)))),
    }));

    const take = Math.min(CORR_WINDOW + 1, rates.dates.length);
    const series = USD_PAIRS.flatMap((slug) => {
      const i = instrumentBySlug(slug);
      const pair = i ? ratePair(i) : null;
      return i && pair ? [{ symbol: i.symbol, href: instrumentHref(i), values: crossSeries(rates, pair[0], pair[1]).slice(-take) }] : [];
    });
    corr = {
      labels: series.map((s) => ({ symbol: s.symbol, href: s.href })),
      m: series.map((a, ai) => series.map((b, bi) => (ai === bi ? 1 : correlation(a.values, b.values)))),
      n: take - 1,
    };
  }

  return (
    <>
      <JsonLd data={webPageSchema({ path: "/markets/currency-strength", name: "Currency Strength", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Markets", href: "/markets" },
          { name: "Currency Strength", href: "/markets/currency-strength" },
        ]}
        eyebrow="Reference data"
        title="Currency Strength"
        lead="Which of the eight major currencies gained and which lost against the others, measured on the European Central Bank’s daily reference fixings."
        aside={
          <div className="border-l-2 border-warn pl-13">
            <p className="label">What this is, and is not</p>
            <p className="mt-5 text-sm text-ink">It describes what has already happened in published reference rates. It is not a signal, not a forecast and not a recommendation to trade.</p>
            <p className="mt-5 text-sm text-ink-3">A currency that rose over one period may fall over the next. Nothing here measures that.</p>
          </div>
        }
      />

      <section className="section-quiet" aria-labelledby="strength-title">
        <div className="wrap">
          <h2 id="strength-title" className="sr-only">
            Relative strength
          </h2>
          {rates.status === "ok" && periods.length ? (
            <>
              <StrengthBoard periods={periods} currencies={currencies} />
              <DataNote className="mt-21" status="reference" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} updated={formatFixingDate(rates.date)}>
                {RATES_SOURCE.cadence}. Daily fixings, not live or tradable prices. One “fixing” is one publication; 5 is about a week, 21 about a month, 63 about a quarter.
              </DataNote>
            </>
          ) : (
            <RatesUnavailable reason={rates.status === "unavailable" ? rates.reason : "Not enough fixings returned"} />
          )}
        </div>
      </section>

      {/* correlation of the USD pairs */}
      {corr && corr.labels.length > 1 && rates.status === "ok" && (
        <section className="section hairline bg-paper" aria-labelledby="corr-title">
          <div className="wrap">
            <Head
              id="corr-title"
              eyebrow="Correlation"
              title="How the dollar pairs moved together."
              lead={`Pearson correlation of daily log returns between the seven US dollar pairs over the last ${corr.n} fixings. +1.00: the daily changes lined up. −1.00: they mirrored each other. Near zero: unrelated.`}
            />
            <div className="scroll-x mt-34">
              <table className="num w-full min-w-[44rem] border-collapse text-[0.8125rem]">
                <caption className="sr-only">Correlation of daily log returns between the seven US dollar pairs, from ECB reference rates</caption>
                <thead>
                  <tr>
                    <td className="sticky left-0 z-1 w-[5.5rem] border-b border-line-strong bg-paper" />
                    {corr.labels.map((l) => (
                      <th key={l.symbol} scope="col" className="border-b border-line-strong px-5 py-8 text-right text-xs font-semibold tracking-[0.04em] text-ink-2">
                        {l.symbol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corr.labels.map((row, ri) => (
                    <tr key={row.symbol}>
                      <th scope="row" className="sticky left-0 z-1 border-b border-line bg-paper py-0 text-left">
                        <Link href={row.href} className="inline-flex min-h-[2.75rem] items-center text-xs font-semibold tracking-[0.04em] hover:text-accent">
                          {row.symbol}
                        </Link>
                      </th>
                      {corr.m[ri].map((v, ci) => {
                        if (ri === ci) {
                          return (
                            <td key={ci} className="border-b border-line px-5 text-right text-ink-3">
                              <span aria-hidden>·</span>
                              <span className="sr-only">same pair</span>
                            </td>
                          );
                        }
                        const a = v === null ? 0 : Math.round(Math.abs(v) * 20);
                        return (
                          <td key={ci} className="border-b border-line px-5 text-right font-medium" style={v === null ? undefined : { background: `color-mix(in srgb, var(${v >= 0 ? "--accent" : "--ink-3"}) ${a}%, transparent)` }}>
                            {formatCorr(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-8 max-w-measure text-xs text-ink-3">
              The sign is in the number; the tint only reinforces its size (accent for positive, grey for negative). Pairs quoted with the dollar as base (USD/JPY, USD/CHF, USD/CAD) tend to show negative values against pairs quoted with the dollar as quote, because the same dollar move has the opposite sign in each.
            </p>
            <DataNote className="mt-13" status="reference" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} updated={formatFixingDate(rates.date)}>
              A descriptive statistic over one window. Correlations change, and a past relationship is not a prediction.
            </DataNote>
          </div>
        </section>
      )}

      {/* method */}
      <section className="section-quiet hairline" aria-labelledby="method-title">
        <div className="wrap phi phi-r items-start">
          <h2 id="method-title" className="h3">
            How it is calculated.
          </h2>
          <ol className="max-w-measure border-t border-line">
            {[
              ["The source", "The ECB publishes one euro reference rate per currency each working day. Every other pair is derived as a cross of two of those rates."],
              ["The change", "For each pair, the last fixing is compared with the fixing 1, 5, 21 or 63 publications earlier, as a percentage."],
              ["The strength figure", "A currency’s figure is the simple average of its change against each of the other seven. It is relative: the eight figures describe each other, not an absolute value."],
              ["The limits", "One fixing a day says nothing about what happened between fixings, and reference rates are not the prices at which anyone traded."],
            ].map(([t, d], n) => (
              <li key={t} className="grid grid-cols-[2.125rem_1fr] gap-x-8 border-b border-line py-13">
                <span className="num pt-2 text-xs font-semibold text-prestige-ink">{String(n + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block font-medium">{t}</span>
                  <span className="mt-2 block text-sm text-ink-2">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Asset class", label: "Forex", href: "/markets/forex", note: "The pairs, their structure and indicative conditions." },
          { kind: "Institutions", label: "Central Bank Watch", href: "/markets/central-banks", note: "The banks behind each of the eight currencies." },
          { kind: "Tool", label: "Currency Converter", href: "/tools/currency-converter", note: "Convert at the same ECB reference rates." },
          { kind: "Trust", label: "Data methodology", href: "/trust/data-methodology", note: "What “reference data” means on this site." },
        ]}
      />
    </>
  );
}
