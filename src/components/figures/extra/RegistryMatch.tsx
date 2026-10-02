"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { hash } from "../markets/kit";

/**
 * Contact, "How to tell a genuine reply from an imitation.": the second row
 * of the list, drawn. The upper strip is an entry in the official registry;
 * the lower strip is the address a message claims. Both are rows of blank
 * marks, one for each character, because no real address is shown. A glass
 * passes along them comparing mark with mark. On one pass every mark agrees
 * and the address is ruled off underneath. On the next, one mark is not the
 * same shape as the one above it: the glass stops being able to tie it, and
 * it is left ringed. An imitation is usually one character away.
 *
 * Pointer: the glass follows it along the strips.
 */

const N = 11;
const ODD = 7;
const TALL: boolean[] = [];
for (let i = 0; i < N; i++) TALL.push(hash(i + 11) > 0.45);

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, pal }) => {
  if (w < 160 || h < 50) return;
  const on = smooth(hover);
  ctx.lineCap = "round";
  const x0 = w * 0.1;
  const x1 = w * 0.9;
  const step = (x1 - x0) / N;
  const bw = step * 0.62;
  const yTop = h * 0.3;
  const yBot = h * 0.66;
  const unit = Math.max(6, h * 0.15);

  // two passes to a cycle: the first address is genuine, the second is not
  const cyc = t * 0.1;
  const imitation = Math.floor(cyc * 2) % 2 === 1;
  const ph = (cyc * 2) % 1;
  const auto = smooth(ph / 0.72);
  const u = lerp(auto, clamp((mx - x0) / (x1 - x0)), on);
  const glass = x0 + (x1 - x0) * u;
  const done = lerp(smooth((ph - 0.72) / 0.08) * (1 - smooth((ph - 0.94) / 0.06)), u > 0.97 ? 1 : 0, on);

  for (let i = 0; i < N; i++) {
    const x = x0 + i * step + (step - bw) / 2;
    const mid = x + bw / 2;
    const seen = smooth((glass - mid) / 8 + 0.5);
    const hTop = TALL[i] ? unit : unit * 0.6;
    const odd = imitation && i === ODD;
    const hBot = odd ? (TALL[i] ? unit * 0.6 : unit) : hTop;
    // the registry's mark
    ctx.lineWidth = 1;
    ctx.fillStyle = rgba(pal.gold, 0.22);
    ctx.fillRect(x, yTop - hTop, bw, hTop);
    ctx.strokeStyle = rgba(pal.gold, 0.9);
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(yTop - hTop) + 0.5, bw, hTop);
    // the message's mark
    ctx.fillStyle = rgba(pal.ink, 0.1 + seen * 0.1);
    ctx.fillRect(x, yBot, bw, hBot);
    ctx.strokeStyle = rgba(pal.ink, 0.55 + seen * 0.35);
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(yBot) + 0.5, bw, hBot);
    if (seen < 0.02) continue;
    if (odd) {
      // not the same: no tie, and a ring that stays
      ctx.strokeStyle = rgba(pal.ink, 0.9 * seen);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mid, yBot + hBot / 2, unit * 0.95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mid - 3, (yTop + yBot) / 2 - 2);
      ctx.lineTo(mid + 3, (yTop + yBot) / 2 - 2);
      ctx.moveTo(mid - 3, (yTop + yBot) / 2 + 2);
      ctx.lineTo(mid + 3, (yTop + yBot) / 2 + 2);
      ctx.moveTo(mid - 2, (yTop + yBot) / 2 + 5);
      ctx.lineTo(mid + 2, (yTop + yBot) / 2 - 5);
      ctx.stroke();
    } else {
      ctx.strokeStyle = rgba(pal.gold, seen);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(mid, yTop + 3);
      ctx.lineTo(mid, lerp(yTop + 3, yBot - 3, seen));
      ctx.stroke();
    }
  }

  // ruled off, when every mark agreed
  if (!imitation && done > 0.01) {
    ctx.strokeStyle = rgba(pal.gold, done);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, yBot + unit + 7);
    ctx.lineTo(lerp(x0, x1, done), yBot + unit + 7);
    ctx.stroke();
  }

  // the glass
  const gw = step * 1.5;
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(pal.accent, 0.9);
  ctx.fillStyle = rgba(pal.accent, 0.07);
  const gy = yTop - unit - 6;
  const gh = yBot + unit + 6 - gy;
  ctx.fillRect(glass - gw / 2, gy, gw, gh);
  ctx.strokeRect(glass - gw / 2, gy, gw, gh);
};

export function RegistryMatch({ ratio = 2.7 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
