/**
 * Two explanatory diagrams. They illustrate a mechanism with arbitrary
 * proportions; they contain no figures and describe no real account.
 */

const font = { fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 0.9 } as const;

/** Copy trading: one provider's order, reproduced in several accounts at each copier's own scale. */
export function CopyDiagram({ className }: { className?: string }) {
  const copiers = [
    { y: 26, w: 92, label: "YOUR ACCOUNT", you: true },
    { y: 104, w: 54, label: "ANOTHER COPIER", you: false },
    { y: 182, w: 130, label: "ANOTHER COPIER", you: false },
  ];
  return (
    <svg viewBox="0 0 560 262" className={className} role="img" aria-label="Diagram: a provider’s order is reproduced in each copier’s own account, scaled to the amount that copier allocated">
      {/* provider */}
      <rect x="0.5" y="78.5" width="170" height="94" rx="4" fill="var(--surface)" stroke="var(--line-strong)" />
      <text x="16" y="102" fill="var(--ink-3)" {...font}>
        PROVIDER
      </text>
      <rect x="16" y="118" width="110" height="10" rx="1" fill="var(--ink)" opacity="0.8" />
      <rect x="16" y="140" width="64" height="5" rx="1" fill="var(--line-strong)" />
      <rect x="16" y="153" width="88" height="5" rx="1" fill="var(--line-strong)" />

      {/* signal */}
      {copiers.map((c) => (
        <g key={c.y}>
          <path d={`M171 125 C 240 125, 250 ${c.y + 26}, 318 ${c.y + 26}`} fill="none" stroke={c.you ? "var(--accent)" : "var(--line-strong)"} strokeWidth={c.you ? 1.5 : 1} strokeDasharray={c.you ? undefined : "3 4"} />
          <path d={`M312 ${c.y + 22}l7 4-7 4`} fill="none" stroke={c.you ? "var(--accent)" : "var(--line-strong)"} strokeWidth={c.you ? 1.5 : 1} />
          <rect x="322.5" y={c.y + 0.5} width="237" height="51" rx="4" fill={c.you ? "var(--surface)" : "var(--paper)"} stroke={c.you ? "var(--accent)" : "var(--line)"} />
          <text x="336" y={c.y + 20} fill={c.you ? "var(--ink)" : "var(--ink-3)"} {...font}>
            {c.label}
          </text>
          <rect x="336" y={c.y + 31} width={c.w} height="8" rx="1" fill="var(--ink)" opacity={c.you ? 0.8 : 0.4} />
        </g>
      ))}
      <text x="0" y="256" fill="var(--ink-3)" {...font} fontWeight={500} letterSpacing={0.2}>
        Same trade, sized to each allocation
      </text>
    </svg>
  );
}

/** PAMM: several allocations form one pool; the result is divided in the same proportions. */
export function PoolDiagram({ className }: { className?: string }) {
  const parts = [
    { label: "INVESTOR A", w: 0.42 },
    { label: "INVESTOR B", w: 0.24 },
    { label: "INVESTOR C", w: 0.2 },
    { label: "MANAGER", w: 0.14 },
  ];
  const W = 560;
  const xs = parts.reduce<number[]>((acc, p, i) => [...acc, i === 0 ? 0 : acc[i - 1] + parts[i - 1].w * W], []);
  const row = (y: number, h: number, strong: boolean) =>
    parts.map((p, i) => (
      <rect key={`${y}-${p.label}`} x={xs[i] + 1} y={y} width={p.w * W - 2} height={h} rx="1" fill={strong ? "var(--ink)" : "var(--accent)"} opacity={strong ? [0.82, 0.6, 0.42, 0.24][i] : [0.75, 0.55, 0.4, 0.25][i]} />
    ));
  return (
    <svg viewBox={`0 0 ${W} 250`} className={className} role="img" aria-label="Diagram: investors’ allocations form one pooled account traded by the manager, and the result is divided in the same proportions">
      <text x="0" y="12" fill="var(--ink-3)" {...font}>
        ALLOCATIONS
      </text>
      {row(24, 26, true)}
      {parts.map((p, i) => (
        <text key={p.label} x={xs[i] + 2} y="68" fill="var(--ink-2)" {...font} fontSize={9.5}>
          {p.label}
        </text>
      ))}

      <path d="M280 82v22" stroke="var(--line-strong)" />
      <rect x="90.5" y="104.5" width="379" height="44" rx="4" fill="var(--surface)" stroke="var(--line-strong)" />
      <text x="280" y="131" textAnchor="middle" fill="var(--ink)" {...font}>
        ONE POOLED ACCOUNT, TRADED BY THE MANAGER
      </text>
      <path d="M280 149v22M275 165l5 6 5-6" fill="none" stroke="var(--line-strong)" />

      <text x="0" y="192" fill="var(--ink-3)" {...font}>
        RESULT, PROFIT OR LOSS, DIVIDED BY SHARE
      </text>
      {row(204, 14, false)}
      <text x="0" y="242" fill="var(--ink-3)" {...font} fontWeight={500} letterSpacing={0.2}>
        Proportions are arbitrary and for illustration only
      </text>
    </svg>
  );
}
