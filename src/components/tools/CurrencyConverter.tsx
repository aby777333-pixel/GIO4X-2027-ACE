"use client";

import { useState } from "react";
import { fixingDate, fmt, fmtRate, money, parse, RATE_CURRENCIES, refRate, type RateCurrency } from "./calc";
import { isRateCurrency } from "@/lib/rates";
import { CurrencyOptions, DASH, Headline, Inputs, Live, NumField, Outcome, SelectField, SimulationNote, ToolLayout, useConversion, type Step, type ToolProps } from "./ui";

export function CurrencyConverter({ meta, rates }: ToolProps) {
  const [amountRaw, setAmountRaw] = useState("1000");
  const [from, setFrom] = useState<RateCurrency>("EUR");
  const [to, setTo] = useState<RateCurrency>("USD");
  const conv = useConversion(rates, from, to, "conv");
  const amount = parse(amountRaw, { label: "Amount", min: 0, max: 1e12 });
  const result = amount.ok && conv.rate !== null ? amount.n * conv.rate : null;
  const pick = (set: (c: RateCurrency) => void) => (v: string) => {
    if (isRateCurrency(v)) set(v);
  };

  const steps: Step[] | null =
    result !== null && conv.rate !== null
      ? from === to
        ? [{ what: "Same currency", calc: `${money(amount.n, from)} = ${money(result, to)}` }]
        : [
            ...(rates.status === "ok"
              ? [
                  { what: `${to} per 1 EUR at the fixing`, calc: fmtRate(rates.perEur[to]) },
                  { what: `${from} per 1 EUR at the fixing`, calc: fmtRate(rates.perEur[from]) },
                  { what: `Cross rate: ${to} per 1 ${from}`, calc: `${fmtRate(rates.perEur[to])} ÷ ${fmtRate(rates.perEur[from])} = ${fmtRate(conv.rate)}` },
                ]
              : [{ what: `Rate entered by you: ${to} per 1 ${from}`, calc: fmtRate(conv.rate) }]),
            { what: "Converted amount", calc: `${fmt(amount.n, 2, 2)} × ${fmtRate(conv.rate)} = ${money(result, to)}` },
          ]
      : null;

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        "The European Central Bank publishes one euro reference rate per currency on each working day, at around 16:00 CET. Every other pair here is a cross rate computed from two of them.",
        "A reference fixing is published for information. It is not a dealing rate: nobody is obliged to exchange at it, and a bank, card or broker applies its own rate and charges.",
        "The rate does not move during the day on this page. It changes when the next fixing is published.",
      ]}
    >
      <Inputs legend="An amount and two currencies">
        <NumField id="amount" label="Amount" unit={from} value={amountRaw} onChange={setAmountRaw} error={amount.error} step={100} min={0} className="sm:col-span-2" />
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-13 sm:col-span-2">
          <SelectField id="from" label="From" value={from} onChange={pick(setFrom)}>
            <CurrencyOptions />
          </SelectField>
          <button
            type="button"
            className="btn btn-ghost mt-[1.625rem] w-[2.75rem] !px-0"
            aria-label={`Swap currencies: convert ${to} to ${from} instead`}
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
          >
            <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6h13l-3-3M16 12H3l3 3" />
            </svg>
          </button>
          <SelectField id="to" label="To" value={to} onChange={pick(setTo)}>
            <CurrencyOptions />
          </SelectField>
        </div>
        {conv.field}
      </Inputs>

      <Outcome>
        <Live>
          <Headline
            label={amount.ok ? `${money(amount.n, from)} at ${conv.kind === "manual" ? "the rate you typed" : "the reference rate"}` : "Converted amount"}
            value={result !== null ? money(result, to) : DASH}
            sub={
              conv.rate !== null && from !== to
                ? `1 ${from} = ${fmtRate(conv.rate)} ${to} · 1 ${to} = ${fmtRate(1 / conv.rate)} ${from}${rates.status === "ok" ? ` · fixing of ${fixingDate(rates.date)}` : ""}`
                : from === to
                  ? "The two currencies are the same."
                  : "Type a rate to convert."
            }
          />
        </Live>

        {rates.status === "ok" && amount.ok && (
          <div className="scroll-x mt-21">
            <table className="table-gx">
              <caption className="label pb-8 text-left">
                {money(amount.n, from)} in the other majors, fixing of {fixingDate(rates.date)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Currency</th>
                  <th scope="col">Rate per 1 {from}</th>
                  <th scope="col" className="!pr-0 !text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {RATE_CURRENCIES.filter((c) => c !== from).map((c) => {
                  const rate = refRate(rates, from, c);
                  return (
                    <tr key={c}>
                      <th scope="row" className="!border-line !text-sm !normal-case !tracking-normal !text-ink" style={{ fontWeight: c === to ? 600 : 400 }}>
                        {c}
                      </th>
                      <td className="num">{fmtRate(rate)}</td>
                      <td className="num !pr-0 text-right font-medium">{money(amount.n * rate, c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <SimulationNote>A conversion at a reference fixing, not a quote.</SimulationNote>
        {conv.note && <div className="mt-8">{conv.note}</div>}
        {from === to && rates.status === "ok" && <p className="mt-8 text-xs text-ink-3">Choose two different currencies to see a rate.</p>}
      </Outcome>
    </ToolLayout>
  );
}
