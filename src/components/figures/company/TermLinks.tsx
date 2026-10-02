"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * A glossary entry and its neighbours, for every term page: one index card in
 * the middle, the entries it leads to around it, each joined to it by a
 * thread. A light runs out along one thread after another, the way a reader
 * follows a cross-reference.
 *
 * Pointer: the neighbour nearest to it lights, its thread firms up and the
 * card leans a little that way.
 */

/** the neighbours, as fractions of the canvas: fixed places, slightly uneven like a pinboard */
const NODES = [
  { x: 0.13, y: 0.2 },
  { x: 0.08, y: 0.58 },
  { x: 0.27, y: 0.83 },
  { x: 0.74, y: 0.2 },
  { x: 0.9, y: 0.52 },
  { x: 0.76, y: 0.82 },
] as const;
const PERIOD = 2.4;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, my, pal, still } = f;
  const cx = w * 0.52;
  const cy = h * 0.5;
  const cw = Math.min(w * 0.2, 92);
  const ch = cw * 0.62;

  // the neighbour nearest the pointer
  let near = 0;
  let best = Infinity;
  for (let i = 0; i < NODES.length; i++) {
    const d = Math.hypot(NODES[i].x * w - mx, NODES[i].y * h - my);
    if (d < best) {
      best = d;
      near = i;
    }
  }
  const turn = Math.floor(t / PERIOD) % NODES.length;
  const run = still ? 0.6 : smooth(clamp(((t / PERIOD) % 1) / 0.7));
  const lean = hover * 4;
  const ox = cx + (NODES[near].x * w - cx > 0 ? lean : -lean);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // threads, then neighbours
  for (let i = 0; i < NODES.length; i++) {
    const nx = NODES[i].x * w;
    const ny = NODES[i].y * h;
    const picked = i === near ? hover : 0;
    const going = i === turn ? 1 - hover : 0;
    const side = nx < cx ? -1 : 1;
    const sx = ox + (side * cw) / 2;
    const bend = (nx - sx) * 0.5;
    ctx.strokeStyle = rgba(pal.ink, 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, cy);
    ctx.bezierCurveTo(sx + bend, cy, nx - bend, ny, nx, ny);
    ctx.stroke();
    if (picked > 0.01) {
      ctx.strokeStyle = rgba(pal.accent, picked);
      ctx.lineWidth = 1.75;
      ctx.stroke();
    }
    if (going > 0.01) {
      // the light on its way out along this thread (a point on the same curve)
      const k = run;
      const m = 1 - k;
      const lx = m * m * m * sx + 3 * m * m * k * (sx + bend) + 3 * m * k * k * (nx - bend) + k * k * k * nx;
      const ly = m * m * m * cy + 3 * m * m * k * cy + 3 * m * k * k * ny + k * k * k * ny;
      ctx.fillStyle = rgba(pal.gold, going);
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, TAU);
      ctx.fill();
    }

    // the neighbour: a small card with a heading stroke
    const lit = Math.max(picked, going * smooth(clamp((run - 0.8) / 0.2)));
    const nw = cw * 0.5 + 4 * picked;
    const nh = ch * 0.46 + 3 * picked;
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fillRect(nx - nw / 2, ny - nh / 2, nw, nh);
    ctx.strokeStyle = rgba(pal.ink, 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(nx - nw / 2, ny - nh / 2, nw, nh);
    if (lit > 0.01) {
      ctx.strokeStyle = rgba(picked > 0.01 ? pal.accent : pal.gold, lit);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(nx - nw / 2, ny - nh / 2, nw, nh);
    }
    ctx.strokeStyle = rgba(pal.ink, 0.6);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(nx - nw / 2 + 5, ny - nh / 2 + 6);
    ctx.lineTo(nx - nw / 2 + 5 + nw * lerp(0.4, 0.62, (i * 0.37) % 1), ny - nh / 2 + 6);
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.ink, 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(nx - nw / 2 + 5, ny + nh / 2 - 6);
    ctx.lineTo(nx + nw / 2 - 5, ny + nh / 2 - 6);
    ctx.stroke();
  }

  // the entry itself: an index card with a tab, a heavy heading and its lines of definition
  const x0 = ox - cw / 2;
  const y0 = cy - ch / 2;
  ctx.fillStyle = rgba(pal.ink, 0.07);
  ctx.fillRect(x0 + 4, y0 + 4, cw, ch);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fillRect(x0, y0, cw, ch);
  ctx.strokeStyle = rgba(pal.ink, 0.75);
  ctx.lineWidth = 1.25;
  ctx.strokeRect(x0, y0, cw, ch);
  ctx.strokeStyle = rgba(pal.gold, 1);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + cw * 0.34, y0);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.ink, 0.9);
  ctx.lineWidth = 2.25;
  ctx.beginPath();
  ctx.moveTo(x0 + 9, y0 + ch * 0.3);
  ctx.lineTo(x0 + cw * 0.6, y0 + ch * 0.3);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.ink, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const ly = y0 + ch * (0.52 + i * 0.15);
    ctx.moveTo(x0 + 9, ly);
    ctx.lineTo(x0 + cw - (i === 2 ? cw * 0.4 : 9), ly);
  }
  ctx.stroke();
};

export function TermLinks() {
  return <Figure draw={draw} ratio={2.4} />;
}
