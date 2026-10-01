"use client";

import Link from "next/link";
import { useState } from "react";
import { Change } from "@/components/ui/Data";
import { formatPct } from "@/lib/rates";

export type StrengthPeriod = {
  key: string;
  label: string;
  n: number;
  /** formatted date of the fixing the period is measured from */
  from: string | null;
  ranked: { code: string; value: number }[];
  /** matrix[row][col]: % change of the row currency against the column currency */
  matrix: (number | null)[][];
};

export type StrengthCurrency = { code: string; name: string; href: string };

const glyph = (v: number) => (Math.abs(v) < 0.005 ? "◆" : v > 0 ? "▲" : "▼");

/**
 * Relative currency strength, with the period switched in the browser from
 * data the server computed once. A ranked bar view (average change against
 * the other seven) and the full 8×8 matrix behind it. Everything is a
 * description of ECB reference fixings that have already been published.
 */
export function StrengthBoard({ periods, currencies }: { periods: StrengthPeriod[]; currencies: StrengthCurrency[] }) {
  const [key, setKey] = useState(periods[Math.min(1, periods.length - 1)].key);
  const p = periods.find((x) => x.key === key) ?? periods[0];
  const byCode = new Map(currencies.map((c) => [c.code, c]));
  const maxAbs = Math.max(0.01, ...p.ranked.map((r) => Math.abs(r.value)));
  const cellMax = Math.max(0.01, ...p.matrix.flat().map((v) => (v === null ? 0 : Math.abs(v))));
  const top = p.ranked[0];
  const bottom = p.ranked[p.ranked.length - 1];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-21 border-b border-line-strong pb-21">
        <fieldset>
          <legend className="label mb-8">Measured over</legend>
          <div className="seg flex w-full sm:inline-flex sm:w-auto">
            {periods.map((x) => (
              <button key={x.key} type="button" aria-pressed={x.key === key} onClick={() => setKey(x.key)} className="!h-[2.75rem] flex-1 justify-center whitespace-nowrap !px-8 sm:!px-13">
                {x.label}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="max-w-[30rem] text-sm text-ink-2" aria-live="polite">
          Over the last {p.label.replace(/^1 fixing$/, "fixing")}
          {p.from ? ` (since ${p.from})` : ""}, {byCode.get(top.code)?.name ?? top.code} rose most on average against the other seven and {byCode.get(bottom.code)?.name ?? bottom.code} fell most.
        </p>
      </div>

      {/* ranked bars */}
      <ol className="mt-8" aria-label={`Currencies ranked by average change over ${p.label}`}>
        {p.ranked.map((r, n) => {
          const c = byCode.get(r.code);
          const w = (Math.abs(r.value) / maxAbs) * 50;
          return (
            <li key={r.code} className="grid grid-cols-[1.3125rem_3rem_1fr_4.75rem] items-center gap-x-8 border-b border-line py-8 sm:grid-cols-[1.3125rem_3.25rem_11rem_1fr_5rem] sm:gap-x-13">
              <span className="num text-xs text-ink-3">{n + 1}</span>
              <Link href={c?.href ?? "/markets/central-banks"} className="num inline-flex min-h-[2.125rem] items-center text-[0.9375rem] font-semibold tracking-[0.04em] hover:text-accent">
                {r.code}
              </Link>
              <span className="hidden text-sm text-ink-3 sm:block">{c?.name}</span>
              <span className="relative block h-[0.8125rem]" aria-hidden>
                <span className="absolute inset-y-[-4px] left-1/2 w-px bg-line-strong" />
                <span
                  className={`absolute inset-y-0 transition-[width] duration-slow ${r.value >= 0 ? "bg-[color-mix(in_srgb,var(--pos)_62%,transparent)]" : "bg-[color-mix(in_srgb,var(--neg)_62%,transparent)]"}`}
                  style={r.value >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
                />
              </span>
              <span className="text-right text-sm font-medium">
                <Change value={r.value} />
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-13 text-xs text-ink-3">Each bar is the currency’s average percentage change against the other seven over the period. Bars are scaled to the largest value shown, so their length compares currencies within a period, not between periods.</p>

      {/* the matrix behind the ranking */}
      <h3 className="h4 mt-55">The matrix behind the ranking</h3>
      <p className="mt-5 max-w-measure text-sm text-ink-2">Read across: each cell is the change of the row currency against the column currency over {p.label}. The bar above is the average of a row.</p>
      <div className="scroll-x mt-13">
        <table className="num w-full min-w-[46rem] border-collapse text-[0.8125rem]">
          <caption className="sr-only">Percentage change of each row currency against each column currency over {p.label} of ECB reference rates</caption>
          <thead>
            <tr>
              <th scope="col" className="label sticky left-0 z-1 w-[5.5rem] whitespace-nowrap border-b border-line-strong bg-bg py-8 text-left">
                <span aria-hidden>Row vs →</span>
                <span className="sr-only">Row currency against column currency</span>
              </th>
              {currencies.map((c) => (
                <th key={c.code} scope="col" className="border-b border-line-strong px-5 py-8 text-right text-xs font-semibold tracking-[0.06em] text-ink-2">
                  <abbr title={c.name} className="no-underline">
                    {c.code}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currencies.map((row, ri) => (
              <tr key={row.code}>
                <th scope="row" className="sticky left-0 z-1 border-b border-line bg-bg py-0 text-left text-xs font-semibold tracking-[0.06em] text-ink">
                  <abbr title={row.name} className="no-underline">
                    {row.code}
                  </abbr>
                </th>
                {currencies.map((col, ci) => {
                  const v = p.matrix[ri][ci];
                  if (ri === ci || v === null) {
                    return (
                      <td key={col.code} className="h-[2.75rem] border-b border-line px-5 text-right text-ink-3">
                        <span aria-hidden>{ri === ci ? "·" : "n/a"}</span>
                        <span className="sr-only">{ri === ci ? "same currency" : "not available"}</span>
                      </td>
                    );
                  }
                  const flat = Math.abs(v) < 0.005;
                  const alpha = Math.round((Math.abs(v) / cellMax) * 22);
                  return (
                    <td
                      key={col.code}
                      className={`h-[2.75rem] whitespace-nowrap border-b border-line px-5 text-right ${flat ? "text-neutral" : v > 0 ? "text-pos" : "text-neg"}`}
                      style={flat ? undefined : { background: `color-mix(in srgb, var(${v > 0 ? "--pos" : "--neg"}) ${alpha}%, transparent)` }}
                    >
                      <span aria-hidden className="mr-2 text-[0.7em]">
                        {glyph(v)}
                      </span>
                      <span className="sr-only">{flat ? "unchanged " : v > 0 ? "up " : "down "}</span>
                      <span className="text-ink">{flat ? "0.00%" : formatPct(v)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-8 text-xs text-ink-3">The glyph and the sign carry the direction; the tint only reinforces the size of the change.</p>
    </div>
  );
}
