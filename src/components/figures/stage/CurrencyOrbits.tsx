"use client";

import { Figure, clamp, lerp, rgba, smooth, TAU, type FigureDraw } from "../Figure";
import { aim, caps, closeStage, dot, fract, glow, hash, lamp, makeCam, openStage, PHI, project } from "./kit";

/**
 * Funding and withdrawals, beside "Accepted currencies": the eleven currencies
 * as small bodies on three orbits round one account. The orbit radii step by
 * φ. Between the innermost orbit and the account stands a dashed ring in
 * champagne: the bank or payment provider every payment passes on its way in.
 * A payment leaves one body after another, crosses that ring (which answers
 * with a spark) and arrives at the centre. Only the codes the page lists are
 * drawn; no amount, rate or time is shown.
 *
 * Pointer: the body nearest to it is chosen: its code comes up, its thread to
 * the account is drawn in full, and the payment travels that thread.
 */

// keep in step with `fundingCurrencies` in src/data/trading.ts, which the pane beside this lists
const CODES = ["AUD", "USD", "GBP", "EUR", "AED", "SGD", "CAD", "CHF", "HKD", "INR", "NZD"];
const N = CODES.length;
// which orbit each body rides, and where on it it starts
const RING = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2];
const SLOT = [0, 0.5, 0.06, 0.31, 0.56, 0.81, 0.02, 0.22, 0.42, 0.62, 0.82];
const R0 = 1 / (PHI * PHI);
const RADII = [R0 * 1.12, R0 * PHI * 1.06, 1];
const GATE = R0 / PHI;
const SPEED = [0.2, 0.135, 0.09];

const cam = makeCam();
const P = [0, 0, 0, 0];
const C = [0, 0, 0, 0];
const px = new Float32Array(N);
const py = new Float32Array(N);
const pz = new Float32Array(N);
const pa = new Float32Array(N);

function ring(ctx: CanvasRenderingContext2D, r: number, from: number, to: number) {
  ctx.beginPath();
  for (let j = 0; j <= 40; j++) {
    const a = lerp(from, to, j / 40);
    project(cam, Math.cos(a) * r, 0, Math.sin(a) * r, P);
    if (j === 0) ctx.moveTo(P[0], P[1]);
    else ctx.lineTo(P[0], P[1]);
  }
  ctx.stroke();
}

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, my, pal } = f;
  if (w < 150 || h < 60) return;
  openStage(f, 0.5, 0.5);
  const hv = smooth(hover);
  const small = h < 130;

  const pitch = 0.36 + (my / h - 0.5) * 0.1 * hv;
  const scale = Math.min(w * 0.44, (h * 0.37) / Math.sin(pitch + 0.02));
  aim(cam, w * 0.5, h * 0.5, scale, 5.2, (mx / w - 0.5) * 0.3 * hv, pitch);
  project(cam, 0, 0, 0, C);

  // the far halves of the orbits
  ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = rgba(pal.ink3, 0.3);
    ring(ctx, RADII[k], 0, Math.PI);
  }
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = rgba(pal.gold, 0.55);
  ring(ctx, GATE, 0, Math.PI);
  ctx.setLineDash([]);

  // where the bodies are
  let near = 0;
  let nearD = 1e9;
  for (let i = 0; i < N; i++) {
    const k = RING[i];
    const a = SLOT[i] * TAU + t * SPEED[k] * (k === 1 ? -1 : 1);
    project(cam, Math.cos(a) * RADII[k], 0, Math.sin(a) * RADII[k], P);
    px[i] = P[0];
    py[i] = P[1];
    pz[i] = P[3];
    pa[i] = a;
    const d = Math.hypot(P[0] - mx, P[1] - my);
    if (d < nearD) {
      nearD = d;
      near = i;
    }
  }
  // the payment under way: one body after another on its own, the chosen one under the pointer
  const turn = t * 0.42;
  const auto = Math.floor(turn) % N;
  const sender = hv > 0.5 ? near : (auto * 4) % N;
  const prog = fract(turn);

  const body = (i: number) => {
    const front = clamp(0.5 - pz[i] / 2);
    const chosen = i === near ? hv : 0;
    const sending = i === sender ? 1 : 0;
    const a = lerp(0.4, 1, front);
    const r = (small ? 2.6 : 4.4) * lerp(0.7, 1.2, front) * (1 + 0.35 * chosen);
    const col = i % 3 === 0 ? pal.accent : i % 3 === 1 ? pal.teal : pal.emerald;

    if (sending || chosen > 0.01) {
      // the thread to the account, and the payment on it
      const k = Math.max(chosen, sending * 0.8);
      ctx.strokeStyle = rgba(col, 0.5 * k * a);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px[i], py[i]);
      ctx.lineTo(C[0], C[1]);
      ctx.stroke();
      if (sending) {
        const e = smooth(prog);
        lamp(ctx, lerp(px[i], C[0], e), lerp(py[i], C[1], e), 1.7, pal.ink, Math.sin(prog * Math.PI));
        // the spark where it crosses the provider's ring
        const cross = 1 - GATE / RADII[RING[i]];
        const s = clamp(1 - Math.abs(e - cross) * 9);
        if (s > 0) {
          project(cam, Math.cos(pa[i]) * GATE, 0, Math.sin(pa[i]) * GATE, P);
          glow(ctx, P[0], P[1], 14, pal.gold, 0.8 * s);
        }
      }
    }
    glow(ctx, px[i], py[i], r * 4, col, (0.22 + 0.4 * chosen) * a);
    dot(ctx, px[i], py[i], r, rgba(col, a));
    if (!small && (front > 0.5 || chosen > 0.01)) {
      const la = clamp((front - 0.5) * 5) * 0.66 + chosen * 0.6;
      caps(f, CODES[i], px[i], py[i] - r - 6, rgba(pal.ink, clamp(la)), "center", 9);
    }
  };

  for (let i = 0; i < N; i++) if (pz[i] > 0) body(i);

  // the account at the centre
  const cr = small ? 5 : 8;
  glow(ctx, C[0], C[1], cr * 6, pal.accent, 0.3 + 0.2 * Math.sin(prog * Math.PI) ** 6);
  ctx.beginPath();
  ctx.arc(C[0], C[1], cr, 0, TAU);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.9);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  dot(ctx, C[0], C[1], cr * 0.32, rgba(pal.ink, 0.95));

  // the near halves
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = rgba(pal.gold, 0.9);
  ring(ctx, GATE, Math.PI, TAU);
  ctx.setLineDash([]);
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = rgba(pal.ink2, 0.4);
    ring(ctx, RADII[k], Math.PI, TAU);
  }
  for (let i = 0; i < N; i++) if (pz[i] <= 0) body(i);

  // a few fixed specks beyond the orbits
  for (let i = 0; i < 18; i++) dot(ctx, w * hash(i, 21), h * hash(i, 22), 0.6, rgba(pal.ink, 0.12 + 0.14 * hash(i, 23)));

  closeStage(f);
};

export function CurrencyOrbits() {
  return <Figure draw={draw} ratio={2.5} />;
}
