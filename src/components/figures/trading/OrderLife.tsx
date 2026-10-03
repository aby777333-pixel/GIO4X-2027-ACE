"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";

/**
 * Trade Anatomy, "Method": one order's life as seven stations down a single
 * line, named as the walkthrough names them. A marker, the order, travels
 * down; a station lights as the order reaches it and stays lit behind it. At
 * Routing the line briefly splits and rejoins, because that is the stage
 * where the path can differ; at Settlement the marker dissolves into the
 * line's foot and the walk begins again.
 *
 * The pointer calls the marker to the nearest station, which opens up; when
 * the pointer leaves, the marker resumes from there. No price, no figure:
 * the names are the same seven the page lists beside it.
 */

const NAMES = ["Ticket", "Checks", "Routing", "Fill", "Position", "Close", "Settlement"] as const;
const N = NAMES.length;
const FORK = 2; // Routing
const PACE = 1.5; // seconds per station on its own walk

type State = { s: number };
const states = new WeakMap<CanvasRenderingContext2D, State>();

const draw: FigureDraw = ({ ctx, w, h, t, dt, hover, my, pal, still, enter }) => {
  // hidden below lg, the canvas has no size: nothing to draw
  if (w < 120 || h < 160) return;
  const top = 26;
  const bottom = h - 30;
  const x = Math.min(64, w * 0.2);
  const gap = (bottom - top) / (N - 1);
  const yOf = (i: number) => top + i * gap;

  // where the order is: its own walk (with a rest at the foot), or the station under the pointer
  const walk = (t / PACE) % (N + 1.4);
  const auto = Math.min(N - 1, walk);
  let target = auto;
  if (hover > 0.02) {
    const nearest = clamp(Math.round((my - top) / gap), 0, N - 1);
    target = lerp(auto, nearest, smooth(hover));
  }
  let st = states.get(ctx);
  if (!st) {
    st = { s: target };
    states.set(ctx, st);
  }
  st.s = still ? N - 1 : st.s + (target - st.s) * (1 - Math.exp(-dt * 5));
  const s = st.s;
  const yNow = lerp(yOf(Math.floor(s)), yOf(Math.min(N - 1, Math.floor(s) + 1)), smooth(s - Math.floor(s)));
  const grown = bottom * enter + top * (1 - enter); // the line draws itself in on arrival

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the line: quiet all the way down, lit as far as the order has come
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, grown);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, Math.min(yNow, grown));
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = rgba(pal.accent, 0.9);
  ctx.stroke();

  // the fork at Routing: a second path leaves and rejoins before Fill
  const fy0 = yOf(FORK);
  const fy1 = yOf(FORK + 1);
  const bulge = Math.min(34, w * 0.1);
  ctx.beginPath();
  ctx.moveTo(x, fy0);
  ctx.bezierCurveTo(x + bulge, fy0 + gap * 0.2, x + bulge, fy1 - gap * 0.2, x, fy1);
  ctx.setLineDash([2.5, 3]);
  ctx.lineDashOffset = -t * 4;
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.gold, 0.35 + 0.55 * smooth(1 - Math.abs(s - (FORK + 0.5)) / 1.2));
  ctx.stroke();
  ctx.setLineDash([]);

  // the stations and their names
  ctx.textBaseline = "middle";
  for (let i = 0; i < N; i++) {
    const y = yOf(i);
    if (y > grown + 1) break;
    const here = smooth(1 - Math.abs(s - i) / 0.6);
    const passed = s >= i - 0.05;
    const r = 5.5 + here * 3.5;

    ctx.beginPath();
    ctx.arc(x, y, r + 2.5, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = passed ? rgba(pal.accent, 0.95) : rgba(pal.ink3, 0.6);
    ctx.stroke();
    if (passed) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.5, r - 3), 0, TAU);
      ctx.fillStyle = rgba(pal.accent, 0.3 + here * 0.6);
      ctx.fill();
    }

    ctx.textAlign = "right";
    ctx.font = `600 10px ${pal.font}`;
    ctx.fillStyle = here > 0.3 ? rgba(pal.gold, 1) : rgba(pal.ink3, 0.9);
    ctx.fillText(`0${i + 1}`, x - 16 - here * 2, y);

    ctx.textAlign = "left";
    ctx.font = `${here > 0.3 ? 600 : 400} ${13 + here * 2}px ${pal.font}`;
    ctx.fillStyle = here > 0.3 ? rgba(pal.ink, 1) : passed ? rgba(pal.ink2, 0.95) : rgba(pal.ink3, 0.9);
    ctx.fillText(NAMES[i], x + 18 + here * 4, y);

    // a short rule runs out from the station the order is at, toward the text beside the figure
    if (here > 0.05) {
      const from = x + 18 + here * 4 + ctx.measureText(NAMES[i]).width + 10;
      const to = Math.min(w - 8, from + (w - from - 8) * smooth(here));
      if (to > from) {
        ctx.beginPath();
        ctx.moveTo(from, y);
        ctx.lineTo(to, y);
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(pal.accent, 0.25 + here * 0.35);
        ctx.stroke();
      }
    }
  }

  // the order itself
  if (yNow <= grown + 1) {
    const rest = smooth(clamp(walk - (N - 1), 0, 1)); // dissolving at the foot before the walk restarts
    const fade = hover > 0.02 ? 1 : 1 - rest * 0.85;
    ctx.beginPath();
    ctx.arc(x, yNow, 10 + Math.sin(t * 2.2) * 1.2 + rest * 10, 0, TAU);
    ctx.strokeStyle = rgba(pal.accent, 0.28 * fade);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, yNow, 3.4, 0, TAU);
    ctx.fillStyle = rgba(pal.accent, fade);
    ctx.fill();
  }
};

export function OrderLife() {
  return <Figure draw={draw} ratio={0.92} />;
}
