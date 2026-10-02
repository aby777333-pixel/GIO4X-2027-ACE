import { TAU, clamp, rgba, smooth, type Colour, type Palette } from "@/components/figures/Figure";
import type { DiagramSpec } from "@/data/glossary-learn/types";

/**
 * Small drawing helpers shared by the glossary diagrams. Paths, text that is
 * made to fit, and a few pure functions. Colours always come from the palette
 * the figure host reads from the design tokens.
 */

type Ctx = CanvasRenderingContext2D;

/** the spec of one diagram kind */
export type Spec<K extends DiagramSpec["kind"]> = Extract<DiagramSpec, { kind: K }>;

/* ---- lesson data, made safe --------------------------------------------- */

/** A label from a lesson: a trimmed string, never longer than a drawing can carry. */
export const clean = (s: unknown, max = 30): string => (typeof s === "string" ? s.trim().slice(0, max) : "");

/** The labels of a spec: only real strings, at most `max`, padded to `min` with the fallbacks. */
export function names(labels: unknown, min: number, max: number, fallback: readonly string[]): string[] {
  const out = (Array.isArray(labels) ? labels : []).map((l) => clean(l)).filter(Boolean).slice(0, max);
  for (let i = out.length; i < min; i++) out.push(fallback[i] ?? "");
  return out;
}

/** A finite number within bounds, or the fallback. */
export const num = (v: unknown, a: number, b: number, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? clamp(v, a, b) : fallback);

/* ---- pure helpers -------------------------------------------------------- */

/** a fixed pseudo-random number between 0 and 1 for an index: the same on every frame and every visit */
export const hash = (i: number, seed = 0): number => {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** 0 to 1 along a run, then 1 during a hold, then again: the clock of a drawing that draws itself and rests */
export const timeline = (t: number, run: number, hold: number): number => clamp((t % (run + hold)) / run);

/** eased 0 to 1 between two moments */
export const between = (v: number, a: number, b: number): number => smooth((v - a) / (b - a || 1));

/** move a value towards a target at a rate, independent of frame time */
export const approach = (from: number, to: number, dt: number, rate: number): number => from + (to - from) * (1 - Math.exp(-dt * rate));

/** sizes that follow the canvas: 1 at the usual desktop width, smaller on a phone */
export const unit = (w: number): number => clamp(w / 560, 0.66, 1.06);
export const textSize = (w: number): number => (w < 430 ? 10.5 : 12);

/* ---- paths --------------------------------------------------------------- */

export function seg(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

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

/** a disc: filled with one colour, ringed with another */
export function disc(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke?: string, lineWidth = 1.5) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** an open arrowhead whose point is at (x, y), facing `angle` */
export function head(ctx: Ctx, x: number, y: number, angle: number, size = 6) {
  ctx.beginPath();
  ctx.moveTo(x - size * Math.cos(angle - 0.5), y - size * Math.sin(angle - 0.5));
  ctx.lineTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle + 0.5), y - size * Math.sin(angle + 0.5));
  ctx.stroke();
}

/** a ring that widens and fades: `p` runs 0 to 1 */
export function flare(ctx: Ctx, x: number, y: number, p: number, colour: Colour, reach = 22) {
  if (p <= 0 || p >= 1) return;
  ctx.beginPath();
  ctx.arc(x, y, 4 + reach * p, 0, TAU);
  ctx.strokeStyle = rgba(colour, 1 - p);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/* ---- text ---------------------------------------------------------------- */

const fits = new Map<string, { size: number; text: string; width: number }>();
if (typeof document !== "undefined") void document.fonts?.ready.then(() => fits.clear());

/** A label made to fit a width: first a smaller size (down to 9px), then an ellipsis. Remembered between frames. */
function fit(ctx: Ctx, pal: Palette, s: string, maxW: number, size: number, weight: number) {
  const key = `${weight}|${size}|${Math.round(maxW)}|${s}`;
  const known = fits.get(key);
  if (known) return known;
  let z = size;
  let out = s;
  const measure = () => {
    ctx.font = `${weight} ${z}px ${pal.font}`;
    return ctx.measureText(out).width;
  };
  let width = measure();
  while (z > 9 && width > maxW) {
    z -= 0.5;
    width = measure();
  }
  if (width > maxW) {
    let cut = s;
    while (cut.length > 1 && width > maxW) {
      cut = cut.slice(0, -1);
      out = `${cut.trimEnd()}…`;
      width = measure();
    }
  }
  if (fits.size > 600) fits.clear();
  const made = { size: z, text: out, width };
  fits.set(key, made);
  return made;
}

export type TextOpt = {
  align?: "left" | "center" | "right";
  size?: number;
  weight?: number;
  colour?: Colour;
  alpha?: number;
  /** the label is shrunk, then cut, to fit this width */
  maxW?: number;
  /** a small plate of the page's surface behind the words, so a line never runs through them */
  tag?: boolean;
  /** the canvas width: the label is kept inside it */
  within?: number;
};

/** Draw a short label, vertically centred on y. Returns the width it took. */
export function label(ctx: Ctx, pal: Palette, s: string, x: number, y: number, o: TextOpt = {}): number {
  const alpha = o.alpha ?? 1;
  if (!s || alpha <= 0.01) return 0;
  const weight = o.weight ?? 600;
  const pad = o.tag ? 6 : 0;
  const limit = Math.max(24, Math.min(o.maxW ?? 1e4, (o.within ?? 1e4) - 12 - pad * 2));
  const f = fit(ctx, pal, s, limit, o.size ?? 12, weight);
  const align = o.align ?? "center";
  let left = align === "left" ? x : align === "right" ? x - f.width : x - f.width / 2;
  if (o.within) left = clamp(left, 6 + pad, Math.max(6 + pad, o.within - 6 - pad - f.width));
  ctx.font = `${weight} ${f.size}px ${pal.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  if (o.tag) {
    box(ctx, left - pad, y - f.size / 2 - 4, f.width + pad * 2, f.size + 8, 3);
    ctx.fillStyle = rgba(pal.surface, 0.94 * alpha);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(o.colour ?? pal.ink3, 0.4 * alpha);
    ctx.stroke();
  }
  ctx.fillStyle = rgba(o.colour ?? pal.ink, alpha);
  ctx.fillText(f.text, left, y + 0.5);
  return f.width + pad * 2;
}
