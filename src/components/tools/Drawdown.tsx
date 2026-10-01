"use client";

import { useState } from "react";
import { fmt, money, parse, pct } from "./calc";
import { useCalc } from "./store";
import { accountCurrency, AccountCurrencyField, DASH, Figure, Headline, Inputs, Live, NumField, Outcome, RangeField, SimulationNote, ToolLayout, type Step, type ToolProps } from "./ui";
import { Plot } from "./viz";

const gainFor = (lossPct: number) => (lossPct / (100 - lossPct)) * 100;
const X_MAX = 90;
const Y_MAX = 900;
const CURVE: [number, number][] = Array.from({ length: 91 }, (_, i) => [i, gainFor(i)]);
const TABLE = [5, 10, 20, 30, 50, 75, 90];

export function Drawdown({ meta }: ToolProps) {
  const [calc, set] = useCalc();
  const acct = accountCurrency(calc);
  const [lossRaw, setLossRaw] = useState("20");
  const loss = parse(lossRaw, { label: "Loss", gt: 0, max: 99 });
  const balance = parse(calc.balance, { label: "Balance", gt: 0, max: 1e12 });
  const hasBalance = calc.balance.trim() !== "";

  const gain = loss.ok ? gainFor(loss.n) : null;
  const after = loss.ok && balance.ok ? balance.n * (1 - loss.n / 100) : null;
  const scale = gain !== null ? Math.max(100, gain) : 100;

  const steps: Step[] | null =
    loss.ok && gain !== null
      ? [
          ...(after !== null
            ? [
                { what: "Balance after the loss", calc: `${fmt(balance.n, 2, 2)} × (1 − ${pct(loss.n)}) = ${money(after, acct)}` },
                { what: "Amount needed to return to the start", calc: `${fmt(balance.n, 2, 2)} − ${fmt(after, 2, 2)} = ${money(balance.n - after, acct)}` },
              ]
            : []),
          { what: "Gain required, as a share of what is left", calc: `${pct(loss.n)} ÷ (1 − ${pct(loss.n)}) = ${fmt(loss.n / 100, 0, 4)} ÷ ${fmt(1 - loss.n / 100, 0, 4)} = ${pct(gain)}` },
          { what: "How much larger the gain is than the loss", calc: `${pct(gain)} ÷ ${pct(loss.n)} = ${fmt(gain / loss.n, 2, 2)} times` },
        ]
      : null;

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        "The loss and the recovery are measured on different bases: the loss on the starting balance, the gain on the smaller balance that remains. That is the whole of the asymmetry.",
        "No deposits or withdrawals in between, and no costs.",
        "The curve is arithmetic. It does not say that a recovery will happen, or how long one would take.",
      ]}
    >
      <Inputs legend="A loss of any size">
        <RangeField id="loss" label="Loss from the starting balance" unit="%" value={lossRaw} onChange={setLossRaw} error={loss.error} min={1} max={99} sliderMax={X_MAX} step={1} className="sm:col-span-2" />
        <NumField id="balance" label="Starting balance (optional)" unit={acct} value={calc.balance} onChange={(v) => set({ balance: v })} error={hasBalance ? balance.error : undefined} step={100} min={0} hint="Leave empty to work in percentages only." />
        <AccountCurrencyField calc={calc} set={set} />
      </Inputs>

      <Outcome>
        <Live className="grid gap-21 sm:grid-cols-2">
          <Headline label="Loss" value={loss.ok ? `▼ ${pct(loss.n)}` : DASH} tone="neg" sub={after !== null ? `${money(balance.n, acct)} becomes ${money(after, acct)}` : loss.ok ? "of the starting balance" : "Enter a loss between 0 and 99%."} />
          <Headline label="Gain required to recover" value={gain !== null ? `▲ ${pct(gain)}` : DASH} sub={after !== null && gain !== null ? `${money(balance.n - after, acct)} on a balance of ${money(after, acct)}` : gain !== null ? "of the balance that remains" : undefined} />
        </Live>

        <div aria-hidden className="mt-21 grid gap-8">
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-13">
            <span className="label">Loss</span>
            <span className="block h-[21px] bg-sunken">
              <span className="block h-full bg-neg transition-[width] duration-fast" style={{ width: `${loss.ok ? (loss.n / scale) * 100 : 0}%`, opacity: 0.85 }} />
            </span>
          </div>
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-13">
            <span className="label">Gain needed</span>
            <span className="block h-[21px] bg-sunken">
              <span className="block h-full bg-ink transition-[width] duration-fast" style={{ width: `${gain !== null ? (gain / scale) * 100 : 0}%`, opacity: 0.78 }} />
            </span>
          </div>
        </div>
        <p className="mt-8 text-xs text-ink-3">
          Both bars are drawn to the same scale{gain !== null && loss.ok ? `: the gain needed is ${fmt(gain / loss.n, 2, 2)} times the loss.` : "."}
        </p>

        <Figure
          className="!mt-34"
          caption={
            gain !== null && loss.ok
              ? `Required gain against loss. The dashed line is where a gain equal to the loss would sit; the curve leaves it further behind with every point lost. Your point: a ${pct(loss.n)} loss needs ${pct(gain)}.${loss.n > X_MAX ? " It lies beyond the right edge of the chart." : ""}`
              : "Required gain against loss. The dashed line is where a gain equal to the loss would sit."
          }
        >
          <Plot
            x={[0, X_MAX]}
            y={[0, Y_MAX]}
            xLabel="Loss"
            yLabel="Gain required"
            xTicks={[0, 30, 60, 90].map((v) => ({ at: v, label: `${v}%` }))}
            yTicks={[0, 100, 300, 500, 700, 900].map((v) => ({ at: v, label: `${v}%` }))}
            series={[
              { points: [[0, 0], [X_MAX, X_MAX]], tone: "muted", dashed: true, width: 1 },
              { points: CURVE, tone: "neg", width: 2 },
            ]}
            fills={[{ points: [...CURVE, [X_MAX, X_MAX], [0, 0]], tone: "neg" }]}
            points={gain !== null && loss.ok && loss.n <= X_MAX ? [{ x: loss.n, y: gain, label: `${pct(loss.n, 0)} → ${pct(gain, 1)}`, tone: "ink" }] : []}
          />
        </Figure>

        <div className="scroll-x mt-21">
          <table className="table-gx">
            <caption className="label pb-8 text-left">The same arithmetic at other sizes</caption>
            <thead>
              <tr>
                <th scope="col">Loss</th>
                <th scope="col">Gain required</th>
                <th scope="col" className="!pr-0 !text-right">
                  Gain ÷ loss
                </th>
              </tr>
            </thead>
            <tbody>
              {TABLE.map((l) => (
                <tr key={l}>
                  <th scope="row" className="num !border-line !text-sm !font-normal !normal-case !tracking-normal !text-neg">
                    <span aria-hidden>▼ </span>
                    {l}%
                  </th>
                  <td className="num font-medium">
                    <span aria-hidden>▲ </span>
                    {pct(gainFor(l), 1)}
                  </td>
                  <td className="num !pr-0 text-right">{fmt(gainFor(l) / l, 2, 2)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SimulationNote>Not a forecast of losses or of recovery.</SimulationNote>
      </Outcome>
    </ToolLayout>
  );
}
