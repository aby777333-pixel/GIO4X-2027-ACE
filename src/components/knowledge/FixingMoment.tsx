import Link from "next/link";
import { Change, RangeBar } from "@/components/ui/Data";
import { DataNote } from "@/components/ui/Page";
import { crossChange, crossRate, crossSeries, formatFixingDate, formatRate, getReferenceRates, RATES_SOURCE } from "@/lib/rates";

/**
 * The publication's one data moment: a sentence built from the latest ECB
 * reference fixing, set like a pull-quote. A fixing is a published reference
 * rate, so the sentence is a statement of record, not a quotation or a view.
 */
export async function FixingMoment() {
  const r = await getReferenceRates();

  if (r.status !== "ok") {
    return (
      <div>
        <p className="label">The reference fixing</p>
        <p className="h3 mt-13 max-w-[24ch]">The fixing could not be loaded just now.</p>
        <p className="mt-13 max-w-measure text-ink-2">The provider of the ECB reference rates did not respond ({r.reason.toLowerCase()}). This space stays empty until the next successful update: no earlier figure is shown in its place.</p>
        <DataNote className="mt-21" status="unavailable" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} />
      </div>
    );
  }

  const rate = crossRate(r, "EUR", "USD");
  const series = crossSeries(r, "EUR", "USD").slice(-21);
  const low = Math.min(...series);
  const high = Math.max(...series);
  const others = [
    { label: "GBP/USD", href: "/markets/forex/gbp-usd", value: formatRate(crossRate(r, "GBP", "USD"), "USD"), change: crossChange(r, "GBP", "USD", 1) },
    { label: "USD/JPY", href: "/markets/forex/usd-jpy", value: formatRate(crossRate(r, "USD", "JPY"), "JPY"), change: crossChange(r, "USD", "JPY", 1) },
  ];

  return (
    <figure>
      <figcaption className="label">The reference fixing · {formatFixingDate(r.date)}</figcaption>
      <blockquote className="mt-21 border-l border-accent pl-21 lg:pl-34">
        <p className="h2 max-w-[20ch] font-light">
          One euro was fixed at <span className="num whitespace-nowrap text-accent">{formatRate(rate, "USD")}</span> US dollars.
        </p>
      </blockquote>
      <dl className="mt-34 grid gap-x-34 gap-y-21 sm:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <dt className="text-xs text-ink-3">EUR/USD, range of the last 21 fixings</dt>
          <dd className="mt-8">
            <RangeBar low={low} high={high} value={rate} />
            <span className="num mt-8 flex justify-between text-xs text-ink-2">
              <span>{formatRate(low, "USD")}</span>
              <span className="flex items-baseline gap-8">
                <span className="text-ink-3">vs previous fixing</span>
                <Change value={crossChange(r, "EUR", "USD", 1)} />
              </span>
              <span>{formatRate(high, "USD")}</span>
            </span>
          </dd>
        </div>
        {others.map((o) => (
          <div key={o.label} className="border-t border-line pt-13 sm:border-l sm:border-t-0 sm:pl-21 sm:pt-0">
            <dt className="text-xs text-ink-3">
              <Link href={o.href} className="link-quiet inline-flex min-h-[2.75rem] items-center sm:min-h-0">
                {o.label}
              </Link>
            </dt>
            <dd className="mt-5 flex items-baseline justify-between gap-8">
              <span className="num font-display text-lg font-light">{o.value}</span>
              <Change value={o.change} className="text-xs" />
            </dd>
          </div>
        ))}
      </dl>
      <DataNote className="mt-21" status="reference" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} updated={formatFixingDate(r.date)}>
        A daily fixing, not a live or tradable price.
      </DataNote>
    </figure>
  );
}
