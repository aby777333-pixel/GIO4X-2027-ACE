import Link from "next/link";
import { Change, Sparkline } from "@/components/ui/Data";
import { DataNote } from "@/components/ui/Page";
import { instrumentHref, type Instrument } from "@/data/instruments";
import { crossChange, crossRate, crossSeries, formatFixingDate, formatRate, RATES_SOURCE, type ReferenceRates } from "@/lib/rates";
import { ratePair } from "./graph";

/** The intentional "no data" state for any module built on the ECB fixings. */
export function RatesUnavailable({ reason, className = "" }: { reason: string; className?: string }) {
  return (
    <div className={`panel-quiet p-21 sm:p-34 ${className}`}>
      <p className="h4">Reference rates are temporarily unavailable.</p>
      <p className="mt-8 max-w-measure text-sm text-ink-2">
        The provider of the ECB daily fixings could not be reached ({reason.toLowerCase()}). Rather than show stale or invented figures, this module stays empty until the next successful update.
      </p>
      <DataNote className="mt-13" status="unavailable" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} />
    </div>
  );
}

/**
 * The reference rates board: one row per currency pair with the last ECB
 * fixing, the change over 1, 5 and 21 fixings and the shape of the last 21.
 * Every row leads to the instrument's page.
 */
export function RatesTable({ rates, list, caption = "ECB reference fixings for major currency pairs" }: { rates: ReferenceRates; list: Instrument[]; caption?: string }) {
  if (rates.status !== "ok") return <RatesUnavailable reason={rates.reason} />;
  const rows = list.flatMap((i) => {
    const p = ratePair(i);
    return p ? [{ i, b: p[0], q: p[1] }] : [];
  });
  return (
    <div>
      <div className="scroll-x">
        <table className="table-gx min-w-[35rem] sm:min-w-[44rem]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Pair</th>
              <th scope="col" className="!text-right">
                Last fixing
              </th>
              <th scope="col" className="!text-right">
                1 fixing
              </th>
              <th scope="col" className="!text-right">
                5 fixings
              </th>
              <th scope="col" className="!text-right">
                21 fixings
              </th>
              <th scope="col" className="!pl-21 !pr-0 !text-right">
                Last 21, shape
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ i, b, q }) => (
              <tr key={i.slug} className="group">
                <th scope="row" className="!border-line !py-0 !normal-case !tracking-normal">
                  <Link href={instrumentHref(i)} className="flex min-h-[2.75rem] items-baseline gap-13 py-8">
                    <span className="num text-[0.9375rem] font-semibold tracking-[0.02em] text-ink transition-colors duration-fast group-hover:text-accent">{i.symbol}</span>
                    <span className="hidden text-[0.8125rem] font-normal text-ink-3 sm:inline">{i.name}</span>
                  </Link>
                </th>
                <td className="num text-right text-[0.9375rem] font-medium">{formatRate(crossRate(rates, b, q), q)}</td>
                <td className="text-right text-sm">
                  <Change value={crossChange(rates, b, q, 1)} />
                </td>
                <td className="text-right text-sm">
                  <Change value={crossChange(rates, b, q, 5)} />
                </td>
                <td className="text-right text-sm">
                  <Change value={crossChange(rates, b, q, 21)} />
                </td>
                <td className="!pl-21 !pr-0">
                  <Sparkline values={crossSeries(rates, b, q).slice(-21)} width={144} height={26} className="ml-auto" label={`${i.symbol} reference fixings, last 21 working days`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DataNote className="mt-13" status="reference" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} updated={formatFixingDate(rates.date)}>
        Daily fixings, published once per working day: not live, not tradable and not GIO4X prices. Changes compare the last fixing with the fixing 1, 5 and 21 publications earlier.
      </DataNote>
    </div>
  );
}
