"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { caps, closeStage, dot, glow, hash, line, openStage } from "./kit";

/**
 * Trust Centre, beside the disclosure ledger: "Trust is not a claim. It is an
 * architecture." A colonnade of seven columns runs away into the night, one
 * column for each section of the Trust Centre, carrying one beam. A light
 * walks the colonnade from the nearest column to the furthest; the column it
 * reaches is lit and named with that section's one-word purpose, as the list
 * below the stage gives it: verify, protect, ask, disclose, source, bound,
 * correct. There is no seal and no shield anywhere in it.
 *
 * Pointer: the light goes to the column under the pointer and stays there.
 */

const WORDS = ["Verify", "Protect", "Ask", "Disclose", "Source", "Bound", "Correct"];
const N = WORDS.length;

type State = { at: number };
const states = new WeakMap<CanvasRenderingContext2D, State>();

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, dt, hover, mx, pal, still } = f;
  if (w < 150 || h < 56) return;
  openStage(f, 0.86, 0.46);
  const hv = smooth(hover);
  const small = h < 110;

  // one vanishing point, off to the right at eye height
  const vx = w * 1.26;
  const vy = h * 0.45;
  const nearX = w * 0.085;
  const top0 = h * 0.13;
  const base0 = h * (small ? 0.86 : 0.78);
  const depthOf = (k: number) => 1 + k * 0.31;
  const colX = (k: number) => vx - (vx - nearX) / depthOf(k);
  const topY = (k: number) => vy - (vy - top0) / depthOf(k);
  const baseY = (k: number) => vy + (base0 - vy) / depthOf(k);

  // which column the light is at
  let want = (t * 0.5) % N;
  if (hv > 0.5) {
    let best = 0;
    let bd = 1e9;
    for (let k = 0; k < N; k++) {
      const d = Math.abs(colX(k) - mx);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    want = best;
  } else want = Math.floor(want);
  let st = states.get(ctx);
  if (!st) {
    st = { at: want };
    states.set(ctx, st);
  }
  st.at = still ? want : st.at + (want - st.at) * (1 - Math.exp(-dt * 6));

  for (let i = 0; i < 16; i++) dot(ctx, w * hash(i, 71), h * 0.5 * hash(i, 72), 0.6, rgba(pal.ink, 0.1 + 0.14 * hash(i, 73)));

  // the light at the far end, where the lines meet
  glow(ctx, w * 0.97, vy, h * 0.9, pal.accent, 0.2);

  // the floor: the step the columns stand on, and the lines of the paving
  ctx.lineWidth = 1;
  for (let j = 0; j < 4; j++) {
    const y0 = base0 + (h - base0) * (j / 3) * 1.5;
    ctx.strokeStyle = rgba(pal.ink3, j === 0 ? 0.7 : 0.2);
    line(ctx, 0, vy + (y0 - vy) * ((vx - 0) / (vx - nearX)), w, vy + (y0 - vy) * ((vx - w) / (vx - nearX)));
  }
  // the beam the columns carry: two lines, closing on the vanishing point
  for (let j = 0; j < 2; j++) {
    const y0 = top0 - (j ? h * 0.06 : 0);
    ctx.strokeStyle = rgba(j ? pal.gold : pal.ink2, j ? 0.7 : 0.8);
    line(ctx, 0, vy + (y0 - vy) * (vx / (vx - nearX)), w, vy + (y0 - vy) * ((vx - w) / (vx - nearX)));
  }

  // the columns, far to near
  for (let k = N - 1; k >= 0; k--) {
    const d = depthOf(k);
    const x = colX(k);
    const y0 = topY(k);
    const y1 = baseY(k);
    const cw = Math.max(3, (w * 0.05) / d);
    const lit = clamp(1 - Math.abs(st.at - k));
    const a = lerp(0.5, 1, 1 / d);

    // its light on the floor, falling towards the viewer
    ctx.beginPath();
    ctx.moveTo(x - cw / 2, y1);
    ctx.lineTo(x + cw / 2, y1);
    ctx.lineTo(x + cw / 2 - (h - y1) * 0.7, h);
    ctx.lineTo(x - cw / 2 - (h - y1) * 0.7 - cw, h);
    ctx.closePath();
    ctx.fillStyle = rgba(lit > 0.02 ? pal.gold : pal.ink, 0.035 + 0.12 * lit);
    ctx.fill();

    if (lit > 0.02) glow(ctx, x, lerp(y0, y1, 0.4), (y1 - y0) * 0.8, pal.gold, 0.26 * lit);
    // the shaft, with a slight swelling, lit from the far end
    const g = ctx.createLinearGradient(x - cw / 2, 0, x + cw / 2, 0);
    g.addColorStop(0, rgba(pal.surface, 1));
    g.addColorStop(1, rgba(pal.ink3, 0.5 + 0.2 * lit));
    ctx.fillStyle = g;
    ctx.fillRect(x - cw / 2, y0, cw, y1 - y0);
    ctx.fillStyle = rgba(pal.gold, 0.22 * lit);
    ctx.fillRect(x - cw / 2, y0, cw, y1 - y0);
    ctx.strokeStyle = rgba(lit > 0.5 ? pal.gold : pal.ink2, (0.55 + 0.45 * lit) * a);
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x - cw / 2) + 0.5, y0, Math.round(cw), y1 - y0);
    // flutes
    if (cw > 9) {
      ctx.strokeStyle = rgba(pal.ink3, 0.4);
      line(ctx, x - cw * 0.17, y0 + 3, x - cw * 0.17, y1 - 3);
      line(ctx, x + cw * 0.17, y0 + 3, x + cw * 0.17, y1 - 3);
    }
    // capital and base
    ctx.strokeStyle = rgba(lit > 0.5 ? pal.gold : pal.ink, (0.7 + 0.3 * lit) * a);
    ctx.lineWidth = 1.5;
    line(ctx, x - cw * 0.85, y0, x + cw * 0.85, y0);
    line(ctx, x - cw * 0.85, y1, x + cw * 0.85, y1);

    // its word, under the base
    if (!small && lit > 0.05) {
      const wy = h - 9;
      if (wy - 12 > y1 + 6) {
        ctx.strokeStyle = rgba(pal.gold, 0.5 * lit);
        ctx.lineWidth = 1;
        line(ctx, x, y1 + 5, x, wy - 12);
      }
      caps(f, WORDS[k], k === 0 ? x - cw * 0.85 : x, wy, rgba(pal.ink, clamp(lit * 1.2)), k === 0 ? "left" : "center", 9.5);
    }
  }

  closeStage(f);
};

export function Colonnade() {
  return <Figure draw={draw} ratio={2.8} />;
}
