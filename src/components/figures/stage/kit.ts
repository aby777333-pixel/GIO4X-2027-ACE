import { rgba, TAU, type Colour, type FigureFrame } from "../Figure";

/**
 * Drawing helpers shared by the hero companions: the figures that stand on the
 * night stage beside a page's pane. Nothing here keeps state between frames;
 * each call paints straight onto the frame's context.
 */

type Ctx = CanvasRenderingContext2D;

export const PHI = 1.6180339887;
/** the golden angle: a full turn divided by φ², the turn that never repeats */
export const GOLDEN_ANGLE = TAU * (1 - 1 / PHI);

/** A repeatable pseudo-random number in 0..1 from two integers (never Math.random at draw time). */
export function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** The fractional part, always 0..1. */
export const fract = (v: number) => v - Math.floor(v);

/** A straight stroke from a to b, as its own path, in the current stroke style. */
export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** The path of a rounded rectangle (not stroked or filled). */
export function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.arcTo(x + w, y, x + w, y + k, k);
  ctx.lineTo(x + w, y + h - k);
  ctx.arcTo(x + w, y + h, x + w - k, y + h, k);
  ctx.lineTo(x + k, y + h);
  ctx.arcTo(x, y + h, x, y + h - k, k);
  ctx.lineTo(x, y + k);
  ctx.arcTo(x, y, x + k, y, k);
  ctx.closePath();
}

/** A filled dot. */
export function dot(ctx: Ctx, x: number, y: number, r: number, colour: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = colour;
  ctx.fill();
}

/** A pool of light, added to what is under it. On the night stage this is what makes a thing glow. */
export function glow(ctx: Ctx, x: number, y: number, r: number, colour: Colour, alpha: number) {
  if (alpha <= 0.004 || r <= 0.5) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(colour, alpha));
  g.addColorStop(0.4, rgba(colour, alpha * 0.32));
  g.addColorStop(1, rgba(colour, 0));
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = op;
}

/** A lamp: a pool of light with a bright core. */
export function lamp(ctx: Ctx, x: number, y: number, r: number, colour: Colour, alpha: number) {
  if (alpha <= 0.004) return;
  glow(ctx, x, y, r * 5, colour, 0.5 * alpha);
  dot(ctx, x, y, r, rgba(colour, alpha));
}

/** A short label in small capitals, in the page's own face. */
export function caps(f: FigureFrame, text: string, x: number, y: number, colour: string, align: CanvasTextAlign = "center", size = 9.5) {
  const { ctx } = f;
  ctx.font = `600 ${size}px ${f.pal.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colour;
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = "1px";
  ctx.fillText(text.toUpperCase(), x, y);
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = "0px";
}

/* ── a small camera ─────────────────────────────────────────────────────── */

/** A camera looking down the z axis at the origin: y is up, z runs away from the viewer. */
export type Cam = { cx: number; cy: number; focal: number; dist: number; cy_: number; sy_: number; cp: number; sp: number };

export function makeCam(): Cam {
  return { cx: 0, cy: 0, focal: 1, dist: 4, cy_: 1, sy_: 0, cp: 1, sp: 0 };
}

/**
 * Aim the camera. `scale` is how many pixels one world unit takes at the
 * origin; `dist` is how far the camera stands (smaller means stronger
 * perspective); yaw turns the world about its vertical axis, pitch looks down on it.
 */
export function aim(cam: Cam, cx: number, cy: number, scale: number, dist: number, yaw: number, pitch: number) {
  cam.cx = cx;
  cam.cy = cy;
  cam.dist = dist;
  cam.focal = scale * dist;
  cam.cy_ = Math.cos(yaw);
  cam.sy_ = Math.sin(yaw);
  cam.cp = Math.cos(pitch);
  cam.sp = Math.sin(pitch);
}

/** Project a world point. Writes [screen x, screen y, pixels per unit there, depth] into `out`. */
export function project(cam: Cam, x: number, y: number, z: number, out: number[]) {
  const x1 = x * cam.cy_ + z * cam.sy_;
  const z1 = -x * cam.sy_ + z * cam.cy_;
  // looking down on it: what is further away stands higher in the window
  const y1 = y * cam.cp + z1 * cam.sp;
  const z2 = -y * cam.sp + z1 * cam.cp;
  const s = cam.focal / Math.max(0.2, cam.dist + z2);
  out[0] = cam.cx + x1 * s;
  out[1] = cam.cy - y1 * s;
  out[2] = s;
  out[3] = z2;
}

/* ── the window on the stage ────────────────────────────────────────────── */

/**
 * Begin a companion: a faint wash of the key light from the golden point, so
 * the window has air in it before anything is drawn.
 */
export function openStage(f: FigureFrame, gx = 0.618, gy = 0.382) {
  const { ctx, w, h, pal } = f;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = rgba(pal.surface, 0.28);
  ctx.fillRect(0, 0, w, h);
  glow(ctx, w * gx, h * gy, Math.max(w, h) * 0.72, pal.accent, 0.085);
}

/**
 * End a companion: the light the pointer carries, its reticle, and the frame:
 * a hairline in champagne, heavier at the corners, with the golden cut marked
 * on its long sides, as the hero instrument's frame is drawn.
 */
export function closeStage(f: FigureFrame) {
  const { ctx, w, h, pal, hover, mx, my, t } = f;
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  if (hover > 0.01) {
    glow(ctx, mx, my, Math.min(w, h) * 0.42, pal.accent, 0.16 * hover);
    const r = 11;
    ctx.strokeStyle = rgba(pal.gold, 0.7 * hover);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx, my, r, t * 0.9, t * 0.9 + TAU * 0.72);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4;
      ctx.moveTo(mx + Math.cos(a) * (r + 3), my + Math.sin(a) * (r + 3));
      ctx.lineTo(mx + Math.cos(a) * (r + 8), my + Math.sin(a) * (r + 8));
    }
    ctx.stroke();
  }
  const lit = 0.55 + hover * 0.45;
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.gold, 0.24 * lit);
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  const c = Math.min(21, Math.min(w, h) * 0.07);
  ctx.strokeStyle = rgba(pal.gold, 0.85 * lit);
  ctx.lineWidth = 1.5;
  ctx.lineCap = "butt";
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const x = i % 2 ? w : 0;
    const y = i > 1 ? h : 0;
    const sx = i % 2 ? -1 : 1;
    const sy = i > 1 ? -1 : 1;
    ctx.moveTo(x + sx * c, y + sy * 0.75);
    ctx.lineTo(x + sx * 0.75, y + sy * 0.75);
    ctx.lineTo(x + sx * 0.75, y + sy * c);
  }
  // the golden cut, on the long sides
  if (w >= h) {
    const cut = Math.round(w * 0.618) + 0.5;
    ctx.moveTo(cut, 0);
    ctx.lineTo(cut, 6);
    ctx.moveTo(cut, h - 6);
    ctx.lineTo(cut, h);
  } else {
    const cut = Math.round(h * 0.382) + 0.5;
    ctx.moveTo(0, cut);
    ctx.lineTo(6, cut);
    ctx.moveTo(w - 6, cut);
    ctx.lineTo(w, cut);
  }
  ctx.stroke();
}
