"use client";

import { clamp, rgba, smooth } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { approach, label, names, num, seg, textSize, unit, type Spec } from "./kit";

/**
 * Magnitudes side by side. The bars rise in order to the relative heights the
 * lesson gives. One bar is chosen; a level is ruled across from its top, and
 * every other bar shows how far it stands above that level (hatched) or falls
 * short of it (a dashed outline).
 *
 * The value is the chosen bar.
 */

const X0 = 0.08;
const X1 = 0.92;

export function Bars({ spec }: { spec: Spec<"bars"> }) {
  const bars = names(spec.labels, 2, 5, ["One", "Another"]);
  const n = bars.length;
  const sizes = bars.map((_, i) => num(Array.isArray(spec.sizes) ? spec.sizes[i] : undefined, 1, 10, 5));
  const tallest = Math.max(...sizes);
  const smallest = Math.min(...sizes);
  // the loop starts at the tallest bar and goes on from there
  const first = sizes.indexOf(tallest);

  const draw: DiagramDraw = ({ ctx, w, h, t, dt, pal, still }, v, mem) => {
    const k = unit(w);
    const x0 = w * X0;
    const x1 = w * X1;
    const slot = (x1 - x0) / n;
    const bw = Math.min(slot * 0.52, 70);
    const alternate = n >= 4 || slot < 130;
    const base = h * (alternate ? 0.72 : 0.78);
    const top = h * 0.1;
    const size = textSize(w);
    const chosen = clamp(Math.round(v), 0, n - 1);
    // heights are relative: the tallest bar fills the frame
    const H = (i: number) => (base - top) * (sizes[i] / tallest) * (still ? 1 : smooth((t - 0.15 - i * 0.22) / 0.9));
    const lineY = base - (base - top) * (sizes[chosen] / tallest);
    mem.y = still || mem.y === undefined ? lineY : approach(mem.y, lineY, dt, 9);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = rgba(pal.ink3, 0.6);
    ctx.lineWidth = 1;
    seg(ctx, x0, base, x1, base);

    for (let i = 0; i < n; i++) {
      const x = x0 + slot * (i + 0.5) - bw / 2;
      const bh = H(i);
      const y = base - bh;
      const here = i === chosen;
      ctx.fillStyle = here ? rgba(pal.accent, 0.24) : rgba(pal.surface, 1);
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = here ? rgba(pal.accent, 1) : rgba(pal.ink, 0.8);
      ctx.lineWidth = here ? 2 : 1.25;
      ctx.strokeRect(x, y, bw, bh);
      if (!here && bh > 2) {
        if (y < mem.y - 1.5) {
          // what stands above the chosen bar's level
          const eh = Math.min(bh, mem.y - y);
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, bw, eh);
          ctx.clip();
          ctx.strokeStyle = rgba(pal.gold, 0.9);
          ctx.lineWidth = 1;
          for (let d = -eh; d < bw; d += 6) seg(ctx, x + d, y + eh, x + d + eh, y);
          ctx.restore();
        } else if (y > mem.y + 1.5) {
          // what it falls short by
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = rgba(pal.ink3, 0.9);
          ctx.lineWidth = 1;
          ctx.strokeRect(x, mem.y, bw, y - mem.y);
          ctx.setLineDash([]);
        }
      }
      const up = alternate && i % 2 === 1;
      label(ctx, pal, bars[i], x + bw / 2, base + (up ? 31 * k + 4 : 14 * k + 2), {
        size,
        weight: here ? 700 : 500,
        colour: here ? pal.ink : pal.ink2,
        maxW: (alternate ? slot * 2 : slot) - 10,
        within: w,
      });
      if (up) {
        ctx.strokeStyle = rgba(pal.ink3, 0.45);
        ctx.lineWidth = 1;
        seg(ctx, x + bw / 2, base + 4, x + bw / 2, base + 31 * k - 6);
      }
    }

    // the level of the chosen bar, ruled across the others
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = rgba(pal.accent, 0.95);
    ctx.lineWidth = 1.25;
    seg(ctx, x0, mem.y, x1, mem.y);
    ctx.setLineDash([]);
  };

  return (
    <DiagramShell
      ratio={1.85}
      draw={draw}
      auto={(t) => (first + Math.floor(Math.max(0, t - 2.2) / 2.4)) % n}
      rest={first}
      min={0}
      max={n - 1}
      step={1}
      snap
      control="Choose a bar to measure from"
      fromPointer={(fx) => clamp(Math.floor(((fx - X0) / (X1 - X0)) * n), 0, n - 1)}
      describe={(v) => {
        const i = clamp(Math.round(v), 0, n - 1);
        const s = sizes[i];
        const rank = tallest === smallest ? "the same as the others" : s === tallest ? "the largest here" : s === smallest ? "the smallest here" : "between the largest and the smallest";
        return `${bars[i]}: ${rank}`;
      }}
    />
  );
}
