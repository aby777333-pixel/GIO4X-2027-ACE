"use client";

import { useState } from "react";
import { decimalsOf, fixingDate, fmt, fmtPrice, fmtRate, lotsText, money, parse, plain, refRate, signedMoney } from "./calc";
import { useCalc } from "./store";
import { accountCurrency, AccountCurrencyField, DASH, Figure, Headline, Inputs, InstrumentFields, Live, NumField, Outcome, resolveSpec, Rows, Seg, SimulationNote, ToolLayout, useConversion, type Step, type ToolProps } from "./ui";
import { Ruler } from "./viz";

type Side = "buy" | "sell";
const PLACEHOLDER_PIPS = 50;

export function ProfitLoss({ meta, rates }: ToolProps) {
  const [calc, set] = useCalc();
  const inst = resolveSpec(calc);
  const acct = accountCurrency(calc);
  const conv = useConversion(rates, inst.quote, acct);
  const [side, setSide] = useState<Side>("buy");
  const [typed, setTyped] = useState<Record<string, { entry?: string; exit?: string }>>({});

  const dp = inst.pip.ok ? decimalsOf(inst.pip.n) + 1 : 2;
  const ref = inst.fx && inst.base && rates.status === "ok" ? refRate(rates, inst.base, inst.quote) : null;
  const entryRef = ref !== null ? plain(ref, dp) : null;
  const exitRef = ref !== null && inst.pip.ok ? plain(Number(plain(ref, dp)) + PLACEHOLDER_PIPS * inst.pip.n, dp) : null;
  const entryRaw = typed[inst.id]?.entry ?? entryRef ?? "";
  const exitRaw = typed[inst.id]?.exit ?? exitRef ?? "";
  const setPrice = (k: "entry" | "exit", v: string) => setTyped((t) => ({ ...t, [inst.id]: { ...t[inst.id], [k]: v } }));

  const entry = parse(entryRaw, { label: "Entry price", gt: 0, max: 1e9 });
  const exit = parse(exitRaw, { label: "Exit price", gt: 0, max: 1e9 });
  const lots = parse(calc.lots, { label: "Lots", gt: 0, max: 100000 });
  const empty = entryRaw === "" || exitRaw === "";
  const unit = inst.unit;

  let r: { diff: number; dir: number; moved: number; quote: number; acct: number } | null = null;
  if (entry.ok && exit.ok && lots.ok && inst.ok && conv.rate !== null) {
    const dir = side === "buy" ? 1 : -1;
    const diff = exit.n - entry.n;
    const quote = diff * inst.contract.n * lots.n * dir;
    r = { diff, dir, moved: (diff * dir) / inst.pip.n, quote, acct: quote * conv.rate };
  }
  const tone = r ? (r.acct > 0 ? "pos" : r.acct < 0 ? "neg" : undefined) : undefined;
  const glyph = r ? (r.acct > 0 ? "▲ " : r.acct < 0 ? "▼ " : "◆ ") : "";
  const word = r ? (r.acct > 0 ? "Profit" : r.acct < 0 ? "Loss" : "No change") : "Profit or loss";

  const steps: Step[] | null = r && conv.rate !== null
    ? [
        { what: "Price difference (exit − entry)", calc: `${fmt(exit.n, 0, 6)} − ${fmt(entry.n, 0, 6)} = ${fmt(r.diff, 0, 6)}` },
        { what: `In ${unit}s, for a ${side}`, calc: `${fmt(r.diff, 0, 6)} ÷ ${fmt(inst.pip.n, 0, 6)}${side === "sell" ? " × −1" : ""} = ${fmt(r.moved, 0, 1)} ${unit}s` },
        { what: `Profit or loss, in ${inst.quote}`, calc: `${fmt(r.diff, 0, 6)} × ${fmt(inst.contract.n)} × ${fmt(lots.n, 0, 4)}${side === "sell" ? " × −1" : ""} = ${signedMoney(r.quote, inst.quote)}` },
        conv.kind === "same"
          ? { what: "Conversion", calc: `None needed: ${inst.symbol} is quoted in the account currency.` }
          : { what: `Converted to ${acct} (${conv.label})`, calc: `${fmt(r.quote, 2, 2)} × ${fmtRate(conv.rate)} = ${signedMoney(r.acct, acct)}` },
      ]
    : null;

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        "Both prices are the prices actually dealt. A buy opens at the ask and closes at the bid, so the spread is already inside the two prices you type.",
        "Commission and overnight financing are not included. Add them with the Cost Lab.",
        "Prices are hypothetical inputs. Where a reference rate prefills the entry, it is a starting point to overwrite, not a price at which anyone can deal.",
      ]}
    >
      <Inputs legend="A hypothetical trade">
        <Seg
          label="Direction"
          value={side}
          onChange={setSide}
          options={[
            { value: "buy", label: "Buy" },
            { value: "sell", label: "Sell" },
          ]}
        />
        <NumField id="lots" label="Position size" unit="lots" value={calc.lots} onChange={(v) => set({ lots: v })} error={lots.error} step={0.01} min={0} />
        <NumField
          id="entry"
          label="Entry price"
          value={entryRaw}
          onChange={(v) => setPrice("entry", v)}
          error={entryRaw === "" ? undefined : entry.error}
          placeholder="Type a price"
          hint={entryRef !== null && entryRaw === entryRef && rates.status === "ok" ? `ECB reference, ${fixingDate(rates.date)}. Overwrite it.` : entryRaw === "" ? "No price is held here for this instrument." : undefined}
          step={inst.pip.ok ? inst.pip.n : undefined}
        />
        <NumField
          id="exit"
          label="Exit price"
          value={exitRaw}
          onChange={(v) => setPrice("exit", v)}
          error={exitRaw === "" ? undefined : exit.error}
          placeholder="Type a price"
          hint={exitRef !== null && exitRaw === exitRef ? `Placeholder: ${PLACEHOLDER_PIPS} pips from the entry. Overwrite it.` : undefined}
          step={inst.pip.ok ? inst.pip.n : undefined}
        />
        <InstrumentFields calc={calc} set={set} inst={inst} />
        <AccountCurrencyField calc={calc} set={set} />
        {conv.field}
      </Inputs>

      <Outcome>
        <Live className="grid gap-21 sm:grid-cols-2">
          <Headline label={word} value={r ? `${glyph}${signedMoney(r.acct, acct)}` : DASH} tone={tone} sub={r ? (conv.kind === "same" ? `on ${lotsText(lots.n)} of ${inst.symbol}` : `${signedMoney(r.quote, inst.quote)} in the quote currency`) : empty ? "Enter an entry and an exit price." : "Complete the inputs above."} />
          <Headline label="Price move" value={r ? `${r.moved > 0 ? "+" : ""}${fmt(r.moved, 0, 1)}` : DASH} unit={`${unit}s`} sub={r ? (r.moved === 0 ? "Entry and exit are the same price." : `${r.moved > 0 ? "in favour of" : "against"} the ${side}`) : undefined} />
        </Live>

        <Figure caption={r && inst.pip.ok ? `Price ruler, lower prices to the left. Entry at ${fmtPrice(entry.n, inst.pip.n)}, exit at ${fmtPrice(exit.n, inst.pip.n)}: a ${side} ${r.acct > 0 ? "gains" : r.acct < 0 ? "loses" : "is unchanged"} over this distance.` : "The ruler shows entry and exit once both prices are entered."}>
          {r && inst.pip.ok ? (
            <Ruler
              marks={[
                { value: entry.n, label: "Entry", sub: fmtPrice(entry.n, inst.pip.n), side: "above" },
                { value: exit.n, label: "Exit", sub: fmtPrice(exit.n, inst.pip.n), side: "below", tone: r.acct > 0 ? "pos" : r.acct < 0 ? "neg" : "ink" },
              ]}
              spans={[{ from: entry.n, to: exit.n, tone: r.acct >= 0 ? "pos" : "neg" }]}
            />
          ) : (
            <div aria-hidden className="relative h-[144px]">
              <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
            </div>
          )}
        </Figure>

        <Live>
          <Rows
            className="mt-13"
            rows={[
              { label: "The same move on the opposite side", value: r ? signedMoney(-r.acct, acct) : DASH, tone: r ? (r.acct > 0 ? "neg" : r.acct < 0 ? "pos" : undefined) : undefined },
              { label: `Value of one ${unit} at this size`, value: r && conv.rate !== null ? money(inst.pip.n * inst.contract.n * lots.n * conv.rate, acct) : DASH },
            ]}
          />
        </Live>
        <SimulationNote>The prices are hypothetical; this is not a record or a forecast of any trade.</SimulationNote>
        {conv.note && <div className="mt-8">{conv.note}</div>}
      </Outcome>
    </ToolLayout>
  );
}
