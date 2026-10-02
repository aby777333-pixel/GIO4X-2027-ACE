"use client";

import { Figure, rgba, smooth, type FigureDraw } from "../Figure";
import { line, roundRect } from "./shapes";

/**
 * Central bank pages, "Economic events": the bank as a publisher. A small
 * classical front stands on its steps, and from its door a line of releases
 * goes out along a rail, one sheet after another at an even pace. The sheets
 * carry ruled strokes, never a figure: what a release says is read at its
 * source.
 *
 * The pointer stops the nearest sheet for a closer look: it rises off the
 * rail and opens to its full size while the others keep moving.
 */

const SHEETS = 5;

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, pal }) => {
  // hidden below lg, the canvas has no size: nothing to draw
  if (w < 120 || h < 60) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const m = 16;
  const ground = Math.round(h * 0.88) + 0.5;
  const fh = h * 0.74; // height of the front, steps to apex
  const fw = fh * 1.08;
  const fx = m + 6;
  const stepH = Math.max(3, fh * 0.055);
  const colTop = ground - stepH * 2 - fh * 0.5;
  const colBot = ground - stepH * 2;
  const entH = fh * 0.1;
  const apex = colTop - entH - fh * 0.24;

  // ground
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.5);
  line(ctx, m, ground, w - m, ground);

  // the front: two steps, five columns, entablature, pediment
  ctx.strokeStyle = rgba(pal.ink2, 0.9);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.beginPath();
  ctx.rect(fx - 6, ground - stepH, fw + 12, stepH);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(fx - 2, ground - stepH * 2, fw + 4, stepH);
  ctx.fill();
  ctx.stroke();
  const cols = 5;
  const cw = Math.max(3, fw * 0.07);
  for (let i = 0; i < cols; i++) {
    const x = fx + 4 + ((fw - 8 - cw) * i) / (cols - 1);
    ctx.beginPath();
    ctx.rect(x, colTop, cw, colBot - colTop);
    ctx.fill();
    ctx.stroke();
    // a flute down each column
    ctx.strokeStyle = rgba(pal.ink3, 0.4);
    line(ctx, x + cw / 2, colTop + 3, x + cw / 2, colBot - 3);
    ctx.strokeStyle = rgba(pal.ink2, 0.9);
  }
  ctx.beginPath();
  ctx.rect(fx, colTop - entH, fw, entH);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(fx - 3, colTop - entH);
  ctx.lineTo(fx + fw / 2, apex);
  ctx.lineTo(fx + fw + 3, colTop - entH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // the roundel in the pediment: the one champagne mark
  ctx.beginPath();
  ctx.arc(fx + fw / 2, colTop - entH - (colTop - entH - apex) * 0.38, Math.max(2, fh * 0.04), 0, Math.PI * 2);
  ctx.strokeStyle = rgba(pal.gold, 1);
  ctx.stroke();

  // the rail the releases leave on
  const railY = Math.round(colTop + (colBot - colTop) * 0.62) + 0.5;
  const x0 = fx + fw + 10;
  const x1 = w - m - 4;
  ctx.strokeStyle = rgba(pal.ink3, 0.45);
  line(ctx, x0, railY, x1, railY);
  ctx.strokeStyle = rgba(pal.ink3, 0.3);
  const posts = 6;
  for (let i = 0; i <= posts; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / posts) + 0.5;
    line(ctx, x, railY, x, ground);
  }

  // the sheets
  const len = x1 - x0;
  const sh = Math.min(h * 0.34, 40);
  const sw = sh * 0.76;
  const on = smooth(hover);
  let near = -1;
  let nd = Infinity;
  const xs: number[] = [];
  for (let i = 0; i < SHEETS; i++) {
    const u = (t * 0.045 + i / SHEETS) % 1;
    const x = x0 + u * len;
    xs.push(x);
    const d = Math.abs(x - mx);
    if (d < nd) {
      nd = d;
      near = i;
    }
  }
  for (let i = 0; i < SHEETS; i++) {
    const u = (xs[i] - x0) / len;
    const fade = smooth(u / 0.1) * (1 - smooth((u - 0.88) / 0.12));
    const pickd = i === near ? on * smooth(1 - nd / (len * 0.2)) : 0;
    const k = 1 + pickd * 0.5;
    const hw = (sw * k) / 2;
    const hh = sh * k;
    const x = xs[i];
    const y = railY - 3 - pickd * 5 - Math.sin(t * 1.3 + i * 1.7) * 1;

    // the clip that holds it to the rail
    ctx.strokeStyle = rgba(pal.ink3, 0.6 * fade);
    ctx.lineWidth = 1;
    line(ctx, x, railY, x, y);

    roundRect(ctx, x - hw, y - hh, hw * 2, hh, 2);
    ctx.fillStyle = rgba(pal.surface, fade);
    ctx.fill();
    ctx.lineWidth = 1 + pickd * 0.4;
    ctx.strokeStyle = pickd > 0.02 ? rgba(pal.accent, (0.5 + pickd * 0.5) * fade) : rgba(pal.ink2, 0.8 * fade);
    ctx.stroke();

    // heading and ruled lines: more of them once it is opened
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = pickd > 0.02 ? rgba(pal.accent, fade) : rgba(pal.ink, 0.7 * fade);
    line(ctx, x - hw + 4, y - hh + 6, x - hw + 4 + hw * 0.9, y - hh + 6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.7 * fade);
    const rows = pickd > 0.5 ? 5 : 3;
    const gap = (hh - 14) / rows;
    for (let r = 0; r < rows; r++) {
      const ly = y - hh + 11 + r * gap + gap / 2;
      line(ctx, x - hw + 4, ly, x + hw - 4 - (r === rows - 1 ? hw * 0.6 : 0), ly);
    }
  }
};

export function BankReleases({ ratio = 2.4 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
