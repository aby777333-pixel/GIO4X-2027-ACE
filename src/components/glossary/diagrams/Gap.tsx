"use client";

import { lerp, rgba } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { disc, head, label, names, seg, textSize, unit, type Spec } from "./kit";

/**
 * Two prices and the distance between them. Two lines wander together across
 * the frame, one always above the other; the space between them is shaded and
 * measured by an arrow that carries the name of the gap. The gap breathes:
 * narrower, wider, narrower.
 *
 * The value is the width of the gap.
 */

const STEPS = 48;

export function Gap({ spec }: { spec: Spec<"gap"> }) {
  const [upper, lower, gap] = names(spec.labels, 3, 3, ["Higher price", "Lower price", "The gap"]);

  const draw: DiagramDraw = ({ ctx, w, h, t, pal, still }, v) => {
    const k = unit(w);
    const x0 = w * 0.06;
    const x1 = w * 0.94;
    const size = textSize(w);
    const half = lerp(h * 0.05, h * 0.24, v);
    const time = still ? 1.2 : t;
    const mid = (x: number) => h * 0.5 + h * 0.06 * Math.sin(x * 0.011 - time * 0.55) + h * 0.025 * Math.sin(x * 0.029 + time * 0.35);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // the space between the two prices
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const x = lerp(x0, x1, i / STEPS);
      if (i) ctx.lineTo(x, mid(x) - half);
      else ctx.moveTo(x, mid(x) - half);
    }
    for (let i = STEPS; i >= 0; i--) {
      const x = lerp(x0, x1, i / STEPS);
      ctx.lineTo(x, mid(x) + half);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(pal.accent, 0.1);
    ctx.fill();

    // the two prices
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= STEPS; i++) {
        const x = lerp(x0, x1, i / STEPS);
        if (i) ctx.lineTo(x, mid(x) + side * half);
        else ctx.moveTo(x, mid(x) + side * half);
      }
      ctx.strokeStyle = rgba(pal.ink, 0.9);
      ctx.lineWidth = 1.75;
      ctx.stroke();
      disc(ctx, x1, mid(x1) + side * half, 3.5 * k, rgba(pal.surface, 1), rgba(pal.ink, 0.9));
    }
    label(ctx, pal, upper, x0, mid(x0) - half - 13 * k - 3, { align: "left", size, colour: pal.ink, maxW: w * 0.44 });
    label(ctx, pal, lower, x0, mid(x0) + half + 13 * k + 3, { align: "left", size, colour: pal.ink, maxW: w * 0.44 });

    // the measure of the gap, and its name
    const ax = w * 0.6;
    const ay = mid(ax);
    ctx.strokeStyle = rgba(pal.accent, 1);
    ctx.lineWidth = 1.75;
    seg(ctx, ax, ay - half + 2, ax, ay + half - 2);
    if (half > 9) {
      head(ctx, ax, ay - half + 2, -Math.PI / 2, 5.5);
      head(ctx, ax, ay + half - 2, Math.PI / 2, 5.5);
    }
    label(ctx, pal, gap, ax + 11, ay, { align: "left", size, weight: 700, colour: pal.accent, tag: true, maxW: w * 0.34 - 16, within: w });
  };

  return (
    <DiagramShell
      draw={draw}
      auto={(t) => 0.52 + 0.4 * Math.sin(t * 0.6 - 0.4)}
      rest={0.6}
      ratio={2.2}
      control="Narrow or widen the gap"
      describe={(v) => (v < 0.34 ? `${gap}: narrow, ${upper} and ${lower} are close` : v > 0.67 ? `${gap}: wide, ${upper} and ${lower} are far apart` : `${gap}: the distance between ${upper} and ${lower}`)}
    />
  );
}
