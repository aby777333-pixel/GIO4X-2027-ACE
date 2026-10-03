"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";

/**
 * Two figures for the Practice desk page, each beside the paragraph it
 * belongs to. Neither shows a price or a figure: the paths are shapes made
 * from a fixed seed, drawn to explain an idea.
 */

/** A small fixed-seed generator: the same seed always gives the same numbers. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** n steps of a bounded walk, as heights from 0 to 1 */
function walk(seed: number, n: number, rough: number): number[] {
  const r = seeded(seed);
  const out: number[] = [];
  let v = 0.5;
  for (let i = 0; i < n; i++) {
    v = clamp(v + (r() - 0.5) * rough, 0.08, 0.92);
    out.push(v);
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * "How the simulation decides": a seed goes into the engine, and the engine
 * draws a path. Then the same seed goes in again and the path comes out the
 * same, laid exactly over the first. That is all "seeded" means, and why a
 * run of the desk can be repeated.
 * ------------------------------------------------------------------------- */

const STEPS = 34;
const PATH = walk(20261003, STEPS, 0.3);
const CYCLE = 9; // seconds: first drawing, a pause, the second drawing, a pause

const drawSeed: FigureDraw = ({ ctx, w, h, t, hover, mx, pal, still }) => {
  if (w < 120 || h < 120) return;
  const pad = 22;
  const engineY = h * 0.2;
  const boxTop = h * 0.4;
  const boxBottom = h - 34;
  const left = pad;
  const right = w - pad;
  const xOf = (i: number) => lerp(left, right, i / (STEPS - 1));
  const yOf = (v: number) => lerp(boxBottom, boxTop, v);

  // the pointer scrubs the drawing; otherwise it plays: first pass, then the second over it
  const phase = still ? CYCLE : hover > 0.02 ? lerp((t % CYCLE), clamp((mx - left) / (right - left)) * 3.4 + 4.6, smooth(hover)) : t % CYCLE;
  const first = clamp(phase / 3.4);
  const second = clamp((phase - 4.6) / 3.4);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the seed, the engine, and the feed line down to the drawing
  const seedX = left + 14;
  const engineX = w * 0.5;
  ctx.beginPath();
  ctx.moveTo(seedX + 10, engineY);
  ctx.lineTo(engineX - 22, engineY);
  ctx.moveTo(engineX, engineY + 20);
  ctx.lineTo(engineX, boxTop - 8);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.45);
  ctx.stroke();

  // the seed travels in at the start of each pass
  const going = phase < 4.6 ? clamp(phase / 0.7) : clamp((phase - 4.6) / 0.7);
  const sx = lerp(seedX, engineX - 22, smooth(going));
  ctx.beginPath();
  ctx.arc(seedX, engineY, 6, 0, TAU);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgba(pal.gold, 0.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(still ? seedX : sx, engineY, 2.6, 0, TAU);
  ctx.fillStyle = rgba(pal.gold, 1);
  ctx.fill();

  // the engine: a ring of teeth that turns only while it is drawing
  const turning = (first > 0 && first < 1) || (second > 0 && second < 1);
  const spin = still ? 0 : turning ? t * 1.6 : 0;
  ctx.beginPath();
  ctx.arc(engineX, engineY, 18, 0, TAU);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgba(turning ? pal.accent : pal.ink3, turning ? 0.95 : 0.7);
  ctx.stroke();
  for (let k = 0; k < 8; k++) {
    const a = spin + (k / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(engineX + Math.cos(a) * 18, engineY + Math.sin(a) * 18);
    ctx.lineTo(engineX + Math.cos(a) * 23, engineY + Math.sin(a) * 23);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(engineX, engineY, 3, 0, TAU);
  ctx.fillStyle = rgba(turning ? pal.accent : pal.ink3, 0.9);
  ctx.fill();

  ctx.font = `600 10px ${pal.font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(pal.ink3, 0.95);
  ctx.fillText("SEED", seedX - 8, engineY - 18);
  ctx.textAlign = "center";
  ctx.fillText("ENGINE", engineX, engineY - 34);

  // the drawing area
  ctx.beginPath();
  ctx.moveTo(left, boxBottom);
  ctx.lineTo(right, boxBottom);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.line, 1);
  ctx.stroke();

  const trace = (amount: number) => {
    const upto = amount * (STEPS - 1);
    ctx.beginPath();
    for (let i = 0; i <= Math.floor(upto); i++) {
      const px = xOf(i);
      const py = yOf(PATH[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    const i = Math.floor(upto);
    if (i < STEPS - 1) {
      const f = upto - i;
      ctx.lineTo(lerp(xOf(i), xOf(i + 1), f), lerp(yOf(PATH[i]), yOf(PATH[i + 1]), f));
    }
  };

  // first pass: the path, quiet once it is complete
  if (first > 0) {
    trace(first);
    ctx.lineWidth = second > 0 ? 3.2 : 1.6;
    ctx.strokeStyle = second > 0 ? rgba(pal.ink3, 0.28) : rgba(pal.accent, 0.95);
    ctx.stroke();
  }
  // second pass: the same seed, the same path, laid exactly over the first
  if (second > 0) {
    trace(second);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = rgba(pal.gold, 0.98);
    ctx.stroke();
  }

  ctx.textAlign = "left";
  ctx.font = `500 11px ${pal.font}`;
  ctx.fillStyle = rgba(pal.ink2, 0.95);
  ctx.fillText(second > 0 ? "The same seed again: the same path" : "One seed, one path", left, h - 14);
};

export function SeededPath() {
  return <Figure draw={drawSeed} ratio={1.25} />;
}

/* ---------------------------------------------------------------------------
 * "Real markets behave differently": two paths side by side, one above the
 * other. The desk's is even: every step about the size of the last. The other
 * is drawn the way a real market can move and the desk does not: a quiet
 * stretch, a sudden jump with nothing in between (a gap), and a fast spike.
 * The pointer runs a reading line across both.
 * ------------------------------------------------------------------------- */

const M = 60;
const EVEN = walk(777, M, 0.12);
const WILD = (() => {
  const r = seeded(4242);
  const out: number[] = [];
  let v = 0.55;
  for (let i = 0; i < M; i++) {
    // quiet, then a gap, then quick, then a spike and back
    const rough = i < 20 ? 0.04 : i < 34 ? 0.22 : i < 46 ? 0.07 : 0.3;
    if (i === 20) v -= 0.3; // the gap: no prices in between
    if (i === 46) v += 0.32; // the spike
    if (i === 48) v -= 0.26;
    v = clamp(v + (r() - 0.5) * rough, 0.06, 0.94);
    out.push(v);
  }
  return out;
})();

const drawTwo: FigureDraw = ({ ctx, w, h, t, hover, mx, pal, still, enter }) => {
  if (w < 120 || h < 140) return;
  const pad = 20;
  const left = pad;
  const right = w - pad;
  const bandH = (h - 78) / 2;
  const top1 = 28;
  const top2 = top1 + bandH + 34;
  const xOf = (i: number) => lerp(left, right, i / (M - 1));

  // both paths draw themselves in, then a reading line sweeps (or follows the pointer)
  const drawn = still ? 1 : clamp(enter * 1.2);
  const sweep = still ? 0.62 : hover > 0.02 ? lerp(((t * 0.11) % 1.15), clamp((mx - left) / (right - left)), smooth(hover)) : (t * 0.11) % 1.15;
  const at = clamp(sweep) * (M - 1);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const band = (top: number, data: number[], label: string, colour: typeof pal.accent, gapAt: number | null) => {
    const yOf = (v: number) => lerp(top + bandH, top, v);
    ctx.beginPath();
    ctx.moveTo(left, top + bandH);
    ctx.lineTo(right, top + bandH);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.line, 1);
    ctx.stroke();

    const upto = Math.floor(drawn * (M - 1));
    ctx.beginPath();
    for (let i = 0; i <= upto; i++) {
      const px = xOf(i);
      const py = yOf(data[i]);
      // across a gap the line is lifted: nothing traded in between
      if (i === 0 || i === gapAt) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(colour, 0.95);
    ctx.stroke();

    if (gapAt !== null && upto >= gapAt) {
      // the gap itself, marked as an absence
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(xOf(gapAt - 1), yOf(data[gapAt - 1]));
      ctx.lineTo(xOf(gapAt), yOf(data[gapAt]));
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(pal.ink3, 0.8);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.font = `600 10px ${pal.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = rgba(pal.ink3, 0.95);
    ctx.fillText(label, left, top - 12);

    // the reading point on this path
    const i = Math.floor(at);
    const f = at - i;
    const j = Math.min(M - 1, i + 1);
    const jump = gapAt !== null && j === gapAt;
    const py = jump ? yOf(data[f < 0.5 ? i : j]) : lerp(yOf(data[i]), yOf(data[j]), f);
    const px = lerp(xOf(i), xOf(j), f);
    if (drawn >= 1) {
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, TAU);
      ctx.fillStyle = rgba(colour, 1);
      ctx.fill();
    }
  };

  band(top1, EVEN, "THE DESK: EVEN STEPS", pal.accent, null);
  band(top2, WILD, "A REAL MARKET CAN: PAUSE, GAP, SPIKE", pal.gold, 20);

  if (drawn >= 1) {
    const x = lerp(left, right, clamp(sweep));
    ctx.beginPath();
    ctx.moveTo(x, top1 - 2);
    ctx.lineTo(x, top2 + bandH + 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.35);
    ctx.stroke();
  }

  ctx.font = `500 11px ${pal.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(pal.ink2, 0.95);
  ctx.fillText("Shapes only: neither line is a price", left, h - 12);
};

export function TwoMarkets() {
  return <Figure draw={drawTwo} ratio={1.15} />;
}
