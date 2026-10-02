"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * A sorting rack for the contact form: ten pigeonholes, one for each topic the
 * form offers. A letter carrying its topic tag travels along the rail above
 * the rack and drops into the pigeonhole the tag names, which lights to
 * receive it. The tag never leaves the letter: the topic travels with the
 * message.
 *
 * Pointer: the pigeonhole under it opens and the letter is sorted there.
 */

const COLS = 5;
const ROWS = 2;
/** the order the letters are sorted in when nobody is pointing: fixed, not random */
const ORDER = [3, 6, 0, 8, 2, 9, 5, 1, 7, 4] as const;
const PERIOD = 3.2;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, my, pal, still } = f;
  const padX = 21;
  const railY = h * 0.17;
  const top = h * 0.33;
  const bottom = h - 18;
  const cw = (w - padX * 2) / COLS;
  const ch = (bottom - top) / ROWS;
  const depth = Math.min(cw, ch) * 0.16;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const slotX = (i: number) => padX + ((i % COLS) + 0.5) * cw;
  const slotY = (i: number) => top + (Math.floor(i / COLS) + 0.56) * ch;

  // which pigeonhole: the one in the fixed order, or the one under the pointer
  const turn = Math.floor(t / PERIOD);
  const u = still ? 0.82 : (t / PERIOD) % 1;
  const autoSlot = ORDER[turn % ORDER.length];
  const hc = clamp(Math.floor((mx - padX) / cw), 0, COLS - 1);
  const hr = clamp(Math.floor((my - top) / ch), 0, ROWS - 1);
  const handSlot = hr * COLS + hc;

  // the letter's own path: along the rail, then down into the pigeonhole
  const tx = slotX(autoSlot);
  const ty = slotY(autoSlot);
  const along = smooth(clamp(u / 0.45));
  const down = smooth(clamp((u - 0.45) / 0.25));
  const ax = lerp(padX - 4, tx, along);
  const ay = lerp(railY, ty, down);
  const lx = lerp(ax, slotX(handSlot), hover);
  const ly = lerp(ay, slotY(handSlot), hover);
  const gone = still || hover > 0.5 ? 0 : smooth(clamp((u - 0.88) / 0.12));
  const born = still ? 1 : smooth(clamp(u / 0.08));

  // the rail the letter arrives on
  ctx.strokeStyle = rgba(pal.ink, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX - 8, railY + 12);
  ctx.lineTo(w - padX + 8, railY + 12);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.ink, 0.14);
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  for (let c = 0; c < COLS; c++) {
    const x = padX + (c + 0.5) * cw;
    ctx.moveTo(x, railY + 12);
    ctx.lineTo(x, top);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // the rack: each pigeonhole is an opening with a back wall set a little way in
  for (let i = 0; i < COLS * ROWS; i++) {
    const x = padX + (i % COLS) * cw;
    const y = top + Math.floor(i / COLS) * ch;
    const received = lerp(i === autoSlot ? down * (1 - gone) : 0, i === handSlot ? 1 : 0, hover);
    ctx.fillStyle = rgba(pal.ink, 0.08);
    ctx.fillRect(x + depth, y + depth, cw - depth * 2, ch - depth);
    if (received > 0.01) {
      ctx.fillStyle = rgba(pal.gold, 0.26 * received);
      ctx.fillRect(x, y, cw, ch);
    }
    ctx.strokeStyle = rgba(pal.ink, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + depth, y + depth);
    ctx.lineTo(x + cw - depth, y + depth);
    ctx.lineTo(x + cw, y);
    ctx.moveTo(x + depth, y + depth);
    ctx.lineTo(x + depth, y + ch);
    ctx.moveTo(x + cw - depth, y + depth);
    ctx.lineTo(x + cw - depth, y + ch);
    ctx.stroke();
    // its label holder
    ctx.strokeStyle = rgba(received > 0.01 ? pal.gold : pal.ink, received > 0.01 ? 0.5 + 0.5 * received : 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + cw * 0.32, y + ch - 6);
    ctx.lineTo(x + cw * 0.68, y + ch - 6);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(pal.ink, 0.7);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let c = 0; c <= COLS; c++) {
    ctx.moveTo(padX + c * cw, top);
    ctx.lineTo(padX + c * cw, bottom);
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.moveTo(padX, top + r * ch);
    ctx.lineTo(w - padX, top + r * ch);
  }
  ctx.stroke();

  // the letter, with its topic tag
  const ew = Math.min(cw * 0.58, 42);
  const eh = ew * 0.64;
  ctx.globalAlpha = born * (1 - gone);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fillRect(lx - ew / 2, ly - eh / 2, ew, eh);
  ctx.strokeStyle = rgba(pal.ink, 0.8);
  ctx.lineWidth = 1.25;
  ctx.strokeRect(lx - ew / 2, ly - eh / 2, ew, eh);
  ctx.strokeStyle = rgba(pal.ink, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lx - ew / 2, ly - eh / 2);
  ctx.lineTo(lx, ly + eh * 0.08);
  ctx.lineTo(lx + ew / 2, ly - eh / 2);
  ctx.stroke();
  ctx.fillStyle = rgba(pal.accent, 1);
  ctx.fillRect(lx + ew / 2 - 3, ly - eh / 2 - 4, 9, 6);
  ctx.globalAlpha = 1;
};

export function SortingRack() {
  return <Figure draw={draw} />;
}
