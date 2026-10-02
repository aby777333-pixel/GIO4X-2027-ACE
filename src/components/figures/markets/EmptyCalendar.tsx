"use client";

import { useMemo } from "react";
import { Figure, rgba, smooth, type FigureDraw } from "../Figure";
import { P, camera, corners, discPath, lamp, pr, seg } from "./kit";

/**
 * Economic Events, beside "Not a calendar": a month sheet lying on the deck
 * with every cell empty, and the releases the page explains floating above it,
 * one marker for each, drifting and never set down on a day. A band of light
 * crosses the sheet and finds nothing written. No date is drawn anywhere,
 * because the page shows none.
 *
 * Pointer: the cell under the pointer lights in champagne and stays empty; the
 * sheet turns a little toward the pointer.
 */

const COLS = 7;
const ROWS = 5;
const CELL = 0.4;
const X0 = (-COLS * CELL) / 2;
const Z0 = (-ROWS * CELL) / 2;

function makeDraw(count: number): FigureDraw {
  return ({ ctx, w, h, t, hover, mx, my, pal }) => {
    if (w < 110 || h < 70) return;
    const on = smooth(hover);
    const s = Math.min(w * 0.262, h * 0.43);
    const c = camera(w * 0.5, h * 0.58, s, -0.3 + Math.sin(t * 0.2) * 0.04 + (mx / w - 0.5) * 0.16 * on, 0.9, 10);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    corners(ctx, w, h, pal.gold, 0.4);

    const quad = (xa: number, za: number, xb: number, zb: number) => {
      ctx.beginPath();
      pr(c, xa, 0, za);
      ctx.moveTo(P.x, P.y);
      pr(c, xb, 0, za);
      ctx.lineTo(P.x, P.y);
      pr(c, xb, 0, zb);
      ctx.lineTo(P.x, P.y);
      pr(c, xa, 0, zb);
      ctx.lineTo(P.x, P.y);
      ctx.closePath();
    };

    // the sheet and its heading band (the far edge)
    quad(X0, Z0, -X0, -Z0 + 0.26);
    ctx.fillStyle = rgba(pal.surface, 0.75);
    ctx.fill();
    ctx.fillStyle = rgba(pal.accent, 0.05);
    ctx.fill();
    quad(X0, -Z0, -X0, -Z0 + 0.26);
    ctx.fillStyle = rgba(pal.accent, 0.16);
    ctx.fill();

    // the band of light, and the pointer's cell
    const u = ((t * 0.16) % 1.5) - 0.25;
    let pc = -1;
    let pcBest = Infinity;
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        const xa = X0 + i * CELL;
        const za = Z0 + j * CELL;
        const v = (i / (COLS - 1)) * 0.62 + (1 - j / (ROWS - 1)) * 0.38;
        const lit = Math.exp(-(((v - u) / 0.11) ** 2));
        if (lit > 0.03) {
          quad(xa, za, xa + CELL, za + CELL);
          ctx.fillStyle = rgba(pal.accent, lit * 0.2);
          ctx.fill();
        }
        if (hover > 0.02) {
          pr(c, xa + CELL / 2, 0, za + CELL / 2);
          const d = (P.x - mx) ** 2 + (P.y - my) ** 2;
          if (d < pcBest) {
            pcBest = d;
            pc = j * COLS + i;
          }
        }
      }

    // the ruling: every cell present, every cell blank
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.5);
    for (let i = 1; i < COLS; i++) seg(ctx, c, X0 + i * CELL, 0, Z0, X0 + i * CELL, 0, -Z0 + 0.26);
    for (let j = 1; j <= ROWS; j++) seg(ctx, c, X0, 0, Z0 + j * CELL, -X0, 0, Z0 + j * CELL);
    quad(X0, Z0, -X0, -Z0 + 0.26);
    ctx.strokeStyle = rgba(pal.ink2, 0.85);
    ctx.stroke();

    if (pc >= 0) {
      const xa = X0 + (pc % COLS) * CELL;
      const za = Z0 + Math.floor(pc / COLS) * CELL;
      quad(xa, za, xa + CELL, za + CELL);
      ctx.fillStyle = rgba(pal.gold, 0.26 * on);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.gold, 0.95 * on);
      ctx.stroke();
    }

    // the releases: above the sheet, with no day of their own
    for (let k = 0; k < count; k++) {
      const x = Math.sin(t * (0.11 + k * 0.013) + k * 2.4) * (-X0 - 0.2);
      const z = Math.sin(t * (0.09 + k * 0.017) + k * 1.3 + 0.7) * (-Z0 - 0.15);
      const y = 0.46 + Math.sin(t * 0.6 + k * 1.9) * 0.06;
      discPath(ctx, c, x, 0, z, 1, 0, 0, 0, 0, 1, 0.09, 14);
      ctx.fillStyle = rgba(pal.ink, 0.2);
      ctx.fill();
      ctx.setLineDash([1, 3]);
      ctx.strokeStyle = rgba(pal.ink3, 0.6);
      seg(ctx, c, x, 0, z, x, y, z);
      ctx.setLineDash([]);
      pr(c, x, y, z);
      lamp(ctx, P.x, P.y, 2.1, pal.gold, 0.95);
    }
  };
}

export function EmptyCalendar({ count, ratio = 1.75 }: { count: number; ratio?: number }) {
  const draw = useMemo(() => makeDraw(count), [count]);
  return <Figure draw={draw} ratio={ratio} />;
}
