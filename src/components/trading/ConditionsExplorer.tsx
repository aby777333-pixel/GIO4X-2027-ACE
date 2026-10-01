"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { assetClasses, instrumentHref, instruments, type AssetClassKey } from "@/data/instruments";

type Filter = AssetClassKey | "all";

const unitOf = (k: AssetClassKey) => assetClasses.find((a) => a.key === k)?.spreadUnit ?? "";
const classNameOf = (k: AssetClassKey) => assetClasses.find((a) => a.key === k)?.name ?? k;

/**
 * Explore trading conditions: choose an asset class, optionally search, read
 * the table. The default view (Forex) is rendered on the server; filtering
 * happens in the browser. Every figure is an indicative condition, not a price.
 */
export function ConditionsExplorer({ initial = "forex" }: { initial?: Filter }) {
  const [cls, setCls] = useState<Filter>(initial);
  const [q, setQ] = useState("");
  const id = useId();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return instruments.filter((i) => {
      if (cls !== "all" && i.class !== cls) return false;
      if (!needle) return true;
      return [i.symbol, i.code, i.name, ...i.aliases].some((s) => s.toLowerCase().includes(needle));
    });
  }, [cls, q]);

  const elsewhere = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || cls === "all") return 0;
    return instruments.filter((i) => i.class !== cls && [i.symbol, i.code, i.name, ...i.aliases].some((s) => s.toLowerCase().includes(needle))).length;
  }, [cls, q]);

  const options: { key: Filter; label: string }[] = [...assetClasses.map((a) => ({ key: a.key as Filter, label: a.name })), { key: "all", label: "All" }];
  const showClass = cls === "all";

  return (
    <div>
      <div className="flex flex-col gap-21 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p id={`${id}-cls`} className="field-label">
            Asset class
          </p>
          <div className="seg mt-8 hidden lg:inline-flex" role="group" aria-labelledby={`${id}-cls`}>
            {options.map((o) => (
              <button key={o.key} type="button" aria-pressed={cls === o.key} onClick={() => setCls(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
          <select className="select mt-8 lg:hidden" aria-labelledby={`${id}-cls`} value={cls} onChange={(e) => setCls(e.target.value as Filter)}>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field lg:w-[21rem]">
          <label htmlFor={`${id}-q`}>Search instruments</label>
          <input id={`${id}-q`} type="search" className="input" placeholder="Symbol or name, e.g. gold" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
      </div>

      <p className="mt-21 text-sm text-ink-2" aria-live="polite">
        <span className="num font-medium text-ink">{rows.length}</span> {rows.length === 1 ? "instrument" : "instruments"}
        {cls !== "all" ? ` in ${classNameOf(cls)}` : " across all classes"}
        {q.trim() ? ` matching “${q.trim()}”` : ""}.
        {elsewhere > 0 && (
          <>
            {" "}
            <button type="button" className="link" onClick={() => setCls("all")}>
              {elsewhere} more in other classes
            </button>
          </>
        )}
      </p>

      {rows.length > 0 ? (
        <div className="scroll-x mt-13">
          <table className="table-gx min-w-[46rem]">
            <caption className="sr-only">Indicative trading conditions by instrument</caption>
            <thead>
              <tr>
                <th scope="col">Instrument</th>
                {showClass && <th scope="col">Class</th>}
                <th scope="col" className="!text-right">
                  Spread from
                </th>
                <th scope="col" className="!text-right">
                  Leverage up to
                </th>
                <th scope="col" className="!text-right">
                  Minimum lot
                </th>
                <th scope="col" className="!pl-21">
                  Contract
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={`${i.class}-${i.slug}`}>
                  <th scope="row" className="!border-line !py-0 !font-normal !normal-case !tracking-normal">
                    <Link href={instrumentHref(i)} className="group flex min-h-[2.75rem] items-baseline gap-13 py-8">
                      <span className="num text-[0.9375rem] font-semibold text-ink transition-colors duration-fast group-hover:text-accent">{i.symbol}</span>
                      <span className="text-[0.8125rem] text-ink-3">{i.name}</span>
                    </Link>
                  </th>
                  {showClass && <td className="text-sm text-ink-2">{classNameOf(i.class)}</td>}
                  <td className="num text-right text-[0.9375rem] font-medium">
                    {i.conditions.spreadFrom} <span className="text-xs font-normal text-ink-3">{unitOf(i.class)}</span>
                  </td>
                  <td className="num text-right text-[0.9375rem] font-medium">{i.conditions.leverage}</td>
                  <td className="num text-right text-[0.9375rem] font-medium">{i.conditions.minLot}</td>
                  <td className="!pl-21 text-sm text-ink-2">{i.contract}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel-quiet mt-13 p-21">
          <p className="h4">No instrument matches that search.</p>
          <p className="mt-5 text-sm text-ink-2">
            Only instruments with published indicative conditions are listed here. Try a symbol such as EUR/USD, or{" "}
            <button
              type="button"
              className="link"
              onClick={() => {
                setQ("");
                setCls("all");
              }}
            >
              show everything
            </button>
            .
          </p>
        </div>
      )}
    </div>
  );
}
