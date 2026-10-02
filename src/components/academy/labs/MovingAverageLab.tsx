"use client";

import { useMemo, useState } from "react";
import { hash } from "@/components/glossary/diagrams/kit";
import { fmt } from "@/components/tools/calc";
import { Rows } from "@/components/tools/ui";
import { LabFrame, LabNote, Say, Slider, Stage, Tag, useWidth } from "./kit";

/**
 * The period of a moving average.
 *
 * One fixed, seeded price path (it rises, turns and falls: no instrument, no
 * prices) and a simple moving average over it. The slider is the period. The
 * drawing marks where the price is highest and where the average is highest,
 * and shades the closes that the average at its own high is made of, so the
 * lag can be seen and counted: the average turns only after enough of the
 * prices inside it have turned.
 *
 * Everything the sentence says (the two periods, the lag, how much each line
 * moves from one period to the next) is counted from the path drawn.
 */

const N = 90;
const PERIOD = { min: 2, max: 40 };

/**
 * The closes: a rise, a turn and a fall, with a fixed wander on top; the same
 * on every visit. Rounded, so the server and every browser draw the same line
 * whatever the last digit of their sine.
 */
const CLOSES: readonly number[] = Array.from({ length: N }, (_, i) => Math.round((18 + 62 * Math.exp(-(((i - 34) / 16) ** 2)) + 3 * Math.sin(i * 0.8) + 2 * Math.sin(i * 0.31 + 2) + 4 * (hash(i, 3) - 0.5)) * 100) / 100);

function sma(period: number): (number | null)[] {
  let sum = 0;
  return CLOSES.map((v, i) => {
    sum += v;
    if (i >= period) sum -= CLOSES[i - period];
    return i >= period - 1 ? sum / period : null;
  });
}

const argmax = (xs: readonly (number | null)[]) => xs.reduce<number>((best, v, i) => (v !== null && (xs[best] === null || v > (xs[best] as number)) ? i : best), 0);

/** the mean size of the change from one period to the next */
function meanStep(xs: readonly (number | null)[]): number {
  let sum = 0;
  let n = 0;
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1];
    const b = xs[i];
    if (a === null || b === null) continue;
    sum += Math.abs(b - a);
    n++;
  }
  return n ? sum / n : 0;
}

const PRICE_PEAK = argmax(CLOSES);
const PRICE_STEP = meanStep(CLOSES);

export function MovingAverageLab() {
  const [period, setPeriod] = useState(10);
  const [wrapRef, w] = useWidth<HTMLDivElement>();
  const avg = useMemo(() => sma(period), [period]);
  const peak = argmax(avg);
  const lag = peak - PRICE_PEAK;
  const step = meanStep(avg);

  const narrow = w < 480;
  const size = narrow ? 11 : 12;
  const h = Math.round(Math.min(360, Math.max(250, w / 2)));
  const top = 30;
  const bottom = h - 40;
  const x0 = 12;
  const x1 = w - 12;
  const X = (i: number) => x0 + ((x1 - x0) * i) / (N - 1);
  const Y = (v: number) => bottom - (v / 100) * (bottom - top);

  const pricePath = CLOSES.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  let started = false;
  const avgPath = avg
    .map((v, i) => {
      if (v === null) return "";
      const cmd = started ? "L" : "M";
      started = true;
      return `${cmd}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`;
    })
    .join(" ");

  const lagWords = lag > 0 ? `${lag} ${lag === 1 ? "period" : "periods"} later` : lag === 0 ? "in the same period" : `${-lag} ${lag === -1 ? "period" : "periods"} earlier`;
  const by = h - 22;
  const pv = avg[peak] ?? 0;

  return (
    <LabFrame lab="moving-average">
      <Stage>
        <div ref={wrapRef}>
          <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" aria-hidden focusable="false">
            {/* the closes that the average at its high is made of */}
            <rect x={X(peak - period + 1) - 2} y={top - 8} width={X(peak) - X(peak - period + 1) + 4} height={bottom - top + 16} fill="var(--accent)" opacity={0.08} />
            <line x1={x0} x2={x1} y1={bottom + 8} y2={bottom + 8} stroke="var(--line-strong)" strokeWidth={1} />

            <path d={pricePath} fill="none" stroke="var(--ink)" strokeWidth={1.25} strokeLinejoin="round" opacity={0.75} />
            <path d={avgPath} fill="none" stroke="var(--accent)" strokeWidth={2.75} strokeLinejoin="round" strokeLinecap="round" />

            {/* the two highs, dropped to the base line, and the distance between them */}
            <line x1={X(PRICE_PEAK)} x2={X(PRICE_PEAK)} y1={Y(CLOSES[PRICE_PEAK])} y2={by} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="2 4" />
            <line x1={X(peak)} x2={X(peak)} y1={Y(pv)} y2={by} stroke="var(--accent)" strokeWidth={1} strokeDasharray="2 4" />
            {lag !== 0 && <line x1={X(PRICE_PEAK)} x2={X(peak)} y1={by} y2={by} stroke="var(--ink)" strokeWidth={1.5} />}
            <circle cx={X(PRICE_PEAK)} cy={Y(CLOSES[PRICE_PEAK])} r={4} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.75} />
            <circle cx={X(peak)} cy={Y(pv)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />

            <Tag x={Math.max(x0 + 2, X(PRICE_PEAK) - 8)} y={Y(CLOSES[PRICE_PEAK]) - 12} anchor="end" tone="ink" size={size}>
              Price is highest
            </Tag>
            <Tag x={Math.min(x1 - 2, X(peak) + 9)} y={Y(pv) - 13} tone="accent" size={size}>
              Average is highest
            </Tag>
            <Tag x={(X(PRICE_PEAK) + X(peak)) / 2} y={by + 12} anchor="middle" tone="ink" size={size}>
              {`Lag: ${lag} ${Math.abs(lag) === 1 ? "period" : "periods"}`}
            </Tag>
            <Tag x={x0} y={12} tone="ink-2" weight={500} size={size}>
              {`Thin line: price. Thick line: ${period}-period average.`}
            </Tag>
          </svg>
        </div>
      </Stage>

      <div className="mt-13">
        <Slider name="period" label="Period of the average" value={period} min={PERIOD.min} max={PERIOD.max} step={1} onChange={setPeriod} text={`${period} periods`} hint="The shaded band is the set of closes inside the average at its highest point." />
      </div>

      <Rows
        className="mt-13"
        rows={[
          { label: "The price is highest in", value: `period ${PRICE_PEAK + 1} of ${N}` },
          { label: "The average is highest in", value: `period ${peak + 1} of ${N}` },
          { label: "Mean change from one period to the next: price", value: `${fmt(PRICE_STEP, 1, 1)} pips` },
          { label: "Mean change from one period to the next: average", value: `${fmt(step, 1, 1)} pips` },
        ]}
      />

      <Say>
        A {period}-period simple moving average: each point is the mean of the last {period} closes. On this path the price is highest in period {PRICE_PEAK + 1} and the average is highest in period {peak + 1}, {lagWords}. That delay is the lag: an average turns only after enough of the prices inside it have turned, so a longer period gives a smoother line that turns later.
      </Say>

      <LabNote>The path is drawn from a fixed formula on a scale of 0 to 100 example pips, and it is the same on every visit. On another path the lag would be a different number of periods.</LabNote>
    </LabFrame>
  );
}
