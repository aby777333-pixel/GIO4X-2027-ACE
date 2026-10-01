/**
 * An interface STUDY, not a screenshot. It conveys the structure of a trading
 * workspace (watchlist, chart, order ticket, positions) using shapes instead
 * of numbers, so no price, spread or feature is implied that has not been
 * verified. Every use is captioned as illustrative.
 */
export function TerminalStudy({ className, variant = "raptor" }: { className?: string; variant?: "raptor" | "mt5" }) {
  const symbols = variant === "raptor" ? ["EUR/USD", "XAU/USD", "US500", "GBP/USD", "BTC/USD", "USD/JPY", "BRENT"] : ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "US30", "USDCHF", "AUDUSD"];
  // a calm, deterministic path: geometry, not market data
  const pts = [0, 6, 3, 9, 7, 13, 10, 8, 14, 18, 15, 21, 19, 17, 24, 28, 26, 31, 29, 34, 30, 38, 36, 41].map((v, i) => [40 + i * 15.2, 208 - v * 3.4] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} 232 L40 232 Z`;
  return (
    <svg viewBox="0 0 610 377" className={className} role="img" aria-label={`Illustrative study of the ${variant === "raptor" ? "777 Raptor" : "MetaTrader 5"} workspace layout: watchlist, chart, order ticket and positions`}>
      <defs>
        <linearGradient id={`ts-area-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`ts-dna-${variant}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--dna-teal)" />
          <stop offset="0.5" stopColor="var(--dna-blue)" />
          <stop offset="1" stopColor="var(--dna-emerald)" />
        </linearGradient>
      </defs>
      {/* frame */}
      <rect x="0.5" y="0.5" width="609" height="376" rx="5" fill="var(--surface)" stroke="var(--line-strong)" />
      <rect x="0.5" y="0.5" width="609" height="21" rx="5" fill="var(--paper)" />
      <path d="M0 21.5h610" stroke="var(--line)" />
      <rect x="13" y="8" width="55" height="5" rx="1" fill="var(--ink-3)" opacity="0.5" />
      <rect x="0" y="21" width="610" height="1" fill={`url(#ts-dna-${variant})`} opacity="0.9" />

      {/* chart */}
      <g>
        {[70, 111, 152, 193].map((y) => (
          <path key={y} d={`M40 ${y}h350`} stroke="var(--line)" strokeDasharray="2 5" />
        ))}
        <path d={area} fill={`url(#ts-area-${variant})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill="var(--accent)" />
        <path d={`M40 ${pts[pts.length - 1][1]}H390`} stroke="var(--accent)" strokeOpacity="0.35" strokeDasharray="3 3" />
        {/* timeframe tabs */}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={40 + i * 26} y="36" width="21" height="8" rx="1" fill={i === 2 ? "var(--ink)" : "var(--line-strong)"} opacity={i === 2 ? 0.85 : 0.5} />
        ))}
        <path d="M21 232.5h382M403.5 22v355" stroke="var(--line)" />
      </g>

      {/* positions */}
      <g>
        <rect x="21" y="246" width="55" height="5" rx="1" fill="var(--ink-3)" opacity="0.55" />
        {[0, 1, 2, 3].map((r) => (
          <g key={r} transform={`translate(21 ${266 + r * 26})`}>
            <rect width="34" height="5" rx="1" fill="var(--ink)" opacity="0.7" />
            <rect x="89" width="34" height="5" rx="1" fill="var(--line-strong)" />
            <rect x="170" width="55" height="5" rx="1" fill="var(--line-strong)" />
            <rect x="290" width={[34, 21, 42, 28][r]} height="5" rx="1" fill={r % 2 ? "var(--neg)" : "var(--pos)"} opacity="0.7" />
            <path d="M0 15.5h366" stroke="var(--line)" />
          </g>
        ))}
      </g>

      {/* watchlist */}
      <g fontFamily="var(--font-inter), system-ui, sans-serif" fontSize="9" fontWeight="600" letterSpacing="0.4">
        {symbols.map((s, i) => (
          <g key={s} transform={`translate(417 ${40 + i * 24})`}>
            <text y="7" fill="var(--ink)" opacity={i === 0 ? 1 : 0.72}>
              {s}
            </text>
            <rect x="89" y="1" width="34" height="5" rx="1" fill="var(--line-strong)" />
            <rect x="134" y="1" width="34" height="5" rx="1" fill="var(--line-strong)" />
            <path d="M0 15.5h180" stroke="var(--line)" />
            {i === 0 && <rect x="-8" y="-6" width="2" height="20" fill="var(--accent)" />}
          </g>
        ))}
      </g>

      {/* order ticket */}
      <g transform="translate(417 222)">
        <rect width="180" height="142" rx="3" fill="var(--paper)" stroke="var(--line)" />
        <rect x="13" y="13" width="55" height="5" rx="1" fill="var(--ink-3)" opacity="0.55" />
        <rect x="13" y="30" width="154" height="21" rx="2" fill="var(--surface)" stroke="var(--line)" />
        <rect x="13" y="59" width="72" height="21" rx="2" fill="var(--surface)" stroke="var(--line)" />
        <rect x="95" y="59" width="72" height="21" rx="2" fill="var(--surface)" stroke="var(--line)" />
        <rect x="13" y="97" width="72" height="30" rx="2" fill="var(--neg)" opacity="0.14" stroke="var(--neg)" strokeOpacity="0.5" />
        <rect x="95" y="97" width="72" height="30" rx="2" fill="var(--pos)" opacity="0.14" stroke="var(--pos)" strokeOpacity="0.5" />
        <rect x="35" y="110" width="28" height="5" rx="1" fill="var(--neg)" opacity="0.8" />
        <rect x="117" y="110" width="28" height="5" rx="1" fill="var(--pos)" opacity="0.8" />
      </g>
    </svg>
  );
}
