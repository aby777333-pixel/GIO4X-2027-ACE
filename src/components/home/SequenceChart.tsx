"use client";

import { useEffect, useRef } from "react";
import { AVERAGE, CANDLES, COUNT, HEAD_Y, PHASES, PLOT, RANGE, STEP, STRIP, VB, readCandle, xOf, yOf } from "./sequence-chart-data";

/**
 * The chart the home sequence resolves into, and the object the visitor can
 * then handle.
 *
 * It is a lesson in reading a chart, on INVENTED prices: candles, an average
 * of the last eight closes, and an activity strip. Left alone, a reading line
 * travels slowly across it and the panel names what it is over. Under the
 * pointer (or a finger) the reading line follows: the candle opens up, its
 * open, high, low and close are read out, its shape is described in one plain
 * sentence, and the part of the move it belongs to is named.
 *
 * Nothing here is market data and no instrument is named. The series is
 * generated from a fixed seed (sequence-chart-data.ts) and says so on its face.
 *
 * Canvas 2D, no dependency. It draws only while on screen; under reduced
 * motion or "low visual effects" it draws a still frame and redraws only when
 * the pointer moves.
 */

type Rgb = [number, number, number];
const BLUE: Rgb = [58, 160, 226];
const UP: Rgb = [44, 190, 150];
const DOWN: Rgb = [226, 110, 104];
const GOLD: Rgb = [201, 169, 106];
const col = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a < 0 ? 0 : a > 1 ? 1 : a})`;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t: number) => t * t * (3 - 2 * t);
const f4 = (n: number) => n.toFixed(4);

export function SequenceChart({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const root = document.documentElement;
    const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";

    let w = 0;
    let h = 0;
    let k = 1; // CSS pixels per box unit
    let dpr = 1;
    let raf = 0;
    let visible = false;
    let font = "system-ui, sans-serif";
    let ink: Rgb = [238, 240, 241];
    let born = 0; // when the chart first drew, for its arrival
    let pointer: { x: number; y: number } | null = null;
    let hover = 0; // eased 0 to 1
    let at = 20; // the candle under the reading line (eased, fractional)
    let last = 0;

    const size = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2) return;
      w = r.width;
      h = r.height;
      k = w / VB.w;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      font = getComputedStyle(document.body).fontFamily || font;
      const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(getComputedStyle(canvas).color);
      if (m) ink = [Number(m[1]), Number(m[2]), Number(m[3])];
    };

    const text = (s: string, x: number, y: number, px: number, weight: number, c: string, align: CanvasTextAlign = "left") => {
      ctx.font = `${weight} ${Math.max(9, px * Math.min(1.25, Math.max(0.8, k)))}px ${font}`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillStyle = c;
      ctx.fillText(s, x * k, y * k);
    };

    const draw = (time: number) => {
      const t = time / 1000;
      const dt = last ? Math.min(0.05, t - last) : 0;
      last = t;
      const frozen = still();
      if (!born) born = t;
      const arrive = frozen ? 1 : clamp01((t - born) / 1.6);

      // where the reading line is: the pointer's candle, or a slow pass of its own
      hover += ((pointer ? 1 : 0) - hover) * (frozen ? 1 : 1 - Math.exp(-dt * 9));
      const own = frozen ? 31 : ((t * 2.2) % (COUNT + 6)) - 3;
      const want = pointer ? (pointer.x / k - PLOT.x0) / STEP - 0.5 : own;
      at += (Math.max(0, Math.min(COUNT - 1, want)) - at) * (frozen || !dt ? 1 : 1 - Math.exp(-dt * (pointer ? 16 : 5)));
      const idx = Math.round(at);
      const candle = CANDLES[idx];
      const up = candle.c >= candle.o;
      const phase = PHASES.find((p) => idx >= p.from && idx <= p.to) ?? PHASES[0];

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // on a phone the chart is too small for the panel and the price scale to be legible: it reads the candle on two lines instead
      const small = k < 0.75;
      const X = (v: number) => v * k;
      const Y = (v: number) => v * k;

      // the ground: a deep panel with a soft light where the reading line is
      const g = ctx.createRadialGradient(X(xOf(at)), Y(yOf(candle.c)), 0, X(xOf(at)), Y(yOf(candle.c)), X(260));
      g.addColorStop(0, col(BLUE, 0.13 + hover * 0.07));
      g.addColorStop(1, col(BLUE, 0));
      ctx.fillStyle = "rgba(9,14,19,0.92)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // header
      ctx.strokeStyle = col(ink, 0.14);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Y(HEAD_Y));
      ctx.lineTo(w, Y(HEAD_Y));
      ctx.stroke();
      if (small) text("EXAMPLE CHART · INVENTED PRICES", 14, HEAD_Y / 2, 9.5, 700, col(GOLD, 0.95));
      else {
        text("EXAMPLE CHART", 14, HEAD_Y / 2, 9.5, 700, col(ink, 0.9));
        text("INVENTED PRICES · NOT MARKET DATA", VB.w - 14, HEAD_Y / 2, 8.5, 600, col(GOLD, 0.95), "right");
      }

      // the phase the reading line is in, as a lit band across the pane
      const bx0 = PLOT.x0 + phase.from * STEP;
      const bx1 = PLOT.x0 + (phase.to + 1) * STEP;
      const band = ctx.createLinearGradient(0, Y(PLOT.y0), 0, Y(PLOT.y1));
      band.addColorStop(0, col(ink, 0.055));
      band.addColorStop(1, col(ink, 0));
      ctx.fillStyle = band;
      ctx.fillRect(X(bx0), Y(PLOT.y0), X(bx1 - bx0), Y(PLOT.y1 - PLOT.y0));
      text(phase.name.toUpperCase(), bx0 + 5, PLOT.y0 + 9, 8.5, 700, col(GOLD, 0.95));

      // price levels
      ctx.setLineDash([2, 5]);
      for (let i = 0; i <= 4; i++) {
        const price = RANGE.lo + ((RANGE.hi - RANGE.lo) * i) / 4;
        const y = yOf(price);
        ctx.strokeStyle = col(ink, 0.1);
        ctx.beginPath();
        ctx.moveTo(X(PLOT.x0), Y(y));
        ctx.lineTo(X(PLOT.x1), Y(y));
        ctx.stroke();
        if (!small) text(f4(price), VB.w - 8, y, 8.5, 500, col(ink, 0.5), "right");
      }
      ctx.setLineDash([]);

      // candles arrive from left to right
      const shown = arrive * (COUNT + 4);
      for (let i = 0; i < COUNT; i++) {
        const a = ease(clamp01(shown - i));
        if (a <= 0) break;
        const c = CANDLES[i];
        const rising = c.c >= c.o;
        const tone = rising ? UP : DOWN;
        const near = Math.max(0, 1 - Math.abs(i - at) / 1.1);
        const inPhase = i >= phase.from && i <= phase.to;
        const x = xOf(i);
        const bw = STEP * (0.56 + near * 0.26);
        const top = yOf(Math.max(c.o, c.c));
        const bottom = yOf(Math.min(c.o, c.c));
        const alpha = a * (inPhase ? 0.95 : 0.5 + near * 0.4);
        ctx.strokeStyle = col(tone, alpha);
        ctx.lineWidth = 1 + near * 0.6;
        ctx.beginPath();
        ctx.moveTo(X(x), Y(yOf(c.h)));
        ctx.lineTo(X(x), Y(yOf(c.l)));
        ctx.stroke();
        if (near > 0.05) {
          ctx.shadowColor = col(tone, 0.9);
          ctx.shadowBlur = 14 * near;
        }
        ctx.fillStyle = col(tone, alpha);
        ctx.fillRect(X(x - bw / 2), Y(top), X(bw), Math.max(1.2, Y(bottom - top)) * a);
        ctx.shadowBlur = 0;

        // the activity strip beneath
        const vh = (STRIP.y1 - STRIP.y0) * c.v * a;
        ctx.fillStyle = col(tone, (inPhase ? 0.42 : 0.2) + near * 0.4);
        ctx.fillRect(X(x - STEP * 0.3), Y(STRIP.y1 - vh), X(STEP * 0.6), Y(vh));
      }
      ctx.strokeStyle = col(ink, 0.14);
      ctx.beginPath();
      ctx.moveTo(X(PLOT.x0), Y(STRIP.y1));
      ctx.lineTo(X(PLOT.x1), Y(STRIP.y1));
      ctx.stroke();
      text("ACTIVITY (INVENTED)", PLOT.x0, STRIP.y0 - 9, 8, 600, col(ink, 0.45));

      // the average of the last eight closes, with a bright head that travels along it
      const upto = Math.min(COUNT - 1, shown - 2);
      if (upto > 0) {
        ctx.beginPath();
        for (let i = 0; i <= Math.floor(upto); i++) {
          if (i === 0) ctx.moveTo(X(xOf(i)), Y(yOf(AVERAGE[i])));
          else ctx.lineTo(X(xOf(i)), Y(yOf(AVERAGE[i])));
        }
        ctx.lineWidth = 1.6;
        ctx.lineJoin = "round";
        ctx.strokeStyle = col(BLUE, 0.95);
        ctx.shadowColor = col(BLUE, 0.8);
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (!frozen) {
          const u = (t * 0.16) % 1;
          const fi = u * (COUNT - 1);
          const i0 = Math.floor(fi);
          const i1 = Math.min(COUNT - 1, i0 + 1);
          const px = xOf(i0) + (xOf(i1) - xOf(i0)) * (fi - i0);
          const py = yOf(AVERAGE[i0] + (AVERAGE[i1] - AVERAGE[i0]) * (fi - i0));
          const glow = ctx.createRadialGradient(X(px), Y(py), 0, X(px), Y(py), X(16));
          glow.addColorStop(0, col(BLUE, 0.55 * arrive));
          glow.addColorStop(1, col(BLUE, 0));
          ctx.fillStyle = glow;
          ctx.fillRect(X(px - 16), Y(py - 16), X(32), Y(32));
        }
      }

      // the reading line and the price it crosses
      if (arrive >= 1) {
        const x = xOf(idx);
        ctx.strokeStyle = col(ink, 0.35 + hover * 0.3);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(X(x), Y(PLOT.y0));
        ctx.lineTo(X(x), Y(STRIP.y1));
        ctx.moveTo(X(PLOT.x0), Y(yOf(candle.c)));
        ctx.lineTo(X(PLOT.x1), Y(yOf(candle.c)));
        ctx.stroke();
        ctx.setLineDash([]);
        // the close, tagged on the price scale
        if (!small) {
          ctx.fillStyle = col(up ? UP : DOWN, 0.95);
          ctx.fillRect(X(PLOT.x1 + 4), Y(yOf(candle.c) - 7), X(VB.w - PLOT.x1 - 8), Y(14));
          text(f4(candle.c), VB.w - 8, yOf(candle.c), 8.5, 700, "rgba(9,14,19,1)", "right");
        }
        // high and low, ticked beside the candle
        for (const [label, price] of [["H", candle.h], ["L", candle.l]] as const) {
          const side = idx > COUNT - 6 ? -1 : 1;
          ctx.strokeStyle = col(ink, 0.6);
          ctx.beginPath();
          ctx.moveTo(X(x + side * STEP * 0.55), Y(yOf(price)));
          ctx.lineTo(X(x + side * STEP * 1.5), Y(yOf(price)));
          ctx.stroke();
          text(label, x + side * STEP * 2.05, yOf(price), 8.5, 700, col(ink, 0.9), "center");
        }

        // the four prices on one line, where there is no room for the panel
        if (small) text(`O ${f4(candle.o)}   H ${f4(candle.h)}   L ${f4(candle.l)}   C ${f4(candle.c)}`, 14, HEAD_Y + 10, 9, 600, col(up ? UP : DOWN, 1));

        // the panel: what this candle says
        const pw = small ? 0 : 196;
        const ph = 86;
        const px = idx < COUNT / 2 ? PLOT.x1 - pw - 6 : PLOT.x0 + 6;
        const py = idx < COUNT / 2 ? PLOT.y1 - ph - 6 : PLOT.y0 + 16;
        if (!small) {
        ctx.fillStyle = "rgba(9,14,19,0.86)";
        ctx.strokeStyle = col(ink, 0.2);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(X(px), Y(py), X(pw), Y(ph), 5);
        else ctx.rect(X(px), Y(py), X(pw), Y(ph));
        ctx.fill();
        ctx.stroke();
        text(`CANDLE ${String(idx + 1).padStart(2, "0")} OF ${COUNT}`, px + 10, py + 13, 8, 700, col(ink, 0.55));
        text(up ? "CLOSED UP" : "CLOSED DOWN", px + pw - 10, py + 13, 8, 700, col(up ? UP : DOWN, 1), "right");
        const cells = [
          ["Open", candle.o],
          ["High", candle.h],
          ["Low", candle.l],
          ["Close", candle.c],
        ] as const;
        cells.forEach(([label, v], i) => {
          const cx = px + 10 + i * ((pw - 20) / 4);
          text(label, cx, py + 28, 8, 500, col(ink, 0.55));
          text(f4(v), cx, py + 40, 9.5, 600, col(ink, 0.98));
        });
        text(`Average of 8 closes  ${f4(AVERAGE[idx])}`, px + 10, py + 55, 8.5, 500, col(BLUE, 1));
        // one plain sentence about its shape, wrapped to the panel
        const words = readCandle(candle).split(" ");
        ctx.font = `500 ${Math.max(9, 8.5 * Math.min(1.25, Math.max(0.8, k)))}px ${font}`;
        const lines: string[] = [];
        let line = "";
        for (const word of words) {
          const next = line ? `${line} ${word}` : word;
          if (ctx.measureText(next).width > X(pw - 20) && line) {
            lines.push(line);
            line = word;
          } else line = next;
        }
        lines.push(line);
        lines.slice(0, 2).forEach((s, i) => text(s, px + 10, py + 69 + i * 10, 8.5, 500, col(ink, 0.82)));
        }
      }

      // footer: what the lit band means, and how to use the chart
      if (small) text(readCandle(candle), 14, VB.h - 13, 9, 500, col(ink, 0.85));
      else {
        text(phase.note, PLOT.x0, VB.h - 13, 9, 500, col(ink, 0.8));
        text(pointer ? "Reading the candle under the pointer" : "Move over the chart to read any candle", VB.w - 8, VB.h - 13, 8.5, 600, col(BLUE, 0.95), "right");
      }

      if (visible && !frozen) raf = requestAnimationFrame(draw);
    };

    const redraw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (still()) redraw();
    };
    const onLeave = () => {
      pointer = null;
      if (still()) redraw();
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      last = 0;
      if (visible) redraw();
      else cancelAnimationFrame(raf);
    });
    const ro = new ResizeObserver(() => {
      size();
      redraw();
    });
    const onPrefs = () => requestAnimationFrame(() => {
      size();
      redraw();
    });

    size();
    io.observe(canvas);
    ro.observe(canvas);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("gx:prefs", onPrefs);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("gx:prefs", onPrefs);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="An example candlestick chart on invented prices, not market data. It rises, pulls back, pauses and rises again. Pointing at a candle reads out its open, high, low and close, the average of the last eight closes, and one sentence about its shape."
      className={`block aspect-[610/377] w-full cursor-crosshair touch-pan-y text-on-night ${className}`}
    />
  );
}
