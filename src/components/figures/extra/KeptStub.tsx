"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { glow } from "../markets/kit";

/**
 * Support, "What to leave out, and what to keep.": the third row of the list.
 * A request is a ticket in two parts joined by a perforation. The larger part
 * is the request itself: it tears away and goes. The stub stays in your hand,
 * and the reference on it (drawn as empty boxes: no characters) is the only
 * way back to the request. Then a fresh ticket takes its place.
 *
 * Pointer: it tears the ticket by hand. Carry it to the right and the request
 * leaves; the stub stays where it is and its reference lights.
 */

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, pal }) => {
  if (w < 160 || h < 50) return;
  const on = smooth(hover);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const th = h * 0.6;
  const y = (h - th) / 2;
  const x0 = w * 0.08;
  const stubW = w * 0.26;
  const bodyW = w * 0.36;
  const perf = x0 + stubW;

  // a fresh ticket, a pause, the tear, the stub alone
  const ph = (t * 0.15) % 1;
  const appear = smooth(ph / 0.1);
  const auto = smooth((ph - 0.3) / 0.4);
  const pull = lerp(auto, clamp((mx - perf - w * 0.06) / (w * 0.32)), on);
  const alone = lerp(smooth((ph - 0.94) / 0.06), 0, on);
  const all = lerp(appear * (1 - alone), 1, on);

  // the request: it leaves
  const bx = perf + pull * w * 0.26;
  const ba = all * (1 - smooth((pull - 0.55) / 0.45) * 0.85);
  ctx.fillStyle = rgba(pal.surface, 0.9 * ba);
  ctx.fillRect(bx, y, bodyW, th);
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(pal.ink, 0.8 * ba);
  ctx.beginPath();
  ctx.moveTo(bx, y);
  ctx.lineTo(bx + bodyW, y);
  ctx.lineTo(bx + bodyW, y + th);
  ctx.lineTo(bx, y + th);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.8 * ba);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const ly = Math.round(y + th * (0.24 + i * 0.18)) + 0.5;
    ctx.moveTo(bx + bodyW * 0.1, ly);
    ctx.lineTo(bx + bodyW * (i === 3 ? 0.5 : 0.9), ly);
  }
  ctx.stroke();
  // its torn edge
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = rgba(pal.ink2, 0.8 * ba);
  ctx.beginPath();
  ctx.moveTo(bx + 0.5, y);
  ctx.lineTo(bx + 0.5, y + th);
  ctx.stroke();
  ctx.setLineDash([]);
  // the way it goes
  if (pull > 0.02) {
    ctx.strokeStyle = rgba(pal.ink3, 0.6 * pull * all);
    ctx.setLineDash([1, 4]);
    ctx.beginPath();
    ctx.moveTo(perf + 6, h / 2);
    ctx.lineTo(bx - 6, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // the stub: it stays
  const kept = clamp(pull * 1.4);
  glow(ctx, x0 + stubW / 2, h / 2, stubW * 0.9, pal.gold, 0.22 * kept * all);
  ctx.fillStyle = rgba(pal.surface, 0.95 * all);
  ctx.fillRect(x0, y, stubW, th);
  ctx.fillStyle = rgba(pal.gold, (0.08 + kept * 0.12) * all);
  ctx.fillRect(x0, y, stubW, th);
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(pal.ink, 0.85 * all);
  ctx.beginPath();
  ctx.moveTo(perf, y);
  ctx.lineTo(x0, y);
  ctx.lineTo(x0, y + th);
  ctx.lineTo(perf, y + th);
  ctx.stroke();
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(perf - 0.5, y);
  ctx.lineTo(perf - 0.5, y + th);
  ctx.stroke();
  ctx.setLineDash([]);
  // the reference: five boxes, no characters
  const box = Math.min(stubW * 0.13, th * 0.2);
  const rx = x0 + (stubW - box * 5 - 3 * 4) / 2;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const cx = rx + i * (box + 3);
    ctx.fillStyle = rgba(pal.gold, (0.2 + kept * 0.5) * all);
    ctx.fillRect(cx, h / 2 - box / 2 + th * 0.1, box, box);
    ctx.strokeStyle = rgba(pal.gold, 0.95 * all);
    ctx.strokeRect(Math.round(cx) + 0.5, Math.round(h / 2 - box / 2 + th * 0.1) + 0.5, box, box);
  }
  ctx.strokeStyle = rgba(pal.ink3, 0.8 * all);
  ctx.beginPath();
  ctx.moveTo(rx, y + th * 0.26);
  ctx.lineTo(rx + stubW * 0.36, y + th * 0.26);
  ctx.stroke();
};

export function KeptStub({ ratio = 2.7 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
