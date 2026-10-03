"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, lotsText, pct } from "@/components/tools/calc";
import { Rows, Seg } from "@/components/tools/ui";
import type { Step } from "@/components/tools/ui";
import { DataNote } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { nextPrice, ROLLOVER_TICKS, SIM, type Side, type Walk } from "./engine";
import { glyph, sim, simSigned } from "./working";

/**
 * ONE TRADE, TOLD AS A STORY.
 *
 * The practice desk below is a workbench: everything is available at once. This
 * is the same arithmetic walked through in order, for someone who has never
 * placed a trade: choose it, see the margin set aside, watch an illustrative
 * price path, then read the costs and the result in words.
 *
 * Everything here is invented and says so. The price path comes from the
 * practice desk's own seeded random walk (engine.nextPrice): the same path
 * number always gives the same path, it is not market data and it cannot be
 * analysed. The three "instrument types" are example contracts that differ in
 * what one lot is, which is the thing an instrument type changes; they are not
 * GIO4X instruments. The charges are made up for the story and are not
 * GIO4X's conditions. Amounts are in SIM, the desk's pretend unit.
 *
 * Nothing is stored and nothing is sent. Reduced motion: the path is never
 * played, it is stepped through with the slider or shown whole.
 */

type TypeKey = "pair" | "metal" | "index";
type Charging = "spread" | "raw";

type Contract = {
  key: TypeKey;
  name: string;
  /** what one lot is, in words */
  lot: string;
  /** units in one lot */
  contract: number;
  /** the smallest step the story counts in */
  unit: "pip" | "point";
  point: number;
  /** the invented price the path starts from */
  start: number;
  dp: number;
  /** how many of this contract's pips or points one pip of the shared path is worth */
  scale: number;
};

const TYPES: Contract[] = [
  { key: "pair", name: "Example currency pair", lot: "100,000 units of the first currency", contract: 100000, unit: "pip", point: 0.0001, start: SIM.startPrice, dp: 5, scale: 1 },
  { key: "metal", name: "Example metal", lot: "100 units of the metal", contract: 100, unit: "point", point: 0.01, start: 1500, dp: 2, scale: 10 },
  { key: "index", name: "Example index", lot: "10 times the index level", contract: 10, unit: "point", point: 1, start: 5000, dp: 1, scale: 2 },
];

/** Made up for the story, like every setting on this page. */
const STORY = {
  holdMinutes: 150,
  /** the "raw" spread of the commission model, in pips of the shared path */
  rawSpreadPips: 0.4,
  /** SIM per lot, charged once when the trade opens, in the commission model */
  commissionPerLot: 3,
  sizes: ["0.10", "0.50", "1.00"] as const,
  firstPath: 1618,
};
type SizeKey = (typeof STORY.sizes)[number];

const TICKS_PER_MINUTE = 60 / SIM.tickSeconds;
const TOTAL_TICKS = STORY.holdMinutes * TICKS_PER_MINUTE;
const ROLLOVER_MINUTE = ROLLOVER_TICKS / TICKS_PER_MINUTE;

/** The illustrative path: how far the price is from where it started, in pips, at every tick. Pure and seeded. */
function buildPath(seed: number): { pips: number[]; gaps: { minute: number; pips: number }[] } {
  const startPts = Math.round(SIM.startPrice / (SIM.pip / 10));
  let g: Walk = { rng: seed >>> 0, midPts: startPts, fastLeft: 0 };
  const pips = [0];
  const gaps: { minute: number; pips: number }[] = [];
  for (let t = 1; t <= TOTAL_TICKS; t++) {
    const n = nextPrice(g);
    g = { rng: n.rng, midPts: n.midPts, fastLeft: n.fastLeft };
    pips.push((n.midPts - startPts) / 10);
    if (n.gapPts !== 0) gaps.push({ minute: Math.ceil(t / TICKS_PER_MINUTE), pips: n.gapPts / 10 });
  }
  return { pips, gaps };
}

function isStill(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
}

const CHAPTERS = ["Choose the trade", "Margin is set aside", "The price moves", "What it cost", "The result, in words"] as const;

function Working({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-13 border-t border-line">
      {steps.map((s, i) => (
        <li key={s.what} className="grid grid-cols-[1.3125rem_minmax(0,1fr)] gap-x-8 border-b border-line py-8">
          <span className="num pt-2 text-xs font-semibold text-prestige-ink">{i + 1}</span>
          <span>
            <span className="block text-xs text-ink-3">{s.what}</span>
            <span className="num mt-2 block break-words text-sm text-ink">{s.calc}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ---- the drawing ---------------------------------------------------------------- */

const W = 640;
const H = 260;
const PAD = { l: 13, r: 13, t: 34, b: 26 };

function PathChart({ pips, at, entryPips, price, label }: { pips: number[]; at: number; entryPips: number; price: (p: number) => string; label: string }) {
  const lo = Math.min(...pips, entryPips, 0);
  const hi = Math.max(...pips, entryPips, 0);
  const span = hi - lo || 1;
  const x = (t: number) => PAD.l + (t / TOTAL_TICKS) * (W - PAD.l - PAD.r);
  const y = (p: number) => PAD.t + ((hi - p) / span) * (H - PAD.t - PAD.b);
  const line = (from: number, to: number) => {
    let d = "";
    for (let t = from; t <= to; t++) d += `${t === from ? "M" : "L"}${x(t).toFixed(1)} ${y(pips[t]).toFixed(1)}`;
    return d;
  };
  const roll = ROLLOVER_TICKS <= TOTAL_TICKS ? x(ROLLOVER_TICKS) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
      <text x={PAD.l} y={18} className="fill-ink-3" fontSize="11" fontWeight="600" letterSpacing="1.4">
        ILLUSTRATION · SEEDED PATH · NOT MARKET DATA
      </text>
      <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t - 8} y2={PAD.t - 8} className="stroke-line-strong" strokeWidth="1" />
      {/* the price the trade opened at */}
      <line x1={PAD.l} x2={W - PAD.r} y1={y(entryPips)} y2={y(entryPips)} className="stroke-accent" strokeWidth="1" strokeDasharray="5 3" />
      <text x={W - PAD.r} y={y(entryPips) - 5} textAnchor="end" className="fill-ink-2" fontSize="11">
        entry {price(entryPips)}
      </text>
      {roll !== null && (
        <>
          <line x1={roll} x2={roll} y1={PAD.t} y2={H - PAD.b} className="stroke-line-strong" strokeWidth="1" strokeDasharray="2 3" />
          <text x={roll - 5} y={H - PAD.b - 5} textAnchor="end" className="fill-ink-3" fontSize="11">
            rollover
          </text>
        </>
      )}
      {/* the whole path, faint; the part already lived through, drawn over it */}
      <path d={line(0, TOTAL_TICKS)} fill="none" className="stroke-line-strong" strokeWidth="1" />
      {at > 0 && <path d={line(0, at)} fill="none" className="stroke-ink" strokeWidth="1.5" strokeLinejoin="round" />}
      <circle cx={x(at)} cy={y(pips[at])} r="4" className="fill-paper stroke-ink" strokeWidth="1.5" />
      <text x={PAD.l} y={H - 8} className="fill-ink-3" fontSize="11">
        minute 0
      </text>
      <text x={W - PAD.r} y={H - 8} textAnchor="end" className="fill-ink-3" fontSize="11">
        minute {STORY.holdMinutes}
      </text>
    </svg>
  );
}

/* ---- the story ------------------------------------------------------------------ */

export function StoryTrade() {
  const [typeKey, setTypeKey] = useState<TypeKey>("pair");
  const [size, setSize] = useState<SizeKey>("0.10");
  const [side, setSide] = useState<Side>("buy");
  const [charging, setCharging] = useState<Charging>("spread");
  const [seed, setSeed] = useState(STORY.firstPath);
  /** the chapter reached: 0 is the choice, 4 the result */
  const [chapter, setChapter] = useState(0);
  /** how far along the path the visitor has looked, in simulated minutes */
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(false);

  const heads = useRef<(HTMLHeadingElement | null)[]>([]);
  const focusOn = useRef<number | null>(null);

  const { pips, gaps } = useMemo(() => buildPath(seed), [seed]);

  /* ---- the arithmetic, all of it derived from the five choices ---- */
  const c = TYPES.find((t) => t.key === typeKey) ?? TYPES[0];
  const lots = Number(size);
  const dir = side === "buy" ? 1 : -1;
  const spreadPips = charging === "spread" ? SIM.spreadPips : STORY.rawSpreadPips;
  /** what one pip of the shared path is worth on this position, in SIM */
  const perPip = c.scale * c.point * c.contract * lots;
  const priceAt = (p: number) => c.start + p * c.scale * c.point;
  const priceText = (p: number) => fmt(priceAt(p), c.dp, c.dp);
  const units = (p: number) => `${fmt(Math.abs(p) * c.scale, 0, 1)} ${Math.abs(p) * c.scale === 1 ? c.unit : `${c.unit}s`}`;

  /** a buy opens at the ask, half a spread above the middle; a sell at the bid, half a spread below */
  const entryPips = (dir * spreadPips) / 2;
  const entry = priceAt(entryPips);
  const notional = lots * c.contract * entry;
  const margin = notional / SIM.defaultLeverage;
  const balance = SIM.defaultBalance;
  const spreadCost = spreadPips * perPip;
  const commission = charging === "raw" ? STORY.commissionPerLot * lots : 0;
  const rollovers = Math.floor(TOTAL_TICKS / ROLLOVER_TICKS);
  const swap = SIM.swapPerLot * lots * rollovers;

  const tick = minute * TICKS_PER_MINUTE;
  /** what the price itself has done for the position, before any charge */
  const moveAt = (t: number) => dir * pips[t] * perPip;
  const floatingAt = (t: number) => moveAt(t) - spreadCost;
  const floating = floatingAt(tick);
  const swapSoFar = minute >= ROLLOVER_MINUTE ? SIM.swapPerLot * lots * Math.floor(tick / ROLLOVER_TICKS) : 0;
  const equity = balance - commission - swapSoFar + floating;
  let lowTick = 0;
  for (let t = 1; t <= TOTAL_TICKS; t++) if (floatingAt(t) < floatingAt(lowTick)) lowTick = t;
  const low = floatingAt(lowTick);

  const endPips = pips[TOTAL_TICKS];
  const exitPips = endPips - (dir * spreadPips) / 2;
  const move = moveAt(TOTAL_TICKS);
  const costs = spreadCost + commission + swap;
  const net = move - costs;
  const favour = dir * endPips;

  /* ---- moving through the story ---- */
  const goTo = (n: number) => {
    focusOn.current = n;
    setChapter((now) => Math.max(now, n));
    if (n <= chapter) heads.current[n]?.focus();
  };
  useEffect(() => {
    if (focusOn.current !== null) {
      heads.current[focusOn.current]?.focus();
      focusOn.current = null;
    }
  }, [chapter]);

  /* ---- playing the path: a stepped slider that moves by itself, never under reduced motion ---- */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    let acc = 0;
    const frame = (now: number) => {
      acc += last ? Math.min(now - last, 100) : 0;
      last = now;
      // the whole path in about nine seconds
      const stepMs = 9000 / STORY.holdMinutes;
      if (acc >= stepMs) {
        const n = Math.floor(acc / stepMs);
        acc -= n * stepMs;
        setMinute((m) => Math.min(STORY.holdMinutes, m + n));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  useEffect(() => {
    if (minute >= STORY.holdMinutes) setPlaying(false);
  }, [minute]);

  const play = () => {
    if (isStill()) {
      setMinute(STORY.holdMinutes);
      return;
    }
    if (minute >= STORY.holdMinutes) setMinute(0);
    setPlaying(true);
  };
  const again = (change: () => void) => {
    setPlaying(false);
    setMinute(0);
    change();
    setChapter(2);
    focusOn.current = 2;
    heads.current[2]?.focus();
  };

  const gapsSeen = gaps.filter((g) => g.minute <= minute);
  const head = (n: number) => (
    <h3
      ref={(el) => {
        heads.current[n] = el;
      }}
      tabIndex={-1}
      className="h4 focus:outline-none focus-visible:underline"
    >
      {CHAPTERS[n]}
    </h3>
  );
  const number = (n: number) => (
    <span aria-hidden className={`num pt-3 text-xs font-semibold tracking-[0.1em] ${n <= chapter ? "text-prestige-ink" : "text-ink-3"}`}>
      {String(n + 1).padStart(2, "0")}
    </span>
  );
  const row = "grid grid-cols-[2.125rem_minmax(0,1fr)] gap-x-13 border-b border-line py-21";

  return (
    <div data-sim-story>
      <ol className="border-t border-line-strong">
        {/* 1 */}
        <li className={row}>
          {number(0)}
          <div className="min-w-0">
            {head(0)}
            <p className="mt-5 max-w-measure text-sm text-ink-2">
              An example account of <span className="num">{sim(balance)}</span> with leverage of <span className="num">1:{fmt(SIM.defaultLeverage)}</span>. Pick what to trade, how much of it, which way, and how the example account charges. Every figure below follows from these four choices.
            </p>
            <div className="mt-13 grid gap-x-21 sm:grid-cols-2">
              <Seg label="Instrument type" value={typeKey} onChange={setTypeKey} options={TYPES.map((t) => ({ value: t.key, label: t.name.replace("Example ", "") }))} />
              <Seg label="Size, in lots" value={size} onChange={setSize} options={STORY.sizes.map((s) => ({ value: s, label: s }))} />
              <Seg
                label="Direction"
                value={side}
                onChange={setSide}
                options={[
                  { value: "buy", label: "Buy" },
                  { value: "sell", label: "Sell" },
                ]}
              />
              <Seg
                label="How the account charges"
                value={charging}
                onChange={setCharging}
                options={[
                  { value: "spread", label: "Spread only" },
                  { value: "raw", label: "Raw + commission" },
                ]}
              />
            </div>
            <p className="max-w-measure text-xs text-ink-3">
              {c.name}: one lot is {c.lot}, and its invented price starts at <span className="num">{fmt(c.start, c.dp, c.dp)}</span>. {charging === "spread" ? `Spread only: a spread of ${units(SIM.spreadPips)} and no commission.` : `Raw + commission: a spread of ${units(STORY.rawSpreadPips)} and a commission of ${sim(STORY.commissionPerLot)} per lot.`} These are made up for the story. They are not GIO4X’s instruments or conditions.
            </p>
            {chapter === 0 && (
              <button type="button" className="btn btn-primary mt-13" onClick={() => goTo(1)}>
                Open the trade
              </button>
            )}
          </div>
        </li>

        {/* 2 */}
        {chapter >= 1 && (
          <li className={row}>
            {number(1)}
            <div className="min-w-0">
              {head(1)}
              <p className="mt-5 max-w-measure text-ink-2">
                You {side} <span className="num">{lotsText(lots)}</span> of the {c.name.toLowerCase()} at <span className="num">{fmt(entry, c.dp, c.dp)}</span>, the {side === "buy" ? "ask" : "bid"}. The position is worth <span className="num">{sim(notional)}</span>, far more than is asked of you: at <span className="num">1:{fmt(SIM.defaultLeverage)}</span> the account sets aside <span className="num font-medium text-ink">{sim(margin)}</span> as margin. Margin is not a fee. It is part of your balance that cannot be used for anything else while the trade is open, and it comes back when the trade closes.
              </p>
              <p className="mt-8 max-w-measure text-ink-2">
                The trade opened at the {side === "buy" ? "ask" : "bid"} and would close at the {side === "buy" ? "bid" : "ask"}, so it begins <span className="num">{sim(spreadCost)}</span> down. That gap is the spread, and it is paid whichever way the price goes.{commission > 0 ? ` A commission of ${sim(commission)} is taken from the balance at once.` : ""}
              </p>
              <Rows
                className="mt-13 max-w-[34rem]"
                rows={[
                  { label: "Margin set aside", value: sim(margin) },
                  { label: "Free margin", value: sim(balance - commission - spreadCost - margin) },
                  { label: "Share of the balance tied up", value: pct((margin / balance) * 100) },
                ]}
              />
              <Working
                steps={[
                  { what: "Position value (lots × contract size × price)", calc: `${fmt(lots, 2, 2)} × ${fmt(c.contract)} × ${fmt(entry, c.dp, c.dp)} = ${sim(notional)}` },
                  { what: `Margin at 1:${fmt(SIM.defaultLeverage)}`, calc: `${fmt(notional, 2, 2)} ÷ ${fmt(SIM.defaultLeverage)} = ${sim(margin)}` },
                  { what: `Value of one ${c.unit} (${c.unit} size × contract size × lots)`, calc: `${fmt(c.point, 0, 4)} × ${fmt(c.contract)} × ${fmt(lots, 2, 2)} = ${sim(c.point * c.contract * lots)}` },
                  { what: `Spread (spread in ${c.unit}s × value of one ${c.unit})`, calc: `${fmt(spreadPips * c.scale, 0, 1)} × ${fmt(c.point * c.contract * lots, 2, 2)} = ${sim(spreadCost)}` },
                ]}
              />
              {chapter === 1 && (
                <button type="button" className="btn btn-primary mt-13" onClick={() => goTo(2)}>
                  Let the price move
                </button>
              )}
            </div>
          </li>
        )}

        {/* 3 */}
        {chapter >= 2 && (
          <li className={row}>
            {number(2)}
            <div className="min-w-0">
              {head(2)}
              <p className="mt-5 max-w-measure text-sm text-ink-2">
                An illustrative path of {STORY.holdMinutes} simulated minutes, drawn by a seeded random walk (path <span className="num">{seed}</span>). It is not a market and not a forecast. Move the slider, or play it, and read what the open trade is showing at each moment.
              </p>
              <div className="mt-13 rounded-sm border border-line bg-paper p-8">
                <PathChart
                  pips={pips}
                  at={tick}
                  entryPips={entryPips}
                  price={priceText}
                  label={`An illustrative, invented price path of ${STORY.holdMinutes} simulated minutes. It starts at ${priceText(0)} and ends at ${priceText(endPips)}; the trade opened at ${fmt(entry, c.dp, c.dp)}. Not market data.`}
                />
              </div>
              <div className="mt-13 flex flex-wrap items-center gap-13">
                <label htmlFor="story-minute" className="label">
                  Simulated minute
                </label>
                <input
                  id="story-minute"
                  type="range"
                  className="range min-w-[10rem] flex-1"
                  min={0}
                  max={STORY.holdMinutes}
                  step={1}
                  value={minute}
                  aria-valuetext={`minute ${minute}: ${simSigned(floating)}`}
                  onChange={(e) => {
                    setPlaying(false);
                    setMinute(Number(e.target.value));
                  }}
                />
                <span className="num w-[4.5rem] text-right text-sm text-ink">{minute} min</span>
                <button type="button" className="btn btn-ghost btn-sm !h-[2.75rem]" onClick={() => (playing ? setPlaying(false) : play())}>
                  {playing ? "Pause" : minute >= STORY.holdMinutes ? "Play again" : "Play"}
                </button>
              </div>
              <dl className="mt-13 grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-4">
                {[
                  { label: "Price", value: priceText(pips[tick]), tone: "" },
                  { label: "Floating P/L", value: `${glyph(floating)} ${simSigned(floating)}`, tone: floating > 0 ? "text-pos" : floating < 0 ? "text-neg" : "" },
                  { label: "Equity", value: sim(equity), tone: "" },
                  { label: "Margin level", value: pct((equity / margin) * 100), tone: "" },
                ].map((f) => (
                  <div key={f.label} className="bg-paper p-13">
                    <dt className="label">{f.label}</dt>
                    <dd className={`num mt-3 text-[0.9375rem] font-medium ${f.tone || "text-ink"}`}>{f.value}</dd>
                  </div>
                ))}
              </dl>
              {/* read out only when the slider rests or the path is paused, not sixty times a second */}
              <p className="mt-13 max-w-measure text-ink-2" aria-live={playing ? "off" : "polite"}>
                {minute === 0
                  ? `Nothing has moved yet. The trade is showing ${simSigned(floating)}: the spread, and nothing else.`
                  : `After ${minute} simulated ${minute === 1 ? "minute" : "minutes"} the price is ${units(pips[tick])} ${pips[tick] >= 0 ? "above" : "below"} where it started, which is ${dir * pips[tick] >= 0 ? "in your favour" : "against you"} on a ${side}. The trade is showing ${simSigned(floating)}. It is a floating result: nothing is won or lost until the trade is closed.`}
                {minute >= ROLLOVER_MINUTE && rollovers > 0 ? ` At minute ${ROLLOVER_MINUTE} the simulated day rolled over and a swap of ${sim(SIM.swapPerLot * lots)} was charged for holding the position through it.` : ""}
                {gapsSeen.map((g) => ` At minute ${g.minute} the price jumped ${units(g.pips)} ${g.pips < 0 ? "down" : "up"} with no trading in between: a gap.`).join("")}
              </p>
              <p className="mt-8 max-w-measure text-sm text-ink-3">
                At its lowest on this path, at minute <span className="num">{Math.ceil(lowTick / TICKS_PER_MINUTE)}</span>, the trade was showing <span className="num">{simSigned(low)}</span>. A real stop loss, a margin call or a stop out could have ended it there; this story holds to the end so that every cost appears.
              </p>
              {chapter === 2 && (
                <button
                  type="button"
                  className="btn btn-primary mt-13"
                  onClick={() => {
                    setPlaying(false);
                    setMinute(STORY.holdMinutes);
                    goTo(3);
                  }}
                >
                  Close the trade at minute {STORY.holdMinutes}
                </button>
              )}
            </div>
          </li>
        )}

        {/* 4 */}
        {chapter >= 3 && (
          <li className={row}>
            {number(3)}
            <div className="min-w-0">
              {head(3)}
              <p className="mt-5 max-w-measure text-ink-2">
                The trade closes at <span className="num">{priceText(exitPips)}</span>, the {side === "buy" ? "bid" : "ask"}. Three charges stand between what the price did and what you keep: the spread, paid on the way in; {commission > 0 ? "the commission, taken when the trade opened" : "a commission, which this way of charging does not have"}; and the swap, charged at the rollover because the trade was still open.
              </p>
              <Rows
                className="mt-13 max-w-[34rem]"
                rows={[
                  { label: `What the price did (${units(endPips)} ${favour >= 0 ? "your way" : "against you"})`, value: simSigned(move), tone: move > 0 ? "pos" : move < 0 ? "neg" : undefined },
                  { label: "Spread", value: simSigned(-spreadCost) },
                  { label: "Commission", value: commission > 0 ? simSigned(-commission) : "None" },
                  { label: `Swap (${rollovers} ${rollovers === 1 ? "rollover" : "rollovers"})`, value: simSigned(-swap) },
                  { label: "Result", value: `${glyph(net)} ${simSigned(net)}`, tone: net > 0 ? "pos" : net < 0 ? "neg" : undefined },
                ]}
              />
              <Working
                steps={[
                  { what: `Price move, middle to middle, in ${c.unit}s${side === "sell" ? " (reversed for a sell)" : ""}`, calc: `(${priceText(endPips)} − ${priceText(0)}) ÷ ${fmt(c.point, 0, 4)}${side === "sell" ? " × −1" : ""} = ${fmt(favour * c.scale, 0, 1)}` },
                  { what: `Its value (${c.unit}s × value of one ${c.unit})`, calc: `${fmt(favour * c.scale, 0, 1)} × ${fmt(c.point * c.contract * lots, 2, 2)} = ${simSigned(move)}` },
                  { what: "Charges (spread + commission + swap)", calc: `${fmt(spreadCost, 2, 2)} + ${fmt(commission, 2, 2)} + ${fmt(swap, 2, 2)} = ${sim(costs)}` },
                  { what: "Result (move − charges)", calc: `${fmt(move, 2, 2)} − ${fmt(costs, 2, 2)} = ${simSigned(net)}` },
                  { what: "Balance", calc: `${fmt(balance, 2, 2)} ${net < 0 ? "−" : "+"} ${fmt(Math.abs(net), 2, 2)} = ${sim(balance + net)}` },
                ]}
              />
              {chapter === 3 && (
                <button type="button" className="btn btn-primary mt-13" onClick={() => goTo(4)}>
                  Say it in words
                </button>
              )}
            </div>
          </li>
        )}

        {/* 5 */}
        {chapter >= 4 && (
          <li className={row}>
            {number(4)}
            <div className="min-w-0">
              {head(4)}
              <div className="mt-5 grid max-w-measure gap-8 text-ink-2">
                <p>
                  You {side === "buy" ? "bought" : "sold"} <span className="num">{lotsText(lots)}</span> and held for {STORY.holdMinutes} simulated minutes. The price ended {units(endPips)} {endPips >= 0 ? "higher" : "lower"} than it began, which on a {side} was {favour >= 0 ? "in your favour" : "against you"}: on its own, that was worth <span className="num">{simSigned(move)}</span>.
                </p>
                <p>
                  The charges came to <span className="num">{sim(costs)}</span>: <span className="num">{sim(spreadCost)}</span> of spread{commission > 0 ? `, ${sim(commission)} of commission` : ""} and <span className="num">{sim(swap)}</span> of swap. They are owed whether the trade gains or loses.
                </p>
                <p className="text-ink">
                  The trade ended at <span className="num font-medium">{simSigned(net)}</span>, and the example balance went from <span className="num">{sim(balance)}</span> to <span className="num">{sim(balance + net)}</span>. The <span className="num">{sim(margin)}</span> of margin is released.
                </p>
                {move > 0 && net <= 0 && <p>The price went your way and the trade still did not gain: the charges were larger than the move. On a small move, costs decide the result.</p>}
                {move > 0 && net > 0 && <p>The charges took {pct((costs / move) * 100, 0)} of what the price gave.</p>}
                {move <= 0 && <p>The charges were added to the loss. They did not cause it, and they would have been the same had the price gone the other way.</p>}
                <p className="text-sm text-ink-3">This was one invented path. It says nothing about any market, and a different path number gives a different ending with the same arithmetic.</p>
              </div>
              <div className="mt-13 flex flex-wrap gap-8">
                <button type="button" className="btn btn-ghost" onClick={() => again(() => setSide(side === "buy" ? "sell" : "buy"))}>
                  Same path, as a {side === "buy" ? "sell" : "buy"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => again(() => setSeed((s) => s + 1))}>
                  Another path
                </button>
                <a href="#desk" className="btn btn-quiet">
                  Try it on the practice desk
                </a>
              </div>
              <p className="mt-13 text-sm text-ink-3">
                The same sums with your own figures:{" "}
                <Link href="/tools/margin" className="link">
                  Margin
                </Link>
                ,{" "}
                <Link href="/tools/profit-loss" className="link">
                  Profit &amp; Loss
                </Link>
                ,{" "}
                <Link href="/tools/cost-lab" className="link">
                  Cost Lab
                </Link>
                .
              </p>
            </div>
          </li>
        )}
      </ol>

      {chapter < 4 && (
        <p className="mt-13 text-sm text-ink-3">
          <span className="num">{chapter + 1}</span> of <span className="num">{CHAPTERS.length}</span>: next, {CHAPTERS[chapter + 1].toLowerCase()}.
        </p>
      )}
      <DataNote status="simulation" className="mt-13">
        An illustration on an invented, seeded price path with made-up charges: not market data, not GIO4X’s quotes or conditions, and not a forecast. {educationalNote}
      </DataNote>
    </div>
  );
}
