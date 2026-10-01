"use client";

import { useState } from "react";
import { accounts, type AccountKey } from "@/data/accounts";
import { fmt, fmtRate, lotsText, money, parse, pct, signedMoney } from "./calc";
import { useCalc } from "./store";
import { accountCurrency, AccountCurrencyField, DASH, Headline, Inputs, InstrumentFields, Live, NumField, Outcome, resolveSpec, Seg, SimulationNote, ToolLayout, useConversion, type Step, type ToolProps } from "./ui";

/** What each account publishes, read from src/data/accounts.ts. Commission is published in US dollars. */
const PUBLISHED = accounts.map((a) => ({
  key: a.key,
  name: a.name,
  spread: parseFloat(a.spreadFrom),
  spreadText: a.spreadFrom,
  commission: Number(/\$([\d.]+)/.exec(a.commission)?.[1] ?? 0),
  commissionText: a.commission,
  swapFree: /swap-free/i.test(a.swap),
  swapText: a.swap,
}));

type Sides = "1" | "2";

export function CostLab({ meta, rates }: ToolProps) {
  const [calc, set] = useCalc();
  const inst = resolveSpec(calc, true);
  const acct = accountCurrency(calc);
  const conv = useConversion(rates, inst.quote, acct, "quote");
  const convUsdOwn = useConversion(rates, "USD", acct, "usd");
  const convUsd = inst.quote === "USD" ? conv : convUsdOwn;

  const account = PUBLISHED.find((a) => a.key === calc.accountType) ?? PUBLISHED[0];
  const [over, setOver] = useState<Partial<Record<AccountKey, { spread?: string; commission?: string }>>>({});
  const [sides, setSides] = useState<Sides>("1");
  const [nightsRaw, setNightsRaw] = useState("1");
  const [swapRaw, setSwapRaw] = useState("0");

  const spreadRaw = over[account.key]?.spread ?? String(account.spread);
  const commRaw = over[account.key]?.commission ?? String(account.commission);
  const setOverride = (k: "spread" | "commission", v: string) => setOver((o) => ({ ...o, [account.key]: { ...o[account.key], [k]: v } }));

  const lots = parse(calc.lots, { label: "Lots", gt: 0, max: 100000 });
  const spread = parse(spreadRaw, { label: "Spread", min: 0, max: 10000 });
  const comm = parse(commRaw, { label: "Commission", min: 0, max: 10000 });
  const nights = parse(nightsRaw, { label: "Nights", min: 0, max: 3650, integer: true });
  const swap = parse(swapRaw, { label: "Swap", min: -100000, max: 100000 });
  const nSides = sides === "2" ? 2 : 1;

  const ready = lots.ok && spread.ok && comm.ok && nights.ok && swap.ok && inst.ok && conv.rate !== null && convUsd.rate !== null;
  let r: { pipQuote: number; pipAcct: number; spreadCost: number; commUsd: number; commission: number; swapCost: number; total: number; inPips: number } | null = null;
  if (ready && conv.rate !== null && convUsd.rate !== null) {
    const pipQuote = inst.pip.n * inst.contract.n;
    const pipAcct = pipQuote * conv.rate;
    const spreadCost = spread.n * pipAcct * lots.n;
    const commUsd = comm.n * lots.n * nSides;
    const commission = commUsd * convUsd.rate;
    const swapCost = swap.n * lots.n * nights.n;
    const total = spreadCost + commission + swapCost;
    r = { pipQuote, pipAcct, spreadCost, commUsd, commission, swapCost, total, inPips: total / (pipAcct * lots.n) };
  }

  const steps: Step[] | null =
    r && conv.rate !== null && convUsd.rate !== null
      ? [
          { what: `Value of one pip on one lot of ${inst.symbol}`, calc: `${fmt(inst.pip.n, 0, 6)} × ${fmt(inst.contract.n)} = ${money(r.pipQuote, inst.quote)}${conv.kind !== "same" ? ` × ${fmtRate(conv.rate)} = ${money(r.pipAcct, acct)}` : ""}` },
          { what: "Spread cost (spread × pip value × lots)", calc: `${fmt(spread.n, 0, 2)} × ${fmt(r.pipAcct, 2, 4)} × ${fmt(lots.n, 0, 4)} = ${money(r.spreadCost, acct)}` },
          {
            what: `Commission (per lot × lots × ${nSides === 2 ? "two sides" : "charged once"})`,
            calc: `${fmt(comm.n, 2, 2)} × ${fmt(lots.n, 0, 4)} × ${nSides} = ${money(r.commUsd, "USD")}${acct !== "USD" ? ` × ${fmtRate(convUsd.rate)} = ${money(r.commission, acct)}` : ""}`,
          },
          { what: "Swap (per lot per night × lots × nights)", calc: `${fmt(swap.n, 0, 4)} × ${fmt(lots.n, 0, 4)} × ${fmt(nights.n)} = ${money(r.swapCost, acct)}` },
          { what: "Total", calc: `${fmt(r.spreadCost, 2, 2)} + ${fmt(r.commission, 2, 2)} + ${fmt(r.swapCost, 2, 2)} = ${money(r.total, acct)}` },
          { what: "The same cost, as a price move", calc: `${fmt(r.total, 2, 2)} ÷ (${fmt(r.pipAcct, 2, 4)} × ${fmt(lots.n, 0, 4)}) = ${fmt(r.inPips, 0, 2)} pips` },
        ]
      : null;

  const parts = r
    ? [
        { key: "Spread", value: r.spreadCost, cls: "bg-ink" },
        { key: "Commission", value: r.commission, cls: "bg-accent" },
        { key: "Swap", value: r.swapCost, cls: "bg-ink-3" },
      ]
    : [];
  const charged = parts.reduce((s, p) => s + Math.max(0, p.value), 0);

  const comparison =
    lots.ok && nights.ok && swap.ok && inst.ok && conv.rate !== null && convUsd.rate !== null
      ? PUBLISHED.map((a) => {
          const pipAcct = inst.pip.n * inst.contract.n * (conv.rate ?? 0);
          const s = a.spread * pipAcct * lots.n;
          const c = a.commission * lots.n * nSides * (convUsd.rate ?? 0);
          const w = a.swapFree ? 0 : swap.n * lots.n * nights.n;
          return { ...a, s, c, w, total: s + c + w };
        })
      : null;

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        "The spread prefilled for each account is the minimum GIO4X publishes (“spread from”). It is a floor, not a typical figure: real spreads are wider and vary by instrument and by the minute, so the real cost is higher than the figure built from it.",
        "Commission is published as “$3.50 per lot” on the ECN account. Whether that is per side or per round turn is not stated here, so the multiplier is yours to set.",
        "Swap rates are not published on this site. The field starts at zero and takes the rate shown on your platform: a positive number is a charge, a negative number a credit. The ECN account is published as swap-free.",
        "The spread is paid once, on entry, and is the same whether the trade then gains or loses.",
      ]}
    >
      <Inputs legend="One hypothetical trade">
        <InstrumentFields calc={calc} set={set} inst={inst} fxOnly />
        <NumField id="lots" label="Position size" unit="lots" value={calc.lots} onChange={(v) => set({ lots: v })} error={lots.error} step={0.01} min={0} />
        <Seg label="Account type" value={account.key} onChange={(v) => set({ accountType: v })} options={PUBLISHED.map((a) => ({ value: a.key, label: a.name }))} className="sm:col-span-2 [&_p]:hidden" />
        <NumField
          id="spread"
          label="Spread"
          unit="pips"
          value={spreadRaw}
          onChange={(v) => setOverride("spread", v)}
          error={spread.error}
          step={0.1}
          min={0}
          hint={`${account.name} publishes “from ${account.spreadText}”: a minimum. Type the spread you see.`}
        />
        <NumField
          id="commission"
          label="Commission per lot"
          unit="USD"
          value={commRaw}
          onChange={(v) => setOverride("commission", v)}
          error={comm.error}
          step={0.5}
          min={0}
          hint={`${account.name} publishes: ${account.commissionText.toLowerCase()}.`}
        />
        <Seg
          label="Commission charged"
          value={sides}
          onChange={setSides}
          options={[
            { value: "1", label: "Once" },
            { value: "2", label: "Each side (×2)" },
          ]}
        />
        <AccountCurrencyField calc={calc} set={set} />
        <NumField id="nights" label="Nights held" value={nightsRaw} onChange={setNightsRaw} error={nights.error} step={1} min={0} max={3650} hint="Zero for a trade closed the same day." />
        <NumField
          id="swap"
          label="Swap per lot, per night"
          unit={acct}
          value={swapRaw}
          onChange={setSwapRaw}
          error={swap.error}
          step={0.1}
          hint={account.swapFree ? `${account.name} is published as swap-free.` : "Not published here: take it from your platform. Negative = a credit."}
        />
        {conv.field}
        {inst.quote !== "USD" && convUsdOwn.field}
      </Inputs>

      <Outcome>
        <Live className="grid gap-21 sm:grid-cols-2">
          <Headline label="Cost of this trade" value={r ? money(r.total, acct) : DASH} sub={r ? `on ${lotsText(lots.n)} of ${inst.symbol}, held ${fmt(nights.n)} ${nights.n === 1 ? "night" : "nights"}` : "Complete the inputs above."} />
          <Headline label="As a price move" value={r ? fmt(r.inPips, 0, 2) : DASH} unit="pips" sub={r ? "the move in your favour that only covers the cost" : undefined} />
        </Live>

        <div className="mt-21">
          <div aria-hidden className="flex h-[21px] w-full bg-sunken">
            {parts.map((p) => (p.value > 0 && charged > 0 ? <span key={p.key} className={`block h-full border-r border-surface last:border-r-0 ${p.cls}`} style={{ width: `${(p.value / charged) * 100}%`, opacity: 0.85 }} /> : null))}
          </div>
          <dl className="mt-13 border-t border-line" aria-live="polite">
            {(r ? parts : [{ key: "Spread", value: NaN, cls: "bg-ink" }, { key: "Commission", value: NaN, cls: "bg-accent" }, { key: "Swap", value: NaN, cls: "bg-ink-3" }]).map((p) => (
              <div key={p.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto_3.4375rem] items-baseline gap-x-13 border-b border-line py-13">
                <span aria-hidden className={`h-[9px] w-[9px] self-center ${p.cls}`} style={{ opacity: 0.85 }} />
                <dt className="text-sm text-ink-2">{p.key}</dt>
                <dd className="num text-right text-[0.9375rem] font-medium">{r ? (p.value < 0 ? `${signedMoney(p.value, acct)} (credit)` : money(p.value, acct)) : DASH}</dd>
                <dd className="num text-right text-xs text-ink-3">{r && charged > 0 && p.value > 0 ? pct((p.value / charged) * 100, 0) : r ? "–" : ""}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-xs text-ink-3">The bar divides the charges into spread, commission and swap. Percentages are each component’s share of the charges.</p>
        </div>

        <h3 className="h4 mt-34">The same trade on each account type</h3>
        <p className="mt-5 text-sm text-ink-3">
          Built from each account’s published minimum spread and commission, not from the figures you may have overridden above. Real spreads are wider, so every figure here is a floor and the differences between accounts will not be exactly these.
        </p>
        <ul className="mt-13 border-t border-line-strong sm:hidden" aria-label="Cost of the same trade on each account type" aria-live="polite">
          {PUBLISHED.map((a) => {
            const row = comparison?.find((c) => c.key === a.key);
            return (
              <li key={a.key} className="border-b border-line py-13">
                <div className="flex items-baseline justify-between gap-13">
                  <span className="text-[0.9375rem]" style={{ fontWeight: a.key === account.key ? 600 : 400 }}>
                    {a.name} <span className="text-xs font-normal text-ink-3">from {a.spreadText}</span>
                  </span>
                  <span className="num text-[0.9375rem] font-medium">{row ? money(row.total, acct) : DASH}</span>
                </div>
                <p className="num mt-3 text-xs text-ink-3">{row ? `Spread ${fmt(row.s, 2, 2)} + commission ${fmt(row.c, 2, 2)} + swap ${a.swapFree ? "0.00 (swap-free)" : fmt(row.w, 2, 2)}` : DASH}</p>
              </li>
            );
          })}
        </ul>
        <div className="scroll-x mt-13 max-sm:hidden">
          <table className="table-gx min-w-[30rem]">
            <caption className="sr-only">Cost of the same trade on Classic, Premium and ECN accounts, from published minimum spreads</caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col" className="!text-right">
                  Spread from
                </th>
                <th scope="col" className="!text-right">
                  Spread cost
                </th>
                <th scope="col" className="!text-right">
                  Commission
                </th>
                <th scope="col" className="!text-right">
                  Swap
                </th>
                <th scope="col" className="!pr-0 !text-right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody aria-live="polite">
              {PUBLISHED.map((a) => {
                const row = comparison?.find((c) => c.key === a.key);
                return (
                  <tr key={a.key}>
                    <th scope="row" className="!border-line !text-sm !normal-case !tracking-normal !text-ink" style={{ fontWeight: a.key === account.key ? 600 : 400 }}>
                      {a.name}
                      {a.key === account.key && <span className="sr-only"> (selected above)</span>}
                    </th>
                    <td className="num text-right text-ink-3">{a.spreadText}</td>
                    <td className="num text-right">{row ? fmt(row.s, 2, 2) : DASH}</td>
                    <td className="num text-right">{row ? fmt(row.c, 2, 2) : DASH}</td>
                    <td className="num text-right">{row ? (a.swapFree ? "swap-free" : fmt(row.w, 2, 2)) : DASH}</td>
                    <td className="num !pr-0 text-right font-medium">{row ? money(row.total, acct) : DASH}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <SimulationNote>Built from minimum published spreads: real spreads are wider. This is not a quote and not a comparison of which account to choose.</SimulationNote>
        {conv.note && <div className="mt-8">{conv.note}</div>}
        {conv.note === null && convUsdOwn.note && acct !== "USD" && <div className="mt-8">{convUsdOwn.note}</div>}
      </Outcome>
    </ToolLayout>
  );
}
