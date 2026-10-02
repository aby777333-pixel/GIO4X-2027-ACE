"use client";

import { Figure, clamp, rgba, smooth, type Colour, type FigureDraw } from "../Figure";
import { closeStage, dot, fract, glow, hash, lamp, line, openStage } from "./kit";

/**
 * Sign in, beside the three portals: the gateway as three doors in one wall,
 * one for each destination the pane lists, standing closed on a floor that
 * mirrors them. A hairline of light shows down each door's seam and spills a
 * little way across the floor. A mark of light goes slowly round one door
 * frame after another: the check a destination passes before it is shown as
 * a link. No door opens in this picture, and nothing in it says that one is
 * connected.
 *
 * Pointer: the door under it is the one being checked: the mark runs round
 * its frame, the frame turns to champagne and its light on the floor reaches
 * further towards you.
 */

const DOORS = 3;
const DOOR_X = [0.2, 0.5, 0.8];

/** a point on a door's frame, by distance along it: up the left side, over the arch, down the right */
function onFrame(x: number, base: number, dw: number, side: number, u: number, out: number[]) {
  const r = dw / 2;
  const total = side * 2 + Math.PI * r;
  const d = fract(u) * total;
  if (d < side) {
    out[0] = x - r;
    out[1] = base - d;
  } else if (d < side + Math.PI * r) {
    const a = Math.PI - (d - side) / r;
    out[0] = x + Math.cos(a) * r;
    out[1] = base - side - Math.sin(a) * r;
  } else {
    out[0] = x + r;
    out[1] = base - side + (d - side - Math.PI * r);
  }
}
const Q = [0, 0];

function doorPath(ctx: CanvasRenderingContext2D, x: number, base: number, dw: number, side: number, flip: number) {
  // flip = 1 for the door, -1 for its reflection in the floor
  const r = dw / 2;
  ctx.beginPath();
  ctx.moveTo(x - r, base);
  ctx.lineTo(x - r, base - side * flip);
  if (flip > 0) ctx.arc(x, base - side, r, Math.PI, 0);
  else ctx.arc(x, base + side, r, Math.PI, 0, true);
  ctx.lineTo(x + r, base);
}

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, my, pal } = f;
  if (w < 150 || h < 110) return;
  openStage(f, 0.5, 0.36);
  const hv = smooth(hover);

  const base = h * 0.64;
  const dw = w * 0.17;
  const side = h * 0.3;
  const par = (mx / w - 0.5) * w * 0.02 * hv;

  // which door is being checked
  let near = 0;
  for (let i = 1; i < DOORS; i++) if (Math.abs(DOOR_X[i] * w - mx) < Math.abs(DOOR_X[near] * w - mx)) near = i;
  const turn = t * 0.16;
  const auto = Math.floor(turn) % DOORS;
  const checking = hv > 0.5 ? near : auto;

  for (let i = 0; i < 26; i++) dot(ctx, w * hash(i, 101), base * 0.5 * hash(i, 102), 0.6, rgba(pal.ink, 0.1 + 0.16 * hash(i, 103)));

  // the wall: a cornice above, the floor line below
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.55);
  line(ctx, 0, Math.round(base) + 0.5, w, Math.round(base) + 0.5);
  ctx.strokeStyle = rgba(pal.gold, 0.4);
  line(ctx, w * 0.06, Math.round(h * 0.13) + 0.5, w * 0.94, Math.round(h * 0.13) + 0.5);
  ctx.strokeStyle = rgba(pal.ink3, 0.4);
  line(ctx, w * 0.06, Math.round(h * 0.13) + 4.5, w * 0.94, Math.round(h * 0.13) + 4.5);

  // the floor: lines running to a point behind the middle door
  const vx = w * 0.5 + par * 3;
  for (let i = -6; i <= 6; i++) {
    ctx.strokeStyle = rgba(pal.ink3, 0.16);
    line(ctx, vx + i * w * 0.07, base, vx + i * w * 0.3, h);
  }
  for (let k = 1; k <= 3; k++) {
    const y = Math.round(base + (h - base) * (k / 3.5) ** 1.6) + 0.5;
    ctx.strokeStyle = rgba(pal.ink3, 0.1 + 0.03 * k);
    line(ctx, 0, y, w, y);
  }

  for (let i = 0; i < DOORS; i++) {
    const col: Colour = i === 0 ? pal.accent : i === 1 ? pal.teal : pal.gold;
    const x = DOOR_X[i] * w - par * (i - 1);
    const on = i === checking ? 1 : 0;
    const picked = i === near ? hv : 0;
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.7 + i * 2.1);

    // its light on the floor, reaching towards the viewer
    const reach = (h - base) * (0.5 + 0.2 * breathe + 0.3 * picked);
    const g = ctx.createLinearGradient(0, base, 0, base + reach);
    g.addColorStop(0, rgba(col, 0.3 + 0.25 * picked));
    g.addColorStop(1, rgba(col, 0));
    ctx.beginPath();
    ctx.moveTo(x - dw * 0.06, base);
    ctx.lineTo(x + dw * 0.06, base);
    ctx.lineTo(x + dw * 0.06 + (x - vx) * 0.5 + dw * 0.5, base + reach);
    ctx.lineTo(x - dw * 0.06 + (x - vx) * 0.5 - dw * 0.5, base + reach);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();

    // its reflection
    doorPath(ctx, x, base, dw, side * 0.62, -1);
    ctx.strokeStyle = rgba(pal.ink2, 0.16 + 0.1 * picked);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = rgba(col, 0.22);
    line(ctx, x, base + 2, x, base + side * 0.6);

    // the door
    glow(ctx, x, base - side * 0.6, side * 1.1, col, 0.1 + 0.16 * picked + 0.06 * on);
    doorPath(ctx, x, base, dw, side, 1);
    ctx.fillStyle = rgba(pal.surface, 0.96);
    ctx.fill();
    ctx.strokeStyle = rgba(picked > 0.5 ? pal.gold : pal.ink2, 0.75 + 0.25 * picked);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // an inner moulding
    doorPath(ctx, x, base, dw * 0.8, side * 0.98, 1);
    ctx.strokeStyle = rgba(pal.ink3, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    // the seam: the light behind it
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba(col, 0.2 + 0.1 * breathe);
    ctx.lineWidth = 5;
    line(ctx, x, base - 1, x, base - side - dw * 0.38);
    ctx.strokeStyle = rgba(col, 0.75 + 0.25 * Math.max(breathe * 0.6, picked));
    ctx.lineWidth = 1.2;
    line(ctx, x, base - 1, x, base - side - dw * 0.38);
    ctx.globalCompositeOperation = "source-over";
    // two handles
    dot(ctx, x - dw * 0.07, base - side * 0.5, 1.4, rgba(pal.ink, 0.8));
    dot(ctx, x + dw * 0.07, base - side * 0.5, 1.4, rgba(pal.ink, 0.8));
    // the lamp over it: a ring, not yet lit
    ctx.beginPath();
    ctx.arc(x, base - side - dw / 2 - h * 0.05, 3, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(pal.ink2, 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();

    // the check, going round the frame
    if (on) {
      const u = hv > 0.5 ? t * 0.42 : fract(turn);
      const fade = hv > 0.5 ? 1 : Math.sin(fract(turn) * Math.PI) ** 0.5;
      for (let k = 0; k < 9; k++) {
        onFrame(x, base, dw * 1.12, side, u - k * 0.012, Q);
        dot(ctx, Q[0], Q[1], 1.4 * (1 - k / 10), rgba(pal.gold, 0.8 * fade * (1 - k / 9)));
      }
      onFrame(x, base, dw * 1.12, side, u, Q);
      lamp(ctx, Q[0], Q[1], 2.2, pal.gold, clamp(fade));
    }
  }

  // where the floor meets the wall, light gathers
  glow(ctx, w * 0.5, base, w * 0.5, pal.accent, 0.06 + 0.04 * (1 - clamp(Math.abs(my - base) / h)) * hv);

  closeStage(f);
};

export function ThreeDoors() {
  return <Figure draw={draw} ratio={1.15} />;
}
