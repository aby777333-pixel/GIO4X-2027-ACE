"use client";

import { Figure, lerp, rgba, smooth, TAU, type FigureDraw, type FigureFrame } from "../Figure";
import { box, dot, lamp, line } from "./kit";

/**
 * "Why it works this way" (funding): the closed loop of a payment. Two plates
 * carry the same name: the account the money comes from, on the left, and the
 * trading account, on the right. A payment leaves the left plate along the
 * upper track, passes the provider that carries it, reaches the right plate,
 * and later returns along the lower track to the plate it started from. Each
 * plate's name lights as the payment reaches it, and the dashed tie between
 * them is the rule itself: the same name at both ends.
 *
 * Pointer: the payment goes to the point of the loop nearest the pointer, and
 * both names and the tie between them light together.
 */

const CYCLE = 11;
/** the same three strokes on both plates: one name */
const NAME = [0.62, 0.36, 0.5];

/** where the payment is on the loop when left alone: it rests at each plate */
function journey(t: number): number {
  const q = (t % CYCLE) / CYCLE;
  if (q < 0.42) return 0.5 * smooth(q / 0.42);
  if (q < 0.5) return 0.5;
  if (q < 0.92) return 0.5 + 0.5 * smooth((q - 0.5) / 0.42);
  return 1;
}

function plate(f: FigureFrame, cx: number, cy: number, pw: number, ph: number, lit: number) {
  const { ctx, pal } = f;
  box(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 5);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.55);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  for (let i = 0; i < NAME.length; i++) {
    const y = cy + (i - 1) * (ph * 0.24);
    const x0 = cx - pw * 0.32;
    const x1 = x0 + pw * NAME[i];
    line(ctx, x0, y, x1, y, rgba(pal.ink, 0.5), i === 0 ? 2 : 1.5);
    if (lit > 0.004) line(ctx, x0, y, x1, y, rgba(pal.gold, lit), i === 0 ? 2 : 1.5);
  }
}

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const cy = h * 0.5;
  const r = h * 0.24;
  const xa = w * 0.29;
  const xb = w * 0.71;
  const straight = xb - xa;
  const quarter = (Math.PI * r) / 2;
  const total = 2 * straight + 4 * quarter;

  // a point of the loop: 0 at the left plate, clockwise over the top, 0.5 at the right plate
  let lx = 0;
  let ly = 0;
  const at = (u: number) => {
    let d = (((u % 1) + 1) % 1) * total;
    if (d < quarter) {
      const a = Math.PI + d / r;
      lx = xa + r * Math.cos(a);
      ly = cy + r * Math.sin(a);
      return;
    }
    d -= quarter;
    if (d < straight) {
      lx = xa + d;
      ly = cy - r;
      return;
    }
    d -= straight;
    if (d < 2 * quarter) {
      const a = Math.PI * 1.5 + d / r;
      lx = xb + r * Math.cos(a);
      ly = cy + r * Math.sin(a);
      return;
    }
    d -= 2 * quarter;
    if (d < straight) {
      lx = xb - d;
      ly = cy + r;
      return;
    }
    d -= straight;
    const a = Math.PI * 0.5 + d / r;
    lx = xa + r * Math.cos(a);
    ly = cy + r * Math.sin(a);
  };

  // where the payment is: on its journey, or at the point nearest the pointer
  let u = journey(f.t);
  if (f.hover > 0.004) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < 64; i++) {
      at(i / 64);
      const d = (lx - f.mx) * (lx - f.mx) + (ly - f.my) * (ly - f.my);
      if (d < bestD) {
        bestD = d;
        best = i / 64;
      }
    }
    let delta = (best - u) % 1;
    if (delta > 0.5) delta -= 1;
    if (delta < -0.5) delta += 1;
    u += delta * f.hover;
  }
  const uu = ((u % 1) + 1) % 1;
  const nearLeft = smooth(1 - Math.min(uu, 1 - uu) / 0.1);
  const nearRight = smooth(1 - Math.abs(uu - 0.5) / 0.1);
  const tie = Math.max(f.hover, nearLeft, nearRight);

  // the tie between the plates: one name
  ctx.setLineDash([2, 5]);
  line(ctx, xa - r, cy, xb + r, cy, rgba(pal.ink, 0.28), 1);
  if (tie > 0.004) line(ctx, xa - r, cy, xb + r, cy, rgba(pal.gold, 0.9 * tie), 1);
  ctx.setLineDash([]);
  dot(ctx, w / 2, cy, 9, rgba(pal.surface, 1));
  for (const dy of [-2.5, 2.5]) {
    line(ctx, w / 2 - 4.5, cy + dy, w / 2 + 4.5, cy + dy, rgba(pal.ink, 0.5), 1.5);
    if (tie > 0.004) line(ctx, w / 2 - 4.5, cy + dy, w / 2 + 4.5, cy + dy, rgba(pal.gold, tie), 1.5);
  }

  // the loop
  ctx.beginPath();
  ctx.moveTo(xa, cy - r);
  ctx.lineTo(xb, cy - r);
  ctx.arc(xb, cy, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(xa, cy + r);
  ctx.arc(xa, cy, r, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
  ctx.strokeStyle = rgba(pal.ink, 0.4);
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // its direction: out along the top, back along the bottom
  ctx.beginPath();
  for (const k of [0.3, 0.7]) {
    const x = lerp(xa, xb, k);
    ctx.moveTo(x - 4, cy - r - 4);
    ctx.lineTo(x, cy - r);
    ctx.lineTo(x - 4, cy - r + 4);
    ctx.moveTo(x + 4, cy + r - 4);
    ctx.lineTo(x, cy + r);
    ctx.lineTo(x + 4, cy + r + 4);
  }
  ctx.strokeStyle = rgba(pal.ink, 0.5);
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // what the payment has just travelled
  for (let c = 0; c < 2; c++) {
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      at(u - 0.13 + (c * 10 + i) * 0.0065);
      if (i) ctx.lineTo(lx, ly);
      else ctx.moveTo(lx, ly);
    }
    ctx.strokeStyle = rgba(pal.accent, c ? 0.95 : 0.4);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // the provider that carries it, each way
  for (const side of [-1, 1]) {
    const y = cy + side * r;
    const near = smooth(1 - Math.abs(uu - (side < 0 ? 0.25 : 0.75)) / 0.07);
    ctx.beginPath();
    ctx.moveTo(w / 2, y - 6.5);
    ctx.lineTo(w / 2 + 6.5, y);
    ctx.lineTo(w / 2, y + 6.5);
    ctx.lineTo(w / 2 - 6.5, y);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink, 0.6);
    ctx.lineWidth = 1.25;
    ctx.stroke();
    if (near > 0.004) {
      ctx.strokeStyle = rgba(pal.accent, near);
      ctx.stroke();
    }
  }

  // the two plates, bearing one name
  const pw = w * 0.15;
  const ph = h * 0.34;
  plate(f, xa - r - pw / 2 + 1, cy, pw, ph, Math.max(f.hover, nearLeft));
  plate(f, xb + r + pw / 2 - 1, cy, pw, ph, Math.max(f.hover, nearRight));

  // the payment
  at(u);
  lamp(ctx, lx, ly, 4, pal.accent, 1);
  ctx.beginPath();
  ctx.arc(lx, ly, 4, 0, TAU);
  ctx.strokeStyle = rgba(pal.surface, 1);
  ctx.lineWidth = 1;
  ctx.stroke();
};

export function ReturnLoop({ ratio = 2.8, className }: { ratio?: number; className?: string }) {
  return <Figure draw={draw} ratio={ratio} className={className} />;
}
