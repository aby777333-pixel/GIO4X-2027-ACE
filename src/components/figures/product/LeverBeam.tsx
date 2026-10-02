"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { line } from "./shapes";

/**
 * Trader Toolkit, "Understand the mechanics": a lever. A small weight on the
 * long arm holds a larger one on the short arm, and the beam rocks slowly on
 * its fulcrum. The dashed arcs show how far each end travels: the long arm
 * moves a great deal, the short arm very little. It is the plainest picture of
 * what leverage multiplies, and of why it works in both directions.
 *
 * The pointer slides the fulcrum along the beam. The larger weight grows or
 * shrinks to whatever the new arms would balance, and the arcs follow.
 */

type State = { p: number };
const states = new WeakMap<CanvasRenderingContext2D, State>();

const draw: FigureDraw = ({ ctx, w, h, t, dt, hover, mx, pal, still }) => {
  // hidden below lg, the canvas has no size: nothing to draw
  if (w < 120 || h < 60) return;
  const xL = w * 0.13;
  const xR = w * 0.87;
  const ground = h * 0.88;
  const pivotY = h * 0.66;

  // the fulcrum: at rest towards the right, under the pointer where the pointer is
  const rest = 0.7;
  const want = lerp(rest, clamp((mx - xL) / (xR - xL), 0.24, 0.76), smooth(hover));
  let st = states.get(ctx);
  if (!st) {
    st = { p: want };
    states.set(ctx, st);
  }
  st.p = still ? want : st.p + (want - st.p) * (1 - Math.exp(-dt * 6));
  const xF = lerp(xL, xR, st.p);
  const a = xF - xL;
  const b = xR - xF;
  const ang = Math.sin(t * 0.75) * 0.085;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ground, with a few hatch marks under the fulcrum
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.5);
  line(ctx, 16, Math.round(ground) + 0.5, w - 16, Math.round(ground) + 0.5);
  ctx.strokeStyle = rgba(pal.ink3, 0.28);
  for (let i = -3; i <= 3; i++) line(ctx, xF + i * 7, ground + 3, xF + i * 7 - 5, ground + 8);

  // how far each end travels
  const sweep = 0.2;
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = rgba(pal.accent, 0.6);
  ctx.beginPath();
  ctx.arc(xF, pivotY, a, Math.PI - sweep, Math.PI + sweep);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.gold, 0.9);
  ctx.beginPath();
  ctx.arc(xF, pivotY, b, -sweep, sweep);
  ctx.stroke();
  ctx.setLineDash([]);

  // the fulcrum
  const fw = (ground - pivotY) * 0.62;
  ctx.beginPath();
  ctx.moveTo(xF, pivotY + 2);
  ctx.lineTo(xF + fw, ground);
  ctx.lineTo(xF - fw, ground);
  ctx.closePath();
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink2, 0.8);
  ctx.stroke();

  // the beam and what stands on it, in the beam's own frame
  ctx.save();
  ctx.translate(xF, pivotY);
  ctx.rotate(ang);

  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.strokeStyle = rgba(pal.ink, 0.85);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.rect(-a, -4, a + b, 4);
  ctx.fill();
  ctx.stroke();
  // divisions ruled along the beam
  ctx.strokeStyle = rgba(pal.ink3, 0.45);
  ctx.lineWidth = 1;
  const unit = (a + b) / 12;
  for (let i = 1; i < 12; i++) line(ctx, -a + i * unit, -4, -a + i * unit, -1.5);

  // the small weight, on the left end
  const s = Math.max(11, h * 0.1);
  ctx.fillStyle = rgba(pal.accent, 0.16);
  ctx.strokeStyle = rgba(pal.accent, 0.95);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.rect(-a + 1, -4 - s, s, s);
  ctx.fill();
  ctx.stroke();

  // the weight it balances, on the right end: area in proportion to the arms
  const big = s * Math.sqrt(clamp(a / b, 0.25, 4.2));
  ctx.fillStyle = rgba(pal.gold, 0.2);
  ctx.strokeStyle = rgba(pal.gold, 1);
  ctx.beginPath();
  ctx.rect(b - 1 - big, -4 - big, big, big);
  ctx.fill();
  ctx.stroke();
  // a second edge, for a little depth
  ctx.strokeStyle = rgba(pal.gold, 0.4);
  ctx.beginPath();
  ctx.moveTo(b - 1 - big + 3, -4 - big - 3);
  ctx.lineTo(b - 1 + 3, -4 - big - 3);
  ctx.lineTo(b - 1 + 3, -4 - 3);
  ctx.stroke();
  ctx.restore();

  // the pivot pin
  ctx.beginPath();
  ctx.arc(xF, pivotY - 2, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = rgba(pal.ink, 0.9);
  ctx.fill();

  // the two arms, measured under the beam
  const dimY = ground - (ground - pivotY) * 0.42;
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.accent, 0.55);
  line(ctx, xL, dimY, xF - fw * 0.7, dimY);
  line(ctx, xL, dimY - 3, xL, dimY + 3);
  ctx.strokeStyle = rgba(pal.gold, 0.8);
  line(ctx, xF + fw * 0.7, dimY, xR, dimY);
  line(ctx, xR, dimY - 3, xR, dimY + 3);
};

export function LeverBeam() {
  return <Figure draw={draw} ratio={2.5} />;
}
