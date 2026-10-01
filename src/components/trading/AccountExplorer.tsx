"use client";

import Link from "next/link";
import { useState } from "react";
import { accounts, type AccountKey } from "@/data/accounts";
import { accountCharacter, costExamples, EURUSD_PIP_VALUE } from "@/data/trading";

const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * The account experience: one comparison the visitor explores, not three
 * pricing cards. The three accounts share one ruled header; selecting one
 * opens its character and marks its row in the worked example. All three stay
 * visible at the same size, so none is dressed as the cheap option.
 */
export function AccountExplorer() {
  const [active, setActive] = useState<AccountKey>("classic");
  const a = accounts.find((x) => x.key === active)!;
  const c = accountCharacter[active];
  const costs = costExamples();
  const max = Math.max(...costs.map((x) => x.total));

  return (
    <div>
      {/* selector: three columns on one rule */}
      <div role="group" aria-label="Choose an account to explore" className="grid grid-cols-3 border-t border-line-strong">
        {accounts.map((x, i) => {
          const on = x.key === active;
          return (
            <button
              key={x.key}
              type="button"
              aria-pressed={on}
              onClick={() => setActive(x.key)}
              className={`group relative flex flex-col items-start gap-5 border-b border-line py-13 text-left transition-colors duration-fast sm:px-21 sm:py-21 sm:first:pl-0 ${i > 0 ? "border-l pl-8" : ""} ${on ? "" : "hover:bg-paper"}`}
            >
              <span aria-hidden className={`absolute left-0 top-[-1px] h-[2px] w-55 max-w-[70%] origin-left transition-transform duration-slow ${i > 0 ? "left-8 sm:left-21" : ""} ${on ? "scale-x-100" : "scale-x-0"} ${x.key === "premium" ? "bg-prestige" : "bg-accent"}`} />
              <span className="label hidden sm:block">{accountCharacter[x.key].pricing}</span>
              <span className={`h3 sm:h2 transition-colors duration-fast ${on ? "text-ink" : "text-ink-3 group-hover:text-ink"}`}>{x.name}</span>
              <span className="hidden text-sm text-ink-2 sm:block">{x.suits}</span>
              <span className="num text-xs text-ink-3 sm:mt-8 sm:text-sm">
                From <span className="font-medium text-ink">{x.minDeposit}</span>
              </span>
              <span className="sr-only">{on ? "(selected)" : ""}</span>
            </button>
          );
        })}
      </div>

      {/* the selected account, described */}
      <div className="grid gap-34 py-34 lg:grid-cols-phi lg:gap-89 lg:py-55" aria-live="polite">
        <div>
          <p className="eyebrow">
            {a.name} · {c.pricing}
          </p>
          <p className="mt-8 text-sm text-ink-3">Suits: {a.suits.toLowerCase()}</p>
          <p className="h3 mt-13 max-w-[26ch]">{a.line}</p>
          <p className="mt-21 max-w-measure text-ink-2">{c.pay}</p>
          <p className="mt-13 max-w-measure text-ink-2">{c.consider}</p>
          {a.extras.length > 0 && (
            <p className="mt-21 flex flex-wrap items-center gap-x-13 gap-y-5 text-sm text-ink-2">
              <span className="label">Included</span>
              {a.extras.map((e) => (
                <span key={e} className="chip">
                  {e}
                </span>
              ))}
            </p>
          )}
        </div>
        <dl className="content-start border-t border-line">
          {[
            ["Minimum deposit", a.minDeposit],
            ["Spread from", a.spreadFrom],
            ["Commission", a.commission],
            ["Overnight swap", a.swap],
            ["Leverage", a.leverage],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-21 border-b border-line py-13">
              <dt className="text-sm text-ink-3">{k}</dt>
              <dd className="num text-[0.9375rem] font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* worked example */}
      <figure className="panel p-21 lg:p-34">
        <figcaption className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="label">Worked example · not a quote</p>
            <p className="h4 mt-8">The cost of opening one standard lot of EUR/USD, at each account’s minimum spread.</p>
          </div>
          <p className="num shrink-0 text-xs text-ink-3">1 pip on 1 lot of EUR/USD = ${EURUSD_PIP_VALUE}</p>
        </figcaption>

        <div className="mt-21 grid gap-px border-t border-line">
          {costs.map((x) => {
            const on = x.key === active;
            return (
              <div key={x.key} className={`grid items-center gap-x-21 gap-y-5 border-b border-line py-13 md:grid-cols-[7rem_minmax(0,1fr)_5rem] ${on ? "" : "opacity-70"}`}>
                <p className="flex items-baseline gap-8 font-display text-lg text-ink">
                  <span aria-hidden className={`h-[0.4375rem] w-[0.4375rem] shrink-0 rounded-full border border-current ${on ? "bg-current" : ""}`} />
                  {x.name}
                </p>
                <div>
                  <div className="flex h-13" aria-hidden>
                    <span className="h-full bg-ink" style={{ width: `${(x.spreadCost / max) * 100}%` }} />
                    {x.commission > 0 && (
                      <span
                        className="h-full border border-l-0 border-ink"
                        style={{ width: `${(x.commission / max) * 100}%`, backgroundImage: "repeating-linear-gradient(135deg, var(--ink) 0 1px, transparent 1px 5px)" }}
                      />
                    )}
                  </div>
                  <p className="num mt-5 text-xs text-ink-2">
                    {x.pips} pips × ${EURUSD_PIP_VALUE} = {usd(x.spreadCost)} spread
                    {x.commission > 0 ? ` + ${usd(x.commission)} commission` : ", no commission"}
                  </p>
                </div>
                <p className="num text-lg font-medium text-ink md:text-right">{usd(x.total)}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-13 flex flex-wrap items-center gap-x-21 gap-y-5 text-xs text-ink-3">
          <span className="inline-flex items-center gap-5">
            <span aria-hidden className="h-8 w-13 bg-ink" /> Spread
          </span>
          <span className="inline-flex items-center gap-5">
            <span aria-hidden className="h-8 w-13 border border-ink" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--ink) 0 1px, transparent 1px 5px)" }} /> Commission
          </span>
        </div>
        <p className="mt-13 max-w-measure text-xs text-ink-3">
          Arithmetic on the published “from” figures: spread in pips × ${EURUSD_PIP_VALUE} per pip, plus commission. Spreads are minimums and widen with market conditions, so a real trade will usually cost more than this. The published ECN commission is
          {" "}
          {accounts.find((x) => x.key === "ecn")?.commission}; whether that is charged once or on both opening and closing is not yet published, and the example counts it once. Overnight swap is not included.
        </p>
        <Link href="/tools/cost-lab" className="go mt-13 min-h-[2.75rem] md:min-h-0">
          Try your own figures in the Cost Lab
        </Link>
      </figure>
    </div>
  );
}
