"use client";

import { Figure, TAU, clamp, rgba, smooth, type FigureDraw } from "../Figure";
import { corners, glow } from "../markets/kit";

/**
 * Legal & Document Centre, beside the three counts: a document and the three
 * things the index says about each one. A ruled sheet lies across the top and
 * three tags hang from it on threads of different lengths: where its text
 * came from (a sheet behind a sheet), when it was last updated (a dated
 * rule), and whether it is under review (an open ring). The tags turn a
 * little on their threads, as hanging things do. No word, date or number is
 * drawn on any of them.
 *
 * Pointer: the tag nearest to it hangs still and lights; the others are
 * stirred by its passing.
 */

const LEN = [0.2, 0.3, 0.24];
const RATE = [1.15, 0.9, 1.05];

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  if (w < 110 || h < 60) return;
  const on = smooth(hover);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  // the document
  const dx = w * 0.2;
  const dw = w * 0.6;
  const dy = h * 0.13;
  const dh = h * 0.3;
  ctx.fillStyle = rgba(pal.surface, 0.9);
  ctx.fillRect(dx, dy, dw, dh);
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(pal.ink, 0.85);
  ctx.strokeRect(Math.round(dx) + 0.5, Math.round(dy) + 0.5, dw, dh);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.7);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const y = Math.round(dy + dh * (0.3 + i * 0.22)) + 0.5;
    ctx.moveTo(dx + dw * 0.07, y);
    ctx.lineTo(dx + dw * (i === 2 ? 0.52 : 0.93), y);
  }
  ctx.stroke();
  // the reading line that passes down the sheet
  const read = dy + dh * (0.14 + 0.72 * (0.5 + 0.5 * Math.sin(t * 0.55)));
  ctx.strokeStyle = rgba(pal.accent, 0.55);
  ctx.beginPath();
  ctx.moveTo(dx + 3, read);
  ctx.lineTo(dx + dw - 3, read);
  ctx.stroke();

  // which tag the pointer is nearest
  let pick = -1;
  if (on > 0.02) pick = clamp(Math.round(((mx - dx) / dw - 0.16) / 0.34), 0, 2);

  const tw = Math.max(24, w * 0.15);
  const th = tw * 0.62;
  for (let i = 0; i < 3; i++) {
    const ax = dx + dw * (0.16 + i * 0.34);
    const ay = dy + dh;
    const chosen = pick === i ? on : 0;
    const stir = pick >= 0 && pick !== i ? on * 0.1 : 0;
    const a = Math.sin(t * RATE[i] + i * 2.1) * (0.07 + stir) * (1 - chosen) + clamp((my / h - 0.5) * 0.04, -0.02, 0.02) * stir;
    const len = h * LEN[i];
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.strokeStyle = rgba(pal.ink3, 0.85);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, len);
    ctx.stroke();
    if (chosen > 0.02) glow(ctx, 0, len + th / 2, tw, pal.gold, 0.3 * chosen);
    // the tag, with its eyelet
    ctx.beginPath();
    ctx.moveTo(-tw * 0.22, len);
    ctx.lineTo(tw * 0.22, len);
    ctx.lineTo(tw / 2, len + th * 0.3);
    ctx.lineTo(tw / 2, len + th);
    ctx.lineTo(-tw / 2, len + th);
    ctx.lineTo(-tw / 2, len + th * 0.3);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.surface, 0.94);
    ctx.fill();
    ctx.fillStyle = rgba(pal.gold, 0.12 + chosen * 0.16);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.gold, 0.75 + chosen * 0.25);
    ctx.lineWidth = 1.25;
    ctx.stroke();
    // what each tag says, as a mark
    const cx = 0;
    const cy = len + th * 0.64;
    const u = th * 0.2;
    ctx.strokeStyle = rgba(pal.ink, 0.85);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    if (i === 0) {
      // a sheet behind a sheet: carried over from an earlier text
      ctx.rect(-u * 1.3, cy - u * 1.1, u * 1.7, u * 1.7);
      ctx.moveTo(-u * 0.5, cy + u * 1.1);
      ctx.lineTo(u * 1.3, cy + u * 1.1);
      ctx.lineTo(u * 1.3, cy - u * 0.4);
    } else if (i === 1) {
      // a rule with one mark on it: the date of the last change
      ctx.moveTo(-u * 1.7, cy + u * 0.5);
      ctx.lineTo(u * 1.7, cy + u * 0.5);
      ctx.moveTo(u * 0.6, cy - u * 1.0);
      ctx.lineTo(u * 0.6, cy + u * 0.5);
    } else {
      // an open ring: under review, not closed
      ctx.arc(cx, cy, u * 1.05, TAU * 0.12, TAU * 0.9);
    }
    ctx.stroke();
    ctx.restore();
  }
};

export function ThreeTags({ ratio = 1.75 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
