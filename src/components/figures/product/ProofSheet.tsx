"use client";

import { Figure, TAU, lerp, rgba, smooth, type FigureDraw, type Palette } from "../Figure";
import { line, roundRect } from "./shapes";

/**
 * 777 Raptor, "What is not published yet": a proof sheet with five entries,
 * one for each document in the list beside it. Each entry has its heading
 * ruled in, and under it only the dashes where the text will be set. A caret
 * waits at one entry after another.
 *
 * The pointer carries a reading glass over the sheet. Under the glass the
 * dashes are larger, and they are still dashes: there is nothing behind them
 * to read until the document itself is published.
 */

const ROWS = 5;
/** heading length of each entry, as a share of the text width (fixed, so the sheet never changes) */
const HEAD = [0.34, 0.5, 0.3, 0.58, 0.44];

type Box = { x: number; y: number; w: number; h: number };

function sheet(ctx: CanvasRenderingContext2D, b: Box, t: number, pal: Palette, strong: number) {
  // the sheet behind, then the proof itself
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  roundRect(ctx, b.x + 5, b.y - 4, b.w, b.h, 3);
  ctx.strokeStyle = rgba(pal.ink3, 0.22);
  ctx.stroke();
  roundRect(ctx, b.x, b.y, b.w, b.h, 3);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink3, 0.6);
  ctx.stroke();

  const padX = 14;
  const rowH = (b.h - 14) / ROWS;
  const tx = b.x + padX + 12;
  const tw = b.w - padX * 2 - 12 - 18;
  const active = Math.floor(t / 2.4) % ROWS;

  for (let i = 0; i < ROWS; i++) {
    const y = b.y + 7 + i * rowH;
    const hy = Math.round(y + rowH * 0.36) + 0.5;
    const by = Math.round(y + rowH * 0.72) + 0.5;

    // champagne numeral tick, as the list's own rows are numbered by position
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(pal.gold, 0.9);
    ctx.lineWidth = 1.5;
    line(ctx, b.x + padX, hy, b.x + padX + 5, hy);

    // the heading: ruled in
    ctx.strokeStyle = rgba(pal.ink, 0.72 + strong * 0.2);
    ctx.lineWidth = 2;
    line(ctx, tx, hy, tx + tw * HEAD[i], hy);

    // the body: not set yet
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.6 + strong * 0.3);
    line(ctx, tx, by, tx + tw, by);

    // the "not yet published" square at the end of the row
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = rgba(pal.ink3, 0.75);
    ctx.strokeRect(Math.round(b.x + b.w - padX - 8) + 0.5, Math.round(hy - 4), 8, 8);
    ctx.setLineDash([]);

    if (i < ROWS - 1) {
      ctx.strokeStyle = rgba(pal.line, 1);
      line(ctx, b.x + padX, Math.round(y + rowH) + 0.5, b.x + b.w - padX, Math.round(y + rowH) + 0.5);
    }

    // the caret, waiting where the first word of the body would go
    if (i === active && Math.sin(t * 4.2) > -0.35) {
      ctx.strokeStyle = rgba(pal.accent, 1);
      ctx.lineWidth = 1.5;
      line(ctx, tx - 4, by - 5, tx - 4, by + 5);
    }
  }
}

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  // hidden below lg, the canvas has no size: nothing to draw
  if (w < 120 || h < 60) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const b: Box = { x: 16, y: 14, w: w * 0.7, h: h - 26 };
  sheet(ctx, b, t, pal, 0);

  // the glass: at rest beside the sheet, over it under the pointer
  const k = smooth(hover);
  const R = lerp(20, 27, k);
  const restX = b.x + b.w + (w - b.x - b.w) * 0.52;
  const restY = h * 0.44 + Math.sin(t * 0.8) * 2;
  const gx = lerp(restX, Math.max(R + 4, Math.min(w - R - 4, mx)), k);
  const gy = lerp(restY, Math.max(R + 4, Math.min(h - R - 4, my)), k);

  // what the glass shows: the same sheet, enlarged about its centre
  ctx.save();
  ctx.beginPath();
  ctx.arc(gx, gy, R, 0, TAU);
  ctx.clip();
  ctx.fillStyle = rgba(pal.surface, 0.92);
  ctx.fillRect(gx - R, gy - R, R * 2, R * 2);
  const z = 1.75;
  ctx.translate(gx, gy);
  ctx.scale(z, z);
  ctx.translate(-gx, -gy);
  sheet(ctx, b, t, pal, 1);
  ctx.restore();

  // rim, glint and handle
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(gx, gy, R, 0, TAU);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = rgba(pal.accent, 0.55 + k * 0.45);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(gx, gy, R - 3.5, -2.5, -1.7);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.5);
  ctx.stroke();
  const a = 0.82;
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = rgba(pal.ink2, 0.8);
  line(ctx, gx + Math.cos(a) * (R + 1.5), gy + Math.sin(a) * (R + 1.5), gx + Math.cos(a) * (R + 15), gy + Math.sin(a) * (R + 15));
};

export function ProofSheet() {
  return <Figure draw={draw} ratio={2.7} />;
}
