"use client";

import { Figure, TAU, rgba, smooth, type FigureDraw } from "../Figure";
import { corners, glow } from "./kit";

/**
 * Currency Strength, beside "What this is, and is not": a hanging mobile.
 * Eight equal weights hang from seven balanced beams, in pairs, pairs of
 * pairs, and one beam over all, and the whole thing turns slowly in the air.
 * No weight can go down without the one it is paired with going up: the page
 * measures each currency against the other seven, so its figures only
 * describe each other. The weights are identical and unlabelled; none of them
 * is a currency and no height is a value.
 *
 * Pointer: the nearest weight is drawn down, the beams above it tip, and its
 * partners rise; the mobile also stops turning and hangs flat so all eight can
 * be seen. It settles back when the pointer leaves.
 */

const LX = new Float32Array(8);
const LY = new Float32Array(8);
const LZ = new Float32Array(8);

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, pal }) => {
  if (w < 110 || h < 70) return;
  const on = smooth(hover);
  const u = Math.min(w / 230, h / 131);
  const half = [57 * u, 28.5 * u, 14 * u];
  const drop = [22 * u, 19 * u, 17 * u];
  const topX = w / 2;
  const topY = 9 * u;
  const r = 6.6 * u;
  ctx.lineCap = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  // the pointer's weight: the one whose place at rest is nearest in x
  let pick = -1;
  if (hover > 0.02) {
    let best = Infinity;
    for (let i = 0; i < 8; i++) {
      const rest = topX + (i & 4 ? half[0] : -half[0]) + (i & 2 ? half[1] : -half[1]) + (i & 1 ? half[2] : -half[2]);
      const d = Math.abs(rest - mx);
      if (d < best) {
        best = d;
        pick = i;
      }
    }
  }
  const flat = 1 - on * 0.88;

  // the ceiling it hangs from
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(pal.gold, 0.9);
  ctx.beginPath();
  ctx.moveTo(topX - 13 * u, topY);
  ctx.lineTo(topX + 13 * u, topY);
  ctx.stroke();

  /** one beam: its pivot, its level, its number within the level; draws itself and what hangs from it */
  const beam = (px: number, py: number, pz: number, level: number, index: number) => {
    const seed = level * 3.1 + index * 1.7;
    let tip = (0.13 + level * 0.05) * Math.sin(t * (0.42 + level * 0.11) + seed) + 0.05 * Math.sin(t * 0.9 + seed * 2.3);
    if (pick >= 0) {
      const shift = 2 - level;
      if (pick >> (shift + 1) === index) tip += (((pick >> shift) & 1) === 1 ? 1 : -1) * (0.15 + level * 0.05) * on;
    }
    const turn = (0.55 + level * 0.3) * Math.sin(t * (0.13 + level * 0.045) + seed * 1.9) * flat;
    const L = half[level];
    const dx = L * Math.cos(turn) * Math.cos(tip);
    const dy = L * Math.sin(tip);
    const dz = L * Math.sin(turn);
    const depth = 1 - (pz + 100 * u) / (200 * u);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(pal.ink2, 0.55 + 0.4 * depth);
    ctx.beginPath();
    ctx.moveTo(px - dx, py - dy);
    ctx.lineTo(px + dx, py + dy);
    ctx.stroke();
    ctx.fillStyle = rgba(pal.gold, 0.95);
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, TAU);
    ctx.fill();
    for (const side of [-1, 1]) {
      const ex = px + side * dx;
      const ey = py + side * dy;
      const ez = pz + side * dz;
      const child = index * 2 + (side === 1 ? 1 : 0);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(pal.ink3, 0.75);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex, ey + drop[level]);
      ctx.stroke();
      if (level < 2) beam(ex, ey + drop[level], ez, level + 1, child);
      else {
        LX[child] = ex;
        LY[child] = ey + drop[level];
        LZ[child] = ez;
      }
    }
  };

  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.75);
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(topX, topY + 11 * u);
  ctx.stroke();
  beam(topX, topY + 11 * u, 0, 0, 0);

  // the eight weights, the far ones first
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 8; i++) {
      if (LZ[i] > 0 !== (pass === 0)) continue;
      const depth = 1 - (LZ[i] + 100 * u) / (200 * u);
      const sel = i === pick ? on : 0;
      const rr = r * (0.82 + depth * 0.36);
      const y = LY[i] + rr;
      glow(ctx, LX[i], y, rr * 2.6, sel > 0.02 ? pal.gold : pal.accent, 0.16 + sel * 0.2);
      ctx.beginPath();
      ctx.arc(LX[i], y, rr, 0, TAU);
      ctx.fillStyle = rgba(pal.surface, 0.96);
      ctx.fill();
      ctx.fillStyle = sel > 0.02 ? rgba(pal.gold, 0.3 + sel * 0.4) : rgba(pal.accent, 0.12 + depth * 0.22);
      ctx.fill();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = sel > 0.02 ? rgba(pal.gold, 0.95) : rgba(pal.ink, 0.45 + depth * 0.5);
      ctx.stroke();
    }
  }
};

export function BalanceMobile({ ratio = 1.75 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
