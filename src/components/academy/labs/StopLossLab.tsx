"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { hash } from "@/components/glossary/diagrams/kit";
import { fmt, money } from "@/components/tools/calc";
import { Rows } from "@/components/tools/ui";
import { LabFrame, LabNote, Say, Slider, Stage, Tag, useWidth } from "./kit";

/**
 * Drag the stop loss.
 *
 * An example buy position on an abstract price path (a fixed, seeded wander:
 * no instrument, no prices on the axis, only pips from the entry). The stop
 * loss below the entry and the take profit above it can be dragged on the
 * drawing or moved with the sliders, which take the arrow keys. The distances,
 * the risk-reward ratio and the amount at risk follow.
 *
 * "Price gaps through the stop" draws what the lesson's arithmetic leaves out:
 * the price jumps past the level without trading at it, the order is filled at
 * the next price, and the loss is larger than the one planned.
 */

const TOP = 165; // pips above the entry at the top of the drawing
const BOTTOM = -135;
const STOP = { min: 10, max: 100, step: 5 };
const TARGET = { min: 10, max: 150, step: 5 };
/** how far past the stop the example gap is filled, in pips */
const GAP = 20;
/** the example position: one pip is worth this much */
const PIP_VALUE = 1;
const CCY = "USD";
const N = 40;

const snap = (v: number, r: { min: number; max: number; step: number }) => Math.min(r.max, Math.max(r.min, Math.round(v / r.step) * r.step));
const smooth = (u: number) => u * u * (3 - 2 * u);

export function StopLossLab() {
  const [stop, setStop] = useState(50);
  const [target, setTarget] = useState(100);
  const [gap, setGap] = useState(false);
  const [wrapRef, w] = useWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<"stop" | "target" | null>(null);
  /** pips between the pointer and the level it holds */
  const held = useRef(0);

  const narrow = w < 480;
  // taller on a phone, so a level moves a few pixels for each step of five pips
  const h = Math.round(Math.min(380, Math.max(narrow ? 310 : 260, w / 1.85)));
  const pad = 14;
  const x0 = 10;
  const x1 = w - (narrow ? 104 : 132);
  const xe = x0 + (x1 - x0) * 0.42;
  const xg = x0 + (x1 - x0) * 0.74;
  const Y = (p: number) => pad + ((TOP - p) / (TOP - BOTTOM)) * (h - pad * 2);

  // the path before the entry: the same wander on every visit, ending exactly at the entry
  const history = useMemo(() => {
    const raw = Array.from({ length: N + 1 }, (_, i) => 34 * Math.sin(i * 0.21 + 1) + 16 * Math.sin(i * 0.53) + 12 * (hash(i, 7) - 0.5));
    // rounded, so the server and every browser draw the same line whatever the last digit of their sine
    return raw.map((v, i) => Math.round((v - raw[N] * (i / N)) * 100) / 100);
  }, []);

  const historyPath = history.map((v, i) => `${i ? "L" : "M"}${(x0 + ((xe - x0) * i) / N).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");

  // the gap: the price sinks towards the stop, then the next price is GAP pips beyond it
  const before = -(stop - 5);
  const after = -(stop + GAP);
  const sink = Array.from({ length: 25 }, (_, i) => {
    const u = i / 24;
    return { x: xe + (xg - xe) * u, p: before * smooth(u) + 5 * Math.sin(u * 9) * Math.sin(Math.PI * u) };
  });
  const sinkPath = sink.map((s, i) => `${i ? "L" : "M"}${s.x.toFixed(1)} ${Y(s.p).toFixed(1)}`).join(" ");
  const xf = xg + (x1 - xg) * 0.16;
  const tail = Array.from({ length: 9 }, (_, i) => ({ x: xf + ((x1 - 14 - xf) * i) / 8, p: after - 6 * Math.abs(Math.sin(i * 1.3)) * (i ? 1 : 0) }));
  const tailPath = tail.map((s, i) => `${i ? "L" : "M"}${s.x.toFixed(1)} ${Y(s.p).toFixed(1)}`).join(" ");

  const risk = stop * PIP_VALUE;
  const gapLoss = (stop + GAP) * PIP_VALUE;
  const ratio = `1:${fmt(target / stop, 0, 2)}`;

  /** where the pointer is, in pips from the entry */
  const pipsAt = (e: ReactPointerEvent<HTMLDivElement>): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const y = ((e.clientY - r.top) * h) / Math.max(1, r.height);
    return TOP - ((y - pad) / (h - pad * 2)) * (TOP - BOTTOM);
  };
  const fromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pipsAt(e);
    if (p === null || !drag.current) return;
    // the level keeps the distance from the pointer it had when it was taken hold of, so it never jumps
    if (drag.current === "stop") setStop(snap(-(p - held.current), STOP));
    else setTarget(snap(p - held.current, TARGET));
  };
  const grab = (which: "stop" | "target") => ({
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      const p = pipsAt(e);
      if (p === null) return;
      drag.current = which;
      held.current = p - (which === "stop" ? -stop : target);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* a pointer that cannot be captured still moves the level while it stays over it */
      }
    },
    onPointerMove: fromPointer,
    onPointerUp: () => {
      drag.current = null;
    },
    onPointerCancel: () => {
      drag.current = null;
    },
  });

  const lx = x1 + 20;
  const level = (p: number, tone: "neg" | "pos", dash: string) => (
    <g>
      <line x1={x0} x2={x1} y1={Y(p)} y2={Y(p)} stroke={`var(--${tone})`} strokeWidth={1.75} strokeDasharray={dash} />
      {/* the grip: three short bars, so the line reads as something to take hold of */}
      <rect x={x1 - 13} y={Y(p) - 9} width={26} height={18} rx={3} fill="var(--surface)" stroke={`var(--${tone})`} strokeWidth={1.5} />
      {[-4, 0, 4].map((d) => (
        <line key={d} x1={x1 - 6} x2={x1 + 6} y1={Y(p) + d} y2={Y(p) + d} stroke={`var(--${tone})`} strokeWidth={1.25} />
      ))}
    </g>
  );
  /**
   * What the pointer takes hold of: a strip over the level, reaching away from
   * the entry so the two never cover each other. It is an HTML element laid
   * over the drawing because `touch-action` is not reliably honoured on shapes
   * inside an SVG, and a finger dragging a level must not scroll the page.
   */
  const handle = (p: number, which: "stop" | "target") => (
    <div
      className="absolute inset-x-0 h-[36px] cursor-ns-resize touch-none"
      style={{ top: `${(Y(p) / h) * 100}%`, marginTop: which === "stop" ? -8 : -28 }}
      data-handle={which}
      {...grab(which)}
    />
  );

  return (
    <LabFrame lab="stop-loss">
      <Stage>
        <div ref={wrapRef} className="relative">
          {handle(target, "target")}
          {handle(-stop, "stop")}
          <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" aria-hidden focusable="false">
            {/* the two distances, as bands on the side of the drawing where nothing has happened yet */}
            <rect x={xe} y={Y(target)} width={x1 - xe} height={Y(0) - Y(target)} fill="var(--pos)" opacity={0.07} />
            <rect x={xe} y={Y(0)} width={x1 - xe} height={Y(-stop) - Y(0)} fill="var(--neg)" opacity={0.08} />
            <line x1={xe} x2={xe} y1={pad} y2={h - pad} stroke="var(--line-strong)" strokeWidth={1} strokeDasharray="2 4" />

            <path d={historyPath} fill="none" stroke="var(--ink)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
            <line x1={x0} x2={x1} y1={Y(0)} y2={Y(0)} stroke="var(--ink)" strokeWidth={1.25} />
            <circle cx={xe} cy={Y(0)} r={4.5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.75} />

            {gap ? (
              <g data-gap>
                <path d={sinkPath} fill="none" stroke="var(--ink)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
                <line x1={xg} x2={xf} y1={Y(before)} y2={Y(after)} stroke="var(--ink-3)" strokeWidth={1.25} strokeDasharray="3 3" />
                <path d={tailPath} fill="none" stroke="var(--ink)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={xf} cy={Y(after)} r={5.5} fill="var(--surface)" stroke="var(--neg)" strokeWidth={2} />
                <line x1={xf - 3} x2={xf + 3} y1={Y(after) - 3} y2={Y(after) + 3} stroke="var(--neg)" strokeWidth={1.5} />
                <line x1={xf - 3} x2={xf + 3} y1={Y(after) + 3} y2={Y(after) - 3} stroke="var(--neg)" strokeWidth={1.5} />
                <Tag x={Math.min(xf + 10, x1 - 4)} y={Y(after) + 17} anchor={narrow ? "end" : "start"} tone="neg" size={narrow ? 11 : 12}>
                  {`Filled ${GAP} pips lower`}
                </Tag>
                <Tag x={(xg + xf) / 2 - 8} y={Y((before + after) / 2)} anchor="end" tone="ink-3" size={11}>
                  gap
                </Tag>
              </g>
            ) : (
              <Tag x={(xe + x1) / 2} y={Y(target) > pad + 30 ? pad + 12 : h - pad - 8} anchor="middle" tone="ink-3" weight={500} size={narrow ? 11 : 12}>
                What happens next is not known
              </Tag>
            )}

            <Tag x={xe + 10} y={Y(target / 2)} tone="ink-2" size={narrow ? 11 : 12}>
              {`Reward ${target} pips`}
            </Tag>
            {!gap && (
              <Tag x={xe + 10} y={Y(-stop / 2)} tone="ink-2" size={narrow ? 11 : 12}>
                {`Risk ${stop} pips`}
              </Tag>
            )}

            {level(target, "pos", "7 4")}
            {level(-stop, "neg", "3 3")}

            <Tag x={lx} y={Y(target)} tone="pos" size={narrow ? 11 : 12}>
              Take profit
            </Tag>
            <Tag x={lx} y={Y(0)} tone="ink" size={narrow ? 11 : 12}>
              Entry
            </Tag>
            <Tag x={lx} y={Y(-stop)} tone="neg" size={narrow ? 11 : 12}>
              Stop loss
            </Tag>
          </svg>
        </div>
      </Stage>

      <div className="mt-13 grid gap-x-34 gap-y-5 sm:grid-cols-2">
        <Slider name="stop" label="Stop loss, below the entry" value={stop} min={STOP.min} max={STOP.max} step={STOP.step} onChange={setStop} text={`${stop} pips`} />
        <Slider name="target" label="Take profit, above the entry" value={target} min={TARGET.min} max={TARGET.max} step={TARGET.step} onChange={setTarget} text={`${target} pips`} />
      </div>
      <label className="check mt-8 min-h-[2.75rem] items-center">
        <input type="checkbox" checked={gap} onChange={(e) => setGap(e.target.checked)} data-gap-toggle />
        <span>Price gaps through the stop</span>
      </label>

      <Rows
        className="mt-13"
        rows={[
          { label: "Distance to the stop loss", value: `${stop} pips` },
          { label: "Distance to the take profit", value: `${target} pips` },
          { label: "Risk-reward ratio", value: ratio },
          { label: "Amount at risk if the stop is filled at its level", value: money(risk, CCY), tone: "neg" },
          ...(gap ? [{ label: `Loss when the fill is ${GAP} pips beyond the stop`, value: money(gapLoss, CCY), tone: "neg" as const }] : []),
        ]}
      />

      <Say>
        The stop loss is {stop} pips below the entry and the take profit {target} pips above it: a risk-reward ratio of {ratio}.{" "}
        {gap
          ? `Here the price gaps: it never trades at the stop level, so the order is filled at the next price, ${GAP} pips lower, and the loss is ${money(gapLoss, CCY)} instead of the ${money(risk, CCY)} planned. A stop is an instruction to close, not a promise of a price.`
          : `If the stop is reached and filled at its level, this example position loses ${money(risk, CCY)}.`}
      </Say>

      <LabNote>
        The example position is one on which a pip is worth {money(PIP_VALUE, CCY)}, and the {GAP}-pip gap is chosen for the arithmetic: a real gap can be smaller or far larger. Spread and commission are left out.
      </LabNote>
    </LabFrame>
  );
}
