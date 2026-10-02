"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";

/**
 * MetaTrader 5, "The general sequence": the eight steps as stations on one
 * line that runs out along the top and back along the bottom. A marker walks
 * the line, resting at each station. The fourth station is drawn as an open,
 * dashed gate: that is the step where the server is chosen, and the server
 * name is the one thing that has to come from GIO4X.
 *
 * The pointer calls the marker to the nearest station, which opens up; when
 * the pointer leaves, the marker resumes its walk from there.
 */

const N = 8;
const GATE = 3; // "Select the server and log in"
const PACE = 1.9; // seconds per station on its own walk

type State = { s: number };
const states = new WeakMap<CanvasRenderingContext2D, State>();

const draw: FigureDraw = ({ ctx, w, h, t, dt, hover, mx, my, pal, still }) => {
  // hidden below lg, the canvas has no size: nothing to draw
  if (w < 120 || h < 60) return;
  const m = 26;
  const yTop = h * 0.3;
  const yBot = h * 0.74;
  const rad = (yBot - yTop) / 2;
  const x0 = m;
  const x1 = w - m - rad;
  const step = (x1 - x0) / 3;
  const run = x1 - x0;
  const arc = Math.PI * rad;
  const total = run * 2 + arc;

  /** a point at distance d along the line */
  const at = (d: number): [number, number] => {
    if (d <= run) return [x0 + d, yTop];
    if (d <= run + arc) {
      const a = -Math.PI / 2 + ((d - run) / arc) * Math.PI;
      return [x1 + Math.cos(a) * rad, yTop + rad + Math.sin(a) * rad];
    }
    return [x1 - (d - run - arc), yBot];
  };
  /** distance along the line of station i (0 to 7) */
  const dist = (i: number) => (i < 4 ? i * step : run + arc + (i - 4) * step);
  /** distance for a fractional station position */
  const distAt = (s: number) => {
    const i = Math.floor(clamp(s, 0, N - 1));
    const j = Math.min(N - 1, i + 1);
    return lerp(dist(i), dist(j), smooth(s - i));
  };

  // where the marker is: its own walk, or the station under the pointer
  const walk = (t / PACE) % (N + 1.2);
  const auto = Math.min(N - 1, walk);
  let target = auto;
  if (hover > 0.02) {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const [px, py] = at(dist(i));
      const d = (px - mx) ** 2 + (py - my) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    target = lerp(auto, best, smooth(hover));
  }
  let st = states.get(ctx);
  if (!st) {
    st = { s: target };
    states.set(ctx, st);
  }
  st.s = still ? target : st.s + (target - st.s) * (1 - Math.exp(-dt * 5));
  const s = st.s;
  const done = distAt(s);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the whole line, then the part already walked
  const trace = (to: number) => {
    ctx.beginPath();
    ctx.moveTo(x0, yTop);
    ctx.lineTo(x0 + Math.min(to, run), yTop);
    if (to > run) {
      const a1 = -Math.PI / 2 + (Math.min(to - run, arc) / arc) * Math.PI;
      ctx.arc(x1, yTop + rad, rad, -Math.PI / 2, a1);
    }
    if (to > run + arc) ctx.lineTo(x1 - (to - run - arc), yBot);
  };
  trace(total);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.4);
  ctx.stroke();
  trace(done);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = rgba(pal.accent, 0.9);
  ctx.stroke();

  // the stations
  ctx.font = `600 10px ${pal.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < N; i++) {
    const [px, py] = at(dist(i));
    const here = smooth(1 - Math.abs(s - i) / 0.6);
    const passed = s >= i - 0.05;
    const r = 6 + here * 3.5;
    const labelY = i < 4 ? py - 19 - here * 2 : py + 20 + here * 2;

    ctx.beginPath();
    ctx.arc(px, py, r + 2.5, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();

    if (i === GATE) {
      // the gate: open and dashed until GIO4X names the server
      ctx.setLineDash([2.5, 2.5]);
      ctx.lineDashOffset = -t * 2.5;
      ctx.beginPath();
      ctx.arc(px, py, r + 3, 0, TAU);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = rgba(pal.gold, 0.95);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, TAU);
      ctx.fillStyle = rgba(pal.gold, 0.95);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, TAU);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = passed ? rgba(pal.accent, 0.95) : rgba(pal.ink3, 0.6);
      ctx.stroke();
      if (passed) {
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.5, r - 3), 0, TAU);
        ctx.fillStyle = rgba(pal.accent, 0.3 + here * 0.6);
        ctx.fill();
      }
    }
    ctx.fillStyle = here > 0.3 ? rgba(pal.ink, 0.95) : rgba(pal.ink3, 0.9);
    ctx.fillText(`0${i + 1}`, px, labelY);
  }

  // the marker
  const [bx, by] = at(done);
  ctx.beginPath();
  ctx.arc(bx, by, 9 + Math.sin(t * 2.2) * 1.2, 0, TAU);
  ctx.strokeStyle = rgba(pal.accent, 0.28);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx, by, 3.2, 0, TAU);
  ctx.fillStyle = rgba(pal.accent, 1);
  ctx.fill();
};

export function SequenceRoute() {
  return <Figure draw={draw} ratio={2.3} />;
}
