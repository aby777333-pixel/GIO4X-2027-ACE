"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { corners, lamp } from "../markets/kit";

/**
 * About, beside "The company": "A brokerage that prefers to be checked."
 * A sliding caliper and the thing it measures. One jaw is fixed, the other
 * travels in along the beam until the block is held between the two, rests
 * there, and opens again. When the jaws meet the block the contact lights and
 * two fine lines carry its width up to the scale. The scale has ticks and no
 * numerals: the figure is the act of checking, not a measurement.
 *
 * Pointer: the travelling jaw follows it along the beam, so the block can be
 * measured by hand. It stops at the block and cannot pass through it.
 */

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, pal }) => {
  if (w < 110 || h < 60) return;
  const on = smooth(hover);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  const x0 = w * 0.13;
  const x1 = w * 0.89;
  const span = x1 - x0;
  const beamY = h * 0.3;
  const beamH = Math.max(6, h * 0.075);
  const jawBottom = h * 0.8;
  const blockW = span * 0.382;
  const closed = x0 + blockW;
  const open = closed + span * 0.36;

  // closing, holding, opening: the still frame falls in the hold
  const ph = (t * 0.2) % 1;
  const auto = ph < 0.36 ? smooth(ph / 0.36) : ph < 0.72 ? 1 : 1 - smooth((ph - 0.72) / 0.28);
  const byHand = 1 - clamp((mx - closed) / (open - closed));
  const c = lerp(auto, byHand, on);
  const jx = lerp(open, closed, c);
  const held = smooth((c - 0.94) / 0.06);

  // the beam and its scale
  ctx.fillStyle = rgba(pal.surface, 0.5);
  ctx.fillRect(x0, beamY, span, beamH);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink2, 0.75);
  ctx.strokeRect(x0 + 0.5, Math.round(beamY) + 0.5, span, beamH);
  const step = span / 48;
  ctx.beginPath();
  for (let i = 1; i < 48; i++) {
    const x = Math.round(x0 + i * step) + 0.5;
    ctx.moveTo(x, beamY - (i % 6 === 0 ? 7 : 3.5));
    ctx.lineTo(x, beamY - 0.5);
  }
  ctx.strokeStyle = rgba(pal.ink3, 0.75);
  ctx.stroke();

  // the block: what is being checked
  const by = h * 0.5;
  const bh = jawBottom - by - h * 0.06;
  ctx.fillStyle = rgba(pal.accent, 0.1 + held * 0.1);
  ctx.fillRect(x0, by, blockW, bh);
  ctx.strokeStyle = rgba(pal.ink, 0.55 + held * 0.4);
  ctx.strokeRect(Math.round(x0) + 0.5, Math.round(by) + 0.5, blockW, bh);
  ctx.strokeStyle = rgba(pal.ink3, 0.5);
  ctx.beginPath();
  for (let i = 1; i <= 3; i++) {
    const y = Math.round(by + (bh * i) / 4) + 0.5;
    ctx.moveTo(x0 + blockW * 0.14, y);
    ctx.lineTo(x0 + blockW * (i === 3 ? 0.55 : 0.86), y);
  }
  ctx.stroke();

  // its width, carried up to the scale once it is held
  if (held > 0.01) {
    ctx.setLineDash([1, 3]);
    ctx.strokeStyle = rgba(pal.gold, 0.8 * held);
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, by - 2);
    ctx.lineTo(x0 + 0.5, beamY + beamH + 2);
    ctx.moveTo(closed + 0.5, by - 2);
    ctx.lineTo(closed + 0.5, beamY + beamH + 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, beamY - 10);
    ctx.lineTo(closed, beamY - 10);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // the jaws: the fixed one on the left, the travelling one with its cursor on the beam
  const jaw = (x: number, dir: number, strong: number) => {
    ctx.beginPath();
    ctx.moveTo(x, beamY - 3);
    ctx.lineTo(x, jawBottom);
    ctx.lineTo(x + dir * w * 0.035, jawBottom - h * 0.1);
    ctx.lineTo(x + dir * w * 0.035, beamY - 3);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.surface, 0.9);
    ctx.fill();
    ctx.fillStyle = rgba(pal.gold, 0.16 + strong * 0.2);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.gold, 0.9);
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.lineWidth = 1;
  };
  jaw(x0, -1, held);
  jaw(jx, 1, held);
  const cw = w * 0.11;
  ctx.fillStyle = rgba(pal.surface, 0.92);
  ctx.fillRect(jx, beamY - 4, cw, beamH + 8);
  ctx.strokeStyle = rgba(pal.gold, 0.9);
  ctx.strokeRect(Math.round(jx) + 0.5, Math.round(beamY - 4) + 0.5, cw, beamH + 8);
  ctx.strokeStyle = rgba(pal.ink, 0.8);
  ctx.beginPath();
  ctx.moveTo(jx + 0.5, beamY - 4);
  ctx.lineTo(jx + 0.5, beamY + beamH + 4);
  ctx.stroke();

  if (held > 0.01) lamp(ctx, closed, by + bh * 0.5, 1.8 + held * 0.6, pal.gold, held);
};

export function Caliper({ ratio = 1.75 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
