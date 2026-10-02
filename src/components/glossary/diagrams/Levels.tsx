"use client";

import { clamp, rgba } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { approach, disc, flare, hash, label, names, seg, textSize, unit, type Spec } from "./kit";

/**
 * Levels around the current price. A named level waits above the price and
 * another below it, each with a few fainter levels beyond. The price moves up
 * and down between them. When it reaches a level, that level is met: its line
 * turns solid and thick, its mark fills and a ring goes out, and it rests
 * again when the price moves away.
 *
 * The value is the height of the price: half is midway between the two.
 */

/** the named levels sit this far from the middle, as a share of the frame's height */
const AT = 0.21;
const RANGE = 0.34;

export function Levels({ spec }: { spec: Spec<"levels"> }) {
  const [above, at, below] = names(spec.labels, 3, 3, ["Level above", "Price", "Level below"]);
  const touch = 0.5 + (AT / RANGE) * 0.5;
  // a lesson whose middle label is itself a level (three retracement levels, say) gets three fixed levels and a price that moves through them
  const ladder = /level|%|\bline\b/i.test(at);
  const mover = ladder ? "Price" : at;
  const atMiddle = (v: number) => ladder && Math.abs(v - 0.5) < 0.035;

  const draw: DiagramDraw = ({ ctx, w, h, dt, pal, still }, v, mem) => {
    const k = unit(w);
    const x0 = w * 0.06;
    const x1 = w * 0.94;
    const mid = h * 0.5;
    const size = textSize(w);
    const py = mid - (clamp(v) - 0.5) * 2 * RANGE * h;
    const yUp = mid - AT * h;
    const yDown = mid + AT * h;
    const hitUp = py <= yUp + 0.5;
    const hitDown = py >= yDown - 0.5;
    const ease = (key: string, on: boolean) => {
      mem[key] = still || mem[key] === undefined ? (on ? 1 : 0) : approach(mem[key], on ? 1 : 0, dt, 9);
      const ring = `${key}r`;
      if (!still && on && !mem[`${key}w`]) mem[ring] = 0.001;
      mem[`${key}w`] = on ? 1 : 0;
      if (mem[ring]) mem[ring] = mem[ring] >= 1 ? 0 : mem[ring] + dt * 1.3;
      return mem[key];
    };
    const upOn = ease("u", hitUp);
    const downOn = ease("d", hitDown);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const midOn = ladder ? ease("m", atMiddle(v)) : 0;

    const level = (y: number, name: string, on: number, ring: number, dir: -1 | 1, colour: typeof pal.accent, more = true) => {
      // fainter levels further out: there is more than one
      ctx.strokeStyle = rgba(pal.ink3, 0.55);
      ctx.lineWidth = 1;
      for (let i = 1; more && i <= 2; i++) {
        const yy = y + dir * i * h * 0.075;
        const len = (0.14 + 0.16 * hash(i, dir + 2)) * (x1 - x0);
        ctx.setLineDash([2, 4]);
        seg(ctx, x1 - len, yy, x1, yy);
        ctx.setLineDash([]);
      }
      // the named level
      ctx.setLineDash(on > 0.5 ? [] : [7, 5]);
      ctx.strokeStyle = on > 0.5 ? rgba(colour, 1) : rgba(pal.ink, 0.8);
      ctx.lineWidth = 1.5 + on;
      seg(ctx, x0, y, x1, y);
      ctx.setLineDash([]);
      disc(ctx, x1, y, 4.5, rgba(colour, on), on > 0.5 ? rgba(colour, 1) : rgba(pal.ink, 0.8), 1.5);
      if (ring) flare(ctx, x1, y, ring, colour, 22 * k);
      label(ctx, pal, name, x0, y + dir * (11 * k + 5), { align: "left", size, weight: on > 0.5 ? 700 : 600, colour: on > 0.5 ? pal.ink : pal.ink2, maxW: w * 0.42 });
    };
    level(yUp, above, upOn, mem.ur || 0, -1, pal.accent);
    level(yDown, below, downOn, mem.dr || 0, 1, pal.gold);
    if (ladder) level(mid, at, midOn, mem.mr || 0, -1, pal.teal, false);

    // how far the price is from each level
    ctx.strokeStyle = rgba(pal.ink3, 0.6);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    const gx = w * 0.84;
    if (!hitUp) seg(ctx, gx, py - 6, gx, yUp + 4);
    if (!hitDown) seg(ctx, gx, py + 6, gx, yDown - 4);
    ctx.setLineDash([]);

    // the price
    ctx.strokeStyle = rgba(pal.ink, 0.92);
    ctx.lineWidth = 2;
    seg(ctx, x0, py, x1, py);
    disc(ctx, gx, py, 5 * k, rgba(pal.gold, 1), rgba(pal.ink, 0.9));
    label(ctx, pal, mover, gx - 12 * k - 6, py, { align: "right", size, weight: 700, colour: pal.ink, tag: true, maxW: w * 0.32 });
  };

  return (
    <DiagramShell
      ratio={1.9}
      draw={draw}
      auto={(t) => 0.5 + 0.5 * Math.sin(t * 0.55) * (0.72 + 0.28 * Math.sin(t * 0.17))}
      rest={ladder ? 0.5 : touch + 0.02}
      control="Move the price down or up"
      fromPointer={(fx, fy, isTouch) => (isTouch ? clamp((fx - 0.07) / 0.86) : clamp(0.5 + (0.5 - fy) / (2 * RANGE)))}
      describe={(v) =>
        v >= touch
          ? `${mover} has reached ${above}`
          : v <= 1 - touch
            ? `${mover} has reached ${below}`
            : atMiddle(v)
              ? `${mover} has reached ${at}`
              : ladder
                ? `${mover} is between ${v > 0.5 ? above : at} and ${v > 0.5 ? at : below}`
                : `${mover} is between ${above} and ${below}`
      }
    />
  );
}
