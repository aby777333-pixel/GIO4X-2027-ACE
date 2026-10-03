"use client";

import { useMemo, useState } from "react";
import { TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";
import { ALERT, Stage } from "@/components/labs/kit";
import { seeded } from "@/components/labs/workshop/rng";

/**
 * THE MISTAKE MUSEUM — five classic errors, each replayed on an invented
 * price so that it can be watched from outside.
 *
 * The prices are made up and the trader is nobody. Each exhibit shows the
 * mechanism of the mistake (what is done, and what it does to the size of the
 * loss), with a plain account beside it and the habit that prevents it. None
 * is a prediction of what a market will do.
 */

/** a falling path with a bounce in it: the same for every exhibit, so they can be compared */
const PATH = (() => {
  const r = seeded(51515);
  const out: number[] = [];
  let p = 0.78;
  for (let i = 0; i < 60; i++) {
    const drift = i < 14 ? -0.004 : i < 24 ? 0.006 : -0.011;
    p = clamp(p + drift + (r() - 0.5) * 0.02, 0.06, 0.94);
    out.push(p);
  }
  return out;
})();

type Exhibit = { key: string; name: string; what: string; cost: string; habit: string };
export const EXHIBITS: readonly Exhibit[] = [
  {
    key: "move",
    name: "Moving the stop",
    what: "The price nears the stop, and the stop is moved further away to give the trade “room”. It nears again, and is moved again.",
    cost: "A loss that was planned and small becomes one that is unplanned and several times the size. The stop was the plan; moving it leaves no plan.",
    habit: "Decide the level before the trade, when you are calm. If it is reached, the trade is over.",
  },
  {
    key: "double",
    name: "Doubling down",
    what: "The trade is losing, so the same again is bought lower to “improve the average”. Then again.",
    cost: "The average entry does fall, but the size grows each time, so every further pip against costs two, then three times as much.",
    habit: "Add to a position only by a rule made in advance, and never to rescue one.",
  },
  {
    key: "revenge",
    name: "The revenge trade",
    what: "A loss is taken. To win it back at once, the next trade is opened in a hurry and at twice the size.",
    cost: "The second trade is made for the wrong reason and carries double the risk. One ordinary loss becomes three.",
    habit: "After a loss, the size stays the same or gets smaller. A fixed share of the account per trade does this by itself.",
  },
  {
    key: "none",
    name: "No stop at all",
    what: "No stop is placed: the plan is to watch the trade and close it by hand if it goes wrong.",
    cost: "The loss has no planned end. It depends on being at the screen, and on closing a losing trade at the moment that is hardest.",
    habit: "The stop goes in with the order. An order without one is not finished.",
  },
  {
    key: "over",
    name: "Overtrading",
    what: "In and out, again and again, on every wiggle. Each trade is small and none is a disaster.",
    cost: "Every trade pays the spread. Enough of them and the cost alone is a large loss, whatever the trades did.",
    habit: "Count the trades. Fewer, each with a reason written down, costs less than many without.",
  },
];

function drawFor(key: string): FigureDraw {
  let began: number | null = null;
  return ({ ctx, w, h, t, pal, still }) => {
    if (w < 200 || h < 130) return;
    if (began === null) began = t;
    const N = PATH.length;
    const upto = still ? N - 1 : Math.min(N - 1, Math.floor(((t - began) * 7) % (N + 14)));
    const pad = 14;
    const x = (i: number) => lerp(pad, w - pad - 60, i / (N - 1));
    const y = (v: number) => lerp(h - 30, 14, v);
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.font = `600 10px ${pal.font}`;

    ctx.beginPath();
    for (let i = 0; i <= upto; i++) {
      if (i === 0) ctx.moveTo(x(i), y(PATH[i]));
      else ctx.lineTo(x(i), y(PATH[i]));
    }
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = rgba(pal.ink2, 0.95);
    ctx.stroke();

    const entry = PATH[2];
    const mark = (i: number, label: string, tone = pal.accent) => {
      if (upto < i) return;
      ctx.beginPath();
      ctx.arc(x(i), y(PATH[i]), 4, 0, TAU);
      ctx.fillStyle = rgba(tone, 1);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.fillStyle = rgba(tone, 1);
      ctx.fillText(label, x(i) + 7, y(PATH[i]) - 9);
    };
    const level = (v: number, label: string, tone = ALERT, from = 0) => {
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x(from), y(v));
      ctx.lineTo(w - pad, y(v));
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = rgba(tone, 0.95);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = "right";
      ctx.fillStyle = rgba(tone, 1);
      ctx.fillText(label, w - pad, y(v) - 8);
    };
    // the loss so far, as a bar at the foot: its unit is the loss that was first planned
    let loss = 0;

    if (key === "move") {
      const first = entry - 0.1;
      const moves = [28, 36, 44].filter((i) => upto >= i).length;
      const stop = first - moves * 0.12;
      mark(2, "BOUGHT");
      level(first, "THE STOP, AS PLANNED", pal.ink3);
      if (moves > 0) level(stop, `MOVED ${moves === 1 ? "ONCE" : moves === 2 ? "TWICE" : "THREE TIMES"}`, ALERT);
      loss = clamp((entry - PATH[upto]) / 0.1, 0, 9);
    } else if (key === "double") {
      const adds = [2, 30, 40, 50];
      let units = 0;
      let cost = 0;
      adds.forEach((i, k) => {
        if (upto < i) return;
        units += 1;
        cost += PATH[i];
        mark(i, k === 0 ? "BOUGHT" : "AND AGAIN");
      });
      if (units > 0) {
        const avg = cost / units;
        level(avg, `AVERAGE ENTRY, ${units}× THE SIZE`, pal.gold);
        loss = clamp(((avg - PATH[upto]) * units) / 0.1, 0, 9);
      }
    } else if (key === "revenge") {
      mark(2, "BOUGHT");
      level(entry - 0.1, "STOP", pal.ink3);
      if (upto >= 30) mark(30, "STOPPED: ONE LOSS", ALERT);
      if (upto >= 33) mark(33, "BOUGHT AGAIN, DOUBLE");
      loss = upto < 30 ? clamp((entry - PATH[upto]) / 0.1, 0, 1) : 1 + (upto >= 33 ? clamp(((PATH[33] - PATH[upto]) * 2) / 0.1, 0, 8) : 0);
    } else if (key === "none") {
      mark(2, "BOUGHT, NO STOP");
      if (upto >= 34) {
        ctx.textAlign = "left";
        ctx.fillStyle = rgba(pal.ink3, 1);
        ctx.fillText("“I’LL WATCH IT”", x(30), 12);
      }
      loss = clamp((entry - PATH[upto]) / 0.1, 0, 9);
    } else {
      // in and out on every few steps: each one pays the spread
      let trades = 0;
      for (let i = 2; i <= upto; i += 3) {
        trades++;
        ctx.beginPath();
        ctx.arc(x(i), y(PATH[i]), 2.6, 0, TAU);
        ctx.fillStyle = rgba(i % 2 ? pal.accent : pal.gold, 1);
        ctx.fill();
      }
      ctx.textAlign = "left";
      ctx.fillStyle = rgba(pal.ink3, 1);
      ctx.fillText(`${trades} TRADES, ${trades} SPREADS PAID`, pad, 12);
      loss = clamp(trades * 0.22, 0, 9);
    }

    // the loss, measured in planned losses
    const bw = w - pad * 2;
    ctx.fillStyle = rgba(pal.line, 1);
    ctx.fillRect(pad, h - 10, bw, 5);
    ctx.fillStyle = rgba(loss > 1.05 ? ALERT : pal.accent, 1);
    ctx.fillRect(pad, h - 10, bw * smooth(loss / 6), 5);
    ctx.textAlign = "left";
    ctx.fillStyle = rgba(loss > 1.05 ? ALERT : pal.ink3, 1);
    ctx.fillText(key === "over" ? `COST SO FAR: ${loss.toFixed(1)}× ONE PLANNED LOSS` : `LOSS SO FAR: ${loss.toFixed(1)}× THE ONE THAT WAS PLANNED`, pad, h - 20);
  };
}

export function MistakeMuseum() {
  const [at, setAt] = useState(0);
  const [n, setN] = useState(0);
  const ex = EXHIBITS[at];
  // a new drawing each time an exhibit is opened, so that it plays from its beginning
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draw = useMemo(() => drawFor(ex.key), [ex.key, n]);
  return (
    <div>
      <div className="flex flex-wrap gap-8" role="group" aria-label="The exhibits">
        {EXHIBITS.map((e, i) => (
          <button
            key={e.key}
            type="button"
            className="btn btn-ghost !normal-case"
            aria-pressed={i === at}
            onClick={() => {
              setAt(i);
              setN((v) => v + 1);
            }}
          >
            {e.name}
          </button>
        ))}
      </div>
      <div className="mt-13">
        <Stage draw={draw} ratio={1.9} rev={n} />
      </div>
      <div className="mt-13" aria-live="polite">
        <h3 className="h3">{ex.name}</h3>
        <dl className="mt-13 grid gap-13">
          <div>
            <dt className="label">What is done</dt>
            <dd className="mt-3 max-w-measure text-ink-2">{ex.what}</dd>
          </div>
          <div>
            <dt className="label">What it costs</dt>
            <dd className="mt-3 max-w-measure text-ink-2">{ex.cost}</dd>
          </div>
          <div className="border-l-2 border-accent pl-13">
            <dt className="label">The habit that prevents it</dt>
            <dd className="mt-3 max-w-measure text-ink">{ex.habit}</dd>
          </div>
        </dl>
      </div>
      <p className="mt-13 text-xs text-ink-3">An invented price, the same in every exhibit. The bar at the foot measures the loss in units of the one loss that was first planned.</p>
    </div>
  );
}
