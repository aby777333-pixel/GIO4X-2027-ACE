"use client";

import { Figure, TAU, lerp, rgba, smooth, type Colour, type FigureDraw, type Palette } from "../Figure";

/**
 * Connect the Dots, "Go deeper": every mark in the diagram has a page behind
 * it. Four marks joined as the diagram joins them stand on the left. One at a
 * time, a mark sends a leader across to the right and its page opens there: a
 * sheet with a heading bar in the mark's own colour and ruled lines for the
 * text. It closes and the next mark takes its turn. No word or figure is
 * drawn on any sheet.
 *
 * Pointer: the mark nearest to it opens its page and keeps it open.
 */

const DOTS = [
  [0.12, 0.3],
  [0.3, 0.72],
  [0.44, 0.24],
  [0.2, 0.52],
] as const;
const LINKS = [
  [0, 3],
  [3, 1],
  [3, 2],
] as const;
const tone = (pal: Palette, i: number): Colour => [pal.accent, pal.teal, pal.gold, pal.emerald][i % 4];

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  if (w < 160 || h < 60) return;
  const on = smooth(hover);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // offset so that the still frame falls while a page is fully open
  const beat = t * 0.36 + 0.5;
  let active = Math.floor(beat) % DOTS.length;
  const frac = beat - Math.floor(beat);
  let open = smooth(frac / 0.28) * (1 - smooth((frac - 0.86) / 0.14));
  if (on > 0.02) {
    let best = 1e9;
    let pick = active;
    for (let i = 0; i < DOTS.length; i++) {
      const d = Math.hypot(DOTS[i][0] * w - mx, DOTS[i][1] * h - my);
      if (d < best) {
        best = d;
        pick = i;
      }
    }
    if (pick !== active) open = lerp(open * (1 - on), 1, on);
    else open = lerp(open, 1, on);
    active = pick;
  }

  // the relations
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.7);
  ctx.beginPath();
  for (const [a, b] of LINKS) {
    ctx.moveTo(DOTS[a][0] * w, DOTS[a][1] * h);
    ctx.lineTo(DOTS[b][0] * w, DOTS[b][1] * h);
  }
  ctx.stroke();

  // the page of the mark whose turn it is
  const c = tone(pal, active);
  const ax = DOTS[active][0] * w;
  const ay = DOTS[active][1] * h;
  const px = w * 0.62;
  const pw = w * 0.3;
  const ph = h * 0.74;
  const py = (h - ph) / 2;
  if (open > 0.01) {
    ctx.strokeStyle = rgba(c, 0.8 * open);
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.bezierCurveTo(lerp(ax, px, 0.5), ay, lerp(ax, px, 0.5), h / 2, lerp(ax, px, open), lerp(ay, h / 2, open));
    ctx.stroke();
    ctx.setLineDash([]);
    const sw = pw * open;
    ctx.fillStyle = rgba(pal.surface, 0.95 * open);
    ctx.fillRect(px, py, sw, ph);
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = rgba(pal.ink, 0.8 * open);
    ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, sw, ph);
    ctx.fillStyle = rgba(c, 0.85 * open);
    ctx.fillRect(px + sw * 0.1, py + ph * 0.13, sw * 0.46, Math.max(3, ph * 0.06));
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.75 * open);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const y = Math.round(py + ph * (0.34 + i * 0.12)) + 0.5;
      ctx.moveTo(px + sw * 0.1, y);
      ctx.lineTo(px + sw * (i === 4 ? 0.55 : 0.9), y);
    }
    ctx.stroke();
  }

  // the marks: ringed, as the picks are in the diagram
  for (let i = 0; i < DOTS.length; i++) {
    const x = DOTS[i][0] * w;
    const y = DOTS[i][1] * h;
    const lit = i === active ? open : 0;
    const ci = tone(pal, i);
    ctx.beginPath();
    ctx.arc(x, y, 7 + lit * 2, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = rgba(ci, 0.55 + lit * 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, TAU);
    ctx.fillStyle = rgba(ci, 0.7 + lit * 0.3);
    ctx.fill();
  }
};

export function DotToPage({ ratio = 2.6 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
