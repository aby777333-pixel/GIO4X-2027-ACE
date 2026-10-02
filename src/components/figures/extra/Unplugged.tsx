"use client";

import { Figure, TAU, clamp, rgba, smooth, type FigureDraw } from "../Figure";
import { corners } from "../markets/kit";

/**
 * System status, beside "Monitoring not connected": exactly that. A probe's
 * plug lies a little way from the socket it would go into, its lead slack
 * behind it, and a dimension line marks the gap between the two. Nothing in
 * it reports anything: there is no lamp, no pulse and no reading, because no
 * check is connected. The lead breathes a little and that is all.
 *
 * Pointer: the gap's dimension line firms up in champagne and the plug leans
 * toward the pointer. It does not reach the socket.
 */

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  if (w < 110 || h < 60) return;
  const on = smooth(hover);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  const cy = h * 0.46;
  const lean = on * clamp((mx / w - 0.5) * 2, -1, 1) * w * 0.012;
  const tilt = Math.sin(t * 0.5) * 0.012 + on * clamp((my / h - 0.5) * 0.12, -0.06, 0.06);

  // the socket: a plate with two openings, and nothing in them
  const sx = w * 0.72;
  const sw = w * 0.15;
  const sh = h * 0.5;
  ctx.fillStyle = rgba(pal.surface, 0.55);
  ctx.fillRect(sx, cy - sh / 2, sw, sh);
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(pal.ink2, 0.9);
  ctx.strokeRect(Math.round(sx) + 0.5, Math.round(cy - sh / 2) + 0.5, sw, sh);
  const pin = h * 0.1;
  const hole = Math.max(2.5, h * 0.028);
  ctx.strokeStyle = rgba(pal.ink, 0.85);
  for (const dy of [-pin, pin]) {
    ctx.beginPath();
    ctx.arc(sx + sw * 0.42, cy + dy, hole, 0, TAU);
    ctx.stroke();
  }

  // the lead, slack, with its loose end coiled on the left
  const bw = w * 0.17;
  const bh = h * 0.27;
  const px = w * 0.27 + lean;
  const sag = h * (0.86 + Math.sin(t * 0.7) * 0.015);
  ctx.strokeStyle = rgba(pal.ink3, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, cy);
  ctx.bezierCurveTo(px - w * 0.12, cy, w * 0.2, sag, w * 0.105, h * 0.76);
  ctx.stroke();
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(w * 0.105, h * 0.76 - h * 0.05, h * 0.05, TAU * 0.25, TAU * 1.1);
  ctx.stroke();

  // the plug
  ctx.save();
  ctx.translate(px + bw / 2, cy);
  ctx.rotate(tilt);
  ctx.fillStyle = rgba(pal.surface, 0.92);
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = rgba(pal.gold, 0.12);
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.strokeStyle = rgba(pal.ink, 0.9);
  ctx.lineWidth = 1.25;
  ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
  ctx.strokeStyle = rgba(pal.ink3, 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i <= 3; i++) {
    const x = -bw / 2 + (bw * i) / 6;
    ctx.moveTo(x, -bh * 0.3);
    ctx.lineTo(x, bh * 0.3);
  }
  ctx.stroke();
  const prong = w * 0.06;
  ctx.strokeStyle = rgba(pal.gold, 0.95);
  ctx.lineWidth = 2.25;
  ctx.beginPath();
  ctx.moveTo(bw / 2, -pin);
  ctx.lineTo(bw / 2 + prong, -pin);
  ctx.moveTo(bw / 2, pin);
  ctx.lineTo(bw / 2 + prong, pin);
  ctx.stroke();
  ctx.restore();

  // the gap, dimensioned: the one thing the figure states
  const g0 = px + bw + prong + 4;
  const g1 = sx - 4;
  const gy = cy + sh / 2 + h * 0.1;
  ctx.setLineDash([1, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.6 + on * 0.3);
  ctx.beginPath();
  ctx.moveTo(g0, cy - pin);
  ctx.lineTo(g1, cy - pin);
  ctx.moveTo(g0, cy + pin);
  ctx.lineTo(g1, cy + pin);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(pal.gold, 0.55 + on * 0.45);
  ctx.lineWidth = 1 + on * 0.5;
  ctx.beginPath();
  ctx.moveTo(g0, gy);
  ctx.lineTo(g1, gy);
  ctx.moveTo(g0, gy - 5);
  ctx.lineTo(g0, gy + 5);
  ctx.moveTo(g1, gy - 5);
  ctx.lineTo(g1, gy + 5);
  ctx.stroke();
};

export function Unplugged({ ratio = 1.75 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
