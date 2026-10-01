import Link from "next/link";
import { Change } from "@/components/ui/Data";
import { DataNote } from "@/components/ui/Page";
import { indicativeNote } from "@/config/legal";
import { instrumentHref, type AssetClass, type Instrument } from "@/data/instruments";
import { crossChange, crossRate, formatFixingDate, formatRate, RATES_SOURCE, type ReferenceRates } from "@/lib/rates";
import { ratePair } from "./graph";

/**
 * The instruments of one asset class with their indicative conditions as
 * previously published by GIO4X. Where both legs of a pair are covered by the
 * ECB fixings, two reference columns are added and labelled as such.
 */
export function InstrumentTable({ cls, list, rates }: { cls: AssetClass; list: Instrument[]; rates?: ReferenceRates }) {
  const hasPairs = list.some((i) => ratePair(i));
  const showRef = hasPairs && rates?.status === "ok";
  return (
    <div>
      <div className="scroll-x">
        <table className={`table-gx ${showRef ? "min-w-[34rem] sm:min-w-[52rem]" : "min-w-0 sm:min-w-[40rem]"}`}>
          <caption className="sr-only">
            {cls.name}: instruments and indicative trading conditions{showRef ? ", with ECB reference fixings" : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col">Symbol</th>
              <th scope="col" className="max-sm:hidden">
                Instrument
              </th>
              <th scope="col" className="!text-right">
                Spread from
              </th>
              <th scope="col" className="!text-right">
                Leverage
              </th>
              <th scope="col" className="!text-right">
                Min. lot
              </th>
              {showRef && (
                <>
                  <th scope="col" className="!border-l !border-l-line !pl-13 !text-right">
                    Ref. fixing
                  </th>
                  <th scope="col" className="!pr-0 !text-right">
                    1 fixing
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {list.map((i) => {
              const p = ratePair(i);
              return (
                <tr key={i.slug} className="group">
                  <th scope="row" className="!border-line !py-0 !normal-case !tracking-normal">
                    <Link href={instrumentHref(i)} title={i.name} className="num flex min-h-[2.75rem] items-center text-[0.9375rem] font-semibold tracking-[0.02em] text-ink transition-colors duration-fast group-hover:text-[var(--tone,var(--accent))]">
                      {i.symbol}
                    </Link>
                  </th>
                  <td className="text-sm text-ink-2 max-sm:hidden">
                    <Link href={instrumentHref(i)} tabIndex={-1} className="block whitespace-nowrap py-8">
                      {i.name}
                    </Link>
                  </td>
                  <td className="num whitespace-nowrap text-right text-[0.9375rem] font-medium">
                    {i.conditions.spreadFrom} <span className="text-xs font-normal text-ink-3">{cls.spreadUnit}</span>
                  </td>
                  <td className="num text-right text-[0.9375rem] font-medium">{i.conditions.leverage}</td>
                  <td className="num text-right text-[0.9375rem] font-medium">{i.conditions.minLot}</td>
                  {showRef && rates?.status === "ok" && (
                    <>
                      <td className="num border-l border-l-line !pl-13 text-right text-[0.9375rem] text-ink-2">{p ? formatRate(crossRate(rates, p[0], p[1]), p[1]) : <span className="text-ink-3">n/a</span>}</td>
                      <td className="!pr-0 text-right text-sm">{p ? <Change value={crossChange(rates, p[0], p[1], 1)} /> : <span className="text-ink-3">n/a</span>}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-13 grid gap-8">
        <DataNote status="indicative" source="GIO4X">
          {indicativeNote}
        </DataNote>
        {showRef && rates?.status === "ok" && (
          <DataNote status="reference" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} updated={formatFixingDate(rates.date)}>
            The fixing columns are daily reference rates, not live or tradable prices.
          </DataNote>
        )}
        {hasPairs && rates?.status === "unavailable" && (
          <DataNote status="unavailable" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href}>
            Reference fixing columns are hidden because the provider could not be reached.
          </DataNote>
        )}
      </div>
    </div>
  );
}
