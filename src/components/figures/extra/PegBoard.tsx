"use client";

import { useMemo } from "react";
import { Figure, clamp, rgba, smooth, type FigureDraw } from "../Figure";
import { P, camera, corners, discPath, lamp, pr, seg } from "../markets/kit";

/**
 * What we disclose, beside "The ledger today": the ledger as a peg board. One
 * row for each group of the table below the stage and one hole for each item
 * in it, in the table's own order. A published item has a peg standing in its
 * hole; an item not yet published is an open hole. The counts are the page's
 * own (it is given the same list the table is drawn from) and nothing else in
 * it is a quantity. A band of light crosses the board and the pegs answer.
 *
 * Pointer: the hole nearest to it is ringed in champagne, peg or no peg, and
 * the board turns a little toward the pointer.
 */

const CELL = 0.42;

function makeDraw(rows: boolean[][]): FigureDraw {
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 1);
  const W = cols * CELL;
  const D = rows.length * CELL;
  return ({ ctx, w, h, t, hover, mx, my, pal }) => {
    if (w < 110 || h < 60 || rows.length === 0) return;
    const on = smooth(hover);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    corners(ctx, w, h, pal.gold, 0.4);
    const s = Math.min((w * 0.74) / W, (h * 0.62) / (D * 0.8 + 0.3));
    const c = camera(w * 0.5, h * 0.6, s, -0.34 + Math.sin(t * 0.2) * 0.05 + (mx / w - 0.5) * 0.2 * on, 0.86, 9);

    // the board
    const x0 = -W / 2 - 0.12;
    const x1 = W / 2 + 0.12;
    const z0 = -D / 2 - 0.1;
    const z1 = D / 2 + 0.1;
    ctx.beginPath();
    pr(c, x0, 0, z0);
    ctx.moveTo(P.x, P.y);
    pr(c, x1, 0, z0);
    ctx.lineTo(P.x, P.y);
    pr(c, x1, 0, z1);
    ctx.lineTo(P.x, P.y);
    pr(c, x0, 0, z1);
    ctx.lineTo(P.x, P.y);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.surface, 0.5);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.8);
    ctx.stroke();
    // the rule under each group's row
    ctx.strokeStyle = rgba(pal.ink3, 0.3);
    for (let r = 1; r < rows.length; r++) {
      const z = D / 2 - r * CELL;
      seg(ctx, c, x0, 0, z, x1, 0, z);
    }

    // the band of light, crossing from the first column to the last and resting between passes
    const band = -W / 2 + (((t * 0.16) % 1) / 0.7) * (W + 0.6) - 0.3;

    // the hole nearest the pointer
    let pick = -1;
    if (on > 0.02) {
      let best = 1e9;
      for (let r = 0; r < rows.length; r++) {
        for (let k = 0; k < rows[r].length; k++) {
          pr(c, -W / 2 + (k + 0.5) * CELL, 0, D / 2 - (r + 0.5) * CELL);
          const d = Math.hypot(P.x - mx, P.y - my);
          if (d < best) {
            best = d;
            pick = r * 64 + k;
          }
        }
      }
    }

    // far rows first: the first group is the far row, as it is the top of the table
    for (let r = 0; r < rows.length; r++) {
      const z = D / 2 - (r + 0.5) * CELL;
      for (let k = 0; k < rows[r].length; k++) {
        const x = -W / 2 + (k + 0.5) * CELL;
        const lit = clamp(1 - Math.abs(x - band) / 0.5);
        const chosen = pick === r * 64 + k ? on : 0;
        discPath(ctx, c, x, 0, z, 1, 0, 0, 0, 0, 1, 0.1, 14);
        ctx.fillStyle = rgba(pal.ink, 0.1);
        ctx.fill();
        ctx.lineWidth = 1 + chosen * 0.5;
        ctx.strokeStyle = chosen > 0.02 ? rgba(pal.gold, 0.5 + chosen * 0.5) : rgba(pal.ink3, 0.75);
        ctx.stroke();
        if (!rows[r][k]) continue;
        const top = 0.34 + lit * 0.05 + chosen * 0.08;
        ctx.lineWidth = 2;
        ctx.strokeStyle = rgba(pal.ink, 0.85);
        seg(ctx, c, x, 0, z, x, top, z);
        pr(c, x, top, z);
        lamp(ctx, P.x, P.y, 2 + chosen * 0.8, pal.gold, 0.7 + lit * 0.3);
      }
    }
  };
}

export function PegBoard({ rows, ratio = 1.75 }: { rows: boolean[][]; ratio?: number }) {
  const key = rows.map((r) => r.map((v) => (v ? "1" : "0")).join("")).join("|");
  // the list is the page's own and does not change while the page is open: redraw only if its content does
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draw = useMemo(() => makeDraw(rows), [key]);
  return <Figure draw={draw} ratio={ratio} />;
}
