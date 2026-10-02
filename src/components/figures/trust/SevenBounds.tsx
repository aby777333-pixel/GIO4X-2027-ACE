"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * Seven boundaries, for "Seven boundaries, stated in advance." on the AI page.
 *
 * A heptagon: one side per commitment, numbered as the list beside it is. A
 * point wanders inside it on a tether from the centre and presses against the
 * sides; the side it presses lights, and the point never gets through.
 *
 * Pointer: the point follows the pointer. Take the pointer outside the shape
 * and the point is held at the nearest side, which lights.
 */

const N = 7;
const APOTHEM = Math.cos(Math.PI / N);
/** outward unit normals of the seven sides, the first one up and to the right */
const NX: number[] = [];
const NY: number[] = [];
/** the corners, on the unit circle, the first one at the top */
const VX: number[] = [];
const VY: number[] = [];
for (let i = 0; i < N; i++) {
  const side = -Math.PI / 2 + ((i + 0.5) * TAU) / N;
  NX.push(Math.cos(side));
  NY.push(Math.sin(side));
  const corner = -Math.PI / 2 + (i * TAU) / N;
  VX.push(Math.cos(corner));
  VY.push(Math.sin(corner));
}
const LABELS = ["01", "02", "03", "04", "05", "06", "07"];

/** scratch point, reused every frame */
const P = { x: 0, y: 0 };

/** Where the point is at time t, relative to the centre: its own wandering, or the pointer, held inside the shape. */
function place(t: number, R: number, px: number, py: number, hover: number) {
  const reach = R * (0.5 + 0.66 * (0.5 + 0.5 * Math.sin(0.41 * t)));
  const dir = 0.33 * t + 0.8 * Math.sin(0.21 * t);
  let x = lerp(reach * Math.cos(dir), px, hover);
  let y = lerp(reach * Math.sin(dir), py, hover);
  const limit = R * APOTHEM - 8;
  // two passes settle a corner
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < N; i++) {
      const s = x * NX[i] + y * NY[i];
      if (s > limit) {
        x -= (s - limit) * NX[i];
        y -= (s - limit) * NY[i];
      }
    }
  }
  P.x = x;
  P.y = y;
}

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  const R = Math.min((h - 40) / (1 + APOTHEM), w / 2 - 34);
  const cx = w / 2;
  const cy = 10 + R;
  const limit = R * APOTHEM - 8;
  const px = f.mx - cx;
  const py = f.my - cy;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // a faint inner shape, for depth
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const k = i % N;
    if (i) ctx.lineTo(cx + VX[k] * R * 0.46, cy + VY[k] * R * 0.46);
    else ctx.moveTo(cx + VX[k] * R * 0.46, cy + VY[k] * R * 0.46);
  }
  ctx.strokeStyle = rgba(pal.line, 1);
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let i = 0; i < N; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + VX[i] * R * 0.46, cy + VY[i] * R * 0.46);
    ctx.lineTo(cx + VX[i] * R, cy + VY[i] * R);
    ctx.stroke();
  }

  // the trail the point leaves
  if (!f.still) {
    for (let k = 9; k >= 1; k--) {
      place(f.t - k * 0.06, R, px, py, f.hover);
      ctx.beginPath();
      ctx.arc(cx + P.x, cy + P.y, 3.2 * (1 - k / 11), 0, TAU);
      ctx.fillStyle = rgba(pal.accent, 0.22 * (1 - k / 10));
      ctx.fill();
    }
  }
  place(f.t, R, px, py, f.hover);
  const x = P.x;
  const y = P.y;

  // the seven sides: a hairline each, the pressed one lit
  ctx.font = `600 10px ${pal.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const near = smooth(1 - (limit - (x * NX[i] + y * NY[i])) / (R * 0.2));
    ctx.beginPath();
    ctx.moveTo(cx + VX[i] * R, cy + VY[i] * R);
    ctx.lineTo(cx + VX[j] * R, cy + VY[j] * R);
    ctx.strokeStyle = rgba(pal.ink, 0.34);
    ctx.lineWidth = 1;
    ctx.stroke();
    if (near > 0.004) {
      ctx.strokeStyle = rgba(pal.accent, near);
      ctx.lineWidth = 1 + 1.5 * near;
      ctx.stroke();
    }
    const lx = cx + NX[i] * (R * APOTHEM + 13);
    const ly = cy + NY[i] * (R * APOTHEM + 12);
    ctx.fillStyle = rgba(pal.ink3, 1 - near);
    ctx.fillText(LABELS[i], lx, ly);
    if (near > 0.004) {
      ctx.fillStyle = rgba(pal.accent, near);
      ctx.fillText(LABELS[i], lx, ly);
    }
  }

  // the tether to the centre, and the centre itself
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + x, cy + y);
  ctx.strokeStyle = rgba(pal.ink3, 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, TAU);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.gold, 1);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // the point
  const press = clamp(Math.hypot(x, y) / limit);
  ctx.beginPath();
  ctx.arc(cx + x, cy + y, 9 + 2 * press, 0, TAU);
  ctx.fillStyle = rgba(pal.accent, 0.14);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + x, cy + y, 4.5, 0, TAU);
  ctx.fillStyle = rgba(pal.accent, 1);
  ctx.fill();
};

export function SevenBounds() {
  return <Figure draw={draw} />;
}
