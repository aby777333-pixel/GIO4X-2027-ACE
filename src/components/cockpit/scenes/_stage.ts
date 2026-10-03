import type { Frame } from "../engine";

/**
 * The rectangle a flat scene composes itself in: the framed box, on a phone
 * as on a wide screen. Between the two, where the scene lies free behind the
 * heading, the engine makes the box the whole stage; the scene then keeps to
 * its right-hand part so the heading stays clear.
 */
export function stage(f: Frame): { x: number; y: number; w: number; h: number } {
  const b = f.box;
  if (b.w < f.w * 0.98 || f.mobile) return b;
  const w = b.w * 0.5;
  const h = Math.min(b.h * 0.7, w * 0.62);
  return { x: b.x + b.w * 0.47, y: b.y + (b.h - h) / 2, w, h };
}

/** a rounded rectangle path, where the browser has one */
export function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** smooth 0 to 1 */
export const smooth = (t: number) => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
};
