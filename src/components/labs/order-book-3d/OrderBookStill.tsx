import { BOOK, LEVELS } from "@/components/labs/order-book-3d/book";

/**
 * The still that stands where the 3D model would be: before it has loaded,
 * without JavaScript, and where WebGL is not available. The same seeded
 * heights as the model, drawn flat on the server: bars for what is waiting at
 * each level, a stepped outline behind them for the running total. No values.
 */

const W = 720;
const H = 400;
const BASE = 330;
const MID = W / 2;
const GAP = 46;
const STEP = (W / 2 - GAP / 2 - 34) / LEVELS;
const BAR = 150;
const DEPTH = 250;
const n1 = (v: number) => Math.round(v * 10) / 10;

function steps(depth: number[], dir: 1 | -1): string {
  let x = MID + (dir * GAP) / 2;
  let d = `M${n1(x)} ${BASE}`;
  for (let i = 0; i < LEVELS; i++) {
    const y = n1(BASE - depth[i] * DEPTH);
    d += `V${y}H${n1((x += dir * STEP))}`;
  }
  return `${d}V${BASE}Z`;
}

export function OrderBookStill() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Illustration of an order book: bids as bars on the left, asks as bars on the right, an empty gap between them for the spread, and a stepped outline behind each side for depth. Not market data." preserveAspectRatio="xMidYMid meet">
      <path d={steps(BOOK.bids.depth, -1)} fill="var(--pos)" opacity="0.14" />
      <path d={steps(BOOK.asks.depth, 1)} fill="var(--neg)" opacity="0.14" />
      <path d={steps(BOOK.bids.depth, -1)} fill="none" stroke="var(--pos)" opacity="0.6" />
      <path d={steps(BOOK.asks.depth, 1)} fill="none" stroke="var(--neg)" opacity="0.6" />
      {BOOK.bids.size.map((s, i) => (
        <rect key={`b${i}`} x={n1(MID - GAP / 2 - (i + 1) * STEP + 3)} y={n1(BASE - s * BAR)} width={n1(STEP - 6)} height={n1(s * BAR)} fill="var(--pos)" />
      ))}
      {BOOK.asks.size.map((s, i) => (
        <rect key={`a${i}`} x={n1(MID + GAP / 2 + i * STEP + 3)} y={n1(BASE - s * BAR)} width={n1(STEP - 6)} height={n1(s * BAR)} fill="var(--neg)" />
      ))}
      <path d={`M24 ${BASE}H${W - 24}`} stroke="var(--line-strong)" />
      {/* the spread */}
      <rect x={MID - GAP / 2} y={BASE - DEPTH} width={GAP} height={DEPTH} fill="var(--prestige)" opacity="0.16" />
      <path d={`M${MID - GAP / 2} ${BASE + 16}H${MID + GAP / 2}M${MID - GAP / 2} ${BASE + 10}v12M${MID + GAP / 2} ${BASE + 10}v12`} stroke="var(--prestige)" strokeWidth="1.5" fill="none" />
      <g fontSize="13" fontWeight="600" fill="var(--ink)">
        <text x={MID} y={BASE + 40} textAnchor="middle">
          Spread
        </text>
        <text x={MID - GAP / 2 - STEP * 5} y={BASE + 40} textAnchor="middle">
          Bids · buyers
        </text>
        <text x={MID + GAP / 2 + STEP * 5} y={BASE + 40} textAnchor="middle">
          Asks · sellers
        </text>
        <text x="34" y={BASE - DEPTH - 12}>
          Depth · running total
        </text>
      </g>
      <text x={W - 24} y={BASE + 58} textAnchor="end" fontSize="12" fill="var(--ink-3)">
        Price, lower to higher →
      </text>
    </svg>
  );
}
