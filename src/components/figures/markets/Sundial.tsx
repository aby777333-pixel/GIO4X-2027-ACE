"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { P, camera, corners, discPath, lamp, pr, ring, seg } from "./kit";

/**
 * World Market Clock, beside "Read this first": the oldest timetable there
 * is. A dial plate lies on the deck with its hour lines engraved (no numerals:
 * it tells no particular time), a gnomon stands at its centre, and a lamp
 * crosses slowly overhead, so the shadow travels round the plate. The page
 * computes a schedule from the visitor's clock rather than reading a feed;
 * this is the same idea in brass: the time comes from where the light is.
 *
 * Pointer: the lamp follows the pointer, and the shadow swings to the far
 * side of the gnomon from it.
 */

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  if (w < 110 || h < 70) return;
  const on = smooth(hover);
  const s = Math.min(w * 0.33, h * 0.52);
  const c = camera(w * 0.5, h * 0.66, s, 0, 0.62, 8);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  // the lamp: across and back on its own, or where the pointer is
  const lx = lerp(Math.sin(t * 0.24) * 0.85, clamp((mx / w - 0.5) * 2.6, -0.95, 0.95), on);
  const ly = lerp(0.86, clamp(1.0 - (my / h) * 0.3, 0.74, 0.92), on);
  const lz = 0.45;
  // the gnomon: a fin with two feet on the plate, facing the viewer, and its tip above the centre
  const tipY = 0.4;
  const foot = 0.24;
  // where the tip's shadow falls on the plate: on the side away from the lamp, toward the viewer
  const k = ly / (ly - tipY);
  const sx = lx + (0 - lx) * k;
  const sz = lz + (0 - lz) * k;

  // the plate, lit everywhere but in the shadow
  discPath(ctx, c, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 56);
  ctx.fillStyle = rgba(pal.surface, 0.92);
  ctx.fill();
  ctx.save();
  ctx.clip();
  pr(c, lx * 0.6, 0, 0.25);
  const g = ctx.createRadialGradient(P.x, P.y, 2, P.x, P.y, s * 1.5);
  g.addColorStop(0, rgba(pal.accent, 0.34));
  g.addColorStop(1, rgba(pal.accent, 0.08));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  pr(c, -foot, 0, 0);
  ctx.moveTo(P.x, P.y);
  pr(c, foot, 0, 0);
  ctx.lineTo(P.x, P.y);
  pr(c, sx, 0, sz);
  ctx.lineTo(P.x, P.y);
  ctx.closePath();
  ctx.fill("evenodd");
  // the edges of the shadow
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink, 0.5);
  seg(ctx, c, -foot, 0, 0, sx, 0, sz);
  seg(ctx, c, foot, 0, 0, sx, 0, sz);
  ctx.restore();

  // the hour lines: twenty-four, every third one longer
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const long = i % 3 === 0;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    ctx.strokeStyle = rgba(long ? pal.ink2 : pal.ink3, long ? 0.8 : 0.55);
    seg(ctx, c, ca * (long ? 0.76 : 0.85), 0, sa * (long ? 0.76 : 0.85), ca * 0.94, 0, sa * 0.94);
  }
  ring(ctx, c, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, pal.ink, 0.85, 0.45, 1.25, 64);
  ring(ctx, c, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0.68, pal.ink3, 0.4, 0.22, 1, 48);

  // where the shadow's tip reads on the plate
  if (Math.hypot(sx, sz) < 0.98) {
    pr(c, sx, 0, sz);
    lamp(ctx, P.x, P.y, 1.6, pal.gold, 0.9);
  }

  // the ray, the gnomon, the lamp
  ctx.setLineDash([1, 4]);
  ctx.strokeStyle = rgba(pal.gold, 0.45 + on * 0.3);
  seg(ctx, c, lx, ly, lz, 0, tipY, 0);
  seg(ctx, c, 0, tipY, 0, sx, 0, sz);
  ctx.setLineDash([]);
  ctx.beginPath();
  pr(c, -foot, 0, 0);
  ctx.moveTo(P.x, P.y);
  pr(c, foot, 0, 0);
  ctx.lineTo(P.x, P.y);
  pr(c, 0, tipY, 0);
  ctx.lineTo(P.x, P.y);
  ctx.closePath();
  ctx.fillStyle = rgba(pal.surface, 0.96);
  ctx.fill();
  ctx.fillStyle = rgba(pal.gold, 0.3);
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(pal.gold, 0.95);
  ctx.stroke();
  pr(c, lx, ly, lz);
  lamp(ctx, P.x, P.y, 2.6 + on * 0.6, pal.gold, 1);
};

export function Sundial({ ratio = 1.75 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
