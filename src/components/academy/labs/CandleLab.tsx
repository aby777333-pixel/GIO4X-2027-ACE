"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hash } from "@/components/glossary/diagrams/kit";
import { Rows } from "@/components/tools/ui";
import { LabFrame, LabNote, Say, Slider, Stage, Tag, useStill, useWidth } from "./kit";

/**
 * Build a candle.
 *
 * Four sliders set the open, high, low and close of one period, on an example
 * scale of 0 to 100 pips. The high can never be below the open or the close,
 * nor the low above them: moving the open or close past an extreme carries
 * the extreme with it, and the extremes stop at the body.
 *
 * The drawing shows a path the price could have taken through those four
 * prices, and the candle that summarises it, with its parts named. "Play a
 * period" runs the path from the open and builds the candle from it as it
 * goes; the same clock is a slider, so it can be stepped with the arrow keys.
 * A candle that closes above its open is drawn hollow, one that closes below
 * it solid: the difference never rests on colour.
 */

const N = 80;
const STEP = 5;
/** how long a played period lasts, in seconds */
const RUN = 6;
/** the moments a period is shown at when motion is reduced: the open, each extreme, the close */
const STILLS = [0, 0.3, 0.7, 1];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (u: number) => u * u * (3 - 2 * u);

type Ohlc = { o: number; h: number; l: number; c: number };

export function CandleLab() {
  const [k, setK] = useState<Ohlc>({ o: 35, h: 85, l: 20, c: 70 });
  const [t, setT] = useState(1);
  const [playing, setPlaying] = useState(false);
  const still = useStill();
  const [wrapRef, w] = useWidth<HTMLDivElement>();
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopClock = () => {
    cancelAnimationFrame(raf.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPlaying(false);
  };
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** a change to the candle ends any period being played and shows the finished candle */
  const change = (next: Ohlc) => {
    stopClock();
    setT(1);
    setK(next);
  };
  const setOpen = (o: number) => change({ ...k, o, h: Math.max(k.h, o), l: Math.min(k.l, o) });
  const setClose = (c: number) => change({ ...k, c, h: Math.max(k.h, c), l: Math.min(k.l, c) });
  const setHigh = (h: number) => change({ ...k, h: Math.max(h, k.o, k.c) });
  const setLow = (l: number) => change({ ...k, l: Math.min(l, k.o, k.c) });

  function play() {
    stopClock();
    setPlaying(true);
    setT(0);
    if (still) {
      // no gliding: the period is shown at its four moments, one after another
      let i = 0;
      const next = () => {
        i += 1;
        setT(STILLS[i]);
        if (i < STILLS.length - 1) timer.current = setTimeout(next, 900);
        else setPlaying(false);
      };
      timer.current = setTimeout(next, 900);
      return;
    }
    let last = 0;
    let at = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      at = Math.min(1, at + dt / RUN);
      setT(at);
      if (at < 1) raf.current = requestAnimationFrame(frame);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(frame);
  }

  // a path through the four prices: from the open to one extreme, to the other, to the close
  const ys = useMemo(() => {
    const up = k.c >= k.o;
    const knots: [number, number][] = [
      [0, k.o],
      [0.3, up ? k.l : k.h],
      // 0.3 and 0.7 fall on samples of the path, so each extreme is reached exactly
      [0.7, up ? k.h : k.l],
      [1, k.c],
    ];
    const out: number[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      let j = 0;
      while (j < knots.length - 2 && u > knots[j + 1][0]) j++;
      const p = clamp((u - knots[j][0]) / (knots[j + 1][0] - knots[j][0]), 0, 1);
      const v = knots[j][1] + (knots[j + 1][1] - knots[j][1]) * smooth(p) + 0.12 * (k.h - k.l) * Math.sin(Math.PI * p) * (hash(i, 21) - 0.5);
      // rounded, so the server and every browser draw the same line whatever the last digit of their sine
      out.push(Math.round(clamp(v, k.l, k.h) * 100) / 100);
    }
    return out;
  }, [k]);

  // the period so far
  const at = clamp(t, 0, 1) * N;
  const whole = Math.min(N, Math.floor(at));
  const cur = t >= 1 ? k.c : whole >= N ? ys[N] : ys[whole] + (ys[whole + 1] - ys[whole]) * (at - whole);
  let hi = t >= 1 ? k.h : Math.max(k.o, cur);
  let lo = t >= 1 ? k.l : Math.min(k.o, cur);
  if (t < 1) {
    for (let i = 0; i <= whole; i++) {
      if (ys[i] > hi) hi = ys[i];
      if (ys[i] < lo) lo = ys[i];
    }
  }
  const done = t >= 1;
  const r = (v: number) => Math.round(v);

  // geometry
  const narrow = w < 480;
  const h = Math.round(Math.min(360, Math.max(250, w / 1.9)));
  const pad = 20;
  const size = narrow ? 11 : 12;
  const xl = narrow ? 62 : 84; // where the path starts: the four prices are named to its left
  const xp = w * (narrow ? 0.52 : 0.56);
  const cx = w * (narrow ? 0.64 : 0.68);
  const bw = Math.min(narrow ? 30 : 46, w * 0.09);
  const Y = (p: number) => pad + ((100 - p) / 100) * (h - pad * 2);
  const X = (u: number) => xl + (xp - xl) * u;

  const full = ys.map((v, i) => `${i ? "L" : "M"}${X(i / N).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const sofar = [...ys.slice(0, whole + 1).map((v, i) => `${i ? "L" : "M"}${X(i / N).toFixed(1)} ${Y(v).toFixed(1)}`), ...(whole < N ? [`L${X(at / N).toFixed(1)} ${Y(cur).toFixed(1)}`] : [])].join(" ");

  const bodyTop = Math.max(k.o, cur);
  const bodyBottom = Math.min(k.o, cur);
  const up = cur >= k.o;
  const upper = hi - bodyTop;
  const lower = bodyBottom - lo;
  const body = bodyTop - bodyBottom;

  // the four prices, named at the left; kept from sitting on one another
  const names = [
    { text: `High ${r(hi)}`, p: hi },
    { text: `Open ${r(k.o)}`, p: k.o },
    { text: done ? `Close ${r(cur)}` : `Now ${r(cur)}`, p: cur },
    { text: `Low ${r(lo)}`, p: lo },
  ]
    .map((n, i) => ({ ...n, y: Y(n.p), i }))
    .sort((a, b) => a.y - b.y || a.i - b.i);
  const gapY = size + 4;
  for (let i = 1; i < names.length; i++) if (names[i].y - names[i - 1].y < gapY) names[i].y = names[i - 1].y + gapY;
  const over = names[names.length - 1].y - (h - 8);
  if (over > 0) for (const n of names) n.y -= over;
  for (let i = names.length - 2; i >= 0; i--) if (names[i + 1].y - names[i].y < gapY) names[i].y = names[i + 1].y - gapY;

  // the parts of the candle, named at its right
  const px = cx + bw / 2 + (narrow ? 10 : 18);
  const parts = [
    { text: "Upper wick", y: Y((hi + bodyTop) / 2), show: upper >= 1 },
    { text: "Body", y: Y((bodyTop + bodyBottom) / 2), show: body >= 1 },
    { text: "Lower wick", y: Y((lo + bodyBottom) / 2), show: lower >= 1 },
  ].filter((p) => p.show);
  for (let i = 1; i < parts.length; i++) if (parts[i].y - parts[i - 1].y < gapY) parts[i].y = parts[i - 1].y + gapY;

  const closeWords = k.c > k.o ? "above its open, so the body is drawn hollow" : k.c < k.o ? "below its open, so the body is drawn solid" : "exactly where it opened, so there is no body: a doji";

  return (
    <LabFrame lab="candle">
      <Stage>
        <div ref={wrapRef}>
          <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" aria-hidden focusable="false">
            <line x1={xl} x2={xp} y1={h - 8} y2={h - 8} stroke="var(--line-strong)" strokeWidth={1} />
            <path d={full} fill="none" stroke="var(--ink)" strokeWidth={1.25} opacity={0.18} strokeLinejoin="round" />
            <path d={sofar} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {/* the four prices the candle keeps, carried across to it */}
            {[hi, lo, k.o].map((p, i) => (
              <line key={i} x1={xl} x2={cx - bw / 2 - 4} y1={Y(p)} y2={Y(p)} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="2 4" />
            ))}
            <line x1={X(at / N)} x2={cx - bw / 2 - 4} y1={Y(cur)} y2={Y(cur)} stroke="var(--accent)" strokeWidth={1} strokeDasharray="2 4" />
            <circle cx={X(0)} cy={Y(k.o)} r={3.5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.5} />
            <circle cx={X(at / N)} cy={Y(cur)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />

            {/* the candle */}
            <line x1={cx} x2={cx} y1={Y(hi)} y2={Y(lo)} stroke={up ? "var(--pos)" : "var(--ink)"} strokeWidth={2} />
            <rect x={cx - bw / 2} y={Y(bodyTop)} width={bw} height={Math.max(2, Y(bodyBottom) - Y(bodyTop))} fill={up ? "var(--surface)" : "var(--ink)"} stroke={up ? "var(--pos)" : "var(--ink)"} strokeWidth={2} />

            {names.map((n) => (
              <Tag key={n.i} x={6} y={n.y} tone={n.i === 2 ? "accent" : "ink-2"} size={size}>
                {n.text}
              </Tag>
            ))}
            {parts.map((p) => (
              <g key={p.text}>
                <line x1={p.text === "Body" ? cx + bw / 2 + 2 : cx + 3} x2={px - 4} y1={p.y} y2={p.y} stroke="var(--ink-3)" strokeWidth={1} />
                <Tag x={px} y={p.y} tone="ink" size={size}>
                  {p.text}
                </Tag>
              </g>
            ))}
          </svg>
        </div>
      </Stage>

      <div className="mt-13 grid gap-x-34 gap-y-5 sm:grid-cols-2">
        <Slider name="open" label="Open" value={k.o} min={0} max={100} step={STEP} onChange={setOpen} text={`${k.o} pips`} />
        <Slider name="close" label="Close" value={k.c} min={0} max={100} step={STEP} onChange={setClose} text={`${k.c} pips`} />
        <Slider name="high" label="High" value={k.h} min={0} max={100} step={STEP} onChange={setHigh} text={`${k.h} pips`} hint="Never below the open or the close." />
        <Slider name="low" label="Low" value={k.l} min={0} max={100} step={STEP} onChange={setLow} text={`${k.l} pips`} hint="Never above the open or the close." />
      </div>

      <div className="mt-13 grid items-end gap-x-34 gap-y-8 border-t border-line pt-13 sm:grid-cols-[auto_minmax(0,1fr)]">
        <button type="button" className="btn btn-ghost" onClick={play} data-play>
          {playing ? "Play again from the open" : "Play a period"}
        </button>
        <Slider
          name="time"
          label="Time through the period"
          value={Math.round(t * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => {
            stopClock();
            setT(v / 100);
          }}
          text={done ? "closed" : `${Math.round(t * 100)}%`}
        />
      </div>

      <Rows
        className="mt-13"
        rows={[
          { label: "Body (open to close)", value: `${r(body)} pips` },
          { label: "Upper wick", value: `${r(upper)} pips` },
          { label: "Lower wick", value: `${r(lower)} pips` },
          { label: "Range (low to high)", value: `${r(hi - lo)} pips` },
        ]}
      />

      {/* while a period plays the sentence changes many times a second: it is announced once the period has closed */}
      <Say>
        {done
          ? `This candle records one period: the price opened at ${k.o}, went as high as ${k.h} and as low as ${k.l}, and closed at ${k.c}, ${closeWords}. The body spans ${r(body)} pips, the upper wick ${r(upper)} and the lower wick ${r(lower)}. It is a record of what happened in the period, not a statement of what happens next.`
          : playing
            ? "The period is under way: the candle is being built from the path of the price, and it is not complete until the period closes."
            : `Part-way through the period: the price opened at ${k.o}, has been as high as ${r(hi)} and as low as ${r(lo)} so far, and is now at ${r(cur)}. The candle is not complete until the period closes.`}
      </Say>

      <LabNote>The scale runs from 0 to 100 example pips, and the path is one of many that would leave the same four prices.</LabNote>
    </LabFrame>
  );
}
