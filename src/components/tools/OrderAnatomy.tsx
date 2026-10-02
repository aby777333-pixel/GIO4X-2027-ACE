"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { DataNote } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { clamp, fmt, parse } from "./calc";
import { Live, RangeField, Rows, ToolLayout, type Step, type ToolProps } from "./ui";

/* --------------------------------------------------------------------------
   An abstract price scale. 100 is simply "where the price is when you start":
   it is not a quote for any instrument.
   -------------------------------------------------------------------------- */
const LO = 80;
const HI = 120;
const START = 100;
const H = 400;
const PAD = 22;
const AXIS_X = 40;
const yOf = (v: number) => PAD + ((HI - v) / (HI - LO)) * (H - 2 * PAD);
const snap = (v: number) => Math.round(v * 2) / 2;
const f1 = (v: number) => fmt(v, 1, 1);

type Kind = "market" | "buy-limit" | "sell-limit" | "buy-stop" | "sell-stop" | "stop-loss" | "take-profit";
type Def = { kind: Kind; name: string; side: "below" | "above" | "at"; family: "market" | "limit" | "stop"; rests: string; triggers: string; fills: string; level: number };

const DEFS: Def[] = [
  { kind: "market", name: "Market", side: "at", family: "market", level: START, rests: "Nowhere. A market order does not wait: it is sent to be filled now.", triggers: "Immediately, when you send it.", fills: "At the best price available when it reaches the market: the ask for a buy, the bid for a sell. That can differ from the price on screen when you clicked." },
  { kind: "buy-limit", name: "Buy limit", side: "below", family: "limit", level: 94, rests: "Below the current price.", triggers: "When the price falls to your level.", fills: "At your level or lower: your price or better, never worse. If the price never comes down to it, the order is never filled." },
  { kind: "sell-limit", name: "Sell limit", side: "above", family: "limit", level: 106, rests: "Above the current price.", triggers: "When the price rises to your level.", fills: "At your level or higher: your price or better, never worse. If the price never reaches it, the order is never filled." },
  { kind: "buy-stop", name: "Buy stop", side: "above", family: "stop", level: 106, rests: "Above the current price.", triggers: "When the price rises to your level.", fills: "It becomes a market order at that moment and is filled at the next available price, which can be above your level." },
  { kind: "sell-stop", name: "Sell stop", side: "below", family: "stop", level: 94, rests: "Below the current price.", triggers: "When the price falls to your level.", fills: "It becomes a market order at that moment and is filled at the next available price, which can be below your level." },
  { kind: "stop-loss", name: "Stop loss", side: "below", family: "stop", level: 94, rests: "On the losing side of an open position: below the price for a position that was bought.", triggers: "When the price falls to your level.", fills: "It becomes a market order to close the position. In a gap it is filled beyond the level, and the loss is larger than planned." },
  { kind: "take-profit", name: "Take profit", side: "above", family: "limit", level: 106, rests: "On the winning side of an open position: above the price for a position that was bought.", triggers: "When the price rises to your level.", fills: "It is a limit order to close the position: filled at your level or better." },
];
const DEFAULT_LEVELS = Object.fromEntries(DEFS.map((d) => [d.kind, d.level])) as Record<Kind, number>;
const hasPosition = (k: Kind) => k === "stop-loss" || k === "take-profit";

function useWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(Math.max(260, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function OrderAnatomy({ meta }: ToolProps) {
  const [kind, setKind] = useState<Kind>("buy-limit");
  const [price, setPrice] = useState(START);
  const [levels, setLevels] = useState(DEFAULT_LEVELS);
  const [fill, setFill] = useState<number | null>(null);
  const [ref, w] = useWidth(360);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<"price" | "order" | null>(null);

  const def = DEFS.find((d) => d.kind === kind) ?? DEFS[0];
  const level = levels[kind];
  const pending = kind !== "market";
  const orderMin = def.side === "below" ? LO + 1 : price + 0.5;
  const orderMax = def.side === "below" ? price - 0.5 : HI - 1;

  const movePrice = (raw: number) => {
    const next = clamp(snap(raw), LO + 1, HI - 1);
    if (pending && fill === null && (def.side === "below" ? next <= level : next >= level)) setFill(level);
    setPrice(next);
  };
  const moveLevel = (raw: number) => {
    if (!pending || fill !== null) return;
    setLevels((l) => ({ ...l, [kind]: clamp(snap(raw), orderMin, orderMax) }));
  };
  const choose = (k: Kind) => {
    setKind(k);
    setPrice(START);
    setFill(null);
    setLevels(DEFAULT_LEVELS);
  };
  const reset = () => choose(kind);

  const fromPointer = (e: PointerEvent) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return START;
    const yv = ((e.clientY - box.top) / box.height) * H;
    return HI - ((yv - PAD) / (H - 2 * PAD)) * (HI - LO);
  };
  const slider = (which: "price" | "order") => {
    const move = which === "price" ? movePrice : moveLevel;
    const now = which === "price" ? price : level;
    const min = which === "price" ? LO + 1 : orderMin;
    const max = which === "price" ? HI - 1 : orderMax;
    return {
      role: "slider" as const,
      tabIndex: 0,
      "aria-orientation": "vertical" as const,
      "aria-valuemin": min,
      "aria-valuemax": max,
      "aria-valuenow": now,
      style: { touchAction: "none" as const, cursor: "ns-resize" },
      onKeyDown: (e: KeyboardEvent) => {
        const d = e.key === "ArrowUp" || e.key === "ArrowRight" ? 0.5 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -0.5 : e.key === "PageUp" ? 2.5 : e.key === "PageDown" ? -2.5 : null;
        if (d !== null) {
          e.preventDefault();
          move(now + d);
        } else if (e.key === "Home") {
          e.preventDefault();
          move(min);
        } else if (e.key === "End") {
          e.preventDefault();
          move(max);
        }
      },
      onPointerDown: (e: PointerEvent<SVGGElement>) => {
        drag.current = which;
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: PointerEvent<SVGGElement>) => {
        if (drag.current === which) move(fromPointer(e));
      },
      onPointerUp: () => {
        drag.current = null;
      },
      onPointerCancel: () => {
        drag.current = null;
      },
    };
  };

  /* ---- what is happening, in words ---------------------------------------- */
  const distance = Math.abs(price - level);
  let status: string;
  if (kind === "market") {
    status = fill !== null ? `Filled at ${f1(fill)}, the price available when the order arrived. The price is now ${f1(price)}.` : `Nothing is resting. Move the price, then send the order: it fills at whatever the price is at that moment (now ${f1(price)}).`;
  } else if (fill !== null) {
    status =
      def.family === "limit"
        ? `Triggered: the price reached ${f1(fill)}. A limit order fills at its level or better, so the fill is ${f1(fill)}.${kind === "take-profit" ? ` The position bought at ${f1(START)} is closed ${f1(fill - START)} above its entry.` : ""}`
        : `Triggered: the price reached ${f1(fill)} and the order became a market order. Here the price moved smoothly, so it filled at ${f1(fill)}. Had the price jumped past the level, the fill would be beyond it: see the gap simulation below.${kind === "stop-loss" ? ` The position bought at ${f1(START)} is closed ${f1(Math.abs(START - fill))} ${fill < START ? "below" : "above"} its entry.` : ""}`;
  } else {
    status = `Resting at ${f1(level)}, ${f1(distance)} ${def.side} the price of ${f1(price)}. Nothing happens until the price ${def.side === "below" ? "falls" : "rises"} to ${f1(level)}.`;
  }

  const steps: Step[] = [
    { what: "Order", calc: kind === "market" ? "Market order: no level, filled on arrival" : `${def.name} at ${f1(level)}` },
    { what: "Price (abstract scale)", calc: f1(price) },
    ...(pending ? [{ what: "Distance from the price to the order", calc: `|${f1(price)} − ${f1(level)}| = ${f1(distance)}` }] : []),
    ...(pending ? [{ what: "Trigger condition", calc: `price ${def.side === "below" ? "≤" : "≥"} ${f1(level)}: ${fill !== null ? "met" : "not met"}` }] : []),
    { what: "State", calc: fill !== null ? `Filled at ${f1(fill)}` : kind === "market" ? "Not sent" : "Resting" },
  ];

  const lineL = AXIS_X + 10;
  const lineR = w - 6;
  const priceW = 96;
  const orderW = Math.min(138, lineR - (lineL + priceW + 10));
  const orderX = lineR - orderW;
  const ticks = [80, 85, 90, 95, 100, 105, 110, 115, 120];
  const zoneTop = def.side === "below" ? yOf(price) : PAD;
  const zoneBottom = def.side === "below" ? H - PAD : yOf(price);

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        "The scale is abstract: 100 is only where the price starts. It is not a quote for any instrument, and no spread is drawn, so “the price” stands for the bid or the ask as appropriate.",
        "Dragging moves the price smoothly through every level. Real prices can jump, which is the subject of the gap simulation.",
        "Stop loss and take profit are shown for a position that was bought. For a position that was sold they sit on the opposite sides.",
        "Whether, when and at what price an order is filled depends on the market at that moment. No order type removes that uncertainty.",
      ]}
    >
      <div role="group" aria-labelledby="order-kinds">
        <p id="order-kinds" className="label">
          Order type
        </p>
        <div className="flat mt-13 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line-strong bg-line sm:grid-cols-4">
          {DEFS.map((d) => (
            <button
              key={d.kind}
              type="button"
              aria-pressed={kind === d.kind}
              onClick={() => choose(d.kind)}
              className={`min-h-[2.75rem] px-8 text-xs font-semibold uppercase tracking-[0.08em] transition-colors duration-fast ${kind === d.kind ? "bg-ink text-bg" : "bg-surface text-ink-3 hover:text-ink"} ${d.kind === "market" ? "col-span-2 sm:col-span-1" : ""}`}
            >
              {d.name}
            </button>
          ))}
          <span aria-hidden className="hidden bg-surface sm:block" />
        </div>
      </div>

      <div className="mt-21 grid gap-21 md:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)]">
        <div ref={ref} className="min-w-0">
          <svg ref={svgRef} width="100%" height={H} viewBox={`0 0 ${w} ${H}`} className="select-none overflow-visible" role="group" aria-label={`Price axis from ${LO} to ${HI} with the current price${pending ? ` and a ${def.name.toLowerCase()} order` : ""}. Use the two sliders to move them.`}>
            {/* where this order type may rest */}
            {pending && fill === null && <rect x={lineL} y={zoneTop} width={lineR - lineL} height={Math.max(0, zoneBottom - zoneTop)} fill="var(--accent)" opacity="0.06" />}
            {pending && fill === null && (
              <text x={lineR - 6} y={def.side === "below" ? H - PAD - 8 : PAD + 14} textAnchor="end" fontSize="11" fill="var(--ink-3)">
                {def.name}s rest {def.side} the price
              </text>
            )}

            {/* axis */}
            <line x1={AXIS_X} x2={AXIS_X} y1={PAD} y2={H - PAD} stroke="var(--line-strong)" />
            {ticks.map((t) => (
              <g key={t}>
                <line x1={AXIS_X - 5} x2={AXIS_X} y1={yOf(t)} y2={yOf(t)} stroke="var(--line-strong)" />
                <line x1={lineL} x2={lineR} y1={yOf(t)} y2={yOf(t)} stroke="var(--viz-faint)" />
                <text x={AXIS_X - 9} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {t}
                </text>
              </g>
            ))}

            {/* the open position, for stop loss and take profit */}
            {hasPosition(kind) && (
              <g>
                <line x1={lineL} x2={lineR} y1={yOf(START)} y2={yOf(START)} stroke="var(--ink-3)" strokeDasharray="2 4" />
                <text x={lineR - 6} y={yOf(START) - 6} textAnchor="end" fontSize="11" fill="var(--ink-3)">
                  Position bought at {f1(START)}
                </text>
              </g>
            )}

            {/* the price */}
            <g {...slider("price")} aria-label="Market price" aria-valuetext={`Price ${f1(price)}`}>
              <line x1={lineL} x2={lineR} y1={yOf(price)} y2={yOf(price)} stroke="var(--ink)" strokeWidth="1.5" />
              <rect x={lineL} y={yOf(price) - 22} width={priceW} height={44} fill="transparent" />
              <rect x={lineL} y={yOf(price) - 14} width={priceW} height={28} rx={3} fill="var(--ink)" />
              <text x={lineL + priceW / 2} y={yOf(price) + 4} textAnchor="middle" fontSize="11" fontWeight="600" letterSpacing="0.04em" fill="var(--bg)" style={{ fontVariantNumeric: "tabular-nums" }}>
                PRICE {f1(price)}
              </text>
            </g>
            {/* the order */}
            {pending && (
              <g {...(fill === null ? slider("order") : {})} aria-label={fill === null ? `${def.name} level` : undefined} aria-valuetext={fill === null ? `${def.name} at ${f1(level)}, ${f1(distance)} ${def.side} the price` : undefined}>
                <line x1={lineL} x2={lineR} y1={yOf(level)} y2={yOf(level)} stroke="var(--accent)" strokeWidth={fill !== null ? 2 : 1.5} strokeDasharray={fill !== null ? undefined : "6 4"} />
                <rect x={orderX} y={yOf(level) - 22} width={orderW} height={44} fill="transparent" />
                <rect x={orderX} y={yOf(level) - 14} width={orderW} height={28} rx={3} fill={fill !== null ? "var(--accent)" : "var(--surface)"} stroke="var(--accent)" strokeWidth="1.5" />
                <text x={orderX + orderW / 2} y={yOf(level) + 4} textAnchor="middle" fontSize="11" fontWeight="600" letterSpacing="0.04em" fill={fill !== null ? "var(--accent-ink)" : "var(--accent)"} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fill !== null ? `FILLED ${f1(fill)}` : `${def.name.toUpperCase()} ${f1(level)}`}
                </text>
              </g>
            )}
            {kind === "market" && fill !== null && (
              <g>
                <line x1={lineL} x2={lineR} y1={yOf(fill)} y2={yOf(fill)} stroke="var(--accent)" strokeWidth="2" />
                <rect x={orderX} y={yOf(fill) - 14} width={orderW} height={28} rx={3} fill="var(--accent)" />
                <text x={orderX + orderW / 2} y={yOf(fill) + 4} textAnchor="middle" fontSize="11" fontWeight="600" letterSpacing="0.04em" fill="var(--accent-ink)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  FILLED {f1(fill)}
                </text>
              </g>
            )}

          </svg>
          <p className="mt-8 text-xs text-ink-3">Drag the solid handle to move the price and the outlined handle to move the order. With a keyboard: Tab to a handle, then the arrow keys (Page Up and Page Down for larger steps).</p>
        </div>

        <div className="min-w-0">
          <h3 className="h4">{def.name} order</h3>
          <dl className="mt-13 grid gap-13 text-sm">
            <div>
              <dt className="label">Where it rests</dt>
              <dd className="mt-3 text-ink-2">{def.rests}</dd>
            </div>
            <div>
              <dt className="label">When it triggers</dt>
              <dd className="mt-3 text-ink-2">{def.triggers}</dd>
            </div>
            <div>
              <dt className="label">What it fills at</dt>
              <dd className="mt-3 text-ink-2">{def.fills}</dd>
            </div>
          </dl>
          <Live className="mt-21 border-t border-line-strong pt-13">
            <p className="label">{fill !== null ? "Filled" : kind === "market" ? "Not sent" : "Resting"}</p>
            <p className="mt-5 min-h-[6.5rem] text-sm text-ink">{status}</p>
          </Live>
          <div className="mt-8 flex flex-wrap gap-8">
            {kind === "market" && fill === null && (
              <button type="button" className="btn btn-primary" onClick={() => setFill(price)}>
                Send market order
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Start again
            </button>
          </div>
        </div>
      </div>

      <DataNote status="simulation" className="mt-21">
        A diagram driven by your own hand on an abstract scale: no market data. {educationalNote}
      </DataNote>
      <p className="mt-13 max-w-measure text-xs text-ink-3">
        This tool shows where an order rests and when it triggers. For what happens to one order before and after that, from the ticket to the balance, see{" "}
        <Link href="/labs/trade-anatomy" className="link">
          Trade Anatomy
        </Link>{" "}
        in Labs.
      </p>

      <GapSimulation />
    </ToolLayout>
  );
}

/* ==========================================================================
   SIMULATION: a stop filled beyond its level when the price gaps
   ========================================================================== */

const STOP = 94;
const LAST = 95;
const G_LO = 82;
const G_HI = 101;
const GH = 260;
const PRE: [number, number][] = [[0, 100], [0.1, 99.2], [0.2, 99.6], [0.31, 97.4], [0.42, LAST]];

function GapSimulation() {
  const [gapRaw, setGapRaw] = useState("4");
  const [ref, w] = useWidth(360);
  const gap = parse(gapRaw, { label: "Gap", min: 0, max: 10 });
  const g = gap.ok ? gap.n : 0;
  const open = LAST - g;
  const post: [number, number][] = [[0.58, open], [0.7, open - 0.8], [0.85, open - 0.4], [1, open - 2]];

  // First price at or beyond the stop once trading resumes.
  let fillAt = open;
  let fillX = 0.58;
  if (open > STOP) {
    for (let i = 1; i < post.length; i++) {
      const [x0, y0] = post[i - 1];
      const [x1, y1] = post[i];
      if (y1 <= STOP) {
        const t = (y0 - STOP) / (y0 - y1);
        fillX = x0 + t * (x1 - x0);
        fillAt = STOP;
        break;
      }
    }
  }
  const slippage = STOP - fillAt;

  const left = AXIS_X + 10;
  const right = w - 8;
  const X = (t: number) => left + t * (right - left);
  const Y = (v: number) => 16 + ((G_HI - v) / (G_HI - G_LO)) * (GH - 40);
  const d = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? "L" : "M"}${X(a).toFixed(1)} ${Y(b).toFixed(1)}`).join(" ");

  return (
    <section className="mt-34 border-t border-line-strong pt-21" aria-labelledby="gap-sim">
      <p className="chip">Simulation</p>
      <h3 id="gap-sim" className="h4 mt-13">
        When the price gaps past a stop
      </h3>
      <p className="mt-5 max-w-measure text-sm text-ink-2">
        A stop is an instruction to trade at the next available price once its level is reached. If the market closes at one price and reopens at another, there are no prices in between to trade at. The path below is invented to show the mechanism.
      </p>

      <div className="mt-13 max-w-[21rem]">
        <RangeField id="gap" label="Size of the gap" value={gapRaw} onChange={setGapRaw} error={gap.error} min={0} max={10} step={0.5} hint="How far the price jumps while no trading takes place." />
      </div>

      <div ref={ref} className="mt-8">
        <svg width="100%" height={GH} viewBox={`0 0 ${w} ${GH}`} role="img" aria-label={`Simulated price path. The price trades down to ${f1(LAST)}, then reopens at ${f1(open)}. A stop at ${f1(STOP)} is filled at ${f1(fillAt)}.`} className="overflow-visible">
          <rect x={X(0.42)} y={8} width={X(0.58) - X(0.42)} height={GH - 32} fill="var(--viz-faint)" />
          <text x={(X(0.42) + X(0.58)) / 2} y={22} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
            no prices
          </text>
          <line x1={AXIS_X} x2={AXIS_X} y1={8} y2={GH - 24} stroke="var(--line-strong)" />
          {[85, 90, 95, 100].map((t) => (
            <text key={t} x={AXIS_X - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {t}
            </text>
          ))}
          {/* the stop level */}
          <line x1={left} x2={right} y1={Y(STOP)} y2={Y(STOP)} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="6 4" />
          <text x={left + 4} y={Y(STOP) + 15} fontSize="11" fontWeight="600" fill="var(--accent)">
            STOP {f1(STOP)}
          </text>
          {/* the path */}
          <path d={d(PRE)} fill="none" stroke="var(--ink)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          <path d={d(post)} fill="none" stroke="var(--ink)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          {g > 0 && <line x1={X(0.42)} x2={X(0.58)} y1={Y(LAST)} y2={Y(open)} stroke="var(--ink-3)" strokeDasharray="1 4" />}
          <circle cx={X(0.42)} cy={Y(LAST)} r="3" fill="var(--ink)" />
          {/* slippage bracket */}
          {slippage > 0 && (
            <g>
              <line x1={X(fillX) + 14} x2={X(fillX) + 14} y1={Y(STOP)} y2={Y(fillAt)} stroke="var(--neg)" strokeWidth="2" />
              <text x={X(fillX) + 20} y={(Y(STOP) + Y(fillAt)) / 2 + 4} fontSize="11" fontWeight="600" fill="var(--neg)">
                slippage {f1(slippage)}
              </text>
            </g>
          )}
          <circle cx={X(fillX)} cy={Y(fillAt)} r="5" fill="var(--neg)" stroke="var(--surface)" strokeWidth="2" />
          <text x={X(fillX) - 8} y={Y(fillAt) + 18} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--neg)">
            FILL {f1(fillAt)}
          </text>
          <text x={left} y={GH - 6} fontSize="11" fill="var(--ink-3)">
            time →
          </text>
        </svg>
      </div>

      <Live>
        <Rows
          className="mt-8"
          rows={[
            { label: "Last price before the gap", value: f1(LAST) },
            { label: "First price after it", value: f1(open) },
            { label: `Sell stop at ${f1(STOP)} is filled at`, value: f1(fillAt), tone: slippage > 0 ? "neg" : undefined },
            { label: "Slippage (level − fill)", value: slippage > 0 ? `${f1(STOP)} − ${f1(fillAt)} = ${f1(slippage)} worse` : "None: the price traded through the level", tone: slippage > 0 ? "neg" : undefined },
            { label: `A buy limit at ${f1(STOP)} in the same gap is filled at`, value: slippage > 0 ? `${f1(fillAt)}, which is ${f1(slippage)} better` : f1(STOP) },
          ]}
        />
      </Live>
      <p className="mt-13 max-w-measure text-xs text-ink-3">
        An invented path on an abstract scale, labelled as a simulation: it is not a record of any market and not a statement of how often or how far prices gap. The asymmetry is the point. A limit order is filled at its level or better; a stop order can be filled worse than its level.
      </p>
    </section>
  );
}
