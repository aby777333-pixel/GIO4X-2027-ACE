"use client";

import { useMemo } from "react";
import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * "Two routes through the same material", for the learning paths on /academy.
 * The row of dots across the middle is the material: one dot for each lesson
 * that either path links to. The rail above is the first path and the rail
 * below is the second, each with its numbered steps, and a thread runs from
 * every step to the lessons it lists. A lesson both paths reach wears a second
 * ring. A step with no lesson published yet is drawn open, with no thread.
 *
 * The structure is the page's own: the figure is given the same steps and
 * lessons the cards beside it are built from. The only text drawn is the step
 * numbers the cards already show.
 *
 * On its own a marker walks each rail, pausing at every step while that step's
 * threads and lessons light. Pointer: the nearest step takes the marker and
 * the light, so any one step's lessons can be picked out.
 */

/** routes[path][step] = the lessons of that step, as positions in the middle row */
export type RouteMap = number[][][];

function makeDraw(routes: RouteMap, lessons: number): FigureDraw {
  const reach = routes.map((steps) => new Set(steps.flat()));
  const shared = Array.from({ length: lessons }, (_, l) => reach.filter((r) => r.has(l)).length > 1);
  // per frame: how lit each step is, and through it each lesson, for each route
  const stepLit = routes.map((steps) => new Float32Array(steps.length));
  const lessonLit = routes.map(() => new Float32Array(lessons));

  return (f) => {
    const { ctx, w, h, t, hover, mx, my, pal, still } = f;
    if (w < 160 || h < 110) return;
    const padX = 30;
    const railY = [30, h - 30];
    const midY = h / 2;
    const R = 9;
    const stationX = (r: number, i: number) => {
      const n = routes[r].length;
      return n > 1 ? lerp(padX, w - padX, i / (n - 1)) : w / 2;
    };
    const lessonX = (l: number) => (lessons > 1 ? lerp(padX + 4, w - padX - 4, l / (lessons - 1)) : w / 2);

    // the step nearest the pointer, on either rail
    let nearR = 0;
    let nearI = 0;
    let best = Infinity;
    for (let r = 0; r < routes.length && r < 2; r++) {
      for (let i = 0; i < routes[r].length; i++) {
        const d = Math.hypot(mx - stationX(r, i), (my - railY[r]) * 1.6);
        if (d < best) {
          best = d;
          nearR = r;
          nearI = i;
        }
      }
    }

    // where each marker is, and which steps are lit
    const markerX: number[] = [0, 0];
    const markerA: number[] = [1, 1];
    for (let r = 0; r < routes.length && r < 2; r++) {
      const n = routes[r].length;
      if (!n) continue;
      const u = still ? Math.min(r === 0 ? 1 : 2, n - 1) : t * (r === 0 ? 0.3 : 0.36) + r * 0.45;
      const at = Math.floor(u) % n;
      const next = (at + 1) % n;
      // rest at a step for the first part of each beat, then walk to the next
      const go = still ? 0 : smooth(clamp((u - Math.floor(u) - 0.55) / 0.45));
      const wrap = next === 0 && n > 1;
      let x = wrap ? stationX(r, at) : lerp(stationX(r, at), stationX(r, next), go);
      let alpha = wrap ? 1 - go : at === 0 && !still ? clamp((u - Math.floor(u)) / 0.2) : 1;
      const mine = r === nearR ? hover : 0;
      x = lerp(x, stationX(r, nearI), mine);
      alpha = lerp(alpha, 1, mine);
      markerX[r] = x;
      markerA[r] = alpha;
      for (let i = 0; i < n; i++) {
        const auto = i === at ? 1 - go : i === next && !wrap ? go : 0;
        stepLit[r][i] = lerp(auto, i === nearI ? 1 : 0, mine);
      }
      lessonLit[r].fill(0);
      for (let i = 0; i < n; i++) for (const l of routes[r][i]) lessonLit[r][l] = Math.max(lessonLit[r][l], stepLit[r][i]);
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const tone = (r: number) => (r === 0 ? pal.accent : pal.ink);

    // threads: from each step to its lessons
    for (let r = 0; r < routes.length && r < 2; r++) {
      const dir = r === 0 ? 1 : -1;
      for (let i = 0; i < routes[r].length; i++) {
        const lit = stepLit[r][i];
        const sx = stationX(r, i);
        const sy = railY[r] + dir * R;
        ctx.strokeStyle = rgba(tone(r), lerp(r === 0 ? 0.26 : 0.17, 0.95, lit));
        ctx.lineWidth = lerp(1, 1.9, lit);
        for (const l of routes[r][i]) {
          const lx = lessonX(l);
          const ly = midY - dir * 8;
          const bend = (ly - sy) * 0.55;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.bezierCurveTo(sx, sy + bend, lx, ly - bend, lx, ly);
          ctx.stroke();
        }
      }
    }

    // the material: one dot per lesson
    for (let l = 0; l < lessons; l++) {
      const x = lessonX(l);
      const a = lessonLit[0][l];
      const b = lessonLit[1][l];
      const on = Math.max(a, b);
      if (shared[l]) {
        ctx.beginPath();
        ctx.arc(x, midY, 8.5, 0, TAU);
        ctx.strokeStyle = rgba(pal.gold, lerp(0.75, 1, on));
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, midY, 4.6, 0, TAU);
      ctx.fillStyle = rgba(pal.surface, 1);
      ctx.fill();
      if (b > 0.01) {
        ctx.fillStyle = rgba(pal.ink, b * 0.85);
        ctx.fill();
      }
      if (a > 0.01) {
        ctx.fillStyle = rgba(pal.accent, a);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(pal.ink, lerp(0.6, 0.95, on));
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // the rails, their steps and the step numbers the cards show
    ctx.font = `600 10px ${pal.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let r = 0; r < routes.length && r < 2; r++) {
      const n = routes[r].length;
      if (!n) continue;
      ctx.strokeStyle = rgba(tone(r), r === 0 ? 0.7 : 0.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(stationX(r, 0), railY[r]);
      ctx.lineTo(stationX(r, n - 1), railY[r]);
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        const x = stationX(r, i);
        const lit = stepLit[r][i];
        const empty = routes[r][i].length === 0;
        ctx.beginPath();
        ctx.arc(x, railY[r], R, 0, TAU);
        ctx.fillStyle = rgba(pal.surface, 1);
        ctx.fill();
        ctx.fillStyle = rgba(tone(r), lit * (r === 0 ? 0.2 : 0.12));
        ctx.fill();
        if (empty) ctx.setLineDash([2.5, 3]);
        ctx.strokeStyle = rgba(tone(r), lerp(empty ? 0.55 : 0.75, 1, lit));
        ctx.lineWidth = lerp(1.3, 2, lit);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = rgba(pal.ink, empty ? 0.55 : 0.9);
        ctx.fillText(String(i + 1).padStart(2, "0"), x, railY[r] + 0.5);
      }
      // the marker: a ring that walks the rail
      ctx.beginPath();
      ctx.arc(markerX[r], railY[r], R + 4.5, 0, TAU);
      ctx.strokeStyle = rgba(pal.gold, markerA[r]);
      ctx.lineWidth = 1.75;
      ctx.stroke();
    }
  };
}

export function TwoRoutes({ routes, lessons }: { routes: RouteMap; lessons: number }) {
  const key = JSON.stringify([routes, lessons]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the content of the props
  const draw = useMemo(() => makeDraw(routes, lessons), [key]);
  return <Figure draw={draw} ratio={2.5} />;
}
