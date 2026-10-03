"use client";

// Currency-pair correlation matrix — indicative 30-day rolling values for
// major FX pairs + gold. Pure presentation, no runtime data fetch; values
// are intentionally hardcoded "indicative" snapshots so the table renders
// instantly and survives offline / API-rate-limit conditions. Hover a pair
// label (or click on touch devices) to dim everything except that pair's
// row + column and highlight the pairs it correlates with most strongly.

import { useState, type ReactNode } from "react";

export const CORRELATION_PAIRS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "AUD/USD",
  "USD/CAD",
  "NZD/USD",
  "XAU/USD",
] as const;

// 8x8 symmetric matrix, diagonal = 1.
export const CORRELATION_MATRIX: number[][] = [
  [  1.00,  0.85, -0.55, -0.92,  0.75, -0.55,  0.70,  0.40 ],
  [  0.85,  1.00, -0.45, -0.78,  0.70, -0.50,  0.65,  0.35 ],
  [ -0.55, -0.45,  1.00,  0.55, -0.30,  0.45, -0.25, -0.40 ],
  [ -0.92, -0.78,  0.55,  1.00, -0.65,  0.60, -0.60, -0.45 ],
  [  0.75,  0.70, -0.30, -0.65,  1.00, -0.55,  0.92,  0.65 ],
  [ -0.55, -0.50,  0.45,  0.60, -0.55,  1.00, -0.55, -0.30 ],
  [  0.70,  0.65, -0.25, -0.60,  0.92, -0.55,  1.00,  0.55 ],
  [  0.40,  0.35, -0.40, -0.45,  0.65, -0.30,  0.55,  1.00 ],
];

function cellTone(v: number, isDiagonal: boolean): { bg: string; text: string } {
  if (isDiagonal) return { bg: "bg-navy", text: "text-white" };
  if (v >= 0.8)  return { bg: "bg-emerald-500/90",  text: "text-white" };
  if (v >= 0.5)  return { bg: "bg-emerald-300/80",  text: "text-emerald-950" };
  if (v >= 0.2)  return { bg: "bg-emerald-100",     text: "text-emerald-900" };
  if (v > -0.2)  return { bg: "bg-slate-100",       text: "text-steel" };
  if (v > -0.5)  return { bg: "bg-rose-100",        text: "text-rose-900" };
  if (v > -0.8)  return { bg: "bg-rose-300/80",     text: "text-rose-950" };
  return            { bg: "bg-rose-500/90",     text: "text-white" };
}

function fmt(v: number): string {
  if (v >= 1) return "1.00";
  if (v <= -1) return "-1.00";
  const s = v.toFixed(2);
  return v > 0 ? `+${s}` : s;
}

// When `hovered` is set, decide how to style a header cell for `pair`.
// The hovered pair itself stays bold/active; pairs strongly correlated to
// it (|r| ≥ 0.6) get an accent ring; weak pairs fade.
function headerHighlight(
  pair: string,
  hovered: string | null,
  pairIndex: number,
  hoveredIndex: number,
): string {
  if (!hovered) return "text-navy";
  if (pair === hovered) return "text-sky font-bold underline decoration-sky decoration-2 underline-offset-4";
  const r = Math.abs(CORRELATION_MATRIX[hoveredIndex][pairIndex]);
  if (r >= 0.8) return "text-navy font-semibold";
  if (r >= 0.6) return "text-navy";
  if (r >= 0.3) return "text-steel";
  return "text-steel-light";
}

function LegendChip({ swatch, label }: { swatch: string; label: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${swatch}`} />
      <span className="text-[10px] text-steel">{label}</span>
    </span>
  );
}

export function CurrencyCorrelation() {
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredIndex = hovered ? CORRELATION_PAIRS.indexOf(hovered as (typeof CORRELATION_PAIRS)[number]) : -1;

  const hoverOn = (pair: string) => setHovered(pair);
  const hoverOff = () => setHovered(null);
  // Touch / keyboard parity: tapping or focusing a pair toggles it.
  const togglePair = (pair: string) => setHovered((prev) => (prev === pair ? null : pair));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-steel">FX research</div>
          <div className="mt-0.5 text-base font-semibold text-navy">Pair correlation matrix</div>
          <div className="mt-1 text-[11px] text-steel">
            How major pairs and gold tend to move together. Values are{" "}
            <span className="font-medium text-navy">indicative · 30-day rolling</span>. Hover a pair
            (tap on mobile) to dim the unrelated cells.
          </div>
        </div>
        <div className="hidden flex-wrap items-center justify-end gap-3 sm:flex">
          <LegendChip swatch="bg-emerald-500/90" label="≥ +0.8" />
          <LegendChip swatch="bg-emerald-300/80" label="+0.5" />
          <LegendChip swatch="bg-slate-100"       label="≈ 0" />
          <LegendChip swatch="bg-rose-300/80"     label="-0.5" />
          <LegendChip swatch="bg-rose-500/90"     label="≤ -0.8" />
        </div>
      </div>

      <div className="overflow-x-auto" onMouseLeave={hoverOff}>
        {/*
          w-full + table-fixed makes the matrix occupy the full Card width on
          desktop while giving every value cell the same column width (so the
          grid reads as a true heatmap rather than auto-sized to the widest
          number). min-w preserves the mobile horizontal-scroll fallback.
        */}
        <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0 text-xs">
          <colgroup>
            <col className="w-[88px]" />
            {CORRELATION_PAIRS.map((p) => (
              <col key={p} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left text-[11px] uppercase tracking-wider text-steel">
                Pair
              </th>
              {CORRELATION_PAIRS.map((p, j) => (
                <th
                  key={p}
                  scope="col"
                  onMouseEnter={() => hoverOn(p)}
                  onFocus={() => hoverOn(p)}
                  onClick={() => togglePair(p)}
                  tabIndex={0}
                  className={`cursor-pointer select-none px-3 py-2.5 text-center font-semibold transition-colors ${headerHighlight(
                    p, hovered, j, hoveredIndex,
                  )}`}
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CORRELATION_MATRIX.map((row, i) => {
              const rowPair = CORRELATION_PAIRS[i];
              const rowHovered = hovered === rowPair;
              return (
                <tr key={rowPair}>
                  <th
                    scope="row"
                    onMouseEnter={() => hoverOn(rowPair)}
                    onFocus={() => hoverOn(rowPair)}
                    onClick={() => togglePair(rowPair)}
                    tabIndex={0}
                    className={`sticky left-0 z-10 cursor-pointer select-none bg-white px-3 py-2.5 text-left text-xs font-semibold transition-colors ${headerHighlight(
                      rowPair, hovered, i, hoveredIndex,
                    )}`}
                  >
                    {rowPair}
                  </th>
                  {row.map((v, j) => {
                    const colPair = CORRELATION_PAIRS[j];
                    const tone = cellTone(v, i === j);
                    const inHoveredRowOrCol = hovered !== null && (rowHovered || hovered === colPair);
                    const dimmed = hovered !== null && !inHoveredRowOrCol;
                    const intersection = hovered !== null && rowHovered && hovered === colPair;
                    return (
                      <td
                        key={colPair}
                        onMouseEnter={() => hoverOn(rowPair)}
                        className={[
                          "px-3 py-2.5 text-center font-mono text-xs transition-all",
                          tone.bg,
                          tone.text,
                          dimmed ? "opacity-25" : "opacity-100",
                          inHoveredRowOrCol ? "ring-1 ring-inset ring-navy/40" : "",
                          intersection ? "outline outline-2 outline-sky" : "",
                        ].join(" ")}
                        title={`${rowPair} vs ${colPair}: ${fmt(v)}`}
                      >
                        {fmt(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-steel-light">
        <span>
          {hovered ? (
            <>
              Highlighted: <span className="font-semibold text-navy">{hovered}</span>. Bright cells
              ⇒ pairs it actually correlates with; faded cells ⇒ ignore for {hovered} sizing.
            </>
          ) : (
            <>
              Read cell-by-cell: positive ⇒ pairs trend together; negative ⇒ opposite; near 0 ⇒
              unrelated over the window.
            </>
          )}
        </span>
        <span className="flex flex-wrap gap-2 sm:hidden">
          <LegendChip swatch="bg-emerald-500/90" label="+0.8" />
          <LegendChip swatch="bg-slate-100" label="0" />
          <LegendChip swatch="bg-rose-500/90" label="-0.8" />
        </span>
      </div>
    </div>
  );
}
