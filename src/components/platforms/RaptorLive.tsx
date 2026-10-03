"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { Figure, TAU, clamp, lerp, rgba, smooth, type Colour, type FigureDraw } from "@/components/figures/Figure";
import { seeded } from "@/components/labs/workshop/rng";
import type { RegionKey } from "@/data/platforms";
import { REGIONS, WORKSPACE } from "./RaptorWorkspace";

/**
 * THE LIVING WORKSPACE — the Raptor page's interface study, drawn on a canvas
 * so that it can move and answer the pointer.
 *
 * Nine areas of a trading workspace (their places are in RaptorWorkspace),
 * drawn under one rule: shapes stand in for figures. No price, quantity, balance or result is
 * ever written; the chart is a set of invented shapes, one per symbol, and
 * the symbols are instruments GIO4X lists. It is an illustration, never a
 * screenshot, and every use of it is captioned as that.
 *
 * What it does, by `mode`:
 *   see      the watchlist is live to the pointer: the row under it is chosen
 *            and the chart redraws itself as that symbol's shape; left alone,
 *            the rows are chosen in turn
 *   analyse  a crosshair follows the pointer over the chart, and a trend
 *            line and two levels draw themselves in and out
 *   act      the order ticket is filled in step by step: instrument,
 *            direction, size, stop, send; the pointer chooses the step
 *   manage   the pointer moves the margin gauge, and the positions are
 *            passed over one by one
 *   tour     nothing of its own: the page's buttons choose the `focus`
 *
 * `focus` dims every other area (eased), `ring` outlines the focused ones,
 * `view` crops the drawing to an area. The canvas is decoration for assistive
 * technology: the wrapper carries a description, and the text beside each use
 * says what the area is for.
 */

type Mode = "see" | "analyse" | "act" | "manage" | "tour";
type Box = { x: number; y: number; w: number; h: number };

const SYMBOLS = ["EUR/USD", "XAU/USD", "US500", "GBP/USD", "BTC/USD", "USD/JPY", "XBR/USD", "DE40", "AUD/USD", "XAG/USD", "US100"] as const;
const CLASSES = ["Forex", "Metals", "Indices", "Energy", "Equities", "Crypto"] as const;
/** which class row each symbol belongs to */
const CLASS_OF = [0, 1, 2, 0, 5, 0, 3, 2, 0, 1, 2] as const;
const N = 34;
const DOWN: Colour = [214, 96, 88, 1];

/** an invented shape for each symbol: 34 closes between 0 and 1. Geometry, not market data. */
const SHAPES: number[][] = SYMBOLS.map((_, s) => {
  const r = seeded(7000 + s * 97);
  const drift = [0.03, 0.012, 0.022, -0.02, 0.03, -0.012, 0.018, 0.026, -0.024, 0.01, 0.028][s];
  const out: number[] = [];
  let v = drift > 0 ? 0.12 : 0.85;
  for (let i = 0; i < N; i++) {
    v = clamp(v + drift + (r() - 0.5) * 0.11, 0.05, 0.95);
    out.push(v);
  }
  return out;
});

type State = { dim: Partial<Record<RegionKey, number>>; sel: number; from: number; at: number; gauge: number };

const bar = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string, r = 1) => {
  ctx.fillStyle = c;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
};
const box = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stroke: string, fill?: string, r = 2) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  else ctx.rect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = stroke;
  ctx.stroke();
};

function makeDraw(mode: Mode, focus: RegionKey[] | undefined, ring: boolean, view: Box, st: State): FigureDraw {
  return ({ ctx, w, h, t, dt, hover, mx, my, pal, still, enter }) => {
    if (w < 60 || h < 40) return;
    const k = w / view.w;
    const time = still ? 2.6 : t;
    // the pointer, in the drawing's own coordinates
    const px = mx / k + view.x;
    const py = my / k + view.y;
    const over = hover > 0.4;
    const inside = (b: Box) => over && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
    const ease = (cur: number, to: number, rate: number) => (still ? to : cur + (to - cur) * (1 - Math.exp(-dt * rate)));

    // which symbol is chosen: the row under the pointer, or each in turn
    const wl = REGIONS.watchlist;
    let want = st.sel;
    if (mode === "see" && inside({ x: wl.x, y: wl.y + 36, w: wl.w, h: 11 * 27 })) want = clamp(Math.floor((py - wl.y - 36) / 27), 0, 10);
    else if (!still && (mode === "see" || mode === "tour") && !over) want = Math.floor(time / 2.8) % SYMBOLS.length;
    if (want !== st.sel) {
      st.from = st.sel;
      st.sel = want;
      st.at = time;
    }
    const blend = still ? 1 : smooth((time - st.at) / 0.55);
    const closes = SHAPES[st.sel].map((v, i) => lerp(SHAPES[st.from][i], v, blend));

    ctx.save();
    ctx.scale(k, k);
    ctx.translate(-view.x, -view.y);
    ctx.textBaseline = "middle";
    const ink = (a: number) => rgba(pal.ink, a);
    const ink3 = (a: number) => rgba(pal.ink3, a);
    const line = rgba(pal.line, 1);
    const font = (px2: number, weight = 600) => `${weight} ${px2}px ${pal.font}`;

    // frame, header, the brand line, the dividers
    box(ctx, 0, 0, WORKSPACE.w, WORKSPACE.h, rgba(pal.ink3, 0.5), rgba(pal.surface, 1), 6);
    const dna = ctx.createLinearGradient(0, 0, WORKSPACE.w, 0);
    dna.addColorStop(0, rgba(pal.teal, 1));
    dna.addColorStop(0.5, rgba(pal.accent, 1));
    dna.addColorStop(1, rgba(pal.emerald, 1));
    ctx.fillStyle = dna;
    ctx.fillRect(0, 36, WORKSPACE.w, 1);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of [
      [200.5, 37, 200.5, 600],
      [720.5, 37, 720.5, 600],
      [0, 250.5, 200, 250.5],
      [200, 400.5, 720, 400.5],
      [720, 336.5, 960, 336.5],
      [520.5, 400, 520.5, 600],
    ]) {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();

    const region = (key: RegionKey, paint: (b: Box, lit: number) => void) => {
      const to = focus && !focus.includes(key) ? 0.24 : 1;
      const a = (st.dim[key] = ease(st.dim[key] ?? to, to, 7));
      ctx.save();
      // never invisible: the areas brighten as the figure arrives, from a third
      ctx.globalAlpha = a * (still ? 1 : 0.35 + 0.65 * smooth(enter * 1.4));
      paint(REGIONS[key], focus?.includes(key) ? 1 : 0);
      ctx.restore();
    };

    region("workspace", () => {
      for (let i = 0; i < 4; i++) {
        box(ctx, 16 + i * 92, 9, 80, 19, line, i === 0 ? rgba(pal.surface, 1) : undefined);
        bar(ctx, 26 + i * 92, 16, [44, 36, 52, 30][i], 5, i === 0 ? ink(0.85) : ink3(0.5));
      }
    });
    region("account", () => {
      for (let i = 0; i < 3; i++) {
        bar(ctx, 590 + i * 122, 9, [38, 30, 44][i], 4, ink3(0.6));
        bar(ctx, 590 + i * 122, 19, [78, 70, 58][i], 7, ink(0.75));
      }
    });
    region("explorer", (b) => {
      box(ctx, b.x + 14, b.y + 12, b.w - 28, 22, line);
      bar(ctx, b.x + 38, b.y + 21, 60, 4, ink3(0.6));
      CLASSES.forEach((name, i) => {
        const y = b.y + 52 + i * 26;
        const on = CLASS_OF[st.sel] === i;
        if (on) bar(ctx, b.x + 6, y - 10, b.w - 12, 20, rgba(pal.accent, 0.14 * blend), 2);
        ctx.font = font(11, on ? 700 : 500);
        ctx.textAlign = "left";
        ctx.fillStyle = on ? ink(1) : ink3(0.95);
        ctx.fillText(name, b.x + 30, y);
        bar(ctx, b.x + b.w - 44, y - 2, 30, 4, ink3(0.5));
      });
    });
    region("watchlist", (b) => {
      bar(ctx, b.x + 14, b.y + 16, 56, 4, ink3(0.6));
      SYMBOLS.forEach((sym, i) => {
        const y = b.y + 36 + i * 27;
        const on = i === st.sel;
        if (on) {
          bar(ctx, b.x + 1, y, b.w - 2, 27, rgba(pal.accent, 0.16), 0);
          bar(ctx, b.x + 1, y, 3, 27, rgba(pal.accent, 1), 0);
        }
        ctx.font = font(11, on ? 700 : 600);
        ctx.textAlign = "left";
        ctx.fillStyle = ink(on ? 1 : 0.82);
        ctx.fillText(sym, b.x + 14, y + 14);
        bar(ctx, b.x + 112, y + 12, 28, 4, ink3(0.55));
        bar(ctx, b.x + 150, y + 12, 28, 4, ink3(0.55));
        ctx.strokeStyle = line;
        ctx.beginPath();
        ctx.moveTo(b.x, y + 27.5);
        ctx.lineTo(b.x + b.w, y + 27.5);
        ctx.stroke();
      });
    });

    region("chart", (b) => {
      const x0 = b.x + 46;
      const x1 = b.x + b.w - 62;
      const y0 = b.y + 56;
      const y1 = b.y + b.h - 40;
      const X = (i: number) => lerp(x0, x1, i / (N - 1));
      const Y = (v: number) => lerp(y1, y0, v);
      // the title is the chosen symbol; the chips are the timeframes, as shapes
      ctx.font = font(12, 700);
      ctx.textAlign = "left";
      ctx.fillStyle = ink(0.95);
      ctx.fillText(SYMBOLS[st.sel], b.x + 16, b.y + 20);
      for (let i = 0; i < 6; i++) box(ctx, b.x + 96 + i * 30, b.y + 12, 24, 14, line, i === 3 ? ink(0.8) : undefined);
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = rgba(pal.ink3, 0.28);
      ctx.beginPath();
      for (let g = 0; g <= 4; g++) {
        ctx.moveTo(x0, lerp(y0, y1, g / 4));
        ctx.lineTo(x1 + 40, lerp(y0, y1, g / 4));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // the area under the average, then the candles, drawn in from the left
      const shown = still ? N : smooth(enter) * (N + 2);
      const avg = closes.map((_, i) => {
        const from = Math.max(0, i - 4);
        let s = 0;
        for (let j = from; j <= i; j++) s += closes[j];
        return s / (i - from + 1) - 0.035;
      });
      const upto = Math.min(N - 1, Math.floor(shown));
      if (upto > 0) {
        const fill = ctx.createLinearGradient(0, y0, 0, y1);
        fill.addColorStop(0, rgba(pal.accent, 0.2));
        fill.addColorStop(1, rgba(pal.accent, 0));
        ctx.beginPath();
        ctx.moveTo(X(0), y1);
        for (let i = 0; i <= upto; i++) ctx.lineTo(X(i), Y(avg[i]));
        ctx.lineTo(X(upto), y1);
        ctx.fillStyle = fill;
        ctx.fill();
      }
      for (let i = 0; i <= upto; i++) {
        const o = i === 0 ? closes[0] - 0.03 : closes[i - 1];
        const c = closes[i];
        const wick = (((i % 3) + 1) * 0.012);
        const tone = c >= o ? pal.emerald : DOWN;
        ctx.strokeStyle = rgba(tone, 0.95);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(X(i), Y(Math.max(o, c) + wick));
        ctx.lineTo(X(i), Y(Math.min(o, c) - wick));
        ctx.stroke();
        ctx.fillStyle = rgba(tone, 0.95);
        ctx.fillRect(X(i) - 3.6, Y(Math.max(o, c)), 7.2, Math.max(1.5, Math.abs(Y(o) - Y(c))));
      }
      if (upto > 1) {
        ctx.beginPath();
        for (let i = 0; i <= upto; i++) {
          if (i === 0) ctx.moveTo(X(i), Y(avg[i]));
          else ctx.lineTo(X(i), Y(avg[i]));
        }
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = rgba(pal.teal, 1);
        ctx.shadowColor = rgba(pal.teal, 0.9);
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (!still) {
          // a point of light that runs the length of the average
          const u = ((time * 0.2) % 1) * upto;
          const i0 = Math.floor(u);
          const i1 = Math.min(upto, i0 + 1);
          ctx.beginPath();
          ctx.arc(lerp(X(i0), X(i1), u - i0), lerp(Y(avg[i0]), Y(avg[i1]), u - i0), 3, 0, TAU);
          ctx.fillStyle = rgba(PALE, 0.95);
          ctx.fill();
        }
      }
      // the last close, carried to the scale
      const last = Y(closes[N - 1]);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = rgba(pal.emerald, 0.8);
      ctx.beginPath();
      ctx.moveTo(x0, last);
      ctx.lineTo(x1 + 16, last);
      ctx.stroke();
      ctx.setLineDash([]);
      bar(ctx, x1 + 18, last - 7, 30, 14, rgba(pal.emerald, 1), 2);

      if (mode === "analyse") {
        // a trend line and two levels, drawn in, held, and let go, in turn
        const cyc = still ? 5 : time % 9;
        const tl = smooth(cyc / 1.2) * (1 - smooth((cyc - 7.6) / 1));
        const lv = smooth((cyc - 2.2) / 1.2) * (1 - smooth((cyc - 7.6) / 1));
        const lo0 = Math.min(...closes.slice(0, 8));
        const lo1 = Math.min(...closes.slice(22, 30));
        if (tl > 0.01) {
          ctx.strokeStyle = rgba(GOLD, 0.95);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(X(2), Y(lo0 - 0.05));
          ctx.lineTo(lerp(X(2), X(N - 1), tl), lerp(Y(lo0 - 0.05), Y(lo1 - 0.05 + ((lo1 - lo0) / 22) * 6), tl));
          ctx.stroke();
          ctx.font = font(9, 700);
          ctx.textAlign = "left";
          ctx.fillStyle = rgba(GOLD, tl);
          ctx.fillText("TREND LINE", X(3), Y(lo0 - 0.05) + 12);
        }
        if (lv > 0.01) {
          const hi = Math.max(...closes);
          for (const [v, name] of [[hi, "LEVEL"], [(hi + Math.min(...closes)) / 2, "LEVEL"]] as const) {
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = rgba(pal.accent, 0.9);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x0, Y(v));
            ctx.lineTo(lerp(x0, x1, lv), Y(v));
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = font(9, 700);
            ctx.textAlign = "left";
            ctx.fillStyle = rgba(pal.accent, lv);
            ctx.fillText(name, x0 + 4, Y(v) - 8);
          }
        }
      }
      // the crosshair: the pointer's, or one that sweeps by itself while analysing
      const auto = mode === "analyse" && !over && !still;
      if (inside({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }) || auto) {
        const cx = auto ? lerp(x0, x1, (time * 0.09) % 1) : px;
        const i = clamp(Math.round(((cx - x0) / (x1 - x0)) * (N - 1)), 0, N - 1);
        const cy = auto ? Y(closes[i]) : py;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = ink(0.55);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(X(i), y0);
        ctx.lineTo(X(i), y1);
        ctx.moveTo(x0, cy);
        ctx.lineTo(x1 + 16, cy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(X(i), Y(closes[i]), 4.5, 0, TAU);
        ctx.strokeStyle = rgba(PALE, 0.95);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        bar(ctx, x1 + 18, cy - 7, 30, 14, ink(0.85), 2);
        bar(ctx, X(i) - 16, y1 + 6, 32, 12, ink(0.85), 2);
      }
      for (let g = 0; g < 6; g++) bar(ctx, lerp(x0, x1, g / 5) - 12, y1 + 22, 24, 3, ink3(0.5));
    });

    region("order", (b) => {
      // the ticket is filled in, in order: instrument, direction, size, stop, send
      const rows = [b.y + 24, b.y + 76, b.y + 126, b.y + 176, b.y + 232];
      let step = still ? 4 : Math.floor((time / 1.5) % 5.6);
      if (mode === "act" && over) step = clamp(rows.findIndex((y) => py < y + 40), 0, 4);
      if (mode !== "act") step = -1;
      const glow = (i: number) => (step === i ? rgba(pal.accent, 1) : line);
      bar(ctx, b.x + 16, b.y + 12, 60, 4, ink3(0.6));
      box(ctx, b.x + 16, rows[0], b.w - 32, 26, glow(0), step === 0 ? rgba(pal.accent, 0.12) : undefined);
      ctx.font = font(11, 700);
      ctx.textAlign = "left";
      ctx.fillStyle = ink(mode === "act" ? 0.95 : 0.8);
      ctx.fillText(SYMBOLS[st.sel], b.x + 26, rows[0] + 13);
      const buy = mode !== "act" || Math.floor(time / 4.2) % 2 === 0;
      box(ctx, b.x + 16, rows[1] - 12, (b.w - 40) / 2, 24, step === 1 && buy ? rgba(pal.accent, 1) : line, buy ? ink(0.12) : undefined);
      box(ctx, b.x + 24 + (b.w - 40) / 2, rows[1] - 12, (b.w - 40) / 2, 24, step === 1 && !buy ? rgba(pal.accent, 1) : line, !buy ? ink(0.12) : undefined);
      bar(ctx, b.x + 40, rows[1] - 2, 40, 4, ink(buy ? 0.9 : 0.4));
      bar(ctx, b.x + 48 + (b.w - 40) / 2, rows[1] - 2, 40, 4, ink(buy ? 0.4 : 0.9));
      bar(ctx, b.x + 16, rows[2] - 22, 36, 3, ink3(0.6));
      box(ctx, b.x + 16, rows[2] - 13, b.w - 32, 26, glow(2), step === 2 ? rgba(pal.accent, 0.12) : undefined);
      ctx.strokeStyle = ink3(0.9);
      ctx.beginPath();
      ctx.moveTo(b.x + 28, rows[2]);
      ctx.lineTo(b.x + 38, rows[2]);
      ctx.moveTo(b.x + b.w - 38, rows[2]);
      ctx.lineTo(b.x + b.w - 28, rows[2]);
      ctx.moveTo(b.x + b.w - 33, rows[2] - 5);
      ctx.lineTo(b.x + b.w - 33, rows[2] + 5);
      ctx.stroke();
      // the size, as a bar that is nudged while its step is lit
      bar(ctx, b.x + b.w / 2 - 26, rows[2] - 3, 34 + (step === 2 && !still ? ((Math.floor(time * 3) % 4) * 6) : 12), 6, ink(0.9));
      bar(ctx, b.x + 16, rows[3] - 22, 44, 3, ink3(0.6));
      box(ctx, b.x + 16, rows[3] - 13, b.w - 32, 26, glow(3), step === 3 ? rgba(pal.accent, 0.12) : undefined);
      bar(ctx, b.x + 26, rows[3] - 3, 60, 6, step === 3 ? rgba(DOWN, 0.95) : ink3(0.6));
      const pulse = step === 4 && !still ? (Math.sin(time * 7) + 1) / 2 : 0;
      box(ctx, b.x + 16, rows[4] - 4, (b.w - 40) / 2, 36, rgba(DOWN, !buy && step === 4 ? 1 : 0.5), rgba(DOWN, !buy ? 0.22 + pulse * 0.25 : 0.12));
      box(ctx, b.x + 24 + (b.w - 40) / 2, rows[4] - 4, (b.w - 40) / 2, 36, rgba(pal.emerald, buy && step === 4 ? 1 : 0.5), rgba(pal.emerald, buy ? 0.22 + pulse * 0.25 : 0.12));
      bar(ctx, b.x + 42, rows[4] + 11, 32, 6, rgba(DOWN, 0.95));
      bar(ctx, b.x + 50 + (b.w - 40) / 2, rows[4] + 11, 32, 6, rgba(pal.emerald, 0.95));
      if (mode === "act" && step >= 0) {
        ctx.font = font(9, 700);
        ctx.textAlign = "right";
        ctx.fillStyle = rgba(pal.accent, 1);
        ctx.fillText(["1 INSTRUMENT", "2 DIRECTION", "3 SIZE", "4 STOP", "5 SEND"][step], b.x + b.w - 16, b.y + 13);
      }
    });

    region("risk", (b) => {
      // the gauge: how much room there is above the margin in use. The pointer moves it.
      const gx = b.x + 16;
      const gw = b.w - 32;
      const gy = b.y + 152;
      let to = still ? 0.62 : 0.56 + Math.sin(time * 0.5) * 0.22;
      if (mode === "manage" && inside(b)) to = clamp((px - gx) / gw);
      st.gauge = ease(st.gauge, to, 6);
      bar(ctx, b.x + 16, b.y + 20, 56, 4, ink3(0.6));
      const on = st.gauge > 0.3;
      bar(ctx, b.x + 16, b.y + 38, 30, 14, on ? rgba(pal.emerald, 0.9) : ink3(0.5), 7);
      ctx.beginPath();
      ctx.arc(b.x + (on ? 38 : 24), b.y + 45, 5, 0, TAU);
      ctx.fillStyle = rgba(PALE, 1);
      ctx.fill();
      bar(ctx, b.x + 56, b.y + 43, 60, 4, ink(0.7));
      box(ctx, b.x + 16, b.y + 62, gw, 22, line);
      bar(ctx, b.x + 26, b.y + 71, 50, 4, ink3(0.6));
      bar(ctx, gx, gy - 22, 56, 3, ink3(0.6));
      bar(ctx, gx, gy, gw, 6, rgba(pal.line, 1), 3);
      const low = st.gauge < 0.21;
      bar(ctx, gx, gy, gw * st.gauge, 6, rgba(low ? DOWN : st.gauge < 0.36 ? GOLD : pal.emerald, 1), 3);
      ctx.strokeStyle = ink(0.8);
      ctx.beginPath();
      for (const m of [0.21, 0.36]) {
        ctx.moveTo(gx + gw * m, gy - 6);
        ctx.lineTo(gx + gw * m, gy + 12);
      }
      ctx.stroke();
      if (mode === "manage") {
        ctx.font = font(9, 700);
        ctx.textAlign = "left";
        ctx.fillStyle = rgba(low ? DOWN : st.gauge < 0.36 ? GOLD : pal.emerald, 1);
        ctx.fillText(low ? "BELOW THE CLOSING LEVEL" : st.gauge < 0.36 ? "NEAR THE WARNING LEVEL" : "ROOM ABOVE THE MARGIN", gx, gy + 28);
      }
      for (let i = 0; i < 3; i++) bar(ctx, gx, b.y + 204 + i * 16, [100, 140, 78][i], 4, ink3(0.5));
    });

    region("positions", (b) => {
      bar(ctx, b.x + 16, b.y + 18, 70, 6, ink(0.85));
      bar(ctx, b.x + 16, b.y + 30, 70, 1.5, rgba(pal.emerald, 1), 0);
      bar(ctx, b.x + 110, b.y + 18, 50, 6, ink3(0.5));
      const lit = mode === "manage" && !still ? Math.floor((time / 1.3) % 6) : -1;
      for (let i = 0; i < 5; i++) {
        const y = b.y + 58 + i * 28;
        const up = [1, 0, 1, 0, 1][i];
        const slide = still ? 1 : smooth(enter * 2 - i * 0.15);
        if (lit === i) bar(ctx, b.x + 6, y - 12, b.w - 12, 24, rgba(pal.accent, 0.13), 2);
        bar(ctx, b.x + 16, y - 3, 50 * slide, 6, ink(0.8));
        bar(ctx, b.x + 92, y - 3, 24, 6, rgba(up ? pal.emerald : DOWN, 0.8));
        bar(ctx, b.x + 146, y - 3, 40, 6, ink3(0.5));
        bar(ctx, b.x + 212, y - 3, 40, 6, ink3(0.5));
        bar(ctx, b.x + 276, y - 3, [42, 26, 52, 34, 22][i] * slide, 6, rgba(up ? pal.emerald : DOWN, 0.95));
        ctx.strokeStyle = line;
        ctx.beginPath();
        ctx.moveTo(b.x + 16, y + 14.5);
        ctx.lineTo(b.x + b.w - 8, y + 14.5);
        ctx.stroke();
      }
    });
    region("history", (b) => {
      bar(ctx, b.x + 16, b.y + 18, 56, 6, ink3(0.7));
      box(ctx, b.x + b.w - 70, b.y + 12, 54, 16, line);
      for (let i = 0; i < 5; i++) {
        const y = b.y + 58 + i * 28;
        bar(ctx, b.x + 16, y - 3, 30, 6, ink3(0.5));
        bar(ctx, b.x + 60, y - 3, 46, 6, ink(0.6));
        bar(ctx, b.x + 150, y - 3, [34, 42, 26, 38, 30][i], 6, ink3(0.5));
        ctx.strokeStyle = line;
        ctx.beginPath();
        ctx.moveTo(b.x + 16, y + 14.5);
        ctx.lineTo(b.x + b.w - 12, y + 14.5);
        ctx.stroke();
      }
    });

    // the focused areas, outlined
    if (ring && focus) {
      for (const key of focus) {
        const b = REGIONS[key];
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, 4);
        else ctx.rect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
        ctx.lineWidth = 2;
        ctx.strokeStyle = rgba(pal.accent, 1);
        ctx.shadowColor = rgba(pal.accent, 0.9);
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    // a slow pass of light across the glass
    if (!still) {
      const u = ((time * 0.11) % 1.6) - 0.3;
      const sx = u * (WORKSPACE.w + 300);
      const sweep = ctx.createLinearGradient(sx - 140, 0, sx + 140, 120);
      sweep.addColorStop(0, rgba(PALE, 0));
      sweep.addColorStop(0.5, rgba(PALE, 0.07));
      sweep.addColorStop(1, rgba(PALE, 0));
      ctx.fillStyle = sweep;
      ctx.fillRect(view.x, view.y, view.w, view.h);
    }
    ctx.restore();
  };
}

const PALE: Colour = [238, 244, 248, 1];
const GOLD: Colour = [201, 169, 106, 1];

export function RaptorLive({
  mode,
  focus,
  ring = false,
  view,
  label,
  tilt = true,
  className = "",
}: {
  mode: Mode;
  focus?: RegionKey[];
  ring?: boolean;
  /** crop the drawing to this area, in the workspace's own 960 × 600 coordinates */
  view?: Box;
  label: string;
  /** lean a few degrees towards the pointer (not where buttons are laid over the drawing) */
  tilt?: boolean;
  className?: string;
}) {
  const st = useRef<State>({ dim: {}, sel: 0, from: 0, at: -9, gauge: 0.6 });
  const v = view ?? { x: 0, y: 0, w: WORKSPACE.w, h: WORKSPACE.h };
  const key = `${mode}|${focus?.join(",") ?? ""}|${ring}|${v.x},${v.y},${v.w},${v.h}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draw = useMemo(() => makeDraw(mode, focus, ring, v, st.current), [key]);
  const inner = useRef<HTMLDivElement>(null);

  const lean = (e: PointerEvent<HTMLDivElement>) => {
    const el = inner.current;
    if (!tilt || !el || e.pointerType === "touch") return;
    const root = document.documentElement;
    if (root.dataset.motion === "reduced" || root.dataset.effects === "low" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1400px) rotateY(${(dx * 5).toFixed(2)}deg) rotateX(${(-dy * 4).toFixed(2)}deg)`;
  };
  const level = () => {
    if (inner.current) inner.current.style.transform = "";
  };

  return (
    <div role="img" aria-label={label} className={className} onPointerMove={lean} onPointerLeave={level}>
      <div ref={inner} className="transition-transform duration-300 ease-out will-change-transform">
        <Figure draw={draw} ratio={v.w / v.h} rev={focus ? focus.join("").length + (ring ? 1 : 0) : 0} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * THE WORKSPACE, REARRANGED — one set of panels that slides between three
 * arrangements, to show what "a workspace" means without claiming that the
 * platform ships with these layouts. The buttons choose; left alone, it
 * moves through the three in turn.
 * ------------------------------------------------------------------------- */

type Panel = [number, number, number, number];
const LAYOUTS: { name: string; panels: [Panel, Panel, Panel, Panel] }[] = [
  { name: "Chart first", panels: [[0, 0, 150, 96], [154, 0, 66, 46], [154, 50, 66, 46], [0, 100, 220, 36]] },
  { name: "Detail below", panels: [[0, 0, 220, 80], [0, 84, 72, 52], [74, 84, 72, 52], [148, 84, 72, 52]] },
  { name: "List first", panels: [[74, 0, 146, 62], [0, 0, 70, 136], [74, 66, 146, 70], [74, 136, 146, 0]] },
];

export function LayoutMorph({ at, auto }: { at: number; auto: boolean }) {
  const cur = useRef<number[] | null>(null);
  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, t, dt, pal, still }) => {
        if (w < 80 || h < 50) return;
        const which = auto && !still ? Math.floor(t / 3) % 3 : at;
        const target = LAYOUTS[which].panels.flat();
        if (!cur.current) cur.current = [...target];
        const c = cur.current;
        for (let i = 0; i < c.length; i++) c[i] = still ? target[i] : c[i] + (target[i] - c[i]) * (1 - Math.exp(-dt * 6));
        const k = Math.min((w - 8) / 220, (h - 8) / 136);
        const ox = (w - 220 * k) / 2;
        const oy = (h - 136 * k) / 2;
        for (let p = 0; p < 4; p++) {
          const [x, y, pw, ph] = [c[p * 4] * k + ox, c[p * 4 + 1] * k + oy, c[p * 4 + 2] * k, c[p * 4 + 3] * k];
          if (pw < 4 || ph < 4) continue;
          box(ctx, x, y, pw, ph, rgba(p === 0 ? pal.accent : pal.ink3, p === 0 ? 0.95 : 0.6), rgba(pal.surface, 1), 3);
          if (p === 0) {
            // the chart panel carries a line that redraws itself
            ctx.beginPath();
            const pts = [0.12, 0.5, 0.3, 0.8, 0.66];
            const u = still ? 1 : clamp(((t % 3) / 1.1));
            pts.forEach((v, i) => {
              const px = x + 8 + ((pw - 16) * i) / (pts.length - 1);
              const py = y + ph - 10 - (ph - 20) * v;
              if (i === 0) ctx.moveTo(px, py);
              else if (i / (pts.length - 1) <= u) ctx.lineTo(px, py);
            });
            ctx.lineWidth = 1.6;
            ctx.lineJoin = "round";
            ctx.strokeStyle = rgba(pal.emerald, 1);
            ctx.stroke();
          } else {
            const rows = Math.max(1, Math.floor((ph - 12) / (11 * k)));
            for (let r = 0; r < rows; r++) bar(ctx, x + 7, y + 8 + r * 11 * k, Math.max(8, (pw - 14) * (r % 2 ? 0.55 : 0.8)), 3.5, rgba(pal.ink3, 0.55));
          }
        }
      },
    [at, auto],
  );
  return <Figure draw={draw} ratio={2} rev={at + (auto ? 10 : 0)} />;
}

export function LayoutChooser() {
  const [at, setAt] = useState(0);
  const [auto, setAuto] = useState(true);
  return (
    <div className="grid items-center gap-21 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-55">
      <div role="img" aria-label={`An illustration of workspace panels arranged as \u201c${LAYOUTS[at].name}\u201d`} className="mx-auto w-full max-w-[44rem]">
        <LayoutMorph at={at} auto={auto} />
      </div>
      <div className="flex flex-wrap gap-8 lg:flex-col" role="group" aria-label="Choose an arrangement">
        {LAYOUTS.map((l, i) => (
          <button
            key={l.name}
            type="button"
            className="btn btn-ghost"
            aria-pressed={!auto && at === i}
            onClick={() => {
              setAt(i);
              setAuto(false);
            }}
          >
            {l.name}
          </button>
        ))}
      </div>
    </div>
  );
}
