"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * The three marks of the changelog, as a small key that stays beside the
 * entry: a plus for what is new, a tilde for what has changed, a minus for
 * what was removed. Beside each mark a pen rules that kind of line: a new
 * line is written, a changed line is written over, a removed line is struck
 * through.
 *
 * Pointer: the row under it comes forward and its line is ruled again.
 */

const PERIOD = 2.8;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, my, pal, still } = f;
  const pad = 10;
  const rowH = (h - pad * 2) / 3;
  const box = Math.min(26, rowH * 0.5);
  const turn = Math.floor(t / PERIOD) % 3;
  const hot = clamp(Math.floor((my - pad) / rowH), 0, 2);
  const colours = [pal.emerald, pal.accent, pal.ink3] as const;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let r = 0; r < 3; r++) {
    const y = pad + (r + 0.5) * rowH;
    const bx = pad + 2;
    const col = colours[r];
    const active = lerp(r === turn ? 1 : 0, r === hot ? 1 : 0, hover);
    // how far this row's pen has got: a full line when it is not the row at work
    const pen = still ? 1 : r === turn || (hover > 0.5 && r === hot) ? smooth(clamp(((t / PERIOD) % 1) / 0.6)) : 1;

    // the boxed mark
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fillRect(bx, y - box / 2, box, box);
    ctx.strokeStyle = rgba(pal.ink, 0.3 + 0.4 * active);
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, y - box / 2, box, box);
    const mcx = bx + box / 2;
    const arm = box * 0.24;
    ctx.strokeStyle = rgba(col, 1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (r === 0) {
      ctx.moveTo(mcx - arm, y);
      ctx.lineTo(mcx + arm, y);
      ctx.moveTo(mcx, y - arm);
      ctx.lineTo(mcx, y + arm);
    } else if (r === 1) {
      ctx.moveTo(mcx - arm * 1.2, y + arm * 0.3);
      ctx.bezierCurveTo(mcx - arm * 0.5, y - arm * 0.9, mcx + arm * 0.5, y + arm * 0.9, mcx + arm * 1.2, y - arm * 0.3);
    } else {
      ctx.moveTo(mcx - arm, y);
      ctx.lineTo(mcx + arm, y);
    }
    ctx.stroke();

    // the lines of the record beside it
    const lx0 = bx + box + 12;
    const lx1 = w - pad - 2;
    const upper = y - 5;
    const lower = y + 6;
    ctx.strokeStyle = rgba(pal.ink, 0.2);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx0, lower);
    ctx.lineTo(lerp(lx0, lx1, 0.62), lower);
    ctx.stroke();

    const end = lerp(lx0, lx1, pen);
    if (r === 0) {
      // new: a line written where there was none
      ctx.strokeStyle = rgba(col, 0.95);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx0, upper);
      ctx.lineTo(end, upper);
      ctx.stroke();
    } else if (r === 1) {
      // changed: the old line, and the new one written over it
      ctx.strokeStyle = rgba(pal.ink, 0.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx0, upper);
      ctx.lineTo(lx1, upper);
      ctx.stroke();
      ctx.strokeStyle = rgba(col, 0.95);
      ctx.beginPath();
      ctx.moveTo(lx0, upper);
      ctx.lineTo(end, upper);
      ctx.stroke();
    } else {
      // removed: the line stays legible, with a stroke through it
      ctx.strokeStyle = rgba(pal.ink, 0.3);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(lx0, upper);
      ctx.lineTo(lx1, upper);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = rgba(pal.ink, 0.75);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(lx0 - 3, upper + 3);
      ctx.lineTo(lerp(lx0 - 3, lx1 + 3, pen), lerp(upper + 3, upper - 3, pen));
      ctx.stroke();
    }

    // the pen's point, while it is writing
    if (!still && pen < 0.995) {
      ctx.fillStyle = rgba(pal.gold, 1);
      ctx.beginPath();
      ctx.arc(end, r === 2 ? lerp(upper + 3, upper - 3, pen) : upper, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (r < 2) {
      ctx.strokeStyle = rgba(pal.ink, 0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, pad + (r + 1) * rowH);
      ctx.lineTo(w - pad, pad + (r + 1) * rowH);
      ctx.stroke();
    }
  }
};

export function ChangeMarks() {
  return <Figure draw={draw} ratio={1.25} />;
}
