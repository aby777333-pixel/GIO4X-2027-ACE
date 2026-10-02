"use client";

import { clamp, lerp, rgba } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { box, disc, label, names, seg, textSize, unit, type Spec } from "./kit";

/**
 * One centre joined to several others. The centre sits in the middle; the
 * others stand in a row above it and a row below, each tied to it by a line.
 * One tie at a time is taken up: it thickens, a point runs along it between
 * the two, and the far end is named in full weight.
 *
 * The value is which tie is taken up.
 */

/** where each of the others stands, as fractions of the frame: half of them above the centre, half below */
function places(n: number): { x: number; y: number; top: boolean }[] {
  const upper = Math.ceil(n / 2);
  const lower = n - upper;
  const out: { x: number; y: number; top: boolean }[] = [];
  for (let i = 0; i < upper; i++) out.push({ x: (i + 0.5) / upper, y: 0.2, top: true });
  // the lower row runs right to left, so the ties are taken up going round
  for (let i = lower - 1; i >= 0; i--) out.push({ x: (i + 0.5) / lower, y: 0.8, top: false });
  return out;
}

export function Hub({ spec }: { spec: Spec<"hub"> }) {
  const all = names(spec.labels, 3, 7, ["Centre", "One", "Another"]);
  const centre = all[0];
  const others = all.slice(1);
  const n = others.length;
  const at = places(n);

  const draw: DiagramDraw = ({ ctx, w, h, t, pal, still }, v) => {
    const k = unit(w);
    const cx = w / 2;
    const cy = h / 2;
    const size = textSize(w);
    const chosen = clamp(Math.round(v), 0, n - 1);
    const pad = w * 0.04;
    const X = (fx: number) => lerp(pad, w - pad, fx);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // the ties
    for (let i = 0; i < n; i++) {
      const here = i === chosen;
      ctx.strokeStyle = here ? rgba(pal.accent, 1) : rgba(pal.ink3, 0.6);
      ctx.lineWidth = here ? 2.25 : 1;
      seg(ctx, cx, cy, X(at[i].x), at[i].y * h);
    }
    // a point runs out along the chosen tie and back
    const c = at[chosen];
    const run = still ? 0.55 : 0.5 - 0.5 * Math.cos(t * 2.1);
    disc(ctx, lerp(cx, X(c.x), run), lerp(cy, c.y * h, run), 4.5 * k, rgba(pal.gold, 1), rgba(pal.ink, 0.9));

    // the others
    const slot = (w - pad * 2) / Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const here = i === chosen;
      const x = X(at[i].x);
      const y = at[i].y * h;
      disc(ctx, x, y, 7 * k, here ? rgba(pal.accent, 0.25) : rgba(pal.surface, 1), here ? rgba(pal.accent, 1) : rgba(pal.ink2, 0.85), here ? 2 : 1.25);
      label(ctx, pal, others[i], x, y + (at[i].top ? -1 : 1) * (7 * k + 12), {
        size,
        weight: here ? 700 : 500,
        colour: here ? pal.ink : pal.ink2,
        maxW: slot - 10,
        within: w,
      });
    }

    // the centre, on a plate so the ties end at its edge
    ctx.font = `700 ${size + 1}px ${pal.font}`;
    const cw = Math.min(w * 0.5, ctx.measureText(centre).width + 30);
    const ch = 30 * k + 4;
    box(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 5);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink, 0.9);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    label(ctx, pal, centre, cx, cy, { size: size + 1, weight: 700, colour: pal.ink, maxW: cw - 16 });
  };

  return (
    <DiagramShell
      ratio={1.9}
      draw={draw}
      auto={(t) => Math.floor(t / 2.4) % n}
      rest={0}
      min={0}
      max={n - 1}
      step={1}
      snap
      control="Follow one link at a time"
      fromPointer={(fx, fy) => {
        // the one nearest the pointer
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < n; i++) {
          const d = Math.hypot(fx - (0.04 + 0.92 * at[i].x), (fy - at[i].y) * 0.6);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        return best;
      }}
      describe={(v) => `${centre} and ${others[clamp(Math.round(v), 0, n - 1)]}`}
    />
  );
}
