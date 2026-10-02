import { rgba, TAU, type Colour } from "../Figure";

/**
 * A small perspective kit shared by the market-page companions (the figures
 * that stand beside a hero pane, on the night stage). World space: x to the
 * right, y up, z away from the viewer. Nothing here allocates per call beyond
 * a gradient where one is asked for.
 */

export const PHI = 1.618034;
/** the golden angle, for spreading points evenly on a disc or a sphere */
export const GOLDEN_ANGLE = TAU * (1 - 1 / PHI);

export type Cam = { ox: number; oy: number; s: number; cyw: number; syw: number; cp: number; sp: number; d: number };

/** A camera: screen origin, pixels per unit, yaw about the vertical, pitch (positive looks down), eye distance. */
export function camera(ox: number, oy: number, s: number, yaw: number, pitch: number, d = 5): Cam {
  return { ox, oy, s, cyw: Math.cos(yaw), syw: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), d };
}

/** the last projected point: screen x, y, depth after rotation (larger is farther) and the perspective factor */
export const P = { x: 0, y: 0, z: 0, k: 1 };

export function pr(c: Cam, x: number, y: number, z: number) {
  const x1 = x * c.cyw + z * c.syw;
  const z1 = -x * c.syw + z * c.cyw;
  const y2 = y * c.cp + z1 * c.sp;
  const z2 = -y * c.sp + z1 * c.cp;
  const k = c.d / Math.max(0.2, c.d + z2);
  P.x = c.ox + x1 * k * c.s;
  P.y = c.oy - y2 * k * c.s;
  P.z = z2;
  P.k = k;
  return P;
}

/** deterministic 0..1 from an integer: placement is fixed, never random at draw time */
export function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** a soft pool of light */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: Colour, a: number) {
  if (r <= 0.5 || a <= 0.003) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(c, a));
  g.addColorStop(0.5, rgba(c, a * 0.32));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** a lit point: a core and its halo */
export function lamp(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: Colour, a: number) {
  glow(ctx, x, y, r * 5, c, a * 0.5);
  ctx.fillStyle = rgba(c, a);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** a straight stroke between two points in space */
export function seg(ctx: CanvasRenderingContext2D, c: Cam, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
  pr(c, x1, y1, z1);
  const ax = P.x;
  const ay = P.y;
  pr(c, x2, y2, z2);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(P.x, P.y);
  ctx.stroke();
}

const RX = new Float32Array(130);
const RY = new Float32Array(130);
const RZ = new Float32Array(130);

/**
 * A circle in space, centre c, radius r, in the plane of the unit vectors u and
 * v. The half nearer the viewer than the centre is stroked at `near`, the
 * farther half at `far`: that difference is what gives a wire solid its depth.
 */
export function ring(
  ctx: CanvasRenderingContext2D,
  c: Cam,
  cx: number,
  cy: number,
  cz: number,
  ux: number,
  uy: number,
  uz: number,
  vx: number,
  vy: number,
  vz: number,
  r: number,
  colour: Colour,
  near: number,
  far: number,
  width = 1,
  n = 48,
) {
  const m = Math.min(n, 128);
  const zc = pr(c, cx, cy, cz).z;
  for (let i = 0; i <= m; i++) {
    const a = (i / m) * TAU;
    const ca = Math.cos(a) * r;
    const sa = Math.sin(a) * r;
    pr(c, cx + ux * ca + vx * sa, cy + uy * ca + vy * sa, cz + uz * ca + vz * sa);
    RX[i] = P.x;
    RY[i] = P.y;
    RZ[i] = P.z;
  }
  ctx.lineWidth = width;
  for (let pass = 0; pass < 2; pass++) {
    const alpha = pass === 0 ? far : near;
    if (alpha <= 0.004) continue;
    ctx.strokeStyle = rgba(colour, alpha);
    ctx.beginPath();
    let open = false;
    for (let i = 0; i < m; i++) {
      const isNear = (RZ[i] + RZ[i + 1]) / 2 <= zc;
      if (isNear === (pass === 1)) {
        if (!open) ctx.moveTo(RX[i], RY[i]);
        ctx.lineTo(RX[i + 1], RY[i + 1]);
        open = true;
      } else open = false;
    }
    ctx.stroke();
  }
}

/** the outline of a disc in space, as a closed path for the caller to fill or stroke */
export function discPath(ctx: CanvasRenderingContext2D, c: Cam, cx: number, cy: number, cz: number, ux: number, uy: number, uz: number, vx: number, vy: number, vz: number, r: number, n = 40) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const ca = Math.cos(a) * r;
    const sa = Math.sin(a) * r;
    pr(c, cx + ux * ca + vx * sa, cy + uy * ca + vy * sa, cz + uz * ca + vz * sa);
    if (i === 0) ctx.moveTo(P.x, P.y);
    else ctx.lineTo(P.x, P.y);
  }
  ctx.closePath();
}

/**
 * A glass ball: a dark body that hides what is behind it, a highlight toward
 * the upper left, its outline, and an equator with two meridians that turn
 * with `spin` so the ball can be seen to rotate.
 */
export function ball(ctx: CanvasRenderingContext2D, c: Cam, cx: number, cy: number, cz: number, r: number, spin: number, colour: Colour, body: Colour, level = 1) {
  pr(c, cx, cy, cz);
  const x = P.x;
  const y = P.y;
  const R = r * P.k * c.s;
  glow(ctx, x, y, R * 1.7, colour, 0.22 * level);
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.fillStyle = rgba(body, 0.94);
  ctx.fill();
  const g = ctx.createRadialGradient(x - R * 0.38, y - R * 0.42, R * 0.05, x, y, R);
  g.addColorStop(0, rgba(colour, 0.5 * level));
  g.addColorStop(0.6, rgba(colour, 0.12 * level));
  g.addColorStop(1, rgba(colour, 0.03));
  ctx.fillStyle = g;
  ctx.fill();
  ring(ctx, c, cx, cy, cz, 1, 0, 0, 0, 0, 1, r, colour, 0.55 * level, 0.12 * level, 1, 40);
  for (let m = 0; m < 2; m++) {
    const a = spin + (m * Math.PI) / 2;
    ring(ctx, c, cx, cy, cz, Math.cos(a), 0, Math.sin(a), 0, 1, 0, r, colour, 0.4 * level, 0.08 * level, 1, 40);
  }
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(colour, 0.85 * level);
  ctx.stroke();
}

/** a ground plane ruled in perspective, fading with distance; y is its height */
export function floor(ctx: CanvasRenderingContext2D, c: Cam, y: number, halfX: number, z0: number, z1: number, step: number, colour: Colour, alpha: number) {
  ctx.lineWidth = 1;
  const nz = Math.round((z1 - z0) / step);
  for (let i = 0; i <= nz; i++) {
    const z = z0 + i * step;
    const fade = 1 - i / (nz + 1);
    ctx.strokeStyle = rgba(colour, alpha * fade * fade);
    seg(ctx, c, -halfX, y, z, halfX, y, z);
  }
  const nx = Math.round(halfX / step);
  const zm = z0 + (z1 - z0) * 0.45;
  for (let i = -nx; i <= nx; i++) {
    const x = i * step;
    ctx.strokeStyle = rgba(colour, alpha * 0.8);
    seg(ctx, c, x, y, z0, x, y, zm);
    ctx.strokeStyle = rgba(colour, alpha * 0.28);
    seg(ctx, c, x, y, zm, x, y, z1);
  }
}

/** the frame's corner marks, in champagne, as the hero instrument's frame has them */
export function corners(ctx: CanvasRenderingContext2D, w: number, h: number, gold: Colour, alpha = 0.55, len = 8) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(gold, alpha);
  ctx.beginPath();
  const a = 0.5;
  const r = w - 0.5;
  const b = h - 0.5;
  ctx.moveTo(a, a + len);
  ctx.lineTo(a, a);
  ctx.lineTo(a + len, a);
  ctx.moveTo(r - len, a);
  ctx.lineTo(r, a);
  ctx.lineTo(r, a + len);
  ctx.moveTo(r, b - len);
  ctx.lineTo(r, b);
  ctx.lineTo(r - len, b);
  ctx.moveTo(a + len, b);
  ctx.lineTo(a, b);
  ctx.lineTo(a, b - len);
  ctx.stroke();
}

/** a few capital letters, spaced as the site's small labels are */
export function caps(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, colour: string, size = 9, align: CanvasTextAlign = "center") {
  ctx.font = `600 ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = colour;
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const before = spaced.letterSpacing;
  if (before !== undefined) spaced.letterSpacing = "0.08em";
  ctx.fillText(text.toUpperCase(), x, y);
  if (before !== undefined) spaced.letterSpacing = before;
}
