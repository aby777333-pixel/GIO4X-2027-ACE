"use client";

import { Figure, clamp, rgba, smooth, type FigureDraw } from "../Figure";
import { line, roundRect } from "./shapes";

/**
 * MetaTrader 5, "What GIO4X has still to publish": a rack of seven pigeonholes,
 * one for each detail in the list beside it. Every hole holds only the dashed
 * outline of a sheet, because nothing has been filed yet. A band of light
 * passes slowly along the rack and the dashes creep round each outline.
 *
 * The pointer lifts the nearest outline out of its hole for a look: it is
 * still an outline, and it settles back when the pointer leaves.
 */

const SLOTS = 7;
/** length of each hole's label, as a share of the hole's width (fixed) */
const LABEL = [0.44, 0.62, 0.52, 0.66, 0.4, 0.58, 0.48];

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, pal }) => {
  // hidden below lg, the canvas has no size: nothing to draw
  if (w < 120 || h < 60) return;
  const mxn = 16;
  const top = h * 0.17;
  const base = h * 0.84;
  const span = w - mxn * 2;
  const cell = span / SLOTS;
  const sw = Math.min(cell * 0.56, 34);
  const sh = Math.min(base - top - 30, sw * 1.42);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the rack: a shelf, a back rail and the dividers between the holes
  ctx.strokeStyle = rgba(pal.ink2, 0.85);
  ctx.lineWidth = 1;
  line(ctx, mxn, base + 0.5, w - mxn, base + 0.5);
  ctx.strokeStyle = rgba(pal.ink3, 0.4);
  line(ctx, mxn + 6, base + 5.5, w - mxn - 6, base + 5.5);
  ctx.strokeStyle = rgba(pal.ink3, 0.7);
  line(ctx, mxn, top - 6.5, w - mxn, top - 6.5);
  for (let i = 0; i <= SLOTS; i++) {
    const x = Math.round(mxn + i * cell) + 0.5;
    ctx.strokeStyle = rgba(pal.ink3, i === 0 || i === SLOTS ? 0.8 : 0.5);
    line(ctx, x, top - 6, x, base);
  }
  // each hole is labelled: the name of the detail is known, its content is not
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(pal.ink, 0.62);
  for (let i = 0; i < SLOTS; i++) {
    const cx = mxn + (i + 0.5) * cell;
    const half = cell * LABEL[i] * 0.5;
    line(ctx, cx - half, top + 2, cx + half, top + 2);
  }
  ctx.lineWidth = 1;

  // the band of light travelling along the rack
  const sweep = mxn + (((t * 0.085) % 1.3) - 0.15) * span;

  for (let i = 0; i < SLOTS; i++) {
    const cx = mxn + (i + 0.5) * cell;
    const near = hover * smooth(1 - Math.abs(mx - cx) / (cell * 0.85));
    const lit = smooth(1 - Math.abs(sweep - cx) / (cell * 1.2));
    const lift = near * 13 + lit * 2;
    const x = cx - sw / 2;
    const y = base - 5 - sh - lift;

    // a second outline behind gives the sheet a little depth
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(pal.ink3, 0.3 + near * 0.1);
    roundRect(ctx, x + 3, y - 3, sw, sh, 2);
    ctx.stroke();

    // the sheet that is not there yet: surface-coloured, dashed
    roundRect(ctx, x, y, sw, sh, 2);
    ctx.fillStyle = rgba(pal.surface, 0.7);
    ctx.fill();
    ctx.setLineDash([3.5, 3.5]);
    ctx.lineDashOffset = -t * 3;
    ctx.lineWidth = 1 + near * 0.4;
    ctx.strokeStyle = near > 0.02 ? rgba(pal.accent, 0.45 + near * 0.5) : rgba(pal.ink2, 0.72 + lit * 0.28);
    ctx.stroke();

    // where its lines of text would be
    ctx.setLineDash([2, 4]);
    ctx.lineDashOffset = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.6 + lit * 0.25 + near * 0.15);
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const ry = y + sh * (0.3 + r * 0.2);
      line(ctx, x + sw * 0.2, ry, x + sw * (r === rows - 1 ? 0.56 : 0.8), ry);
    }
    ctx.setLineDash([]);

    // the "not yet published" mark above the lifted one: a small dashed square
    if (near > 0.02) {
      const s = 7;
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = rgba(pal.accent, clamp(near));
      ctx.strokeRect(Math.round(cx - s / 2) + 0.5, Math.round(y - 13 - s) + 0.5, s, s);
      ctx.setLineDash([]);
    }
  }

  // the light itself, very faint, over the rack
  const g = ctx.createLinearGradient(sweep - cell * 1.4, 0, sweep + cell * 1.4, 0);
  g.addColorStop(0, rgba(pal.gold, 0));
  g.addColorStop(0.5, rgba(pal.gold, 0.14));
  g.addColorStop(1, rgba(pal.gold, 0));
  ctx.fillStyle = g;
  ctx.fillRect(mxn, top - 6, span, base - top + 6);
};

export function PendingRack() {
  return <Figure draw={draw} ratio={2.8} />;
}
