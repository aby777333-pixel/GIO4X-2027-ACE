import { createState, SIM } from "./engine";

/**
 * A still of the practice desk for the Labs index: the first hour of the
 * default invented market, drawn on the server from the same engine that runs
 * the page. It is a picture of invented prices and says so inside the drawing.
 */
const W = 480;
const H = 297;
const PAD = 21;
const candles = createState(SIM.defaultSeed, SIM.defaultBalance, SIM.defaultLeverage).candles;
const lo = Math.min(...candles.map((c) => c.l));
const hi = Math.max(...candles.map((c) => c.h));
const slot = (W - PAD * 2) / candles.length;
const y = (p: number) => PAD + 34 + ((hi - p) / (hi - lo || 1)) * (H - PAD * 2 - 34);

export function SimulatorStill() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A still of the practice desk: candles of an invented price, marked as a simulation." className="block h-auto w-full">
      <text x={PAD} y={PAD + 8} className="fill-ink-3" fontSize="11" fontWeight="600" letterSpacing="1.6">
        SIMULATION · INVENTED PRICES
      </text>
      <line x1={PAD} x2={W - PAD} y1={PAD + 18} y2={PAD + 18} className="stroke-line-strong" strokeWidth="1" />
      {candles.map((c, i) => {
        const x = PAD + i * slot + slot / 2;
        const top = Math.min(y(c.o), y(c.c));
        const h = Math.max(1, Math.abs(y(c.c) - y(c.o)));
        // hollow closed higher, filled closed lower: the same reading as the live chart
        return (
          <g key={c.m} className="stroke-ink-2" strokeWidth="1">
            <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} />
            <rect x={x - slot * 0.32} y={top} width={slot * 0.64} height={h} className={c.c >= c.o ? "fill-paper" : "fill-ink-2"} />
          </g>
        );
      })}
    </svg>
  );
}
