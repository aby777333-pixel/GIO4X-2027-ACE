"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Figure, clamp, lerp, rgba, type FigureDraw } from "@/components/figures/Figure";
import { seeded } from "@/components/labs/workshop/rng";
import { SCALES } from "./scales";

/**
 * THE LONG SCROLL — one fall from a single tick out to a decade.
 *
 * A tall section with a stage pinned inside it. Scrolling widens the window
 * on one long invented walk: two points at the top, more than eight thousand
 * at the foot. Seven names are given to the widths on the way down (a tick, a
 * minute, an hour, a day, a month, a year, a decade), each with a sentence.
 *
 * The walk is generated from a fixed seed and belongs to no instrument; the
 * seven names are a way of speaking about scale, not a claim that this many
 * points make a year. What the fall shows is true of such a walk: it looks
 * much the same at every width, so a move can only be called large or small
 * once the scale has been chosen.
 *
 * Scroll position is the only clock. The stage is an ordinary sticky box, so
 * without JavaScript the section is the seven sentences, listed.
 */

const N = 8192;
const WALK = (() => {
  const r = seeded(20270101);
  const out = new Float32Array(N);
  let p = 0;
  for (let i = 0; i < N; i++) {
    p += r() - 0.5 + 0.004;
    out[i] = p;
  }
  return out;
})();

export function LongScroll() {
  const track = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [stage, setStage] = useState(0);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? clamp(-r.top / span) : 0;
      progress.current = p;
      setStage(Math.min(SCALES.length - 1, Math.floor(p * SCALES.length)));
      setRev(Math.round(p * 400));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const draw = useMemo<FigureDraw>(() => {
    let shown = 0;
    return ({ ctx, w, h, dt, pal, still }) => {
      if (w < 160 || h < 100) return;
      shown = still ? progress.current : shown + (progress.current - shown) * (1 - Math.exp(-dt * 8));
      // the window: two points at the top of the fall, all of them at the foot
      const width = Math.exp(lerp(Math.log(2), Math.log(N), shown));
      const from = Math.max(0, N - Math.round(width));
      const count = N - from;
      const cols = Math.min(count, Math.floor(w / 3));
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = from; i < N; i++) {
        if (WALK[i] < lo) lo = WALK[i];
        if (WALK[i] > hi) hi = WALK[i];
      }
      const padV = (hi - lo) * 0.12 || 1;
      const y = (v: number) => lerp(h - 12, 12, (v - (lo - padV)) / (hi - lo + padV * 2));
      const x = (c: number) => lerp(12, w - 12, cols <= 1 ? 0.5 : c / (cols - 1));

      // each column is the range of the points that fall in it: at wide windows, a candle's wick
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let c = 0; c < cols; c++) {
        const a = from + Math.floor((c * count) / cols);
        const b = from + Math.max(Math.floor(((c + 1) * count) / cols), Math.floor((c * count) / cols) + 1);
        let mn = Infinity;
        let mx = -Infinity;
        for (let i = a; i < b && i < N; i++) {
          if (WALK[i] < mn) mn = WALK[i];
          if (WALK[i] > mx) mx = WALK[i];
        }
        const last = WALK[Math.min(N - 1, b - 1)];
        if (c === 0) ctx.moveTo(x(c), y(last));
        else {
          ctx.lineTo(x(c), y(last));
          ctx.moveTo(x(c), y(mn));
          ctx.lineTo(x(c), y(mx));
          ctx.moveTo(x(c), y(last));
        }
      }
      ctx.lineWidth = count < 40 ? 2.2 : 1.3;
      ctx.strokeStyle = rgba(pal.accent, 1);
      ctx.stroke();
      if (count < 40) {
        // few enough to see each one: mark them
        for (let c = 0; c < cols; c++) {
          ctx.beginPath();
          ctx.arc(x(c), y(WALK[from + c]), 3.2, 0, Math.PI * 2);
          ctx.fillStyle = rgba(pal.gold, 1);
          ctx.fill();
        }
      }
      // how far the fall has come
      ctx.fillStyle = rgba(pal.line, 1);
      ctx.fillRect(12, h - 4, w - 24, 2);
      ctx.fillStyle = rgba(pal.gold, 1);
      ctx.fillRect(12, h - 4, (w - 24) * shown, 2);
    };
  }, []);

  const s = SCALES[stage];
  return (
    <div ref={track} className="gx-fall relative">
      <div className="gx-fall-stage wrap">
        <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">
          {String(stage + 1).padStart(2, "0")} / {String(SCALES.length).padStart(2, "0")}
        </p>
        <div aria-live="polite">
          <h2 className="h1 mt-8">{s.name}</h2>
          <p className="lead mt-8 max-w-[40rem]">{s.line}</p>
        </div>
        <div className="flat mt-21 rounded-[8px] border border-line bg-surface/60 p-13 max-sm:[&>div]:![aspect-ratio:1.3]">
          <Figure draw={draw} ratio={2.4} rev={rev} />
        </div>
        <p className="mt-8 text-xs text-ink-3">One invented walk, seen through a wider and wider window. Keep scrolling.</p>
      </div>
      <noscript>
        <ol className="wrap grid gap-13 py-34">
          {SCALES.map((x) => (
            <li key={x.name}>
              <strong>{x.name}.</strong> {x.line}
            </li>
          ))}
        </ol>
      </noscript>
    </div>
  );
}
