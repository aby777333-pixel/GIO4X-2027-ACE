"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * What separation does and does not do, for "What it does not protect
 * against" on the client funds page.
 *
 * Two open vessels share one wall. On the firm's side, marks drift across and
 * are turned back at the wall: that is what the wall is for. On the client
 * side, five strokes fall in from above, one for each row of the list, and
 * the wall has no say in it.
 *
 * Pointer: the falling strokes gather over the pointer and the wall lights,
 * to show that it is standing and still does not stop them.
 */

const DROPS = 5;
const DRIFT = 6;
const frac = (v: number) => v - Math.floor(v);
/** 0 → 1 → 0 across one period */
const tri = (v: number) => 1 - Math.abs(2 * frac(v) - 1);

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal, t } = f;
  const top = 34;
  const foot = h - 30;
  const left = 16;
  const right = w - 16;
  const wall = Math.round(lerp(left, right, 0.64));
  const surface = lerp(top, foot, 0.62);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // what the client vessel holds
  ctx.beginPath();
  ctx.moveTo(left, foot);
  ctx.lineTo(left, surface);
  for (let x = left; x <= wall; x += 6) ctx.lineTo(x, surface + 1.6 * Math.sin(x * 0.07 + t * 0.9));
  ctx.lineTo(wall, foot);
  ctx.closePath();
  ctx.fillStyle = rgba(pal.accent, 0.09);
  ctx.fill();
  ctx.beginPath();
  for (let x = left; x <= wall; x += 6) {
    const y = surface + 1.6 * Math.sin(x * 0.07 + t * 0.9);
    if (x === left) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = rgba(pal.accent, 0.7);
  ctx.lineWidth = 1;
  ctx.stroke();

  // the firm's side: marks that drift to the wall and are turned back
  let knock = 0;
  for (let i = 0; i < DRIFT; i++) {
    const p = tri(t * (0.07 + 0.013 * i) + i * 0.29);
    const x = lerp(right - 9, wall + 8, p);
    const y = lerp(top + 26, foot - 14, frac(i * 0.618 + 0.12));
    knock = Math.max(knock, smooth((p - 0.9) / 0.1));
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.strokeStyle = rgba(pal.ink2, 0.55);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // the vessels: open at the top
  ctx.beginPath();
  ctx.moveTo(left, top + 12);
  ctx.lineTo(left, foot);
  ctx.lineTo(right, foot);
  ctx.lineTo(right, top + 12);
  ctx.strokeStyle = rgba(pal.ink, 0.36);
  ctx.lineWidth = 1;
  ctx.stroke();

  // the wall between them
  const lit = Math.max(f.hover, knock * 0.7);
  ctx.beginPath();
  ctx.moveTo(wall, top + 4);
  ctx.lineTo(wall, foot);
  ctx.strokeStyle = rgba(pal.ink, 0.7);
  ctx.lineWidth = 3;
  ctx.stroke();
  if (lit > 0.004) {
    ctx.strokeStyle = rgba(pal.gold, lit);
    ctx.stroke();
  }

  // five strokes from above: they fall into the client side whatever the wall does
  const span = wall - left;
  for (let i = 0; i < DROPS; i++) {
    const own = left + span * ((i + 0.5) / DROPS);
    const gathered = clamp(f.mx, left + 14, wall - 14) + (i - (DROPS - 1) / 2) * 11;
    const x = lerp(own, gathered, f.hover);
    const p = frac(t * 0.21 + i * 0.37);
    const fall = clamp(p / 0.72);
    const y = lerp(26, surface, fall * fall);
    if (p < 0.72) {
      const tail = 18 + 14 * fall;
      const g = ctx.createLinearGradient(0, y - tail, 0, y);
      g.addColorStop(0, rgba(pal.ink, 0));
      g.addColorStop(1, rgba(pal.ink, 0.9));
      ctx.beginPath();
      ctx.moveTo(x, y - tail);
      ctx.lineTo(x, y);
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, TAU);
      ctx.fillStyle = rgba(pal.ink, 0.9);
      ctx.fill();
    } else {
      // where it lands
      const q = (p - 0.72) / 0.28;
      ctx.beginPath();
      ctx.ellipse(x, surface, 3 + 15 * q, 1 + 3.5 * q, 0, 0, TAU);
      ctx.strokeStyle = rgba(pal.ink, 0.6 * (1 - q));
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // the two names, as the section uses them
  ctx.font = `600 10px ${pal.font}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(pal.ink3, 1);
  ctx.fillText("CLIENT ACCOUNT", left, h - 8);
  ctx.textAlign = "right";
  ctx.fillText("THE FIRM", right, h - 8);
};

export function SeparationWall() {
  return <Figure draw={draw} />;
}
