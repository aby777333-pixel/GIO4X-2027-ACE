"use client";

import { fmt, fmtRate, money, parse, pct } from "./calc";
import { useCalc } from "./store";
import { accountCurrency, AccountCurrencyField, DASH, Figure, Headline, Inputs, InstrumentFields, Live, NumField, Outcome, RangeField, resolveSpec, Rows, SimulationNote, ToolLayout, useConversion, type Step, type ToolProps } from "./ui";
import { ShareBar } from "./viz";

/** Smallest trade size GIO4X publishes for every account type (src/data/accounts.ts: "0.01 lots"). */
const LOT_STEP = 0.01;

export function PositionSize({ meta, rates }: ToolProps) {
  const [calc, set] = useCalc();
  const inst = resolveSpec(calc);
  const acct = accountCurrency(calc);
  const conv = useConversion(rates, inst.quote, acct);

  const balance = parse(calc.balance, { label: "Balance", gt: 0, max: 1e12 });
  const risk = parse(calc.riskPct, { label: "Risk", gt: 0, max: 100 });
  const stop = parse(calc.stopPips, { label: "Stop distance", gt: 0, max: 1e6 });
  const unit = inst.unit;

  let r: { amount: number; pipQuote: number; pipAcct: number; perLot: number; lots: number; units: number; stepped: number; steppedRisk: number } | null = null;
  if (balance.ok && risk.ok && stop.ok && inst.ok && conv.rate !== null) {
    const amount = (balance.n * risk.n) / 100;
    const pipQuote = inst.pip.n * inst.contract.n;
    const pipAcct = pipQuote * conv.rate;
    const perLot = stop.n * pipAcct;
    const lots = amount / perLot;
    const stepped = Math.floor(lots / LOT_STEP + 1e-9) * LOT_STEP;
    r = { amount, pipQuote, pipAcct, perLot, lots, units: lots * inst.contract.n, stepped, steppedRisk: stepped * perLot };
  }

  const steps: Step[] | null = r && conv.rate !== null
    ? [
        { what: "Amount at risk", calc: `${fmt(balance.n, 2, 2)} × ${pct(risk.n)} = ${money(r.amount, acct)}` },
        { what: `Value of one ${unit} on one lot`, calc: `${fmt(inst.pip.n, 0, 6)} × ${fmt(inst.contract.n)} = ${money(r.pipQuote, inst.quote)}` },
        ...(conv.kind !== "same" ? [{ what: `Converted to ${acct} (${conv.label})`, calc: `${fmt(r.pipQuote, 2, 2)} × ${fmtRate(conv.rate)} = ${money(r.pipAcct, acct)}` }] : []),
        { what: "Loss on one lot if the stop is reached", calc: `${fmt(stop.n)} ${unit}s × ${fmt(r.pipAcct, 2, 4)} = ${money(r.perLot, acct)}` },
        { what: "Position size", calc: `${fmt(r.amount, 2, 2)} ÷ ${fmt(r.perLot, 2, 2)} = ${fmt(r.lots, 2, 4)} lots` },
        { what: "In units of the underlying", calc: `${fmt(r.lots, 2, 4)} × ${fmt(inst.contract.n)} = ${fmt(r.units, 0, 2)}` },
      ]
    : null;

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        "The stop is filled exactly at its level. In a fast or gapping market a stop can be filled beyond it, and the loss is then larger than the amount shown.",
        "Spread, commission and overnight financing are left out. The Cost Lab adds them up.",
        `Position sizes are shown exactly and rounded down to ${fmt(LOT_STEP, 2, 2)} lots, the smallest published trade size.`,
        "The starting figures are placeholders that make the arithmetic visible, not suggested values.",
      ]}
    >
      <Inputs>
        <NumField id="balance" label="Account balance" unit={acct} value={calc.balance} onChange={(v) => set({ balance: v })} error={balance.error} step={100} min={0} />
        <AccountCurrencyField calc={calc} set={set} />
        <RangeField id="risk" label="Risk on this trade" unit="%" value={calc.riskPct} onChange={(v) => set({ riskPct: v })} error={risk.error} min={0.1} max={100} sliderMax={10} step={0.1} hint="Share of the balance lost if the stop is reached." />
        <NumField id="stop" label={`Stop distance (${unit}s)`} unit={`${unit}s`} value={calc.stopPips} onChange={(v) => set({ stopPips: v })} error={stop.error} step={1} min={0} hint="From entry to stop loss." />
        <InstrumentFields calc={calc} set={set} inst={inst} />
        {conv.field}
      </Inputs>

      <Outcome>
        <Live className="grid gap-21 sm:grid-cols-2">
          <Headline label="Position size" value={r ? fmt(r.lots, 2, 2) : DASH} unit="lots" sub={r ? `${fmt(r.units, 0, 0)} units of ${inst.symbol}` : "Complete the inputs above."} />
          <Headline label="Amount at risk" value={r ? money(r.amount, acct) : DASH} tone="neg" sub={r ? `${pct(risk.n)} of the balance` : undefined} />
        </Live>
        <Figure
          caption={
            r
              ? `The dark segment is the part of the balance lost if the stop is reached: ${money(r.amount, acct)} of ${money(balance.n, acct)}. ${money(balance.n - r.amount, acct)} would remain.`
              : "The bar shows the amount at risk as a share of the balance."
          }
        >
          <ShareBar share={r ? risk.n / 100 : 0} tone="neg" startLabel="0" endLabel={balance.ok ? `Balance ${money(balance.n, acct)}` : "Balance"} />
        </Figure>
        <Live>
          <Rows
            className="mt-21"
            rows={[
              { label: `Value of one ${unit} at this size`, value: r ? money(r.pipAcct * r.lots, acct) : DASH },
              { label: `Rounded down to ${fmt(LOT_STEP, 2, 2)}-lot steps`, value: r ? `${fmt(r.stepped, 2, 2)} lots` : DASH },
              { label: "Amount at risk at the rounded size", value: r ? money(r.steppedRisk, acct) : DASH, tone: "neg" },
            ]}
          />
        </Live>
        <SimulationNote>It does not say what size to trade.</SimulationNote>
        {conv.note && <div className="mt-8">{conv.note}</div>}
      </Outcome>
    </ToolLayout>
  );
}
