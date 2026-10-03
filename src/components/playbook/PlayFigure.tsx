"use client";

import { useRef } from "react";
import { Figure, clamp, rgba, smooth, type Colour, type FigureDraw } from "@/components/figures/Figure";
import type { Play } from "@/data/playbook";

/**
 * The picture on a Playbook page: the entry's candles, drawn one after
 * another, with the ones that make the pattern (or the moment) ringed and
 * held for a while before the drawing begins again. One named level may cross
 * it. Under reduced motion the whole picture is shown at once.
 *
 * The candles are invented to show a shape. They are not a market.
 */
const RED: Colour = [200, 84, 76, 1];

export function PlayFigure({ play }: { play: Pick<Play, "candles" | "mark" | "level"> }) {
  const ref = useRef<FigureDraw | null>(null);
  if (!ref.current) {
    const { candles, mark, level } = play;
    const n = candles.length;
    const lo = Math.min(...candles.map((c) => c[2]), level?.at ?? 100) - 6;
    const hi = Math.max(...candles.map((c) => c[1]), level?.at ?? 0) + 6;
    const per = 0.55; // seconds a candle takes to be drawn
    const loop = n * per + 3.2;
    ref.current = ({ ctx, w, h, t, pal, still }) => {
      if (w < 120 || h < 90) return;
      const light = pal.ink[0] < 128;
      const green: Colour = light ? [8, 118, 60, 1] : pal.emerald;
      const u = still ? loop : t % loop;
      const padL = 14;
      const padR = level ? 14 : 14;
      const x0 = padL;
      const x1 = w - padR;
      const top = 16;
      const bot = h - 18;
      const Y = (v: number) => bot - ((v - lo) / (hi - lo)) * (bot - top);
      const slot = (x1 - x0) / n;
      const bw = Math.min(slot * 0.56, 34);

      // a quiet grid
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        ctx.strokeStyle = rgba(pal.ink3, 0.16);
        ctx.beginPath();
        ctx.moveTo(x0, top + ((bot - top) * i) / 4);
        ctx.lineTo(x1, top + ((bot - top) * i) / 4);
        ctx.stroke();
      }
      if (level) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = rgba(pal.ink2, 0.9);
        ctx.beginPath();
        ctx.moveTo(x0, Y(level.at));
        ctx.lineTo(x1, Y(level.at));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `600 ${w < 340 ? 9 : 11}px ${pal.font}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = rgba(pal.ink2, 1);
        ctx.fillText(level.label.toUpperCase(), x0 + 2, Y(level.at) - 4);
      }

      const held = smooth((u - n * per) / 0.5); // all drawn: the pattern is ringed
      candles.forEach((c, i) => {
        const q = still ? 1 : clamp((u - i * per) / per);
        if (q <= 0) return;
        const [o, hh, ll, cl] = c;
        const x = x0 + slot * (i + 0.5);
        const rising = cl >= o;
        const tone = rising ? green : RED;
        const isMark = mark.includes(i);
        const dim = held > 0 && !isMark ? 1 - held * 0.55 : 1;
        // the candle grows from its open: first the body to the close, with the wicks reaching out as it goes
        const close = o + (cl - o) * smooth(q);
        const high = Math.max(o, close) + (hh - Math.max(o, cl)) * smooth(q * 1.4);
        const low = Math.min(o, close) - (Math.min(o, cl) - ll) * smooth(q * 1.4);
        ctx.strokeStyle = rgba(tone, dim);
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(x, Y(high));
        ctx.lineTo(x, Y(low));
        ctx.stroke();
        const yb = Math.min(Y(o), Y(close));
        const hb = Math.max(2, Math.abs(Y(o) - Y(close)));
        ctx.fillStyle = rgba(tone, dim);
        ctx.fillRect(x - bw / 2, yb, bw, hb);
      });

      // the ring round what the page is about
      if (held > 0 && mark.length) {
        const xs = mark.map((i) => x0 + slot * (i + 0.5));
        const hiM = Math.max(...mark.map((i) => candles[i][1]));
        const loM = Math.min(...mark.map((i) => candles[i][2]));
        const rx = Math.min(...xs) - bw / 2 - 8;
        const rw = Math.max(...xs) + bw / 2 + 8 - rx;
        const ry = Y(hiM) - 8;
        const rh = Y(loM) + 8 - ry;
        const pulse = still ? 1 : 0.7 + 0.3 * Math.sin(t * 3);
        ctx.strokeStyle = rgba(pal.accent, held * pulse);
        ctx.lineWidth = 1.7;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, 6);
        else ctx.rect(rx, ry, rw, rh);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = rgba(pal.accent, 0.07 * held);
        ctx.fill();
      }
    };
  }
  return <Figure draw={ref.current} ratio={1.5} />;
}
