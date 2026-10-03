"use client";

import { useEffect, useRef, useState } from "react";

/**
 * THE PIP REELS — three reels that stop on a pair, a size and a move, and the
 * sum they make: what one pip is worth, and what that move comes to.
 *
 * It is the pip-value sum, shown many times over so that the pattern sinks
 * in: the value of a pip is the size multiplied by the pip, in the pair's
 * quote currency. There is nothing to win and nothing is scored. No exchange
 * rate is used, so the answer is given in the quote currency, where it is
 * exact.
 */

const PAIRS = [
  { sym: "EUR/USD", quote: "USD", pip: 0.0001 },
  { sym: "GBP/USD", quote: "USD", pip: 0.0001 },
  { sym: "AUD/USD", quote: "USD", pip: 0.0001 },
  { sym: "USD/JPY", quote: "JPY", pip: 0.01 },
  { sym: "USD/CHF", quote: "CHF", pip: 0.0001 },
  { sym: "USD/CAD", quote: "CAD", pip: 0.0001 },
  { sym: "EUR/GBP", quote: "GBP", pip: 0.0001 },
] as const;
const SIZES = [
  { lots: 0.01, name: "Micro lot", units: 1_000 },
  { lots: 0.1, name: "Mini lot", units: 10_000 },
  { lots: 1, name: "Standard lot", units: 100_000 },
] as const;
const MOVES = [5, 10, 20, 50, 100] as const;

const money = (v: number, ccy: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency: ccy, maximumFractionDigits: ccy === "JPY" ? 0 : 2 }).format(v);

export function PipReels() {
  const [at, setAt] = useState<[number, number, number]>([0, 1, 2]);
  const [spinning, setSpinning] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearInterval(t));
  }, []);

  const spin = () => {
    if (spinning.some(Boolean)) return;
    const final: [number, number, number] = [Math.floor(Math.random() * PAIRS.length), Math.floor(Math.random() * SIZES.length), Math.floor(Math.random() * MOVES.length)];
    const root = document.documentElement;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";
    if (still) {
      setAt(final);
      return;
    }
    setSpinning([true, true, true]);
    const lengths = [PAIRS.length, SIZES.length, MOVES.length];
    [0, 1, 2].forEach((reel) => {
      const started = performance.now();
      const lasts = 700 + reel * 450;
      const id = window.setInterval(() => {
        if (performance.now() - started >= lasts) {
          window.clearInterval(id);
          setAt((v) => {
            const n = [...v] as [number, number, number];
            n[reel] = final[reel];
            return n;
          });
          setSpinning((v) => {
            const n = [...v] as [boolean, boolean, boolean];
            n[reel] = false;
            return n;
          });
          return;
        }
        setAt((v) => {
          const n = [...v] as [number, number, number];
          n[reel] = (n[reel] + 1) % lengths[reel];
          return n;
        });
      }, 70);
      timers.current.push(id);
    });
  };

  const pair = PAIRS[at[0]];
  const size = SIZES[at[1]];
  const move = MOVES[at[2]];
  const perPip = size.units * pair.pip;
  const busy = spinning.some(Boolean);
  const reels = [
    { label: "Pair", value: pair.sym, sub: `quoted in ${pair.quote}`, on: spinning[0] },
    { label: "Size", value: String(size.lots), sub: `${size.name} · ${size.units.toLocaleString("en-GB")} units`, on: spinning[1] },
    { label: "Move", value: `${move} pips`, sub: `a pip here is ${pair.pip}`, on: spinning[2] },
  ];

  return (
    <div>
      <div className="grid gap-px overflow-hidden rounded-[8px] border border-line bg-line sm:grid-cols-3">
        {reels.map((r) => (
          <div key={r.label} className="bg-surface p-21 text-center">
            <p className="label">{r.label}</p>
            <p className={`gx-reel num mt-8 font-display text-2xl text-ink lg:text-3xl ${r.on ? "is-spinning" : ""}`}>{r.value}</p>
            <p className="mt-5 text-xs text-ink-3">{r.sub}</p>
          </div>
        ))}
      </div>
      <div className="mt-13 rounded-[8px] border border-line bg-paper p-21" aria-live="polite" aria-busy={busy}>
        <p className="label">The sum</p>
        <p className={`mt-8 text-ink-2 transition-opacity duration-fast ${busy ? "opacity-30" : ""}`}>
          <span className="num">{size.units.toLocaleString("en-GB")}</span> units × <span className="num">{pair.pip}</span> = one pip is worth <strong className="num text-ink">{money(perPip, pair.quote)}</strong>.
        </p>
        <p className={`mt-5 text-ink-2 transition-opacity duration-fast ${busy ? "opacity-30" : ""}`}>
          A move of <span className="num">{move}</span> pips is <strong className="num text-ink">{money(perPip * move, pair.quote)}</strong>, for you or against you.
        </p>
      </div>
      <div className="mt-13 flex flex-wrap items-center gap-13">
        <button type="button" className="btn btn-primary" onClick={spin} disabled={busy}>
          Spin the reels
        </button>
        <span className="text-xs text-ink-3">Nothing to win: it is the pip-value sum, in the pair’s quote currency.</span>
      </div>
    </div>
  );
}
