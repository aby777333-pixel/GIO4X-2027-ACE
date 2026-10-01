"use client";

import { useState } from "react";
import { accounts } from "@/data/accounts";
import { decimalsOf, fixingDate, fmt, fmtRate, money, parse, pct, plain, refRate } from "./calc";
import { useCalc } from "./store";
import { accountCurrency, AccountCurrencyField, DASH, Figure, Headline, Inputs, InstrumentFields, Live, NumField, Outcome, RangeField, resolveSpec, Rows, SimulationNote, ToolLayout, useConversion, type Step, type ToolProps } from "./ui";
import { ShareBar } from "./viz";

/** Published on every account type (src/data/accounts.ts). */
const MARGIN_CALL = parseFloat(accounts[0].marginCall);
const STOP_OUT = parseFloat(accounts[0].stopOut);
const MAX_LEVERAGE = Number(/1:(\d+)/.exec(accounts[0].leverage)?.[1] ?? 500);

export function Margin({ meta, rates }: ToolProps) {
  const [calc, set] = useCalc();
  const inst = resolveSpec(calc);
  const acct = accountCurrency(calc);
  const conv = useConversion(rates, inst.quote, acct);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const reference = inst.fx && inst.base && rates.status === "ok" && inst.pip.ok ? plain(refRate(rates, inst.base, inst.quote), decimalsOf(inst.pip.n) + 1) : null;
  const priceRaw = prices[inst.id] ?? reference ?? "";
  const usingReference = reference !== null && priceRaw === reference;

  const lots = parse(calc.lots, { label: "Lots", gt: 0, max: 100000 });
  const price = parse(priceRaw, { label: "Price", gt: 0, max: 1e9 });
  const leverage = parse(calc.leverage, { label: "Leverage", min: 1, max: MAX_LEVERAGE });
  const balance = parse(calc.balance, { label: "Balance", gt: 0, max: 1e12 });

  let r: { notional: number; marginQuote: number; margin: number; share: number; level: number; callLoss: number; stopEquity: number; stopLoss: number } | null = null;
  if (lots.ok && price.ok && leverage.ok && balance.ok && inst.ok && conv.rate !== null) {
    const notional = lots.n * inst.contract.n * price.n;
    const marginQuote = notional / leverage.n;
    const margin = marginQuote * conv.rate;
    const stopEquity = (STOP_OUT / 100) * margin;
    r = { notional, marginQuote, margin, share: margin / balance.n, level: (balance.n / margin) * 100, callLoss: balance.n - margin, stopEquity, stopLoss: balance.n - stopEquity };
  }
  const tooLarge = r !== null && r.share > 1;

  const steps: Step[] | null = r && conv.rate !== null
    ? [
        { what: `Notional value, in ${inst.quote}`, calc: `${fmt(lots.n, 0, 4)} × ${fmt(inst.contract.n)} × ${fmt(price.n, 0, 6)} = ${money(r.notional, inst.quote)}` },
        { what: `Margin at 1:${fmt(leverage.n)}`, calc: `${fmt(r.notional, 2, 2)} ÷ ${fmt(leverage.n)} = ${money(r.marginQuote, inst.quote)}` },
        ...(conv.kind !== "same" ? [{ what: `Converted to ${acct} (${conv.label})`, calc: `${fmt(r.marginQuote, 2, 2)} × ${fmtRate(conv.rate)} = ${money(r.margin, acct)}` }] : []),
        { what: "Share of the balance", calc: `${fmt(r.margin, 2, 2)} ÷ ${fmt(balance.n, 2, 2)} = ${pct(r.share * 100)}` },
        { what: "Margin level at the moment of opening (equity ÷ margin)", calc: `${fmt(balance.n, 2, 2)} ÷ ${fmt(r.margin, 2, 2)} × 100 = ${pct(r.level, 1)}` },
        { what: `Equity at the ${fmt(MARGIN_CALL)}% margin call level`, calc: `${fmt(r.margin, 2, 2)} × ${fmt(MARGIN_CALL)}% = ${money((r.margin * MARGIN_CALL) / 100, acct)}` },
        { what: `Equity at the ${fmt(STOP_OUT)}% stop out level`, calc: `${fmt(r.margin, 2, 2)} × ${fmt(STOP_OUT)}% = ${money(r.stopEquity, acct)}` },
      ]
    : null;

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        "This is the only open position, and equity equals the balance at the moment of opening.",
        `Margin call at ${fmt(MARGIN_CALL)}% and stop out at ${fmt(STOP_OUT)}% are the levels GIO4X publishes for its account types. A stop out closes positions at the prices then available; in a gap, equity can fall below the level shown.`,
        "The leverage available depends on the instrument and on your jurisdiction, and can be lower than the figure you set here.",
        "The price is an input. For currency pairs it is prefilled with the ECB reference rate; for everything else you type the price you see, because this site holds no price for it.",
      ]}
    >
      <Inputs>
        <InstrumentFields calc={calc} set={set} inst={inst} />
        <NumField id="lots" label="Position size" unit="lots" value={calc.lots} onChange={(v) => set({ lots: v })} error={lots.error} step={0.01} min={0} />
        <NumField
          id="price"
          label={`Price (${inst.quote})`}
          value={priceRaw}
          onChange={(v) => setPrices((p) => ({ ...p, [inst.id]: v }))}
          error={priceRaw === "" && !reference ? undefined : price.error}
          placeholder={reference ? undefined : "Type the price you see"}
          hint={
            usingReference && rates.status === "ok"
              ? `ECB reference, ${fixingDate(rates.date)}. Replace with your platform’s price.`
              : priceRaw === ""
                ? inst.fx
                  ? "Reference rates are unavailable: type the price."
                  : "No price is held here for this instrument."
                : "Price entered by you."
          }
        />
        <RangeField id="leverage" label="Leverage (1 : n)" value={calc.leverage} onChange={(v) => set({ leverage: v })} error={leverage.error} min={1} max={MAX_LEVERAGE} step={1} hint="Lower leverage means more margin, and less exposure per unit of equity." />
        <NumField id="balance" label="Account balance" unit={acct} value={calc.balance} onChange={(v) => set({ balance: v })} error={balance.error} step={100} min={0} />
        <AccountCurrencyField calc={calc} set={set} />
        {conv.field}
      </Inputs>

      <Outcome>
        <Live className="grid gap-21 sm:grid-cols-2">
          <Headline label="Required margin" value={r ? money(r.margin, acct) : DASH} sub={r ? `on a notional value of ${money(r.notional, inst.quote)}` : priceRaw === "" ? "Enter a price to see the margin." : "Complete the inputs above."} />
          <Headline label="Share of balance" value={r ? pct(r.share * 100) : DASH} tone={tooLarge ? "neg" : undefined} sub={tooLarge ? "More than the balance: this position could not be opened." : r ? `Margin level at opening ${pct(r.level, 1)}` : undefined} />
        </Live>

        <Figure
          caption={
            r && !tooLarge
              ? `The bar is the balance. The filled part is tied up as margin. The two lines mark the equity at which the published margin call (${fmt(MARGIN_CALL)}%) and stop out (${fmt(STOP_OUT)}%) levels are reached as losses reduce equity from right to left.`
              : "The bar shows the margin as a share of the balance, with the published margin call and stop out levels as reference lines."
          }
        >
          <ShareBar
            share={r ? r.share : 0}
            tone={tooLarge ? "neg" : "ink"}
            startLabel="Equity 0"
            endLabel={balance.ok ? `Balance ${money(balance.n, acct)}` : "Balance"}
            marks={
              r && !tooLarge
                ? [
                    { at: r.share, label: `Margin call ${fmt(MARGIN_CALL)}%`, row: 0 },
                    { at: (r.share * STOP_OUT) / 100, label: `Stop out ${fmt(STOP_OUT)}%`, row: 1 },
                  ]
                : []
            }
          />
        </Figure>

        <Live>
          <Rows
            className="mt-21"
            rows={[
              { label: "Free margin after opening", value: r ? money(balance.n - r.margin, acct) : DASH, tone: tooLarge ? "neg" : undefined },
              { label: `Loss that brings the margin level to ${fmt(MARGIN_CALL)}%`, value: r && !tooLarge ? money(r.callLoss, acct) : DASH, tone: "neg" },
              { label: `Loss that brings it to ${fmt(STOP_OUT)}% (stop out)`, value: r && !tooLarge ? money(r.stopLoss, acct) : DASH, tone: "neg" },
            ]}
          />
        </Live>
        <SimulationNote>Margin is not a cost and not the most that can be lost.</SimulationNote>
        {conv.note && <div className="mt-8">{conv.note}</div>}
      </Outcome>
    </ToolLayout>
  );
}
