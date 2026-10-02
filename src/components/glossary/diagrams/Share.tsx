"use client";

import { TAU, clamp, rgba, smooth } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { box, label, names, num, seg, textSize, unit, type Spec } from "./kit";

/**
 * A part of a whole. The whole is a ring; the part is the stretch of it that
 * fills, clockwise from the top, to the share the lesson gives. A notch on the
 * ring keeps the lesson's own share in view while the part is made larger or
 * smaller.
 *
 * The value is the share. It is never shown as a number: the readout under
 * the control says it in words.
 */

const WORDS: readonly (readonly [number, string])[] = [
  [0.07, "a sliver"],
  [0.14, "about a tenth"],
  [0.23, "about a fifth"],
  [0.29, "about a quarter"],
  [0.4, "about a third"],
  [0.6, "about half"],
  [0.71, "about two thirds"],
  [0.78, "about three quarters"],
  [0.86, "about four fifths"],
  [0.94, "most"],
  [2, "nearly all"],
];

export function Share({ spec }: { spec: Spec<"share"> }) {
  const [part, whole] = names(spec.labels, 2, 2, ["The part", "The whole"]);
  const share = num(spec.share, 0.03, 0.97, 0.5);

  const auto = (t: number) => {
    const u = t % 9;
    return share * (smooth(u / 2.2) - smooth((u - 8) / 1));
  };

  const draw: DiagramDraw = ({ ctx, w, h, pal }, v) => {
    const k = unit(w);
    const cx = w * 0.28;
    const cy = h * 0.5;
    const R = Math.min(h * 0.37, w * 0.2);
    const thick = R * 0.36;
    const size = textSize(w);
    const from = -Math.PI / 2;
    const s = clamp(v, 0, 1);

    ctx.lineCap = "butt";

    // the whole
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.strokeStyle = rgba(pal.ink3, 0.28);
    ctx.lineWidth = thick;
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink, 0.6);
    ctx.beginPath();
    ctx.arc(cx, cy, R + thick / 2, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R - thick / 2, 0, TAU);
    ctx.stroke();

    // the part
    if (s > 0.002) {
      ctx.beginPath();
      ctx.arc(cx, cy, R, from, from + s * TAU);
      ctx.strokeStyle = rgba(pal.accent, 0.95);
      ctx.lineWidth = thick - 2;
      ctx.stroke();
    }
    // where it starts and where it ends
    ctx.strokeStyle = rgba(pal.ink, 0.9);
    ctx.lineWidth = 1.5;
    for (const a of [from, from + s * TAU]) seg(ctx, cx + (R - thick / 2 - 3) * Math.cos(a), cy + (R - thick / 2 - 3) * Math.sin(a), cx + (R + thick / 2 + 3) * Math.cos(a), cy + (R + thick / 2 + 3) * Math.sin(a));

    // the lesson's own share, notched on the outside of the ring
    const na = from + share * TAU;
    const nr = R + thick / 2 + 5;
    ctx.beginPath();
    ctx.moveTo(cx + nr * Math.cos(na), cy + nr * Math.sin(na));
    ctx.lineTo(cx + (nr + 8) * Math.cos(na - 0.09), cy + (nr + 8) * Math.sin(na - 0.09));
    ctx.lineTo(cx + (nr + 8) * Math.cos(na + 0.09), cy + (nr + 8) * Math.sin(na + 0.09));
    ctx.closePath();
    ctx.fillStyle = rgba(pal.gold, 1);
    ctx.fill();

    // which is which
    const lx = w * 0.56;
    const sw = 13 * k;
    const row = (y: number, name: string, isPart: boolean) => {
      box(ctx, lx, y - sw / 2, sw, sw, 2);
      ctx.fillStyle = isPart ? rgba(pal.accent, 0.95) : rgba(pal.ink3, 0.28);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.ink, 0.7);
      ctx.lineWidth = 1;
      ctx.stroke();
      label(ctx, pal, name, lx + sw + 9, y, { align: "left", size: size + 1, weight: isPart ? 700 : 500, colour: isPart ? pal.ink : pal.ink2, maxW: w * 0.42 - sw - 14 });
    };
    row(cy - 15 * k, part, true);
    row(cy + 15 * k, whole, false);
  };

  return (
    <DiagramShell
      ratio={2.2}
      draw={draw}
      auto={auto}
      rest={share}
      min={0.02}
      max={0.98}
      control="Make the part larger or smaller"
      describe={(v) => {
        const words = (WORDS.find(([limit]) => v < limit) ?? WORDS[WORDS.length - 1])[1];
        const same = Math.abs(v - share) < 0.02;
        return `${part} is ${words} of ${whole}${same ? " (as in the lesson)" : ""}`;
      }}
    />
  );
}
