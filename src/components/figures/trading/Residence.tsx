"use client";

import { Figure, rgba, TAU, type FigureDraw } from "../Figure";
import { hash, lamp } from "./kit";

/**
 * "Where GIO4X does not offer its services" (account types): the crown of a
 * globe, drawn as a bare graticule with no coastlines, turning slowly under a
 * fixed pin that stands for where a person is resident. Some cells of the
 * grid are shaded. While the pin stands on a clear cell its head is lit; when
 * a shaded cell passes beneath it the head becomes a barred ring.
 *
 * The cells are an arbitrary pattern, not a map: no real place is drawn.
 *
 * Pointer: the globe turns with the pointer, so a cell can be brought under
 * the pin by hand.
 */

const RAD = Math.PI / 180;
const TILT = 0.3;
const CT = Math.cos(TILT);
const ST = Math.sin(TILT);
/** the graticule: meridians every 15 degrees, parallels every 8 from 32 to 88 */
const D_LON = 15;
const D_LAT = 8;
const LAT_0 = 32;
const BANDS = 7;
const COLS = 360 / D_LON;
/** the band of latitude the pin stands in (its foot is at the middle of it) */
const PIN_BAND = 5;

const shaded = (i: number, j: number) => hash(i + 3, j * 7 + 1) < 0.24;

/** eased 0 to 1: how far the pin's head has become the barred ring */
const barred = new WeakMap<CanvasRenderingContext2D, { s: number }>();

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const R = w * 0.72;
  const cx = w / 2;
  const top = h * 0.27;
  const cy = top + R;
  const rot = (f.t * 0.11 + ((f.mx - w / 2) / w) * 1.5 * f.hover) / RAD;

  // a point of the globe on the canvas; returns false when it is on the far side
  let sx = 0;
  let sy = 0;
  const at = (lat: number, lon: number): boolean => {
    const cl = Math.cos(lat * RAD);
    const l = (lon - rot) * RAD;
    const x3 = cl * Math.sin(l);
    const y3 = Math.sin(lat * RAD);
    const z3 = cl * Math.cos(l);
    sx = cx + R * x3;
    sy = cy - R * (y3 * CT - z3 * ST);
    return y3 * ST + z3 * CT > 0;
  };
  /** the outline of one cell of the graticule, as a path */
  const cell = (i: number, j: number) => {
    const lat0 = LAT_0 + j * D_LAT;
    const lon0 = i * D_LON;
    for (let k = 0; k <= 3; k++) {
      at(lat0, lon0 + (k / 3) * D_LON);
      if (k) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
    }
    for (let k = 3; k >= 0; k--) {
      at(lat0 + D_LAT, lon0 + (k / 3) * D_LON);
      ctx.lineTo(sx, sy);
    }
    ctx.closePath();
  };

  // the shaded cells
  ctx.beginPath();
  for (let j = 0; j < BANDS; j++) {
    for (let i = 0; i < COLS; i++) {
      if (!shaded(i, j)) continue;
      if (!at(LAT_0 + (j + 0.5) * D_LAT, (i + 0.5) * D_LON)) continue;
      cell(i, j);
    }
  }
  ctx.fillStyle = rgba(pal.ink, 0.13);
  ctx.fill();

  // the graticule
  ctx.beginPath();
  for (let i = 0; i < COLS; i++) {
    let pen = false;
    for (let k = 0; k <= BANDS; k++) {
      const seen = at(LAT_0 + k * D_LAT, i * D_LON);
      if (seen && pen) ctx.lineTo(sx, sy);
      else if (seen) ctx.moveTo(sx, sy);
      pen = seen;
    }
  }
  for (let j = 0; j <= BANDS; j++) {
    let pen = false;
    for (let k = 0; k <= 60; k++) {
      const seen = at(LAT_0 + j * D_LAT, rot - 180 + k * 6);
      if (seen && pen) ctx.lineTo(sx, sy);
      else if (seen) ctx.moveTo(sx, sy);
      pen = seen;
    }
  }
  ctx.strokeStyle = rgba(pal.ink, 0.2);
  ctx.lineWidth = 1;
  ctx.stroke();

  // the limb
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI * 1.2, Math.PI * 1.8);
  ctx.strokeStyle = rgba(pal.ink, 0.5);
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // the pin's foot, and the cell it stands on
  const j = PIN_BAND;
  const i = Math.floor((((rot % 360) + 360) % 360) / D_LON);
  at(LAT_0 + (j + 0.5) * D_LAT, rot);
  const footY = sy;
  const on = shaded(i, j) ? 1 : 0;
  let st = barred.get(ctx);
  if (!st) {
    st = { s: on };
    barred.set(ctx, st);
  }
  st.s = f.still ? on : st.s + (on - st.s) * (1 - Math.exp(-f.dt * 9));
  const s = st.s;

  ctx.beginPath();
  cell(i, j);
  ctx.strokeStyle = rgba(pal.accent, 0.85);
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // the globe has no edge: it fades out at the sides and the foot of the canvas
  ctx.globalCompositeOperation = "destination-out";
  let g = ctx.createLinearGradient(0, h * 0.72, 0, h - 3);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.72, w, h);
  g = ctx.createLinearGradient(0, 0, w * 0.16, 0);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w * 0.16, h);
  g = ctx.createLinearGradient(w, 0, w * 0.84, 0);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(w * 0.84, 0, w * 0.16, h);
  ctx.globalCompositeOperation = "source-over";

  // the pin: a foot ring on the surface, a stem, and the head
  const headY = h * 0.2;
  ctx.beginPath();
  ctx.ellipse(cx, footY, 7, 2.6, 0, 0, TAU);
  ctx.strokeStyle = rgba(pal.accent, 0.9);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, footY);
  ctx.lineTo(cx, headY + 8);
  ctx.strokeStyle = rgba(pal.ink, 0.7);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, headY, 8, 0, TAU);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.gold, 1 - s);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  lamp(ctx, cx, headY, 3, pal.gold, 1 - s);
  if (s > 0.004) {
    ctx.beginPath();
    ctx.arc(cx, headY, 8, 0, TAU);
    ctx.moveTo(cx - 4.5, headY);
    ctx.lineTo(cx + 4.5, headY);
    ctx.strokeStyle = rgba(pal.ink, 0.85 * s);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
};

export function Residence({ ratio = 2.8, className }: { ratio?: number; className?: string }) {
  return <Figure draw={draw} ratio={ratio} className={className} />;
}
