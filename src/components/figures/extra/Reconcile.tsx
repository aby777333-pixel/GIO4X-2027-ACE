"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { hash } from "../markets/kit";

/**
 * Client funds, "What holding funds separately means": the second row of the
 * list, drawn. Two rails. The upper one is the money in the client accounts,
 * in parcels; the lower one is the firm's record of who is owed what, entry by
 * entry. A checking mark travels along them, and each parcel it has passed is
 * tied to its entry: that tying, done regularly, is reconciliation. The
 * parcels have no sizes that mean anything and there are no amounts.
 *
 * Pointer: the checking mark follows it, so the two rails can be tied and
 * untied by hand.
 */

const N = 8;
/** the parcels' widths, as shares of the rail; fixed, never random at draw time */
const SHARE: number[] = [];
let total = 0;
for (let i = 0; i < N; i++) {
  const s = 0.6 + hash(i + 3) * 0.9;
  SHARE.push(s);
  total += s;
}

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, pal }) => {
  if (w < 160 || h < 50) return;
  const on = smooth(hover);
  ctx.lineCap = "round";
  const x0 = w * 0.05;
  const x1 = w * 0.95;
  const span = x1 - x0;
  const yTop = h * 0.26;
  const yBot = h * 0.74;
  const bh = Math.max(8, h * 0.17);
  const gap = 5;

  // across, a rest at the far end, and back to the start
  const ph = (t * 0.13) % 1;
  const auto = ph < 0.7 ? smooth(ph / 0.7) : ph < 0.86 ? 1 : 1 - smooth((ph - 0.86) / 0.14);
  const u = lerp(auto, clamp((mx - x0) / span), on);
  const mark = x0 + span * u;

  let x = x0;
  for (let i = 0; i < N; i++) {
    const bw = (SHARE[i] / total) * span - gap;
    const mid = x + bw / 2;
    const tied = smooth((mark - mid) / 10 + 0.5);
    // the parcel, and its entry in the books
    ctx.fillStyle = rgba(pal.accent, 0.1 + tied * 0.12);
    ctx.fillRect(x, yTop - bh / 2, bw, bh);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink, 0.45 + tied * 0.4);
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(yTop - bh / 2) + 0.5, bw, bh);
    ctx.strokeStyle = rgba(pal.ink2, 0.5 + tied * 0.4);
    ctx.beginPath();
    ctx.moveTo(x + 2, yBot - 3);
    ctx.lineTo(x + bw - 2, yBot - 3);
    ctx.moveTo(x + 2, yBot + 3);
    ctx.lineTo(x + bw * 0.6, yBot + 3);
    ctx.stroke();
    // the tie between them, once checked
    if (tied > 0.01) {
      ctx.strokeStyle = rgba(pal.gold, tied);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(mid, yTop + bh / 2 + 2);
      ctx.lineTo(mid, lerp(yTop + bh / 2 + 2, yBot - 7, tied));
      ctx.stroke();
      ctx.fillStyle = rgba(pal.gold, tied);
      ctx.beginPath();
      ctx.arc(mid, yBot - 7, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    x += bw + gap;
  }

  // the checking mark
  ctx.strokeStyle = rgba(pal.accent, 0.9);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(mark, h * 0.08);
  ctx.lineTo(mark, h * 0.92);
  ctx.stroke();
  ctx.fillStyle = rgba(pal.accent, 0.95);
  ctx.beginPath();
  ctx.moveTo(mark - 4, h * 0.08);
  ctx.lineTo(mark + 4, h * 0.08);
  ctx.lineTo(mark, h * 0.08 + 6);
  ctx.closePath();
  ctx.fill();
};

export function Reconcile({ ratio = 3.6 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
