"use client";

import { useMemo } from "react";
import { Figure, rgba, smooth, type FigureDraw } from "../Figure";
import { PHI, P, camera, caps, corners, glow, lamp, pr, seg } from "./kit";

/**
 * Market Command, beside "Trading now": the six asset classes as six panes of
 * glass standing one behind another, seen from the side. Each pane carries one
 * point of light for every instrument the site lists in that class (the counts
 * come from the instrument list, nothing else is a quantity) and its name at
 * its foot. A single line runs through all six, and a point of light travels
 * along it from the first pane to the last: one overview, six structures.
 *
 * The pointer picks the nearest pane: it rises, takes the champagne light and
 * the others step back; the whole stack turns a little toward the pointer.
 */

export type Deck = { name: string; count: number };

function makeDraw(decks: Deck[]): FigureDraw {
  const n = decks.length;
  return ({ ctx, w, h, t, hover, mx, pal }) => {
    if (w < 150 || h < 70 || n === 0) return;
    const on = smooth(hover);
    const s = Math.min(w * 0.365, h * 0.97);
    const yaw = 0.95 + Math.sin(t * 0.23) * 0.035 - (mx / w - 0.5) * 0.3 * on;
    const c = camera(w * 0.5, h * 0.41, s, yaw, 0.1, 6);
    const a = 0.5;
    const b = a / PHI;
    const dz = 2.2 / Math.max(1, n - 1);
    const zOf = (i: number) => (i - (n - 1) / 2) * dz;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    corners(ctx, w, h, pal.gold, 0.4);

    // the pointer's pick: the pane whose centre is nearest in x
    let pick = -1;
    if (hover > 0.02) {
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        const dx = Math.abs(pr(c, 0, 0, zOf(i)).x - mx);
        if (dx < best) {
          best = dx;
          pick = i;
        }
      }
    }

    // the travelling light: from the first pane to the last, then again
    const span = 2.2 + 1.2;
    const zb = -1.1 - 0.6 + ((t * 0.42) % span);
    const lead = Math.max(0, Math.min(n - 1, Math.round(zb / dz + (n - 1) / 2)));

    // the line through all six
    pr(c, 0, 0, -1.1 - 0.3);
    const x0 = P.x;
    const y0 = P.y;
    pr(c, 0, 0, 1.1 + 0.3);
    const x1 = P.x;
    const y1 = P.y;

    // the rack the panes stand in: two rails along their feet
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.3);
    seg(ctx, c, -a, -b, -1.1 - 0.14, -a, -b, 1.1 + 0.14);
    seg(ctx, c, a, -b, -1.1 - 0.14, a, -b, 1.1 + 0.14);

    for (let i = n - 1; i >= 0; i--) {
      const z = zOf(i);
      const sel = i === pick ? on : 0;
      const dim = pick < 0 ? 1 : 1 - on * (i === pick ? 0 : 0.5);
      const near = Math.exp(-(((zb - z) / 0.3) ** 2));
      const lift = sel * 0.07;

      pr(c, -a, -b + lift, z);
      const ax = P.x;
      const ay = P.y;
      pr(c, a, -b + lift, z);
      const bx = P.x;
      const by = P.y;
      pr(c, a, b + lift, z);
      const cx = P.x;
      const cy = P.y;
      pr(c, -a, b + lift, z);
      const dx = P.x;
      const dy = P.y;

      // the part of the through-line behind this pane is drawn before the pane
      if (i === n - 1) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(pal.gold, 0.32);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }

      // the glass
      const g = ctx.createLinearGradient(0, dy, 0, ay);
      const tint = sel > 0.02 ? pal.gold : pal.accent;
      g.addColorStop(0, rgba(tint, (0.16 + near * 0.12 + sel * 0.1) * dim));
      g.addColorStop(1, rgba(tint, (0.03 + near * 0.03) * dim));
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.lineTo(dx, dy);
      ctx.closePath();
      ctx.fillStyle = rgba(pal.surface, 0.55);
      ctx.fill();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = sel > 0.02 ? rgba(pal.gold, 0.45 + sel * 0.5) : rgba(pal.ink3, (0.62 + near * 0.3) * dim);
      ctx.stroke();
      // the lit top edge
      ctx.strokeStyle = sel > 0.02 ? rgba(pal.gold, 0.9) : rgba(pal.ink, (0.45 + near * 0.4) * dim);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      // one point of light for each instrument in the class
      const count = decks[i].count;
      const cols = count > 6 ? 4 : count > 4 ? 3 : 2;
      const rows = Math.ceil(count / cols);
      for (let k = 0; k < count; k++) {
        const col = k % cols;
        const row = Math.floor(k / cols);
        const inRow = row === rows - 1 ? count - row * cols : cols;
        const px = (col - (inRow - 1) / 2) * ((a * 1.3) / Math.max(cols, 2));
        const py = ((rows - 1) / 2 - row) * ((b * 1.25) / Math.max(rows, 2)) + lift;
        pr(c, px, py, z);
        const breathe = 0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7 + k * 0.9);
        const level = (0.66 + breathe * 0.2 + near * 0.3 + sel * 0.3) * dim;
        lamp(ctx, P.x, P.y, 1.5 * P.k + sel * 0.5, sel > 0.02 ? pal.gold : pal.accent, Math.min(1, level));
      }

      // where the through-line crosses the pane
      pr(c, 0, 0, z);
      glow(ctx, P.x, P.y, 16 + near * 10, pal.gold, near * 0.35 * dim);

      // its name, at its foot; where the names would run into each other, only the pane the light or the pointer is at
      pr(c, 0, -b - 0.16, z);
      const shown = w >= 440 ? 1 : pick >= 0 ? sel : i === lead ? Math.min(1, near * 1.5) : 0;
      if (shown > 0.03) caps(ctx, decks[i].name, P.x, P.y, pal.font, sel > 0.02 ? rgba(pal.gold, (0.6 + sel * 0.4) * shown) : rgba(pal.ink3, (0.8 + near * 0.2) * dim * shown), 9);
    }

    // the light itself, in front of everything it has passed
    pr(c, 0, 0, Math.max(-1.4, Math.min(1.4, zb)));
    lamp(ctx, P.x, P.y, 1.8, pal.gold, 0.95);
  };
}

export function SixDecks({ decks, ratio = PHI * PHI }: { decks: Deck[]; ratio?: number }) {
  const key = decks.map((d) => `${d.name}:${d.count}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draw = useMemo(() => makeDraw(decks), [key]);
  return <Figure draw={draw} ratio={ratio} />;
}
