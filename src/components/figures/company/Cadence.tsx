"use client";

import { Figure, TAU, clamp, rgba, type FigureDraw } from "@/components/figures/Figure";

/**
 * Cadence, for the "Scheduled events" module of the Morning Room: four rails,
 * each carrying evenly spaced marks at its own pitch, the way one release
 * appears every month and another every quarter. There are no dates, no names
 * and no "now": it is rhythm only. A slow sheen passes along each rail.
 *
 * Pointer: a reading line stands where the pointer is, and on every rail the
 * next mark after it lights, joined back to the line: wherever you stand in a
 * calendar, each release has its own distance to its next appearance.
 */

/** marks per rail, and where the first one sits within its own interval */
const RAILS = [
  { n: 12, off: 0.5 },
  { n: 12, off: 0.15 },
  { n: 8, off: 0.6 },
  { n: 4, off: 0.8 },
] as const;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, my, pal, still } = f;
  const padX = 16;
  const top = 26;
  const bottom = h - 26;
  const span = w - padX * 2;
  const gap = (bottom - top) / (RAILS.length - 1);
  const lineX = clamp(mx, padX, w - padX);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the reading line
  if (hover > 0.01) {
    ctx.strokeStyle = rgba(pal.accent, 0.8 * hover);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lineX, top - 14);
    ctx.lineTo(lineX, bottom + 14);
    ctx.stroke();
  }

  for (let r = 0; r < RAILS.length; r++) {
    const rail = RAILS[r];
    const y = top + r * gap;
    const pitch = span / rail.n;
    const near = hover * (1 - clamp(Math.abs(my - y) / (gap * 0.7)));

    ctx.strokeStyle = rgba(pal.ink, 0.32 + 0.3 * near);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(w - padX, y);
    ctx.stroke();

    // the sheen: a soft light travelling along the rail, each rail in its own time
    const sheen = still ? 0.3 + r * 0.17 : (t * 0.05 + r * 0.23) % 1.3;
    // the next mark after the reading line
    let next = -1;
    for (let i = 0; i < rail.n; i++) {
      if (padX + (i + rail.off) * pitch >= lineX) {
        next = i;
        break;
      }
    }

    for (let i = 0; i < rail.n; i++) {
      const x = padX + (i + rail.off) * pitch;
      const glow = (1 - hover) * (1 - clamp(Math.abs(x - padX - sheen * span) / (span * 0.16)));
      const picked = i === next ? hover : 0;
      const lift = 6 + 4 * glow + 4 * picked;
      ctx.strokeStyle = rgba(pal.ink, 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - lift);
      ctx.lineTo(x, y + lift);
      ctx.stroke();
      const light = Math.max(glow, picked);
      if (light > 0.01) {
        ctx.strokeStyle = rgba(picked > 0.01 ? pal.gold : pal.accent, light);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      if (picked > 0.01) {
        // the wait from the reading line to this rail's next mark
        ctx.strokeStyle = rgba(pal.accent, 0.9 * picked);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lineX, y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = rgba(pal.gold, picked);
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, TAU);
        ctx.fill();
      }
    }
  }
};

export function Cadence() {
  return <Figure draw={draw} ratio={1.5} />;
}
