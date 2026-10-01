"use client";

import { useState } from "react";
import { clamp, fmt, fmtRate, lotsText, money, parse } from "./calc";
import { useCalc } from "./store";
import { accountCurrency, AccountCurrencyField, DASH, Figure, Headline, Inputs, InstrumentFields, Live, NumField, Outcome, RangeField, resolveSpec, Rows, SimulationNote, ToolLayout, useConversion, type Step, type ToolProps } from "./ui";

/**
 * The drift is a CSS animation, so the global reduced-motion rules
 * (prefers-reduced-motion, data-motion="reduced") leave it as a still frame
 * of the moment of entry. It can also be paused by hand.
 */
const CSS = `
@keyframes gxt-quotes {
  0%, 12% { transform: translateY(0); }
  50%, 62% { transform: translateY(calc(var(--gap) * -1)); }
  78% { transform: translateY(calc(var(--gap) * -1.3)); }
  100% { transform: translateY(0); }
}
.gxt-quotes { animation: gxt-quotes 9s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
.gxt-quotes[data-paused="true"] { animation-play-state: paused; }
[data-effects="low"] .gxt-quotes { animation: none; }
`;

const ENTRY_Y = 118;

export function SpreadVisualizer({ meta, rates }: ToolProps) {
  const [calc, set] = useCalc();
  const inst = resolveSpec(calc, true);
  const acct = accountCurrency(calc);
  const conv = useConversion(rates, inst.quote, acct);
  const [spreadRaw, setSpreadRaw] = useState("2");
  const [paused, setPaused] = useState(false);

  const spread = parse(spreadRaw, { label: "Spread", min: 0, max: 1000 });
  const lots = parse(calc.lots, { label: "Lots", gt: 0, max: 100000 });

  let r: { pipAcct: number; cost: number; priceGap: number } | null = null;
  if (spread.ok && lots.ok && inst.ok && conv.rate !== null) {
    const pipAcct = inst.pip.n * inst.contract.n * conv.rate;
    r = { pipAcct, cost: spread.n * pipAcct * lots.n, priceGap: spread.n * inst.pip.n };
  }
  const gap = spread.ok ? clamp(spread.n * 13, 6, 78) : 26;

  const steps: Step[] | null = r && conv.rate !== null
    ? [
        { what: "Spread as a price difference (ask − bid)", calc: `${fmt(spread.n, 0, 2)} pips × ${fmt(inst.pip.n, 0, 6)} = ${fmt(r.priceGap, 0, 6)}` },
        { what: `Value of one pip on one lot, in ${acct}`, calc: `${fmt(inst.pip.n, 0, 6)} × ${fmt(inst.contract.n)}${conv.kind !== "same" ? ` × ${fmtRate(conv.rate)}` : ""} = ${money(r.pipAcct, acct)}` },
        { what: "Cost to enter (spread × pip value × lots)", calc: `${fmt(spread.n, 0, 2)} × ${fmt(r.pipAcct, 2, 4)} × ${fmt(lots.n, 0, 4)} = ${money(r.cost, acct)}` },
        { what: "Move needed to break even", calc: `${fmt(spread.n, 0, 2)} pips: the bid must rise to the price you bought at` },
      ]
    : null;

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        "The spread stays the same from entry to exit. In practice it varies, and it tends to widen around news, at the daily rollover and when a market is thin.",
        "A buy is filled at the ask and valued at the bid; a sell is filled at the bid and valued at the ask. Either way a new position starts behind by the spread.",
        "Commission and overnight financing are separate costs. The Cost Lab adds all three.",
        "The diagram is a schematic of the mechanism. It is not a chart of any price.",
      ]}
    >
      <Inputs>
        <RangeField id="spread" label="Spread" unit="pips" value={spreadRaw} onChange={setSpreadRaw} error={spread.error} min={0} max={1000} sliderMax={8} step={0.1} hint="Type the spread you see on your platform." />
        <NumField id="lots" label="Position size" unit="lots" value={calc.lots} onChange={(v) => set({ lots: v })} error={lots.error} step={0.01} min={0} />
        <InstrumentFields calc={calc} set={set} inst={inst} fxOnly />
        <AccountCurrencyField calc={calc} set={set} />
        {conv.field}
      </Inputs>

      <Outcome>
        <Live className="grid gap-21 sm:grid-cols-2">
          <Headline label="Cost to enter" value={r ? money(r.cost, acct) : DASH} tone={r && r.cost > 0 ? "neg" : undefined} sub={r ? `paid through the price on ${lotsText(lots.n)} of ${inst.symbol}` : "Complete the inputs above."} />
          <Headline label="Move needed to break even" value={spread.ok ? fmt(spread.n, 0, 2) : DASH} unit="pips" sub={spread.ok ? "in your favour, before any other cost" : undefined} />
        </Live>

        <Figure
          className="!mt-34"
          caption={
            <>
              Schematic, not a price chart. A buy is filled at the ask (the dashed entry line). The position is valued at the bid, which starts {spread.ok ? fmt(spread.n, 0, 2) : "the spread in"} pips lower: that gap is the cost. Only when the bid has risen to the entry line does the trade break even.{" "}
              {paused ? "The motion is paused." : "The two quotes drift upwards together to show that moment, then return."}
            </>
          }
        >
          <style>{CSS}</style>
          <div aria-hidden className="relative h-[233px] select-none overflow-hidden border-y border-line bg-paper">
            {/* fixed: the price at which the buy was filled */}
            <div className="absolute inset-x-0 border-t border-dashed border-ink" style={{ top: ENTRY_Y }} />
            <span className="label absolute left-8 !text-ink" style={{ top: ENTRY_Y - 21 }}>
              Your entry
            </span>
            <span className="absolute left-8 text-xs text-ink-3" style={{ top: ENTRY_Y + 5 }}>
              break-even level
            </span>

            {/* moving: the two quotes */}
            <div className="gxt-quotes absolute inset-x-0" data-paused={paused} style={{ top: ENTRY_Y, ["--gap" as string]: `${gap}px` }}>
              <div className="absolute left-[45%] right-[5%] top-0 bg-neg" style={{ height: gap, opacity: 0.14 }} />
              <div className="absolute left-[45%] right-[5%] top-0 h-[2px] bg-ink" />
              <div className="absolute left-[45%] right-[5%] h-[2px] bg-neg" style={{ top: gap }} />
              <span className="absolute left-[45%] whitespace-nowrap text-xs font-semibold text-ink" style={{ top: -20 }}>
                ASK <span className="font-normal text-ink-3">· you buy</span>
              </span>
              <span className="absolute left-[45%] whitespace-nowrap text-xs font-semibold text-neg" style={{ top: gap + 5 }}>
                BID <span className="font-normal text-ink-3">· you sell</span>
              </span>
              <span className="num absolute right-[5%] whitespace-nowrap text-xs text-neg" style={{ top: gap + 5 }}>
                {spread.ok ? `${fmt(spread.n, 0, 2)} pips` : ""}
              </span>
            </div>
          </div>
          <button type="button" className="btn btn-quiet mt-8 -ml-13" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume motion" : "Pause motion"}
          </button>
        </Figure>

        <Live>
          <Rows
            className="mt-13"
            rows={[
              { label: "Position value the instant after entry", value: r ? `−${money(r.cost, acct)}` : DASH, tone: r && r.cost > 0 ? "neg" : undefined },
              { label: "Value of one pip at this size", value: r ? money(r.pipAcct * lots.n, acct) : DASH },
              { label: "Spread as a price difference", value: r ? fmt(r.priceGap, 0, 6) : DASH },
            ]}
          />
        </Live>
        <SimulationNote>The spread is an input here, not a GIO4X quote.</SimulationNote>
        {conv.note && <div className="mt-8">{conv.note}</div>}
      </Outcome>
    </ToolLayout>
  );
}
