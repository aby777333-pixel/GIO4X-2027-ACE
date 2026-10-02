"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { line } from "./kit";

/**
 * "How it works, mechanically" (PAMM): communicating vessels. Four vessels of
 * different widths stand on one channel, so they share one level. When the
 * level moves, up or down, it moves by the same amount in every vessel, and
 * each vessel's part of the change is in proportion to its width: one pool,
 * divided by share. The dashed line is only a datum to read the change against.
 *
 * The widths are arbitrary and the level simply breathes about the datum: it
 * shows no result.
 *
 * Pointer: the level follows the pointer's height in all four vessels at
 * once, and the vessel under the pointer is picked out with its share of the
 * change.
 */

/** arbitrary shares of the pool */
const SHARES = [0.36, 0.26, 0.22, 0.16];
const GAP = 14;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const left = w * 0.07;
  const right = w * 0.93;
  const top = h * 0.12;
  const floor = h * 0.72;
  const channel = floor + 9;
  const inner = right - left - GAP * (SHARES.length - 1);
  const datum = lerp(top, floor, 0.5);
  const swing = (floor - top) * 0.24;
  const auto = datum - swing * Math.sin(f.t * 0.5);
  const level = lerp(auto, clamp(f.my, top + 10, floor - 8), f.hover);

  // the liquid: the channel, then each vessel up to the common level
  ctx.fillStyle = rgba(pal.accent, 0.14);
  ctx.fillRect(left, floor, right - left, channel - floor);
  let x = left;
  for (let i = 0; i < SHARES.length; i++) {
    const vw = inner * SHARES[i];
    const picked = f.hover * smooth(3 * (1 - Math.abs(f.mx - (x + vw / 2)) / (vw / 2 + GAP / 2)));
    ctx.fillStyle = rgba(pal.accent, 0.14);
    ctx.fillRect(x, level, vw, floor - level);
    // the change against the datum: the same height in each, so in proportion to width
    const y0 = Math.min(level, datum);
    const y1 = Math.max(level, datum);
    ctx.fillStyle = rgba(pal.accent, 0.22);
    ctx.fillRect(x, y0, vw, y1 - y0);
    if (picked > 0.004) {
      ctx.fillStyle = rgba(pal.gold, 0.45 * picked);
      ctx.fillRect(x, y0, vw, y1 - y0);
    }
    // the surface, with a slight swell
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) {
      const sx = x + (vw * k) / 8;
      const sy = level + (f.still ? 0 : Math.sin(f.t * 1.7 + sx * 0.05) * 0.9);
      if (k) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
    }
    ctx.strokeStyle = rgba(pal.accent, 0.95);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // the vessel's share, as a bracket beneath it
    const by = channel + 13;
    ctx.beginPath();
    ctx.moveTo(x, by - 4);
    ctx.lineTo(x, by);
    ctx.lineTo(x + vw, by);
    ctx.lineTo(x + vw, by - 4);
    ctx.strokeStyle = rgba(pal.ink, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
    if (picked > 0.004) {
      ctx.strokeStyle = rgba(pal.gold, picked);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    x += vw + GAP;
  }

  // the glass: one outline, walls joined by the channel beneath
  ctx.beginPath();
  x = left;
  ctx.moveTo(left, top);
  ctx.lineTo(left, channel);
  ctx.lineTo(right, channel);
  ctx.lineTo(right, top);
  for (let i = 0; i < SHARES.length - 1; i++) {
    x += inner * SHARES[i];
    ctx.moveTo(x, top);
    ctx.lineTo(x, floor);
    ctx.lineTo(x + GAP, floor);
    ctx.lineTo(x + GAP, top);
    x += GAP;
  }
  ctx.strokeStyle = rgba(pal.ink, 0.6);
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // the datum the change is read against
  ctx.setLineDash([3, 4]);
  line(ctx, left - 8, datum, right + 8, datum, rgba(pal.gold, 0.95), 1);
  ctx.setLineDash([]);
};

export function Vessels({ ratio = 2.3, className }: { ratio?: number; className?: string }) {
  return <Figure draw={draw} ratio={ratio} className={className} />;
}
