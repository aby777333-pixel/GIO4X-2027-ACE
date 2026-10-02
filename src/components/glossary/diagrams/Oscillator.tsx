"use client";

import { TAU, clamp, lerp, rgba } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { approach, disc, label, names, seg, textSize, timeline, unit, type Spec } from "./kit";

/**
 * An oscillator moving between extremes. A line swings about a middle rule,
 * inside a frame with a zone along the top and a zone along the bottom. Most
 * of the time it is between them; when it enters a zone, the zone fills, its
 * name takes full weight and the stretch of line inside it thickens.
 *
 * The value is how far along the line has been drawn.
 */

const N = 140;
const X0 = 0.07;
const X1 = 0.93;
const EDGE = 0.58;

/** the reading, between -1 and 1, at a place along the line */
const reading = (u: number) => 0.8 * Math.sin(TAU * 1.75 * u - 0.6) + 0.19 * Math.sin(TAU * 4.3 * u + 1);

export function Oscillator({ spec }: { spec: Spec<"oscillator"> }) {
  const [upper, lower] = names(spec.labels, 2, 2, ["Upper zone", "Lower zone"]);

  const draw: DiagramDraw = ({ ctx, w, h, dt, pal, still }, v, mem) => {
    const k = unit(w);
    const x0 = w * X0;
    const x1 = w * X1;
    const mid = h * 0.5;
    const amp = h * 0.33;
    const size = textSize(w);
    const X = (u: number) => lerp(x0, x1, u);
    const Y = (r: number) => mid - r * amp;
    const top = Y(1.04);
    const bottom = Y(-1.04);
    const now = reading(clamp(v));
    const inUp = now > EDGE;
    const inDown = now < -EDGE;
    mem.up = still || mem.up === undefined ? (inUp ? 1 : 0) : approach(mem.up, inUp ? 1 : 0, dt, 8);
    mem.down = still || mem.down === undefined ? (inDown ? 1 : 0) : approach(mem.down, inDown ? 1 : 0, dt, 8);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // the two zones
    const zone = (y0: number, y1: number, name: string, on: number, above: boolean) => {
      ctx.fillStyle = rgba(pal.accent, 0.07 + 0.16 * on);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = rgba(pal.ink, 0.5 + 0.4 * on);
      ctx.lineWidth = 1 + on;
      const edge = above ? y1 : y0;
      seg(ctx, x0, edge, x1, edge);
      label(ctx, pal, name, x0, above ? y0 - 10 * k - 3 : y1 + 10 * k + 3, { align: "left", size, weight: on > 0.5 ? 700 : 600, colour: on > 0.5 ? pal.ink : pal.ink2, maxW: w * 0.7 });
    };
    zone(top, Y(EDGE), upper, mem.up, true);
    zone(Y(-EDGE), bottom, lower, mem.down, false);

    // the frame and the middle
    ctx.strokeStyle = rgba(pal.ink3, 0.5);
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, top, x1 - x0, bottom - top);
    ctx.setLineDash([2, 5]);
    seg(ctx, x0, mid, x1, mid);
    ctx.setLineDash([]);

    // the line to come, faint
    ctx.strokeStyle = rgba(pal.ink, 0.15);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      if (i) ctx.lineTo(X(i / N), Y(reading(i / N)));
      else ctx.moveTo(X(0), Y(reading(0)));
    }
    ctx.stroke();

    // the line so far; thicker, and in the accent, wherever it is inside a zone
    const end = clamp(v) * N;
    let prevIn = Math.abs(reading(0)) > EDGE;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(reading(0)));
    const style = (inside: boolean) => {
      ctx.strokeStyle = inside ? rgba(pal.accent, 1) : rgba(pal.ink, 0.9);
      ctx.lineWidth = inside ? 3 : 2;
    };
    for (let i = 1; i <= N && i - 1 < end; i++) {
      const u = Math.min(i, end) / N;
      const r = reading(u);
      const inside = Math.abs(r) > EDGE;
      ctx.lineTo(X(u), Y(r));
      if (inside !== prevIn) {
        style(prevIn);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(X(u), Y(r));
        prevIn = inside;
      }
    }
    style(prevIn);
    ctx.stroke();

    // the reading now
    const px = X(clamp(v));
    ctx.strokeStyle = rgba(pal.ink3, 0.5);
    ctx.lineWidth = 1;
    seg(ctx, px, top, px, bottom);
    disc(ctx, px, Y(now), 4.5 * k, rgba(pal.gold, 1), rgba(pal.ink, 0.9));
  };

  return (
    <DiagramShell
      ratio={1.9}
      draw={draw}
      auto={(t) => timeline(t, 7.5, 2.2)}
      rest={0.765}
      control="Move along the line"
      fromPointer={(fx) => clamp((fx - X0) / (X1 - X0))}
      describe={(v) => {
        const r = reading(clamp(v));
        return r > EDGE ? `In the upper zone: ${upper}` : r < -EDGE ? `In the lower zone: ${lower}` : "Between the two zones";
      }}
    />
  );
}
