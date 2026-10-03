"use client";

import { useRef } from "react";
import { Figure, TAU, clamp, lerp, rgba, smooth, type Colour, type FigureDraw } from "@/components/figures/Figure";
import type { NeedKind } from "@/data/nice-and-need";

/**
 * A small moving picture for each shelf of the Nice & Need page, to say what
 * kind of thing is on it:
 *
 *   learn   a book whose pages turn and fill with lines
 *   data    a series that grows, bar by bar, with its trend drawn over it
 *   banks   a bank's front, and the dial of its rate stepping up and down
 *   charts  candles passing, with a cursor reading them
 *   safe    a shield, a sweep that looks round it, and a tick
 *
 * Pictures of kinds of thing. No figure in them is a figure.
 */
const RED: Colour = [200, 84, 76, 1];

const DRAW: Record<NeedKind, FigureDraw> = {
  learn: ({ ctx, w, h, t, pal, still }) => {
    const cx = w / 2;
    const cy = h * 0.54;
    const pw = Math.min(w * 0.3, 150);
    const ph = pw * 1.24;
    const turn = still ? 0.5 : (t * 0.35) % 1;
    const page = (side: number, fill: number) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - ph / 2);
      ctx.quadraticCurveTo(cx + side * pw * 0.5, cy - ph / 2 - 10, cx + side * pw, cy - ph / 2 + 4);
      ctx.lineTo(cx + side * pw, cy + ph / 2 + 4);
      ctx.quadraticCurveTo(cx + side * pw * 0.5, cy + ph / 2 - 10, cx, cy + ph / 2);
      ctx.closePath();
      ctx.fillStyle = rgba(pal.surface, 1);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.ink2, 0.9);
      ctx.lineWidth = 1.7;
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const done = clamp(fill * 7 - i);
        if (done <= 0) continue;
        const y = cy - ph * 0.34 + i * ph * 0.1;
        const x0 = cx + side * pw * 0.12;
        const x1 = cx + side * pw * (0.12 + 0.72 * done * (i % 3 === 2 ? 0.6 : 1));
        ctx.strokeStyle = rgba(i === 0 ? pal.accent : pal.ink3, 0.95);
        ctx.lineWidth = i === 0 ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
      }
    };
    page(-1, 1);
    page(1, still ? 1 : clamp(turn / 0.6));
    // the leaf being turned
    if (!still && turn > 0.62) {
      const q = smooth((turn - 0.62) / 0.38);
      const reach = Math.cos(q * Math.PI) * pw;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ph / 2);
      ctx.quadraticCurveTo(cx + reach * 0.5, cy - ph / 2 - 10 - Math.sin(q * Math.PI) * 26, cx + reach, cy - ph / 2 + 4 - Math.sin(q * Math.PI) * 18);
      ctx.lineTo(cx + reach, cy + ph / 2 + 4 - Math.sin(q * Math.PI) * 18);
      ctx.quadraticCurveTo(cx + reach * 0.5, cy + ph / 2 - 10, cx, cy + ph / 2);
      ctx.closePath();
      ctx.fillStyle = rgba(pal.surface, 1);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.accent, 0.95);
      ctx.lineWidth = 1.7;
      ctx.stroke();
    }
  },
  data: ({ ctx, w, h, t, pal, still }) => {
    const n = 16;
    const x0 = w * 0.1;
    const x1 = w * 0.9;
    const base = h * 0.82;
    const grown = still ? n : ((t * 2.2) % (n + 6));
    const val = (i: number) => 0.25 + 0.5 * (i / n) + 0.14 * Math.sin(i * 1.7) + 0.08 * Math.sin(i * 0.6 + 1);
    ctx.strokeStyle = rgba(pal.ink3, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, base + 0.5);
    ctx.lineTo(x1, base + 0.5);
    ctx.stroke();
    const bw = ((x1 - x0) / n) * 0.62;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const q = clamp(grown - i);
      if (q <= 0) break;
      const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
      const bh = h * 0.62 * val(i) * smooth(q);
      ctx.fillStyle = rgba(pal.accent, 0.3 + 0.5 * (i / n));
      ctx.fillRect(x - bw / 2, base - bh, bw, bh);
      if (i === 0) ctx.moveTo(x, base - bh - 8);
      else ctx.lineTo(x, base - bh - 8);
    }
    ctx.strokeStyle = rgba(pal.ink, 0.9);
    ctx.lineWidth = 1.7;
    ctx.lineJoin = "round";
    ctx.stroke();
  },
  banks: ({ ctx, w, h, t, pal, still }) => {
    const cx = w * 0.36;
    const base = h * 0.82;
    const bw = Math.min(w * 0.4, 200);
    const bh = bw * 0.62;
    ctx.strokeStyle = rgba(pal.ink2, 0.95);
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2 - 8, base - bh);
    ctx.lineTo(cx, base - bh - bw * 0.22);
    ctx.lineTo(cx + bw / 2 + 8, base - bh);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.accent, 0.12);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const x = cx - bw / 2 + (bw * (i + 0.5)) / 5;
      ctx.strokeRect(x - bw * 0.035, base - bh + 6, bw * 0.07, bh - 12);
    }
    ctx.strokeRect(cx - bw / 2 - 8, base - 6, bw + 16, 6);
    // the dial of the rate: it holds, then steps
    const dx = w * 0.74;
    const dy = h * 0.52;
    const r = Math.min(w * 0.13, h * 0.28);
    const steps = [0.3, 0.3, 0.45, 0.6, 0.6, 0.5, 0.35];
    const beat = still ? 3.4 : t * 0.5;
    const i = Math.floor(beat) % steps.length;
    const v = lerp(steps[i], steps[(i + 1) % steps.length], smooth((beat - Math.floor(beat) - 0.6) / 0.4));
    ctx.beginPath();
    ctx.arc(dx, dy, r, Math.PI * 0.8, Math.PI * 2.2);
    ctx.strokeStyle = rgba(pal.ink3, 0.6);
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dx, dy, r, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * v));
    ctx.strokeStyle = rgba(pal.accent, 1);
    ctx.stroke();
    const a = Math.PI * (0.8 + 1.4 * v);
    ctx.strokeStyle = rgba(pal.ink, 1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx + Math.cos(a) * r * 0.82, dy + Math.sin(a) * r * 0.82);
    ctx.stroke();
    ctx.fillStyle = rgba(pal.ink, 1);
    ctx.beginPath();
    ctx.arc(dx, dy, 3.5, 0, TAU);
    ctx.fill();
  },
  charts: ({ ctx, w, h, t, pal, still }) => {
    const light = pal.ink[0] < 128;
    const green: Colour = light ? [8, 118, 60, 1] : pal.emerald;
    const n = 14;
    const slot = (w * 0.86) / n;
    const shift = still ? 0 : (t * 0.6) % 1;
    const k = still ? 3 : Math.floor(t * 0.6);
    const price = (i: number) => 0.5 + 0.22 * Math.sin(i * 0.5) + 0.12 * Math.sin(i * 1.3 + 2);
    const Y = (v: number) => h * 0.86 - v * h * 0.7;
    let cursor = { x: 0, y: 0 };
    for (let j = 0; j <= n; j++) {
      const i = k + j;
      const x = w * 0.07 + (j - shift + 0.5) * slot;
      if (x < w * 0.05 || x > w * 0.95) continue;
      const o = price(i);
      const c = price(i + 1);
      const hi = Math.max(o, c) + 0.04 + 0.03 * Math.abs(Math.sin(i * 2.1));
      const lo = Math.min(o, c) - 0.04 - 0.03 * Math.abs(Math.cos(i * 1.7));
      const tone = c >= o ? green : RED;
      ctx.strokeStyle = rgba(tone, 1);
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(x, Y(hi));
      ctx.lineTo(x, Y(lo));
      ctx.stroke();
      ctx.fillStyle = rgba(tone, 1);
      ctx.fillRect(x - slot * 0.28, Math.min(Y(o), Y(c)), slot * 0.56, Math.max(2, Math.abs(Y(o) - Y(c))));
      if (j === n - 4) cursor = { x, y: Y(c) };
    }
    // the cursor that reads them
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = rgba(pal.ink2, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cursor.x, h * 0.08);
    ctx.lineTo(cursor.x, h * 0.92);
    ctx.moveTo(w * 0.05, cursor.y);
    ctx.lineTo(w * 0.95, cursor.y);
    ctx.stroke();
    ctx.setLineDash([]);
  },
  safe: ({ ctx, w, h, t, pal, still }) => {
    const cx = w / 2;
    const cy = h * 0.5;
    const s = Math.min(w * 0.2, h * 0.34);
    // the sweep
    const a = still ? 1 : t * 1.2;
    for (let i = 1; i <= 3; i++) {
      ctx.strokeStyle = rgba(pal.ink3, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, s * (0.9 + i * 0.45), 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, s * 2.25, a - 0.5, a);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.accent, 0.14);
    ctx.fill();
    // the shield
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.82, cy - s * 0.66);
    ctx.quadraticCurveTo(cx + s * 0.86, cy + s * 0.5, cx, cy + s * 1.1);
    ctx.quadraticCurveTo(cx - s * 0.86, cy + s * 0.5, cx - s * 0.82, cy - s * 0.66);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.fillStyle = rgba(pal.accent, 0.14);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.accent, 1);
    ctx.lineWidth = 2;
    ctx.stroke();
    // the tick, drawn again each turn
    const q = still ? 1 : clamp(((t * 1.2) % TAU) / 2.2);
    ctx.strokeStyle = rgba(pal.ink, 1);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.36, cy + s * 0.04);
    ctx.lineTo(cx - s * 0.36 + s * 0.26 * Math.min(1, q * 2), cy + s * 0.04 + s * 0.26 * Math.min(1, q * 2));
    if (q > 0.5) ctx.lineTo(cx - s * 0.1 + s * 0.5 * (q * 2 - 1), cy + s * 0.3 - s * 0.62 * (q * 2 - 1));
    ctx.stroke();
  },
};

export function NeedFigure({ kind }: { kind: NeedKind }) {
  const ref = useRef<FigureDraw>(DRAW[kind]);
  return <Figure draw={ref.current} ratio={1.7} />;
}
