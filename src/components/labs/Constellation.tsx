import { KIND_LABEL, type GraphNode } from "@/data/graph";
import { Glyph, KIND_TONE, labelStyle } from "./glyph";
import type { Frame, Layout } from "./layout";

/**
 * The Market Universe drawing. A pure function of a layout and (optionally)
 * one animation frame: it holds no state, so it renders on the server for the
 * no-JavaScript view and for static previews, and on the client for the live
 * instrument.
 */
export type StageConfig = {
  /** half-extent of the square viewBox */
  view: number;
  r1: number;
  /** radius of the hub that carries the focused node */
  hub: number;
  /** label the first ring only (1) or both rings (2) */
  labels: 1 | 2;
  clip1: number;
  clip2: number;
  /** glyph half-sizes for focus, first ring, second ring */
  glyph: [number, number, number];
  /** label sizes for first and second ring */
  font: [number, number];
  perParent: number;
  budget: number;
  min2: number;
  max2: number;
};

export const STAGE_WIDE: StageConfig = { view: 374, r1: 160, hub: 50, labels: 2, clip1: 12, clip2: 18, glyph: [9, 4.6, 3.1], font: [11.5, 10.5], perParent: 5, budget: 84, min2: 24, max2: 60 };
export const STAGE_COMPACT: StageConfig = { view: 226, r1: 132, hub: 42, labels: 1, clip1: 9, clip2: 0, glyph: [8, 4.6, 2.5], font: [12, 0], perParent: 3, budget: 56, min2: 12, max2: 28 };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const r2d = (a: number) => (a * 180) / Math.PI;
const f = (n: number) => Number(n.toFixed(1));

type Props = {
  layout: Layout;
  cfg: StageConfig;
  frame?: Frame;
  /** node under the pointer or the keyboard cursor */
  active?: string | null;
  onPick?: (id: string) => void;
  onHover?: (id: string | null) => void;
  ground?: string;
  className?: string;
};

export function Constellation({ layout, cfg, frame, active, onPick, onHover, ground = "var(--paper)", className }: Props) {
  const at = (id: string) => frame?.pos.get(id) ?? (() => { const p = layout.index.get(id); return p ? { x: p.x, y: p.y, o: 1 } : { x: 0, y: 0, o: 0 }; })();
  const labelO = frame?.labelOpacity ?? 1;
  const focus = layout.index.get(layout.focus);
  const v = cfg.view;

  /** Trim a line where it meets the hub, so spokes start at its rim. */
  const wire = (aId: string, bId: string) => {
    const a = at(aId);
    const b = at(bId);
    let ax = a.x, ay = a.y, bx = b.x, by = b.y;
    const d = Math.hypot(bx - ax, by - ay) || 1;
    if (aId === layout.focus) { ax += ((bx - ax) / d) * Math.min(cfg.hub, d); ay += ((by - ay) / d) * Math.min(cfg.hub, d); }
    if (bId === layout.focus) { bx -= ((bx - a.x) / d) * Math.min(cfg.hub, d); by -= ((by - a.y) / d) * Math.min(cfg.hub, d); }
    return { ax, ay, bx, by, o: Math.min(a.o, b.o) };
  };

  const hubLabel = focus ? clip(focus.node.short, 20) : "";
  const hubFont = Math.max(9, Math.min(cfg.hub * 0.34, (cfg.hub * 1.76) / Math.max(1, hubLabel.length * 0.56)));

  return (
    <svg viewBox={`${-v} ${-v} ${v * 2} ${v * 2}`} className={className} aria-hidden focusable="false" style={{ display: "block", width: "100%", height: "auto" }}>
      {/* the dial: two rings in the golden ratio, with a tick at each change of kind */}
      <circle r={layout.r1} fill="none" stroke="var(--viz-stroke)" strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
      <circle r={layout.r2} fill="none" stroke="var(--viz-stroke)" strokeOpacity={0.7} strokeDasharray="1 5" vectorEffect="non-scaling-stroke" />
      <g opacity={labelO}>
        {layout.ticks.map((a, i) => (
          <line key={i} x1={f(Math.cos(a) * (layout.r1 - 7))} y1={f(Math.sin(a) * (layout.r1 - 7))} x2={f(Math.cos(a) * (layout.r1 + 7))} y2={f(Math.sin(a) * (layout.r1 + 7))} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />
        ))}
      </g>

      {/* relations */}
      <g fill="none">
        {layout.wires.map((w) => {
          const { ax, ay, bx, by, o } = wire(w.a, w.b);
          const hot = !!active && (w.a === active || w.b === active);
          const stroke = hot ? "var(--accent)" : w.tier === 0 ? "var(--ink-3)" : "var(--viz-stroke)";
          const opacity = (hot ? 1 : w.tier === 0 ? 0.62 : w.tier === 1 ? 0.8 : 0.26) * o;
          const width = hot ? 1.4 : w.tier === 0 ? 1 : 0.75;
          if (w.tier === 2) {
            // a cross-link bows towards the centre so it never hides a node on the ring
            const mx = ((ax + bx) / 2) * 0.72;
            const my = ((ay + by) / 2) * 0.72;
            return <path key={`${w.a}|${w.b}`} d={`M${f(ax)} ${f(ay)}Q${f(mx)} ${f(my)} ${f(bx)} ${f(by)}`} stroke={stroke} strokeWidth={width} opacity={opacity} vectorEffect="non-scaling-stroke" />;
          }
          return <line key={`${w.a}|${w.b}`} x1={f(ax)} y1={f(ay)} x2={f(bx)} y2={f(by)} stroke={stroke} strokeWidth={width} opacity={opacity} vectorEffect="non-scaling-stroke" />;
        })}
      </g>

      {/* nodes that are leaving */}
      {frame?.ghosts.map((g) => (
        <g key={`ghost-${g.node.id}`} transform={`translate(${f(g.x)} ${f(g.y)})`} opacity={g.o}>
          <Glyph kind={g.node.kind} s={cfg.glyph[2]} ground={ground} />
        </g>
      ))}

      {/* rings */}
      {layout.placed.map((p) => {
        if (p.ring === 0) return null;
        const q = at(p.id);
        const hot = active === p.id;
        const s = p.ring === 1 ? cfg.glyph[1] : cfg.glyph[2];
        const labelled = p.ring <= cfg.labels || hot;
        const right = Math.cos(p.angle) >= 0;
        const size = p.ring === 1 ? cfg.font[0] : cfg.font[1] || cfg.font[0];
        const text = clip(p.node.short, p.ring === 1 ? cfg.clip1 : cfg.clip2 || cfg.clip1);
        const off = s + 5;
        return (
          <g
            key={p.id}
            transform={`translate(${f(q.x)} ${f(q.y)})`}
            opacity={q.o}
            onClick={onPick ? () => onPick(p.id) : undefined}
            onPointerEnter={onHover ? () => onHover(p.id) : undefined}
            onPointerLeave={onHover ? () => onHover(null) : undefined}
            style={onPick ? { cursor: "pointer" } : undefined}
          >
            {onPick && <circle r={Math.max(s + 6, v * 0.03)} fill="transparent" />}
            {hot && <circle r={s + 5} fill={ground} stroke="var(--accent)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />}
            <Glyph kind={p.node.kind} s={hot ? s * 1.15 : s} ground={ground} />
            {labelled && (
              <text
                transform={`rotate(${f(r2d(p.angle) + (right ? 0 : 180))})`}
                x={right ? off : -off}
                dy="0.34em"
                textAnchor={right ? "start" : "end"}
                fontSize={size}
                fill={hot ? "var(--accent)" : p.ring === 1 ? "var(--ink)" : "var(--ink-3)"}
                opacity={hot ? 1 : labelO}
                stroke={ground}
                strokeWidth={hot ? 4 : 2.5}
                paintOrder="stroke"
                strokeLinejoin="round"
                style={{ ...labelStyle(p.node.kind), fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}
              >
                {text}
              </text>
            )}
          </g>
        );
      })}

      {/* the hub */}
      {focus && <Hub node={focus.node} at={at(focus.id)} cfg={cfg} ground={ground} labelO={labelO} font={hubFont} text={hubLabel} />}
    </svg>
  );
}

function Hub({ node, at, cfg, ground, labelO, font, text }: { node: GraphNode; at: { x: number; y: number; o: number }; cfg: StageConfig; ground: string; labelO: number; font: number; text: string }) {
  const h = cfg.hub;
  return (
    <g transform={`translate(${f(at.x)} ${f(at.y)})`}>
      <circle r={h} fill={ground} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />
      <circle r={h - 4} fill="none" stroke={KIND_TONE[node.kind]} strokeOpacity={0.35} vectorEffect="non-scaling-stroke" />
      <g transform={`translate(0 ${f(-h * 0.42)})`}>
        <Glyph kind={node.kind} s={cfg.glyph[0]} ground={ground} />
      </g>
      <g opacity={labelO} textAnchor="middle">
        <text y={f(h * 0.2)} fontSize={f(font)} fill="var(--ink)" className="font-display" style={{ fontWeight: 500, letterSpacing: "-0.01em" }}>
          {text}
        </text>
        <text y={f(h * 0.52)} fontSize={f(Math.max(7.5, h * 0.17))} fill="var(--ink-3)" style={{ letterSpacing: "0.12em", fontWeight: 600, textTransform: "uppercase" }}>
          {KIND_LABEL[node.kind].one}
        </text>
      </g>
    </g>
  );
}
