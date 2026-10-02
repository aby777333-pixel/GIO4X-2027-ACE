"use client";

import { Figure, clamp, lerp, rgba, smooth, type Colour, type FigureDraw, type FigureFrame } from "../Figure";
import { closeStage, dot, glow, hash, line, openStage } from "./kit";

/**
 * Copy trading, beside the diagram of the mechanism: a formation in flight. The
 * champagne craft in front is the provider and flies its own course. Three
 * copies follow, each a different size (the same course, sized to each
 * allocation), and each makes every turn a moment after the leader made it.
 * A dashed tie joins each copy to the point on the leader's wake where the
 * leader was when the copy acted: the gap between the two is the delay, and
 * the delay is why a copy's fill can differ. The course is a closed wander
 * with no direction to it: it is not a price.
 *
 * Pointer: it flies the leader. Turn it sharply and the copies can be seen to
 * arrive at the turn late, one after another.
 */

const SAMPLES = 256;
const SPAN = 3.4; // seconds of wake kept
const COPIES = 3;
const DELAY = [0.5, 0.95, 1.4];
const SIZE = [0.74, 0.56, 0.44];
// each copy flies the leader's earlier course in a lane of its own, above or below it (units of the window's height)
const OFF_Y = [0.13, -0.12, 0.23];

type State = { x: Float32Array; y: Float32Array; ts: Float32Array; head: number; last: number };
const states = new WeakMap<CanvasRenderingContext2D, State>();

const courseX = (t: number) => 0.52 + 0.3 * Math.sin(t * 0.7) + 0.05 * Math.sin(t * 1.9 + 1.7);
const courseY = (t: number) => 0.36 + 0.13 * Math.sin(t * 1.4 + 0.6) + 0.04 * Math.sin(t * 2.3);

/** fill the whole wake from the course itself, as if the leader had flown it unattended */
function prefill(st: State, f: FigureFrame) {
  for (let i = 0; i < SAMPLES; i++) {
    const ts = f.t - SPAN + (SPAN * i) / (SAMPLES - 1);
    st.x[i] = courseX(ts) * f.w;
    st.y[i] = courseY(ts) * f.h;
    st.ts[i] = ts;
  }
  st.head = SAMPLES - 1;
  st.last = f.t;
}

/** the leader's position `ago` seconds back, read from the wake into `out` */
function back(st: State, now: number, ago: number, out: number[]) {
  const want = now - ago;
  let i = st.head;
  for (let n = 0; n < SAMPLES - 1; n++) {
    const prev = (i - 1 + SAMPLES) % SAMPLES;
    if (st.ts[prev] <= want || st.ts[prev] > st.ts[i]) {
      const span = st.ts[i] - st.ts[prev];
      const k = span > 1e-5 && st.ts[prev] <= want ? (want - st.ts[prev]) / span : 0;
      out[0] = lerp(st.x[prev], st.x[i], k);
      out[1] = lerp(st.y[prev], st.y[i], k);
      return;
    }
    i = prev;
  }
  out[0] = st.x[i];
  out[1] = st.y[i];
}

const A = [0, 0];
const B = [0, 0];

function craft(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, s: number, col: Colour, surface: Colour, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  glow(ctx, 0, 0, s * 2.6, col, 0.3 * alpha);
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(-s * 0.72, s * 0.62);
  ctx.lineTo(-s * 0.36, 0);
  ctx.lineTo(-s * 0.72, -s * 0.62);
  ctx.closePath();
  ctx.fillStyle = rgba(surface, 0.92);
  ctx.fill();
  ctx.fillStyle = rgba(col, 0.26 * alpha);
  ctx.fill();
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // the keel, for a little depth
  ctx.strokeStyle = rgba(col, 0.55 * alpha);
  ctx.lineWidth = 1;
  line(ctx, s, 0, -s * 0.36, 0);
  ctx.restore();
}

/** the wake behind a craft: the leader's own path from `from` to `to` seconds ago, shifted and fading */
function wake(ctx: CanvasRenderingContext2D, st: State, now: number, from: number, to: number, dx: number, dy: number, col: Colour, alpha: number, width: number) {
  const STEPS = 22;
  back(st, now, from, A);
  ctx.lineWidth = width;
  for (let k = 1; k <= STEPS; k++) {
    back(st, now, lerp(from, to, k / STEPS), B);
    ctx.strokeStyle = rgba(col, alpha * (1 - k / STEPS) ** 1.4);
    line(ctx, A[0] + dx, A[1] + dy, B[0] + dx, B[1] + dy);
    A[0] = B[0];
    A[1] = B[1];
  }
}

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, my, pal, still } = f;
  if (w < 150 || h < 90) return;
  openStage(f, 0.7, 0.4);
  const hv = smooth(hover);

  let st = states.get(ctx);
  if (!st) {
    st = { x: new Float32Array(SAMPLES), y: new Float32Array(SAMPLES), ts: new Float32Array(SAMPLES), head: 0, last: -1 };
    states.set(ctx, st);
    prefill(st, f);
  }
  if (still || t < st.last || t - st.last > 1) prefill(st, f);

  // the leader: its own course, or the pointer's
  const lx = lerp(courseX(t) * w, clamp(mx, w * 0.08, w * 0.92), hv);
  const ly = lerp(courseY(t) * h, clamp(my, h * 0.2, h * 0.56), hv);
  if (!still && t > st.last) {
    st.head = (st.head + 1) % SAMPLES;
    st.x[st.head] = lx;
    st.y[st.head] = ly;
    st.ts[st.head] = t;
    st.last = t;
  }

  // the air: a floor of lines running to a horizon low in the window, and a few fixed stars
  const hy = h * 0.82;
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.3);
  line(ctx, 0, hy + 0.5, w, hy + 0.5);
  for (let i = -7; i <= 7; i++) {
    ctx.strokeStyle = rgba(pal.ink3, 0.14);
    line(ctx, w * 0.5 + i * w * 0.045, hy, w * 0.5 + i * w * 0.2, h);
  }
  for (let k = 1; k <= 3; k++) {
    ctx.strokeStyle = rgba(pal.ink3, 0.1 + 0.03 * k);
    const y = Math.round(hy + (h - hy) * (k / 3.4) ** 1.7) + 0.5;
    line(ctx, 0, y, w, y);
  }
  for (let i = 0; i < 26; i++) dot(ctx, w * hash(i, 31), hy * hash(i, 32) * 0.96, 0.6, rgba(pal.ink, 0.1 + 0.16 * hash(i, 33)));

  const unit = Math.max(9, h * 0.075);

  // the leader's wake
  wake(ctx, st, t, 0, SPAN * 0.92, 0, 0, pal.gold, 1, 1.8);

  // the copies, far to near
  for (let c = COPIES - 1; c >= 0; c--) {
    const col = c === 0 ? pal.accent : c === 1 ? pal.teal : pal.emerald;
    const dx = 0;
    const dy = OFF_Y[c] * h;
    back(st, t, DELAY[c], A);
    const gx = A[0];
    const gy = A[1];
    back(st, t, DELAY[c] + 0.12, B);
    const ang = Math.atan2(gy - B[1], gx - B[0] + 0.6);
    const x = gx + dx;
    const y = gy + dy;

    wake(ctx, st, t, DELAY[c], Math.min(SPAN * 0.96, DELAY[c] + 1.5), dx, dy, col, 0.85, 1.3);
    // the tie back to where the leader was when this copy acted
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = rgba(col, 0.42 + 0.3 * hv);
    ctx.lineWidth = 1;
    line(ctx, x, y, gx, gy);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(gx, gy, 3, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(col, 0.9);
    ctx.stroke();
    // its light on the floor
    glow(ctx, x, lerp(hy, h, 0.35 + c * 0.14), unit * SIZE[c] * 2.4, col, 0.13);
    craft(ctx, x, y, ang, unit * SIZE[c], col, pal.surface, 1);
  }

  // the leader
  back(st, t, 0.12, B);
  const lang = Math.atan2(ly - B[1], lx - B[0] + 0.6);
  glow(ctx, lx, lerp(hy, h, 0.2), unit * 2.6, pal.gold, 0.16);
  craft(ctx, lx, ly, lang, unit, pal.gold, pal.surface, 1);

  closeStage(f);
};

export function Formation() {
  return <Figure draw={draw} />;
}
