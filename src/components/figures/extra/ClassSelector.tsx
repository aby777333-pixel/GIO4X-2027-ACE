"use client";

import { useMemo } from "react";
import { Figure, STILL_T, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";

/**
 * 777 Raptor, "The asset classes GIO4X lists.": one workspace, several
 * markets, as a rotary selector. A single knob stands under a fan of detents,
 * one for each asset class in the list beside it, named as the list names
 * them. The arm steps from one detent to the next, rests, and steps on; the
 * detent it rests on is lit. Nothing is switched on or off by it and no
 * position says anything about what Raptor offers within a class.
 *
 * Pointer: the arm turns to the detent nearest the pointer.
 */

function makeDraw(names: string[]): FigureDraw {
  const n = Math.max(1, names.length);
  const angle = (i: number) => Math.PI + ((i + 0.5) / n) * Math.PI;
  // out along the fan and back again, so the arm never has to sweep the whole way round
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push(i);
  for (let i = n - 2; i > 0; i--) order.push(i);

  return ({ ctx, w, h, t, hover, mx, my, pal, still }) => {
    if (w < 200 || h < 80) return;
    const on = smooth(hover);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const cx = w / 2;
    const cy = h * 0.84;
    const R = Math.min(h * 0.56, w * 0.27);

    const beat = t * 0.42;
    const k = Math.floor(beat) % order.length;
    const frac = still && t === STILL_T ? 1 : beat - Math.floor(beat);
    const from = order[(k + order.length - 1) % order.length];
    const to = order[k];
    let theta = lerp(angle(from), angle(to), smooth(frac / 0.34));
    let pick = to;
    if (on > 0.02) {
      const a = Math.atan2(my - cy, mx - cx);
      const up = a > 0 ? (mx < cx ? Math.PI : TAU) : a + TAU;
      pick = clamp(Math.floor(((up - Math.PI) / Math.PI) * n), 0, n - 1);
      theta = lerp(theta, angle(pick), on);
    }

    // the plate and its track
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.line, 1);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.0, Math.PI, TAU);
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.ink3, 0.35);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.62, Math.PI, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - R * 1.12, cy + 0.5);
    ctx.lineTo(cx + R * 1.12, cy + 0.5);
    ctx.stroke();

    // the detents and their names
    for (let i = 0; i < n; i++) {
      const a = angle(i);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const lit = clamp(1 - Math.abs(theta - a) / (Math.PI / n / 1.4));
      ctx.strokeStyle = rgba(pal.ink2, 0.7);
      ctx.beginPath();
      ctx.moveTo(cx + ca * (R - 5), cy + sa * (R - 5));
      ctx.lineTo(cx + ca * (R + 5), cy + sa * (R + 5));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + ca * R, cy + sa * R, 3 + lit * 1.5, 0, TAU);
      ctx.fillStyle = rgba(pal.surface, 1);
      ctx.fill();
      ctx.fillStyle = rgba(pal.gold, lit);
      ctx.fill();
      ctx.strokeStyle = lit > 0.5 ? rgba(pal.gold, 1) : rgba(pal.ink3, 0.9);
      ctx.stroke();
      ctx.font = `600 9.5px ${pal.font}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = Math.abs(ca) < 0.25 ? "center" : ca < 0 ? "right" : "left";
      ctx.fillStyle = lit > 0.5 ? rgba(pal.ink, 1) : rgba(pal.ink3, 1);
      const lr = R + 13;
      ctx.fillText((names[i] ?? "").toUpperCase(), cx + ca * lr, cy + sa * lr - (Math.abs(ca) < 0.25 ? 4 : 0));
    }

    // the arm and the knob
    const ca = Math.cos(theta);
    const sa = Math.sin(theta);
    ctx.strokeStyle = rgba(pal.accent, 0.95);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + ca * R * 0.2, cy + sa * R * 0.2);
    ctx.lineTo(cx + ca * (R - 9), cy + sa * (R - 9));
    ctx.stroke();
    const kr = R * 0.2;
    ctx.beginPath();
    ctx.arc(cx, cy, kr, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = rgba(pal.ink, 0.85);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.8);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = theta + (i / 12) * TAU;
      ctx.moveTo(cx + Math.cos(a) * kr * 0.62, cy + Math.sin(a) * kr * 0.62);
      ctx.lineTo(cx + Math.cos(a) * kr * 0.86, cy + Math.sin(a) * kr * 0.86);
    }
    ctx.stroke();
  };
}

export function ClassSelector({ names, ratio = 2.5 }: { names: string[]; ratio?: number }) {
  const key = names.join("|");
  // the names are the page's own list: redraw only if the list itself changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draw = useMemo(() => makeDraw(names), [key]);
  return <Figure draw={draw} ratio={ratio} />;
}
