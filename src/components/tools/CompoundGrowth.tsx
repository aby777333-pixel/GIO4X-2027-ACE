"use client";

import { useState } from "react";
import { fmt, money, parse, pct, signedMoney } from "./calc";
import { useCalc } from "./store";
import { accountCurrency, AccountCurrencyField, DASH, Figure, Headline, Inputs, Live, NumField, Outcome, RangeField, SimulationNote, ToolLayout, type Step, type ToolProps } from "./ui";
import { Plot } from "./viz";

const signedPct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${pct(Math.abs(n))}`;

export function CompoundGrowth({ meta }: ToolProps) {
  const [calc, set] = useCalc();
  const acct = accountCurrency(calc);
  const [rateRaw, setRateRaw] = useState("2");
  const [periodsRaw, setPeriodsRaw] = useState("12");

  const start = parse(calc.balance, { label: "Starting balance", gt: 0, max: 1e12 });
  const rate = parse(rateRaw, { label: "Rate", min: -100, max: 100 });
  const periods = parse(periodsRaw, { label: "Periods", min: 1, max: 240, integer: true });

  let r: { factor: number; power: number; end: number; opp: number; path: [number, number][]; oppPath: [number, number][]; lo: number; hi: number } | null = null;
  if (start.ok && rate.ok && periods.ok) {
    const factor = 1 + rate.n / 100;
    const oppFactor = 1 - rate.n / 100;
    const path: [number, number][] = [];
    const oppPath: [number, number][] = [];
    for (let i = 0; i <= periods.n; i++) {
      path.push([i, start.n * factor ** i]);
      oppPath.push([i, start.n * oppFactor ** i]);
    }
    const all = [...path, ...oppPath].map((p) => p[1]);
    r = { factor, power: factor ** periods.n, end: path[periods.n][1], opp: oppPath[periods.n][1], path, oppPath, lo: Math.min(...all), hi: Math.max(...all) };
  }
  const down = rate.ok && rate.n < 0;
  const flat = rate.ok && rate.n === 0;

  const steps: Step[] | null = r
    ? [
        { what: "Factor applied each period (1 + rate)", calc: `1 ${rate.n < 0 ? "−" : "+"} ${pct(Math.abs(rate.n))} = ${fmt(r.factor, 0, 4)}` },
        { what: `Applied ${fmt(periods.n)} times`, calc: `${fmt(r.factor, 0, 4)}^${fmt(periods.n)} = ${fmt(r.power, 0, 6)}` },
        { what: "Balance at the end", calc: `${fmt(start.n, 2, 2)} × ${fmt(r.power, 0, 6)} = ${money(r.end, acct)}` },
        { what: "Change from the start", calc: `${fmt(r.end, 2, 2)} − ${fmt(start.n, 2, 2)} = ${signedMoney(r.end - start.n, acct)} (${signedPct((r.power - 1) * 100)})` },
        ...(flat ? [] : [{ what: `The same rate with the opposite sign (${signedPct(-rate.n)})`, calc: `${fmt(start.n, 2, 2)} × ${fmt(1 - rate.n / 100, 0, 4)}^${fmt(periods.n)} = ${money(r.opp, acct)}` }]),
      ]
    : null;

  const span = r ? r.hi - r.lo || r.hi * 0.1 || 1 : 1;
  const yLo = r ? Math.max(0, r.lo - span * 0.14) : 0;
  const yHi = r ? r.hi + span * 0.14 : 1;
  const compact = (v: number) => new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  const n = periods.ok ? periods.n : 1;

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        "A mathematical illustration, not a projection of returns. No trading result arrives as a constant rate, period after period.",
        "The same rate is applied to the whole balance every period, with nothing added or withdrawn and no costs.",
        "The opposite-sign path is always drawn beside the one you entered, because a rate is as easily negative as positive.",
        "A gain of a given percentage followed by a loss of the same percentage does not return to the start: it ends below it.",
      ]}
    >
      <Inputs legend="A constant rate, repeated">
        <NumField id="start" label="Starting balance" unit={acct} value={calc.balance} onChange={(v) => set({ balance: v })} error={start.error} step={100} min={0} />
        <AccountCurrencyField calc={calc} set={set} />
        <RangeField id="rate" label="Rate per period" unit="%" value={rateRaw} onChange={setRateRaw} error={rate.error} min={-100} max={100} sliderMin={-20} sliderMax={20} step={0.5} hint="Negative rates are as valid as positive ones." />
        <RangeField id="periods" label="Number of periods" value={periodsRaw} onChange={setPeriodsRaw} error={periods.error} min={1} max={240} sliderMax={60} step={1} hint="A period is whatever you decide: a week, a month." />
      </Inputs>

      <Outcome>
        <Live className="grid gap-21 sm:grid-cols-2">
          <Headline
            label={rate.ok && periods.ok ? `After ${fmt(periods.n)} periods at ${signedPct(rate.n)}` : "Balance at the end"}
            value={r ? money(r.end, acct) : DASH}
            tone={down ? "neg" : undefined}
            sub={r ? `${signedMoney(r.end - start.n, acct)} (${signedPct((r.power - 1) * 100)}) from the start` : "Complete the inputs above."}
          />
          <Headline
            label={rate.ok && !flat ? `The same at ${signedPct(-rate.n)}` : "The opposite sign"}
            value={r && !flat ? money(r.opp, acct) : DASH}
            tone={!down && !flat ? "neg" : undefined}
            sub={r && !flat ? `${signedMoney(r.opp - start.n, acct)} from the start` : flat ? "A rate of zero leaves the balance unchanged." : undefined}
          />
        </Live>

        <Figure
          className="!mt-34"
          caption={
            r
              ? `Balance by period. Solid line: ${signedPct(rate.n)} per period, ending at ${money(r.end, acct)}.${flat ? "" : ` Dashed line: ${signedPct(-rate.n)} per period, ending at ${money(r.opp, acct)}.`} The dotted line is the starting balance. An illustration of arithmetic, not a projection of returns.`
              : "Balance by period, once the inputs are complete."
          }
        >
          <Plot
            x={[0, n]}
            y={[yLo, yHi]}
            xLabel="Period"
            yLabel={`Balance, ${acct}`}
            xTicks={[...new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n])].map((v) => ({ at: v, label: String(v) }))}
            yTicks={r ? [r.lo, start.n, r.hi].filter((v, i, a) => a.findIndex((w) => compact(w) === compact(v)) === i).map((v) => ({ at: v, label: compact(v) })) : []}
            refY={r ? start.n : undefined}
            series={
              r
                ? [
                    ...(flat ? [] : [{ points: r.oppPath, tone: down ? ("ink" as const) : ("neg" as const), dashed: true }]),
                    { points: r.path, tone: down ? ("neg" as const) : ("ink" as const), width: 2 },
                  ]
                : []
            }
            points={
              r
                ? [
                    { x: n, y: r.end, label: money(r.end, acct), tone: down ? "neg" : "ink", place: "left", v: down ? "below" : "above" },
                    ...(flat ? [] : [{ x: n, y: r.opp, label: money(r.opp, acct), tone: down ? ("ink" as const) : ("neg" as const), place: "left" as const, v: down ? ("above" as const) : ("below" as const) }]),
                  ]
                : []
            }
          />
        </Figure>

        <SimulationNote>A mathematical illustration, not a projection of returns.</SimulationNote>
      </Outcome>
    </ToolLayout>
  );
}
