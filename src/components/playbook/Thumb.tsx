import type { Play } from "@/data/playbook";

/** A small still picture of an entry's candles, for the index. Drawn on the server, as SVG. */
export function PlayThumb({ play }: { play: Pick<Play, "candles" | "mark"> }) {
  const { candles, mark } = play;
  const lo = Math.min(...candles.map((c) => c[2])) - 4;
  const hi = Math.max(...candles.map((c) => c[1])) + 4;
  const W = 120;
  const H = 64;
  const slot = W / candles.length;
  const bw = Math.min(slot * 0.56, 12);
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="gx-thumb" aria-hidden>
      {candles.map(([o, h, l, c], i) => {
        const x = slot * (i + 0.5);
        const cls = `${c >= o ? "gx-thumb-up" : "gx-thumb-down"} ${mark.includes(i) ? "" : "gx-thumb-dim"}`;
        return (
          <g key={i} className={cls}>
            <line x1={x} x2={x} y1={y(h)} y2={y(l)} />
            <rect x={x - bw / 2} y={Math.min(y(o), y(c))} width={bw} height={Math.max(1.5, Math.abs(y(o) - y(c)))} />
          </g>
        );
      })}
    </svg>
  );
}
