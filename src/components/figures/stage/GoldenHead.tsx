"use client";

import { Figure, clamp, lerp, rgba, smooth, TAU, type FigureDraw } from "../Figure";
import { aim, closeStage, dot, fract, glow, line, makeCam, openStage, PHI, project } from "./kit";

/**
 * Designing GIO4X, beside the golden spiral: what the same number does when
 * it is used as a turn. Each point is placed a fixed fraction of a circle on
 * from the last and a little further out. At rest that fraction is the golden
 * one, 1/φ², and the points pack evenly with no two in line: the head of a
 * sunflower, seen at a tilt and turning slowly. A ring of light runs outward
 * through it.
 *
 * Pointer: it changes the fraction. The scale along the foot of the window
 * has the golden turn at its centre mark; carry the pointer left or right of
 * it and the even packing breaks at once into spokes (eight at the far left,
 * thirteen at the far right, both Fibonacci numbers). Let go and it returns.
 */

const N = 233;
const GOLDEN = 1 / (PHI * PHI); // 0.381966…
const LEFT = 3 / 8;
const RIGHT = 5 / 13;
const cam = makeCam();
const P = [0, 0, 0, 0];

type State = { frac: number };
const states = new WeakMap<CanvasRenderingContext2D, State>();

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, dt, hover, mx, my, pal, still } = f;
  if (w < 150 || h < 100) return;
  openStage(f, 0.5, 0.46);
  const hv = smooth(hover);

  // the turn: golden at rest, and wherever the pointer sets it
  const u = clamp((mx - w * 0.12) / (w * 0.76));
  const set = u < 0.5 ? lerp(LEFT, GOLDEN, u * 2) : lerp(GOLDEN, RIGHT, (u - 0.5) * 2);
  const want = lerp(GOLDEN, set, hv);
  let st = states.get(ctx);
  if (!st) {
    st = { frac: want };
    states.set(ctx, st);
  }
  st.frac = still ? want : st.frac + (want - st.frac) * (1 - Math.exp(-dt * 5));

  const pitch = 0.82 + (my / h - 0.5) * 0.2 * hv;
  const scale = Math.min(w * 0.43, (h * 0.36) / Math.sin(pitch));
  aim(cam, w * 0.5, h * 0.44, scale, 5, 0, pitch);
  const spin = t * 0.06;
  const wave = fract(t * 0.11);

  project(cam, 0, 0, 0, P);
  glow(ctx, P[0], P[1], scale * 0.9, pal.gold, 0.2);

  // far half first, then the near half, so the near points sit on top
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 1; k <= N; k++) {
      const r = Math.sqrt(k / N);
      const a = k * st.frac * TAU + spin;
      const z = Math.sin(a) * r;
      if (z > 0 !== (pass === 0)) continue;
      project(cam, Math.cos(a) * r, 0.2 * (1 - r * r), z, P);
      const lit = clamp(1 - Math.abs(r - wave) * 9);
      const size = (0.9 + r * 2.5) * (P[2] / scale) * (w < 300 ? 0.7 : 1);
      const col = r < 0.36 ? pal.gold : r < 0.7 ? pal.accent : pal.teal;
      const alpha = lerp(0.5, 0.95, clamp(0.5 - z * 0.5)) + lit * 0.3;
      if (lit > 0.6) glow(ctx, P[0], P[1], size * 4, col, 0.3 * lit);
      dot(ctx, P[0], P[1], size + lit * 0.8, rgba(lit > 0.5 ? pal.ink : col, clamp(alpha)));
    }
  }

  // the scale: where the turn stands, with the golden turn at the centre mark
  const sy = Math.round(h - 16) + 0.5;
  const sx0 = w * 0.12;
  const sx1 = w * 0.88;
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.6);
  line(ctx, sx0, sy, sx1, sy);
  for (let i = 0; i <= 16; i++) {
    const x = Math.round(lerp(sx0, sx1, i / 16)) + 0.5;
    line(ctx, x, sy, x, sy - (i % 8 === 0 ? 5 : 3));
  }
  const cx = Math.round((sx0 + sx1) / 2) + 0.5;
  ctx.strokeStyle = rgba(pal.gold, 0.95);
  ctx.lineWidth = 1.5;
  line(ctx, cx, sy + 3, cx, sy - 8);
  const at = st.frac < GOLDEN ? ((st.frac - LEFT) / (GOLDEN - LEFT)) * 0.5 : 0.5 + ((st.frac - GOLDEN) / (RIGHT - GOLDEN)) * 0.5;
  const px = lerp(sx0, sx1, clamp(at));
  glow(ctx, px, sy, 12, pal.accent, 0.5);
  ctx.beginPath();
  ctx.moveTo(px, sy - 2);
  ctx.lineTo(px - 4, sy - 10);
  ctx.lineTo(px + 4, sy - 10);
  ctx.closePath();
  ctx.fillStyle = rgba(pal.ink, 0.95);
  ctx.fill();

  closeStage(f);
};

export function GoldenHead() {
  return <Figure draw={draw} ratio={1.45} />;
}
