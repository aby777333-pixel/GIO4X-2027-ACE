import { KIND_LABEL, KIND_ORDER, type NodeKind } from "@/data/graph";

/**
 * Node kinds are told apart by SHAPE first (eight distinct silhouettes), then
 * by a legend and by label styling. Colour only groups them loosely:
 * markets in ink, institutions and their events in the accent, vocabulary in
 * the second accent, things you use in the third.
 */
export const KIND_TONE: Record<NodeKind, string> = {
  assetClass: "var(--ink)",
  instrument: "var(--ink)",
  currency: "var(--ink)",
  centralBank: "var(--accent)",
  event: "var(--accent)",
  concept: "var(--accent-2)",
  tool: "var(--accent-3)",
  platform: "var(--accent-3)",
};

export const KIND_SHAPE: Record<NodeKind, string> = {
  assetClass: "solid square",
  instrument: "solid circle",
  currency: "solid diamond",
  centralBank: "solid triangle",
  event: "cross",
  concept: "open circle",
  tool: "open square",
  platform: "plus",
};

const f = (n: number) => Number(n.toFixed(2));

/** The mark for a kind, centred on the origin of the current SVG group. `s` is its half-size in user units. */
export function Glyph({ kind, s, ground = "var(--bg)", tone }: { kind: NodeKind; s: number; ground?: string; tone?: string }) {
  const c = tone ?? KIND_TONE[kind];
  const w = Math.max(1, s * 0.36);
  switch (kind) {
    case "assetClass":
      return <rect x={f(-s * 0.86)} y={f(-s * 0.86)} width={f(s * 1.72)} height={f(s * 1.72)} fill={c} />;
    case "instrument":
      return <circle r={f(s * 0.92)} fill={c} />;
    case "currency":
      return <path d={`M0 ${f(-s * 1.18)}L${f(s * 1.18)} 0L0 ${f(s * 1.18)}L${f(-s * 1.18)} 0Z`} fill={c} />;
    case "centralBank":
      return <path d={`M0 ${f(-s * 1.12)}L${f(s * 1.12)} ${f(s * 0.84)}L${f(-s * 1.12)} ${f(s * 0.84)}Z`} fill={c} />;
    case "event":
      return <path d={`M${f(-s * 0.84)} ${f(-s * 0.84)}L${f(s * 0.84)} ${f(s * 0.84)}M${f(s * 0.84)} ${f(-s * 0.84)}L${f(-s * 0.84)} ${f(s * 0.84)}`} fill="none" stroke={c} strokeWidth={f(w * 1.1)} />;
    case "concept":
      return <circle r={f(s * 0.84)} fill={ground} stroke={c} strokeWidth={f(w)} />;
    case "tool":
      return <rect x={f(-s * 0.76)} y={f(-s * 0.76)} width={f(s * 1.52)} height={f(s * 1.52)} fill={ground} stroke={c} strokeWidth={f(w)} />;
    case "platform":
      return <path d={`M0 ${f(-s)}L0 ${f(s)}M${f(-s)} 0L${f(s)} 0`} fill="none" stroke={c} strokeWidth={f(w * 1.1)} />;
  }
}

/** The same mark as an inline icon for HTML contexts (lists, legend, chips). */
export function KindMark({ kind, size = 13, className = "" }: { kind: NodeKind; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="-8 -8 16 16" aria-hidden className={`shrink-0 ${className}`}>
      <Glyph kind={kind} s={5.6} ground="transparent" />
    </svg>
  );
}

/** Shape legend. A list, so it reads as text too. */
export function KindLegend({ kinds = KIND_ORDER, className = "" }: { kinds?: NodeKind[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-21 gap-y-8 text-xs text-ink-2 ${className}`} aria-label="Legend: node kinds by shape">
      {kinds.map((k) => (
        <li key={k} className="flex items-center gap-8">
          <KindMark kind={k} />
          <span>
            {KIND_LABEL[k].one}
            <span className="sr-only"> ({KIND_SHAPE[k]})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Label styling per kind: a second, non-colour cue on the map. */
export function labelStyle(kind: NodeKind): { fontStyle?: "italic"; letterSpacing?: string; fontWeight?: number } {
  if (kind === "concept") return { fontStyle: "italic" };
  if (kind === "centralBank" || kind === "event") return { letterSpacing: "0.06em", fontWeight: 600 };
  if (kind === "assetClass" || kind === "platform") return { fontWeight: 600 };
  return {};
}
