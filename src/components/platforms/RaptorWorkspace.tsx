import { useId } from "react";
import type { RegionKey } from "@/data/platforms";

/**
 * A larger interface STUDY for the Raptor page: nine areas of a trading
 * workspace, drawn with shapes instead of numbers so that no price, spread or
 * feature is implied. It is not a screenshot and is always captioned as such.
 *
 * `focus` dims every other area; `ring` outlines the focused areas; `viewBox`
 * crops the drawing to a region for the narrative beats.
 */
export const WORKSPACE = { w: 960, h: 600 } as const;

export const REGIONS: Record<RegionKey, { x: number; y: number; w: number; h: number }> = {
  workspace: { x: 0, y: 0, w: 560, h: 36 },
  account: { x: 560, y: 0, w: 400, h: 36 },
  explorer: { x: 0, y: 36, w: 200, h: 214 },
  watchlist: { x: 0, y: 250, w: 200, h: 350 },
  chart: { x: 200, y: 36, w: 520, h: 364 },
  positions: { x: 200, y: 400, w: 320, h: 200 },
  history: { x: 520, y: 400, w: 200, h: 200 },
  order: { x: 720, y: 36, w: 240, h: 300 },
  risk: { x: 720, y: 336, w: 240, h: 264 },
};

const SYMBOLS = ["EUR/USD", "XAU/USD", "US500", "GBP/USD", "BTC/USD", "USD/JPY", "XBR/USD", "DE40", "AUD/USD", "XAG/USD", "US100"];
const CLASSES = ["Forex", "Metals", "Indices", "Energy", "Equities", "Crypto"];

// Deterministic geometry, not market data.
const CLOSES = [4, 9, 6, 12, 10, 16, 13, 11, 17, 21, 18, 24, 22, 20, 27, 31, 29, 34, 32, 37, 33, 41, 39, 44, 42, 47, 43, 40, 45, 50, 48, 53, 51, 56];
const CANDLES = CLOSES.map((c, i) => {
  const o = i === 0 ? 1 : CLOSES[i - 1];
  const wick = ((i % 3) + 1) * 1.7;
  const y = (v: number) => 352 - v * 4.5;
  return { x: 252 + i * 12.8, o: y(o), c: y(c), hi: y(Math.max(o, c) + wick), lo: y(Math.min(o, c) - wick * 0.8), up: c >= o };
});
const AVG = CANDLES.map((k, i) => {
  const from = Math.max(0, i - 4);
  const slice = CANDLES.slice(from, i + 1);
  const m = slice.reduce((s, q) => s + (q.o + q.c) / 2, 0) / slice.length;
  return `${i ? "L" : "M"}${k.x.toFixed(1)} ${(m + 6).toFixed(1)}`;
}).join(" ");

export function RaptorWorkspace({
  className,
  focus,
  ring = false,
  viewBox,
  label = "Illustrative study of a trading workspace: workspace tabs, account information, market explorer, watchlist, chart, order entry, risk controls, positions and history",
}: {
  className?: string;
  focus?: RegionKey[];
  ring?: boolean;
  viewBox?: string;
  label?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const dim = (k: RegionKey) => ({
    opacity: focus && !focus.includes(k) ? 0.26 : 1,
    transition: "opacity var(--t-slow) var(--ease-out)",
  });
  const last = CANDLES[CANDLES.length - 1];

  return (
    <svg viewBox={viewBox ?? `0 0 ${WORKSPACE.w} ${WORKSPACE.h}`} className={className} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`rw-dna-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--dna-teal)" />
          <stop offset="0.5" stopColor="var(--dna-blue)" />
          <stop offset="1" stopColor="var(--dna-emerald)" />
        </linearGradient>
        <linearGradient id={`rw-fade-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* frame */}
      <rect x="0.5" y="0.5" width="959" height="599" rx="6" fill="var(--surface)" stroke="var(--line-strong)" />
      <path d="M0.5 36.5V6.5a6 6 0 0 1 6-6h947a6 6 0 0 1 6 6v30z" fill="var(--paper)" />
      <rect x="0" y="36" width="960" height="1" fill={`url(#rw-dna-${uid})`} />
      <path d="M200.5 37v563M720.5 37v563M0 250.5h200M200 400.5h520M720 336.5h240M520.5 400v200" stroke="var(--line)" fill="none" />

      {/* workspace tabs */}
      <g style={dim("workspace")}>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={16 + i * 92} y="9" width="80" height="19" rx="2" fill={i === 0 ? "var(--surface)" : "none"} stroke="var(--line)" />
            <rect x={26 + i * 92} y="16" width={[44, 36, 52, 30][i]} height="5" rx="1" fill={i === 0 ? "var(--ink)" : "var(--ink-3)"} opacity={i === 0 ? 0.85 : 0.5} />
          </g>
        ))}
        <path d="M398 18.5h10M403 13.5v10" stroke="var(--ink-3)" strokeWidth="1.2" />
        <g transform="translate(470 11)" stroke="var(--ink-3)" fill="none" opacity="0.8">
          <rect x="0.5" y="0.5" width="15" height="14" rx="1" />
          <path d="M6.5 0.5v14M6.5 7.5h9" />
          <rect x="24.5" y="0.5" width="15" height="14" rx="1" />
          <path d="M24.5 9.5h15M32.5 0.5v9" />
        </g>
      </g>

      {/* account information */}
      <g style={dim("account")}>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${590 + i * 122} 0)`}>
            <rect y="9" width={[38, 30, 44][i]} height="4" rx="1" fill="var(--ink-3)" opacity="0.6" />
            <rect y="19" width={[78, 70, 58][i]} height="7" rx="1" fill="var(--ink)" opacity="0.75" />
            {i > 0 && <path d="M-16.5 8v20" stroke="var(--line)" />}
          </g>
        ))}
      </g>

      {/* market explorer */}
      <g style={dim("explorer")} fontFamily="var(--font-inter), system-ui, sans-serif" fontSize="10.5" fontWeight="500">
        <rect x="13" y="49" width="174" height="24" rx="2" fill="var(--paper)" stroke="var(--line)" />
        <circle cx="26" cy="60" r="4" fill="none" stroke="var(--ink-3)" />
        <path d="M29 63l4 4" stroke="var(--ink-3)" />
        <rect x="40" y="58" width="60" height="5" rx="1" fill="var(--ink-3)" opacity="0.4" />
        {CLASSES.map((c, i) => (
          <g key={c} transform={`translate(13 ${90 + i * 25})`}>
            <path d={i === 0 ? "M0 2l4 4 4-4" : "M2 0l4 4-4 4"} fill="none" stroke="var(--ink-3)" />
            <text x="18" y="8" fill="var(--ink)" opacity={i === 0 ? 1 : 0.72}>
              {c}
            </text>
            <rect x="140" y="2" width="34" height="5" rx="1" fill="var(--line-strong)" />
            <path d="M0 17.5h174" stroke="var(--line)" />
          </g>
        ))}
      </g>

      {/* watchlist */}
      <g style={dim("watchlist")} fontFamily="var(--font-inter), system-ui, sans-serif" fontSize="10.5" fontWeight="600" letterSpacing="0.3">
        <rect x="13" y="264" width="58" height="5" rx="1" fill="var(--ink-3)" opacity="0.6" />
        <rect x="118" y="264" width="24" height="5" rx="1" fill="var(--line-strong)" />
        <rect x="158" y="264" width="24" height="5" rx="1" fill="var(--line-strong)" />
        {SYMBOLS.map((s, i) => (
          <g key={s} transform={`translate(13 ${286 + i * 28})`}>
            {i === 0 && <rect x="-13" y="-6" width="200" height="28" fill="var(--brand-soft)" />}
            {i === 0 && <rect x="-13" y="-6" width="2" height="28" fill="var(--accent)" />}
            <text y="12" fill="var(--ink)" opacity={i === 0 ? 1 : 0.74}>
              {s}
            </text>
            <rect x="105" y="5" width="28" height="5" rx="1" fill="var(--line-strong)" />
            <rect x="145" y="5" width="28" height="5" rx="1" fill="var(--line-strong)" />
            <path d="M-13 22.5h200" stroke="var(--line)" />
          </g>
        ))}
      </g>

      {/* chart */}
      <g style={dim("chart")}>
        <rect x="214" y="49" width="62" height="7" rx="1" fill="var(--ink)" opacity="0.8" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={300 + i * 30} y="46" width="24" height="13" rx="2" fill={i === 3 ? "var(--ink)" : "none"} stroke="var(--line-strong)" opacity={i === 3 ? 0.85 : 0.7} />
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x="211.5" y={84.5 + i * 25} width="14" height="14" rx="2" fill="none" stroke="var(--line-strong)" />
        ))}
        <path d="M218 88v7M214 91h8M214 119l9-6M215 141h8v-5M214 163l4-5 4 5M214 190h9M216 208c2 4 5 4 7 0" stroke="var(--ink-3)" fill="none" />
        {[112, 172, 232, 292, 352].map((y) => (
          <g key={y}>
            <path d={`M240 ${y}.5h440`} stroke="var(--line)" strokeDasharray="2 6" />
            <rect x="690" y={y - 2} width="22" height="4" rx="1" fill="var(--line-strong)" />
          </g>
        ))}
        <path d={`${AVG} L${last.x.toFixed(1)} 372 L${CANDLES[0].x.toFixed(1)} 372 Z`} fill={`url(#rw-fade-${uid})`} />
        {CANDLES.map((k, i) => (
          <g key={i} stroke={k.up ? "var(--pos)" : "var(--neg)"} fill={k.up ? "var(--pos)" : "var(--neg)"} opacity="0.86">
            <path d={`M${k.x.toFixed(1)} ${k.hi.toFixed(1)}V${k.lo.toFixed(1)}`} strokeWidth="1" />
            <rect x={(k.x - 3.6).toFixed(1)} y={Math.min(k.o, k.c).toFixed(1)} width="7.2" height={Math.max(2, Math.abs(k.o - k.c)).toFixed(1)} rx="0.5" stroke="none" />
          </g>
        ))}
        <path d={AVG} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={`M240 ${last.c.toFixed(1)}H684`} stroke="var(--accent)" strokeOpacity="0.45" strokeDasharray="3 3" />
        <rect x="684" y={(last.c - 7).toFixed(1)} width="32" height="14" rx="2" fill="var(--accent)" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={262 + i * 76} y="384" width="26" height="4" rx="1" fill="var(--line-strong)" />
        ))}
      </g>

      {/* positions */}
      <g style={dim("positions")}>
        <rect x="213" y="412" width="62" height="6" rx="1" fill="var(--ink)" opacity="0.8" />
        <rect x="213" y="424" width="62" height="1.5" fill="var(--accent)" />
        <rect x="296" y="412" width="44" height="6" rx="1" fill="var(--ink-3)" opacity="0.45" />
        {[0, 1, 2, 3, 4].map((r) => (
          <g key={r} transform={`translate(213 ${448 + r * 29})`}>
            <rect width="44" height="6" rx="1" fill="var(--ink)" opacity="0.72" />
            <rect x="70" width="22" height="6" rx="1" fill={r % 3 === 1 ? "var(--neg)" : "var(--pos)"} opacity="0.55" />
            <rect x="118" width="36" height="6" rx="1" fill="var(--line-strong)" />
            <rect x="178" width="36" height="6" rx="1" fill="var(--line-strong)" />
            <rect x="244" width={[38, 24, 46, 30, 20][r]} height="6" rx="1" fill={r % 2 ? "var(--neg)" : "var(--pos)"} opacity="0.75" />
            <path d="M0 17.5h294" stroke="var(--line)" />
          </g>
        ))}
      </g>

      {/* history */}
      <g style={dim("history")}>
        <rect x="533" y="412" width="50" height="6" rx="1" fill="var(--ink-3)" opacity="0.7" />
        <rect x="660" y="410" width="46" height="11" rx="2" fill="none" stroke="var(--line-strong)" />
        {[0, 1, 2, 3, 4].map((r) => (
          <g key={r} transform={`translate(533 ${448 + r * 29})`}>
            <rect width="30" height="5" rx="1" fill="var(--ink-3)" opacity="0.5" />
            <rect x="44" width="40" height="5" rx="1" fill="var(--ink)" opacity="0.5" />
            <rect x="134" width={[30, 38, 22, 34, 26][r]} height="5" rx="1" fill="var(--line-strong)" />
            <path d="M0 17.5h174" stroke="var(--line)" />
          </g>
        ))}
      </g>

      {/* order entry */}
      <g style={dim("order")}>
        <rect x="734" y="50" width="64" height="6" rx="1" fill="var(--ink-3)" opacity="0.7" />
        <rect x="734.5" y="68.5" width="211" height="30" rx="2" fill="var(--paper)" stroke="var(--line)" />
        <rect x="746" y="80" width="56" height="7" rx="1" fill="var(--ink)" opacity="0.8" />
        <path d="M926 81l5 5 5-5" fill="none" stroke="var(--ink-3)" />
        <g>
          <rect x="734.5" y="110.5" width="100" height="24" rx="2" fill="var(--surface)" stroke="var(--line-strong)" />
          <rect x="845.5" y="110.5" width="100" height="24" rx="2" fill="none" stroke="var(--line)" />
          <rect x="762" y="120" width="44" height="5" rx="1" fill="var(--ink)" opacity="0.75" />
          <rect x="873" y="120" width="44" height="5" rx="1" fill="var(--ink-3)" opacity="0.5" />
        </g>
        <rect x="734" y="152" width="40" height="4" rx="1" fill="var(--ink-3)" opacity="0.6" />
        <rect x="734.5" y="162.5" width="211" height="30" rx="2" fill="var(--paper)" stroke="var(--line)" />
        <path d="M750 177.5h10M920 177.5h10M925 172.5v10" stroke="var(--ink-2)" strokeWidth="1.2" />
        <rect x="816" y="174" width="48" height="7" rx="1" fill="var(--ink)" opacity="0.8" />
        <rect x="734" y="208" width="52" height="4" rx="1" fill="var(--ink-3)" opacity="0.6" />
        <rect x="734.5" y="218.5" width="211" height="30" rx="2" fill="var(--paper)" stroke="var(--line)" />
        <rect x="746" y="230" width="70" height="7" rx="1" fill="var(--line-strong)" />
        <rect x="734.5" y="270.5" width="100" height="44" rx="3" fill="var(--neg)" fillOpacity="0.14" stroke="var(--neg)" strokeOpacity="0.55" />
        <rect x="845.5" y="270.5" width="100" height="44" rx="3" fill="var(--pos)" fillOpacity="0.14" stroke="var(--pos)" strokeOpacity="0.55" />
        <rect x="766" y="289" width="36" height="7" rx="1" fill="var(--neg)" opacity="0.85" />
        <rect x="877" y="289" width="36" height="7" rx="1" fill="var(--pos)" opacity="0.85" />
      </g>

      {/* risk controls */}
      <g style={dim("risk")}>
        <rect x="734" y="352" width="72" height="6" rx="1" fill="var(--ink-3)" opacity="0.7" />
        {[0, 1].map((i) => (
          <g key={i} transform={`translate(734 ${376 + i * 58})`}>
            <rect x="0.5" y="0.5" width="28" height="15" rx="7.5" fill={i === 0 ? "var(--accent)" : "none"} stroke={i === 0 ? "var(--accent)" : "var(--line-strong)"} />
            <circle cx={i === 0 ? 21 : 8} cy="8" r="5" fill={i === 0 ? "var(--surface)" : "var(--ink-3)"} />
            <rect x="40" y="5" width={i === 0 ? 50 : 62} height="6" rx="1" fill="var(--ink)" opacity="0.72" />
            <rect x="0.5" y="24.5" width="211" height="24" rx="2" fill="var(--paper)" stroke="var(--line)" />
            <rect x="12" y="34" width="52" height="6" rx="1" fill={i === 0 ? "var(--ink)" : "var(--line-strong)"} opacity={i === 0 ? 0.7 : 1} />
          </g>
        ))}
        <rect x="734" y="504" width="58" height="4" rx="1" fill="var(--ink-3)" opacity="0.6" />
        <rect x="734" y="518" width="212" height="6" rx="3" fill="var(--line)" />
        <rect x="734" y="518" width="132" height="6" rx="3" fill="var(--accent)" opacity="0.8" />
        <path d="M778.5 512v18M809.5 512v18" stroke="var(--ink-2)" />
        <rect x="734" y="544" width="90" height="5" rx="1" fill="var(--line-strong)" />
        <rect x="734" y="560" width="126" height="5" rx="1" fill="var(--line-strong)" />
        <rect x="734" y="576" width="70" height="5" rx="1" fill="var(--line-strong)" />
      </g>

      {/* focus rings */}
      {ring &&
        focus?.map((k) => {
          const r = REGIONS[k];
          return <rect key={k} x={r.x + 3} y={r.y + 3} width={r.w - 6} height={r.h - 6} rx="4" fill="none" stroke="var(--accent)" strokeWidth="1.5" />;
        })}
    </svg>
  );
}

/**
 * Three arrangements of the same panels: what "a workspace" means, shown
 * without claiming any particular layout feature.
 */
export function LayoutStudies({ className }: { className?: string }) {
  const frames: { label: string; panels: [number, number, number, number, boolean?][] }[] = [
    {
      label: "Chart first",
      panels: [
        [0, 0, 150, 96, true],
        [154, 0, 66, 46],
        [154, 50, 66, 46],
        [0, 100, 220, 36],
      ],
    },
    {
      label: "Detail below",
      panels: [
        [0, 0, 220, 80, true],
        [0, 84, 72, 52],
        [74, 84, 72, 52],
        [148, 84, 72, 52],
      ],
    },
    {
      label: "List first",
      panels: [
        [0, 0, 70, 136],
        [74, 0, 146, 62, true],
        [74, 66, 146, 70],
      ],
    },
  ];
  return (
    <svg viewBox="0 0 720 172" className={className} role="img" aria-label="Three illustrative arrangements of the same workspace panels">
      {frames.map((f, i) => (
        <g key={f.label} transform={`translate(${i * 246 + 4} 4)`}>
          <rect x="-3.5" y="-3.5" width="227" height="143" rx="4" fill="var(--surface)" stroke={i === 0 ? "var(--accent)" : "var(--line-strong)"} />
          {f.panels.map(([x, y, w, h, chart], j) => (
            <g key={j}>
              <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx="2" fill="var(--paper)" stroke="var(--line)" />
              {chart ? (
                <path d={`M${x + 8} ${y + h - 12} l${(w - 16) * 0.25} ${-(h - 24) * 0.4} l${(w - 16) * 0.2} ${(h - 24) * 0.22} l${(w - 16) * 0.3} ${-(h - 24) * 0.55} l${(w - 16) * 0.25} ${(h - 24) * 0.15}`} fill="none" stroke="var(--accent)" strokeWidth="1.2" />
              ) : (
                Array.from({ length: Math.max(1, Math.floor((h - 12) / 12)) }).map((_, r) => <rect key={r} x={x + 7} y={y + 8 + r * 12} width={Math.max(10, (w - 14) * (r % 2 ? 0.55 : 0.8))} height="4" rx="1" fill="var(--line-strong)" />)
              )}
            </g>
          ))}
          <text x="-3" y="160" fontFamily="var(--font-inter), system-ui, sans-serif" fontSize="8.5" fontWeight="600" letterSpacing="1" fill="var(--ink-3)">
            {f.label.toUpperCase()}
          </text>
        </g>
      ))}
    </svg>
  );
}
