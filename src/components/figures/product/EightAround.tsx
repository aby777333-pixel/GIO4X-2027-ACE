"use client";

import { Figure, TAU, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { line } from "./shapes";

/**
 * Currency Strength, "How it is calculated.": the eight currencies set round a
 * table, each joined to the other seven. One at a time is taken as the
 * subject: its seven lines light, and a mark travels in along each of them,
 * which is the method in a picture: a currency's figure is the average of its
 * change against each of the other seven. No value is drawn anywhere.
 *
 * The pointer chooses the subject: the nearest currency takes its turn, and
 * the round resumes when the pointer leaves.
 */

const CODES = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"] as const;
const N = CODES.length;
const TURN = 2.6; // seconds each currency is the subject

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  // hidden below lg, the canvas has no size: nothing to draw
  if (w < 120 || h < 60) return;
  const cx = w / 2;
  const cy = h / 2;
  const rx = Math.min(w * 0.36, h * 0.86);
  const ry = h * 0.3;
  const px = (i: number) => cx + Math.cos(-Math.PI / 2 + (i / N) * TAU) * rx;
  const py = (i: number) => cy + Math.sin(-Math.PI / 2 + (i / N) * TAU) * ry;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the subject: by turns, or the one nearest the pointer
  const turn = t / TURN;
  let subject = Math.floor(turn) % N;
  // each turn fades in and out, so the change of subject is not a jump
  const phase = turn % 1;
  let strength = smooth(phase / 0.18) * (1 - smooth((phase - 0.86) / 0.14));
  if (hover > 0.02) {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const d = (px(i) - mx) ** 2 + (py(i) - my) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best !== subject) strength *= 1 - smooth(hover * 2);
    if (hover > 0.5 || best === subject) {
      subject = best;
      strength = lerp(strength, 1, smooth(hover));
    }
  }

  // the table's edge
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.line, 1);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.stroke();

  // every pair, faintly: twenty-eight lines
  ctx.strokeStyle = rgba(pal.ink3, 0.2);
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) line(ctx, px(i), py(i), px(j), py(j));

  // the subject's seven, and a mark coming in along each
  const sx = px(subject);
  const sy = py(subject);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = rgba(pal.accent, 0.85 * strength);
  for (let i = 0; i < N; i++) if (i !== subject) line(ctx, sx, sy, px(i), py(i));
  ctx.fillStyle = rgba(pal.accent, strength);
  for (let i = 0; i < N; i++) {
    if (i === subject) continue;
    const u = smooth(((t * 0.42 + i * 0.137) % 1) / 0.9);
    ctx.beginPath();
    ctx.arc(lerp(px(i), sx, u), lerp(py(i), sy, u), 2, 0, TAU);
    ctx.fill();
  }

  // the eight seats and their codes
  ctx.font = `600 10px ${pal.font}`;
  ctx.textBaseline = "middle";
  for (let i = 0; i < N; i++) {
    const x = px(i);
    const y = py(i);
    const is = i === subject ? strength : 0;
    ctx.beginPath();
    ctx.arc(x, y, 6 + is * 2.5, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = is > 0.02 ? rgba(pal.accent, 0.5 + is * 0.5) : rgba(pal.ink2, 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2 + is * 1.6, 0, TAU);
    ctx.fillStyle = is > 0.02 ? rgba(pal.accent, 0.4 + is * 0.6) : rgba(pal.ink3, 0.9);
    ctx.fill();

    // the code sits outside the table, away from the centre
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    ctx.textAlign = Math.abs(dx) < 0.2 ? "center" : dx > 0 ? "left" : "right";
    ctx.fillStyle = is > 0.5 ? rgba(pal.ink, 1) : rgba(pal.ink3, 1);
    ctx.fillText(CODES[i], x + dx * 14, y + dy * 15 + (Math.abs(dx) < 0.2 ? dy * 2 : 0));
  }
};

export function EightAround() {
  return <Figure draw={draw} ratio={2.15} />;
}
