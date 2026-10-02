"use client";

import { Figure, clamp, lerp, rgba, smooth, TAU, type FigureDraw } from "../Figure";
import { caps, lamp } from "./kit";

/**
 * "Apply, verify, set up, launch" (money managers): a four-disc lock. Each
 * disc is one step and has one notch. The discs turn idly until, one after
 * another and in order, each brings its notch to the top and holds. Only when
 * all four are aligned can the bar above them drop into the notches: nothing
 * launches until every earlier step is done.
 *
 * Pointer: the steps follow the pointer from left to right. Each disc the
 * pointer has passed turns to its mark; carry it past the fourth and the bar
 * drops.
 */

const STEPS = ["Apply", "Verify", "Set up", "Launch"];
const CYCLE = 13;
const SPIN = [0.5, -0.42, 0.46, -0.55];
const REST = [0, 0, 2.2, -1.3];
/** the moment of a still frame within the cycle: two steps done, two to come */
const STILL_AT = 4.4;

/** each disc's angle away from its mark, kept between frames */
const angles = new WeakMap<CanvasRenderingContext2D, Float32Array>();
const wrap = (a: number) => a - TAU * Math.round(a / TAU);

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const r = Math.min(w * 0.095, h * 0.25);
  const cy = h * 0.47;
  const tt = f.still ? STILL_AT : f.t % CYCLE;
  const release = 1 - smooth((tt - 11.5) / 0.8);

  let ang = angles.get(ctx);
  if (!ang) {
    ang = new Float32Array([0.9, -1.7, 2.2, -1.3]);
    angles.set(ctx, ang);
  }

  // how firmly each step is set, and whether its notch has reached the mark
  let all = 1;
  for (let i = 0; i < 4; i++) {
    const x = w * (0.14 + 0.24 * i);
    const auto = smooth((tt - (1 + 2 * i)) / 0.9) * release;
    const byHand = smooth((f.mx - (x - r)) / r);
    const lock = lerp(auto, byHand, f.hover);
    if (f.still) ang[i] = lock > 0.5 ? 0 : REST[i];
    else {
      ang[i] += SPIN[i] * (1 - lock) * f.dt;
      ang[i] -= wrap(ang[i]) * lock * (1 - Math.exp(-f.dt * 9));
    }
    const off = Math.abs(wrap(ang[i]));
    const set = lock * smooth(1 - off / 0.35);
    all *= set;

    const a = -Math.PI / 2 + ang[i];
    const under = f.hover * smooth(1.5 - Math.abs(f.mx - x) / r);

    // the disc: a ring with one notch, an inner ring, and marks that turn with it
    ctx.beginPath();
    ctx.arc(x, cy, r, a + 0.2, a + TAU - 0.2);
    ctx.strokeStyle = rgba(pal.ink, 0.62);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (set > 0.004) {
      ctx.strokeStyle = rgba(pal.gold, set);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, cy, r * 0.56, 0, TAU);
    ctx.strokeStyle = rgba(pal.ink, 0.22);
    ctx.lineWidth = 1;
    ctx.stroke();
    if (under > 0.004) {
      ctx.strokeStyle = rgba(pal.accent, 0.9 * under);
      ctx.stroke();
    }
    ctx.beginPath();
    for (let k = 1; k < 12; k++) {
      const b = a + (k / 12) * TAU;
      const r0 = r * (k % 3 === 0 ? 0.7 : 0.8);
      ctx.moveTo(x + Math.cos(b) * r0, cy + Math.sin(b) * r0);
      ctx.lineTo(x + Math.cos(b) * r * 0.9, cy + Math.sin(b) * r * 0.9);
    }
    ctx.strokeStyle = rgba(pal.ink, 0.36);
    ctx.lineWidth = 1;
    ctx.stroke();
    // the notch's two cheeks
    ctx.beginPath();
    for (const s of [-0.2, 0.2]) {
      ctx.moveTo(x + Math.cos(a + s) * r, cy + Math.sin(a + s) * r);
      ctx.lineTo(x + Math.cos(a + s) * r * 0.84, cy + Math.sin(a + s) * r * 0.84);
    }
    ctx.strokeStyle = rgba(pal.ink, 0.62);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (set > 0.004) {
      ctx.strokeStyle = rgba(pal.gold, set);
      ctx.stroke();
    }
    lamp(ctx, x, cy, 2.5, pal.gold, set);
    if (set < 0.996) {
      ctx.beginPath();
      ctx.arc(x, cy, 2.5, 0, TAU);
      ctx.strokeStyle = rgba(pal.ink, 0.5 * (1 - set));
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    caps(f, STEPS[i], x, cy + r + 23, rgba(pal.ink3, 1));
    if (set > 0.004) caps(f, STEPS[i], x, cy + r + 23, rgba(pal.ink, set));
  }

  // the bar: it rests above the discs and drops into the notches once all four are aligned
  const drop = smooth(clamp(all)) * r * 0.17;
  const by = cy - r - r * 0.2 + drop;
  const x0 = w * 0.14 - r * 0.7;
  const x1 = w * 0.86 + r * 0.7;
  ctx.beginPath();
  ctx.moveTo(x0, by);
  ctx.lineTo(x1, by);
  for (let i = 0; i < 4; i++) {
    const x = w * (0.14 + 0.24 * i);
    ctx.moveTo(x - 3, by);
    ctx.lineTo(x - 3, by + r * 0.16);
    ctx.lineTo(x + 3, by + r * 0.16);
    ctx.lineTo(x + 3, by);
  }
  ctx.strokeStyle = rgba(pal.ink, 0.7);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const done = smooth(clamp(all));
  if (done > 0.004) {
    ctx.strokeStyle = rgba(pal.gold, done);
    ctx.stroke();
  }
};

export function FourDiscs({ ratio = 2.6, className }: { ratio?: number; className?: string }) {
  return <Figure draw={draw} ratio={ratio} className={className} />;
}
