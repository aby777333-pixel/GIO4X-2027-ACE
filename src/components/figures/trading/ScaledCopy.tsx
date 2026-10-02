"use client";

import { Figure, clamp, lerp, rgba, TAU, type FigureDraw } from "../Figure";
import { dot } from "./kit";

/**
 * "How it works, mechanically" (copy trading): a proportional rule, the
 * draughtsman's way of copying a drawing at another size. The rule turns on a
 * fixed pivot. The pen at its far end is the provider's and traces a path; a
 * second pen, part of the way along the same rule, cannot help but trace the
 * same path smaller. One movement, two sizes.
 *
 * The path is a closed loop with no direction to it: it is not a price.
 *
 * Pointer: the far pen follows the pointer, and the nearer pen copies whatever
 * it does, at its own scale.
 */

/** how far along the rule the copying pen sits */
const K = 0.42;
const TRAIL = 96;
/** seconds of the figure's clock between two samples of the trail */
const STEP = 0.045;

type Trail = { xy: Float32Array; head: number; n: number; acc: number };
const trails = new WeakMap<CanvasRenderingContext2D, Trail>();

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const ox = w * 0.07;
  const oy = h * 0.83;
  const ccx = w * 0.7;
  const ccy = h * 0.44;
  const rx = w * 0.2;
  const ry = h * 0.27;
  const pathX = (a: number) => ccx + rx * Math.sin(a);
  const pathY = (a: number) => ccy + ry * Math.sin(2 * a);
  const copyX = (x: number) => ox + K * (x - ox);
  const copyY = (y: number) => oy + K * (y - oy);

  // the two paths, faintly: the same figure at two sizes
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * TAU;
      const x = pass ? copyX(pathX(a)) : pathX(a);
      const y = pass ? copyY(pathY(a)) : pathY(a);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = pass ? rgba(pal.accent, 0.4) : rgba(pal.ink, 0.24);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // where the far pen is: on its path, or with the pointer
  const a = f.t * 0.55;
  const px = lerp(pathX(a), clamp(f.mx, w * 0.3, w - 10), f.hover);
  const py = lerp(pathY(a), clamp(f.my, 10, h - 10), f.hover);
  const qx = copyX(px);
  const qy = copyY(py);

  // what each pen has just drawn
  let tr = trails.get(ctx);
  if (!tr) {
    tr = { xy: new Float32Array(TRAIL * 2), head: 0, n: 0, acc: 0 };
    trails.set(ctx, tr);
  }
  if (f.still || tr.n === 0) {
    for (let i = 0; i < TRAIL; i++) {
      const b = a - (TRAIL - 1 - i) * STEP * 0.55;
      tr.xy[i * 2] = pathX(b);
      tr.xy[i * 2 + 1] = pathY(b);
    }
    tr.head = 0;
    tr.n = TRAIL;
    tr.acc = 0;
  } else {
    // one sample each STEP of the figure's own clock, whatever the frame rate
    tr.acc += f.dt;
    if (tr.acc >= STEP) {
      tr.acc = Math.min(tr.acc - STEP, STEP);
      tr.xy[tr.head * 2] = px;
      tr.xy[tr.head * 2 + 1] = py;
      tr.head = (tr.head + 1) % TRAIL;
    }
  }
  const CHUNKS = 4;
  const per = TRAIL / CHUNKS;
  for (let pass = 0; pass < 2; pass++) {
    for (let c = 0; c < CHUNKS; c++) {
      ctx.beginPath();
      for (let i = c * per; i <= Math.min(TRAIL - 1, (c + 1) * per); i++) {
        const at = ((tr.head + i) % TRAIL) * 2;
        const x = pass ? copyX(tr.xy[at]) : tr.xy[at];
        const y = pass ? copyY(tr.xy[at + 1]) : tr.xy[at + 1];
        if (i === c * per) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (c === CHUNKS - 1) ctx.lineTo(pass ? qx : px, pass ? qy : py);
      const fade = (c + 1) / CHUNKS;
      ctx.strokeStyle = pass ? rgba(pal.accent, 0.95 * fade) : rgba(pal.ink, 0.7 * fade);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // the rule: from the pivot through both pens, graduated in equal parts of its own length
  const dx = px - ox;
  const dy = py - oy;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(px + ux * 10, py + uy * 10);
  ctx.strokeStyle = rgba(pal.ink, 0.55);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 1; i < 12; i++) {
    const gx = ox + (dx * i) / 12;
    const gy = oy + (dy * i) / 12;
    const t = i % 3 === 0 ? 5 : 3;
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx - uy * t, gy + ux * t);
  }
  ctx.strokeStyle = rgba(pal.ink, 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();

  // the pivot
  ctx.beginPath();
  ctx.moveTo(ox - 9, oy + 13);
  ctx.lineTo(ox, oy);
  ctx.lineTo(ox + 9, oy + 13);
  ctx.closePath();
  ctx.strokeStyle = rgba(pal.ink, 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();
  dot(ctx, ox, oy, 4, rgba(pal.surface, 1));
  ctx.beginPath();
  ctx.arc(ox, oy, 4, 0, TAU);
  ctx.strokeStyle = rgba(pal.gold, 1);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // the two pens
  dot(ctx, px, py, 5.5, rgba(pal.surface, 1));
  ctx.beginPath();
  ctx.arc(px, py, 5.5, 0, TAU);
  ctx.strokeStyle = rgba(pal.ink, 0.85);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  dot(ctx, px, py, 1.75, rgba(pal.ink, 0.85));

  dot(ctx, qx, qy, 4.5, rgba(pal.surface, 1));
  ctx.beginPath();
  ctx.arc(qx, qy, 4.5, 0, TAU);
  ctx.strokeStyle = rgba(pal.accent, 1);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  dot(ctx, qx, qy, 1.5, rgba(pal.accent, 1));
};

export function ScaledCopy({ ratio = 2.5, className }: { ratio?: number; className?: string }) {
  return <Figure draw={draw} ratio={ratio} className={className} />;
}
