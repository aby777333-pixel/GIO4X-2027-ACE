"use client";

import { useMemo } from "react";
import { clamp, lerp, rgba, smooth } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { approach, disc, flare, head, label, names, seg, textSize, timeline, unit, type Spec } from "./kit";

/**
 * Two lines and how they meet. Both are drawn from left to right together.
 * The first line is the thick one with the solid point; the second is thinner,
 * with a hollow point. The space between them is shaded and measured at the
 * points, so that a gap opening, closing or holding can be seen; where the
 * lines cross, the crossing is ringed and stays marked.
 *
 * The value is how far along the lines have been drawn.
 */

type Relation = Spec<"lines">["relation"];

const N = 100;
const X0 = 0.07;
const X1 = 0.9;

function build(relation: Relation) {
  const a = new Float32Array(N + 1);
  const b = new Float32Array(N + 1);
  let cross = -1;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const wave = 0.035 * Math.sin(u * 7 + 0.6) + 0.02 * Math.sin(u * 15);
    let mid = 0.5;
    let d = 0.2;
    if (relation === "cross-up") {
      mid = 0.4 + 0.2 * u;
      d = lerp(-0.2, 0.26, smooth(u * 1.05));
    } else if (relation === "cross-down") {
      mid = 0.6 - 0.2 * u;
      d = lerp(0.2, -0.26, smooth(u * 1.05));
    } else if (relation === "diverge") {
      mid = 0.5;
      d = 0.02 + 0.5 * u * u;
    } else if (relation === "converge") {
      mid = 0.5;
      d = 0.02 + 0.5 * (1 - u) * (1 - u);
    } else {
      mid = 0.34 + 0.34 * u;
      d = 0.2;
    }
    // the first line is the livelier of the two
    a[i] = mid + d / 2 + wave;
    b[i] = mid - d / 2 + wave * 0.35;
    if (cross < 0 && i > 0 && (a[i] - b[i]) * (a[i - 1] - b[i - 1]) <= 0) cross = i;
  }
  return { a, b, cross };
}

export function Lines({ spec }: { spec: Spec<"lines"> }) {
  const [first, second] = names(spec.labels, 2, 2, ["First line", "Second line"]);
  const relation: Relation = ["cross-up", "cross-down", "diverge", "converge", "parallel"].includes(spec.relation) ? spec.relation : "parallel";
  const { a, b, cross } = useMemo(() => build(relation), [relation]);
  const crossU = cross < 0 ? 2 : (cross - 0.5) / N;
  // the names stand at the end where the lines are furthest apart
  const namesAtEnd = relation === "diverge" || relation === "parallel";

  const draw: DiagramDraw = ({ ctx, w, h, dt, pal, still }, v, mem) => {
    const k = unit(w);
    const x0 = w * X0;
    const x1 = w * X1;
    const X = (u: number) => lerp(x0, x1, u);
    const Y = (p: number) => lerp(h * 0.86, h * 0.14, p);
    const size = textSize(w);
    const at = clamp(v) * N;
    const whole = Math.min(N, Math.floor(at));
    const frac = at - whole;
    const ha = whole >= N ? a[N] : lerp(a[whole], a[whole + 1], frac);
    const hb = whole >= N ? b[N] : lerp(b[whole], b[whole + 1], frac);
    const crossed = v >= crossU;
    mem.on = still || mem.on === undefined ? (crossed ? 1 : 0) : approach(mem.on, crossed ? 1 : 0, dt, 8);
    if (!still && crossed && !mem.was) mem.ring = 0.001;
    mem.was = crossed ? 1 : 0;
    if (mem.ring) mem.ring = mem.ring >= 1 ? 0 : mem.ring + dt * 1.1;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = rgba(pal.ink3, 0.4);
    ctx.lineWidth = 1;
    seg(ctx, x0, h * 0.93, w * 0.94, h * 0.93);

    // both lines to come, faint
    ctx.strokeStyle = rgba(pal.ink, 0.14);
    ctx.lineWidth = 1.25;
    for (const s of [a, b]) {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        if (i) ctx.lineTo(X(i / N), Y(s[i]));
        else ctx.moveTo(X(0), Y(s[0]));
      }
      ctx.stroke();
    }

    // the space between them so far
    ctx.beginPath();
    ctx.moveTo(X(0), Y(a[0]));
    for (let i = 1; i <= whole; i++) ctx.lineTo(X(i / N), Y(a[i]));
    ctx.lineTo(X(at / N), Y(ha));
    ctx.lineTo(X(at / N), Y(hb));
    for (let i = whole; i >= 0; i--) ctx.lineTo(X(i / N), Y(b[i]));
    ctx.closePath();
    ctx.fillStyle = rgba(pal.accent, 0.09);
    ctx.fill();

    const trace = (s: Float32Array, end: number) => {
      ctx.beginPath();
      ctx.moveTo(X(0), Y(s[0]));
      for (let i = 1; i <= whole; i++) ctx.lineTo(X(i / N), Y(s[i]));
      ctx.lineTo(X(at / N), Y(end));
      ctx.stroke();
    };
    ctx.strokeStyle = rgba(pal.ink, 0.75);
    ctx.lineWidth = 1.5;
    trace(b, hb);
    ctx.strokeStyle = rgba(pal.accent, 1);
    ctx.lineWidth = 2.75;
    trace(a, ha);

    // the crossing
    if (cross >= 0) {
      const cx = X(crossU);
      const cy = Y((a[cross] + b[cross] + a[cross - 1] + b[cross - 1]) / 4);
      if (mem.on > 0.01) disc(ctx, cx, cy, 7, rgba(pal.gold, 0.25 * mem.on), rgba(pal.gold, mem.on), 2);
      if (mem.ring) flare(ctx, cx, cy, mem.ring, pal.gold, 28 * k);
    }

    // the distance between the two points
    const px = X(at / N);
    const ya = Y(ha);
    const yb = Y(hb);
    if (Math.abs(ya - yb) > 22) {
      const dir = ya < yb ? 1 : -1;
      ctx.strokeStyle = rgba(pal.ink2, 0.9);
      ctx.lineWidth = 1.25;
      seg(ctx, px + 11, ya + dir * 5, px + 11, yb - dir * 5);
      head(ctx, px + 11, ya + dir * 5, dir > 0 ? -Math.PI / 2 : Math.PI / 2, 4.5);
      head(ctx, px + 11, yb - dir * 5, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 4.5);
    }
    disc(ctx, px, yb, 4.5 * k, rgba(pal.surface, 1), rgba(pal.ink, 0.85), 1.75);
    disc(ctx, px, ya, 4.5 * k, rgba(pal.accent, 1), rgba(pal.ink, 0.9));

    // which is which
    const ei = namesAtEnd ? N : 0;
    const lx = namesAtEnd ? w * 0.94 : x0;
    const firstAbove = a[ei] >= b[ei];
    const shown = namesAtEnd ? clamp((v - 0.5) / 0.3) * 0.5 + 0.5 : 1;
    const gapPx = Math.abs(Y(a[ei]) - Y(b[ei]));
    const lift = Math.max(13 * k + 4, (size + 10 - gapPx) / 2 + 13 * k + 4);
    label(ctx, pal, first, lx, Y(a[ei]) + (firstAbove ? -lift : lift), { align: namesAtEnd ? "right" : "left", size, weight: 700, colour: pal.accent, alpha: shown, maxW: w * 0.44 });
    label(ctx, pal, second, lx, Y(b[ei]) + (firstAbove ? lift : -lift), { align: namesAtEnd ? "right" : "left", size, weight: 600, colour: pal.ink2, alpha: shown, maxW: w * 0.44 });
  };

  const describe = (v: number) => {
    if (relation === "cross-up") return v >= crossU ? `${first} has crossed above ${second}` : `${first} is below ${second}`;
    if (relation === "cross-down") return v >= crossU ? `${first} has crossed below ${second}` : `${first} is above ${second}`;
    if (relation === "diverge") return v < 0.25 ? `${first} and ${second} begin together` : `${first} and ${second} are drawing apart`;
    if (relation === "converge") return v > 0.85 ? `${first} and ${second} have come together` : `${first} and ${second} are closing in on each other`;
    return `${first} and ${second} move together, the same distance apart`;
  };

  return <DiagramShell ratio={2} draw={draw} auto={(t) => timeline(t, 6.5, 2.6)} rest={1} control="Move along the lines" fromPointer={(fx) => clamp((fx - X0) / (X1 - X0))} describe={describe} />;
}
