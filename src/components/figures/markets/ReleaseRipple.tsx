"use client";

import { useMemo } from "react";
import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { GOLDEN_ANGLE, P, camera, corners, discPath, glow, hash, lamp, pr, ring, seg } from "./kit";

/**
 * An economic event's own page, beside "At a glance": a release as a drop
 * falling on still water. It falls at an even interval (a release is
 * scheduled), rings spread from where it lands, and the floats standing on
 * the water rise and settle as each ring passes under them: one float for
 * each currency or instrument the page lists as commonly monitored alongside
 * the release. A float only rises and settles; it never leans one way.
 * There is no scale, no date and no reading on the water.
 *
 * Pointer: the drop falls where the pointer is, so the rings start there and
 * reach the floats in a different order.
 */

function makeDraw(count: number): FigureDraw {
  const n = Math.max(1, Math.min(count, 9));
  return ({ ctx, w, h, t, hover, mx, my, pal }) => {
    if (w < 150 || h < 70) return;
    const on = smooth(hover);
    const s = Math.min(w * 0.2, h * 0.5);
    const pitch = 0.42;
    const c = camera(w * 0.5, h * 0.62, s, 0, pitch, 9);
    const halfX = (w * 0.47) / s;
    ctx.lineCap = "round";

    // where the drop lands: the golden section of the water, or under the pointer
    const v = (c.oy - my) / s;
    const pz = clamp((v * c.d) / (c.sp * c.d - v * c.cp), -0.75, 1.9);
    const px = clamp(((mx - c.ox) / s) * ((c.d + pz * c.cp) / c.d), -halfX + 0.9, halfX - 0.9);
    const cx = lerp(-halfX * 0.236, px, on);
    const cz = lerp(0.35, pz, on);

    // the water: level lines, closer together toward the horizon
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const z = -1.05 + i * 0.4 + i * i * 0.012;
      const k = 1 - i / 9;
      pr(c, -halfX, 0, z);
      const xa = P.x;
      const ya = P.y;
      pr(c, halfX, 0, z);
      const g = ctx.createLinearGradient(xa, 0, P.x, 0);
      g.addColorStop(0, rgba(pal.ink3, 0));
      g.addColorStop(0.5, rgba(pal.ink3, 0.14 + k * 0.26));
      g.addColorStop(1, rgba(pal.ink3, 0));
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(xa, ya);
      ctx.lineTo(P.x, P.y);
      ctx.stroke();
    }

    // the rings of the last three drops
    const T = 3.4;
    const age0 = t % T;
    const speed = 0.36;
    const limit = 2.3;
    pr(c, cx, 0, cz);
    glow(ctx, P.x, P.y, s * 0.9, pal.accent, 0.12 + 0.14 * Math.exp(-age0 * 1.6));
    for (let m = 2; m >= 0; m--) {
      const radius = (age0 + m * T) * speed;
      const a = clamp(1 - radius / limit) ** 0.9;
      if (a <= 0.01 || radius < 0.02) continue;
      ring(ctx, c, cx, 0, cz, 1, 0, 0, 0, 0, 1, radius, pal.accent, a * 0.95, a * 0.5, 1.5, 72);
      if (radius > 0.16) ring(ctx, c, cx, 0, cz, 1, 0, 0, 0, 0, 1, radius - 0.1, pal.accent, a * 0.35, a * 0.2, 1, 64);
    }

    // the water has no edge: what reaches the sides of the stage fades out rather than stopping
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const band = Math.min(56, w * 0.14);
    for (const side of [0, 1]) {
      const x0 = side === 0 ? 0 : w;
      const x1 = side === 0 ? band : w - band;
      const fadeOut = ctx.createLinearGradient(x0, 0, x1, 0);
      // only the alpha of this fill matters: it erases
      fadeOut.addColorStop(0, rgba(pal.surface, 1));
      fadeOut.addColorStop(1, rgba(pal.surface, 0));
      ctx.fillStyle = fadeOut;
      ctx.fillRect(Math.min(x0, x1), 0, band, h);
    }
    const foot = ctx.createLinearGradient(0, h, 0, h - 26);
    foot.addColorStop(0, rgba(pal.surface, 1));
    foot.addColorStop(1, rgba(pal.surface, 0));
    ctx.fillStyle = foot;
    ctx.fillRect(0, h - 26, w, 26);
    ctx.restore();
    corners(ctx, w, h, pal.gold, 0.4);

    // the floats: commonly monitored alongside the release
    for (let k = 0; k < n; k++) {
      const ang = k * GOLDEN_ANGLE + 0.5;
      const dist = 0.85 + hash(k + 11) * 0.95;
      const x = clamp(Math.cos(ang) * dist * 1.5 + halfX * 0.12, -halfX + 0.5, halfX - 0.5);
      const z = clamp(0.55 + Math.sin(ang) * dist * 0.9, -0.75, 1.95);
      const d = Math.hypot(x - cx, z - cz);
      let hit = 0;
      for (let m = 0; m < 3; m++) {
        const radius = (age0 + m * T) * speed;
        hit += Math.exp(-(((d - radius) / 0.17) ** 2)) * clamp(1 - radius / limit);
      }
      hit = clamp(hit);
      const lift = hit * 0.1;
      discPath(ctx, c, x, 0, z, 1, 0, 0, 0, 0, 1, 0.1 + hit * 0.04, 16);
      ctx.strokeStyle = rgba(pal.teal, 0.35 + hit * 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.ink2, 0.7);
      seg(ctx, c, x, 0, z, x, 0.26 + lift, z);
      pr(c, x, 0.26 + lift, z);
      lamp(ctx, P.x, P.y, 1.8 * P.k + hit * 0.8, pal.teal, 0.6 + hit * 0.4);
    }

    // the drop itself: falling through the last part of each interval, landing as the next begins
    const fall = clamp((age0 - (T - 0.7)) / 0.7);
    if (fall > 0) {
      const y = 0.95 * (1 - fall * fall);
      ctx.strokeStyle = rgba(pal.gold, 0.5 * fall);
      ctx.lineWidth = 1;
      seg(ctx, c, cx, y, cz, cx, Math.min(0.98, y + 0.12 + fall * 0.16), cz);
      pr(c, cx, y, cz);
      lamp(ctx, P.x, P.y, 2, pal.gold, 0.95);
    }
    const splash = clamp(1 - age0 / 0.6);
    if (splash > 0) {
      pr(c, cx, (1 - splash) * 0.32, cz);
      lamp(ctx, P.x, P.y, 1.2 + splash * 1.4, pal.gold, splash);
    }
  };
}

export function ReleaseRipple({ count, ratio = 2.5 }: { count: number; ratio?: number }) {
  const draw = useMemo(() => makeDraw(count), [count]);
  return <Figure draw={draw} ratio={ratio} />;
}
