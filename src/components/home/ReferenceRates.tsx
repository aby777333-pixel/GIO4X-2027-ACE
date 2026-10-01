import Link from "next/link";
import { Change, Sparkline } from "@/components/ui/Data";
import { DataNote } from "@/components/ui/Page";
import { crossChange, crossRate, crossSeries, formatFixingDate, formatRate, getReferenceRates, RATES_SOURCE, type RateCurrency } from "@/lib/rates";

const PAIRS: [RateCurrency, RateCurrency, string][] = [
  ["EUR", "USD", "eur-usd"],
  ["GBP", "USD", "gbp-usd"],
  ["USD", "JPY", "usd-jpy"],
  ["USD", "CHF", "usd-chf"],
  ["AUD", "USD", "aud-usd"],
  ["USD", "CAD", "usd-cad"],
];

/**
 * The Market Pulse, honestly labelled: ECB daily reference fixings for the
 * major pairs with the change from the previous fixing and a 21-fixing shape.
 * If the provider is unreachable the module says so; it never shows a number
 * it cannot source.
 */
export async function ReferenceRates() {
  const r = await getReferenceRates();

  return (
    <div>
      {r.status === "ok" ? (
        <>
          <ul className="grid grid-cols-2 border-l border-t border-line md:grid-cols-3 xl:grid-cols-6">
            {PAIRS.map(([b, q, slug], i) => {
              const series = crossSeries(r, b, q).slice(-21);
              return (
                <li key={slug} className="border-b border-r border-line" data-reveal style={{ ["--i" as string]: i }}>
                  <Link href={`/markets/forex/${slug}`} className="group block p-21 transition-colors duration-fast hover:bg-surface">
                    <span className="flex items-baseline justify-between gap-8">
                      <span className="text-sm font-semibold tracking-[0.04em]">
                        {b}/{q}
                      </span>
                      <Change value={crossChange(r, b, q, 1)} className="text-xs" />
                    </span>
                    <span className="num mt-13 block font-display text-xl font-light">{formatRate(crossRate(r, b, q), q)}</span>
                    <Sparkline values={series} width={144} height={34} className="mt-13 w-full" label={`${b}/${q} reference fixings, last 21 working days`} />
                  </Link>
                </li>
              );
            })}
          </ul>
          <DataNote className="mt-13" status="reference" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} updated={formatFixingDate(r.date)}>
            Daily fixings, not live or tradable prices. Change is versus the previous fixing.
          </DataNote>
        </>
      ) : (
        <div className="panel-quiet p-34">
          <p className="h4">Reference rates are temporarily unavailable.</p>
          <p className="mt-8 max-w-measure text-sm text-ink-2">
            The provider of the ECB daily fixings could not be reached ({r.reason.toLowerCase()}). Rather than show stale figures, this panel stays empty until the next successful update.
          </p>
          <DataNote className="mt-13" status="unavailable" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} />
        </div>
      )}
    </div>
  );
}
