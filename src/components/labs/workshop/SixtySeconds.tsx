"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Figure, TAU, lerp, rgba, type Colour, type FigureDraw } from "@/components/figures/Figure";
import { noteScore, usePlay } from "@/components/play/store";
import { seeded } from "./rng";

/**
 * SIXTY SECONDS — one minute on an invented price, to try to beat the desk.
 *
 * The price is a coin-flip walk from a new seed each round: four steps a
 * second, each as likely up as down. One position at a time, one fixed size,
 * and a spread of one pip paid on every trade. The score is the pips kept
 * when the minute ends.
 *
 * The lesson is in the ending. On a walk like this no method can find an edge,
 * so across many rounds the average score is what was paid in spread, and the
 * round's summary says so. It is a game about cost, not a practice of trading:
 * real markets are not this walk, and a score here says nothing about them.
 *
 * The best score is kept in this browser (gx:play), and only that.
 */

const TICKS = 240;
const PER_SECOND = 4;
const PIP = 0.0001;
const SPREAD = 1; // pips, paid across each round trip
const DOWN: Colour = [214, 96, 88, 1];

type Game = { phase: "idle" | "run" | "done"; t0: number; path: number[]; side: 0 | 1 | -1; entry: number; banked: number; trades: number };
const fresh = (): Game => ({ phase: "idle", t0: 0, path: [1], side: 0, entry: 0, banked: 0, trades: 0 });

function pathOf(seed: number): number[] {
  const r = seeded(seed);
  const out = [1];
  for (let i = 1; i <= TICKS; i++) out.push(out[i - 1] + (r() - 0.5) * 2 * 3 * PIP);
  return out;
}
const fmt = (pips: number) => `${pips > 0 ? "+" : ""}${pips.toFixed(1)}`;

export function SixtySeconds() {
  const game = useRef<Game>(fresh());
  const [view, setView] = useState({ phase: "idle" as Game["phase"], left: 60, score: 0, side: 0 as Game["side"], trades: 0, best: false });
  const [rev, setRev] = useState(0);
  const play = usePlay();

  const indexNow = () => Math.min(TICKS, Math.floor(((performance.now() - game.current.t0) / 1000) * PER_SECOND));
  const openPips = (g: Game, i: number) => (g.side === 0 ? 0 : ((g.path[i] - g.entry) / PIP) * g.side - SPREAD);

  const sync = (best = false) => {
    const g = game.current;
    const i = g.phase === "run" ? indexNow() : g.phase === "done" ? TICKS : 0;
    setView({ phase: g.phase, left: Math.max(0, Math.ceil(60 - i / PER_SECOND)), score: g.banked + openPips(g, i), side: g.side, trades: g.trades, best });
    setRev((v) => v + 1);
  };

  const close = () => {
    const g = game.current;
    if (g.side === 0) return;
    g.banked += openPips(g, g.phase === "done" ? TICKS : indexNow());
    g.side = 0;
  };
  const open = (side: 1 | -1) => {
    const g = game.current;
    if (g.phase !== "run") return;
    close();
    g.side = side;
    g.entry = g.path[indexNow()];
    g.trades += 1;
    sync();
  };
  const start = () => {
    game.current = { ...fresh(), phase: "run", t0: performance.now(), path: pathOf(Math.floor(Math.random() * 2 ** 31)) };
    sync();
  };

  useEffect(() => {
    if (view.phase !== "run") return;
    const id = window.setInterval(() => {
      const g = game.current;
      if (indexNow() >= TICKS) {
        g.phase = "done";
        close();
        sync(g.trades > 0 && noteScore(Math.round(g.banked * 10) / 10));
      } else sync();
    }, 250);
    return () => window.clearInterval(id);
    // the interval reads the game through a ref: it starts and stops with the phase alone
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.phase]);

  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, pal }) => {
        if (w < 200 || h < 120) return;
        const g = game.current;
        const i = g.phase === "run" ? indexNow() : g.phase === "done" ? TICKS : 0;
        const pad = 12;
        const lo = Math.min(...g.path) - 2 * PIP;
        const hi = Math.max(...g.path) + 2 * PIP;
        const x = (k: number) => lerp(pad, w - pad, k / TICKS);
        const y = (p: number) => lerp(h - 22, 14, (p - lo) / (hi - lo || 1));

        // the minute, as a bar that fills
        ctx.fillStyle = rgba(pal.line, 1);
        ctx.fillRect(pad, h - 8, w - pad * 2, 3);
        ctx.fillStyle = rgba(pal.gold, 1);
        ctx.fillRect(pad, h - 8, (w - pad * 2) * (i / TICKS), 3);

        if (g.phase === "idle") {
          ctx.font = `500 13px ${pal.font}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = rgba(pal.ink3, 1);
          ctx.fillText("An invented price will run here for sixty seconds", w / 2, h / 2);
          return;
        }
        // where the walk began
        ctx.setLineDash([2, 5]);
        ctx.strokeStyle = rgba(pal.ink3, 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, y(1));
        ctx.lineTo(w - pad, y(1));
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        for (let k = 0; k <= i; k++) {
          if (k === 0) ctx.moveTo(x(k), y(g.path[k]));
          else ctx.lineTo(x(k), y(g.path[k]));
        }
        ctx.lineWidth = 1.6;
        ctx.lineJoin = "round";
        ctx.strokeStyle = rgba(pal.accent, 1);
        ctx.stroke();

        if (g.side !== 0) {
          const winning = (g.path[i] - g.entry) * g.side > SPREAD * PIP;
          const tone = winning ? pal.emerald : DOWN;
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = rgba(tone, 1);
          ctx.beginPath();
          ctx.moveTo(pad, y(g.entry));
          ctx.lineTo(w - pad, y(g.entry));
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = `600 10px ${pal.font}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = rgba(tone, 1);
          ctx.fillText(g.side > 0 ? "BOUGHT HERE" : "SOLD HERE", pad + 4, y(g.entry) - 9);
        }
        ctx.beginPath();
        ctx.arc(x(i), y(g.path[i]), 4, 0, TAU);
        ctx.fillStyle = rgba(pal.accent, 1);
        ctx.fill();
      },
    // the drawing reads the game through a ref and is asked to repaint by `rev`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const card = async () => {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 630;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    ctx.fillStyle = "#0c1116";
    ctx.fillRect(0, 0, 1200, 630);
    ctx.strokeStyle = "rgba(201,169,106,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(34, 34, 1132, 562);
    ctx.fillStyle = "rgba(238,240,241,0.6)";
    ctx.font = `600 26px ${font}`;
    ctx.fillText("SIXTY SECONDS  ·  GIO4X LABS", 80, 120);
    ctx.fillStyle = "#eef0f1";
    ctx.font = `300 190px ${font}`;
    ctx.fillText(`${fmt(view.score)}`, 72, 350);
    ctx.font = `400 44px ${font}`;
    ctx.fillText(`pips in one minute, over ${view.trades} ${view.trades === 1 ? "trade" : "trades"}`, 80, 430);
    ctx.fillStyle = "rgba(201,169,106,1)";
    ctx.font = `600 26px ${font}`;
    ctx.fillText("A game on an invented price. Not a trading result.", 80, 530);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
    if (!blob) return;
    const file = new File([blob], "gio4x-sixty-seconds.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Sixty seconds" });
        return;
      } catch {
        /* the share sheet was closed: fall through to saving the picture */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const running = view.phase === "run";
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-34 gap-y-5">
        <p>
          <span className="label">Time left</span> <span className="num ml-5 font-display text-2xl text-ink">{view.left}s</span>
        </p>
        <p>
          <span className="label">Score</span>{" "}
          <span className={`num ml-5 font-display text-2xl ${view.score > 0 ? "text-pos" : view.score < 0 ? "text-neg" : "text-ink"}`}>{fmt(view.score)}</span> <span className="text-xs text-ink-3">pips</span>
        </p>
        <p className="ml-auto text-sm text-ink-3">
          <span className="label">Your best</span> <span className="num ml-5 text-ink">{play.b === undefined ? "none yet" : `${fmt(play.b)} pips`}</span>
        </p>
      </div>
      <div className="flat mt-13 rounded-[8px] border border-line bg-surface/60 p-13">
        <Figure draw={draw} ratio={2.1} rev={rev} />
      </div>
      <div className="mt-13 flex flex-wrap gap-13">
        {running ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => open(1)} aria-pressed={view.side === 1}>
              Buy
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => open(-1)} aria-pressed={view.side === -1}>
              Sell
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={view.side === 0}
              onClick={() => {
                close();
                sync();
              }}
            >
              Close
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={start}>
              {view.phase === "done" ? "Play again" : "Start the minute"}
            </button>
            {view.phase === "done" && view.trades > 0 && (
              <button type="button" className="btn btn-ghost" onClick={card}>
                Save the score card
              </button>
            )}
          </>
        )}
      </div>
      <p className="mt-13 min-h-[4.5rem] text-ink-2" aria-live="polite">
        {view.phase === "idle" && "Buy if you think it will rise, sell if you think it will fall, close when you like. One position at a time, and every trade costs one pip of spread."}
        {running && (view.side === 0 ? "No position. Buy or sell to open one." : `${view.side > 0 ? "Bought" : "Sold"}: this trade started one pip behind, which is the spread.`)}
        {view.phase === "done" &&
          (view.trades === 0
            ? "The minute ended with no trade made, so nothing was paid and nothing was scored."
            : `The minute is over: ${fmt(view.score)} pips over ${view.trades} ${view.trades === 1 ? "trade" : "trades"}${view.best ? ", your best so far" : ""}. You paid ${view.trades} ${view.trades === 1 ? "pip" : "pips"} in spread. The price was a coin-flip walk, so over many rounds the average comes out at about what the spread cost: the fewer the trades, the less is paid.`)}
      </p>
      <p className="mt-8 text-xs text-ink-3">An invented price from a new seed each round. A real market is not this walk, and a score here says nothing about one. Your best score is kept in this browser only.</p>
    </div>
  );
}
