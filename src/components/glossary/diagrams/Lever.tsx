"use client";

import { clamp, lerp, rgba } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { disc, head, label, names, seg, textSize, unit, type Spec } from "./kit";

/**
 * A small input producing a large effect. A beam rocks on a fulcrum set near
 * one end. The short arm's end moves a little, always by the same amount; the
 * long arm's end sweeps a large arc. A measure beside each end shows how far
 * it travels, and the two measures are the lesson: small beside large.
 *
 * The value is where the fulcrum sits along the beam. Towards the middle the
 * two ends move alike; towards the end the same small move becomes a large one.
 */

const XL = 0.12;
const XR = 0.88;
const P_MIN = 0.15;
const P_MAX = 0.5;

export function Lever({ spec }: { spec: Spec<"lever"> }) {
  const [small, large] = names(spec.labels, 2, 2, ["A small move", "A large effect"]);

  const draw: DiagramDraw = ({ ctx, w, h, t, pal, still }, v) => {
    const k = unit(w);
    const xL = w * XL;
    const xR = w * XR;
    const p = clamp(v, P_MIN, P_MAX);
    const xF = lerp(xL, xR, p);
    const a = xF - xL;
    const b = xR - xF;
    const pivotY = h * 0.6;
    const ground = h * 0.9;
    const size = textSize(w);
    // the short end always travels this far each way; the angle and the long end follow from it
    const input = h * 0.052;
    const swing = Math.asin(clamp(input / a, 0, 0.6));
    const output = Math.sin(swing) * b;
    // positive turns the long end down; the still frame shows the short end pushed down
    const ang = still ? -swing : -swing * Math.sin(t * 1.15);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // ground
    ctx.strokeStyle = rgba(pal.ink3, 0.5);
    ctx.lineWidth = 1;
    seg(ctx, w * 0.05, ground, w * 0.95, ground);
    ctx.strokeStyle = rgba(pal.ink3, 0.3);
    for (let i = -3; i <= 3; i++) seg(ctx, xF + i * 7, ground + 3, xF + i * 7 - 5, ground + 8);

    // how far each end travels: the arcs
    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.accent, 0.7);
    ctx.beginPath();
    ctx.arc(xF, pivotY, a, Math.PI - swing, Math.PI + swing);
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.gold, 0.95);
    ctx.beginPath();
    ctx.arc(xF, pivotY, b, -swing, swing);
    ctx.stroke();
    ctx.setLineDash([]);

    // the two measures, beside the ends
    const measure = (x: number, half: number, colour: typeof pal.accent) => {
      ctx.strokeStyle = rgba(colour, 1);
      ctx.lineWidth = 2;
      seg(ctx, x, pivotY - half, x, pivotY + half);
      ctx.lineWidth = 1.5;
      seg(ctx, x - 4, pivotY - half, x + 4, pivotY - half);
      seg(ctx, x - 4, pivotY + half, x + 4, pivotY + half);
    };
    measure(xL - 13 * k, input, pal.accent);
    measure(xR + 13 * k, output, pal.gold);

    // the fulcrum
    const fw = (ground - pivotY) * 0.42;
    ctx.beginPath();
    ctx.moveTo(xF, pivotY + 2);
    ctx.lineTo(xF + fw, ground);
    ctx.lineTo(xF - fw, ground);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink2, 0.85);
    ctx.lineWidth = 1.25;
    ctx.stroke();
    // it can be moved: a pair of small arrows under it
    ctx.strokeStyle = rgba(pal.ink3, 0.9);
    ctx.lineWidth = 1.25;
    head(ctx, xF - fw - 9, ground - 9, Math.PI, 4.5);
    head(ctx, xF + fw + 9, ground - 9, 0, 4.5);

    // the beam
    ctx.save();
    ctx.translate(xF, pivotY);
    ctx.rotate(ang);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.strokeStyle = rgba(pal.ink, 0.9);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.rect(-a, -4, a + b, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const lx = xF - a * Math.cos(ang);
    const ly = pivotY - 2 - a * Math.sin(ang);
    const rx = xF + b * Math.cos(ang);
    const ry = pivotY - 2 + b * Math.sin(ang);
    disc(ctx, lx, ly, 5 * k, rgba(pal.accent, 1), rgba(pal.ink, 0.9));
    disc(ctx, rx, ry, 5 * k, rgba(pal.gold, 1), rgba(pal.ink, 0.9));
    disc(ctx, xF, pivotY - 2, 2.6, rgba(pal.ink, 0.9));

    // the names, above each measure
    label(ctx, pal, small, w * 0.04, Math.max(12, pivotY - input - 15 * k - 5), { align: "left", size, weight: 600, colour: pal.ink, maxW: w * 0.44 });
    label(ctx, pal, large, w * 0.96, Math.max(12, pivotY - output - 13 * k - 5), { align: "right", size, weight: 700, colour: pal.ink, maxW: w * 0.44 });
  };

  return (
    <DiagramShell
      ratio={2.1}
      draw={draw}
      auto={(t) => 0.25 + 0.1 * Math.sin(t * 0.32 + 4.2)}
      rest={0.2}
      min={P_MIN}
      max={P_MAX}
      step={0.005}
      control="Move the fulcrum"
      fromPointer={(fx) => clamp((fx - XL) / (XR - XL), P_MIN, P_MAX)}
      describe={(v) => {
        const ratio = (1 - v) / v;
        return ratio > 3.2 ? `${small} moves a little: ${large} moves several times as far` : ratio > 1.2 ?`${small} moves a little: ${large} moves further, but less so` : "With the fulcrum in the middle, both ends move alike";
      }}
    />
  );
}
