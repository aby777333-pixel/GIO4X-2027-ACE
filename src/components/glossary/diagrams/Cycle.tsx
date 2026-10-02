"use client";

import { TAU, clamp, rgba, smooth } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { disc, head, label, names, textSize, unit, type Spec } from "./kit";

/**
 * Stages that repeat: stations round a loop, joined by arrows that all run the
 * same way, and a token that goes round, resting at each. The stage it is at
 * is named in full weight, and the arc it has just come along is lit.
 *
 * The value is the token's place on the loop (0 and 1 are the same station).
 */

const RX = 0.2;
const RY = 0.29;

export function Cycle({ spec }: { spec: Spec<"cycle"> }) {
  const stages = names(spec.labels, 3, 6, ["First", "Next", "Then"]);
  const n = stages.length;

  const auto = (t: number) => {
    const hop = 1.9;
    return ((Math.floor(t / hop) + smooth((t % hop) / 1.1)) / n) % 1;
  };

  const draw: DiagramDraw = ({ ctx, w, h, t, pal, still }, v, mem) => {
    const k = unit(w);
    const cx = w / 2;
    const cy = h / 2;
    const ry = h * RY;
    // the loop is drawn narrower where the names beside it need the room (measured once per width)
    if (mem.w !== w) {
      mem.w = w;
      ctx.font = `700 ${textSize(w)}px ${pal.font}`;
      let widest = 0;
      for (let i = 0; i < n; i++) if (Math.abs(Math.cos(-Math.PI / 2 + (i / n) * TAU)) >= 0.3) widest = Math.max(widest, ctx.measureText(stages[i]).width);
      mem.rx = clamp(w / 2 - widest - 8 * k - 22, w * 0.11, w * RX);
    }
    const rx = mem.rx;
    const pos = (((v % 1) + 1) % 1) * n;
    const active = Math.round(pos) % n;
    const size = textSize(w);
    const r = 8 * k;
    const angle = (i: number) => -Math.PI / 2 + (i / n) * TAU;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // the loop, an arc at a time, each ending in an arrow just before the next station
    const trim = Math.min(0.42, (r + 6) / Math.min(rx, ry));
    for (let i = 0; i < n; i++) {
      const a0 = angle(i) + trim;
      const a1 = angle(i + 1) - trim;
      // the arc being travelled, or just travelled, is lit
      const part = pos - Math.floor(pos);
      const lit = part > 0.02 ? Math.floor(pos) % n === i : (Math.floor(pos) - 1 + n) % n === i;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
      ctx.strokeStyle = lit ? rgba(pal.accent, 0.95) : rgba(pal.ink3, 0.6);
      ctx.lineWidth = lit ? 2 : 1.25;
      ctx.stroke();
      const hx = cx + rx * Math.cos(a1);
      const hy = cy + ry * Math.sin(a1);
      head(ctx, hx, hy, Math.atan2(ry * Math.cos(a1), -rx * Math.sin(a1)), 7 * k);
    }

    for (let i = 0; i < n; i++) {
      const a = angle(i);
      const x = cx + rx * Math.cos(a);
      const y = cy + ry * Math.sin(a);
      const here = i === active;
      if (here && !still) {
        const p = (t * 0.7) % 1;
        ctx.beginPath();
        ctx.arc(x, y, r + 3 + 9 * p, 0, TAU);
        ctx.strokeStyle = rgba(pal.accent, 0.5 * (1 - p));
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      disc(ctx, x, y, r, here ? rgba(pal.accent, 0.22) : rgba(pal.surface, 1), here ? rgba(pal.accent, 1) : rgba(pal.ink2, 0.8), here ? 2 : 1.25);
      // the name, outside the loop on the station's own side
      const c = Math.cos(a);
      const s = Math.sin(a);
      const side = Math.abs(c) < 0.3 ? "center" : c > 0 ? "left" : "right";
      const lx = side === "center" ? x : x + Math.sign(c) * (r + 9);
      const ly = side === "center" ? y + Math.sign(s) * (r + 13) : y + s * 6;
      label(ctx, pal, stages[i], lx, ly, {
        align: side,
        size,
        weight: here ? 700 : 500,
        colour: here ? pal.ink : pal.ink2,
        maxW: side === "center" ? w * 0.6 : w / 2 - Math.abs(lx - cx) - 8,
        within: w,
      });
    }

    // the token
    const ta = angle(pos);
    disc(ctx, cx + rx * Math.cos(ta), cy + ry * Math.sin(ta), 5.5 * k, rgba(pal.gold, 1), rgba(pal.ink, 0.9));
  };

  return (
    <DiagramShell
      ratio={1.8}
      draw={draw}
      auto={auto}
      rest={1 / n}
      wrap
      control="Go round the cycle"
      fromPointer={(fx, fy, touch) => {
        if (touch) return clamp((fx - 0.07) / 0.86);
        // the place on the loop nearest the pointer
        const a = Math.atan2((fy - 0.5) / RY, (fx - 0.5) / RX);
        return (((a + Math.PI / 2) / TAU) % 1 + 1) % 1;
      }}
      describe={(v) => {
        const i = Math.round((((v % 1) + 1) % 1) * n) % n;
        return `${stages[i]}, then ${stages[(i + 1) % n]}`;
      }}
    />
  );
}
