"use client";

import { useState } from "react";
import { accounts } from "@/data/accounts";
import { clamp, fmt, money, parse, pct } from "./calc";
import { useCalc } from "./store";
import { accountCurrency, AccountCurrencyField, DASH, Figure, Headline, Inputs, Live, NumField, Outcome, RangeField, Rows, SimulationNote, ToolLayout, type Step, type ToolProps } from "./ui";

const MAX_LEVERAGE = Number(/1:(\d+)/.exec(accounts[0].leverage)?.[1] ?? 500);
const STOP_OUT = parseFloat(accounts[0].stopOut);
const MOVE_SCALE = 10; // the price-move ruler runs from 0 to 10%
const REFERENCE = [1, 10, 50, 100, 200, MAX_LEVERAGE];

export function LeverageVisualizer({ meta }: ToolProps) {
  const [calc, set] = useCalc();
  const acct = accountCurrency(calc);
  const [moveRaw, setMoveRaw] = useState("0.5");

  const equity = parse(calc.balance, { label: "Equity", gt: 0, max: 1e12 });
  const leverage = parse(calc.leverage, { label: "Leverage", min: 1, max: MAX_LEVERAGE });
  const move = parse(moveRaw, { label: "Price move", min: 0, max: 100 });

  let r: { exposure: number; change: number; share: number; exhaust: number; left: number } | null = null;
  if (equity.ok && leverage.ok && move.ok) {
    const exposure = equity.n * leverage.n;
    const change = (exposure * move.n) / 100;
    r = { exposure, change, share: (change / equity.n) * 100, exhaust: 100 / leverage.n, left: Math.max(0, equity.n - change) };
  }
  const exhausted = r !== null && r.change >= equity.n;

  const steps: Step[] | null = r
    ? [
        { what: "Exposure (equity × leverage)", calc: `${fmt(equity.n, 2, 2)} × ${fmt(leverage.n)} = ${money(r.exposure, acct)}` },
        { what: `Change in equity for a ${pct(move.n)} price move`, calc: `${fmt(r.exposure, 2, 2)} × ${pct(move.n)} = ${money(r.change, acct)}` },
        { what: "As a share of equity (leverage × move)", calc: `${fmt(leverage.n)} × ${pct(move.n)} = ${pct(r.share)}` },
        { what: "Adverse move that exhausts the equity (1 ÷ leverage)", calc: `1 ÷ ${fmt(leverage.n)} = ${pct(r.exhaust, 3)}` },
      ]
    : null;

  const exhaustAt = r ? clamp(r.exhaust / MOVE_SCALE, 0, 1) * 100 : 100;
  const moveAt = move.ok ? clamp(move.n / MOVE_SCALE, 0, 1) * 100 : 0;

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        "The whole of the equity is used as margin for one position, which is the most exposure that leverage allows. Using less of it means less exposure and a wider margin for error.",
        `Leverage multiplies the effect of a price move on equity in both directions by the same factor. It does not change the likelihood of the move.`,
        `A stop out (published at a ${fmt(STOP_OUT)}% margin level) would close the position before equity reached zero. In a gap the closing price can be worse, and equity can fall further than shown.`,
        "Costs are ignored. No level of leverage is suggested here: the figures you see are the ones you set.",
      ]}
    >
      <Inputs>
        <NumField id="equity" label="Equity" unit={acct} value={calc.balance} onChange={(v) => set({ balance: v })} error={equity.error} step={100} min={0} />
        <AccountCurrencyField calc={calc} set={set} />
        <RangeField id="leverage" label="Leverage (1 : n)" value={calc.leverage} onChange={(v) => set({ leverage: v })} error={leverage.error} min={1} max={MAX_LEVERAGE} step={1} hint="Exposure for each unit of equity." />
        <RangeField id="move" label="Price move against the position" unit="%" value={moveRaw} onChange={setMoveRaw} error={move.error} min={0} max={100} sliderMax={MOVE_SCALE} step={0.05} hint="A move in the instrument’s price, not in equity." />
      </Inputs>

      <Outcome>
        <Live className="grid gap-21 sm:grid-cols-2">
          <Headline
            label={move.ok ? `Equity lost on a ${pct(move.n)} adverse move` : "Equity lost"}
            value={r ? `▼ ${money(Math.min(r.change, equity.n), acct)}` : DASH}
            tone="neg"
            sub={r ? (exhausted ? `The move is larger than the ${pct(r.exhaust, 3)} the equity can absorb: all of it is lost.` : `${pct(r.share)} of the equity; ${money(r.left, acct)} would remain`) : "Complete the inputs above."}
          />
          <Headline label="Exposure" value={r ? money(r.exposure, acct) : DASH} sub={r ? `${fmt(leverage.n)} times the equity` : undefined} />
        </Live>

        <Figure caption={r ? `The whole bar is the exposure. The dark segment is the equity behind it: one part in ${fmt(leverage.n)}. The rest is carried on margin, yet the profit or loss on the whole bar falls on the dark segment alone.` : "The bar compares the equity with the exposure it carries."}>
          <div aria-hidden>
            <div className="relative h-[21px] bg-sunken" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--viz-faint) 0 1px, transparent 1px 6px)" }}>
              <div className="absolute inset-y-0 left-0 bg-ink transition-[width] duration-fast" style={{ width: `max(2px, ${r ? 100 / leverage.n : 100}%)`, opacity: 0.85 }} />
            </div>
            <div className="num mt-5 flex justify-between gap-13 text-xs text-ink-3">
              <span>Equity {equity.ok ? money(equity.n, acct) : ""}</span>
              <span className="text-right">Exposure {r ? money(r.exposure, acct) : ""}</span>
            </div>
          </div>
        </Figure>

        <Figure
          className="!mt-34"
          caption={
            r
              ? `Adverse price move, from 0 to ${MOVE_SCALE}%. The shaded zone begins at ${pct(r.exhaust, 3)}, where the equity is exhausted at 1:${fmt(leverage.n)}. The marker is the move you set, ${pct(move.n)}.${r.exhaust > MOVE_SCALE ? " At this leverage the zone begins beyond the right edge of the ruler." : ""}`
              : "A ruler of adverse price moves, with the move that exhausts the equity marked."
          }
        >
          <div aria-hidden className="relative h-[89px] select-none">
            <div className="absolute inset-x-0 top-[34px] h-[13px] bg-sunken" />
            {r && r.exhaust <= MOVE_SCALE && (
              <>
                <div className="absolute top-[34px] h-[13px] bg-neg transition-[left] duration-fast" style={{ left: `${exhaustAt}%`, right: 0, opacity: 0.8 }} />
                <div className="absolute top-[21px] h-[39px] w-px bg-neg transition-[left] duration-fast" style={{ left: `${exhaustAt}%` }} />
                <span className="num absolute top-0 whitespace-nowrap text-xs font-medium text-neg" style={exhaustAt > 55 ? { right: `${100 - exhaustAt}%` } : { left: `${exhaustAt}%` }}>
                  Equity exhausted at {pct(r.exhaust, 3)}
                </span>
              </>
            )}
            {move.ok && (
              <>
                <div className="absolute top-[28px] h-[25px] w-[3px] -translate-x-1/2 bg-ink transition-[left] duration-fast" style={{ left: `${moveAt}%` }} />
                <span className="num absolute top-[60px] whitespace-nowrap text-xs text-ink" style={moveAt > 70 ? { right: `${100 - moveAt}%` } : { left: `${moveAt}%` }}>
                  Your move {pct(move.n)}
                </span>
              </>
            )}
            <div className="num absolute inset-x-0 bottom-0 flex justify-between text-xs text-ink-3">
              <span />
              <span>{MOVE_SCALE}%</span>
            </div>
          </div>
        </Figure>

        <Live>
          <Rows
            rows={[
              { label: "Adverse move that exhausts the equity", value: r ? pct(r.exhaust, 3) : DASH, tone: "neg" },
              { label: "Equity remaining after the move you set", value: r ? money(r.left, acct) : DASH, tone: exhausted ? "neg" : undefined },
              { label: "The same move in favour of the position", value: r ? `+${money(r.change, acct)}` : DASH },
            ]}
          />
        </Live>

        <div className="scroll-x mt-21">
          <table className="table-gx">
            <caption className="label pb-8 text-left">The same equity at other leverage</caption>
            <thead>
              <tr>
                <th scope="col">Leverage</th>
                <th scope="col">Exposure</th>
                <th scope="col" className="!whitespace-normal !pr-0 !text-right">
                  Move that exhausts the equity
                </th>
              </tr>
            </thead>
            <tbody>
              {REFERENCE.map((l) => (
                <tr key={l}>
                  <th scope="row" className="num !border-line !text-sm !font-normal !normal-case !tracking-normal !text-ink">
                    1:{l}
                  </th>
                  <td className="num">{equity.ok ? money(equity.n * l, acct) : DASH}</td>
                  <td className="num !pr-0 text-right font-medium text-neg">{pct(100 / l, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SimulationNote>Higher leverage is not better leverage: it shortens the distance to the loss of the whole equity.</SimulationNote>
      </Outcome>
    </ToolLayout>
  );
}
