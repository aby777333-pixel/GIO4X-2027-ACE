"use client";

import { Figure, clamp, lerp, rgba, smooth, TAU, type FigureDraw, type FigureFrame } from "../Figure";
import { box, caps, line } from "./kit";

/**
 * "What you will need" (account types): the two documents an account opening
 * asks for, a photo identity card and a dated letter showing an address, lying
 * side by side. A reading line crosses them slowly; what it has passed is drawn
 * in full, and each document is marked once it has been read to its far edge.
 *
 * Pointer: the reading line follows the pointer, so the documents can be read
 * forwards and back, and the document under the pointer lifts a little.
 */

const CYCLE = 9;

/** The identity card, `k` being how strongly it is drawn (0 faint, 1 read). */
function card(f: FigureFrame, x: number, y: number, w: number, h: number, k: number) {
  const { ctx, pal } = f;
  const ink = (a: number) => rgba(pal.ink, a * lerp(0.42, 1, k));
  box(ctx, x, y, w, h, 7);
  ctx.strokeStyle = ink(0.55);
  ctx.lineWidth = 1;
  ctx.stroke();
  // the photograph
  const pw = w * 0.27;
  const ph = h * 0.56;
  const px = x + w * 0.08;
  const py = y + h * 0.15;
  box(ctx, px, py, pw, ph, 3);
  ctx.strokeStyle = ink(0.5);
  ctx.stroke();
  ctx.save();
  box(ctx, px, py, pw, ph, 3);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(px + pw / 2, py + ph * 0.38, pw * 0.2, 0, TAU);
  ctx.moveTo(px + pw * 0.92, py + ph * 1.08);
  ctx.arc(px + pw / 2, py + ph * 1.08, pw * 0.42, 0, Math.PI, true);
  ctx.strokeStyle = ink(0.6);
  ctx.stroke();
  ctx.restore();
  // the particulars
  const lx = x + w * 0.43;
  const rows = [0.5, 0.36, 0.44, 0.28];
  for (let i = 0; i < rows.length; i++) {
    const ly = py + 4 + i * (ph - 8) * (1 / 3);
    line(ctx, lx, ly, lx + w * rows[i], ly, i === 0 ? ink(0.8) : ink(0.38), i === 0 ? 2 : 1.5);
  }
  // the machine-readable strip
  ctx.setLineDash([5, 3]);
  line(ctx, x + w * 0.08, y + h * 0.82, x + w * 0.92, y + h * 0.82, ink(0.4), 1.5);
  line(ctx, x + w * 0.08, y + h * 0.9, x + w * 0.92, y + h * 0.9, ink(0.4), 1.5);
  ctx.setLineDash([]);
}

/** The letter: a page with a folded corner, a date mark, an address block and a few lines. */
function letter(f: FigureFrame, x: number, y: number, w: number, h: number, k: number) {
  const { ctx, pal } = f;
  const ink = (a: number) => rgba(pal.ink, a * lerp(0.42, 1, k));
  const fold = w * 0.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - fold, y);
  ctx.lineTo(x + w, y + fold);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.strokeStyle = ink(0.55);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w - fold, y);
  ctx.lineTo(x + w - fold, y + fold);
  ctx.lineTo(x + w, y + fold);
  ctx.strokeStyle = ink(0.4);
  ctx.stroke();
  // the sender's heading and the date mark
  line(ctx, x + w * 0.12, y + h * 0.11, x + w * 0.48, y + h * 0.11, ink(0.8), 2);
  const gold = rgba(pal.gold, lerp(0.4, 1, k));
  box(ctx, x + w * 0.6, y + h * 0.245, w * 0.28, h * 0.1, 2);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.25;
  ctx.stroke();
  for (let i = 0; i < 3; i++) line(ctx, x + w * (0.645 + i * 0.075), y + h * 0.295, x + w * (0.68 + i * 0.075), y + h * 0.295, gold, 1.5);
  // the address block, then the body
  const block = [0.4, 0.46, 0.3];
  for (let i = 0; i < block.length; i++) {
    const ly = y + h * (0.25 + i * 0.065);
    line(ctx, x + w * 0.12, ly, x + w * (0.12 + block[i]), ly, ink(0.62), 1.5);
  }
  const body = [0.76, 0.76, 0.7, 0.76, 0.52];
  for (let i = 0; i < body.length; i++) {
    const ly = y + h * (0.53 + i * 0.085);
    line(ctx, x + w * 0.12, ly, x + w * (0.12 + body[i]), ly, ink(0.3), 1.5);
  }
}

/** The mark a document carries once it has been read to its far edge. */
function read(f: FigureFrame, x: number, y: number, a: number) {
  if (a <= 0.004) return;
  const { ctx, pal } = f;
  ctx.beginPath();
  ctx.arc(x, y, 6.5, 0, TAU);
  ctx.strokeStyle = rgba(pal.gold, a);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 0.25);
  ctx.lineTo(x - 0.75, y + 2.5);
  ctx.lineTo(x + 3.25, y - 2.25);
  ctx.strokeStyle = rgba(pal.gold, a);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the two documents, on a common baseline
  const base = h * 0.8;
  const cw = w * 0.42;
  const ch = cw / 1.586;
  const cx = w * 0.07;
  const lw = w * 0.27;
  const lh = Math.min(lw * 1.36, h * 0.66);
  const lx = w * 0.64;

  const p = (f.t % CYCLE) / CYCLE;
  const x0 = cx - 14;
  const x1 = lx + lw + 14;
  const auto = f.still ? x1 : lerp(x0, x1, smooth(p / 0.62));
  const scan = lerp(auto, clamp(f.mx, x0, x1), f.hover);
  const keep = f.still ? 1 : lerp(1 - smooth((p - 0.92) / 0.08), 1, f.hover);
  const beam = f.still ? 0 : lerp(1 - smooth((p - 0.62) / 0.08), 1, f.hover);

  // the document under the pointer lifts a little
  const liftCard = f.hover * smooth(1.6 - Math.abs(f.mx - (cx + cw / 2)) / (cw * 0.5)) * 5;
  const liftLetter = f.hover * smooth(1.6 - Math.abs(f.mx - (lx + lw / 2)) / (lw * 0.5)) * 5;
  const cy = base - ch - liftCard;
  const ly = base - lh - liftLetter;

  // the desk line they rest on, and their shadows
  line(ctx, w * 0.03, base + 9, w * 0.97, base + 9, rgba(pal.line, 1.4), 1);
  ctx.fillStyle = rgba(pal.ink, 0.05);
  box(ctx, cx + 4, cy + 5 + liftCard, cw, ch, 7);
  ctx.fill();
  ctx.fillRect(lx + 4, ly + 5 + liftLetter, lw, lh);

  // paper
  ctx.fillStyle = rgba(pal.surface, 1);
  box(ctx, cx, cy, cw, ch, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx + lw * 0.8, ly);
  ctx.lineTo(lx + lw, ly + lw * 0.2);
  ctx.lineTo(lx + lw, ly + lh);
  ctx.lineTo(lx, ly + lh);
  ctx.closePath();
  ctx.fill();

  // unread, then what the reading line has passed
  card(f, cx, cy, cw, ch, 0);
  letter(f, lx, ly, lw, lh, 0);
  if (keep > 0.004 && scan > x0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, scan, h);
    ctx.clip();
    ctx.globalAlpha = keep;
    card(f, cx, cy, cw, ch, 1);
    letter(f, lx, ly, lw, lh, 1);
    ctx.restore();
  }

  // the reading line
  if (beam > 0.004) {
    const top = h * 0.09;
    const bottom = base + 9;
    const g = ctx.createLinearGradient(scan - 26, 0, scan, 0);
    g.addColorStop(0, rgba(pal.accent, 0));
    g.addColorStop(1, rgba(pal.accent, 0.16 * beam));
    ctx.fillStyle = g;
    ctx.fillRect(scan - 26, top, 26, bottom - top);
    line(ctx, scan, top, scan, bottom, rgba(pal.accent, 0.9 * beam), 1.25);
  }

  // read to the far edge: marked
  const doneCard = keep * smooth((scan - (cx + cw) + 4) / 10);
  const doneLetter = keep * smooth((scan - (lx + lw) + 4) / 10);
  read(f, cx + cw / 2 - 40, base + 22.5, doneCard);
  read(f, lx + lw / 2 - 40, base + 22.5, doneLetter);

  caps(f, "Identity", cx + cw / 2, base + 26, rgba(pal.ink3, lerp(0.75, 1, doneCard)));
  caps(f, "Address", lx + lw / 2, base + 26, rgba(pal.ink3, lerp(0.75, 1, doneLetter)));
};

export function Documents({ ratio = 1.618, className }: { ratio?: number; className?: string }) {
  return <Figure draw={draw} ratio={ratio} className={className} />;
}
