"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { STILL_T, TAU, clamp, lerp, rgba, smooth, type Colour, type Palette } from "./Figure";

/**
 * A backdrop for a band that has empty space beside its text: a slow, faint
 * Canvas 2D drawing about markets and brokerage, set behind the band.
 *
 * `<Backdrop variant="orbits" />` goes FIRST inside an element that is
 * `position: relative`. The canvas fills that element, ignores the pointer and
 * is hidden from assistive technology and from print. It needs no clipping on
 * the parent (a canvas cannot paint outside itself) and no stacking order:
 *
 *   - It measures where the band's text is and draws only in the free field
 *     beside it. Under the text the canvas is fully transparent, and it fades
 *     in over the first part of the field, so nothing runs behind a paragraph.
 *     Buttons standing in the field, and anything marked `data-backdrop-hole`
 *     (a section's action link, say), are cleared with a soft edge.
 *   - Where the free field is narrower than 300px it draws nothing, and below
 *     1080px (where bands stack and have no empty side) it is not displayed.
 *
 * The same rules as the page figures: colours only from the design tokens (so
 * themes, night bands and accents follow), paused off-screen and in hidden
 * tabs, one composed still frame under reduced motion or "low visual effects",
 * a seeded layout, and nothing that could be read as data: no numbers, no
 * labels, no text at all.
 *
 * The pointer is read on the parent. Each variant leans, gathers or brightens
 * a little near it.
 *
 * Variants
 *   candles   a drifting ribbon of candle forms; they stand taller near the pointer
 *   depth     two facing stepped depth curves, breathing; the gap leans to the pointer
 *   routes    a turning wire globe with arcs travelling between nodes; it turns to the pointer
 *   ledger    ruled lines being written and ticked; the row under the pointer is underlined
 *   orbits    a golden spiral on Fibonacci circles with bodies moving along it; it turns to the pointer
 *   curve     a yield-curve-like line flexing over a grid; it lifts under the pointer
 *   tape      rows of dashes sliding at different speeds; the row under the pointer runs faster
 *   lattice   a perspective floor with pulses running toward the viewer; the vanishing point leans
 *   sessions  four overlapping session bars with a band of daylight sweeping; the band follows the pointer
 *   sizing    a rectangle divided again and again at the golden section; the cell under the pointer fills
 */

export type BackdropVariant = "candles" | "depth" | "routes" | "ledger" | "orbits" | "curve" | "tape" | "lattice" | "sessions" | "sizing";

type Side = "right" | "left" | "both";

type Frame = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** seconds; frozen at STILL_T in a still frame */
  t: number;
  dt: number;
  still: boolean;
  pal: Palette;
  /** the free field: its left edge and width */
  x: number;
  fw: number;
  /** where the weight of the drawing sits: the golden section of the field */
  fx: number;
  fy: number;
  /** 1 when the field lies to the right of the text, -1 to the left */
  dir: 1 | -1;
  /** 0 to 1, eased: the pointer is over the band */
  hover: number;
  mx: number;
  my: number;
};

const PHI = 1.618033988749895;
/** the narrowest free field worth drawing in, in CSS pixels */
const MIN_FIELD = 300;

/* ---- seeded numbers: the layout is the same on every visit ------------------ */

const SEED = (() => {
  const out = new Float32Array(512);
  let a = 0x9e3779b9;
  for (let i = 0; i < out.length; i++) {
    a = (a + 0x6d2b79f5) | 0;
    let v = Math.imul(a ^ (a >>> 15), 1 | a);
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
    out[i] = ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  }
  return out;
})();
const rnd = (i: number) => SEED[((Math.floor(i) % 512) + 512) % 512] ?? 0.5;
const frac = (v: number) => v - Math.floor(v);
const bell = (d: number, s: number) => Math.exp(-(d * d) / (2 * s * s));

/* ---- the variants ----------------------------------------------------------- */

/** A ribbon of candle forms drifting along a slow wave. No axis, no scale. */
function candles(f: Frame) {
  const { ctx, pal } = f;
  const gap = 21;
  const amp = Math.min(f.h * 0.2, 55);
  const scroll = f.t * 4;
  const base = Math.floor(scroll / gap);
  const off = scroll - base * gap;
  const n = Math.ceil(f.fw / gap) + 2;
  const bw = 8;
  const yAt = (i: number) => f.fy + amp * (0.62 * Math.sin(i * 0.19) + 0.38 * Math.sin(i * 0.071 + 1.7));

  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const x = f.x + k * gap - off;
    const y = yAt(base + k);
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.strokeStyle = rgba(pal.ink, 0.09);
  ctx.stroke();

  for (let k = 0; k < n; k++) {
    const i = base + k;
    const x = Math.round(f.x + k * gap - off) + 0.5;
    const y = yAt(i);
    const near = f.hover * bell(x - f.mx, 89);
    const s = 1 + near * 0.7;
    const body = (4 + rnd(i) * amp * 0.6) * s;
    const wick = body / 2 + (3 + rnd(i + 131) * amp * 0.42) * s;
    const a = 0.16 + near * 0.16;
    ctx.strokeStyle = rgba(pal.ink, a);
    ctx.beginPath();
    ctx.moveTo(x, y - wick);
    ctx.lineTo(x, y + wick);
    ctx.stroke();
    if (rnd(i + 257) > 0.46) {
      ctx.fillStyle = rgba(pal.accent, a * 1.5);
      ctx.fillRect(x - bw / 2, y - body / 2, bw, body);
    } else {
      ctx.strokeRect(x - bw / 2 + 0.5, y - body / 2, bw - 1, body);
    }
  }
}

/** Two stepped curves facing each other across a gap, as an order book is drawn. */
function depth(f: Frame) {
  const { ctx, pal } = f;
  const step = 34;
  const baseY = f.h * (f.h > 240 ? 0.74 : 0.86);
  const span = baseY - f.h * 0.12;
  const mid = f.fx + f.hover * clamp((f.mx - f.fx) / 233, -1, 1) * 34;
  const half = 13 + 5 * Math.sin(f.t * 0.45);
  const lift = 1 + f.hover * 0.5;
  ctx.lineWidth = 1;

  for (const sign of [-1, 1] as const) {
    let x = mid + sign * half;
    let cum = 0;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    for (let i = 0; i < 44; i++) {
      const breath = 0.5 + 0.5 * Math.sin(f.t * 0.5 + i * 0.9 + (sign > 0 ? 1.3 : 0));
      cum += (0.3 + rnd(i * 2 + (sign > 0 ? 1 : 0)) * 0.7 + breath * 0.3) / 11;
      const y = baseY - span * Math.min(1, cum);
      ctx.lineTo(x, y);
      x += sign * step;
      ctx.lineTo(x, y);
      if (x < f.x - step || x > f.x + f.fw + step) break;
    }
    ctx.lineTo(x, baseY);
    ctx.closePath();
    const c = sign < 0 ? pal.teal : pal.gold;
    ctx.fillStyle = rgba(c, 0.05 * lift);
    ctx.fill();
    ctx.strokeStyle = rgba(c, 0.26 * lift);
    ctx.stroke();
  }
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = rgba(pal.ink, 0.14);
  ctx.beginPath();
  ctx.moveTo(Math.round(mid) + 0.5, f.h * 0.1);
  ctx.lineTo(Math.round(mid) + 0.5, baseY);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** A wire globe, turning, with arcs travelling between a few nodes. No coastlines: it is no particular place. */
function routes(f: Frame) {
  const { ctx, pal } = f;
  const tall = f.h > 240;
  const r = Math.max(Math.min(f.fw * 0.4, f.h * (tall ? 0.72 : 1.5)), 144);
  const cx = f.fx;
  const cy = tall ? f.fy + r * 0.2 : f.fy + r * 0.62;
  const rot = f.t * 0.045 + f.hover * ((f.mx - cx) / Math.max(f.fw, 1)) * 0.9;
  const ct = Math.cos(0.4);
  const st = Math.sin(0.4);
  // a point on the unit sphere, turned and tipped toward the viewer
  const P = (lat: number, lon: number): [number, number, number] => {
    const cl = Math.cos(lat);
    const X = cl * Math.sin(lon + rot);
    const Y = Math.sin(lat);
    const Z = cl * Math.cos(lon + rot);
    return [cx + r * X, cy - r * (Y * ct - Z * st), Y * st + Z * ct];
  };

  const front = new Path2D();
  const back = new Path2D();
  const SEG = 24;
  const ring = (at: (a: number) => [number, number, number]) => {
    let p = at(0);
    for (let s = 1; s <= SEG; s++) {
      const q = at((s / SEG) * TAU);
      const path = p[2] + q[2] >= 0 ? front : back;
      path.moveTo(p[0], p[1]);
      path.lineTo(q[0], q[1]);
      p = q;
    }
  };
  for (let m = 0; m < 5; m++) {
    const lon = (m / 5) * Math.PI;
    // a great circle through the poles
    ring((a) => {
      const X = Math.cos(a) * Math.sin(lon + rot);
      const Y = Math.sin(a);
      const Z = Math.cos(a) * Math.cos(lon + rot);
      return [cx + r * X, cy - r * (Y * ct - Z * st), Y * st + Z * ct];
    });
  }
  for (const lat of [-0.7, 0, 0.7]) ring((a) => P(lat, a - rot));
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink, 0.06);
  ctx.stroke(back);
  ctx.strokeStyle = rgba(pal.ink, 0.15);
  ctx.stroke(front);

  const N = 7;
  const node = (i: number) => [(rnd(i * 3 + 40) - 0.5) * 1.7, (i / N) * TAU + rnd(i * 3 + 41) * 0.6] as const;
  // arcs: the short way round the sphere between two nodes, lifted off the surface
  for (let i = 0; i < N; i++) {
    const [la, lo] = node(i);
    const [lb, lob] = node((i + 2) % N);
    const a3 = [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)] as const;
    const b3 = [Math.cos(lb) * Math.sin(lob), Math.sin(lb), Math.cos(lb) * Math.cos(lob)] as const;
    const om = Math.acos(clamp(a3[0] * b3[0] + a3[1] * b3[1] + a3[2] * b3[2], -1, 1));
    const so = Math.sin(om) || 1;
    const at = (s: number): [number, number, number] => {
      const ka = Math.sin((1 - s) * om) / so;
      const kb = Math.sin(s * om) / so;
      const up = 1 + 0.16 * Math.sin(Math.PI * s);
      const x = (a3[0] * ka + b3[0] * kb) * up;
      const y = (a3[1] * ka + b3[1] * kb) * up;
      const z = (a3[2] * ka + b3[2] * kb) * up;
      // turn about the vertical axis, then tip
      const X = x * Math.cos(rot) + z * Math.sin(rot);
      const Z = -x * Math.sin(rot) + z * Math.cos(rot);
      return [cx + r * X, cy - r * (y * ct - Z * st), y * st + Z * ct];
    };
    const midZ = at(0.5)[2];
    if (midZ < -0.15) continue;
    const vis = clamp(midZ + 0.35);
    ctx.beginPath();
    for (let s = 0; s <= 12; s++) {
      const p = at(s / 12);
      if (s) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    }
    const c = i % 2 ? pal.gold : pal.accent;
    ctx.strokeStyle = rgba(c, 0.3 * vis);
    ctx.stroke();
    const u = frac(f.t * 0.085 + rnd(i + 70));
    const pulse = at(u);
    ctx.fillStyle = rgba(c, 0.75 * vis * Math.sin(Math.PI * u));
    ctx.beginPath();
    ctx.arc(pulse[0], pulse[1], 2.2, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < N; i++) {
    const [la, lo] = node(i);
    const p = P(la, lo);
    if (p[2] < 0) continue;
    const near = f.hover * bell(Math.hypot(p[0] - f.mx, p[1] - f.my), 89);
    ctx.fillStyle = rgba(pal.ink, (0.3 + near * 0.4) * clamp(p[2] * 2));
    ctx.beginPath();
    ctx.arc(p[0], p[1], 2 + near * 1.5, 0, TAU);
    ctx.fill();
    if (near > 0.05) {
      ctx.strokeStyle = rgba(pal.accent, 0.5 * near);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 8, 0, TAU);
      ctx.stroke();
    }
  }
}

/** A ruled page: entries are written row by row as plain strokes, and each finished row is ticked. */
function ledger(f: Frame) {
  const { ctx, pal } = f;
  const gap = f.h > 240 ? 34 : 21;
  const pad = Math.max(13, f.h * 0.12);
  const rows = Math.max(2, Math.min(13, Math.floor((f.h - pad * 2) / gap)));
  const y0 = (f.h - (rows - 1) * gap) / 2;
  const x1 = f.x + f.fw;
  const c1 = Math.round(f.x + f.fw * 0.618) + 0.5;
  const c2 = Math.round(f.x + f.fw * 0.854) + 0.5;
  const xa = f.x + f.fw * 0.236;
  const cycle = rows + 4;
  const u = f.still ? rows + 0.5 : (f.t * 0.5) % cycle;
  const fade = 1 - smooth((u - rows - 2) / 1.5);
  const under = gap * 0.36;

  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink, 0.1);
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    const y = Math.round(y0 + r * gap + under) + 0.5;
    ctx.moveTo(f.x, y);
    ctx.lineTo(x1, y);
  }
  // the total line under the last row
  const yt = Math.round(y0 + (rows - 1) * gap + under) + 3.5;
  ctx.moveTo(c1, yt);
  ctx.lineTo(x1, yt);
  ctx.moveTo(c1, y0 - gap * 0.6);
  ctx.lineTo(c1, yt);
  ctx.moveTo(c2, y0 - gap * 0.6);
  ctx.lineTo(c2, yt);
  ctx.stroke();

  ctx.lineCap = "round";
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * gap;
    const p = clamp(u - r);
    const near = f.hover * bell(y - f.my, gap * 0.7);
    if (near > 0.02) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(pal.accent, 0.45 * near);
      ctx.beginPath();
      ctx.moveTo(f.x, Math.round(y + under) + 0.5);
      ctx.lineTo(x1, Math.round(y + under) + 0.5);
      ctx.stroke();
    }
    if (p <= 0) continue;
    const a = (0.2 + near * 0.16) * fade;
    // the description, then the amount, set right against its column
    const d = (0.14 + rnd(r * 5 + 11) * 0.2) * f.fw;
    const amt = 21 + rnd(r * 5 + 12) * 47;
    const p1 = clamp(p / 0.6);
    const p2 = clamp((p - 0.6) / 0.3);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(pal.ink, a);
    ctx.beginPath();
    ctx.moveTo(xa, y);
    ctx.lineTo(xa + d * p1, y);
    if (p2 > 0) {
      ctx.moveTo(c2 - 13 - amt, y);
      ctx.lineTo(c2 - 13 - amt * (1 - p2), y);
    }
    ctx.stroke();
    if (p < 1 && fade > 0.99) {
      const px = p2 > 0 ? c2 - 13 - amt * (1 - p2) : xa + d * p1;
      ctx.fillStyle = rgba(pal.accent, 0.7);
      ctx.beginPath();
      ctx.arc(px, y, 2, 0, TAU);
      ctx.fill();
    }
    const p3 = clamp((p - 0.9) / 0.1);
    if (p3 > 0) {
      const tx = c2 + 16;
      ctx.strokeStyle = rgba(r % 3 === 2 ? pal.gold : pal.accent, (0.5 + near * 0.3) * fade * p3);
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.lineTo(tx + 4, y + 4);
      ctx.lineTo(tx + 11, y - 5);
      ctx.stroke();
    }
  }
  ctx.lineCap = "butt";
}

/** The golden spiral over circles whose radii are Fibonacci numbers, with a few bodies moving along it. */
function orbits(f: Frame) {
  const { ctx, pal } = f;
  const b = Math.log(PHI) / (Math.PI / 2);
  const rmin = 3;
  const rmax = Math.hypot(Math.max(f.fx - f.x, f.x + f.fw - f.fx), Math.max(f.fy, f.h - f.fy)) * 1.05;
  const tmax = Math.log(rmax / rmin) / b;
  const rot = f.t * 0.03 * f.dir + f.hover * ((f.mx - f.fx) / Math.max(f.fw, 1)) * 0.7;
  const glow = 1 + f.hover * 0.5;
  ctx.lineWidth = 1;

  ctx.strokeStyle = rgba(pal.ink, 0.075);
  ctx.beginPath();
  for (const rad of [21, 34, 55, 89, 144, 233, 377, 610]) {
    if (rad > rmax) break;
    ctx.moveTo(f.fx + rad, f.fy);
    ctx.arc(f.fx, f.fy, rad, 0, TAU);
  }
  ctx.stroke();

  for (let arm = 0; arm < 2; arm++) {
    const ph = rot + arm * Math.PI;
    ctx.beginPath();
    for (let th = 0; th <= tmax; th += 0.15) {
      const rad = rmin * Math.exp(b * th);
      const x = f.fx + rad * Math.cos(th + ph);
      const y = f.fy + rad * Math.sin(th + ph);
      if (th) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = arm ? rgba(pal.gold, 0.16 * glow) : rgba(pal.accent, 0.26 * glow);
    ctx.stroke();
  }
  // a mark at every quarter turn, where the radius has grown by the golden ratio
  ctx.strokeStyle = rgba(pal.ink, 0.22);
  ctx.beginPath();
  for (let q = 4; q * (Math.PI / 2) <= tmax; q++) {
    const th = q * (Math.PI / 2);
    const rad = rmin * Math.exp(b * th);
    const c = Math.cos(th + rot);
    const s = Math.sin(th + rot);
    ctx.moveTo(f.fx + (rad - 4) * c, f.fy + (rad - 4) * s);
    ctx.lineTo(f.fx + (rad + 4) * c, f.fy + (rad + 4) * s);
  }
  ctx.stroke();

  for (let i = 0; i < 6; i++) {
    // the same distance along the curve each second, wherever the body is
    const u = frac(f.t * 0.012 + i / 6 + rnd(i + 90) * 0.1);
    const rad = 13 + u * (rmax - 13);
    const th = Math.log(rad / rmin) / b + rot + (i % 2) * Math.PI;
    const x = f.fx + rad * Math.cos(th);
    const y = f.fy + rad * Math.sin(th);
    const a = Math.sin(Math.PI * u) * glow;
    const c = i % 2 ? pal.gold : pal.accent;
    ctx.fillStyle = rgba(c, 0.7 * a);
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(c, 0.22 * a);
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, TAU);
    ctx.stroke();
  }
}

/** A term-structure line flexing over a grid whose columns step by the golden ratio. The dashed line is where it was. */
function curve(f: Frame) {
  const { ctx, pal } = f;
  const x0 = f.x + f.fw * 0.1;
  const x1 = f.x + f.fw * 0.97;
  const top = f.h * 0.18;
  const bot = f.h * 0.82;
  const span = bot - top;
  const tenors = [0, 0.034, 0.056, 0.09, 0.146, 0.236, 0.382, 0.618, 1];
  const K = 1 - Math.exp(-4);
  const shape = (u: number, time: number) => {
    const level = 0.5 + 0.12 * Math.sin(time * 0.21);
    const steep = 0.34 + 0.2 * Math.sin(time * 0.13 + 1);
    const hump = 0.12 * Math.sin(time * 0.17 + 2.2);
    return clamp(level - steep * 0.5 + (steep * (1 - Math.exp(-4 * u))) / K + hump * bell(u - 0.2, 0.1), 0.03, 0.97);
  };
  const yAt = (u: number, time: number, bump: boolean) => {
    const x = lerp(x0, x1, u);
    return bot - span * shape(u, time) - (bump ? f.hover * 13 * bell(x - f.mx, 89) : 0);
  };

  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink, 0.09);
  ctx.beginPath();
  for (const u of tenors) {
    const x = Math.round(lerp(x0, x1, u)) + 0.5;
    ctx.moveTo(x, top - 8);
    ctx.lineTo(x, bot + 8);
  }
  for (const v of [0, 0.382, 0.618, 1]) {
    const y = Math.round(bot - span * v) + 0.5;
    ctx.moveTo(f.x, y);
    ctx.lineTo(f.x + f.fw, y);
  }
  ctx.stroke();

  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = rgba(pal.ink, 0.2);
  ctx.beginPath();
  for (let s = 0; s <= 40; s++) {
    const u = s / 40;
    const y = yAt(u, f.t - 9, false);
    if (s) ctx.lineTo(lerp(x0, x1, u), y);
    else ctx.moveTo(x0, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(pal.accent, 0.4 + f.hover * 0.2);
  ctx.beginPath();
  for (let s = 0; s <= 48; s++) {
    const u = s / 48;
    const y = yAt(u, f.t, true);
    if (s) ctx.lineTo(lerp(x0, x1, u), y);
    else ctx.moveTo(x0, y);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  for (const u of tenors) {
    const x = lerp(x0, x1, u);
    const y = yAt(u, f.t, true);
    const near = f.hover * bell(x - f.mx, 55);
    ctx.fillStyle = rgba(pal.gold, 0.6 + near * 0.3);
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, TAU);
    ctx.fill();
    if (near > 0.05) {
      ctx.strokeStyle = rgba(pal.gold, 0.5 * near);
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, TAU);
      ctx.stroke();
    }
  }
}

const tapePhase = new WeakMap<CanvasRenderingContext2D, Float32Array>();

/** Rows of dashes sliding past at their own speeds, as a paper tape would. The dashes spell nothing. */
function tape(f: Frame) {
  const { ctx, pal } = f;
  const gap = f.h > 240 ? 34 : 21;
  const pad = Math.max(13, f.h * 0.14);
  const rows = Math.max(2, Math.min(12, Math.floor((f.h - pad * 2) / gap) + 1));
  const y0 = (f.h - (rows - 1) * gap) / 2;
  const P = 377;
  const reps = Math.ceil(f.fw / P) + 1;
  let phase = tapePhase.get(ctx);
  if (!phase) {
    phase = new Float32Array(12);
    tapePhase.set(ctx, phase);
  }
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let r = 0; r < rows; r++) {
    const y = Math.round(y0 + r * gap) + 0.5;
    const near = f.hover * bell(y - f.my, gap * 0.8);
    const v = 4 + rnd(r * 7 + 3) * 14;
    if (!f.still) phase[r] = (phase[r] ?? 0) + f.dt * v * (1 + near * 4);
    const ph = f.still ? v * f.t : (phase[r] ?? 0);
    const a = 0.16 + near * 0.2;
    for (let kind = 0; kind < 3; kind++) {
      ctx.beginPath();
      let any = false;
      for (let j = 0; j < 6; j++) {
        const k = rnd(r * 31 + j * 5);
        const mine = k > 0.84 ? 1 : k > 0.72 ? 2 : 0;
        if (mine !== kind) continue;
        const len = 8 + rnd(r * 29 + j * 3) * 47;
        const o = (((j * P) / 6 + rnd(r * 13 + j) * 34 - ph) % P + P) % P;
        for (let m = -1; m < reps; m++) {
          const x = f.x + o + m * P;
          if (x + len < f.x || x > f.x + f.fw) continue;
          ctx.moveTo(x, y);
          ctx.lineTo(x + len, y);
          any = true;
        }
      }
      if (!any) continue;
      ctx.strokeStyle = kind === 1 ? rgba(pal.accent, a * 2) : kind === 2 ? rgba(pal.gold, a * 1.8) : rgba(pal.ink, a);
      ctx.stroke();
    }
  }
  ctx.lineCap = "butt";
}

/** A floor seen in perspective: the cross lines step toward the viewer by the golden ratio, and pulses run along it. */
function lattice(f: Frame) {
  const { ctx, pal } = f;
  const hy = Math.round(f.h * 0.382) + 0.5;
  const floor = f.h - hy;
  const vx = f.fx + f.hover * (f.mx - f.fx) * 0.25;
  const sp = Math.max(89, floor * 0.9);
  const zFar = Math.pow(PHI, 7);
  const N = Math.ceil(f.fw / sp) + 4;
  ctx.lineWidth = 1;

  ctx.strokeStyle = rgba(pal.ink, 0.09);
  ctx.beginPath();
  for (let k = -N; k <= N; k++) {
    ctx.moveTo(vx + (k * sp) / zFar, hy + floor / zFar);
    ctx.lineTo(vx + k * sp, f.h);
  }
  ctx.stroke();

  const slide = frac(f.t * 0.11);
  for (let j = 0; j <= 7; j++) {
    const lz = j - slide;
    const z = Math.pow(PHI, lz);
    const y = Math.round(hy + floor / z) + 0.5;
    if (y > f.h) continue;
    ctx.strokeStyle = rgba(pal.ink, 0.15 * clamp(1 - lz / 7.2));
    ctx.beginPath();
    ctx.moveTo(f.x, y);
    ctx.lineTo(f.x + f.fw, y);
    ctx.stroke();
  }

  // the horizon, and a low sun on it drawn as Fibonacci arcs
  ctx.strokeStyle = rgba(pal.ink, 0.2);
  ctx.beginPath();
  ctx.moveTo(f.x, hy);
  ctx.lineTo(f.x + f.fw, hy);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.gold, 0.2 + f.hover * 0.14);
  ctx.beginPath();
  for (const rad of [13, 21, 34, 55]) {
    if (rad > hy - 3) break;
    ctx.moveTo(vx + rad, hy);
    ctx.arc(vx, hy, rad, 0, Math.PI, true);
  }
  ctx.stroke();

  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const k = Math.round((rnd(i + 200) - 0.5) * 2 * Math.min(N - 2, 5));
    const u = frac(f.t * 0.06 + rnd(i + 210));
    const za = Math.pow(PHI, 7 * (1 - u));
    const zb = za * 1.22;
    ctx.strokeStyle = rgba(i % 2 ? pal.gold : pal.accent, 0.6 * Math.sin(Math.PI * u));
    ctx.beginPath();
    ctx.moveTo(vx + (k * sp) / zb, hy + floor / zb);
    ctx.lineTo(vx + (k * sp) / za, hy + floor / za);
    ctx.stroke();
  }
}

/** Four trading sessions as overlapping bars on a day's rule, and a band of daylight crossing them. */
function sessions(f: Frame) {
  const { ctx, pal } = f;
  const gap = clamp(f.h * 0.13, 16, 47);
  const y0 = f.fy - gap * 1.2;
  const x0 = f.x + f.fw * 0.1;
  const x1 = f.x + f.fw * 0.96;
  const W = x1 - x0;
  const band = W * 0.236;
  const auto = f.still ? 0.618 : frac(f.t * 0.02);
  const nowX = lerp(x0 + auto * W, clamp(f.mx, x0, x1), f.hover);
  const top = y0 - gap * 1.1;
  const bot = y0 + gap * 3.6;

  const g = ctx.createLinearGradient(nowX - band, 0, nowX, 0);
  g.addColorStop(0, rgba(pal.gold, 0));
  g.addColorStop(1, rgba(pal.gold, 0.11));
  ctx.fillStyle = g;
  ctx.fillRect(nowX - band, top, band, bot - top);

  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink, 0.17);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const x = Math.round(x0 + (i / 24) * W) + 0.5;
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + (i % 6 === 0 ? 9 : 4));
  }
  ctx.moveTo(x0, top + 0.5);
  ctx.lineTo(x1, top + 0.5);
  ctx.stroke();

  const starts = [0.9, 0.0, 0.33, 0.56];
  ctx.lineCap = "round";
  ctx.lineWidth = 4;
  for (let r = 0; r < 4; r++) {
    const y = y0 + r * gap;
    const s = starts[r] ?? 0;
    // a bar that runs past midnight comes back in at the left
    for (const [a, b] of [
      [s, Math.min(1, s + 0.375)],
      [0, s + 0.375 - 1],
    ] as const) {
      if (b <= a) continue;
      const xa = x0 + a * W;
      const xb = x0 + b * W;
      ctx.strokeStyle = rgba(pal.ink, 0.13);
      ctx.beginPath();
      ctx.moveTo(xa, y);
      ctx.lineTo(xb, y);
      ctx.stroke();
      const la = Math.max(xa, nowX - band);
      const lb = Math.min(xb, nowX);
      if (lb > la) {
        ctx.strokeStyle = rgba(r % 2 ? pal.accent : pal.teal, 0.42);
        ctx.beginPath();
        ctx.moveTo(la, y);
        ctx.lineTo(lb, y);
        ctx.stroke();
      }
    }
  }
  ctx.lineCap = "butt";
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.gold, 0.5);
  ctx.beginPath();
  ctx.moveTo(Math.round(nowX) + 0.5, top - 5);
  ctx.lineTo(Math.round(nowX) + 0.5, bot);
  ctx.stroke();
}

/** A rectangle cut at the golden section, and the smaller part cut again: how a whole is divided into unequal shares. */
function sizing(f: Frame) {
  const { ctx, pal } = f;
  const padY = Math.max(10, f.h * 0.15);
  let rw = f.fw * 0.78;
  let rh = f.h - padY * 2;
  let rx = f.x + f.fw * (f.dir > 0 ? 0.18 : 0.04);
  let ry = padY;
  if (f.h > 200 && rh * PHI < rw) {
    // room for the golden rectangle itself
    rw = rh * PHI;
    rx = clamp(f.fx - rw / 2, f.x + f.fw * 0.1, f.x + f.fw - rw - 21);
  }
  const LEVELS = 8;
  const T = LEVELS * 0.9 + 7;
  const u = f.still ? LEVELS + 2 : f.t % T;
  const fade = (1 - smooth((u - (T - 1.5)) / 1.5)) * smooth(u / 0.8);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink, 0.2 * fade);
  if (f.h > 240) {
    ctx.strokeRect(Math.round(rx) + 0.5, Math.round(ry) + 0.5, Math.round(rw), Math.round(rh));
  } else {
    // in a shallow band a closed box would read as a form field: only the rule it stands on is drawn
    const yb = Math.round(ry + rh) + 0.5;
    ctx.beginPath();
    ctx.moveTo(rx, yb);
    ctx.lineTo(rx + rw, yb);
    ctx.stroke();
  }

  let hc = 0;
  let vc = 0;
  for (let l = 0; l < LEVELS; l++) {
    const p = smooth((u - 0.5 - l * 0.9) / 0.9);
    if (p <= 0) break;
    const next = smooth((u - 0.5 - (l + 1) * 0.9) / 0.9);
    const ratio = 0.618 + 0.012 * Math.sin(f.t * 0.5 + l * 1.7);
    let bx = rx;
    let by = ry;
    let bw = rw;
    let bh = rh;
    let ax: number;
    let ay: number;
    let ex: number;
    let ey: number;
    if (rw >= rh) {
      bw = rw * ratio;
      const first = hc++ % 2 === 0;
      const cut = first ? rx + bw : rx + rw - bw;
      if (!first) bx = cut;
      rx = first ? cut : rx;
      rw -= bw;
      ax = ex = Math.round(cut) + 0.5;
      ay = ry;
      ey = ry + rh * p;
    } else {
      bh = rh * ratio;
      const first = vc++ % 2 === 0;
      const cut = first ? ry + bh : ry + rh - bh;
      if (!first) by = cut;
      ry = first ? cut : ry;
      rh -= bh;
      ay = ey = Math.round(cut) + 0.5;
      ax = rx;
      ex = rx + rw * p;
    }
    const inside = f.mx >= bx && f.mx <= bx + bw && f.my >= by && f.my <= by + bh;
    const fill = 0.05 * p * (1 - next) + (inside ? 0.08 * f.hover : 0);
    if (fill > 0.004) {
      ctx.fillStyle = rgba(pal.accent, fill * fade);
      ctx.fillRect(bx, by, bw, bh);
    }
    ctx.strokeStyle = rgba(l % 2 ? pal.gold : pal.ink, (l % 2 ? 0.4 : 0.24) * fade);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = rgba(pal.gold, 0.7 * fade * (p < 1 ? 1 : 0.5));
    ctx.beginPath();
    ctx.arc(ex, ey, 1.8, 0, TAU);
    ctx.fill();
  }
}

const DRAW: Record<BackdropVariant, (f: Frame) => void> = { candles, depth, routes, ledger, orbits, curve, tape, lattice, sessions, sizing };

/**
 * Which backdrops a part of the site uses when a band does not name one. Each
 * band on a page takes the next in its list, and the page's own path decides
 * where the list starts, so neighbouring pages do not open on the same one.
 */
const BY_AREA: [prefix: string, list: BackdropVariant[]][] = [
  ["/markets", ["candles", "depth", "sessions", "curve", "tape"]],
  ["/explore", ["candles", "routes", "tape", "depth"]],
  ["/labs", ["lattice", "orbits", "candles", "curve"]],
  ["/trading", ["sizing", "ledger", "depth", "curve", "tape"]],
  ["/partners", ["routes", "ledger", "sizing", "sessions"]],
  ["/platforms", ["lattice", "tape", "candles", "depth", "orbits"]],
  ["/tools", ["curve", "sizing", "lattice", "tape"]],
  ["/trust", ["ledger", "orbits", "sizing", "routes"]],
  ["/legal", ["ledger", "sizing"]],
  ["/support", ["routes", "ledger", "sessions"]],
  ["/status", ["sessions", "tape", "ledger"]],
  ["/academy", ["orbits", "curve", "sizing", "candles", "ledger"]],
  ["/intelligence", ["curve", "candles", "orbits", "depth"]],
  ["/", ["lattice", "routes", "orbits", "sessions", "candles", "sizing", "depth"]],
];
const COMPANY: BackdropVariant[] = ["routes", "sessions", "lattice", "ledger", "orbits", "sizing"];

/** drawings with a frame of their own, which a cleared patch would cut into */
const FRAMED: BackdropVariant[] = ["sizing", "ledger", "sessions"];

function pick(pathname: string, index: number, open: boolean): BackdropVariant {
  const hit = BY_AREA.find(([p]) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")));
  const all = hit ? hit[1] : COMPANY;
  // a band with an action standing in its field takes only the open, flowing drawings
  const flowing = all.filter((v) => !FRAMED.includes(v));
  const list = open || !flowing.length ? all : flowing;
  let hash = 0;
  for (let i = 0; i < pathname.length; i++) hash = (hash * 31 + pathname.charCodeAt(i)) >>> 0;
  return list[(hash + index) % list.length] ?? "tape";
}

type Props = {
  /** which drawing; "auto" chooses by the part of the site and the band's place on the page */
  variant?: BackdropVariant | "auto";
  /** where the band's empty space is, relative to its text */
  side?: Side;
  /** scales every alpha; 1 is the designed strength */
  strength?: number;
  className?: string;
};

export function Backdrop({ variant = "auto", side = "right", strength = 1, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isStill = () => reduced.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";

    const chosen: BackdropVariant = variant === "auto" ? pick(pathname, Array.from(document.querySelectorAll("canvas[data-backdrop]")).indexOf(canvas), !host.querySelector("[data-backdrop-hole]")) : variant;
    canvas.dataset.backdrop = chosen;
    const draw = DRAW[chosen];

    let w = 1;
    let h = 1;
    let dpr = 1;
    let raf = 0;
    let inView = false;
    let disposed = false;
    let last = 0;
    let clock = 0;
    let over = false;
    let tx = 0;
    let ty = 0;
    let mx = 0;
    let my = 0;
    let hover = 0;
    // the free field, the masks that keep the drawing out of the text, and the controls to clear
    let fieldX = 0;
    let fieldW = 0;
    let dir: 1 | -1 = 1;
    let hMask: CanvasGradient | null = null;
    let vMask: CanvasGradient | null = null;
    let holes: [number, number, number, number][] = [];

    /** Any CSS colour, through the canvas's own parser, as numbers (as the figure host does). */
    const parse = (value: string): Colour | null => {
      if (!value) return null;
      ctx.fillStyle = "rgba(1,2,3,0.004)";
      const before = ctx.fillStyle;
      ctx.fillStyle = value;
      const s = String(ctx.fillStyle);
      if (s === before && value.replace(/\s/g, "") !== "rgba(1,2,3,0.004)") return null;
      if (s[0] === "#") return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
      const m = s.match(/-?[\d.]+(?:e-?\d+)?/g);
      if (!m || m.length < 3) return null;
      const k = s.startsWith("color(") ? 255 : 1;
      return [Math.round(Number(m[0]) * k), Math.round(Number(m[1]) * k), Math.round(Number(m[2]) * k), m.length > 3 ? Number(m[3]) : 1];
    };
    const readPalette = (): Palette => {
      const cs = getComputedStyle(canvas);
      const text = parse(cs.color) ?? [128, 128, 128, 1];
      const v = (name: string, fallback: Colour) => parse(cs.getPropertyValue(name).trim()) ?? fallback;
      const ink = v("--ink", text);
      const accent = v("--accent", v("--brand", ink));
      return {
        ink,
        ink2: v("--ink-2", ink),
        ink3: v("--ink-3", ink),
        line: v("--line", [ink[0], ink[1], ink[2], 0.11]),
        accent,
        gold: v("--prestige", ink),
        teal: v("--teal", accent),
        emerald: v("--emerald", accent),
        surface: v("--surface", [255, 255, 255, 1]),
        font: cs.fontFamily || "system-ui, sans-serif",
      };
    };
    let pal = readPalette();

    /** Find the band's text and controls, and from them the free field and its masks. */
    const measure = () => {
      const c = canvas.getBoundingClientRect();
      holes = [];
      hMask = vMask = null;
      fieldW = 0;
      if (c.width < 24 || c.height < 24) return;
      let tl = Infinity;
      let tr = -Infinity;
      // controls, and anything marked as standing in the field, are cleared rather than counted as the band's text
      const CONTROL = ".btn, button, input, select, textarea, [data-backdrop-hole]";
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (!node.textContent || !node.textContent.trim()) continue;
        const p = node.parentElement;
        if (!p || p.closest(CONTROL) || p.closest(".sr-only, [hidden]")) continue;
        range.selectNodeContents(node);
        for (const r of Array.from(range.getClientRects())) {
          if (r.width < 1 || r.height < 1) continue;
          if (r.left - c.left < tl) tl = r.left - c.left;
          if (r.right - c.left > tr) tr = r.right - c.left;
        }
      }
      for (const el of Array.from(host.querySelectorAll(`${CONTROL}, img, video, svg, canvas:not([data-backdrop])`))) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        holes.push([r.left - c.left, r.top - c.top, r.width, r.height]);
      }
      const PAD = 34;
      const EDGE = 55;
      const stops: [number, number][] = [];
      const hasText = tr > tl;
      // a band with no text of its own is all field
      const lo = hasText ? clamp(tl - PAD, 0, w) : side === "left" ? w : 0;
      const hi = hasText ? clamp(tr + PAD, 0, w) : side === "left" ? w : 0;
      const useLeft = side !== "right" && lo >= MIN_FIELD;
      const useRight = side !== "left" && w - hi >= MIN_FIELD;
      canvas.dataset.field = String(Math.round(Math.max(useLeft ? lo : 0, useRight ? w - hi : 0)));
      if (!useLeft && !useRight) return;
      stops.push([0, 0]);
      if (useLeft) {
        const fadeW = clamp(lo * 0.382, 89, 233);
        stops.push([EDGE, 1], [Math.max(EDGE, lo - fadeW), 1], [lo, 0]);
      }
      if (useRight) {
        const fadeW = clamp((w - hi) * 0.382, 89, 233);
        stops.push([hi, 0], [Math.min(w - EDGE, hi + fadeW), 1], [w - EDGE, 1]);
      }
      stops.push([w, 0]);
      const g = ctx.createLinearGradient(0, 0, w, 0);
      let prev = 0;
      for (const [x, a] of stops) {
        prev = Math.max(prev, clamp(x / w));
        g.addColorStop(prev, `rgba(0,0,0,${a})`);
      }
      hMask = g;
      const e = clamp(Math.min(34, h * 0.2) / h, 0.01, 0.49);
      const v = ctx.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(e, "rgba(0,0,0,1)");
      v.addColorStop(1 - e, "rgba(0,0,0,1)");
      v.addColorStop(1, "rgba(0,0,0,0)");
      vMask = v;
      if (useLeft && useRight) {
        fieldX = 0;
        fieldW = w;
        dir = 1;
      } else if (useRight) {
        fieldX = hi;
        fieldW = w - hi;
        dir = 1;
      } else {
        fieldX = 0;
        fieldW = lo;
        dir = -1;
      }
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      // a band is a large surface: the pixel ratio is capped lower than a figure's
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!over) {
        tx = mx = w / 2;
        ty = my = h / 2;
      }
      measure();
    };

    const paint = (t: number, dt: number, still: boolean) => {
      ctx.clearRect(0, 0, w, h);
      if (!hMask || !vMask || fieldW < MIN_FIELD) return;
      ctx.save();
      try {
        // the pointer brings the drawing up from 72% of its strength to all of it
        ctx.globalAlpha = clamp(strength * (0.72 + 0.28 * hover));
        const both = fieldW === w && side === "both";
        draw({
          ctx,
          w,
          h,
          t,
          dt,
          still,
          pal,
          x: fieldX,
          fw: fieldW,
          fx: fieldX + fieldW * (both ? 0.809 : dir > 0 ? 0.618 : 0.382),
          fy: h * (h > 240 ? 0.44 : 0.5),
          dir,
          hover,
          mx,
          my,
        });
      } finally {
        ctx.restore();
      }
      ctx.save();
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = hMask;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = vMask;
      ctx.fillRect(0, 0, w, h);
      if (holes.length) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.shadowColor = "rgba(0,0,0,1)";
        ctx.shadowBlur = 21 * dpr;
        for (const [x, y, hw, hh] of holes) ctx.fillRect(x - 5, y - 5, hw + 10, hh + 10);
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      raf = 0;
      if (disposed) return;
      if (isStill()) {
        hover = 0;
        paint(STILL_T, 0, true);
        return;
      }
      if (!inView || document.hidden || fieldW < MIN_FIELD) return;
      // thirty frames a second is enough for something this slow
      if (last && now - last < 30) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      clock += dt;
      const k = 1 - Math.exp(-dt * 4);
      hover += ((over ? 1 : 0) - hover) * k;
      mx += (tx - mx) * k;
      my += (ty - my) * k;
      paint(clock, dt, false);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (disposed || raf) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver(() => {
      resize();
      start();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      if (inView) {
        // the text may have wrapped differently since the last look
        measure();
        start();
      }
    });
    io.observe(canvas);

    const onVis = () => {
      if (!document.hidden) start();
    };
    const onPrefs = () => {
      // theme, accent, text size or motion changed: read the tokens and the text again on the next frame
      requestAnimationFrame(() => {
        if (disposed) return;
        pal = readPalette();
        measure();
        start();
      });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = canvas.getBoundingClientRect();
      over = true;
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      start();
    };
    const onLeave = () => {
      over = false;
      start();
    };

    resize();
    start();
    void document.fonts?.ready.then(() => {
      if (disposed) return;
      measure();
      start();
    });
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("gx:prefs", onPrefs);
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });
    reduced.addEventListener("change", onPrefs);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("gx:prefs", onPrefs);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      reduced.removeEventListener("change", onPrefs);
    };
  }, [variant, side, strength, pathname]);

  return <canvas ref={canvasRef} aria-hidden data-backdrop={variant} className={`no-print pointer-events-none absolute inset-0 hidden h-full w-full select-none lg:block ${className}`} />;
}
