"use client";

import { clamp, lerp, rgba, smooth } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { box, disc, label, names, seg, textSize, unit, type Spec } from "./kit";

/**
 * Two things weighed against each other: a beam on a post, a pan hanging from
 * each end, a weight on each pan. Weight is moved from one pan to the other
 * and the beam tilts, overshoots a little and settles, as a real balance does.
 *
 * The value is the share of the weight on the right-hand pan. The loop starts
 * level and settles on the side the lesson names as the heavier.
 */

const MAX_ANGLE = 0.21;

export function Balance({ spec }: { spec: Spec<"balance"> }) {
  const [left, right] = names(spec.labels, 2, 2, ["One side", "The other side"]);
  const home = spec.tilt === "left" ? 0.24 : spec.tilt === "right" ? 0.76 : 0.5;

  const auto = (t: number) => {
    const u = t % 10;
    if (home === 0.5) return 0.5 - 0.2 * smooth((u - 1) / 1.2) + 0.4 * smooth((u - 3.6) / 1.4) - 0.2 * smooth((u - 6.4) / 1.4);
    return lerp(0.5, home, smooth((u - 1) / 1.3) - smooth((u - 8.6) / 1.2));
  };

  const draw: DiagramDraw = ({ ctx, w, h, dt, pal, still }, v, mem) => {
    const k = unit(w);
    const cx = w / 2;
    const pivotY = h * 0.25;
    const baseY = h * 0.9;
    const arm = Math.min(w * 0.3, 200);
    const drop = h * 0.3;

    // the beam is a spring: it is pulled towards the angle the weights call for, and settles
    const target = (v - 0.5) * 2 * MAX_ANGLE;
    if (still || mem.a === undefined) {
      mem.a = target;
      mem.va = 0;
    } else {
      mem.va += ((target - mem.a) * 46 - mem.va * 4.4) * dt;
      mem.a += mem.va * dt;
    }
    const a = clamp(mem.a, -0.32, 0.32);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // the stand
    ctx.strokeStyle = rgba(pal.ink3, 0.6);
    ctx.lineWidth = 1;
    seg(ctx, cx - 46 * k, baseY, cx + 46 * k, baseY);
    ctx.strokeStyle = rgba(pal.ink, 0.8);
    ctx.lineWidth = 2;
    seg(ctx, cx, pivotY, cx, baseY);
    // the level mark the pointer of the beam is read against
    ctx.strokeStyle = rgba(pal.ink3, 0.55);
    ctx.lineWidth = 1;
    seg(ctx, cx, pivotY - 20 * k, cx, pivotY - 30 * k);

    const ex = Math.cos(a) * arm;
    const ey = Math.sin(a) * arm;
    const size = textSize(w);

    const pan = (side: -1 | 1, share: number, name: string, colour: typeof pal.accent) => {
      const x = cx + side * ex;
      const y = pivotY + side * ey;
      const py = y + drop;
      const pw = arm * 0.36;
      // strings
      ctx.strokeStyle = rgba(pal.ink2, 0.7);
      ctx.lineWidth = 1;
      seg(ctx, x, y, x - pw, py);
      seg(ctx, x, y, x + pw, py);
      // the pan
      ctx.strokeStyle = rgba(pal.ink, 0.85);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - pw - 4, py);
      ctx.quadraticCurveTo(x, py + 9 * k, x + pw + 4, py);
      ctx.stroke();
      // the weight: its area follows its share
      const s = pw * 1.5 * Math.sqrt(clamp(share, 0.04, 1));
      box(ctx, x - s / 2, py - s - 1, s, s, 2);
      ctx.fillStyle = rgba(pal.surface, 1);
      ctx.fill();
      ctx.fillStyle = rgba(colour, 0.2);
      ctx.fill();
      ctx.strokeStyle = rgba(colour, 1);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const heavier = share > 0.55;
      label(ctx, pal, name, x, py + 20 * k + 4, { size, weight: heavier ? 700 : 500, colour: heavier ? pal.ink : pal.ink2, maxW: w * 0.42, within: w });
    };
    pan(-1, 1 - v, left, pal.accent);
    pan(1, v, right, pal.gold);

    // the beam, its pointer and the pivot
    ctx.save();
    ctx.translate(cx, pivotY);
    ctx.rotate(a);
    ctx.strokeStyle = rgba(pal.ink, 0.9);
    ctx.lineWidth = 2.5;
    seg(ctx, -arm, 0, arm, 0);
    ctx.lineWidth = 1.5;
    seg(ctx, 0, 0, 0, -22 * k);
    ctx.restore();
    disc(ctx, cx, pivotY, 4, rgba(pal.surface, 1), rgba(pal.ink, 0.9));
  };

  return (
    <DiagramShell
      ratio={1.9}
      draw={draw}
      auto={auto}
      rest={home}
      control="Shift the weight"
      fromPointer={(fx) => clamp((fx - 0.18) / 0.64)}
      describe={(v) => (v < 0.45 ? `${left} outweighs ${right}` : v > 0.55 ? `${right} outweighs ${left}` : `${left} and ${right} are in balance`)}
    />
  );
}
