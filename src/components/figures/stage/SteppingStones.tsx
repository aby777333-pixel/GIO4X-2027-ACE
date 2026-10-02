"use client";

import { Figure, clamp, lerp, rgba, smooth, TAU, type FigureDraw } from "../Figure";
import { aim, closeStage, dot, fract, glow, hash, lamp, line, makeCam, openStage, PHI, project } from "./kit";

/**
 * Open an account, beside the form: "One step at a time." Stepping stones lie
 * on dark water along a golden spiral, large and near at the start, smaller
 * and further with every quarter turn, closing on a beacon at the spiral's
 * eye. A light crosses them one stone at a time and each stone it has left
 * stays faintly lit behind it. The number of stones means nothing: the site
 * does not publish the steps of the application, and none is named here.
 *
 * Pointer: the light goes to the stone nearest the pointer, and the stones
 * before it show the way already walked.
 */

const N = 11;
const STEP = 0.58; // radians between stones
const cam = makeCam();
const P = [0, 0, 0, 0];
const sx = new Float32Array(N);
const sy = new Float32Array(N);
const sr = new Float32Array(N);

type State = { at: number };
const states = new WeakMap<CanvasRenderingContext2D, State>();

const radius = (k: number) => 2.5 * PHI ** (-(k * STEP) / (Math.PI / 2));
const angle = (k: number) => -2.3 + k * STEP;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, dt, hover, mx, my, pal, still } = f;
  if (w < 150 || h < 110) return;
  openStage(f, 0.618, 0.382);
  const hv = smooth(hover);

  const pitch = 0.5 + (my / h - 0.5) * 0.08 * hv;
  const scale = Math.min(w / 5.4, h / 4.4);
  aim(cam, w * 0.6, h * 0.5, scale, 7.5, (mx / w - 0.5) * 0.12 * hv, pitch);

  // the horizon and a few stars over it
  project(cam, 0, 0, 40, P);
  const hy = P[1];
  ctx.strokeStyle = rgba(pal.ink3, 0.4);
  ctx.lineWidth = 1;
  line(ctx, 0, Math.round(hy) + 0.5, w, Math.round(hy) + 0.5);
  for (let i = 0; i < 24; i++) dot(ctx, w * hash(i, 91), hy * hash(i, 92) * 0.94, 0.6, rgba(pal.ink, 0.1 + 0.16 * hash(i, 93)));

  // the spiral itself, faint on the water
  ctx.strokeStyle = rgba(pal.gold, 0.26);
  ctx.beginPath();
  for (let j = 0; j <= 90; j++) {
    const k = (j / 90) * (N + 2.5) - 0.6;
    const r = radius(k);
    project(cam, Math.cos(angle(k)) * r, 0, Math.sin(angle(k)) * r, P);
    if (j === 0) ctx.moveTo(P[0], P[1]);
    else ctx.lineTo(P[0], P[1]);
  }
  ctx.stroke();

  // where the stones lie
  let near = 0;
  let nearD = 1e9;
  for (let k = 0; k < N; k++) {
    const r = radius(k);
    project(cam, Math.cos(angle(k)) * r, 0, Math.sin(angle(k)) * r, P);
    sx[k] = P[0];
    sy[k] = P[1];
    sr[k] = P[2] * (0.035 + r * 0.2);
    const d = Math.hypot(P[0] - mx, P[1] - my);
    if (d < nearD) {
      nearD = d;
      near = k;
    }
  }

  // the walk: a stone at a time, a pause on each, then the beacon, then again from the start
  const cycle = N + 2.5;
  const auto = fract(t / (cycle * 1.05)) * cycle;
  const want = hv > 0.5 ? near : Math.min(N - 1, Math.floor(auto));
  let st = states.get(ctx);
  if (!st) {
    st = { at: want };
    states.set(ctx, st);
  }
  if (still) st.at = want;
  else if (want < st.at - 1.5 && hv <= 0.5) st.at = want;
  else st.at += (want - st.at) * (1 - Math.exp(-dt * 5));
  const arrived = hv > 0.5 ? 0 : clamp((auto - (N - 0.4)) / 1.2);

  // the beacon at the eye
  project(cam, 0, 0, 0, P);
  const ex = P[0];
  const ey = P[1];
  const tall = P[2] * 1.5;
  glow(ctx, ex, ey - tall * 0.5, tall * (0.9 + 0.5 * arrived), pal.gold, 0.2 + 0.35 * arrived);
  ctx.strokeStyle = rgba(pal.gold, 0.9);
  ctx.lineWidth = 1.5;
  line(ctx, ex, ey, ex, ey - tall);
  ctx.beginPath();
  ctx.ellipse(ex, ey, P[2] * 0.26, P[2] * 0.26 * Math.sin(pitch), 0, 0, TAU);
  ctx.strokeStyle = rgba(pal.gold, 0.7);
  ctx.lineWidth = 1;
  ctx.stroke();
  lamp(ctx, ex, ey - tall, 2.2, pal.gold, 0.7 + 0.3 * arrived);

  // the stones, far to near (the spiral winds inwards, so later stones are not always further: sort by height in the window)
  for (let pass = 0; pass < 2; pass++) {
    for (let k = N - 1; k >= 0; k--) {
      if (sy[k] > ey !== (pass === 1)) continue;
      const r = sr[k];
      const ry = r * Math.sin(pitch);
      const thick = Math.max(1.5, r * 0.16);
      const here = clamp(1 - Math.abs(st.at - k));
      const walked = k < st.at ? clamp(0.5 - (st.at - k) * 0.035) : 0;
      // its reflection in the water
      ctx.beginPath();
      ctx.ellipse(sx[k], sy[k] + thick * 2.2, r * 0.94, ry * 0.94, 0, 0, TAU);
      ctx.fillStyle = rgba(here > 0.3 ? pal.gold : pal.accent, 0.05 + 0.12 * here + 0.05 * walked);
      ctx.fill();
      // its side
      ctx.beginPath();
      ctx.ellipse(sx[k], sy[k] + thick, r, ry, 0, 0, TAU);
      ctx.fillStyle = rgba(pal.surface, 1);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.ink3, 0.7);
      ctx.lineWidth = 1;
      ctx.stroke();
      // its top
      if (here > 0.02) glow(ctx, sx[k], sy[k], r * 2.4, pal.gold, 0.4 * here);
      ctx.beginPath();
      ctx.ellipse(sx[k], sy[k], r, ry, 0, 0, TAU);
      ctx.fillStyle = rgba(pal.surface, 1);
      ctx.fill();
      ctx.fillStyle = rgba(here > 0.3 ? pal.gold : pal.accent, 0.08 + 0.3 * here + 0.2 * walked);
      ctx.fill();
      ctx.strokeStyle = rgba(here > 0.3 ? pal.gold : walked > 0 ? pal.accent : pal.ink2, 0.55 + 0.45 * Math.max(here, walked));
      ctx.lineWidth = 1 + here * 0.6;
      ctx.stroke();
    }
  }

  // the light itself, hopping from stone to stone
  const i0 = clamp(Math.floor(st.at), 0, N - 1);
  const i1 = Math.min(N - 1, i0 + 1);
  const e = st.at - i0;
  const lx = lerp(sx[i0], sx[i1], e);
  const lyy = lerp(sy[i0], sy[i1], e) - Math.sin(e * Math.PI) * sr[i0] * 0.9 - sr[i0] * 0.5;
  lamp(ctx, lerp(lx, ex, arrived), lerp(lyy, ey - tall, arrived), 3, pal.ink, 1);

  closeStage(f);
};

export function SteppingStones() {
  return <Figure draw={draw} ratio={1.15} />;
}
