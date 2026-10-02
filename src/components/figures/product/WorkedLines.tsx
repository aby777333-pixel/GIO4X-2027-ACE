"use client";

import { Figure, rgba, smooth, type FigureDraw, type Palette } from "../Figure";
import { line, roundRect } from "./shapes";

/**
 * Trader Toolkit, "Arithmetic in the open, and nothing more": a sheet of
 * working. The top line is a formula, drawn as empty boxes joined by its
 * operators. Under it the same formula is worked with the boxes filled in,
 * one step to a line, down to a result ruled off with a double line. A tick
 * moves down the margin as each line is checked. The boxes hold no numbers:
 * the numbers are the visitor's own, in the tools.
 *
 * The pointer picks a term. That term lights in the formula and in every line
 * of the working where it is used, joined by a thread, so that any one figure
 * can be followed from the formula to the result.
 */

const TERMS = [70, 54, 46] as const; // box widths of the three terms
const RES = 62; // box width of the result
const GAP = 26; // room for an operator between boxes
const OPS = ["×", "÷", "="] as const;
const BOX = 20;

function tick(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette, a: number) {
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x - 1, y + 3.5);
  ctx.lineTo(x + 5, y - 4);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(pal.emerald, a);
  ctx.stroke();
}

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, pal }) => {
  // hidden below lg, the canvas has no size: nothing to draw
  if (w < 120 || h < 60) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const total = TERMS[0] + TERMS[1] + TERMS[2] + RES + GAP * 3;
  const k = Math.min(1, (w - 84) / total);
  const tw = TERMS.map((v) => v * k);
  const rw = RES * k;
  const gap = GAP * k;
  const left = (w - total * k) / 2 - 6;
  const xs = [left, left + tw[0] + gap, left + tw[0] + tw[1] + gap * 2];
  const xr = xs[2] + tw[2] + gap;
  const rows = [0.17, 0.4, 0.61, 0.83].map((v) => Math.round(h * v));
  const marginX = Math.round(left - 16) + 0.5;
  const tickX = xr + rw + 18;

  // the ruled sheet: a margin line and a rule under each line of working
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.gold, 0.55);
  line(ctx, marginX, 10, marginX, h - 10);
  ctx.strokeStyle = rgba(pal.line, 1);
  for (let r = 0; r < 3; r++) {
    const y = Math.round((rows[r] + rows[r + 1]) / 2) + 0.5;
    line(ctx, marginX, y, w - 14, y);
  }

  // which term the pointer is on
  const centres = [xs[0] + tw[0] / 2, xs[1] + tw[1] / 2, xs[2] + tw[2] / 2];
  let pick = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(mx - centres[i]) < Math.abs(mx - centres[pick])) pick = i;
  const on = smooth(hover);

  const op = (s: string, x: number, y: number, a = 0.8) => {
    ctx.font = `500 ${Math.round(13 * Math.max(0.85, k))}px ${pal.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = rgba(pal.ink2, a);
    ctx.fillText(s, x, y + 0.5);
  };
  const hollow = (x: number, y: number, bw: number, lit: number) => {
    roundRect(ctx, x, y - BOX / 2, bw, BOX, 3);
    ctx.lineWidth = 1 + lit * 0.5;
    ctx.strokeStyle = lit > 0.02 ? rgba(pal.accent, 0.5 + lit * 0.5) : rgba(pal.ink3, 0.75);
    ctx.stroke();
  };
  const filled = (x: number, y: number, bw: number, lit: number) => {
    roundRect(ctx, x, y - BOX / 2, bw, BOX, 3);
    ctx.fillStyle = lit > 0.02 ? rgba(pal.accent, 0.14 + lit * 0.5) : rgba(pal.ink3, 0.24);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = lit > 0.02 ? rgba(pal.accent, 0.6 + lit * 0.4) : rgba(pal.ink3, 0.5);
    ctx.stroke();
    // the figure written in the box, as a stroke
    ctx.strokeStyle = lit > 0.02 ? rgba(pal.surface, 0.9) : rgba(pal.ink2, 0.6);
    ctx.lineWidth = 1.5;
    line(ctx, x + 7, y, x + bw - 7 - bw * 0.25, y);
  };
  const pending = (x: number, y: number, bw: number) => {
    ctx.setLineDash([2, 3]);
    roundRect(ctx, x, y - BOX / 2, bw, BOX, 3);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.4);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const lit = (i: number) => (pick === i ? on : 0);

  // the thread that joins a picked term through the lines
  if (on > 0.02) {
    const cx = Math.round(centres[pick]) + 0.5;
    ctx.strokeStyle = rgba(pal.accent, 0.5 * on);
    ctx.lineWidth = 1;
    line(ctx, cx, rows[0] + BOX / 2, cx, rows[pick === 2 ? 2 : 1] - BOX / 2);
    if (pick !== 2) line(ctx, cx, rows[1] + BOX / 2, cx, rows[2] - BOX / 2);
  }

  // line 1: the formula, empty
  for (let i = 0; i < 3; i++) hollow(xs[i], rows[0], tw[i], lit(i));
  hollow(xr, rows[0], rw, 0);
  op(OPS[0], xs[0] + tw[0] + gap / 2, rows[0]);
  op(OPS[1], xs[1] + tw[1] + gap / 2, rows[0]);
  op(OPS[2], xs[2] + tw[2] + gap / 2, rows[0]);

  // line 2: the same, with the visitor's figures in the boxes
  for (let i = 0; i < 3; i++) filled(xs[i], rows[1], tw[i], lit(i));
  pending(xr, rows[1], rw);
  op(OPS[0], xs[0] + tw[0] + gap / 2, rows[1]);
  op(OPS[1], xs[1] + tw[1] + gap / 2, rows[1]);
  op(OPS[2], xs[2] + tw[2] + gap / 2, rows[1], 0.4);

  // line 3: the first two multiplied out
  filled(xs[0], rows[2], tw[0] + gap + tw[1], pick === 2 ? 0 : on);
  filled(xs[2], rows[2], tw[2], lit(2));
  pending(xr, rows[2], rw);
  op(OPS[1], xs[1] + tw[1] + gap / 2, rows[2]);
  op(OPS[2], xs[2] + tw[2] + gap / 2, rows[2], 0.4);

  // line 4: the result, ruled off twice as a total is
  op(OPS[2], xs[2] + tw[2] + gap / 2, rows[3]);
  roundRect(ctx, xr, rows[3] - BOX / 2, rw, BOX, 3);
  ctx.fillStyle = rgba(pal.ink, 0.86);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.surface, 0.9);
  ctx.lineWidth = 1.5;
  line(ctx, xr + 7, rows[3], xr + rw - 7 - rw * 0.25, rows[3]);
  ctx.strokeStyle = rgba(pal.ink, 0.8);
  ctx.lineWidth = 1;
  line(ctx, xr, rows[3] + BOX / 2 + 4.5, xr + rw, rows[3] + BOX / 2 + 4.5);
  line(ctx, xr, rows[3] + BOX / 2 + 7.5, xr + rw, rows[3] + BOX / 2 + 7.5);
  // a faint carry line from the working to the result
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = rgba(pal.ink3, 0.45);
  line(ctx, xs[0], rows[3], xs[2] + tw[2], rows[3]);
  ctx.setLineDash([]);

  // checking by hand: a tick goes down the margin, line by line, then starts again
  const cycle = (t / 1.5) % 5.2;
  for (let r = 0; r < 4; r++) {
    const a = smooth((cycle - r) / 0.5) * (1 - smooth((cycle - 4.6) / 0.6));
    if (a > 0.01) tick(ctx, tickX, rows[r], pal, a);
  }
};

export function WorkedLines() {
  return <Figure draw={draw} ratio={1.9} />;
}
