"use client";

import { useMemo } from "react";
import { clamp, lerp, rgba, smooth } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { between, clean, disc, hash, label, names, seg, textSize, timeline, unit, type Spec } from "./kit";

/**
 * A price line moving over time. The line draws itself from left to right; the
 * rest of it waits, faint, ahead of the point. The lesson's marks appear in
 * order as the line reaches the places they name: a peak, a trough, the start,
 * the end, the two sides of a gap, a neckline ruled across. A mark that names
 * a move rather than a place (a bounce, a pullback) lights the leg it names.
 *
 * The value is how far along the line has been drawn. No scale is shown: the
 * shape is the lesson, not a market.
 */

type Shape = Spec<"path">["shape"] | "shoulders";
type Feature = "start" | "end" | "high" | "low" | "mid" | "gap" | "neck";
/** where the line turns: [how far along, how high (0 to 1), what kind of place it is] */
type Knot = readonly [number, number, Feature];

const SHAPES: Record<Shape, { knots: Knot[]; rough: number; breakAt?: number }> = {
  up: { knots: [[0, 0.14, "start"], [0.5, 0.5, "mid"], [1, 0.86, "end"]], rough: 0.06 },
  down: { knots: [[0, 0.86, "start"], [0.5, 0.5, "mid"], [1, 0.14, "end"]], rough: 0.06 },
  flat: { knots: [[0, 0.5, "start"], [0.5, 0.52, "mid"], [1, 0.5, "end"]], rough: 0.05 },
  volatile: { knots: [[0, 0.5, "start"], [0.22, 0.53, "mid"], [0.32, 0.86, "high"], [0.44, 0.2, "low"], [0.56, 0.9, "high"], [0.68, 0.3, "low"], [0.8, 0.76, "high"], [0.9, 0.3, "low"], [1, 0.52, "end"]], rough: 0.03 },
  "up-then-down": { knots: [[0, 0.14, "start"], [0.5, 0.86, "high"], [1, 0.2, "end"]], rough: 0.06 },
  "down-then-up": { knots: [[0, 0.86, "start"], [0.5, 0.14, "low"], [1, 0.8, "end"]], rough: 0.06 },
  "zigzag-up": { knots: [[0, 0.1, "start"], [0.2, 0.44, "high"], [0.35, 0.28, "low"], [0.57, 0.68, "high"], [0.72, 0.5, "low"], [1, 0.9, "end"]], rough: 0.022 },
  "zigzag-down": { knots: [[0, 0.9, "start"], [0.2, 0.56, "low"], [0.35, 0.72, "high"], [0.57, 0.32, "low"], [0.72, 0.5, "high"], [1, 0.1, "end"]], rough: 0.022 },
  gap: { knots: [[0, 0.22, "start"], [0.47, 0.36, "gap"], [0.53, 0.68, "gap"], [1, 0.8, "end"]], rough: 0.05, breakAt: 1 },
  "double-top": { knots: [[0, 0.1, "start"], [0.26, 0.82, "high"], [0.5, 0.44, "neck"], [0.74, 0.82, "high"], [1, 0.1, "end"]], rough: 0.03 },
  "double-bottom": { knots: [[0, 0.9, "start"], [0.26, 0.18, "low"], [0.5, 0.56, "neck"], [0.74, 0.18, "low"], [1, 0.9, "end"]], rough: 0.03 },
  // an up-then-down whose marks name shoulders: a lower peak either side of the high
  shoulders: { knots: [[0, 0.08, "start"], [0.2, 0.58, "high"], [0.34, 0.34, "neck"], [0.5, 0.9, "high"], [0.66, 0.34, "neck"], [0.8, 0.58, "high"], [1, 0.06, "end"]], rough: 0.022 },
};

const N = 120;
const X0 = 0.07;
const X1 = 0.93;

/** which kind of place a mark's own words point to, if they say; `leg` when they name the move into it */
function wants(mark: string): { kind: Feature; leg: boolean } | null {
  const m = mark.toLowerCase();
  if (/neckline/.test(m)) return { kind: "neck", leg: false };
  if (/bounce|rally|rebound|recover|reversal|relief/.test(m)) return { kind: "high", leg: true };
  if (/pullback|retrace|correction|\bdip\b/.test(m)) return { kind: "low", leg: true };
  if (/\b(highs?|peaks?|tops?|resistance|overbought|head|shoulders?|ceiling)\b/.test(m)) return { kind: "high", leg: false };
  if (/\b(lows?|troughs?|bottoms?|support|oversold|floor|stops?|triggered)\b/.test(m)) return { kind: "low", leg: false };
  if (/release|news|announce|event|\bdata\b/.test(m)) return { kind: "mid", leg: false };
  if (/start|entry|enter|before|begin|\bopen/.test(m)) return { kind: "start", leg: false };
  if (/\bend|exit|after|\bclose|now|target|settle|expir/.test(m)) return { kind: "end", leg: false };
  return null;
}

type Placed = { text: string; u: number; y: number; above: boolean; from: number; leg: boolean; neck: boolean };

function build(shape: Shape, marks: string[]) {
  const def = SHAPES[shape] ?? SHAPES.up;
  const knots = def.knots;
  const ys = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    let j = 0;
    while (j < knots.length - 2 && u > knots[j + 1][0]) j++;
    const a = knots[j];
    const b = knots[j + 1];
    const p = clamp((u - a[0]) / (b[0] - a[0] || 1));
    // a jagged line between the turns; it is exact at each turn, so the marks sit on it
    const rough = def.rough * Math.sin(Math.PI * p) * (hash(i, 3) - 0.5 + 0.8 * (hash(Math.floor(i / 4), 7) - 0.5));
    ys[i] = def.breakAt === j ? (p < 0.5 ? a[1] : b[1]) : lerp(a[1], b[1], smooth(p)) + rough;
  }

  const free = knots.map((_, i) => i);
  const placed: Placed[] = [];
  const pending: string[] = [];
  let lastU = -1;
  const take = (text: string, i: number, leg: boolean) => {
    free.splice(free.indexOf(i), 1);
    const kn = knots[i];
    const prev = knots[Math.max(0, i - 1)];
    const next = knots[Math.min(knots.length - 1, i + 1)];
    const above = kn[2] === "high" ? true : kn[2] === "low" ? false : kn[1] >= (prev[1] + next[1]) / 2;
    placed.push({ text, u: kn[0], y: kn[1], above, from: prev[0], leg: leg && i > 0, neck: kn[2] === "neck" });
    lastU = kn[0];
  };
  for (const text of marks) {
    // on a gap, the marks name its two sides first, in the order given
    const side = def.breakAt !== undefined ? free.find((i) => knots[i][2] === "gap") : undefined;
    if (side !== undefined) {
      take(text, side, false);
      continue;
    }
    // otherwise each mark takes the first free place its words point to, after the mark before it where it can
    const want = wants(text);
    const fitting = want ? free.filter((i) => knots[i][2] === want.kind) : [];
    const at = fitting.find((i) => knots[i][0] >= lastU) ?? fitting[0];
    if (want && at !== undefined) take(text, at, want.leg);
    else pending.push(text);
  }
  // marks that do not say where they belong are spread, in order, over the places left
  let pool = [...free];
  if (knots.length >= 5 && pending.length < pool.length && pool[0] === 0) pool = pool.slice(1);
  pending.forEach((text, j) => {
    const pick = pending.length === 1 ? pool[Math.floor((pool.length - 1) / 2)] : pool[Math.round((j * (pool.length - 1)) / (pending.length - 1))];
    if (pick !== undefined && free.includes(pick)) take(text, pick, false);
    else if (free.length) take(text, free[0], false);
  });
  placed.sort((a, b) => a.u - b.u);
  const gapAt = def.breakAt !== undefined ? (knots[def.breakAt][0] + knots[def.breakAt + 1][0]) / 2 : null;
  return { ys, placed, gapAt, startsHigh: knots[0][1] > 0.6 };
}

export function Path({ spec }: { spec: Spec<"path"> }) {
  const title = clean(Array.isArray(spec.labels) ? spec.labels[0] : "");
  // marks named in `marks`; a lesson that put them after the caption in `labels` is read the same way
  const marks = useMemo(() => {
    const named = names(spec.marks, 0, 5, []);
    return named.length ? named : names(Array.isArray(spec.labels) ? spec.labels.slice(1) : [], 0, 5, []);
  }, [spec.marks, spec.labels]);
  const shape: Shape = spec.shape === "up-then-down" && marks.some((m) => /shoulder/i.test(m)) ? "shoulders" : spec.shape;
  const { ys, placed, gapAt, startsHigh } = useMemo(() => build(shape, marks), [shape, marks]);

  const draw: DiagramDraw = ({ ctx, w, h, t, pal, still }, v) => {
    const k = unit(w);
    const x0 = w * X0;
    const x1 = w * X1;
    const top = h * 0.2;
    const bottom = h * 0.82;
    const X = (u: number) => lerp(x0, x1, u);
    const Y = (y: number) => lerp(bottom, top, y);
    const size = textSize(w);
    const at = clamp(v) * N;
    const whole = Math.min(N, Math.floor(at));
    const jump = (i: number) => gapAt !== null && i > 0 && i <= N && Math.abs(ys[i] - ys[i - 1]) > 0.2;
    const hy = whole >= N ? ys[N] : jump(whole + 1) ? ys[whole] : lerp(ys[whole], ys[whole + 1], at - whole);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // the floor of the chart and its left edge: no scale, only a frame
    ctx.strokeStyle = rgba(pal.ink3, 0.4);
    ctx.lineWidth = 1;
    seg(ctx, x0, h * 0.92, x1, h * 0.92);
    seg(ctx, x0, h * 0.08, x0, h * 0.92);

    // the whole line, faint: where the drawing is going
    ctx.strokeStyle = rgba(pal.ink, 0.16);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      if (i === 0 || jump(i)) ctx.moveTo(X(i / N), Y(ys[i]));
      else ctx.lineTo(X(i / N), Y(ys[i]));
    }
    ctx.stroke();

    // the part drawn so far (from one place to another, so a leg can be drawn again in the accent)
    const trace = (fromU: number, toU: number) => {
      const a = Math.ceil(fromU * N - 1e-6);
      const b = Math.min(whole, Math.floor(toU * N + 1e-6));
      if (b < a) return;
      ctx.beginPath();
      for (let i = a; i <= b; i++) {
        if (i === a || jump(i)) ctx.moveTo(X(i / N), Y(ys[i]));
        else ctx.lineTo(X(i / N), Y(ys[i]));
      }
      if (b === whole && whole < N && toU * N > whole && !jump(whole + 1)) ctx.lineTo(X(at / N), Y(hy));
      ctx.stroke();
    };
    ctx.strokeStyle = rgba(pal.ink, 0.92);
    ctx.lineWidth = 2;
    trace(0, 1);

    // a gap: the two prices either side of it, joined by a dashed measure
    if (gapAt !== null && v > gapAt - 0.04) {
      const i = Math.round(gapAt * N);
      const gx = X(gapAt);
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(pal.accent, between(v, gapAt - 0.04, gapAt + 0.04));
      ctx.lineWidth = 1.5;
      seg(ctx, gx, Y(ys[Math.max(0, i - 4)]), gx, Y(ys[Math.min(N, i + 4)]));
      ctx.setLineDash([]);
    }

    // the marks, each appearing as the line reaches it
    for (let m = 0; m < placed.length; m++) {
      const p = placed[m];
      const a = between(v, p.u - 0.03, p.u + 0.02);
      if (p.leg && v > p.from) {
        // the move the mark names
        ctx.strokeStyle = rgba(pal.accent, 1);
        ctx.lineWidth = 3.25;
        trace(p.from, p.u);
      }
      if (a <= 0.01) continue;
      const x = X(p.u);
      const y = Y(p.y);
      if (p.neck) {
        // a level ruled across the chart through this turn
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = rgba(pal.accent, 0.95 * a);
        ctx.lineWidth = 1.5;
        seg(ctx, X(Math.max(0.02, p.from - 0.16)), y, X(0.98), y);
        ctx.setLineDash([]);
      }
      const dy = (p.above ? -1 : 1) * (22 * k + 4);
      ctx.strokeStyle = rgba(pal.accent, 0.7 * a);
      ctx.lineWidth = 1;
      seg(ctx, x, y + Math.sign(dy) * 7, x, y + dy - Math.sign(dy) * 9);
      disc(ctx, x, y, 3 + 2.5 * a, rgba(pal.surface, a), rgba(pal.accent, a), 2);
      label(ctx, pal, p.text, x, y + dy, { size, weight: 600, alpha: a, tag: true, colour: pal.ink, maxW: w * 0.3, within: w });
    }

    // the point that draws the line, and the level it is at now
    const px = X(at / N);
    const py = Y(hy);
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = rgba(pal.accent, 0.5);
    ctx.lineWidth = 1;
    seg(ctx, px, py, x1, py);
    ctx.setLineDash([]);
    if (!still) {
      const pulse = (t * 0.8) % 1;
      ctx.beginPath();
      ctx.arc(px, py, 5 + 8 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(pal.accent, 0.45 * (1 - pulse));
      ctx.stroke();
    }
    disc(ctx, px, py, 4.5 * k, rgba(pal.gold, 1), rgba(pal.ink, 0.9));

    // what the line is, in the corner the line leaves free
    label(ctx, pal, title, x0 + 8, startsHigh ? h * 0.92 - 11 : h * 0.08 + 9, { align: "left", size: size - 1, weight: 600, colour: pal.ink3, maxW: w * 0.4 });
  };

  const describe = (v: number) => {
    const reached = placed.filter((p) => v >= p.u - 0.01);
    if (reached.length) return `Reached: ${reached[reached.length - 1].text}`;
    if (placed.length) return `Not yet at the first mark: ${placed[0].text}`;
    const i = Math.round(clamp(v, 0.05, 0.95) * N);
    const slope = ys[Math.min(N, i + 5)] - ys[Math.max(0, i - 5)];
    return slope > 0.035 ? "The line is rising" : slope < -0.035 ? "The line is falling" : "The line is moving sideways";
  };

  return <DiagramShell ratio={1.85} draw={draw} auto={(t) => timeline(t, 6.5, 2.6)} rest={1} control="Move along the line" fromPointer={(fx) => clamp((fx - X0) / (X1 - X0))} describe={describe} />;
}
