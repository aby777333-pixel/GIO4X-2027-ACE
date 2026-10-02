"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { hash } from "../markets/kit";

/**
 * An economic event's page, under "How it is measured.": a release is
 * compiled before it is published. Many small returns (prices in a basket,
 * answers to a survey, votes round a table) come in from the left, pass one
 * after another through the narrow of a funnel, and on the right there is one
 * sheet with one heavy line on it: the figure that is published. The line
 * firms up as the returns arrive and is ruled off when the last one is in.
 * It carries no number, and it never points up or down.
 *
 * Pointer: it carries the compiling forward and back by hand, from nothing
 * gathered on the left to everything gathered on the right.
 */

const N = 22;

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, pal }) => {
  if (w < 160 || h < 50) return;
  const on = smooth(hover);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // gathering, a rest with the sheet complete, then a fresh count
  const ph = (t * 0.12) % 1;
  const auto = ph < 0.7 ? ph / 0.7 : 1;
  const p = lerp(auto, clamp((mx / w - 0.08) / 0.84), on);
  const fresh = lerp(ph < 0.7 ? smooth(ph / 0.05) : 1 - smooth((ph - 0.93) / 0.07), 1, on);

  const nx = w * 0.56;
  const ny = h * 0.5;
  // the funnel
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(pal.ink2, 0.8);
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.1);
  ctx.lineTo(nx, ny - h * 0.07);
  ctx.lineTo(nx + w * 0.06, ny - h * 0.07);
  ctx.moveTo(w * 0.36, h * 0.9);
  ctx.lineTo(nx, ny + h * 0.07);
  ctx.lineTo(nx + w * 0.06, ny + h * 0.07);
  ctx.stroke();

  // the returns
  let arrived = 0;
  for (let i = 0; i < N; i++) {
    const sx = w * (0.05 + hash(i * 3 + 1) * 0.27);
    const sy = h * (0.12 + hash(i * 3 + 2) * 0.76);
    const u = smooth((p - (i / N) * 0.62) / 0.34);
    arrived += u;
    const x = lerp(sx, nx + w * 0.03, u);
    const y = lerp(sy, ny, smooth(u * 1.25));
    const a = fresh * (1 - smooth((u - 0.86) / 0.14));
    if (a < 0.02) continue;
    ctx.fillStyle = rgba(i % 3 === 0 ? pal.accent : pal.ink2, 0.85 * a);
    if (i % 2) ctx.fillRect(x - 3, y - 1, 6, 2);
    else {
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const share = arrived / N;

  // the sheet that is published
  const px = w * 0.72;
  const pw = w * 0.2;
  const py = h * 0.16;
  const pH = h * 0.68;
  ctx.fillStyle = rgba(pal.surface, 0.95);
  ctx.fillRect(px, py, pw, pH);
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(pal.ink, 0.5 + share * 0.4);
  ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, pw, pH);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.75);
  ctx.beginPath();
  ctx.moveTo(px + pw * 0.14, py + pH * 0.2);
  ctx.lineTo(px + pw * 0.6, py + pH * 0.2);
  ctx.moveTo(px + pw * 0.14, py + pH * 0.8);
  ctx.lineTo(px + pw * 0.86, py + pH * 0.8);
  ctx.stroke();
  // the one line that matters, drawn as far as the returns allow
  ctx.lineWidth = Math.max(3, pH * 0.09);
  ctx.lineCap = "butt";
  ctx.strokeStyle = rgba(pal.ink, 0.9);
  ctx.beginPath();
  ctx.moveTo(px + pw * 0.14, py + pH * 0.48);
  ctx.lineTo(px + pw * lerp(0.14, 0.86, share), py + pH * 0.48);
  ctx.stroke();
  ctx.lineCap = "round";
  const ruled = smooth((share - 0.96) / 0.04) * fresh;
  if (ruled > 0.01) {
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = rgba(pal.gold, ruled);
    ctx.beginPath();
    ctx.moveTo(px + pw * 0.14, py + pH * 0.62);
    ctx.lineTo(px + pw * lerp(0.14, 0.86, ruled), py + pH * 0.62);
    ctx.stroke();
  }
  // from the narrow to the sheet
  ctx.setLineDash([1, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.8);
  ctx.beginPath();
  ctx.moveTo(nx + w * 0.07, ny);
  ctx.lineTo(px - 4, ny);
  ctx.stroke();
  ctx.setLineDash([]);
};

export function Compiled({ ratio = 2.7 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
