import type { Connection } from "@/data/graph";
import { Glyph, labelStyle } from "./glyph";
import { layoutDots } from "./layout";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const f = (n: number) => Number(n.toFixed(1));

/**
 * The connecting sub-graph for Connect the Dots: same marks and hairlines as
 * the Market Universe, at a smaller scale. Picks sit on the circle; the nodes
 * that join them sit between. Stateless, so it renders on the server too.
 */
export function DotsDiagram({ connection, ground = "var(--paper)", className }: { connection: Connection; ground?: string; className?: string }) {
  const L = layoutDots(connection, 118);
  const chain = new Set(connection.chain.map((h) => `${h.edge.from}|${h.edge.to}`));
  return (
    <svg viewBox="-200 -172 400 344" className={className} aria-hidden focusable="false" style={{ display: "block", width: "100%", height: "auto" }}>
      <circle r={L.radius} fill="none" stroke="var(--viz-faint)" vectorEffect="non-scaling-stroke" />
      <circle r={f(L.radius / 1.618)} fill="none" stroke="var(--viz-faint)" strokeDasharray="1 5" vectorEffect="non-scaling-stroke" />
      <g fill="none">
        {connection.edges.map((e) => {
          const a = L.index.get(e.from);
          const b = L.index.get(e.to);
          if (!a || !b) return null;
          const main = chain.has(`${e.from}|${e.to}`);
          return <line key={`${e.from}|${e.to}`} x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke="var(--ink-3)" strokeOpacity={main ? 1 : 0.55} strokeWidth={main ? 1.1 : 0.75} strokeDasharray={main ? undefined : "3 3"} vectorEffect="non-scaling-stroke" />;
        })}
      </g>
      {L.placed.map((p) => {
        const below = p.y >= -1;
        const s = p.picked ? 6.4 : 4.4;
        return (
          <g key={p.node.id} transform={`translate(${f(p.x)} ${f(p.y)})`}>
            {p.picked && <circle r={s + 6} fill={ground} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />}
            <Glyph kind={p.node.kind} s={s} ground={ground} />
            <text
              y={below ? s + (p.picked ? 21 : 15) : -(s + (p.picked ? 12 : 8))}
              textAnchor="middle"
              fontSize={p.picked ? 12.5 : 11}
              fill={p.picked ? "var(--ink)" : "var(--ink-3)"}
              stroke={ground}
              strokeWidth={3}
              paintOrder="stroke"
              strokeLinejoin="round"
              style={{ ...labelStyle(p.node.kind), ...(p.picked ? { fontWeight: 600 } : {}) }}
            >
              {clip(p.node.short, 20)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
