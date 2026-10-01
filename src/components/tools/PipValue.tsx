"use client";

import { fmt, fmtRate, lotsText, money, parse } from "./calc";
import { useCalc } from "./store";
import { accountCurrency, AccountCurrencyField, DASH, Headline, Inputs, InstrumentFields, Live, NumField, Outcome, resolveSpec, SimulationNote, ToolLayout, useConversion, type Step, type ToolProps } from "./ui";

const EXAMPLES = [10, 50, 100];

export function PipValue({ meta, rates }: ToolProps) {
  const [calc, set] = useCalc();
  const inst = resolveSpec(calc);
  const acct = accountCurrency(calc);
  const conv = useConversion(rates, inst.quote, acct);
  const lots = parse(calc.lots, { label: "Lots", gt: 0, max: 100000 });
  const unit = inst.unit;

  let r: { quote: number; acct: number } | null = null;
  if (lots.ok && inst.ok && conv.rate !== null) {
    const quote = inst.pip.n * inst.contract.n * lots.n;
    r = { quote, acct: quote * conv.rate };
  }

  const steps: Step[] | null = r && conv.rate !== null
    ? [
        { what: `One ${unit}, in the quote currency (${inst.quote})`, calc: `${fmt(inst.pip.n, 0, 6)} × ${fmt(inst.contract.n)} × ${fmt(lots.n, 0, 4)} = ${money(r.quote, inst.quote)}` },
        conv.kind === "same"
          ? { what: "Conversion", calc: `None needed: the quote currency is the account currency (${acct}).` }
          : { what: `Converted to ${acct} (${conv.label})`, calc: `${fmt(r.quote, 2, 2)} × ${fmtRate(conv.rate)} = ${money(r.acct, acct)}` },
      ]
    : null;

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        inst.fx ? "A pip is 0.0001 of the quote currency, or 0.01 for pairs quoted in yen." : "This instrument has no pip convention, so the point size is yours to set.",
        "Where the quote currency differs from the account currency, the value is converted at the ECB daily reference rate. A platform converts at its own rate at that moment, so the figure on an account differs slightly and changes as the rate moves.",
        "The value of a pip is the same whether the price moves for or against the position: only the sign changes.",
      ]}
    >
      <Inputs>
        <InstrumentFields calc={calc} set={set} inst={inst} />
        <NumField id="lots" label="Position size" unit="lots" value={calc.lots} onChange={(v) => set({ lots: v })} error={lots.error} step={0.01} min={0} hint={inst.contract.ok && lots.ok ? `${fmt(lots.n * inst.contract.n, 0, 2)} units` : undefined} />
        <AccountCurrencyField calc={calc} set={set} />
        {conv.field}
      </Inputs>

      <Outcome>
        <Live>
          <Headline
            label={`Value of one ${unit}`}
            value={r ? money(r.acct, acct) : DASH}
            sub={r ? (conv.kind === "same" ? `per ${unit}, on ${lotsText(lots.n)} of ${inst.symbol}` : `${money(r.quote, inst.quote)} before conversion`) : "Complete the inputs above."}
          />
        </Live>

        <table className="table-gx mt-21">
          <caption className="label pb-8 text-left">A move of 10, 50 and 100 {unit}s, either way</caption>
          <thead>
            <tr>
              <th scope="col">Move</th>
              <th scope="col" className="w-[45%]">
                <span className="sr-only">To scale</span>
              </th>
              <th scope="col" className="!pr-0 !text-right">
                Change in {acct}
              </th>
            </tr>
          </thead>
          <tbody aria-live="polite">
            {EXAMPLES.map((n) => (
              <tr key={n}>
                <th scope="row" className="num !border-line !text-sm !font-normal !normal-case !tracking-normal !text-ink">
                  {n} {unit}s
                </th>
                <td aria-hidden>
                  <span className="block h-[8px] bg-ink-3" style={{ width: `${n}%`, opacity: 0.55 }} />
                </td>
                <td className="num !pr-0 text-right text-[0.9375rem] font-medium">{r ? `± ${money(r.acct * n, acct)}` : DASH}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <SimulationNote />
        {conv.note && <div className="mt-8">{conv.note}</div>}
      </Outcome>
    </ToolLayout>
  );
}
