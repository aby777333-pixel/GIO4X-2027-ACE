"use client";

import { TAU, clamp, lerp, rgba, smooth } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { disc, head, label, names, seg, textSize, unit, type Spec } from "./kit";

/**
 * One thing passing through stages, left to right: stations on a track and a
 * token that travels along it, resting at each. What it has passed stays lit,
 * the stage it is at is named in full weight, what is ahead is faint.
 *
 * The value is the token's place along the track.
 */

const X0 = 0.12;
const X1 = 0.88;

export function Flow({ spec }: { spec: Spec<"flow"> }) {
  const stages = names(spec.labels, 2, 5, ["Start", "End"]);
  const n = stages.length;
  const hops = n - 1;

  const auto = (t: number) => {
    const u = t % (hops * 1.7 + 2.4);
    const at = Math.floor((u - 0.7) / 1.7);
    if (u < 0.7) return 0;
    if (at >= hops) return 1;
    return (at + smooth((u - 0.7 - at * 1.7) / 1.0)) / hops;
  };

  const draw: DiagramDraw = ({ ctx, w, h, t, pal, still }, v) => {
    const k = unit(w);
    const y = h * 0.5;
    const x0 = w * X0;
    const x1 = w * X1;
    const gap = (x1 - x0) / hops;
    const pos = clamp(v) * hops;
    const active = Math.round(pos);
    const tx = lerp(x0, x1, clamp(v));
    const r = 9 * k;
    const size = textSize(w);
    // names alternate above and below the track when they would otherwise collide
    const alternate = n >= 4 || gap < 150;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // the track: all of it faint, the part travelled in the accent
    ctx.strokeStyle = rgba(pal.ink3, 0.45);
    ctx.lineWidth = 1;
    seg(ctx, x0, y, x1, y);
    ctx.strokeStyle = rgba(pal.accent, 0.95);
    ctx.lineWidth = 2.5;
    seg(ctx, x0, y, tx, y);

    // direction, between each pair of stations
    for (let i = 0; i < hops; i++) {
      const mx = x0 + gap * (i + 0.5);
      const passed = pos >= i + 0.5;
      ctx.strokeStyle = passed ? rgba(pal.accent, 1) : rgba(pal.ink3, 0.8);
      ctx.lineWidth = passed ? 2 : 1.25;
      head(ctx, mx + 4, y, 0, 7 * k);
    }

    for (let i = 0; i < n; i++) {
      const x = x0 + gap * i;
      const reached = pos >= i - 0.02;
      const here = i === active && Math.abs(pos - i) < 0.3;
      if (here && !still) {
        const p = (t * 0.7) % 1;
        ctx.beginPath();
        ctx.arc(x, y, r + 3 + 9 * p, 0, TAU);
        ctx.strokeStyle = rgba(pal.accent, 0.5 * (1 - p));
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      disc(ctx, x, y, r, rgba(pal.surface, 1));
      disc(ctx, x, y, r, reached ? rgba(pal.accent, 0.2) : rgba(pal.surface, 1), reached ? rgba(pal.accent, 1) : rgba(pal.ink3, 0.8), reached ? 2 : 1.25);
      const up = alternate && i % 2 === 1;
      const ly = up ? y - r - 15 * k - 4 : y + r + 15 * k + 4;
      // a short tie from the station to its name
      ctx.strokeStyle = rgba(pal.ink3, 0.45);
      ctx.lineWidth = 1;
      seg(ctx, x, up ? y - r - 3 : y + r + 3, x, up ? ly + 9 : ly - 9);
      label(ctx, pal, stages[i], x, ly, {
        size,
        weight: here ? 700 : 500,
        colour: here ? pal.ink : reached ? pal.ink2 : pal.ink3,
        maxW: (alternate ? gap * 2 : gap) - 10,
        within: w,
      });
    }

    // the thing that passes through
    disc(ctx, tx, y, 5.5 * k, rgba(pal.gold, 1), rgba(pal.ink, 0.9));
  };

  return (
    <DiagramShell
      ratio={2.4}
      draw={draw}
      auto={auto}
      rest={Math.ceil(hops / 2) / hops}
      control="Step through the stages"
      fromPointer={(fx) => clamp((fx - X0) / (X1 - X0))}
      describe={(v) => {
        const i = Math.round(clamp(v) * hops);
        return `Stage ${i + 1} of ${n}: ${stages[i]}`;
      }}
    />
  );
}
