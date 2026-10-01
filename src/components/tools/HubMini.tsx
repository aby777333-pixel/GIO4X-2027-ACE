"use client";

import Link from "next/link";
import { DataNote } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { fmt, money, parse, pct } from "./calc";
import { useCalc } from "./store";
import { accountCurrency, AccountCurrencyField, DASH, Live, NumField, RangeField } from "./ui";
import { ShareBar } from "./viz";

/**
 * The hub's one live interaction. It writes to the same store as every tool,
 * so the figures set here are already in place when a tool is opened.
 */
export function HubMini() {
  const [calc, set] = useCalc();
  const acct = accountCurrency(calc);
  const balance = parse(calc.balance, { label: "Balance", gt: 0, max: 1e12 });
  const risk = parse(calc.riskPct, { label: "Risk", gt: 0, max: 100 });
  const ok = balance.ok && risk.ok;
  const amount = ok ? (balance.n * risk.n) / 100 : null;
  // consecutive losses of this share that take the balance to half or below
  const toHalf = ok ? (risk.n >= 50 ? 1 : Math.ceil(Math.log(0.5) / Math.log(1 - risk.n / 100) - 1e-9)) : null;

  return (
    <div className="panel p-21 sm:p-34">
      <p className="label">Try it here · set once, used everywhere</p>
      <div className="mt-13 grid grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] gap-x-13">
        <NumField id="hub-balance" label="Account balance" value={calc.balance} onChange={(v) => set({ balance: v })} error={balance.error} step={100} min={0} />
        <AccountCurrencyField calc={calc} set={set} />
      </div>
      <RangeField id="hub-risk" label="Risk on one trade" unit="%" value={calc.riskPct} onChange={(v) => set({ riskPct: v })} error={risk.error} min={0.1} max={100} sliderMax={10} step={0.1} />

      <Live className="mt-13 border-t border-line-strong pt-13">
        <p className="label">Amount at risk</p>
        <p className="num mt-5 font-display text-2xl font-light leading-tight text-neg">{amount !== null ? money(amount, acct) : DASH}</p>
        <p className="mt-5 min-h-[2.5rem] text-sm text-ink-3">
          {ok && toHalf !== null ? `${fmt(balance.n, 2, 2)} × ${pct(risk.n)}. ${fmt(toHalf)} consecutive ${toHalf === 1 ? "loss" : "losses"} of this share would halve the balance.` : "Enter a balance and a risk percentage."}
        </p>
      </Live>
      <div className="mt-8">
        <ShareBar share={ok ? risk.n / 100 : 0} tone="neg" startLabel="0" endLabel={balance.ok ? `Balance ${money(balance.n, acct)}` : "Balance"} />
      </div>
      <Link href="/tools/position-size" className="go mt-21">
        Carry these into Position Size
      </Link>
      <DataNote status="simulation" className="mt-21">
        A calculation on the figures you entered; kept in this browser only. {educationalNote}
      </DataNote>
    </div>
  );
}
