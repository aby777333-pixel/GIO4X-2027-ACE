"use client";

import { Figure, clamp, lerp, rgba, smooth, TAU, type FigureDraw } from "../Figure";
import { aim, caps, closeStage, dot, fract, glow, hash, lamp, makeCam, openStage, project } from "./kit";

/**
 * MetaTrader 5, beside the screenshot of the terminal: the one terminal taken
 * apart into the five things the page says it is for. Five panes of glass
 * float one above another, turning slowly: quotes (rows), charts (four
 * windows), technical analysis (a construction of circle and lines), order
 * entry (a field and two keys) and automated trading (a loop that runs by
 * itself). A bead of light rides the post that holds them together. The
 * windows hold a level wave and nothing else: no price, no candle, no symbol.
 *
 * Pointer: the stack opens further and turns to follow it, and the pane the
 * pointer is level with lifts, lights and is named.
 */

const NAMES = ["Automation", "Orders", "Analysis", "Charts", "Quotes"];
const LAYERS = NAMES.length;
const HX = 1; // half width of a pane
const HZ = 0.618; // half depth: a golden rectangle
const cam = makeCam();
const P = [0, 0, 0, 0];
const cyS = new Float32Array(LAYERS);

let ly = 0;
const mv = (ctx: CanvasRenderingContext2D, u: number, v: number) => {
  project(cam, u, ly, v, P);
  ctx.moveTo(P[0], P[1]);
};
const ln = (ctx: CanvasRenderingContext2D, u: number, v: number) => {
  project(cam, u, ly, v, P);
  ctx.lineTo(P[0], P[1]);
};
const rect = (ctx: CanvasRenderingContext2D, u0: number, v0: number, u1: number, v1: number) => {
  mv(ctx, u0, v0);
  ln(ctx, u1, v0);
  ln(ctx, u1, v1);
  ln(ctx, u0, v1);
  ctx.closePath();
};

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, my, pal } = f;
  if (w < 150 || h < 120) return;
  openStage(f, 0.45, 0.45);
  const hv = smooth(hover);

  const gap = 0.4 + 0.03 * Math.sin(t * 0.6) + 0.09 * hv;
  const yaw = -0.6 + 0.08 * Math.sin(t * 0.23) + (mx / w - 0.5) * 0.36 * hv;
  const pitch = 0.5 + (my / h - 0.5) * 0.14 * hv;
  const labels = w >= 330;
  const scale = Math.min((w * (labels ? 0.6 : 0.82)) / 2.4, (h * 0.8) / 2.8);
  aim(cam, w * (labels ? 0.39 : 0.5), h * 0.52, scale, 7, yaw, pitch);

  for (let i = 0; i < 20; i++) dot(ctx, w * hash(i, 61), h * hash(i, 62), 0.6, rgba(pal.ink, 0.1 + 0.14 * hash(i, 63)));

  // which pane the pointer is level with
  let near = -1;
  let nearD = 1e9;
  for (let i = 0; i < LAYERS; i++) {
    project(cam, 0, (i - 2) * gap, 0, P);
    cyS[i] = P[1];
    const d = Math.abs(P[1] - my);
    if (d < nearD) {
      nearD = d;
      near = i;
    }
  }

  // the light under the stack
  project(cam, 0, -2 * gap - 0.3, 0, P);
  glow(ctx, P[0], P[1], scale * 1.5, pal.accent, 0.12);

  for (let i = 0; i < LAYERS; i++) {
    const picked = i === near ? hv : 0;
    ly = (i - 2) * gap + picked * 0.07;
    const col = i === 0 ? pal.gold : i === 1 ? pal.emerald : i === 2 ? pal.teal : i === 3 ? pal.accent : pal.ink;

    // the post, from the pane below up to this one
    if (i > 0) {
      project(cam, -HX * 0.84, (i - 3) * gap, HZ * 0.72, P);
      const bx = P[0];
      const by = P[1];
      project(cam, -HX * 0.84, ly, HZ * 0.72, P);
      ctx.strokeStyle = rgba(pal.gold, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(P[0], P[1]);
      ctx.stroke();
    }

    // the pane
    ctx.beginPath();
    rect(ctx, -HX, -HZ, HX, HZ);
    ctx.fillStyle = rgba(pal.surface, 0.8);
    ctx.fill();
    ctx.fillStyle = rgba(col, 0.045 + 0.1 * picked);
    ctx.fill();
    ctx.strokeStyle = rgba(picked > 0.5 ? pal.gold : pal.ink2, 0.5 + 0.45 * picked);
    ctx.lineWidth = 1 + picked * 0.4;
    ctx.stroke();
    // its title bar
    ctx.strokeStyle = rgba(pal.ink3, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    mv(ctx, -HX, HZ * 0.74);
    ln(ctx, HX, HZ * 0.74);
    ctx.stroke();

    const a = 0.72 + 0.28 * picked;
    ctx.strokeStyle = rgba(col, a);
    ctx.fillStyle = rgba(col, 0.3 * a);
    ctx.lineWidth = 1.2;
    if (i === 4) {
      // quotes: rows, a name and two columns
      ctx.beginPath();
      for (let r = 0; r < 5; r++) {
        const v = HZ * (0.5 - r * 0.27);
        mv(ctx, -0.82, v);
        ln(ctx, -0.82 + 0.3 + hash(r, 64) * 0.22, v);
        mv(ctx, 0.05, v);
        ln(ctx, 0.3, v);
        mv(ctx, 0.5, v);
        ln(ctx, 0.75, v);
      }
      ctx.stroke();
      // one row is being read
      const r = Math.floor(fract(t * 0.14) * 5);
      const v = HZ * (0.5 - r * 0.27);
      ctx.beginPath();
      rect(ctx, -0.9, v - 0.07, 0.86, v + 0.07);
      ctx.fillStyle = rgba(col, 0.1);
      ctx.fill();
    } else if (i === 3) {
      // charts: four windows, each with a level wave
      ctx.strokeStyle = rgba(pal.ink3, 0.7);
      ctx.beginPath();
      mv(ctx, 0, -HZ);
      ln(ctx, 0, HZ * 0.74);
      mv(ctx, -HX, HZ * 0.06);
      ln(ctx, HX, HZ * 0.06);
      ctx.stroke();
      ctx.strokeStyle = rgba(col, a);
      for (let q = 0; q < 4; q++) {
        const u0 = q % 2 ? 0.1 : -0.9;
        const v0 = HZ * (q > 1 ? 0.4 : -0.47);
        ctx.beginPath();
        for (let s = 0; s <= 14; s++) {
          const u = u0 + (s / 14) * 0.8;
          const v = v0 + Math.sin(s * (0.7 + q * 0.23) + q * 2 + t * 0.5) * HZ * 0.16;
          if (s === 0) mv(ctx, u, v);
          else ln(ctx, u, v);
        }
        ctx.stroke();
      }
    } else if (i === 2) {
      // analysis: a circle, a chord through it and an arc struck from its edge
      ctx.beginPath();
      for (let s = 0; s <= 32; s++) {
        const an = (s / 32) * TAU;
        if (s === 0) mv(ctx, -0.25 + Math.cos(an) * 0.34, -0.06 + Math.sin(an) * 0.34);
        else ln(ctx, -0.25 + Math.cos(an) * 0.34, -0.06 + Math.sin(an) * 0.34);
      }
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.ink2, 0.7);
      ctx.beginPath();
      mv(ctx, -0.86, -0.44);
      ln(ctx, 0.84, 0.3);
      mv(ctx, -0.86, 0.3);
      ln(ctx, 0.84, -0.44);
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.gold, 0.9);
      ctx.beginPath();
      const sweep = fract(t * 0.1);
      for (let s = 0; s <= 16; s++) {
        const an = -0.9 + (s / 16) * 1.8 * (0.25 + 0.75 * sweep);
        if (s === 0) mv(ctx, 0.09 + Math.cos(an) * 0.55, -0.06 + Math.sin(an) * 0.55);
        else ln(ctx, 0.09 + Math.cos(an) * 0.55, -0.06 + Math.sin(an) * 0.55);
      }
      ctx.stroke();
    } else if (i === 1) {
      // orders: a field and two keys
      ctx.beginPath();
      rect(ctx, -0.84, -0.3, 0.84, -0.02);
      ctx.stroke();
      ctx.beginPath();
      rect(ctx, -0.84, 0.1, -0.06, 0.36);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      rect(ctx, 0.06, 0.1, 0.84, 0.36);
      ctx.stroke();
      // a caret in the field
      if (fract(t * 0.8) < 0.6) {
        ctx.beginPath();
        mv(ctx, -0.72, -0.25);
        ln(ctx, -0.72, -0.07);
        ctx.stroke();
      }
    } else {
      // automation: a loop of three steps, and a mark going round it by itself
      const nx = [-0.55, 0.1, 0.62];
      const nz = [0.02, -0.3, 0.16];
      ctx.beginPath();
      mv(ctx, nx[0], nz[0]);
      ln(ctx, nx[1], nz[1]);
      ln(ctx, nx[2], nz[2]);
      ctx.closePath();
      ctx.stroke();
      const go = fract(t * 0.22) * 3;
      const s = Math.floor(go);
      const e = go - s;
      project(cam, lerp(nx[s], nx[(s + 1) % 3], e), ly, lerp(nz[s], nz[(s + 1) % 3], e), P);
      lamp(ctx, P[0], P[1], 2, pal.ink, 1);
      for (let n = 0; n < 3; n++) {
        project(cam, nx[n], ly, nz[n], P);
        ctx.beginPath();
        ctx.arc(P[0], P[1], Math.max(2.5, P[2] * 0.045), 0, TAU);
        ctx.fillStyle = rgba(pal.surface, 1);
        ctx.fill();
        ctx.strokeStyle = rgba(col, a);
        ctx.stroke();
      }
    }

    // its name, off the right-hand corner
    if (labels) {
      project(cam, HX, ly, -HZ, P);
      const ax = P[0];
      const ay = P[1];
      project(cam, HX, ly, HZ, P);
      const ex = Math.max(ax, P[0]);
      const ey = ax > P[0] ? ay : P[1];
      ctx.strokeStyle = rgba(pal.gold, 0.3 + 0.6 * picked);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ex + 3, ey);
      ctx.lineTo(ex + 14, ey);
      ctx.stroke();
      caps(f, NAMES[i], ex + 19, ey + 3.5, rgba(pal.ink, clamp(0.55 + 0.45 * picked)), "left", 9.5);
    }
  }

  // the bead on the post
  const b = 0.5 - 0.5 * Math.cos(t * 0.7);
  project(cam, -HX * 0.84, lerp(-2 * gap, 2 * gap, b), HZ * 0.72, P);
  lamp(ctx, P[0], P[1], 2, pal.gold, 1);

  closeStage(f);
};

export function TerminalLayers() {
  return <Figure draw={draw} ratio={1.25} />;
}
