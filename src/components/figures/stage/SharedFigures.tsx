"use client";

import { Figure, clamp, lerp, rgba, smooth, TAU, type FigureDraw } from "../Figure";
import { aim, closeStage, dot, fract, glow, GOLDEN_ANGLE, hash, lamp, line, makeCam, openStage, project } from "./kit";

/**
 * Trader Toolkit, beside "Try it here": one set of figures, read by twelve
 * tools. A spine of six fine lines (instrument, account currency, balance, lot
 * size, leverage, risk) stands in the middle of the window. Twelve dials hang
 * round it on a slow helix, each turned from the last by the golden angle so
 * that no two line up, each joined to the spine by a thread that a pulse runs
 * out along. On every dial the champagne arc is the shared input, and it is
 * the same on all twelve; the blue needle is that tool's own working, and it
 * differs from dial to dial. No dial carries a number.
 *
 * Pointer: moving it across the window sets the shared input. All twelve arcs
 * follow at once and every needle answers in its own way: set once, used
 * everywhere. The dial nearest the pointer comes forward.
 */

const N = 12;
const STRANDS = 6;
const HEIGHT = 2.2;
const RADIUS = 0.88;
const cam = makeCam();
const P = [0, 0, 0, 0];
const Q = [0, 0, 0, 0];
// per-dial scratch, reused every frame
const sx = new Float32Array(N);
const sy = new Float32Array(N);
const ss = new Float32Array(N);
const sz = new Float32Array(N);
const order = new Uint8Array(N);

const A0 = -TAU * 0.25 - TAU * 0.34;
const SWEEP = TAU * 0.68;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, my, pal } = f;
  if (w < 150 || h < 150) return;
  openStage(f, 0.5, 0.382);

  const hv = smooth(hover);
  const scale = Math.min((h * 0.73) / HEIGHT, (w * 0.84) / (RADIUS * 2 + 0.42));
  aim(cam, w * 0.5, h * 0.515, scale, 4.4, 0, 0.2 + (my / h - 0.5) * 0.16 * hv);
  const spin = t * 0.17;
  // the shared input: it drifts on its own, and follows the pointer across the window
  const v = lerp(0.5 + 0.36 * Math.sin(t * 0.55), clamp((mx - w * 0.1) / (w * 0.8)), hv);

  // dust, for depth: seeded specks that turn with the helix
  for (let i = 0; i < 34; i++) {
    const a = hash(i, 1) * TAU + spin * (0.4 + hash(i, 2) * 0.5);
    const r = 0.7 + hash(i, 3) * 1.3;
    project(cam, Math.cos(a) * r, (hash(i, 4) - 0.5) * HEIGHT * 1.15, Math.sin(a) * r, P);
    dot(ctx, P[0], P[1], 0.5 + hash(i, 5) * 0.7, rgba(pal.ink, 0.1 + 0.16 * hash(i, 6)));
  }

  // three rails round the spine: the cylinder the dials ride on
  ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    const y = (HEIGHT / 2) * (1 - k) * 0.94;
    ctx.beginPath();
    for (let j = 0; j <= 48; j++) {
      const a = (j / 48) * TAU;
      project(cam, Math.cos(a) * RADIUS, y, Math.sin(a) * RADIUS, P);
      if (j === 0) ctx.moveTo(P[0], P[1]);
      else ctx.lineTo(P[0], P[1]);
    }
    ctx.strokeStyle = rgba(k === 1 ? pal.gold : pal.ink3, k === 1 ? 0.3 : 0.24);
    ctx.stroke();
  }

  // where each dial stands this frame
  let near = -1;
  let nearD = 1e9;
  for (let i = 0; i < N; i++) {
    const a = i * GOLDEN_ANGLE + spin;
    const y = HEIGHT / 2 - ((i + 0.5) / N) * HEIGHT;
    project(cam, Math.cos(a) * RADIUS, y, Math.sin(a) * RADIUS, P);
    sx[i] = P[0];
    sy[i] = P[1];
    ss[i] = P[2];
    sz[i] = P[3];
    order[i] = i;
    const d = Math.hypot(P[0] - mx, P[1] - my);
    if (d < nearD) {
      nearD = d;
      near = i;
    }
  }
  // far to near
  for (let i = 1; i < N; i++) {
    const o = order[i];
    let j = i - 1;
    while (j >= 0 && sz[order[j]] < sz[o]) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = o;
  }

  const drawDial = (i: number) => {
    const x = sx[i];
    const y = sy[i];
    const front = clamp(0.5 - sz[i] / (RADIUS * 2));
    const picked = i === near ? hv : 0;
    const a = lerp(0.42, 1, front);
    const r = 0.168 * ss[i] * (1 + 0.16 * picked);
    const wy = HEIGHT / 2 - ((i + 0.5) / N) * HEIGHT;

    // the thread back to the spine, and the pulse that runs out along it
    project(cam, 0, wy, 0, Q);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.accent, (0.3 + 0.5 * picked) * a);
    line(ctx, Q[0], Q[1], x, y);
    const p = fract(t * 0.32 + i * 0.382);
    lamp(ctx, lerp(Q[0], x, p), lerp(Q[1], y, p), 1.3, pal.accent, (1 - p * 0.6) * a * 0.9);

    // the face
    if (picked > 0.01) glow(ctx, x, y, r * 2.6, pal.accent, 0.28 * picked);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 0.94);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink2, (0.4 + 0.5 * picked) * a);
    ctx.lineWidth = 1;
    ctx.stroke();

    if (r > 9) {
      // the scale: nine marks, no numbers
      ctx.strokeStyle = rgba(pal.ink3, 0.75 * a);
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const ta = A0 + (k / 8) * SWEEP;
        ctx.moveTo(x + Math.cos(ta) * r * 0.8, y + Math.sin(ta) * r * 0.8);
        ctx.lineTo(x + Math.cos(ta) * r * (k % 4 === 0 ? 0.62 : 0.7), y + Math.sin(ta) * r * (k % 4 === 0 ? 0.62 : 0.7));
      }
      ctx.stroke();
    }

    // the shared input: the same arc on every dial
    const av = A0 + v * SWEEP;
    ctx.strokeStyle = rgba(pal.gold, a);
    ctx.lineWidth = Math.max(1.5, r * 0.11);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.92, A0, av);
    ctx.stroke();
    dot(ctx, x + Math.cos(av) * r * 0.92, y + Math.sin(av) * r * 0.92, Math.max(1.4, r * 0.1), rgba(pal.gold, a));

    // this tool's own working: a needle geared in its own way to the same input
    const gear = (hash(i, 11) < 0.4 ? -1 : 1) * (0.55 + hash(i, 12) * 0.85);
    const own = clamp(0.5 + (v - 0.5) * gear + (hash(i, 13) - 0.5) * 0.3);
    const an = A0 + own * SWEEP;
    ctx.strokeStyle = rgba(pal.accent, a);
    ctx.lineWidth = Math.max(1.2, r * 0.07);
    line(ctx, x - Math.cos(an) * r * 0.14, y - Math.sin(an) * r * 0.14, x + Math.cos(an) * r * 0.68, y + Math.sin(an) * r * 0.68);
    dot(ctx, x, y, Math.max(1.3, r * 0.09), rgba(pal.ink, a));
  };

  // the far dials, then the spine, then the near ones
  let k = 0;
  for (; k < N && sz[order[k]] > 0; k++) drawDial(order[k]);

  // the spine: six lines, one for each shared figure, with a bead of light running down each
  project(cam, 0, HEIGHT / 2 + 0.06, 0, P);
  project(cam, 0, -HEIGHT / 2 - 0.06, 0, Q);
  const gap = Math.max(2, P[2] * 0.021);
  glow(ctx, P[0], lerp(P[1], Q[1], 0.5), (Q[1] - P[1]) * 0.36, pal.accent, 0.1 + 0.08 * hv);
  for (let s = 0; s < STRANDS; s++) {
    const x = Math.round(P[0] + (s - (STRANDS - 1) / 2) * gap) + 0.5;
    ctx.strokeStyle = rgba(s % 5 === 0 ? pal.gold : pal.ink, s % 5 === 0 ? 0.75 : 0.5);
    ctx.lineWidth = 1;
    line(ctx, x, P[1], x, Q[1]);
    const b = fract(t * 0.16 + s * 0.618);
    lamp(ctx, x, lerp(P[1], Q[1], b), 1.2, s % 2 ? pal.teal : pal.accent, 0.95 * Math.sin(b * Math.PI));
  }
  // its two ends: a cap above, a foot below
  ctx.strokeStyle = rgba(pal.gold, 0.85);
  ctx.lineWidth = 1.5;
  const half = (gap * (STRANDS + 1)) / 2;
  line(ctx, P[0] - half, P[1], P[0] + half, P[1]);
  line(ctx, Q[0] - half, Q[1], Q[0] + half, Q[1]);
  lamp(ctx, P[0], P[1] - 5, 1.8, pal.gold, 0.9);

  for (; k < N; k++) drawDial(order[k]);

  closeStage(f);
};

export function SharedFigures() {
  return <Figure draw={draw} ratio={0.95} />;
}
