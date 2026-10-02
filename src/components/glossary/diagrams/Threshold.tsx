"use client";

import { useMemo } from "react";
import { clamp, lerp, rgba, smooth } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { approach, box, disc, flare, hash, label, names, seg, textSize, timeline, unit, type Spec } from "./kit";

/**
 * A level that, once crossed, triggers something. The thing that is measured
 * wanders towards the level from the side the lesson gives, and crosses it.
 * At the crossing a ring goes out, the far side of the level fills, and the
 * lamp that names the consequence comes on: its mark fills and its edge
 * thickens, so the change does not rest on colour.
 *
 * The value is how far the measured thing has travelled. The crossing is a
 * little after two thirds of the way.
 */

const N = 96;
const X0 = 0.07;
const X1 = 0.48;
const CROSS = 0.7;

export function Threshold({ spec }: { spec: Spec<"threshold"> }) {
  const [level, measured, happens] = names(spec.labels, 3, 3, ["The level", "What is measured", "What happens"]);
  const above = spec.from !== "below";

  /** distance from the level along the way: 1 at the start, 0 at the crossing, negative beyond it */
  const ds = useMemo(() => {
    const out = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const before = u < CROSS;
      const base = before ? 1 - smooth(u / CROSS) : -0.42 * smooth((u - CROSS) / (1 - CROSS));
      const bump = before ? 0.1 * Math.sin(u * 13) * (1 - u / CROSS) * Math.min(1, u * 8) : 0;
      const rough = 0.035 * (hash(i, 5) - 0.5) * Math.min(1, Math.abs(CROSS - u) * 9);
      // it stays on its own side until the crossing, and on the far side after it
      out[i] = before ? Math.max(0, base + bump + rough) : Math.min(0, base + rough);
    }
    return out;
  }, []);

  const draw: DiagramDraw = ({ ctx, w, h, dt, pal, still }, v, mem) => {
    const k = unit(w);
    const x0 = w * X0;
    const x1 = w * X1;
    const xEnd = w * 0.94;
    const size = textSize(w);
    const yLevel = h * (above ? 0.6 : 0.4);
    const reach = h * 0.44;
    const dir = above ? -1 : 1;
    const X = (u: number) => lerp(x0, x1, u);
    const Y = (d: number) => yLevel + dir * d * reach;
    const at = clamp(v) * N;
    const whole = Math.min(N, Math.floor(at));
    const d = whole >= N ? ds[N] : lerp(ds[whole], ds[whole + 1], at - whole);
    const crossed = v >= CROSS;
    mem.on = still || mem.on === undefined ? (crossed ? 1 : 0) : approach(mem.on, crossed ? 1 : 0, dt, 8);
    if (!still && crossed && !mem.was) mem.ring = 0.001;
    mem.was = crossed ? 1 : 0;
    if (mem.ring) mem.ring = mem.ring >= 1 ? 0 : mem.ring + dt * 1.1;
    const on = mem.on;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // the far side of the level: where the consequence applies
    const zoneTop = above ? yLevel : h * 0.06;
    const zoneH = above ? h * 0.94 - yLevel : yLevel - h * 0.06;
    ctx.fillStyle = rgba(pal.accent, 0.05 + 0.1 * on);
    ctx.fillRect(x0, zoneTop, xEnd - x0, zoneH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, zoneTop, xEnd - x0, zoneH);
    ctx.clip();
    ctx.strokeStyle = rgba(pal.accent, 0.1 + 0.16 * on);
    ctx.lineWidth = 1;
    for (let x = x0 - zoneH; x < xEnd; x += 11) seg(ctx, x, zoneTop + zoneH, x + zoneH, zoneTop);
    ctx.restore();

    // the level
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = rgba(pal.ink, 0.85);
    ctx.lineWidth = 1.5;
    seg(ctx, x0, yLevel, xEnd, yLevel);
    ctx.setLineDash([]);

    // the way still to go, faint, then the way come
    ctx.strokeStyle = rgba(pal.ink, 0.16);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      if (i) ctx.lineTo(X(i / N), Y(ds[i]));
      else ctx.moveTo(X(0), Y(ds[0]));
    }
    ctx.stroke();
    const cut = Math.round(CROSS * N);
    ctx.strokeStyle = rgba(pal.ink, 0.92);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(ds[0]));
    for (let i = 1; i <= Math.min(whole, cut); i++) ctx.lineTo(X(i / N), Y(ds[i]));
    if (whole < cut) ctx.lineTo(X(at / N), Y(d));
    ctx.stroke();
    if (crossed) {
      ctx.strokeStyle = rgba(pal.accent, 1);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(X(cut / N), Y(ds[cut]));
      for (let i = cut + 1; i <= whole; i++) ctx.lineTo(X(i / N), Y(ds[i]));
      if (whole < N) ctx.lineTo(X(at / N), Y(d));
      ctx.stroke();
    }

    // the crossing
    const cx = X(CROSS);
    if (on > 0.01) disc(ctx, cx, yLevel, 5.5, rgba(pal.accent, 0.25 * on), rgba(pal.accent, on), 2);
    if (mem.ring) flare(ctx, cx, yLevel, mem.ring, pal.accent, 28 * k);

    // the level's name, on the level; kept clear of the line's start
    label(ctx, pal, level, xEnd - 2, yLevel + (above ? -1 : 1) * (11 * k + 4), { align: "right", size, weight: 600, colour: pal.ink, maxW: w * 0.42 });

    // the lamp: what happens
    const lw = Math.min(w * 0.42, 200);
    const lh = 26 * k + 6;
    const lx = xEnd - lw - 8;
    const ly = above ? yLevel + (h * 0.94 - yLevel) / 2 - lh / 2 : h * 0.06 + (yLevel - h * 0.06) / 2 - lh / 2;
    box(ctx, lx, ly, lw, lh, 4);
    ctx.fillStyle = rgba(pal.surface, 0.96);
    ctx.fill();
    ctx.fillStyle = rgba(pal.accent, 0.2 * on);
    ctx.fill();
    ctx.setLineDash(on > 0.5 ? [] : [3, 3]);
    ctx.strokeStyle = on > 0.5 ? rgba(pal.accent, 1) : rgba(pal.ink3, 0.9);
    ctx.lineWidth = 1 + on;
    ctx.stroke();
    ctx.setLineDash([]);
    disc(ctx, lx + 13, ly + lh / 2, 4.5, rgba(pal.accent, on), on > 0.5 ? rgba(pal.accent, 1) : rgba(pal.ink3, 0.9), 1.5);
    label(ctx, pal, happens, lx + 25, ly + lh / 2, { align: "left", size, weight: on > 0.5 ? 700 : 500, colour: on > 0.5 ? pal.ink : pal.ink3, maxW: lw - 33 });

    // the thing that is measured
    const px = X(at / N);
    const py = Y(d);
    disc(ctx, px, py, 4.5 * k, rgba(pal.gold, 1), rgba(pal.ink, 0.9));
    // its name rides with it, on the side it came from
    // (to the right of the point at first, to its left by the time it nears the lamp)
    const slide = smooth((v - 0.3) / 0.3);
    mem.tw = label(ctx, pal, measured, px + 10 - slide * ((mem.tw || 0) + 8), py + dir * (13 * k + 4), { align: "left", size, weight: 600, colour: pal.ink2, tag: true, maxW: w * 0.36, within: w });
  };

  return (
    <DiagramShell
      ratio={1.85}
      draw={draw}
      auto={(t) => timeline(t, 6.5, 3)}
      rest={1}
      control="Move it towards the level"
      fromPointer={(fx) => clamp((fx - X0) / (X1 - X0))}
      describe={(v) => (v >= CROSS ? `${measured} has crossed ${level}: ${happens}` : `${measured} is still ${above ? "above" : "below"} ${level}`)}
    />
  );
}
