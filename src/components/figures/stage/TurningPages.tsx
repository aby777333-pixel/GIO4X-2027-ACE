"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { aim, closeStage, dot, fract, glow, hash, makeCam, openStage, project } from "./kit";

/**
 * Academy, beside "Start here": a book lying open on the night stage, its
 * pages turning one after another from right to left, in order, at an even
 * pace. The pages carry ruled lines and one small construction, never a word
 * or a figure. Light rises from the gutter and a few motes drift up from it.
 * Nothing is counted and nothing is ticked off: there are no streaks here.
 *
 * Pointer: it turns the pages by hand. Carry it to the left and the leaves
 * follow it over; carry it back and they return.
 */

const L = 1; // a page's width
const D = 1.36; // a page's depth, along the spine
const LEAVES = 3;
const cam = makeCam();
const P = [0, 0, 0, 0];
const theta = new Float32Array(LEAVES);
const order = new Uint8Array(LEAVES);

/** trace one leaf standing at angle a: a quad from the spine out to its free edge, with a slight curl */
function leaf(ctx: CanvasRenderingContext2D, a: number) {
  const STEPS = 6;
  const curl = Math.sin(a) * 0.34;
  ctx.beginPath();
  for (let s = 0; s <= STEPS; s++) {
    const u = s / STEPS;
    const b = a + curl * (1 - u) * (a < Math.PI / 2 ? 1 : -1) * 0.6;
    project(cam, Math.cos(b) * L * u, Math.sin(b) * L * u, -D / 2, P);
    if (s === 0) ctx.moveTo(P[0], P[1]);
    else ctx.lineTo(P[0], P[1]);
  }
  for (let s = STEPS; s >= 0; s--) {
    const u = s / STEPS;
    const b = a + curl * (1 - u) * (a < Math.PI / 2 ? 1 : -1) * 0.6;
    project(cam, Math.cos(b) * L * u, Math.sin(b) * L * u, D / 2, P);
    ctx.lineTo(P[0], P[1]);
  }
  ctx.closePath();
}

/** the ruled lines on a leaf at angle a, on the face that looks up */
function rules(ctx: CanvasRenderingContext2D, a: number, n: number) {
  ctx.beginPath();
  for (let r = 0; r < n; r++) {
    const z = lerp(-D * 0.36, D * 0.36, r / (n - 1));
    const u1 = 0.86 - hash(r, Math.round(a * 3) + 81) * 0.3;
    project(cam, Math.cos(a) * L * 0.16, Math.sin(a) * L * 0.16, z, P);
    ctx.moveTo(P[0], P[1]);
    project(cam, Math.cos(a) * L * u1, Math.sin(a) * L * u1, z, P);
    ctx.lineTo(P[0], P[1]);
  }
  ctx.stroke();
}

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, my, pal } = f;
  if (w < 150 || h < 60) return;
  openStage(f, 0.5, 0.3);
  const hv = smooth(hover);

  const pitch = 0.6 + (my / h - 0.5) * 0.1 * hv;
  const scale = Math.min((w * 0.74) / (2 * L), (h * 0.7) / 1.42);
  aim(cam, w * 0.5, h * 0.66, scale, 6, 0.1 * Math.sin(t * 0.21) + (mx / w - 0.5) * 0.14 * hv, pitch);

  for (let i = 0; i < 18; i++) dot(ctx, w * hash(i, 82), h * 0.6 * hash(i, 83), 0.6, rgba(pal.ink, 0.1 + 0.14 * hash(i, 84)));

  // the leaves in the air
  const hand = clamp(1 - (mx - w * 0.14) / (w * 0.72));
  for (let j = 0; j < LEAVES; j++) {
    const auto = smooth(fract(t * 0.085 + j / LEAVES));
    const byHand = clamp(hand + (j - 1) * 0.13, 0.03, 0.97);
    theta[j] = Math.PI * lerp(auto, byHand, hv);
    order[j] = j;
  }
  // flattest first, the most upright last
  for (let i = 1; i < LEAVES; i++) {
    const o = order[i];
    let j = i - 1;
    while (j >= 0 && Math.abs(theta[order[j]] - Math.PI / 2) < Math.abs(theta[o] - Math.PI / 2)) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = o;
  }

  // the book's shadow and the light from its gutter
  project(cam, 0, 0, 0, P);
  const gx = P[0];
  const gy = P[1];
  glow(ctx, gx, gy - scale * 0.2, scale * 1.5, pal.accent, 0.2);
  glow(ctx, gx, gy - scale * 0.35, scale * 0.8, pal.gold, 0.22);

  // the two blocks of pages lying flat, each a few leaves thick
  for (let side = 0; side < 2; side++) {
    const a = side ? Math.PI : 0;
    for (let k = 2; k >= 0; k--) {
      ctx.save();
      ctx.translate(0, k * 2.2);
      leaf(ctx, a);
      ctx.fillStyle = rgba(pal.surface, 1);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.ink2, k === 0 ? 0.85 : 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = rgba(pal.ink3, 0.6);
    ctx.lineWidth = 1;
    rules(ctx, a, 6);
  }
  // one small construction on the right-hand page: a circle on a line
  project(cam, L * 0.56, 0, -D * 0.02, P);
  ctx.strokeStyle = rgba(pal.accent, 0.8);
  ctx.beginPath();
  ctx.ellipse(P[0], P[1], P[2] * 0.15, P[2] * 0.15 * Math.sin(pitch), 0, 0, Math.PI * 2);
  ctx.stroke();

  // motes rising from the gutter
  for (let i = 0; i < 16; i++) {
    const life = fract(t * (0.05 + hash(i, 85) * 0.05) + hash(i, 86));
    const x = gx + (hash(i, 87) - 0.5) * scale * 1.5 + Math.sin(t * 0.6 + i) * 4;
    const y = gy - life * h * 0.6;
    dot(ctx, x, y, 0.8 + hash(i, 88), rgba(i % 3 ? pal.gold : pal.accent, 0.75 * Math.sin(life * Math.PI)));
  }

  // the leaves
  for (let n = 0; n < LEAVES; n++) {
    const a = theta[order[n]];
    const up = Math.sin(a);
    leaf(ctx, a);
    ctx.fillStyle = rgba(pal.surface, 0.94);
    ctx.fill();
    ctx.fillStyle = rgba(pal.gold, 0.05 + 0.12 * up);
    ctx.fill();
    ctx.strokeStyle = rgba(up > 0.5 ? pal.gold : pal.ink, 0.6 + 0.4 * up);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.ink3, 0.5 * (1 - up * 0.6));
    ctx.lineWidth = 1;
    rules(ctx, a, 6);
  }

  // the gutter, and the ribbon marking the place
  project(cam, 0, 0, -D / 2, P);
  const ax = P[0];
  const ay = P[1];
  project(cam, 0, 0, D / 2, P);
  ctx.strokeStyle = rgba(pal.ink, 0.9);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(P[0], P[1]);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.gold, 0.95);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(ax + 5, ay + h * 0.07, ax + 2 + Math.sin(t * 0.8) * 2, ay + h * 0.13);
  ctx.stroke();

  closeStage(f);
};

export function TurningPages() {
  return <Figure draw={draw} ratio={2.5} />;
}
