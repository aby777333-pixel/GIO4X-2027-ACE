"use client";

import { Figure, TAU, clamp, lerp, rgba, type FigureDraw } from "@/components/figures/Figure";

/**
 * How a moving average is made, for the Intermediate level of the Academy. A
 * row of abstract samples (no scale, no market) with a bracket that slides
 * along them. The level line inside the bracket is the mean of the samples it
 * holds; the trail it leaves behind is the moving average, smoother than the
 * samples and slower to turn.
 *
 * Pointer: the bracket follows it along the row, and moving up or down makes
 * the bracket narrower or wider, so the trail can be seen to roughen or calm.
 */

const N = 40;

/** a fixed, wandering series between about -1 and 1 */
const sample = (i: number) => 0.52 * Math.sin(i * 0.27 + 0.6) + 0.3 * Math.sin(i * 0.83 + 2.1) + 0.2 * Math.sin(i * 2.3 + 0.4);

/** mean of the `n` samples ending at i (n may be fractional: the oldest sample is weighted) */
const mean = (i: number, n: number) => {
  const whole = Math.floor(n);
  const part = n - whole;
  let sum = 0;
  for (let k = 0; k < whole; k++) sum += sample(i - k);
  sum += part * sample(i - whole);
  return sum / n;
};

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, my, pal, still } = f;
  const padX = 18;
  const mid = h * 0.5;
  const amp = h * 0.3;
  const step = (w - padX * 2) / (N - 1);
  const X = (i: number) => padX + i * step;
  const Y = (v: number) => mid - v * amp;

  // the bracket: how many samples it holds, and where its leading edge is
  const autoN = still ? 7 : 7 + 2.5 * Math.sin(t * 0.3);
  const n = lerp(autoN, lerp(3, 14, clamp(my / h)), hover);
  const sweep = still ? 0.62 : 0.5 - 0.5 * Math.cos(t * 0.22 + 1.5);
  const first = Math.ceil(n);
  const autoHead = lerp(first, N - 1, sweep);
  const head = clamp(lerp(autoHead, (mx - padX) / step, hover), first, N - 1);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the middle of the field
  ctx.strokeStyle = rgba(pal.ink, 0.12);
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 6]);
  ctx.beginPath();
  ctx.moveTo(padX, mid);
  ctx.lineTo(w - padX, mid);
  ctx.stroke();
  ctx.setLineDash([]);

  // the samples: joined faintly, each one a small ring
  ctx.strokeStyle = rgba(pal.ink, 0.28);
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    if (i) ctx.lineTo(X(i), Y(sample(i)));
    else ctx.moveTo(X(i), Y(sample(i)));
  }
  ctx.stroke();

  // the bracket
  const x1 = X(head) + step * 0.5;
  const x0 = x1 - n * step;
  const top = 14;
  const bottom = h - 14;
  ctx.fillStyle = rgba(pal.accent, 0.07);
  ctx.fillRect(x0, top, x1 - x0, bottom - top);
  ctx.strokeStyle = rgba(pal.accent, 0.9);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0 + 7, top);
  ctx.lineTo(x0, top);
  ctx.lineTo(x0, bottom);
  ctx.lineTo(x0 + 7, bottom);
  ctx.moveTo(x1 - 7, top);
  ctx.lineTo(x1, top);
  ctx.lineTo(x1, bottom);
  ctx.lineTo(x1 - 7, bottom);
  ctx.stroke();

  for (let i = 0; i < N; i++) {
    const inside = X(i) > x0 && X(i) < x1;
    ctx.beginPath();
    ctx.arc(X(i), Y(sample(i)), inside ? 2.6 : 2, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink, inside ? 0.95 : 0.55);
    ctx.lineWidth = inside ? 1.4 : 1;
    ctx.stroke();
  }

  // the trail: the mean at every place the bracket has been
  const whole = Math.floor(head);
  const frac = head - whole;
  const now = lerp(mean(whole, n), mean(Math.min(whole + 1, N - 1), n), frac);
  ctx.strokeStyle = rgba(pal.ink, 0.92);
  ctx.lineWidth = 2.25;
  ctx.beginPath();
  for (let i = first; i <= whole; i++) {
    if (i === first) ctx.moveTo(X(i), Y(mean(i, n)));
    else ctx.lineTo(X(i), Y(mean(i, n)));
  }
  ctx.lineTo(X(head), Y(now));
  ctx.stroke();
  // where the trail would go on, faintly
  ctx.strokeStyle = rgba(pal.ink, 0.22);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(X(head), Y(now));
  for (let i = whole + 1; i < N; i++) ctx.lineTo(X(i), Y(mean(i, n)));
  ctx.stroke();

  // the level inside the bracket, and the point it writes
  ctx.strokeStyle = rgba(pal.accent, 0.85);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, Y(now));
  ctx.lineTo(x1, Y(now));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(X(head), Y(now), 4.6, 0, TAU);
  ctx.fillStyle = rgba(pal.gold, 1);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.92);
  ctx.lineWidth = 1.5;
  ctx.stroke();
};

export function RollingMean() {
  return <Figure draw={draw} />;
}
