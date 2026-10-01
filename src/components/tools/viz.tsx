import type { ReactNode } from "react";
import { clamp } from "./calc";

/**
 * Restrained drawings shared by the tools. Lines are SVG (stretched to the
 * box with non-scaling strokes); labels are HTML so they stay legible at any
 * width. Every drawing is decorative for assistive technology: the tool
 * states the same facts in text beside it.
 */

const toneBg = { neg: "bg-neg", pos: "bg-pos", ink: "bg-ink", accent: "bg-accent", muted: "bg-ink-3" } as const;
const toneText = { neg: "text-neg", pos: "text-pos", ink: "text-ink", accent: "text-accent", muted: "text-ink-3" } as const;
const toneVar = { neg: "var(--neg)", pos: "var(--pos)", ink: "var(--ink)", accent: "var(--accent)", muted: "var(--ink-3)" } as const;
export type Tone = keyof typeof toneBg;

/** A part shown as a share of a whole, to scale, with optional reference lines. */
export function ShareBar({
  share,
  tone = "neg",
  startLabel,
  endLabel,
  marks = [],
}: {
  /** 0–1 (values above 1 fill the bar) */
  share: number;
  tone?: Tone;
  startLabel: ReactNode;
  endLabel: ReactNode;
  marks?: { at: number; label: string; row?: 0 | 1 }[];
}) {
  const w = clamp(share, 0, 1) * 100;
  return (
    <div aria-hidden>
      <div className="relative h-[21px] bg-sunken">
        <div className={`absolute inset-y-0 left-0 ${toneBg[tone]} transition-[width] duration-fast`} style={{ width: `max(2px, ${w}%)`, opacity: 0.82 }} />
        {marks.map((m) => (
          <div key={m.label} className="absolute -inset-y-5 w-px bg-ink" style={{ left: `${clamp(m.at, 0, 1) * 100}%` }} />
        ))}
      </div>
      {marks.length > 0 && (
        <div className={`relative mt-8 ${marks.some((m) => m.row === 1) ? "h-[2.5rem]" : "h-[1.25rem]"}`}>
          {marks.map((m) => {
            const at = clamp(m.at, 0, 1) * 100;
            return (
              <span key={m.label} className="num absolute whitespace-nowrap text-xs text-ink-2" style={{ top: m.row === 1 ? "1.25rem" : 0, ...(at > 70 ? { right: `${100 - at}%` } : { left: `${at}%` }) }}>
                {m.label}
              </span>
            );
          })}
        </div>
      )}
      <div className="num mt-5 flex justify-between gap-13 text-xs text-ink-3">
        <span>{startLabel}</span>
        <span className="text-right">{endLabel}</span>
      </div>
    </div>
  );
}

export type RulerMark = { value: number; label: string; sub: string; tone?: Tone; side: "above" | "below" };

/** A horizontal price ruler: marks sit at their true relative distance. */
export function Ruler({ marks, spans }: { marks: RulerMark[]; spans: { from: number; to: number; tone: Tone; label?: string }[] }) {
  const values = marks.map((m) => m.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = hi - lo || Math.abs(hi) * 0.01 || 1;
  const pos = (v: number) => 12 + ((v - lo) / range) * 76;
  const anchor = (p: number) => (p < 25 ? { left: `${p}%` } : p > 75 ? { right: `${100 - p}%`, textAlign: "right" as const } : { left: `${p}%`, transform: "translateX(-50%)", textAlign: "center" as const });
  return (
    <div aria-hidden className="relative h-[144px] select-none">
      <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
      {spans.map((s, i) => {
        const a = pos(Math.min(s.from, s.to));
        const b = pos(Math.max(s.from, s.to));
        return <div key={i} className={`absolute top-1/2 h-[8px] -translate-y-1/2 ${toneBg[s.tone]}`} style={{ left: `${a}%`, width: `${Math.max(0.4, b - a)}%`, opacity: 0.78 }} />;
      })}
      {marks.map((m) => {
        const p = pos(m.value);
        return (
          <div key={m.label}>
            <div className={`absolute w-px ${toneBg[m.tone ?? "ink"]} ${m.side === "above" ? "bottom-1/2 h-[21px]" : "top-1/2 h-[21px]"}`} style={{ left: `${p}%` }} />
            <div className={`absolute whitespace-nowrap ${m.side === "above" ? "bottom-[calc(50%+26px)]" : "top-[calc(50%+26px)]"}`} style={anchor(p)}>
              <span className={`label block ${toneText[m.tone ?? "ink"]}`}>{m.label}</span>
              <span className="num block text-sm text-ink">{m.sub}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type PlotSeries = { points: [number, number][]; tone: Tone; dashed?: boolean; width?: number };
export type PlotPoint = { x: number; y: number; label: string; tone: Tone; place?: "left" | "right"; v?: "above" | "below" };

/** A small line chart with labelled axes. Lines stretch; text does not. */
export function Plot({
  series,
  x,
  y,
  xTicks,
  yTicks,
  points = [],
  refY,
  xLabel,
  yLabel,
  fills = [],
}: {
  series: PlotSeries[];
  x: [number, number];
  y: [number, number];
  xTicks: { at: number; label: string }[];
  yTicks: { at: number; label: string }[];
  points?: PlotPoint[];
  /** a horizontal reference line (e.g. the starting balance) */
  refY?: number;
  xLabel: string;
  yLabel: string;
  /** area between a series and the reference line */
  fills?: { points: [number, number][]; tone: Tone }[];
}) {
  const px = (v: number) => ((v - x[0]) / (x[1] - x[0] || 1)) * 100;
  const py = (v: number) => 100 - ((v - y[0]) / (y[1] - y[0] || 1)) * 100;
  const path = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? "L" : "M"}${px(a).toFixed(2)} ${clamp(py(b), -5, 105).toFixed(2)}`).join(" ");
  return (
    <div aria-hidden className="select-none">
      <p className="label mb-8">{yLabel}</p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-8">
        <div className="relative w-[3.4375rem]">
          {yTicks.map((t) => (
            <span key={t.label} className="num absolute right-0 -translate-y-1/2 whitespace-nowrap text-xs text-ink-3" style={{ top: `${py(t.at)}%` }}>
              {t.label}
            </span>
          ))}
        </div>
        <div className="relative aspect-[1.618/1] min-h-[13rem] w-full border-b border-l border-line-strong">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            {yTicks.map((t) => (
              <line key={t.label} x1="0" x2="100" y1={py(t.at)} y2={py(t.at)} stroke="var(--viz-faint)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {fills.map((f, i) => (
              <path key={i} d={`${path(f.points)} Z`} fill={toneVar[f.tone]} opacity="0.12" />
            ))}
            {refY !== undefined && <line x1="0" x2="100" y1={py(refY)} y2={py(refY)} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
            {series.map((s, i) => (
              <path
                key={i}
                d={path(s.points)}
                fill="none"
                stroke={toneVar[s.tone]}
                strokeWidth={s.width ?? 1.75}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {points.map((p) => {
            const left = px(p.x);
            const top = clamp(py(p.y), 0, 100);
            return (
              <div key={p.label}>
                <span className={`absolute h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface ${toneBg[p.tone]}`} style={{ left: `${left}%`, top: `${top}%` }} />
                <span
                  className={`num absolute whitespace-nowrap bg-surface px-3 text-xs font-medium ${toneText[p.tone]}`}
                  style={{
                    ...(p.place === "left" || (p.place === undefined && left > 60) ? { right: `calc(${100 - left}% + 8px)` } : { left: `calc(${left}% + 8px)` }),
                    top: `calc(${top}% + ${p.v === "below" || (p.v === undefined && top < 14) ? 7 : -24}px)`,
                  }}
                >
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>
        <div />
        <div className="relative mt-5 h-[1.25rem]">
          {xTicks.map((t) => {
            const at = px(t.at);
            return (
              <span key={t.label} className="num absolute top-0 whitespace-nowrap text-xs text-ink-3" style={at > 92 ? { right: 0 } : at < 4 ? { left: 0 } : { left: `${at}%`, transform: "translateX(-50%)" }}>
                {t.label}
              </span>
            );
          })}
        </div>
        <div />
        <p className="label mt-3 text-right">{xLabel}</p>
      </div>
    </div>
  );
}
