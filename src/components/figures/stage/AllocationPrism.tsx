"use client";

import { Figure, clamp, lerp, rgba, smooth, type Colour, type FigureDraw } from "../Figure";
import { box, closeStage, dot, fract, glow, hash, lamp, line, openStage } from "./kit";

/**
 * Money managers, beside the allocation diagram: a prism. One beam, the
 * manager's single instruction, enters a block of glass standing at the golden
 * cut and leaves it as four beams of different weights, one to each of four
 * plates that stand at different depths. A packet of light travels in along
 * the one beam and out along the four, and each plate answers as its packet
 * lands. The glass does not choose: the split was set when it was cut, which
 * is what "rules agreed in advance" means. The weights are arbitrary.
 *
 * Pointer: it carries the source of the beam, up or down the left-hand side.
 * Wherever the instruction comes from, the same four beams leave at the same
 * weights. The plate nearest the pointer is picked out with its beam.
 */

const SHARE = [0.36, 0.2, 0.28, 0.16];
// where each plate stands: height in the window, and depth (1 near, 0 far)
const PLATE_Y = [0.17, 0.4, 0.62, 0.84];
const PLATE_D = [0.55, 1, 0.3, 0.8];

type State = { y: number };
const states = new WeakMap<CanvasRenderingContext2D, State>();

function beam(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: Colour, width: number, alpha: number) {
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(col, 0.13 * alpha);
  ctx.lineWidth = width * 4;
  line(ctx, x0, y0, x1, y1);
  ctx.strokeStyle = rgba(col, 0.85 * alpha);
  ctx.lineWidth = width;
  line(ctx, x0, y0, x1, y1);
  ctx.globalCompositeOperation = "source-over";
}

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, dt, hover, mx, my, pal, still } = f;
  if (w < 150 || h < 100) return;
  openStage(f, 0.382, 0.5);
  const hv = smooth(hover);
  const u = Math.min(w, h * 1.4) / 100;

  // the source: it drifts a little on its own, and follows the pointer's height
  const want = lerp(0.5 + 0.2 * Math.sin(t * 0.4), clamp(my / h, 0.12, 0.88), hv);
  let st = states.get(ctx);
  if (!st) {
    st = { y: want };
    states.set(ctx, st);
  }
  st.y = still ? want : st.y + (want - st.y) * (1 - Math.exp(-dt * 5));
  const sx = w * 0.05;
  const sy = h * st.y;

  // the prism: a triangle of glass with a second edge behind it
  const px = w * 0.382;
  const py = h * 0.5;
  const pr = Math.min(h * 0.27, w * 0.17);
  const tilt = (st.y - 0.5) * 0.22;
  const apexX = px - Math.sin(tilt) * pr;
  const apexY = py - pr;
  const blX = px - pr * 0.92;
  const blY = py + pr * 0.72;
  const brX = px + pr * 0.92;
  const brY = py + pr * 0.72;
  const dx = pr * 0.2;
  const dy = -pr * 0.13;
  // where the beam meets the left face and leaves the right one
  const inX = lerp(apexX, blX, 0.56);
  const inY = lerp(apexY, blY, 0.56);
  const outX = lerp(apexX, brX, 0.56);
  const outY = lerp(apexY, brY, 0.56);

  // one cycle: in along the beam, through the glass, out along the four
  const cyc = fract(t * 0.3);
  const pIn = clamp(cyc / 0.34);
  const pGlass = clamp((cyc - 0.34) / 0.12);
  const pOut = clamp((cyc - 0.46) / 0.36);
  const landed = clamp((cyc - 0.82) / 0.18);

  // specks, fixed
  for (let i = 0; i < 22; i++) dot(ctx, w * hash(i, 51), h * hash(i, 52), 0.6, rgba(pal.ink, 0.1 + 0.14 * hash(i, 53)));

  // the incoming beam
  beam(ctx, sx, sy, inX, inY, pal.ink, 2.2, 0.9);
  // the source
  glow(ctx, sx, sy, u * 9, pal.ink, 0.3);
  ctx.beginPath();
  ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.95);
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // the back edge of the glass
  ctx.strokeStyle = rgba(pal.ink3, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(apexX + dx, apexY + dy);
  ctx.lineTo(brX + dx, brY + dy);
  ctx.lineTo(brX, brY);
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(apexX + dx, apexY + dy);
  ctx.stroke();

  // the plates and their beams, far to near
  let near = -1;
  let nearD = 1e9;
  for (let i = 0; i < 4; i++) {
    const d = Math.abs(my - PLATE_Y[i] * h) + Math.max(0, w * 0.6 - mx);
    if (d < nearD) {
      nearD = d;
      near = i;
    }
  }
  const plate = (i: number) => {
    const col = i === 0 ? pal.accent : i === 1 ? pal.teal : i === 2 ? pal.emerald : pal.gold;
    const depth = PLATE_D[i];
    const picked = i === near ? hv : 0;
    const k = lerp(0.62, 1, depth);
    const pw = u * 13 * k;
    const ph = u * 17 * k;
    const cx = w * lerp(0.8, 0.9, depth);
    const cy = h * PLATE_Y[i];
    const tx = cx - pw / 2;
    const width = 1 + SHARE[i] * 9;
    const a = lerp(0.55, 1, depth);

    beam(ctx, outX, outY, tx, cy, col, width, a * (0.75 + 0.25 * picked));
    if (pOut > 0 && pOut < 1) lamp(ctx, lerp(outX, tx, pOut), lerp(outY, cy, pOut), 1.4 + SHARE[i] * 4, pal.ink, 1);

    // the plate: a slab seen a little from the side
    const flash = Math.max(landed > 0 ? 1 - landed : 0, picked);
    glow(ctx, cx, cy, ph * 1.5, col, 0.14 + 0.3 * flash);
    const skew = pw * 0.22;
    ctx.beginPath();
    ctx.moveTo(tx, cy - ph / 2);
    ctx.lineTo(tx + pw, cy - ph / 2 - skew);
    ctx.lineTo(tx + pw, cy + ph / 2 - skew);
    ctx.lineTo(tx, cy + ph / 2);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.surface, 0.96);
    ctx.fill();
    ctx.strokeStyle = rgba(col, (0.6 + 0.4 * flash) * a);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // what it received: a bar in proportion to its beam
    const bh = ph * 0.74 * (SHARE[i] / 0.36);
    const bx = tx + pw * 0.24;
    const bw = pw * 0.52;
    const by = cy + ph * 0.37;
    ctx.beginPath();
    ctx.moveTo(bx, by - (bx - tx) * 0.22);
    ctx.lineTo(bx + bw, by - (bx + bw - tx) * 0.22);
    ctx.lineTo(bx + bw, by - bh - (bx + bw - tx) * 0.22);
    ctx.lineTo(bx, by - bh - (bx - tx) * 0.22);
    ctx.closePath();
    ctx.fillStyle = rgba(col, (0.34 + 0.4 * flash) * a);
    ctx.fill();
  };
  // far plates first
  plate(2);
  plate(0);
  plate(3);
  plate(1);

  // the glass itself
  const g = ctx.createLinearGradient(blX, apexY, brX, brY);
  g.addColorStop(0, rgba(pal.ink, 0.13));
  g.addColorStop(0.5, rgba(pal.accent, 0.1));
  g.addColorStop(1, rgba(pal.teal, 0.2));
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(brX, brY);
  ctx.lineTo(blX, blY);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.85);
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // the beam inside the glass, spreading as it crosses
  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath();
  ctx.moveTo(inX, inY);
  ctx.lineTo(outX - 2, outY - pr * 0.16);
  ctx.lineTo(outX + 2, outY + pr * 0.16);
  ctx.closePath();
  ctx.fillStyle = rgba(pal.ink, 0.2 + 0.25 * Math.sin(pGlass * Math.PI));
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  glow(ctx, outX, outY, pr * 0.7, pal.gold, 0.16 + 0.4 * Math.sin(pGlass * Math.PI));
  // a highlight down the left face
  ctx.strokeStyle = rgba(pal.gold, 0.9);
  ctx.lineWidth = 1.5;
  line(ctx, lerp(apexX, blX, 0.08), lerp(apexY, blY, 0.08), lerp(apexX, blX, 0.4), lerp(apexY, blY, 0.4));

  // the packet on its way in
  if (pIn < 1) lamp(ctx, lerp(sx, inX, pIn), lerp(sy, inY, pIn), 2.6, pal.ink, 1);

  // the ground it stands on
  ctx.strokeStyle = rgba(pal.ink3, 0.4);
  ctx.lineWidth = 1;
  box(ctx, blX - pr * 0.2, blY + 3, pr * 2.24, 3, 1.5);
  ctx.stroke();

  closeStage(f);
};

export function AllocationPrism() {
  return <Figure draw={draw} ratio={1.4} />;
}
