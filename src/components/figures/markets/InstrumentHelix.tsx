"use client";

import { Figure, TAU, rgba, smooth, type Colour, type FigureDraw } from "../Figure";
import { PHI, corners, glow } from "./kit";

/**
 * Instrument pages, beside the fixing or the conditions: the page's own name
 * for what follows, "Market DNA", drawn as one. Two strands wind about a
 * common axis across the stage (one turn is as long as the golden section of
 * its width), joined by rungs in five tones for the five things the page sets
 * out: class, contract, hours, institutions and releases. It turns slowly and
 * a soft light travels along it. It is a drawing of structure: no rung is a
 * value.
 *
 * Pointer: the helix opens where the pointer rests. The twist is taken up on
 * either side, the two strands stand apart there and the rungs between them
 * take the champagne light, as if that part had been laid flat to be read.
 */

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, pal }) => {
  if (w < 150 || h < 50) return;
  const on = smooth(hover);
  const x0 = 16;
  const x1 = w - 16;
  const cy = h * 0.5;
  const A = Math.min(h * 0.34, 48);
  const lambda = A * 2 * PHI;
  const kx = TAU / lambda;
  const reach = lambda * 0.7;
  const tones: Colour[] = [pal.accent, pal.teal, pal.emerald, pal.gold, pal.ink2];

  const open = (x: number) => (on < 0.01 ? 0 : on * Math.exp(-(((x - mx) / reach) ** 2)));
  /** the angle of the first strand at x: an even twist, eased flat where the pointer opens it */
  const theta = (x: number) => {
    const raw = kx * (x - w / 2) + t * 0.5;
    return raw - open(x) * 0.5 * Math.sin(2 * raw);
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  // a strand fades out toward both ends rather than stopping
  const fade = (c: Colour, a: number) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, rgba(c, 0));
    g.addColorStop(0.09, rgba(c, a));
    g.addColorStop(0.91, rgba(c, a));
    g.addColorStop(1, rgba(c, 0));
    return g;
  };
  const edge = (x: number) => smooth(Math.min(x - x0, x1 - x) / 36);

  // the axis, and the light that travels along it
  ctx.lineWidth = 1;
  ctx.strokeStyle = fade(pal.ink3, 0.3);
  ctx.beginPath();
  ctx.moveTo(x0, cy + 0.5);
  ctx.lineTo(x1, cy + 0.5);
  ctx.stroke();
  const span = x1 - x0;
  const lightX = x0 - 60 + ((t * 34) % (span + 120));
  glow(ctx, lightX, cy, A * 1.15, pal.accent, 0.16 * edge(Math.max(x0 + 1, Math.min(x1 - 1, lightX))));

  const N = 140;
  const strand = (which: 0 | 1, near: boolean) => {
    const c = which === 0 ? pal.accent : pal.teal;
    ctx.lineWidth = near ? 2 : 1;
    ctx.strokeStyle = fade(c, near ? 0.95 : 0.3);
    ctx.beginPath();
    let pen = false;
    let px = 0;
    let py = 0;
    for (let i = 0; i <= N; i++) {
      const x = x0 + (span * i) / N;
      const th = theta(x) + which * Math.PI;
      const y = cy + A * (1 + open(x) * 0.1) * Math.cos(th);
      if (i > 0) {
        const mid = theta(x - span / N / 2) + which * Math.PI;
        if (Math.sin(mid) > 0 === near) {
          if (!pen) ctx.moveTo(px, py);
          ctx.lineTo(x, y);
          pen = true;
        } else pen = false;
      }
      px = x;
      py = y;
    }
    ctx.stroke();
  };

  strand(0, false);
  strand(1, false);

  // the rungs: eight to a turn, in five tones
  const pitch = lambda / 8;
  const count = Math.floor(span / pitch);
  const first = x0 + (span - count * pitch) / 2;
  for (let i = 0; i <= count; i++) {
    const x = first + i * pitch;
    const th = theta(x);
    const o = open(x);
    const amp = A * (1 + o * 0.1);
    const ya = cy + amp * Math.cos(th);
    const yb = cy - amp * Math.cos(th);
    const face = Math.abs(Math.cos(th));
    const lit = Math.exp(-(((x - lightX) / 46) ** 2));
    const e = edge(x);
    const tone = tones[i % tones.length];
    ctx.lineWidth = 1 + o * 0.6;
    ctx.strokeStyle = rgba(tone, (0.16 + face * 0.5 + lit * 0.25) * e * (1 - o * 0.6));
    ctx.beginPath();
    ctx.moveTo(x, ya);
    ctx.lineTo(x, yb);
    ctx.stroke();
    if (o > 0.03) {
      ctx.strokeStyle = rgba(pal.gold, o * 0.95 * e);
      ctx.beginPath();
      ctx.moveTo(x, ya);
      ctx.lineTo(x, yb);
      ctx.stroke();
    }
  }

  strand(0, true);
  strand(1, true);

  // the beads where rung meets strand: larger on the near side
  for (let i = 0; i <= count; i++) {
    const x = first + i * pitch;
    const th = theta(x);
    const o = open(x);
    const amp = A * (1 + o * 0.1);
    const e = edge(x);
    for (let k = 0; k < 2; k++) {
      const a = th + k * Math.PI;
      const nearness = (Math.sin(a) + 1) / 2;
      const tone = o > 0.4 ? pal.gold : tones[i % tones.length];
      ctx.fillStyle = rgba(pal.surface, e);
      ctx.beginPath();
      ctx.arc(x, cy + amp * Math.cos(a), 1.6 + nearness * 1.7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(tone, (0.35 + nearness * 0.65) * e);
      ctx.fill();
    }
  }
};

export function InstrumentHelix({ ratio = 3.8 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
