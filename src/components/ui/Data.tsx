import { formatPct } from "@/lib/rates";

/**
 * A change value. Direction is carried by a glyph and a sign as well as by
 * colour, so it reads in greyscale and for colour-blind visitors.
 */
export function Change({ value, className = "" }: { value: number | null; className?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className={`num text-ink-3 ${className}`}>n/a</span>;
  const flat = Math.abs(value) < 0.005;
  const up = value > 0;
  return (
    <span className={`num inline-flex items-baseline gap-3 ${flat ? "text-neutral" : up ? "text-pos" : "text-neg"} ${className}`}>
      <span aria-hidden className="text-[0.7em]">
        {flat ? "◆" : up ? "▲" : "▼"}
      </span>
      <span>
        <span className="sr-only">{flat ? "unchanged " : up ? "up " : "down "}</span>
        {formatPct(value)}
      </span>
    </span>
  );
}

/** A micro chart: shape only, no axes. Always paired with real numbers nearby. */
export function Sparkline({
  values,
  width = 89,
  height = 34,
  className = "",
  tone,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  tone?: "pos" | "neg" | "neutral";
  label?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const resolved = tone ?? (values[values.length - 1] > values[0] ? "pos" : values[values.length - 1] < values[0] ? "neg" : "neutral");
  const colour = resolved === "pos" ? "var(--pos)" : resolved === "neg" ? "var(--neg)" : "var(--neutral)";
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={d} fill="none" stroke={colour} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="1.75" fill={colour} />
    </svg>
  );
}

/** A horizontal range bar: where a value sits between a low and a high. */
export function RangeBar({ low, high, value, className = "" }: { low: number; high: number; value: number; className?: string }) {
  const pos = high > low ? Math.max(0, Math.min(1, (value - low) / (high - low))) : 0.5;
  return (
    <span className={`relative block h-[5px] w-full ${className}`} aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
      <span className="absolute top-0 h-[5px] w-px bg-ink" style={{ left: `${pos * 100}%` }} />
    </span>
  );
}
