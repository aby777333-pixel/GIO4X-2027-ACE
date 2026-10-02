"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type Colour, type FigureDraw } from "../Figure";

/**
 * Designing GIO4X, "Commitments, not aspirations.": the third commitment,
 * "Never colour alone", put to the test. Four marks stand in a row, each in
 * its own colour and each with its own shape and its own sign under it. A
 * grey band crosses them slowly. Inside the band every colour is taken away,
 * and the four are still four different things: an arrow up, an arrow down, a
 * ring and a square.
 *
 * Pointer: the grey band follows it.
 */

const mix = (a: Colour, b: Colour, k: number): Colour => [Math.round(lerp(a[0], b[0], k)), Math.round(lerp(a[1], b[1], k)), Math.round(lerp(a[2], b[2], k)), lerp(a[3], b[3], k)];

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, pal }) => {
  if (w < 160 || h < 50) return;
  const on = smooth(hover);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const bandW = w * 0.3;
  const auto = lerp(-bandW * 0.5, w + bandW * 0.5, (t * 0.11) % 1);
  const bx = lerp(auto, mx, on);

  // the band: where there is no colour
  ctx.fillStyle = rgba(pal.ink, 0.06);
  ctx.fillRect(bx - bandW / 2, 0, bandW, h);
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = rgba(pal.ink3, 0.9);
  ctx.beginPath();
  ctx.moveTo(bx - bandW / 2, 3);
  ctx.lineTo(bx - bandW / 2, h - 3);
  ctx.moveTo(bx + bandW / 2, 3);
  ctx.lineTo(bx + bandW / 2, h - 3);
  ctx.stroke();
  ctx.setLineDash([]);

  const tones: Colour[] = [pal.emerald, pal.gold, pal.accent, pal.teal];
  const r = Math.min(h * 0.17, w * 0.045);
  const cy = h * 0.42;
  for (let i = 0; i < 4; i++) {
    const x = w * (0.14 + i * 0.24);
    const grey = smooth(clamp((bandW / 2 - Math.abs(x - bx)) / (r * 1.2)));
    const c = mix(tones[i], pal.ink2, grey);
    ctx.fillStyle = rgba(c, 0.9);
    ctx.strokeStyle = rgba(c, 1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (i === 0) {
      ctx.moveTo(x, cy - r);
      ctx.lineTo(x + r, cy + r * 0.8);
      ctx.lineTo(x - r, cy + r * 0.8);
      ctx.closePath();
      ctx.fill();
    } else if (i === 1) {
      ctx.moveTo(x, cy + r);
      ctx.lineTo(x + r, cy - r * 0.8);
      ctx.lineTo(x - r, cy - r * 0.8);
      ctx.closePath();
      ctx.fill();
    } else if (i === 2) {
      ctx.arc(x, cy, r * 0.85, 0, TAU);
      ctx.stroke();
    } else {
      ctx.rect(x - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6);
      ctx.fill();
    }
    // the sign or the word that goes with it
    const sy = h * 0.8;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(pal.ink, 0.85);
    ctx.beginPath();
    if (i < 2) {
      ctx.moveTo(x - 4, sy);
      ctx.lineTo(x + 4, sy);
      if (i === 0) {
        ctx.moveTo(x, sy - 4);
        ctx.lineTo(x, sy + 4);
      }
    } else {
      ctx.moveTo(x - r * 1.1, sy);
      ctx.lineTo(x + r * (i === 2 ? 0.5 : 1.1), sy);
    }
    ctx.stroke();
  }
};

export function GreyProof({ ratio = 3 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
