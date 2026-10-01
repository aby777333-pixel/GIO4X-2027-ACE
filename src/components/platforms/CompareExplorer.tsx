"use client";

import { useState } from "react";
import { compareRows, needs, platformOrder, platforms, type NeedKey } from "@/data/platforms";
import { FactCell, MatrixLegend } from "./FactState";

/**
 * "What matters to you?" + the comparison matrix. Choosing a need brings the
 * relevant rows forward (a marker, a rule and a label: not colour alone) and
 * reports how many of them are documented for each platform. It never ranks.
 */
export function CompareExplorer() {
  const [selected, setSelected] = useState<NeedKey[]>([]);
  const toggle = (k: NeedKey) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const matches = (rowNeeds: NeedKey[]) => selected.length > 0 && rowNeeds.some((n) => selected.includes(n));
  const matched = compareRows.filter((r) => matches(r.needs));

  const summary = platformOrder.map((k) => {
    const documented = matched.filter((r) => r[k].status === "verified").length;
    return { k, documented, pending: matched.length - documented };
  });

  return (
    <div>
      <div id="matters" className="scroll-mt-[8rem]">
        <fieldset>
          <legend className="h3">What matters to you?</legend>
          <p className="mt-8 max-w-measure text-sm text-ink-2">Choose any number. The rows that bear on your choice are marked in the matrix below.</p>
          <div className="mt-21 flex flex-wrap gap-8">
            {needs.map((n) => {
              const on = selected.includes(n.key);
              return (
                <button
                  key={n.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(n.key)}
                  className={`inline-flex min-h-[2.75rem] items-center gap-8 rounded-sm border px-13 text-sm font-medium transition-colors duration-fast ${
                    on ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-2 hover:border-ink hover:text-ink"
                  }`}
                >
                  <span aria-hidden className={`h-8 w-8 border ${on ? "border-bg bg-bg" : "border-ink-3"}`} />
                  {n.label}
                </button>
              );
            })}
            {selected.length > 0 && (
              <button type="button" onClick={() => setSelected([])} className="btn btn-quiet">
                Clear
              </button>
            )}
          </div>
        </fieldset>

        <p className="mt-21 min-h-[3rem] max-w-measure text-sm text-ink-2" aria-live="polite">
          {selected.length === 0
            ? "Nothing selected: every row is shown with equal weight."
            : `${matched.length} ${matched.length === 1 ? "row bears" : "rows bear"} on your choice. ${summary
                .map((s) => `${platforms[s.k].name}: ${s.documented} documented${s.pending ? `, ${s.pending} not yet published` : ""}`)
                .join(". ")}. A count of rows is not a score; read the rows.`}
        </p>
      </div>

      <div id="matrix" className="mt-34 scroll-mt-[8rem]">
        <MatrixLegend />
        <p className="mt-8 text-xs text-ink-3">No verified cell currently uses ○ or —. They are kept in the legend so that a difference or an absence can be shown the moment one is confirmed.</p>
        {/* mobile: one dimension at a time, both platforms stacked, nothing off-screen */}
        <dl className="mt-21 border-t border-line-strong md:hidden">
          {compareRows.map((r) => {
            const on = matches(r.needs);
            return (
              <div key={r.key} className={`border-b border-line py-13 ${on ? "bg-brand-soft px-8" : ""}`}>
                <dt className="font-medium text-ink">
                  {r.label}
                  {on && <span className="ml-8 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-accent">Matters to you</span>}
                </dt>
                {platformOrder.map((k) => (
                  <dd key={k} className="mt-8 grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-8">
                    <span className="label pt-3">{platforms[k].name}</span>
                    <FactCell fact={r[k]} />
                  </dd>
                ))}
              </div>
            );
          })}
        </dl>

        <div className="scroll-x mt-21 hidden md:block">
          <table className="table-gx min-w-[44rem]">
            <caption className="sr-only">MetaTrader 5 and 777 Raptor compared across {compareRows.length} dimensions</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[24%]">
                  Dimension
                </th>
                {platformOrder.map((k) => (
                  <th key={k} scope="col" className="w-[38%]">
                    <span className="block font-display text-lg font-normal normal-case tracking-normal text-ink">{platforms[k].name}</span>
                    <span className="block font-sans normal-case tracking-normal text-ink-3">{platforms[k].role}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareRows.map((r) => {
                const on = matches(r.needs);
                return (
                  <tr key={r.key} data-match={on || undefined}>
                    <th scope="row" className={`!whitespace-normal !border-line !py-13 !pl-13 !align-top !text-[0.8125rem] !font-medium !normal-case !tracking-normal !text-ink ${on ? "bg-brand-soft" : ""}`}>
                      {r.label}
                      {on && <span className="mt-3 block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-accent">Matters to you</span>}
                    </th>
                    {platformOrder.map((k) => (
                      <td key={k} className={`!h-auto !py-13 !align-top ${on ? "bg-brand-soft" : ""}`}>
                        <FactCell fact={r[k]} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
