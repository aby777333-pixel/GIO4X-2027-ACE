"use client";

import { Figure, clamp, lerp, rgba, smooth, TAU, type FigureDraw } from "../Figure";
import { closeStage, dot, fract, glow, hash, lamp, openStage } from "./kit";

/**
 * PAMM, beside the diagram of the pool: four strands of light of different
 * weights (three investors and the manager, as in the diagram) come in from
 * the left, are wound into one cable, pass through the manager's ring and
 * part again on the right in the same order and at the same weights. Inside
 * the cable no strand can move alone: where the ring takes the cable, every
 * strand goes, and each end on the right is carried by the same amount. That
 * is the arrangement in one picture: one pooled account, traded as one, and
 * the result divided by share. The weights are arbitrary and nothing here is
 * a result.
 *
 * Pointer: it takes hold of the ring. Lift or lower it and the whole cable
 * follows, all four strands together.
 */

const STRANDS = 4;
const WEIGHT = [0.4, 0.26, 0.2, 0.14];
const SEG = 64;
const ys = new Float32Array(SEG + 1);

type State = { x: number; y: number };
const states = new WeakMap<CanvasRenderingContext2D, State>();

/** 0 at both ends, 1 through the middle: how tightly the strands are wound together at u */
const wound = (u: number) => smooth((u - 0.1) / 0.24) * smooth((0.9 - u) / 0.24);

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, dt, hover, mx, my, pal, still } = f;
  if (w < 150 || h < 90) return;
  openStage(f, 0.5, 0.5);
  const hv = smooth(hover);

  const x0 = w * 0.07;
  const x1 = w * 0.93;
  const mid = h * 0.5;
  const spread = h * 0.7;
  const core = Math.max(4, h * 0.04);

  // the ring: it sways on its own, and goes where the pointer takes it
  const restX = 0.5 + 0.035 * Math.sin(t * 0.31);
  const restY = Math.sin(t * 0.62) * 0.13 + Math.sin(t * 1.07 + 1) * 0.04;
  const wantX = lerp(restX, clamp((mx - x0) / (x1 - x0), 0.36, 0.64), hv);
  const wantY = lerp(restY, clamp((my - mid) / h, -0.2, 0.2), hv);
  let st = states.get(ctx);
  if (!st) {
    st = { x: wantX, y: wantY };
    states.set(ctx, st);
  }
  const k = still ? 1 : 1 - Math.exp(-dt * 5);
  st.x += (wantX - st.x) * k;
  st.y += (wantY - st.y) * k;
  const ringU = st.x;
  const lift = st.y * h;

  // the cable's centre line: level at the left, carried by the ring, and the right-hand ends carried with it
  const centre = (u: number) => {
    const bell = Math.exp(-(((u - ringU) / 0.22) ** 2));
    return mid + lift * bell + lift * 0.42 * smooth((u - ringU) / (1 - ringU));
  };

  // a faint datum: where the cable would lie undisturbed
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = rgba(pal.ink3, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, Math.round(mid) + 0.5);
  ctx.lineTo(x1, Math.round(mid) + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  const ringX = lerp(x0, x1, ringU);
  const ringY = centre(ringU);
  const rw = core * 1.5;
  const rh = core * 4.4;
  // the far half of the ring, behind the cable
  ctx.strokeStyle = rgba(pal.gold, 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(ringX, ringY, rw, rh, 0, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  glow(ctx, ringX, ringY, rh * 2.4, pal.gold, 0.1 + 0.16 * hv);

  // the strands, as light: where they cross they add
  ctx.globalCompositeOperation = "lighter";
  let acc = 0;
  for (let i = 0; i < STRANDS; i++) {
    const home = (acc + WEIGHT[i] / 2 - 0.5) * spread;
    acc += WEIGHT[i];
    const col = i === 0 ? pal.accent : i === 1 ? pal.teal : i === 2 ? pal.emerald : pal.gold;
    const width = 1.2 + WEIGHT[i] * 9;
    const phase = (i / STRANDS) * TAU + 0.6;
    for (let j = 0; j <= SEG; j++) {
      const u = j / SEG;
      const wd = wound(u);
      const turn = phase + u * TAU * 2.2 - t * 0.5;
      ys[j] = centre(u) + home * (1 - wd) + Math.cos(turn) * core * wd;
    }
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let j = 0; j <= SEG; j++) {
        const x = lerp(x0, x1, j / SEG);
        if (j === 0) ctx.moveTo(x, ys[j]);
        else ctx.lineTo(x, ys[j]);
      }
      ctx.strokeStyle = rgba(col, pass === 0 ? 0.16 : 0.92);
      ctx.lineWidth = pass === 0 ? width * 3.2 : width;
      ctx.stroke();
    }
    // light running along the strand, in at the left and out at the right
    for (let b = 0; b < 2; b++) {
      const u = fract(t * 0.11 + i * 0.382 + b * 0.5);
      const j = u * SEG;
      const j0 = Math.floor(j);
      const y = lerp(ys[j0], ys[Math.min(SEG, j0 + 1)], j - j0);
      lamp(ctx, lerp(x0, x1, u), y, 1.5, pal.ink, 0.85 * Math.sin(u * Math.PI));
    }
    // the two ends: what was allocated, and what comes back, at the same weight
    ctx.globalCompositeOperation = "source-over";
    const r = 2.2 + WEIGHT[i] * 9;
    for (let e = 0; e < 2; e++) {
      const ex = e ? x1 : x0;
      const ey = ys[e ? SEG : 0];
      ctx.beginPath();
      ctx.arc(ex, ey, r, 0, TAU);
      ctx.fillStyle = rgba(pal.surface, 1);
      ctx.fill();
      ctx.strokeStyle = rgba(col, 1);
      ctx.lineWidth = 1.3;
      ctx.stroke();
      dot(ctx, ex, ey, r * 0.36, rgba(col, 0.95));
    }
    ctx.globalCompositeOperation = "lighter";
  }
  ctx.globalCompositeOperation = "source-over";

  // the near half of the ring, in front of the cable
  ctx.strokeStyle = rgba(pal.gold, 1);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(ringX, ringY, rw, rh, 0, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
  // how far the ring has carried the cable from the datum
  if (Math.abs(lift) > 3) {
    ctx.strokeStyle = rgba(pal.gold, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ringX, mid);
    ctx.lineTo(ringX, ringY - Math.sign(lift) * rh);
    ctx.stroke();
  }

  for (let i = 0; i < 20; i++) dot(ctx, w * hash(i, 41), h * hash(i, 42), 0.6, rgba(pal.ink, 0.1 + 0.12 * hash(i, 43)));

  closeStage(f);
};

export function PoolBraid() {
  return <Figure draw={draw} />;
}
