"use client";

import Link from "next/link";
import { useState } from "react";
import { fmt, money, pct } from "@/components/tools/calc";
import { Rows, type Step } from "@/components/tools/ui";
import { LabFrame, LabNote, Say, Slider, Working } from "./kit";

/**
 * Leverage and margin.
 *
 * One slider: the leverage. An example account puts the whole of its equity
 * up as margin for one position (the most exposure the leverage allows, the
 * same assumption the "Leverage, visualised" tool makes), so the margin stays the
 * same while the position it carries grows. The exercise shows the notional
 * value, the margin requirement, and the adverse price move that takes the
 * equity down to an example stop-out level: the higher the leverage, the
 * smaller that move.
 */

const LEVELS = [1, 2, 5, 10, 20, 50, 100, 200, 500];
/** the example account: all of it is used as margin */
const MARGIN = 1000;
const CCY = "USD";
/** an example stop-out level, as a share of the used margin */
const STOP_OUT = 50;
/** the ruler of adverse price moves runs from 0 to this, in per cent */
const SCALE = 5;

const moveAt = (leverage: number) => (100 - STOP_OUT) / leverage;

export function LeverageLab() {
  const [i, setI] = useState(6);
  const leverage = LEVELS[i];
  const notional = MARGIN * leverage;
  const loss = MARGIN * (1 - STOP_OUT / 100);
  const move = moveAt(leverage);
  const next = LEVELS[i + 1];
  const at = Math.min(1, move / SCALE) * 100;
  const off = move > SCALE;

  const steps: Step[] = [
    { what: "Position carried (margin × leverage)", calc: `${fmt(MARGIN, 2, 2)} × ${fmt(leverage)} = ${money(notional, CCY)}` },
    { what: "Margin requirement (1 ÷ leverage)", calc: `1 ÷ ${fmt(leverage)} = ${pct(100 / leverage, 3)}` },
    { what: `Loss that takes the equity to ${STOP_OUT}% of the margin`, calc: `${fmt(MARGIN, 2, 2)} − ${STOP_OUT}% × ${fmt(MARGIN, 2, 2)} = ${money(loss, CCY)}` },
    { what: "Adverse price move that causes that loss", calc: `${fmt(loss, 2, 2)} ÷ ${fmt(notional, 2, 2)} = ${pct(move, 3)}` },
  ];

  return (
    <LabFrame lab="leverage">
      <Slider name="leverage" label="Leverage" value={i} min={0} max={LEVELS.length - 1} step={1} onChange={setI} text={`1:${leverage}`} hint={`Steps: ${LEVELS.map((l) => `1:${l}`).join(", ")}.`} />

      <div className="mt-13 grid gap-x-34 gap-y-13 border-t border-line-strong pt-21 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="label">Position carried</p>
          <p className="num mt-5 break-words font-display text-2xl font-light leading-tight text-ink sm:text-3xl" data-notional>
            {fmt(notional, 2, 2)}
            <span className="ml-8 whitespace-nowrap font-sans text-sm font-medium text-ink-3">{CCY}</span>
          </p>
        </div>
        <div className="min-w-0">
          <p className="label">Move to the stop-out level</p>
          <p className="num mt-5 break-words font-display text-2xl font-light leading-tight text-neg sm:text-3xl" data-move>
            {pct(move, 3)}
            <span className="ml-8 whitespace-nowrap font-sans text-sm font-medium text-ink-3">against the position</span>
          </p>
        </div>
      </div>

      <figure className="mt-21">
        <div aria-hidden>
          <div className="relative h-[21px] bg-sunken" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--viz-faint) 0 1px, transparent 1px 6px)" }}>
            <div className="absolute inset-y-0 left-0 bg-ink transition-[width] duration-fast" style={{ width: `max(2px, ${100 / leverage}%)`, opacity: 0.85 }} />
          </div>
          <div className="num mt-5 flex justify-between gap-13 text-xs text-ink-3">
            <span>Margin {money(MARGIN, CCY)}</span>
            <span className="text-right">Position {money(notional, CCY)}</span>
          </div>
        </div>
        <figcaption className="mt-8 text-xs text-ink-3">
          The whole bar is the position. The dark segment is the margin behind it: one part in {fmt(leverage)}. The profit or loss on the whole bar falls on the dark segment alone.
        </figcaption>
      </figure>

      <figure className="mt-34">
        <div aria-hidden className="relative h-[89px] select-none">
          <div className="absolute inset-x-0 top-[34px] h-[13px] bg-sunken" />
          {!off && (
            <>
              <div className="absolute top-[34px] h-[13px] bg-neg transition-[left] duration-fast" style={{ left: `${at}%`, right: 0, opacity: 0.8 }} />
              <div className="absolute top-[21px] h-[39px] w-px bg-neg transition-[left] duration-fast" style={{ left: `${at}%` }} />
              <span className="num absolute top-0 whitespace-nowrap text-xs font-medium text-neg" style={at > 50 ? { right: `${100 - at}%` } : { left: `${at}%` }}>
                Stop-out level reached at {pct(move, 3)}
              </span>
            </>
          )}
          <div className="num absolute inset-x-0 bottom-[13px] flex justify-between text-xs text-ink-3">
            <span>0%</span>
            <span>{SCALE}% against the position</span>
          </div>
        </div>
        <figcaption className="text-xs text-ink-3">
          A ruler of adverse price moves, from 0 to {SCALE}%. {off ? `At 1:${leverage} the stop-out level is reached at ${pct(move, 3)}, beyond the right edge of the ruler.` : `The shaded zone begins at ${pct(move, 3)}, where the equity has fallen to the example stop-out level at 1:${leverage}.`}
        </figcaption>
      </figure>

      <Working steps={steps} />

      <Rows
        className="mt-21"
        rows={[
          { label: "Margin (the whole of the example equity)", value: money(MARGIN, CCY) },
          { label: "Margin requirement", value: pct(100 / leverage, 3) },
          { label: "Equity left at the stop-out level", value: money(MARGIN - loss, CCY), tone: "neg" },
        ]}
      />

      <Say>
        At 1:{leverage}, a margin of {money(MARGIN, CCY)} carries a position of {money(notional, CCY)}, and a price move of {pct(move, 3)} against it takes the equity down to the example stop-out level. Higher leverage brings the stop-out closer
        {next ? `: at 1:${next} the same margin would reach it after a move of only ${pct(moveAt(next), 3)}.` : ": this is the highest step shown, and the smallest move."}
      </Say>

      <p className="mt-13 text-sm text-ink-2">
        Two tools work the same ideas with your own figures:{" "}
        <Link href="/tools/leverage-visualizer" className="link">
          Leverage, visualised
        </Link>{" "}
        and{" "}
        <Link href="/tools/margin" className="link">
          Margin
        </Link>
        .
      </p>

      <LabNote>
        The whole of the example equity is used as margin for one position, and the stop-out level of {STOP_OUT}% is an example: levels differ between brokers and account types. In a gap the position can be closed at a worse price than the level implies. No level of leverage is suggested here.
      </LabNote>
    </LabFrame>
  );
}
