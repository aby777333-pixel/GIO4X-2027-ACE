"use client";

import { useEffect, useRef } from "react";

/**
 * THE FLIGHT — the Raptor page's opening: a low, fast pass over a market drawn
 * as a landscape. A run of candles stands on a lit floor and reaches to the
 * horizon; the view travels along it, the way a bird of prey follows a river.
 * The pointer banks the flight left and right and lifts or lowers it.
 *
 * Every candle is invented: heights come from a fixed formula, they belong to
 * no instrument and no number is written on them. The colours are the three
 * of the GIO4X mark. It is decoration, hidden from assistive technology.
 *
 * Canvas 2D, no dependency. It runs only while on screen and the tab is
 * visible. Under reduced motion or low visual effects one still frame is
 * drawn and nothing moves.
 */

type Rgb = readonly [number, number, number];
const TEAL: Rgb = [0, 200, 188];
const BLUE: Rgb = [40, 150, 230];
const EMERALD: Rgb = [30, 190, 100];
const PALE: Rgb = [228, 240, 246];
const col = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a < 0 ? 0 : a > 1 ? 1 : a})`;

/** a smooth, repeatable height for candle n: a slow swell with a quicker ripple on it */
const level = (n: number) => 3.4 + Math.sin(n * 0.21) * 1.3 + Math.sin(n * 0.057 + 1.3) * 1.5 + Math.sin(n * 0.93) * 0.55;

export function RaptorFlight() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const still = () => mq.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let visible = false;
    let last = 0;
    let dist = 0; // how far the flight has come, in candles
    let bank = 0; // eased: -1 left, 1 right
    let lift = 0; // eased: -1 low, 1 high
    let tx = 0;
    let ty = 0;

    const size = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2) return;
      w = r.width;
      h = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };

    const frame = (now: number) => {
      const frozen = still();
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!frozen) {
        dist += dt * 3.2;
        bank += (tx - bank) * (1 - Math.exp(-dt * 3));
        lift += (ty - lift) * (1 - Math.exp(-dt * 3));
      }
      const t = now / 1000;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // the frame: the same golden rectangle, in the same place, as every other page's hero (see cockpit/engine)
      const wide = w >= 1080;
      const gutter = Math.max(21, Math.min(55, w * 0.042));
      const contentW = Math.min(w - gutter * 2, 1320);
      const bw = wide ? Math.min(contentW * 0.52, 760, (h - 68) * 1.618) : Math.min(contentW, 560);
      const bh = bw / 1.618;
      const bx = wide ? (w - contentW) / 2 + contentW - bw : (w - bw) / 2;
      const by = wide ? (h - bh) / 2 : 76;
      // the vanishing point sits to the right on a wide screen, clear of the words
      const vx = bx + bw * 0.3 - bank * bw * 0.06;
      const horizon = by + bh * 0.3 + lift * bh * 0.05;
      const camY = 8.2 + lift * 1.6; // height of the eye above the floor: well clear of the tallest candle
      // the eye flies beside the run of candles, not over it, so that they are seen as a row going away
      const camX = -4.4 + bank * 1.4;
      const f = bh * 0.82;
      const SPACE = 1.15; // distance between candles
      const FAR = 46;

      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
      // a pane of darker glass, so the frame reads as an instrument's window
      ctx.fillStyle = "rgba(4, 8, 12, 0.34)";
      ctx.fillRect(bx, by, bw, bh);
      // the whole view rolls a little with the bank
      ctx.translate(vx, horizon);
      ctx.rotate(-bank * 0.07);
      ctx.translate(-vx, -horizon);

      const X = (x: number, z: number) => vx + ((x - camX) * f) / z;
      const Y = (y: number, z: number) => horizon + ((camY - y) * f) / z;

      // light on the horizon
      const glow = ctx.createRadialGradient(vx, horizon, 0, vx, horizon, bw * 0.7);
      glow.addColorStop(0, col(BLUE, 0.3));
      glow.addColorStop(0.4, col(TEAL, 0.1));
      glow.addColorStop(1, col(TEAL, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(-w, -h, w * 3, h * 3);

      // the floor: lines running to the horizon, and lines crossing them that rush towards the eye
      ctx.lineWidth = 1;
      for (let lane = -14; lane <= 14; lane++) {
        ctx.strokeStyle = col(TEAL, lane === 0 ? 0.3 : 0.11);
        ctx.beginPath();
        ctx.moveTo(X(lane * 1.6, FAR), Y(0, FAR));
        ctx.lineTo(X(lane * 1.6, 0.7), Y(0, 0.7));
        ctx.stroke();
      }
      const offset = dist % 1;
      for (let i = 1; i < FAR; i++) {
        const z = (i - offset) * SPACE;
        if (z < 0.7) continue;
        ctx.strokeStyle = col(TEAL, 0.2 * (1 - z / (FAR * SPACE)));
        ctx.beginPath();
        ctx.moveTo(X(-24, z), Y(0, z));
        ctx.lineTo(X(24, z), Y(0, z));
        ctx.stroke();
      }

      // the candles, far to near
      const first = Math.floor(dist);
      const ridge: [number, number][] = [];
      for (let i = FAR; i >= 1; i--) {
        const n = first + i;
        const z = (i - offset) * SPACE;
        if (z < 2.2) continue;
        const o = level(n - 1);
        const c = level(n);
        const up = c >= o;
        const tone = up ? EMERALD : BLUE;
        const fade = Math.min(1, (FAR * SPACE - z) / 12) * Math.min(1, (z - 2.2) / 2.5);
        const half = 0.24;
        const x0 = X(-half, z);
        const x1 = X(half, z);
        const yTop = Y(Math.max(o, c), z);
        const yBot = Y(Math.min(o, c), z);
        const wick = 0.28 + ((n * 7) % 5) * 0.07;
        // the wick, then the body, with a brighter face on the side of the light
        ctx.strokeStyle = col(tone, 0.9 * fade);
        ctx.lineWidth = Math.max(1, (0.05 * f) / z);
        ctx.beginPath();
        ctx.moveTo((x0 + x1) / 2, Y(Math.max(o, c) + wick, z));
        ctx.lineTo((x0 + x1) / 2, Y(Math.max(0.05, Math.min(o, c) - wick), z));
        ctx.stroke();
        const body = ctx.createLinearGradient(x0, 0, x1, 0);
        body.addColorStop(0, col(tone, 0.95 * fade));
        body.addColorStop(1, col(tone, 0.5 * fade));
        ctx.fillStyle = body;
        ctx.fillRect(x0, yTop, x1 - x0, Math.max(1.5, yBot - yTop));
        // its light on the floor
        ctx.fillStyle = col(tone, 0.16 * fade);
        ctx.fillRect(x0 - (x1 - x0) * 0.6, Y(0, z) - 1, (x1 - x0) * 2.2, Math.max(1, (0.1 * f) / z));
        ridge.push([(x0 + x1) / 2, Y(c, z)]);
      }
      // a line of light along the closes, from the horizon to the eye
      if (ridge.length > 2) {
        ctx.beginPath();
        ridge.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = col(TEAL, 0.75);
        ctx.shadowColor = col(TEAL, 0.9);
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // points of light streaming past, faster the nearer they are
      for (let s = 0; s < 70; s++) {
        const sx = ((s * 73.3) % 40) - 20;
        const sy = 0.4 + ((s * 37.7) % 7);
        const z = FAR * SPACE - ((dist * SPACE * 1.6 + s * 4.7) % (FAR * SPACE - 1));
        if (z < 1) continue;
        const px = X(sx, z);
        const py = Y(sy, z);
        const len = Math.min(60, (f * 0.5) / (z * z));
        const ang = Math.atan2(py - horizon, px - vx);
        ctx.strokeStyle = col(s % 3 === 0 ? EMERALD : s % 3 === 1 ? TEAL : PALE, 0.5 * Math.min(1, 3 / z));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
        ctx.stroke();
      }
      ctx.restore();

      // the frame itself: a hairline in champagne, heavier at the corners, with the golden cut marked on its long sides
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(201,169,106,0.2)";
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      const c = Math.min(21, bw * 0.05);
      ctx.strokeStyle = "rgba(201,169,106,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [x, y, sx, sy] of [
        [bx, by, 1, 1],
        [bx + bw, by, -1, 1],
        [bx, by + bh, 1, -1],
        [bx + bw, by + bh, -1, -1],
      ] as const) {
        ctx.moveTo(x + sx * c, y + sy * 0.75);
        ctx.lineTo(x + sx * 0.75, y + sy * 0.75);
        ctx.lineTo(x + sx * 0.75, y + sy * c);
      }
      const cut = bx + bw * 0.618;
      ctx.moveTo(cut, by - 4);
      ctx.lineTo(cut, by + 5);
      ctx.moveTo(cut, by + bh - 5);
      ctx.lineTo(cut, by + bh + 4);
      ctx.stroke();

      // a breath of light in the whole frame, so a still moment is not dead
      if (!frozen) {
        ctx.fillStyle = col(BLUE, 0.025 + Math.sin(t * 0.8) * 0.012);
        ctx.fillRect(bx, by, bw, bh);
      }
      if (visible && !frozen && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const go = () => {
      cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = canvas.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      ty = Math.max(-1, Math.min(1, (0.5 - (e.clientY - r.top) / r.height) * 2));
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) go();
      else cancelAnimationFrame(raf);
    });
    const ro = new ResizeObserver(() => {
      size();
      go();
    });
    // the hero's words sit above the stage, so the pointer is read from the whole header
    const host = canvas.closest("header") ?? canvas;
    size();
    io.observe(canvas);
    ro.observe(canvas);
    host.addEventListener("pointermove", onMove as EventListener, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("gx:prefs", go);
    document.addEventListener("visibilitychange", go);
    mq.addEventListener("change", go);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      host.removeEventListener("pointermove", onMove as EventListener);
      host.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("gx:prefs", go);
      document.removeEventListener("visibilitychange", go);
      mq.removeEventListener("change", go);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
