"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { corners, glow } from "../markets/kit";

/**
 * Contact, beside "Or by email": the pane's one warning, drawn. A message
 * leaves along its route to the letter slot on the right, one after another.
 * The key hangs on its hook on the left and never goes with it: a password or
 * a one-time code is not something a message carries.
 *
 * Pointer: the message is carried along the route by hand. The key swings
 * when the pointer comes near and stays on its hook.
 */

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  if (w < 110 || h < 60) return;
  const on = smooth(hover);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  // the route and the slot it ends in
  const rx0 = w * 0.4;
  const rx1 = w * 0.84;
  const ry = h * 0.6;
  const lift = h * 0.1;
  const routeY = (u: number) => ry - Math.sin(u * Math.PI) * lift;
  ctx.setLineDash([2, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.7);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const x = lerp(rx0, rx1, u);
    if (i === 0) ctx.moveTo(x, routeY(u));
    else ctx.lineTo(x, routeY(u));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  const slotX = w * 0.88;
  ctx.strokeStyle = rgba(pal.ink2, 0.85);
  ctx.lineWidth = 1.25;
  ctx.strokeRect(Math.round(slotX) + 0.5, Math.round(ry - h * 0.17) + 0.5, Math.max(5, w * 0.03), h * 0.34);

  // the message: carried by the pointer, or travelling by itself
  const auto = smooth(((t * 0.17) % 1) / 0.86);
  const u = lerp(auto, clamp((mx - rx0) / (rx1 - rx0)), on);
  const ex = lerp(rx0, rx1, u);
  const ey = routeY(u);
  const fade = lerp(clamp(u / 0.08) * clamp((1 - u) / 0.1), 1, on);
  const ew = Math.max(26, w * 0.17);
  const eh = ew * 0.64;
  glow(ctx, ex, ey, ew * 1.1, pal.accent, 0.2 * fade);
  ctx.fillStyle = rgba(pal.surface, 0.94 * fade);
  ctx.fillRect(ex - ew / 2, ey - eh / 2, ew, eh);
  ctx.strokeStyle = rgba(pal.ink, 0.9 * fade);
  ctx.lineWidth = 1.25;
  ctx.strokeRect(ex - ew / 2, ey - eh / 2, ew, eh);
  ctx.beginPath();
  ctx.moveTo(ex - ew / 2, ey - eh / 2);
  ctx.lineTo(ex, ey + eh * 0.08);
  ctx.lineTo(ex + ew / 2, ey - eh / 2);
  ctx.stroke();

  // the key on its hook: it swings, and stays
  const hx = w * 0.2;
  const hy = h * 0.14;
  const near = on * clamp(1 - Math.hypot(mx - hx, my - h * 0.5) / (w * 0.3));
  const swing = Math.sin(t * 1.3) * (0.07 + near * 0.3) + clamp((hx - mx) / w, -0.3, 0.3) * near;
  ctx.strokeStyle = rgba(pal.ink2, 0.85);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(hx - w * 0.07, hy);
  ctx.lineTo(hx + w * 0.07, hy);
  ctx.stroke();
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(swing);
  const cord = h * 0.1;
  const ring = Math.max(6, h * 0.085);
  const shaft = h * 0.36;
  ctx.strokeStyle = rgba(pal.ink3, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, cord);
  ctx.stroke();
  glow(ctx, 0, cord + ring, ring * 3, pal.gold, 0.16 + near * 0.2);
  ctx.strokeStyle = rgba(pal.gold, 0.95);
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.arc(0, cord + ring, ring, 0, TAU);
  ctx.stroke();
  const top = cord + ring * 2;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(0, top + shaft);
  ctx.moveTo(0, top + shaft);
  ctx.lineTo(ring * 0.9, top + shaft);
  ctx.moveTo(0, top + shaft * 0.74);
  ctx.lineTo(ring * 0.65, top + shaft * 0.74);
  ctx.stroke();
  ctx.restore();
};

export function KeptKey({ ratio = 1.75 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
