"use client";

import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { Figure, clamp, lerp, rgba, type Colour, type FigureDraw } from "@/components/figures/Figure";
import { seeded } from "@/components/labs/workshop/rng";

/**
 * BUILD THE ORDER — entry, stop and target as three lines on a chart that can
 * be dragged (or moved with the sliders beneath, which do the same thing).
 * As they move, the order is read back: its side, the distance to the stop
 * and to the target, the ratio between them, and the size that makes the stop
 * cost the chosen share of the account.
 *
 * The chart is invented and the pair is an example quoted in US dollars, so a
 * pip on one standard lot is 10. The account is an example of 5,000. Nothing
 * is stored and nothing here is advice: it is the sum a trader does before
 * every trade, made visible.
 */

const LO = 1.08;
const HI = 1.1;
const PIP = 0.0001;
const BALANCE = 5000;
const PATH = (() => {
  const r = seeded(60606);
  const out: number[] = [];
  let p = 1.0875;
  for (let i = 0; i < 48; i++) {
    p = clamp(p + (r() - 0.48) * 0.0016, LO + 0.002, HI - 0.004);
    out.push(p);
  }
  return out;
})();
const NOW = PATH[PATH.length - 1];
const PAD = 14;
const STOP: Colour = [214, 96, 88, 1];

type Line = "entry" | "stop" | "target";
const snap = (v: number) => Math.round(clamp(v, LO + 0.0005, HI - 0.0005) / PIP) * PIP;

export function OrderBuilder() {
  const id = useId();
  const [v, setV] = useState({ entry: snap(NOW), stop: snap(NOW - 0.004), target: snap(NOW + 0.008) });
  const [risk, setRisk] = useState(1);
  const drag = useRef<Line | null>(null);

  const side = v.target >= v.entry ? "buy" : "sell";
  const stopPips = Math.round(Math.abs(v.entry - v.stop) / PIP);
  const targetPips = Math.round(Math.abs(v.target - v.entry) / PIP);
  const wrongSide = (v.stop - v.entry) * (v.target - v.entry) > 0;
  const valid = !wrongSide && stopPips > 0 && targetPips > 0;
  const amount = (BALANCE * risk) / 100;
  const lots = valid ? Math.floor((amount / (stopPips * 10)) * 100) / 100 : 0;
  const ratio = valid ? targetPips / stopPips : 0;

  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, pal }) => {
        if (w < 200 || h < 140) return;
        const y = (p: number) => lerp(h - PAD, PAD, (p - LO) / (HI - LO));
        const x = (i: number) => lerp(PAD, w - 96, i / (PATH.length - 1));
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        // the zones: what is risked, and what is aimed for
        if (valid) {
          ctx.fillStyle = rgba(STOP, 0.1);
          ctx.fillRect(PAD, Math.min(y(v.entry), y(v.stop)), w - PAD * 2, Math.abs(y(v.entry) - y(v.stop)));
          ctx.fillStyle = rgba(pal.emerald, 0.1);
          ctx.fillRect(PAD, Math.min(y(v.entry), y(v.target)), w - PAD * 2, Math.abs(y(v.entry) - y(v.target)));
        }
        ctx.beginPath();
        PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(x(i), y(p)) : ctx.lineTo(x(i), y(p))));
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = rgba(pal.ink2, 0.9);
        ctx.stroke();
        const rows: [Line, string, Colour][] = [
          ["target", "TARGET", pal.emerald],
          ["entry", "ENTRY", pal.accent],
          ["stop", "STOP", STOP],
        ];
        for (const [key, name, tone] of rows) {
          const yy = y(v[key]);
          ctx.setLineDash(key === "entry" ? [] : [6, 4]);
          ctx.beginPath();
          ctx.moveTo(PAD, yy);
          ctx.lineTo(w - PAD, yy);
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = rgba(tone, 1);
          ctx.stroke();
          ctx.setLineDash([]);
          // a handle to take hold of, with the level on it
          ctx.fillStyle = rgba(tone, 1);
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(w - PAD - 84, yy - 10, 84, 20, 4);
          else ctx.rect(w - PAD - 84, yy - 10, 84, 20);
          ctx.fill();
          ctx.font = `700 10px ${pal.font}`;
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(255,255,255,0.98)";
          ctx.fillText(`${name} ${v[key].toFixed(4)}`, w - PAD - 42, yy + 0.5);
        }
      },
    [v, valid],
  );

  const priceAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return lerp(HI, LO, clamp((e.clientY - r.top - PAD) / (r.height - PAD * 2)));
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    const p = priceAt(e);
    const nearest = (["entry", "stop", "target"] as Line[]).sort((a, b) => Math.abs(v[a] - p) - Math.abs(v[b] - p))[0];
    drag.current = nearest;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer has already gone: the line is still moved to where it was pressed */
    }
    setV((s) => ({ ...s, [nearest]: snap(p) }));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const key = drag.current;
    const p = snap(priceAt(e));
    setV((s) => (s[key] === p ? s : { ...s, [key]: p }));
  };
  const up = () => {
    drag.current = null;
  };
  const rev = Math.round((v.entry + v.stop * 3 + v.target * 7) * 10000);

  return (
    <div>
      <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">
        <div className="relative">
          <Figure draw={draw} ratio={1.5} rev={rev} />
          <div className="absolute inset-0 cursor-ns-resize touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden />
        </div>
      </div>
      <p className="mt-8 text-xs text-ink-3">Drag a line up or down, or use the sliders. An invented chart of an example pair quoted in US dollars.</p>

      <div className="mt-13 grid gap-13 sm:grid-cols-3">
        {(["target", "entry", "stop"] as Line[]).map((key) => (
          <div key={key} className="grid gap-3">
            <label htmlFor={`${id}-${key}`} className="label">
              {key}: <span className="num text-ink">{v[key].toFixed(4)}</span>
            </label>
            <input
              id={`${id}-${key}`}
              type="range"
              min={LO + 0.0005}
              max={HI - 0.0005}
              step={PIP}
              value={v[key]}
              onChange={(e) => setV((s) => ({ ...s, [key]: snap(Number(e.target.value)) }))}
              className="h-[2.75rem] w-full accent-[var(--accent)]"
              aria-valuetext={v[key].toFixed(4)}
            />
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-3">
        <label htmlFor={`${id}-risk`} className="label">
          Share of the account to risk: <span className="num text-ink">{risk}%</span> <span className="normal-case tracking-normal text-ink-3">of an example {BALANCE.toLocaleString("en-GB")}</span>
        </label>
        <input id={`${id}-risk`} type="range" min={0.5} max={5} step={0.5} value={risk} onChange={(e) => setRisk(Number(e.target.value))} className="h-[2.75rem] w-full accent-[var(--accent)]" aria-valuetext={`${risk} per cent`} />
      </div>

      <div className="mt-13 rounded-[8px] border border-line bg-paper p-21" aria-live="polite">
        {valid ? (
          <dl className="grid grid-cols-2 gap-x-21 gap-y-13 sm:grid-cols-4">
            <div>
              <dt className="label">Order</dt>
              <dd className="mt-3 font-display text-xl text-ink">{side === "buy" ? "Buy" : "Sell"}</dd>
            </div>
            <div>
              <dt className="label">To the stop</dt>
              <dd className="num mt-3 font-display text-xl text-ink">{stopPips} pips</dd>
            </div>
            <div>
              <dt className="label">To the target</dt>
              <dd className="num mt-3 font-display text-xl text-ink">{targetPips} pips</dd>
            </div>
            <div>
              <dt className="label">Risk to reward</dt>
              <dd className="num mt-3 font-display text-xl text-ink">1 : {ratio.toFixed(1)}</dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="label">Size that makes the stop cost {risk}%</dt>
              <dd className="mt-3 text-ink-2">
                <strong className="num font-display text-xl font-normal text-ink">{lots.toFixed(2)} lots</strong> · {amount.toLocaleString("en-GB")} ÷ ({stopPips} pips × 10 a pip){lots < 0.01 ? ". Smaller than the smallest lot: the stop is too far for this share of this account." : ""}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-ink">
            {wrongSide ? "The stop and the target are on the same side of the entry. A stop sits on the side where the trade is wrong: move one of them across." : "Move the stop and the target away from the entry."}
          </p>
        )}
      </div>
    </div>
  );
}
