"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Figure, TAU, clamp, lerp, rgba, smooth, type Colour, type FigureDraw } from "@/components/figures/Figure";
import { signalSound } from "@/components/sound/signal";
import { seeded } from "./rng";

/**
 * THE CANDLE FORGE — one candlestick made the way a blade is made, so that
 * its four prices are met one at a time and in order:
 *
 *   poured   the body fills from the OPEN towards the close
 *   drawn    the upper wick is hammered out to the HIGH
 *   drawn    the lower wick is hammered out to the LOW
 *   cooled   the metal sets at the CLOSE and takes its colour
 *   marked   the four prices are stamped beside it
 *
 * The candle is invented: four heights from a seed, belonging to no
 * instrument. The sentence under the canvas says in words what each step
 * shows, so nothing depends on seeing the animation.
 */

type Candle = { o: number; h: number; l: number; c: number };
function candleOf(n: number): Candle {
  const r = seeded(9001 + n * 77);
  const o = 0.32 + r() * 0.36;
  let c = o + (r() < 0.5 ? -1 : 1) * (0.1 + r() * 0.18);
  c = clamp(c, 0.2, 0.8);
  return { o, c, h: Math.max(o, c) + 0.05 + r() * 0.12, l: Math.min(o, c) - 0.05 - r() * 0.12 };
}

const STEPS = [
  "Poured: the body fills from the open, where the period began.",
  "Drawn up: the upper wick reaches the high, the most anyone paid.",
  "Drawn down: the lower wick reaches the low, the least anyone took.",
  "Cooled: the body sets at the close, where the period ended, and takes its colour.",
  "Marked: open, high, low and close. Four prices, one shape.",
] as const;
const AT = [0, 2.4, 4.4, 6.4, 8.4] as const; // when each step starts, in seconds
const HOT: Colour = [255, 226, 150, 1];
const EMBER: Colour = [255, 128, 40, 1];
const DOWN: Colour = [214, 96, 88, 1];
const mix = (a: Colour, b: Colour, t: number): Colour => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), 1];

export function Forge({ controls = true }: { controls?: boolean }) {
  const [n, setN] = useState(0);
  const [step, setStep] = useState(0);
  const run = useRef({ n: -1, began: 0 });
  const shown = useRef(0);
  useEffect(() => {
    if (!controls) return;
    if (step === 1 || step === 2) signalSound("knock");
    else if (step === 3) signalSound("soft");
    else if (step === 4) signalSound("chime");
  }, [step, controls]);

  const draw = useMemo<FigureDraw>(() => {
    const k = candleOf(n);
    return ({ ctx, w, h, t, pal, still }) => {
      if (w < 160 || h < 160) return;
      if (run.current.n !== n) run.current = { n, began: t };
      const T = still ? 12 : t - run.current.began;
      const s = T >= AT[4] ? 4 : T >= AT[3] ? 3 : T >= AT[2] ? 2 : T >= AT[1] ? 1 : 0;
      if (s !== shown.current) {
        shown.current = s;
        setStep(s);
      }

      const top = 30;
      const bottom = h - 46;
      const cx = w * 0.46;
      const bw = Math.min(64, w * 0.13);
      const y = (v: number) => lerp(bottom, top, v);
      const up = k.c >= k.o;
      const tone = up ? pal.emerald : DOWN;

      const pour = smooth(T / 2.2);
      const high = smooth((T - AT[1]) / 1.8);
      const low = smooth((T - AT[2]) / 1.8);
      const cool = smooth((T - AT[3]) / 1.8);
      const mark = clamp((T - AT[4]) / 1.6);
      const metal = mix(mix(HOT, EMBER, clamp(T / 5)), tone, cool);
      const heat = 1 - cool;

      ctx.lineCap = "round";
      ctx.textBaseline = "middle";

      // the anvil, and the glow of the work on it
      ctx.fillStyle = rgba(pal.ink, 0.86);
      ctx.beginPath();
      ctx.moveTo(cx - bw * 1.9, bottom + 10);
      ctx.lineTo(cx + bw * 1.9, bottom + 10);
      ctx.lineTo(cx + bw * 1.4, bottom + 26);
      ctx.lineTo(cx - bw * 1.4, bottom + 26);
      ctx.closePath();
      ctx.fill();
      if (heat > 0.02) {
        const g = ctx.createRadialGradient(cx, y((k.o + k.c) / 2), 0, cx, y((k.o + k.c) / 2), h * 0.6);
        g.addColorStop(0, rgba(EMBER, 0.22 * heat));
        g.addColorStop(1, rgba(EMBER, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // the mould: where the body will be
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(pal.ink3, 0.6 * (1 - cool));
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - bw / 2, y(Math.max(k.o, k.c)), bw, y(Math.min(k.o, k.c)) - y(Math.max(k.o, k.c)));
      ctx.setLineDash([]);

      // the pour: a crucible, and the stream into the mould
      if (T < 2.6 && !still) {
        const lipX = cx - bw * 0.1;
        const lipY = top - 4;
        ctx.save();
        ctx.translate(cx - bw * 1.5, top - 2);
        ctx.rotate(lerp(0, 0.5, smooth(T / 0.5)) - smooth((T - 2.1) / 0.5) * 0.5);
        ctx.fillStyle = rgba(pal.ink, 0.9);
        ctx.beginPath();
        ctx.moveTo(-26, -16);
        ctx.lineTo(30, -16);
        ctx.lineTo(22, 12);
        ctx.lineTo(-18, 12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = rgba(HOT, 0.95);
        ctx.fillRect(-20, -15, 44, 4);
        ctx.restore();
        if (T > 0.4 && T < 2.2) {
          ctx.shadowColor = rgba(EMBER, 1);
          ctx.shadowBlur = 16;
          ctx.strokeStyle = rgba(HOT, 0.95);
          ctx.lineWidth = 4 + Math.sin(T * 40) * 0.8;
          ctx.beginPath();
          ctx.moveTo(lipX - 14, lipY);
          ctx.quadraticCurveTo(lipX, lipY + 6, cx, lerp(y(k.o), y(k.c), pour));
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // the wicks, drawn out by the hammer
      ctx.shadowColor = rgba(EMBER, heat);
      ctx.shadowBlur = 18 * heat;
      ctx.strokeStyle = rgba(metal, 1);
      ctx.lineWidth = 3;
      if (high > 0) {
        ctx.beginPath();
        ctx.moveTo(cx, y(Math.max(k.o, k.c)));
        ctx.lineTo(cx, lerp(y(Math.max(k.o, k.c)), y(k.h), high));
        ctx.stroke();
      }
      if (low > 0) {
        ctx.beginPath();
        ctx.moveTo(cx, y(Math.min(k.o, k.c)));
        ctx.lineTo(cx, lerp(y(Math.min(k.o, k.c)), y(k.l), low));
        ctx.stroke();
      }
      // the body
      const filled = lerp(y(k.o), y(k.c), pour);
      ctx.fillStyle = rgba(metal, 1);
      ctx.fillRect(cx - bw / 2, Math.min(y(k.o), filled), bw, Math.max(2, Math.abs(filled - y(k.o))));
      ctx.shadowBlur = 0;

      // the hammer: three blows for each wick, with sparks where it lands
      if (!still && T > AT[1] && T < AT[3]) {
        const local = (T - AT[1]) % 2;
        const beat = (local * 1.6) % 1; // 0 raised, 1 struck
        const lower = T >= AT[2];
        const hitY = lower ? lerp(y(Math.min(k.o, k.c)), y(k.l), low) : lerp(y(Math.max(k.o, k.c)), y(k.h), high);
        const swing = beat < 0.7 ? beat / 0.7 : 1 - (beat - 0.7) / 0.3;
        const hx = cx + bw * 0.9 + (1 - swing) * 46;
        const hy = hitY + (lower ? 1 : -1) * (1 - swing) * 40;
        ctx.strokeStyle = rgba(pal.ink2, 1);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(hx + 44, hy + (lower ? 26 : -26));
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.fillStyle = rgba(pal.ink, 0.92);
        ctx.fillRect(hx - 14, hy - 9, 26, 18);
        const since = beat >= 0.7 ? (beat - 0.7) / 0.3 : 1;
        if (since < 1) {
          for (let j = 0; j < 12; j++) {
            const a = (j / 12) * TAU + j;
            const d = since * (16 + (j % 5) * 9);
            ctx.fillStyle = rgba(HOT, 1 - since);
            ctx.fillRect(cx + Math.cos(a) * d, hitY + Math.sin(a) * d * 0.6 + since * since * 14, 2, 2);
          }
        }
      }
      // steam, as it cools
      if (!still && T > AT[3] && T < AT[4] + 0.6) {
        for (let j = 0; j < 7; j++) {
          const age = ((T - AT[3]) * 0.6 + j / 7) % 1;
          ctx.beginPath();
          ctx.arc(cx + Math.sin(j * 2.3 + age * 4) * bw * 0.7, y(Math.max(k.o, k.c)) - age * 60, 4 + age * 10, 0, TAU);
          ctx.fillStyle = rgba(pal.ink3, 0.22 * (1 - age));
          ctx.fill();
        }
      }

      // the four prices, stamped in the order they were made
      const marks = [
        ["OPEN", k.o, -1, AT[0]],
        ["HIGH", k.h, 1, AT[1] + 1.6],
        ["LOW", k.l, 1, AT[2] + 1.6],
        ["CLOSE", k.c, 1, AT[3] + 1.6],
      ] as const;
      ctx.font = `600 10px ${pal.font}`;
      for (const [name, v, side, at] of marks) {
        const a = smooth((T - at) / 0.6);
        if (a <= 0) continue;
        const x0 = cx + side * (bw / 2 + 8);
        const x1 = cx + side * (bw / 2 + 34);
        ctx.strokeStyle = rgba(pal.ink3, 0.9 * a);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y(v));
        ctx.lineTo(x1, y(v));
        ctx.stroke();
        ctx.textAlign = side > 0 ? "left" : "right";
        ctx.fillStyle = rgba(mark > 0 ? pal.ink : pal.ink2, a);
        ctx.fillText(name, x1 + side * 6, y(v));
      }
      if (mark > 0) {
        ctx.font = `600 11px ${pal.font}`;
        ctx.textAlign = "center";
        ctx.fillStyle = rgba(tone, mark);
        ctx.fillText(up ? "CLOSED ABOVE ITS OPEN" : "CLOSED BELOW ITS OPEN", cx, h - 12);
      }
    };
  }, [n]);

  return (
    <div>
      <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">
        <Figure draw={draw} ratio={1.5} rev={n} />
      </div>
      {controls && (
        <>
          <p className="mt-13 min-h-[3rem] text-ink-2" aria-live="polite">
            <span className="num mr-8 text-xs font-semibold tracking-[0.1em] text-prestige-ink">0{step + 1}</span>
            {STEPS[step]}
          </p>
          <div className="mt-8 flex flex-wrap gap-13">
            <button type="button" className="btn btn-primary" onClick={() => setN((v) => v + 1)}>
              Forge another
            </button>
          </div>
          <p className="mt-13 text-xs text-ink-3">An invented candle: four heights from a seed, not a price of anything.</p>
        </>
      )}
    </div>
  );
}
