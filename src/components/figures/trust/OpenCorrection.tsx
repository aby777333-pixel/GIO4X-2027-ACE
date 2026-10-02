"use client";

import { Figure, TAU, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * A correction made in the open, for "A mistake is corrected in the open." on
 * the editorial standards page.
 *
 * An article, its words drawn as short bars. One word is struck through with
 * a ruled line and stays where it was; its replacement is written in above
 * it; a correction note is added at the foot; and a second date appears
 * beside the first, which does not move.
 *
 * Pointer: the corrected state is held, and a leader joins the struck word to
 * the note that accounts for it.
 */

const CYCLE = 10;
/** each row of the article as word lengths, in shares of the column; the gaps between words are fixed */
const ROWS: readonly (readonly number[])[] = [
  [0.14, 0.22, 0.09, 0.19, 0.16],
  [0.2, 0.1, 0.21, 0.13, 0.12],
  [0.11, 0.24, 0.16, 0.08, 0.2],
  [0.18, 0.13, 0.22],
];
/** the word that is wrong: row and position */
const BAD_ROW = 1;
const BAD_WORD = 2;
const GAP = 9;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  const x0 = 18;
  const x1 = w - 18;
  const span = x1 - x0;
  const top = 34;
  const foot = h - 16;
  const pitch = Math.min(40, (foot - top - 78) / (ROWS.length - 1));
  const u = (f.t % CYCLE) / CYCLE;
  const hold = f.still ? 1 : Math.max(f.hover, 1 - smooth((u - 0.9) / 0.1));
  const stage = (a: number, b: number) => (f.still ? 1 : Math.max(f.hover, smooth((u - a) / (b - a)))) * hold;
  const struck = stage(0.06, 0.18);
  const written = stage(0.18, 0.3);
  const noted = stage(0.3, 0.42);
  const dated = stage(0.4, 0.5);

  ctx.lineCap = "butt";
  ctx.font = `600 10px ${pal.font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  // the article, word by word
  let bx0 = x0;
  let bx1 = x0;
  const by = top + BAD_ROW * pitch;
  for (let r = 0; r < ROWS.length; r++) {
    const row = ROWS[r];
    const y = top + r * pitch;
    let x = x0;
    for (let k = 0; k < row.length; k++) {
      const len = row[k] * (span - GAP * 4);
      const bad = r === BAD_ROW && k === BAD_WORD;
      if (bad) {
        bx0 = x;
        bx1 = x + len;
      }
      ctx.fillStyle = rgba(pal.ink, bad ? 0.5 : 0.2);
      ctx.fillRect(x, y - 2.5, len, 5);
      x += len + GAP;
    }
  }

  // struck through with a ruled line, not removed
  ctx.lineCap = "round";
  if (struck > 0.004) {
    ctx.beginPath();
    ctx.moveTo(bx0 - 4, by);
    ctx.lineTo(lerp(bx0 - 4, bx1 + 4, struck), by);
    ctx.strokeStyle = rgba(pal.accent, 1);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // the replacement, written in above, with its caret
  if (written > 0.004) {
    const y = by - 13;
    ctx.fillStyle = rgba(pal.accent, 0.95);
    ctx.fillRect(bx0, y - 2.5, (bx1 - bx0) * 0.84 * written, 5);
    ctx.beginPath();
    ctx.moveTo(bx0 - 8, by - 6);
    ctx.lineTo(bx0 - 4.5, y - 1);
    ctx.lineTo(bx0 - 1, by - 6);
    ctx.strokeStyle = rgba(pal.accent, written);
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }

  // the note at the foot of the article
  const ny = top + (ROWS.length - 1) * pitch + 36;
  ctx.beginPath();
  ctx.moveTo(x0, ny - 17.5);
  ctx.lineTo(x1, ny - 17.5);
  ctx.strokeStyle = rgba(pal.line, 1);
  ctx.lineWidth = 1;
  ctx.stroke();
  if (noted > 0.004) {
    ctx.fillStyle = rgba(pal.accent, noted);
    ctx.fillRect(x0, ny - 7, 2, 25);
    ctx.fillStyle = rgba(pal.ink, noted);
    ctx.fillText("CORRECTION", x0 + 10, ny);
    ctx.fillStyle = rgba(pal.ink, 0.2 * noted);
    ctx.fillRect(x0 + 10, ny + 11, (span * 0.7 - 10) * noted, 5);
  }
  // under the pointer: the note answers for the struck word
  const tie = f.still ? 0 : f.hover * noted;
  if (tie > 0.004) {
    const tx = (bx0 + bx1) / 2;
    ctx.beginPath();
    ctx.setLineDash([2, 4]);
    ctx.moveTo(tx, by + 7);
    ctx.lineTo(tx, lerp(by + 7, ny - 9, tie));
    ctx.strokeStyle = rgba(pal.accent, 0.9);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // the dates: the first stays where it is, the second is added
  ctx.beginPath();
  ctx.arc(x0 + 4, foot, 3.5, 0, TAU);
  ctx.fillStyle = rgba(pal.gold, 1);
  ctx.fill();
  ctx.fillStyle = rgba(pal.ink3, 1);
  ctx.fillText("PUBLISHED", x0 + 14, foot + 0.5);
  if (dated > 0.004) {
    const ux = x0 + span * 0.46;
    ctx.beginPath();
    ctx.arc(ux + 4, foot, 3, 0, TAU);
    ctx.strokeStyle = rgba(pal.accent, dated);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = rgba(pal.ink, dated);
    ctx.fillText("UPDATED", ux + 14, foot + 0.5);
  }
};

export function OpenCorrection() {
  return <Figure draw={draw} />;
}
