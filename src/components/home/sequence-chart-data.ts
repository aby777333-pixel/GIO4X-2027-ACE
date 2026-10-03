/**
 * The chart the home sequence resolves into: its geometry and its candles.
 *
 * Every number here is INVENTED. The candles come from a fixed seed, so the
 * picture is identical on every visit; they are not prices of any instrument
 * and are never presented as such. Both the particle sequence (which draws
 * the chart's outline) and the chart itself read this one file, so the
 * outline and the finished chart always agree.
 */

/** the box everything is laid out in; the same proportions as before (φ) */
export const VB = { w: 610, h: 377 } as const;
/** the price pane and, beneath it, the activity strip */
export const PLOT = { x0: 22, x1: 546, y0: 46, y1: 262 } as const;
export const STRIP = { y0: 288, y1: 346 } as const;
export const HEAD_Y = 27.5;

export type Candle = { o: number; h: number; l: number; c: number; v: number };

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const COUNT = 44;

/** An invented series: a rise, a pullback, a pause and a second rise. */
export const CANDLES: Candle[] = (() => {
  const r = seeded(7772027);
  const out: Candle[] = [];
  let p = 1.0;
  for (let i = 0; i < COUNT; i++) {
    const drift = i < 14 ? 0.0011 : i < 21 ? -0.0013 : i < 28 ? 0.0001 : 0.0012;
    const o = p;
    const c = o + drift + (r() - 0.5) * 0.0034;
    const h = Math.max(o, c) + r() * 0.0016;
    const l = Math.min(o, c) - r() * 0.0016;
    const v = 0.25 + r() * 0.5 + Math.min(0.25, Math.abs(c - o) * 90);
    out.push({ o, h, l, c, v });
    p = c;
  }
  return out;
})();

const LOW = Math.min(...CANDLES.map((k) => k.l));
const HIGH = Math.max(...CANDLES.map((k) => k.h));
const PAD = (HIGH - LOW) * 0.08;
export const RANGE = { lo: LOW - PAD, hi: HIGH + PAD } as const;

export const STEP = (PLOT.x1 - PLOT.x0) / COUNT;
/** centre of candle i, and the height of a price, in the 610 × 377 box */
export const xOf = (i: number) => PLOT.x0 + (i + 0.5) * STEP;
export const yOf = (price: number) => PLOT.y1 - ((price - RANGE.lo) / (RANGE.hi - RANGE.lo)) * (PLOT.y1 - PLOT.y0);

/** the average of the last `n` closes at each candle (shorter at the start) */
export const AVERAGE: number[] = CANDLES.map((_, i) => {
  const from = Math.max(0, i - 7);
  let s = 0;
  for (let j = from; j <= i; j++) s += CANDLES[j].c;
  return s / (i - from + 1);
});

/** the four parts of the invented series, named as the chart names them */
export const PHASES = [
  { from: 0, to: 13, name: "Rise", note: "Each low sits above the one before it." },
  { from: 14, to: 20, name: "Pullback", note: "Part of the rise is given back." },
  { from: 21, to: 27, name: "Pause", note: "Small candles: neither side moves it far." },
  { from: 28, to: COUNT - 1, name: "Second rise", note: "The move resumes past the earlier high." },
] as const;

/** One plain sentence about a candle's shape. General reading, not a signal. */
export function readCandle(k: Candle): string {
  const body = Math.abs(k.c - k.o);
  const range = k.h - k.l || 1e-9;
  const upper = k.h - Math.max(k.o, k.c);
  const lower = Math.min(k.o, k.c) - k.l;
  if (body / range < 0.18) return "Open and close nearly equal: the period ended where it began.";
  if (lower / range > 0.45) return "A long lower wick: it traded lower, then closed back up.";
  if (upper / range > 0.45) return "A long upper wick: it traded higher, then closed back down.";
  if (body / range > 0.7) return k.c > k.o ? "A full body up: it closed near its high." : "A full body down: it closed near its low.";
  return k.c > k.o ? "Closed above its open." : "Closed below its open.";
}
