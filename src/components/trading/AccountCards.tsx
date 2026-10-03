"use client";

import { useState } from "react";
import type { Account } from "@/data/accounts";

/**
 * The three accounts as three cards on a table: fanned, with one on top.
 * Choosing a card brings it to the top; turning it over shows the rest of
 * its published conditions. Every figure is read from the same specification
 * as the comparison table (data/accounts) and nothing is added to it.
 *
 * A card is two buttons (bring forward, turn over) and its text is ordinary
 * text, so it reads the same without the movement.
 */
export function AccountCards({ accounts }: { accounts: Account[] }) {
  const [top, setTop] = useState(0);
  const [turned, setTurned] = useState(false);
  return (
    <div>
      <ul className="gx-cards" aria-label="The three accounts">
        {accounts.map((a, i) => {
          // where this card lies in the fan: 0 is the top
          const place = (i - top + accounts.length) % accounts.length;
          const front: [string, string][] = [
            ["Minimum deposit", a.minDeposit],
            ["Spread from", a.spreadFrom],
            ["Commission", a.commission],
          ];
          const back: [string, string][] = [
            ["Leverage", a.leverage],
            ["Swap", a.swap],
            ["Minimum trade", a.minTrade],
            ["Margin call", a.marginCall],
            ["Stop out", a.stopOut],
            ["Execution", a.execution],
          ];
          const isTop = place === 0;
          return (
            <li key={a.key} className={`gx-card gx-card-${a.key} ${isTop && turned ? "is-turned" : ""}`} style={{ ["--place" as string]: place }} aria-current={isTop ? "true" : undefined}>
              <div className="gx-card-face gx-card-front">
                <p className="label">{a.suits}</p>
                <h3 className="mt-5 font-display text-3xl text-ink">{a.name}</h3>
                <p className="mt-8 text-sm text-ink-2">{a.line}</p>
                <dl className="mt-auto grid gap-5 pt-13">
                  {front.map(([k, val]) => (
                    <div key={k} className="flex items-baseline justify-between gap-13 border-t border-line pt-5">
                      <dt className="text-xs text-ink-3">{k}</dt>
                      <dd className="num text-sm font-medium text-ink">{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="gx-card-face gx-card-back" aria-hidden={!(isTop && turned)}>
                <p className="label">{a.name} · the rest</p>
                <dl className="mt-8 grid gap-5">
                  {back.map(([k, val]) => (
                    <div key={k} className="flex items-baseline justify-between gap-13 border-t border-line pt-5">
                      <dt className="text-xs text-ink-3">{k}</dt>
                      <dd className="num text-right text-sm font-medium text-ink">{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {!isTop && (
                <button
                  type="button"
                  className="gx-card-pick"
                  onClick={() => {
                    setTop(i);
                    setTurned(false);
                  }}
                >
                  <span className="sr-only">Bring {a.name} to the top</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-21 flex flex-wrap items-center gap-13">
        <button type="button" className="btn btn-primary" aria-pressed={turned} onClick={() => setTurned((v) => !v)}>
          {turned ? "Turn it back" : `Turn ${accounts[top].name} over`}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setTop((v) => (v + 1) % accounts.length);
            setTurned(false);
          }}
        >
          Next card
        </button>
      </div>
      <p className="mt-13 text-xs text-ink-3">The same published specification as the comparison table. Indicative conditions: they can differ by instrument and change with the market.</p>
    </div>
  );
}
