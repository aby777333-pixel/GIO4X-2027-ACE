"use client";

import Link from "next/link";
import { useState } from "react";
import { fmt, money, pct } from "@/components/tools/calc";
import { Rows, type Step } from "@/components/tools/ui";
import { ShareBar } from "@/components/tools/viz";
import { LabFrame, LabNote, Say, Slider, Working } from "./kit";

/**
 * Size the position.
 *
 * The percent-risk arithmetic of the lesson, with three sliders: a balance,
 * the share of it at risk on one trade, and the distance to the stop. The
 * steps are the ones the Position Size tool takes (components/tools/
 * PositionSize.tsx computes them inline, so they are repeated here rather
 * than imported): the amount at risk, the loss on one lot if the stop is
 * reached, the size that makes the two equal, and the same size rounded down
 * to the smallest trade size the tool uses. The currency conversion the tool
 * also makes is left out by fixing an example pip value.
 */

/** the example the lesson uses: one pip on one standard lot */
const PIP_PER_LOT = 10;
const CCY = "USD";
/** the same rounding step as the Position Size tool */
const LOT_STEP = 0.01;

export function PositionSizeLab() {
  const [balance, setBalance] = useState(10000);
  const [risk, setRisk] = useState(2);
  const [stop, setStop] = useState(50);

  const amount = (balance * risk) / 100;
  const perLot = stop * PIP_PER_LOT;
  const lots = amount / perLot;
  const stepped = Math.floor(lots / LOT_STEP + 1e-9) * LOT_STEP;
  const steppedRisk = stepped * perLot;

  const steps: Step[] = [
    { what: "Amount at risk", calc: `${fmt(balance, 2, 2)} × ${pct(risk)} = ${money(amount, CCY)}` },
    { what: "Loss on one lot if the stop is reached", calc: `${fmt(stop)} pips × ${fmt(PIP_PER_LOT, 2, 2)} = ${money(perLot, CCY)}` },
    { what: "Position size", calc: `${fmt(amount, 2, 2)} ÷ ${fmt(perLot, 2, 2)} = ${fmt(lots, 2, 4)} lots` },
    { what: `Rounded down to ${fmt(LOT_STEP, 2, 2)}-lot steps`, calc: `${fmt(stepped, 2, 2)} lots, which puts ${money(steppedRisk, CCY)} at risk` },
  ];

  return (
    <LabFrame lab="position-size">
      <div className="grid gap-x-34 gap-y-5 sm:grid-cols-3">
        <Slider name="balance" label="Balance" value={balance} min={1000} max={50000} step={1000} onChange={setBalance} text={money(balance, CCY)} />
        <Slider name="risk" label="Risk on the trade" value={risk} min={0.5} max={5} step={0.5} onChange={setRisk} text={pct(risk)} />
        <Slider name="stop" label="Stop distance" value={stop} min={10} max={200} step={5} onChange={setStop} text={`${stop} pips`} />
      </div>

      <div className="mt-13 grid gap-x-34 gap-y-13 border-t border-line-strong pt-21 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="label">Position size</p>
          <p className="num mt-5 break-words font-display text-2xl font-light leading-tight text-ink sm:text-3xl" data-lots>
            {fmt(lots, 2, 2)}
            <span className="ml-8 whitespace-nowrap font-sans text-sm font-medium text-ink-3">lots</span>
          </p>
        </div>
        <div className="min-w-0">
          <p className="label">Amount at risk</p>
          <p className="num mt-5 break-words font-display text-2xl font-light leading-tight text-neg sm:text-3xl">
            {fmt(amount, 2, 2)}
            <span className="ml-8 whitespace-nowrap font-sans text-sm font-medium text-ink-3">{CCY}</span>
          </p>
        </div>
      </div>

      <figure className="mt-21">
        <ShareBar share={risk / 100} tone="neg" startLabel="0" endLabel={`Balance ${money(balance, CCY)}`} />
        <figcaption className="mt-8 text-xs text-ink-3">
          The dark segment is the part of the balance lost if the stop is reached and filled at its level: {money(amount, CCY)} of {money(balance, CCY)}.
        </figcaption>
      </figure>

      <Working steps={steps} />

      <Rows className="mt-21" rows={[{ label: "Value of one pip at this size", value: money(lots * PIP_PER_LOT, CCY) }]} />

      <Say>
        Risking {pct(risk)} of a balance of {money(balance, CCY)} with a stop {stop} pips away gives {fmt(lots, 2, 2)} lots in this example: if the stop is reached and filled at its level, the loss is {money(amount, CCY)}. A wider stop gives a smaller position for the same amount at risk; the size follows from the risk, not the other way round.
      </Say>

      <p className="mt-13 text-sm text-ink-2">
        The{" "}
        <Link href="/tools/position-size" className="link">
          Position Size tool
        </Link>{" "}
        does the same arithmetic with an instrument’s own contract and your account currency.
      </p>

      <LabNote>
        One pip on one lot is taken as {money(PIP_PER_LOT, CCY)}, the lesson’s own round example. A stop can be filled beyond its level, and the loss is then larger than the amount shown. Nothing here says what size to trade.
      </LabNote>
    </LabFrame>
  );
}
