"use client";

import { Figure, TAU, clamp, rgba, smooth, type FigureDraw } from "../Figure";
import { P, camera, corners, hash, pr, ring, seg } from "./kit";

/**
 * The Morning Room, beside "Today": a desk wheel of leaves on a spindle, the
 * kind that is turned by one leaf each day. The leaves carry ruled strokes,
 * never a date or a word; the one standing upright is today's and takes the
 * champagne light, and at an even interval the wheel moves on by one leaf.
 * The page chooses its lesson and its term the same way: by the calendar
 * date, in rotation.
 *
 * Pointer: moving up and down over the wheel turns it by hand, leaf after
 * leaf; it goes back to its own pace when the pointer leaves.
 */

const N = 16;
const STEP = TAU / N;
const ORDER = new Int8Array(N);
const DEPTH = new Float32Array(N);

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal, still }) => {
  if (w < 110 || h < 80) return;
  const on = smooth(hover);
  const s = Math.min(w * 0.29, h * 0.36);
  const c = camera(w * 0.5, h * 0.48, s, 0.55 + (mx / w - 0.5) * 0.3 * on, 0.2, 8);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  // one leaf on at an even interval; by hand under the pointer
  const period = 2.8;
  // (the still frame shows the wheel at rest, not half-way through a turn)
  const p = still ? 0 : clamp(((t % period) - (period - 0.9)) / 0.9);
  const base = (Math.floor(t / period) + p * p * (3 - 2 * p)) * STEP + (my / h - 0.5) * 3.2 * on;
  const a = 0.72;
  const r0 = 0.17;
  const r1 = 1;

  // the stand: a foot on each side and the spindle between them
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    const x = side * 0.96;
    ctx.strokeStyle = rgba(pal.ink3, side === 1 ? 0.45 : 0.75);
    seg(ctx, c, x, 0, 0, x, -1.1, 0.46);
    seg(ctx, c, x, 0, 0, x, -1.1, -0.46);
    seg(ctx, c, x, -1.1, 0.46, x, -1.1, -0.46);
  }

  // leaves from the farthest to the nearest
  let today = 0;
  let upright = -2;
  for (let k = 0; k < N; k++) {
    const al = base + k * STEP;
    DEPTH[k] = pr(c, 0, Math.cos(al) * 0.6, -Math.sin(al) * 0.6).z;
    ORDER[k] = k;
    if (Math.cos(al) > upright) {
      upright = Math.cos(al);
      today = k;
    }
  }
  for (let i = 1; i < N; i++) {
    const v = ORDER[i];
    let j = i - 1;
    while (j >= 0 && DEPTH[ORDER[j]] < DEPTH[v]) {
      ORDER[j + 1] = ORDER[j];
      j--;
    }
    ORDER[j + 1] = v;
  }

  let spindle = false;
  const drawSpindle = () => {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(pal.gold, 0.9);
    seg(ctx, c, -0.96, 0, 0, 0.96, 0, 0);
    spindle = true;
  };

  for (let i = 0; i < N; i++) {
    const k = ORDER[i];
    if (!spindle && DEPTH[k] < 0) drawSpindle();
    const al = base + k * STEP;
    const uy = Math.cos(al);
    const uz = -Math.sin(al);
    const facing = Math.abs(uy);
    const isToday = k === today;
    ctx.beginPath();
    pr(c, -a, uy * r0, uz * r0);
    ctx.moveTo(P.x, P.y);
    pr(c, a, uy * r0, uz * r0);
    ctx.lineTo(P.x, P.y);
    pr(c, a, uy * r1, uz * r1);
    ctx.lineTo(P.x, P.y);
    pr(c, -a, uy * r1, uz * r1);
    ctx.lineTo(P.x, P.y);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.surface, 0.94);
    ctx.fill();
    ctx.fillStyle = isToday ? rgba(pal.gold, 0.2) : rgba(pal.accent, 0.05 + facing * 0.11);
    ctx.fill();
    ctx.lineWidth = isToday ? 1.25 : 1;
    ctx.strokeStyle = isToday ? rgba(pal.gold, 0.95) : rgba(pal.ink3, 0.4 + facing * 0.35);
    ctx.stroke();
    // what a leaf carries: a few ruled strokes, no date and no word
    if (facing > 0.35) {
      ctx.lineWidth = 1;
      for (let m = 0; m < 3; m++) {
        const rr = 0.46 + m * 0.17;
        const end = -a * 0.72 + a * 1.44 * (0.55 + hash(k * 5 + m) * 0.45);
        ctx.strokeStyle = isToday ? rgba(pal.gold, 0.75) : rgba(pal.ink2, (facing - 0.35) * 0.75);
        seg(ctx, c, -a * 0.72, uy * rr, uz * rr, end, uy * rr, uz * rr);
      }
    }
  }
  if (!spindle) drawSpindle();
  for (const side of [-1, 1]) ring(ctx, c, side * 0.96, 0, 0, 0, 1, 0, 0, 0, 1, 0.1, pal.gold, 0.95, 0.95, 1.25, 16);
};

export function DayWheel({ ratio = 1.4 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
