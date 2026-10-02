"use client";

import { useMemo } from "react";
import { clamp, lerp, rgba, smooth } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { approach, between, disc, flare, hash, label, names, seg, textSize, timeline, unit, type Spec } from "./kit";

/**
 * A line moving between an upper and a lower boundary. It runs up to one,
 * turns, runs down to the other, and each touch is marked. Where the lesson
 * says the line breaks out, the last run does not turn: it goes through the
 * boundary, the crossing is ringed and the boundary it broke is named in full.
 *
 * A boundary whose name says it rises or falls is drawn sloping, so a band
 * can be a channel, a range or a triangle.
 *
 * The value is how far along the line has been drawn.
 */

type Breaks = "up" | "down" | "none";

/** where the line turns, in the band's own measure: 0 is the lower boundary, 1 the upper */
const TURNS: Record<Breaks, readonly (readonly [number, number])[]> = {
  none: [[0, 0.5], [0.14, 0.97], [0.32, 0.04], [0.5, 0.96], [0.68, 0.05], [0.86, 0.95], [1, 0.56]],
  up: [[0, 0.42], [0.15, 0.96], [0.33, 0.05], [0.5, 0.96], [0.66, 0.22], [1, 1.46]],
  down: [[0, 0.58], [0.15, 0.04], [0.33, 0.95], [0.5, 0.04], [0.66, 0.78], [1, -0.46]],
};

const N = 120;
const X0 = 0.07;
const X1 = 0.93;

function build(breaks: Breaks) {
  const turns = TURNS[breaks];
  const ys = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    let j = 0;
    while (j < turns.length - 2 && u > turns[j + 1][0]) j++;
    const p = clamp((u - turns[j][0]) / (turns[j + 1][0] - turns[j][0]));
    ys[i] = lerp(turns[j][1], turns[j + 1][1], smooth(p)) + 0.045 * Math.sin(Math.PI * p) * (hash(i, 11) - 0.5);
  }
  // the moment it leaves the band, if it does
  let out = -1;
  if (breaks !== "none") {
    for (let i = Math.round(N * 0.66); i <= N && out < 0; i++) if (breaks === "up" ? ys[i] > 1 : ys[i] < 0) out = i;
  }
  const touches = turns.slice(1, -1).filter(([, y]) => y > 0.9 || y < 0.1);
  return { ys, out, touches };
}

/** a boundary that is named as rising or falling slopes that way: how far it has moved by the right-hand edge, in band heights */
const slope = (name: string) => (/rising|ascending|higher/i.test(name) ? 0.45 : /falling|descending|lower (high|low)/i.test(name) ? -0.45 : 0);

export function Band({ spec }: { spec: Spec<"band"> }) {
  const [upper, lower] = names(spec.labels, 2, 2, ["Upper boundary", "Lower boundary"]);
  const breaks: Breaks = spec.breaks === "up" || spec.breaks === "down" ? spec.breaks : "none";
  const { ys, out, touches } = useMemo(() => build(breaks), [breaks]);
  const outU = out < 0 ? 2 : out / N;
  const upSlope = slope(upper);
  const lowSlope = slope(lower);

  const draw: DiagramDraw = ({ ctx, w, h, dt, pal, still }, v, mem) => {
    const k = unit(w);
    const x0 = w * X0;
    const x1 = w * X1;
    const H = h * 0.4;
    // both slopes are taken about the middle of the frame, so a sloping band stays inside it
    const shift = ((upSlope + lowSlope) / 4) * H;
    const yUp = (u: number) => h * 0.3 + shift - upSlope * H * u;
    const yLow = (u: number) => h * 0.7 + shift - lowSlope * H * u;
    const X = (u: number) => lerp(x0, x1, u);
    const Y = (b: number, u: number) => clamp(b > 1 ? yUp(u) - (b - 1) * H : b < 0 ? yLow(u) - b * H : lerp(yLow(u), yUp(u), b), h * 0.05, h * 0.95);
    const size = textSize(w);
    const at = clamp(v) * N;
    const whole = Math.min(N, Math.floor(at));
    const hb = whole >= N ? ys[N] : lerp(ys[whole], ys[whole + 1], at - whole);
    const broken = v >= outU;
    mem.lit = still || mem.lit === undefined ? (broken ? 1 : 0) : approach(mem.lit, broken ? 1 : 0, dt, 7);
    // a ring leaves the crossing each time it is passed
    if (!still && broken && !mem.was) mem.ring = 0.001;
    mem.was = broken ? 1 : 0;
    if (mem.ring) mem.ring = mem.ring >= 1 ? 0 : mem.ring + dt * 1.2;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // the band
    ctx.beginPath();
    ctx.moveTo(x0, yUp(0));
    ctx.lineTo(x1, yUp(1));
    ctx.lineTo(x1, yLow(1));
    ctx.lineTo(x0, yLow(0));
    ctx.closePath();
    ctx.fillStyle = rgba(pal.accent, 0.06);
    ctx.fill();
    const edge = (y: (u: number) => number, name: string, isBroken: boolean, above: boolean) => {
      const lit = isBroken ? mem.lit : 0;
      ctx.strokeStyle = rgba(isBroken && lit > 0.5 ? pal.gold : pal.ink, 0.75);
      ctx.lineWidth = 1.5 + lit;
      seg(ctx, x0, y(0), x1, y(1));
      label(ctx, pal, name, x0, y(0) + (above ? -1 : 1) * (11 * k + 5), { align: "left", size, weight: lit > 0.5 ? 700 : 600, colour: lit > 0.5 ? pal.ink : pal.ink2, maxW: w * 0.5 });
    };
    edge(yUp, upper, breaks === "up", true);
    edge(yLow, lower, breaks === "down", false);

    // the line still to come, faint
    ctx.strokeStyle = rgba(pal.ink, 0.16);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      if (i) ctx.lineTo(X(i / N), Y(ys[i], i / N));
      else ctx.moveTo(X(0), Y(ys[0], 0));
    }
    ctx.stroke();

    // the line so far: inside the band, then (if it leaves) outside it
    const stroke = (from: number, to: number, colour: string, width: number) => {
      if (to <= from) return;
      const end = Math.min(Math.floor(to), N);
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(X(from / N), Y(ys[from], from / N));
      for (let i = from + 1; i <= end; i++) ctx.lineTo(X(i / N), Y(ys[i], i / N));
      if (end < N && to > end) ctx.lineTo(X(to / N), Y(lerp(ys[end], ys[end + 1], to - end), to / N));
      ctx.stroke();
    };
    stroke(0, broken ? out : at, rgba(pal.ink, 0.92), 2);
    if (broken) stroke(out, at, rgba(pal.gold, 1), 2.75);

    // each touch of a boundary, as the line reaches it
    for (const [u, b] of touches) {
      const a = between(v, u - 0.02, u + 0.02);
      if (a > 0.01) disc(ctx, X(u), b > 0.5 ? yUp(u) : yLow(u), 2.5 + 2 * a, rgba(pal.surface, a), rgba(pal.accent, a), 1.75);
    }

    // the break
    if (out >= 0) {
      const bx = X(outU);
      const by = breaks === "up" ? yUp(outU) : yLow(outU);
      if (mem.lit > 0.01) disc(ctx, bx, by, 6, rgba(pal.gold, 0.25 * mem.lit), rgba(pal.gold, mem.lit), 2);
      if (mem.ring) flare(ctx, bx, by, mem.ring, pal.gold, 26 * k);
    }

    disc(ctx, X(at / N), Y(hb, at / N), 4.5 * k, rgba(pal.gold, 1), rgba(pal.ink, 0.9));
  };

  return (
    <DiagramShell
      ratio={1.9}
      draw={draw}
      auto={(t) => timeline(t, 7, 2.6)}
      rest={1}
      control="Move along the line"
      fromPointer={(fx) => clamp((fx - X0) / (X1 - X0))}
      describe={(v) => (v >= outU ? (breaks === "up" ? `Broken out above ${upper}` : `Broken out below ${lower}`) : `Moving between ${upper} and ${lower}`)}
    />
  );
}
