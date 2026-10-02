"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw, type FigureFrame } from "../Figure";
import { box, line } from "./kit";

/**
 * "Published consistently" (PAMM): funds are added or withdrawn at the end of
 * a trading period, not in the middle of one. A pool stands behind a gate. The
 * bar along the top is the period running. Requests arrive while it runs,
 * additions on the upper lane and a withdrawal on the lower, and wait at the
 * gate. When the bar reaches its end the gate opens, they pass in their two
 * directions, and the next period begins.
 *
 * The period has no length here: the site does not publish one.
 *
 * Pointer: a request of your own follows the pointer along the nearer lane.
 * It can be pushed up to the gate but not through it until the period closes.
 */

const CYCLE = 9;
/** when each addition sets off, as a share of the period */
const ARRIVE = [0.03, 0.14, 0.44];
const TOKEN = 9;

function token(f: FigureFrame, x: number, y: number, a: number, hollow: boolean, own = false) {
  if (a <= 0.004) return;
  const { ctx, pal } = f;
  box(ctx, x - TOKEN / 2, y - TOKEN / 2, TOKEN, TOKEN, 2);
  if (hollow) {
    ctx.fillStyle = rgba(pal.surface, a);
    ctx.fill();
    ctx.strokeStyle = own ? rgba(pal.gold, a) : rgba(pal.ink, 0.75 * a);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = own ? rgba(pal.gold, a) : rgba(pal.accent, 0.9 * a);
    ctx.fill();
  }
}

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const left = w * 0.07;
  const right = w * 0.93;
  const gate = w * 0.56;
  const poolTop = h * 0.34;
  const poolBottom = h * 0.9;
  const upper = lerp(poolTop, poolBottom, 0.28);
  const lower = lerp(poolTop, poolBottom, 0.72);
  const p = (f.t % CYCLE) / CYCLE;
  const open = smooth((p - 0.78) / 0.06) * (1 - smooth((p - 0.94) / 0.06));

  // the period: a bar that fills, and closes at its far end
  const barY = h * 0.15;
  const run = clamp(p / 0.78);
  line(ctx, left, barY, right, barY, rgba(pal.ink, 0.2), 3);
  line(ctx, left, barY, lerp(left, right, run), barY, rgba(pal.gold, 1 - 0.75 * smooth((p - 0.9) / 0.1)), 3);
  line(ctx, left, barY - 6, left, barY + 6, rgba(pal.ink, 0.5), 1);
  line(ctx, right, barY - 6, right, barY + 6, rgba(pal.ink, 0.5), 1);
  // the period's close is what works the gate
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(right, barY + 6);
  ctx.lineTo(right, poolTop - 9);
  ctx.lineTo(gate, poolTop - 9);
  ctx.lineTo(gate, poolTop);
  ctx.strokeStyle = rgba(pal.gold, lerp(0.35, 1, open));
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  // the lanes leading to the gate
  line(ctx, left, upper, gate, upper, rgba(pal.line, 1.5), 1);
  line(ctx, left, lower, gate, lower, rgba(pal.line, 1.5), 1);

  // the pool, and what is already in it
  ctx.fillStyle = rgba(pal.accent, 0.07);
  ctx.fillRect(gate, poolTop, right - gate, poolBottom - poolTop);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      token(f, lerp(gate, right, 0.46) + c * 17, lerp(poolTop, poolBottom, 0.24 + r * 0.26), 0.42, false);
    }
  }
  ctx.beginPath();
  ctx.moveTo(gate, poolTop);
  ctx.lineTo(right, poolTop);
  ctx.lineTo(right, poolBottom);
  ctx.lineTo(gate, poolBottom);
  ctx.strokeStyle = rgba(pal.ink, 0.55);
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // the gate: two leaves that draw back when the period closes
  const half = (lower - upper) / 2;
  const reach = lerp(1, 0.14, open);
  for (const lane of [upper, lower]) {
    const outer = lane === upper ? poolTop : poolBottom;
    const inner = lane === upper ? lane + half : lane - half;
    line(ctx, gate, outer, gate, lerp(outer, inner, reach), rgba(pal.ink, 0.85), 2);
  }
  line(ctx, gate - 4, (upper + lower) / 2, gate + 4, (upper + lower) / 2, rgba(pal.ink, 0.5), 1);

  // additions: they arrive during the period, wait, and enter when it closes
  for (let k = 0; k < ARRIVE.length; k++) {
    const wait = gate - 13 - k * 15;
    const come = smooth((p - ARRIVE[k]) / 0.14);
    const pass = smooth((p - 0.81 - k * 0.02) / 0.1);
    const x = pass > 0 ? lerp(wait, gate + 26 + (2 - k) * 15, pass) : lerp(left, wait, come);
    token(f, x, upper, smooth((p - ARRIVE[k]) / 0.03) * (1 - smooth((p - 0.95) / 0.05)), false);
  }
  // a withdrawal: it waits on the inside, and leaves when the period closes
  const leave = smooth((p - 0.81) / 0.15);
  token(f, lerp(gate + 13, left + 6, leave), lower, smooth((p - 0.16) / 0.04) * (1 - smooth((leave - 0.7) / 0.3)), true);

  // your own request, with the pointer: stopped at the gate until it opens
  if (f.hover > 0.004) {
    const adding = f.my < (upper + lower) / 2;
    const x = adding ? Math.min(f.mx, lerp(gate - 13 - ARRIVE.length * 15, right - 12, open)) : Math.max(f.mx, lerp(gate + 28, left + 6, open));
    token(f, clamp(x, left, right - 12), adding ? upper : lower, f.hover, !adding, true);
  }
};

export function PeriodGate({ ratio = 2.8, className }: { ratio?: number; className?: string }) {
  return <Figure draw={draw} ratio={ratio} className={className} />;
}
