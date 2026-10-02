"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { aim, caps, closeStage, dot, fract, glow, lamp, line, makeCam, openStage, project } from "../stage/kit";

/**
 * 777 Raptor, "Monitor.": what the chapter says is being watched once a
 * position is open. A block of glass stands on the deck: the margin in use.
 * A plane of light floats above it: equity. The posts between them are the
 * open positions, and the champagne rule at the corner measures the distance
 * from the plane down to the block. Inside the block two dashed levels are
 * marked: the levels at which positions are closed. The plane rises and
 * settles slowly, as equity does while a position is open, and a reading line
 * crosses it.
 *
 * Nothing in it is a quantity: the heights are arbitrary and no level is
 * GIO4X's. It is the geometry of the sentence beside it.
 *
 * Pointer: it carries the plane. Take it down and the measured distance
 * shortens to nothing; at the first level that level lights, and at the
 * second the positions go out. Moving sideways turns the whole thing.
 */

const CAM = makeCam();
const Q = [0, 0, 0, 0];
const HX = 1;
const HZ = 0.618;
const BLOCK = 0.52;
const LEVEL_1 = BLOCK * 0.618;
const LEVEL_2 = BLOCK * 0.382;
/** where the three open positions stand */
const POSTS = [
  [-0.56, 0.22],
  [0.04, -0.26],
  [0.52, 0.28],
] as const;

function quad(ctx: CanvasRenderingContext2D, y: number, k = 1) {
  ctx.beginPath();
  project(CAM, -HX * k, y, -HZ * k, Q);
  ctx.moveTo(Q[0], Q[1]);
  project(CAM, HX * k, y, -HZ * k, Q);
  ctx.lineTo(Q[0], Q[1]);
  project(CAM, HX * k, y, HZ * k, Q);
  ctx.lineTo(Q[0], Q[1]);
  project(CAM, -HX * k, y, HZ * k, Q);
  ctx.lineTo(Q[0], Q[1]);
  ctx.closePath();
}

function post(ctx: CanvasRenderingContext2D, x: number, z: number, y0: number, y1: number) {
  project(CAM, x, y0, z, Q);
  const ax = Q[0];
  const ay = Q[1];
  project(CAM, x, y1, z, Q);
  line(ctx, ax, ay, Q[0], Q[1]);
}

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, my, pal } = f;
  if (w < 160 || h < 90) return;
  const on = smooth(hover);
  openStage(f, 0.382, 0.382);

  const s = Math.min(w * 0.26, h * 0.43);
  aim(CAM, w * 0.4, h * 0.8, s, 6, -0.46 + Math.sin(t * 0.17) * 0.08 + (mx / w - 0.5) * 0.36 * on, 0.3);

  // equity: breathing by itself, or where the pointer carries it
  const auto = 1.04 + Math.sin(t * 0.45) * 0.1 + Math.sin(t * 1.1 + 1) * 0.035;
  const E = lerp(auto, lerp(1.26, 0.12, clamp((my / h - 0.14) / 0.72)), on);
  const at1 = smooth((LEVEL_1 + 0.07 - E) / 0.07);
  const closed = smooth((LEVEL_2 + 0.05 - E) / 0.05);

  // the deck
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.28);
  quad(ctx, 0, 1.3);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.ink3, 0.14);
  quad(ctx, 0, 1.62);
  ctx.stroke();

  // the block: margin in use
  for (let i = 0; i < 4; i++) {
    const xa = i === 0 || i === 3 ? -HX : HX;
    const za = i < 2 ? -HZ : HZ;
    const xb = i === 0 || i === 1 ? HX : -HX;
    const zb = i === 0 || i === 3 ? -HZ : HZ;
    ctx.beginPath();
    project(CAM, xa, 0, za, Q);
    ctx.moveTo(Q[0], Q[1]);
    project(CAM, xb, 0, zb, Q);
    ctx.lineTo(Q[0], Q[1]);
    project(CAM, xb, BLOCK, zb, Q);
    ctx.lineTo(Q[0], Q[1]);
    project(CAM, xa, BLOCK, za, Q);
    ctx.lineTo(Q[0], Q[1]);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.teal, 0.075);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.teal, 0.5);
    ctx.stroke();
  }
  quad(ctx, BLOCK);
  ctx.fillStyle = rgba(pal.teal, 0.12);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.teal, 0.85);
  ctx.stroke();

  // the two levels at which positions are closed
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1 + at1 * 0.5;
  ctx.strokeStyle = rgba(pal.gold, 0.5 + at1 * 0.5);
  quad(ctx, LEVEL_1, 1.1);
  ctx.stroke();
  ctx.lineWidth = 1 + closed * 0.5;
  ctx.strokeStyle = rgba(pal.gold, 0.4 + closed * 0.6);
  quad(ctx, LEVEL_2, 1.1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;

  // the open positions, standing between the block and the plane
  if (E > BLOCK) {
    ctx.strokeStyle = rgba(pal.ink2, 0.6);
    for (const [x, z] of POSTS) post(ctx, x, z, BLOCK, E);
  }

  // the plane: equity
  project(CAM, 0, E, 0, Q);
  glow(ctx, Q[0], Q[1], s * 1.25, pal.accent, 0.16);
  quad(ctx, E);
  ctx.fillStyle = rgba(pal.accent, 0.2);
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(pal.ink, 0.9);
  ctx.stroke();
  // the reading line that crosses it: the watching
  const rx = lerp(-HX, HX, fract(t * 0.11));
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink, 0.45);
  project(CAM, rx, E, -HZ, Q);
  const sx = Q[0];
  const sy = Q[1];
  project(CAM, rx, E, HZ, Q);
  line(ctx, sx, sy, Q[0], Q[1]);
  for (const [x, z] of POSTS) {
    project(CAM, x, E, z, Q);
    const near = clamp(1 - Math.abs(x - rx) / 0.3);
    if (closed > 0.5) {
      ctx.strokeStyle = rgba(pal.ink3, 0.8);
      ctx.beginPath();
      ctx.arc(Q[0], Q[1], 2.6, 0, Math.PI * 2);
      ctx.stroke();
    } else lamp(ctx, Q[0], Q[1], 2.2 + near * 0.8, pal.ink, 0.8 + near * 0.2);
  }

  // the rule at the near corner: from the plane down to the block
  const gx = HX + 0.2;
  if (E > BLOCK + 0.02) {
    ctx.strokeStyle = rgba(pal.gold, 0.95);
    ctx.lineWidth = 1.5;
    post(ctx, gx, -HZ, BLOCK, E);
    ctx.lineWidth = 1;
    for (const y of [BLOCK, E]) {
      project(CAM, gx - 0.08, y, -HZ, Q);
      const ax = Q[0];
      const ay = Q[1];
      project(CAM, gx + 0.08, y, -HZ, Q);
      line(ctx, ax, ay, Q[0], Q[1]);
    }
    project(CAM, gx, lerp(BLOCK, E, 0.5 + 0.5 * Math.sin(t * 0.9)), -HZ, Q);
    lamp(ctx, Q[0], Q[1], 1.8, pal.gold, 0.95);
  }

  // the two names the chapter uses
  if (w >= 300) {
    const lx = w * 0.79;
    ctx.strokeStyle = rgba(pal.ink3, 0.5);
    project(CAM, gx + 0.16, BLOCK * 0.5, -HZ, Q);
    const my0 = Q[1];
    line(ctx, Q[0] - 6, my0, lx - 6, my0);
    caps(f, "Margin", lx, my0 + 3.5, rgba(pal.teal, 0.95), "left");
    dot(ctx, lx - 6, my0, 1.5, rgba(pal.teal, 0.9));
    // the plane's name keeps clear of the block's when the plane is carried down into it
    project(CAM, gx + 0.16, E, -HZ, Q);
    const ey = Math.min(Q[1], my0 - 14);
    line(ctx, Q[0] + 4, Q[1], lx - 6, ey);
    caps(f, "Equity", lx, ey + 3.5, rgba(pal.ink, 0.92), "left");
  }

  closeStage(f);
};

export function Headroom({ ratio = 1.8 }: { ratio?: number }) {
  return <Figure draw={draw} ratio={ratio} />;
}
