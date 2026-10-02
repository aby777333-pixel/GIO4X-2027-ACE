"use client";

import { Figure, TAU, clamp, lerp, rgba, type FigureDraw } from "@/components/figures/Figure";

/**
 * What an indicator measures and where it misleads, for the Advanced level of
 * the Academy. Below, an open track: the thing being measured, free to travel
 * as far as it likes. Above, the instrument reading it on a fixed scale. The
 * needle follows the marker faithfully in the middle of the scale and then
 * runs out of scale: the marker keeps going, the needle rests in the end zone.
 *
 * Pointer: it moves the marker along the track, so the needle can be driven
 * into either end zone and watched as it stops telling the two apart.
 */

const SWEEP = 1.13; // radians either side of straight up

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, pal, still } = f;
  // before the first layout the canvas has no size worth drawing in
  if (w < 120 || h < 90) return;
  const cx = w / 2;
  const trackY = h - 24;
  const half = w / 2 - 26;
  const R = Math.min(w * 0.36, (trackY - 44) * 0.92);
  const cy = 22 + R;

  // the measured thing, from -1.5 to 1.5; the scale is only honest between -1 and 1
  const auto = 1.45 * Math.sin((still ? 2.6 : t) * 0.4);
  const x = lerp(auto, clamp(((mx - cx) / half) * 1.5, -1.5, 1.5), hover);
  const reading = Math.tanh(x * 1.5);
  const ang = -Math.PI / 2 + reading * SWEEP;
  const pegged = clamp((Math.abs(x) - 0.8) / 0.3);
  const side = x >= 0 ? 1 : -1;

  ctx.lineCap = "butt";
  ctx.lineJoin = "round";

  // the fixed scale and its two end zones
  const a0 = -Math.PI / 2 - SWEEP;
  const a1 = -Math.PI / 2 + SWEEP;
  const zone = SWEEP * 0.3;
  ctx.strokeStyle = rgba(pal.ink, 0.75);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, a0, a1);
  ctx.stroke();
  for (const s of [-1, 1]) {
    const lit = s === side ? pegged : 0;
    ctx.strokeStyle = rgba(pal.ink, 0.22);
    ctx.lineWidth = 7;
    ctx.beginPath();
    if (s < 0) ctx.arc(cx, cy, R - 7, a0, a0 + zone);
    else ctx.arc(cx, cy, R - 7, a1 - zone, a1);
    ctx.stroke();
    if (lit > 0.01) {
      ctx.strokeStyle = rgba(pal.gold, lit);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = rgba(pal.ink, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const a = lerp(a0, a1, i / 20);
    const long = i % 5 === 0;
    ctx.moveTo(cx + Math.cos(a) * (R + 3), cy + Math.sin(a) * (R + 3));
    ctx.lineTo(cx + Math.cos(a) * (R + (long ? 11 : 7)), cy + Math.sin(a) * (R + (long ? 11 : 7)));
  }
  ctx.stroke();

  // the open track below, with the marks where the scale stops being able to follow
  ctx.strokeStyle = rgba(pal.ink, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - half, trackY);
  ctx.lineTo(cx + half, trackY);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.ink, 0.75);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    const bx = cx + (s * half) / 1.5;
    ctx.moveTo(bx - s * 5, trackY - 7);
    ctx.lineTo(bx, trackY - 7);
    ctx.lineTo(bx, trackY + 7);
    ctx.lineTo(bx - s * 5, trackY + 7);
  }
  ctx.stroke();
  // beyond the marks the track goes on, where the scale cannot
  if (pegged > 0.01) {
    ctx.strokeStyle = rgba(pal.gold, pegged);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + (side * half) / 1.5, trackY);
    ctx.lineTo(cx + side * half, trackY);
    ctx.stroke();
  }

  // the marker, and the thread that ties it to the needle
  const markX = cx + (x / 1.5) * half;
  const tipX = cx + Math.cos(ang) * (R - 16);
  const tipY = cy + Math.sin(ang) * (R - 16);
  ctx.strokeStyle = rgba(pal.accent, 0.55);
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.moveTo(markX, trackY - 9);
  ctx.lineTo(cx, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = rgba(pal.accent, 1);
  ctx.beginPath();
  ctx.moveTo(markX, trackY - 2);
  ctx.lineTo(markX - 6, trackY - 12);
  ctx.lineTo(markX + 6, trackY - 12);
  ctx.closePath();
  ctx.fill();

  // the needle
  ctx.lineCap = "round";
  ctx.strokeStyle = rgba(pal.ink, 0.9);
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(ang) * 10, cy - Math.sin(ang) * 10);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 5.5, 0, TAU);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.9);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, TAU);
  ctx.fillStyle = rgba(pal.gold, 1);
  ctx.fill();
};

export function BoundedScale() {
  return <Figure draw={draw} />;
}
