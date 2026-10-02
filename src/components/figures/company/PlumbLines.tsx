"use client";

import { Figure, TAU, clamp, rgba, type FigureDraw } from "@/components/figures/Figure";

/**
 * Five plumb lines hanging from one beam, numbered I to V like the five
 * commitments beside them. A plumb line is a standard: whatever disturbs it,
 * it comes back to true. Each cord has its own length, so each settles at its
 * own pace, and the mark under it lights when it hangs true again.
 *
 * Pointer: it pushes the cords it passes aside, like a hand through them.
 * When it leaves they swing, slow and settle back on their marks.
 */

const NUMERALS = ["I", "II", "III", "IV", "V"] as const;
const LENGTH = [0.8, 0.93, 1, 0.88, 0.74] as const;

type Swing = { a: number[]; v: number[] };
const swings = new WeakMap<CanvasRenderingContext2D, Swing>();

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, dt, hover, mx, my, pal, still } = f;
  let s = swings.get(ctx);
  if (!s) {
    s = { a: [0.1, -0.06, 0.04, -0.08, 0.12], v: [0, 0, 0, 0, 0] };
    swings.set(ctx, s);
  }

  const pad = 21;
  const beamY = 30;
  const baseY = h - 16;
  const full = baseY - beamY - 27;
  const span = w - pad * 2;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the beam the cords hang from, and the datum line under them
  ctx.strokeStyle = rgba(pal.ink, 0.55);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, beamY);
  ctx.lineTo(w - pad, beamY);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.ink, 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, baseY);
  ctx.lineTo(w - pad, baseY);
  ctx.stroke();

  ctx.font = `600 10px ${pal.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  for (let i = 0; i < 5; i++) {
    const x0 = pad + span * (0.1 + 0.2 * i);
    const len = full * LENGTH[i];

    if (still) {
      s.a[i] = 0;
      s.v[i] = 0;
    } else if (dt > 0) {
      // a pendulum: gravity, a little friction, a breath of air, and the pointer's push
      const g = 46 / Math.sqrt(LENGTH[i]);
      let push = 0;
      if (hover > 0.01) {
        const along = clamp((my - beamY) / len, 0.15, 1);
        const cordX = x0 + Math.sin(s.a[i]) * len * along;
        const d = cordX - mx;
        const reach = 46;
        if (Math.abs(d) < reach) push = (d >= 0 ? 1 : -1) * (1 - Math.abs(d) / reach) * 110 * hover;
      }
      const air = Math.sin(t * 0.7 + i * 1.9) * 0.5;
      const acc = -g * Math.sin(s.a[i]) - 1.5 * s.v[i] + push + air;
      s.v[i] += acc * dt;
      s.a[i] = clamp(s.a[i] + s.v[i] * dt, -0.6, 0.6);
    }

    const a = s.a[i];
    const bx = x0 + Math.sin(a) * len;
    const by = beamY + Math.cos(a) * len;
    const isTrue = 1 - clamp(Math.abs(a) / 0.035);

    // the true vertical, dotted, and its mark on the datum line
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = rgba(pal.ink, 0.32);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, beamY + 4);
    ctx.lineTo(x0, baseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(pal.ink, 0.4);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(x0, baseY - 5);
    ctx.lineTo(x0, baseY + 5);
    ctx.stroke();
    if (isTrue > 0.01) {
      ctx.strokeStyle = rgba(pal.gold, isTrue);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0 - 9, baseY);
      ctx.lineTo(x0 + 9, baseY);
      ctx.moveTo(x0, baseY - 5);
      ctx.lineTo(x0, baseY + 5);
      ctx.stroke();
    }

    // numeral and pivot
    ctx.fillStyle = rgba(pal.ink3, 1);
    ctx.fillText(NUMERALS[i], x0, beamY - 10);
    ctx.fillStyle = rgba(pal.ink, 0.7);
    ctx.beginPath();
    ctx.arc(x0, beamY, 2, 0, TAU);
    ctx.fill();

    // the cord
    ctx.strokeStyle = rgba(pal.ink, 0.8);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(x0, beamY);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // the bob: a turned weight with its point down, drawn along the cord
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-a);
    ctx.beginPath();
    ctx.moveTo(-6.5, 0);
    ctx.lineTo(6.5, 0);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(0, 21);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.fillStyle = rgba(pal.gold, 0.35 + 0.65 * isTrue);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink, 0.8);
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.restore();
  }

  // the pointer carries a little light
  if (hover > 0.01) {
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, 55);
    g.addColorStop(0, rgba(pal.accent, 0.12 * hover));
    g.addColorStop(1, rgba(pal.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(mx - 55, my - 55, 110, 110);
  }
};

export function PlumbLines() {
  return <Figure draw={draw} ratio={2.4} />;
}
