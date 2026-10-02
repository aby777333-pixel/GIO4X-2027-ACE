import { rgba, TAU, type Colour, type FigureFrame } from "../Figure";

/**
 * Small drawing helpers shared by the trading figures. Nothing here keeps
 * state or allocates: each call paints straight onto the frame's context.
 */

type Ctx = CanvasRenderingContext2D;

/** A straight hairline. */
export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, colour: string, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** The path of a rounded rectangle (not stroked or filled). */
export function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
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

/** A lamp: a soft pool of light with a bright core. */
export function lamp(ctx: Ctx, x: number, y: number, r: number, colour: Colour, alpha: number) {
  if (alpha <= 0.004) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, rgba(colour, 0.34 * alpha));
  g.addColorStop(1, rgba(colour, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 4, 0, TAU);
  ctx.fill();
  dot(ctx, x, y, r, rgba(colour, alpha));
}

/** A short label in small capitals, in the page's own face. */
export function caps(f: FigureFrame, text: string, x: number, y: number, colour: string, align: CanvasTextAlign = "center") {
  const { ctx } = f;
  ctx.font = `600 9.5px ${f.pal.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colour;
  ctx.fillText(text.toUpperCase(), x, y);
}

/** A repeatable pseudo-random number in 0..1 from two integers (never Math.random at draw time). */
export function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
