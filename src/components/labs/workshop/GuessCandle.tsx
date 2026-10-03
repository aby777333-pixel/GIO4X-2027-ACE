"use client";

import { useMemo, useState } from "react";
import { Figure, clamp, lerp, rgba, smooth, type Colour, type FigureDraw } from "@/components/figures/Figure";
import { seeded } from "./rng";

/**
 * GUESS THE CANDLE — an honest lesson dressed as a game.
 *
 * Sixteen invented candles and a seventeenth that is hidden. Up or down? The
 * hidden candle's direction is one flip of a coin, drawn separately from
 * everything before it, so nothing on the chart can tell you. Play a few
 * rounds and the tally settles near half, which is the lesson: a chart that
 * looks as if it is telling you something can be telling you nothing.
 *
 * This is about these generated charts. It is not a claim about how real
 * markets behave, and the text beside the game says so.
 *
 * Nothing is stored: the tally lives only as long as the page is open.
 */

const SHOWN = 16;
const DOWN: Colour = [214, 96, 88, 1];

type Round = { candles: { o: number; h: number; l: number; c: number }[]; hidden: { o: number; h: number; l: number; c: number }; up: boolean };
function roundOf(n: number): Round {
  const r = seeded(4100 + n * 131);
  const candles = [];
  let p = 0.5;
  for (let i = 0; i < SHOWN; i++) {
    const o = p;
    const c = clamp(o + (r() - 0.5) * 0.16, 0.12, 0.88);
    candles.push({ o, c, h: Math.max(o, c) + r() * 0.05, l: Math.min(o, c) - r() * 0.05 });
    p = c;
  }
  // the hidden candle: its direction is one coin flip, from a generator of its own
  const coin = seeded(987654 + n * 7919);
  const up = coin() < 0.5;
  const size = 0.04 + coin() * 0.1;
  const c = p + (up ? size : -size);
  return { candles, hidden: { o: p, c, h: Math.max(p, c) + coin() * 0.04, l: Math.min(p, c) - coin() * 0.04 }, up };
}

export function GuessCandle() {
  const [n, setN] = useState(0);
  const [guess, setGuess] = useState<null | boolean>(null);
  const [tally, setTally] = useState({ played: 0, right: 0 });
  const round = useMemo(() => roundOf(n), [n]);
  const revealed = guess !== null;

  const draw = useMemo<FigureDraw>(() => {
    let since: number | null = null;
    return ({ ctx, w, h, t, pal, still }) => {
      if (w < 200 || h < 120) return;
      if (revealed && since === null) since = t;
      const open = revealed ? (still ? 1 : smooth((t - (since ?? t)) / 0.7)) : 0;
      const pad = 14;
      const step = (w - pad * 2) / (SHOWN + 1.6);
      const y = (v: number) => lerp(h - 18, 18, v);
      const x = (i: number) => pad + (i + 0.5) * step;

      const candle = (k: Round["hidden"], cx: number, alpha: number) => {
        const tone = k.c >= k.o ? pal.emerald : DOWN;
        ctx.strokeStyle = rgba(tone, alpha);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx, y(k.h));
        ctx.lineTo(cx, y(k.l));
        ctx.stroke();
        ctx.fillStyle = rgba(tone, alpha);
        ctx.fillRect(cx - step * 0.3, y(Math.max(k.o, k.c)), step * 0.6, Math.max(1.5, Math.abs(y(k.o) - y(k.c))));
      };
      round.candles.forEach((k, i) => candle(k, x(i), 0.92));

      // the hidden one: a covered slot, lifted when the answer is given
      const hx = x(SHOWN) + step * 0.3;
      const pulse = still ? 0.5 : (Math.sin(t * 2.4) + 1) / 2;
      if (open > 0) candle(round.hidden, hx, open);
      if (open < 1) {
        ctx.fillStyle = rgba(pal.surface, 1 - open);
        ctx.strokeStyle = rgba(pal.gold, (0.6 + pulse * 0.4) * (1 - open));
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.rect(hx - step * 0.5, 14 - open * 30, step, h - 28);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `600 ${Math.min(26, step)}px ${pal.font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = rgba(pal.gold, 1 - open);
        ctx.fillText("?", hx, h / 2);
      }
      // the last close, carried across to the hidden slot
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(x(SHOWN - 1), y(round.hidden.o));
      ctx.lineTo(hx + step * 0.5, y(round.hidden.o));
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(pal.ink3, 0.6);
      ctx.stroke();
      ctx.setLineDash([]);
    };
  }, [round, revealed]);

  const answer = (up: boolean) => {
    if (revealed) return;
    setGuess(up);
    setTally((s) => ({ played: s.played + 1, right: s.right + (up === round.up ? 1 : 0) }));
  };
  const next = () => {
    setGuess(null);
    setN((v) => v + 1);
  };
  const share = tally.played ? Math.round((tally.right / tally.played) * 100) : 0;

  return (
    <div>
      <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">
        <Figure draw={draw} ratio={2.1} rev={n * 2 + (revealed ? 1 : 0)} />
      </div>
      <div className="mt-13 flex flex-wrap items-center gap-13">
        {!revealed ? (
          <>
            <span className="label">The hidden candle closes</span>
            <button type="button" className="btn btn-ghost" onClick={() => answer(true)}>
              Up
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => answer(false)}>
              Down
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={next}>
            Another chart
          </button>
        )}
        <span className="num ml-auto text-sm text-ink-3">
          {tally.right} right of {tally.played}
          {tally.played >= 4 ? ` · ${share}%` : ""}
        </span>
      </div>
      <p className="mt-13 min-h-[4.5rem] text-ink-2" aria-live="polite">
        {!revealed
          ? "Sixteen candles, then one you cannot see. Study them as long as you like."
          : `It closed ${round.up ? "up" : "down"}: you were ${guess === round.up ? "right" : "wrong"}. Either way it was luck. The hidden candle is one flip of a coin, drawn apart from the sixteen before it, so nothing on the chart could have told you.`}
        {revealed && tally.played >= 6 ? " Keep playing and the tally settles near half." : ""}
      </p>
      <p className="mt-8 text-xs text-ink-3">Invented charts from a generator. This shows how easily a pattern is seen where there is none; it is not a statement about any real market.</p>
    </div>
  );
}
