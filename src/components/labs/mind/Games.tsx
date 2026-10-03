"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TAU, lerp, rgba, type FigureDraw } from "@/components/figures/Figure";
import { Note, Stage } from "@/components/labs/kit";
import { seeded } from "@/components/labs/workshop/rng";

/**
 * THE MIND ROOM — four games about the person in front of the screen.
 *
 * Markets are hard partly because of how people think. Each game sets up one
 * well-known trap and lets the visitor walk into it, then says what happened.
 * Every chart is generated; every headline is invented; nothing is scored
 * against money and nothing is stored. None of it says what a market will do:
 * the lesson each time is how little can be known.
 */

/* ---------------------------------------------------------------------------
 * 1. SPOT THE COIN FLIPS — two generated charts. One is nothing but coin
 *    flips. The other has a real, built-in tilt. Say which is the coin. It is
 *    harder than it sounds, because pure chance draws convincing trends.
 * ------------------------------------------------------------------------- */

const LEN = 90;
function pairOf(n: number): { a: number[]; b: number[]; coin: 0 | 1 } {
  const r = seeded(31337 + n * 911);
  const make = (tilt: number) => {
    const out: number[] = [];
    let p = 0;
    for (let i = 0; i < LEN; i++) {
      p += r() - 0.5 + tilt;
      out.push(p);
    }
    return out;
  };
  const coin = r() < 0.5 ? 0 : 1;
  const tilt = (r() < 0.5 ? -1 : 1) * 0.045; // small, but real
  const first = make(coin === 0 ? 0 : tilt);
  const second = make(coin === 1 ? 0 : tilt);
  return { a: first, b: second, coin };
}

function lineDraw(series: number[], reveal: string | null, good: boolean): FigureDraw {
  return ({ ctx, w, h, pal }) => {
    if (w < 100 || h < 60) return;
    const lo = Math.min(...series);
    const hi = Math.max(...series);
    ctx.beginPath();
    series.forEach((v, i) => {
      const x = lerp(8, w - 8, i / (LEN - 1));
      const y = lerp(h - 10, 10, (v - lo) / (hi - lo || 1));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineWidth = 1.7;
    ctx.lineJoin = "round";
    ctx.strokeStyle = rgba(reveal ? (good ? pal.emerald : pal.ink3) : pal.accent, 1);
    ctx.stroke();
    if (reveal) {
      ctx.font = `600 10px ${pal.font}`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(pal.ink, 1);
      ctx.fillText(reveal, 10, 12);
    }
  };
}

export function SpotTheCoin() {
  const [n, setN] = useState(0);
  const [picked, setPicked] = useState<0 | 1 | null>(null);
  const [tally, setTally] = useState({ played: 0, right: 0 });
  const pair = useMemo(() => pairOf(n), [n]);
  const done = picked !== null;
  const drawA = useMemo(() => lineDraw(pair.a, done ? (pair.coin === 0 ? "COIN FLIPS" : "BUILT-IN TILT") : null, pair.coin === 0), [pair, done]);
  const drawB = useMemo(() => lineDraw(pair.b, done ? (pair.coin === 1 ? "COIN FLIPS" : "BUILT-IN TILT") : null, pair.coin === 1), [pair, done]);
  const choose = (i: 0 | 1) => {
    if (done) return;
    setPicked(i);
    setTally((s) => ({ played: s.played + 1, right: s.right + (i === pair.coin ? 1 : 0) }));
  };
  return (
    <div>
      <div className="grid gap-13 sm:grid-cols-2">
        {[drawA, drawB].map((d, i) => (
          <div key={i}>
            <Stage draw={d} ratio={1.7} rev={n * 2 + (done ? 1 : 0)} />
            <button type="button" className="btn btn-ghost mt-8 w-full" disabled={done} aria-pressed={picked === i} onClick={() => choose(i as 0 | 1)}>
              Chart {i === 0 ? "A" : "B"} is the coin
            </button>
          </div>
        ))}
      </div>
      <p className="mt-13 min-h-[4.5rem] text-ink-2" aria-live="polite">
        {!done
          ? "One of these is pure coin flips. The other was built with a small, steady tilt. Which is the coin?"
          : `${picked === pair.coin ? "Right." : "No."} Chart ${pair.coin === 0 ? "A" : "B"} was the coin flips. Chance alone draws runs, turns and “trends”; a real tilt this small is hard to tell from it by eye.`}
        {done && tally.played >= 5 ? ` You have ${tally.right} of ${tally.played}. Guessing blind would average half.` : ""}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-13">
        {done && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPicked(null);
              setN((v) => v + 1);
            }}
          >
            Another pair
          </button>
        )}
        <span className="num ml-auto text-sm text-ink-3">
          {tally.right} right of {tally.played}
        </span>
      </div>
      <Note>Both charts are generated. This is about how easily the eye finds a pattern in noise, not a claim about any real market.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 2. THE PATIENCE GAME — a trade is on and the only control is "Close". The
 *    price is a coin-flip walk, so closing early or late is not skill. What
 *    the game shows is the urge: how soon the hand goes to the button on a
 *    small gain, and how long it stays away on a loss.
 * ------------------------------------------------------------------------- */

const P_TICKS = 120;
const P_SECONDS = 30;

export function Patience() {
  const game = useRef({ path: [0], t0: 0, closedAt: -1 });
  const [phase, setPhase] = useState<"idle" | "run" | "done">("idle");
  const [now, setNow] = useState(0);
  const [log, setLog] = useState<{ closed: number; at: number; end: number }[]>([]);

  const idx = () => Math.min(P_TICKS, Math.floor(((performance.now() - game.current.t0) / 1000) * (P_TICKS / P_SECONDS)));
  const start = () => {
    const r = seeded(Math.floor(Math.random() * 2 ** 31));
    const path = [0];
    for (let i = 1; i <= P_TICKS; i++) path.push(path[i - 1] + (r() - 0.5) * 6);
    game.current = { path, t0: performance.now(), closedAt: -1 };
    setNow(0);
    setPhase("run");
  };
  const finish = () => {
    const g = game.current;
    const at = g.closedAt < 0 ? P_TICKS : g.closedAt;
    setLog((l) => [...l, { closed: g.path[at], at, end: g.path[P_TICKS] }].slice(-8));
    setPhase("done");
  };
  useEffect(() => {
    if (phase !== "run") return;
    const id = window.setInterval(() => {
      const i = idx();
      setNow(i);
      if (i >= P_TICKS) finish();
    }, 200);
    return () => window.clearInterval(id);
    // the interval reads the game through a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, pal }) => {
        if (w < 160 || h < 100) return;
        const g = game.current;
        if (phase === "idle") {
          ctx.font = `500 13px ${pal.font}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = rgba(pal.ink3, 1);
          ctx.fillText("A trade will open here, and run for thirty seconds", w / 2, h / 2);
          return;
        }
        const upto = phase === "done" ? P_TICKS : idx();
        const lo = Math.min(...g.path) - 2;
        const hi = Math.max(...g.path) + 2;
        const x = (i: number) => lerp(10, w - 10, i / P_TICKS);
        const y = (v: number) => lerp(h - 12, 12, (v - lo) / (hi - lo));
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = rgba(pal.ink3, 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(10, y(0));
        ctx.lineTo(w - 10, y(0));
        ctx.stroke();
        ctx.setLineDash([]);
        const seg = (from: number, to: number, c: string) => {
          ctx.beginPath();
          for (let i = from; i <= to; i++) {
            if (i === from) ctx.moveTo(x(i), y(g.path[i]));
            else ctx.lineTo(x(i), y(g.path[i]));
          }
          ctx.lineWidth = 1.7;
          ctx.lineJoin = "round";
          ctx.strokeStyle = c;
          ctx.stroke();
        };
        const held = g.closedAt < 0 ? upto : Math.min(upto, g.closedAt);
        seg(0, held, rgba(pal.accent, 1));
        // after the close: what you did not see, drawn only once the time is up
        if (g.closedAt >= 0 && phase === "done") seg(g.closedAt, P_TICKS, rgba(pal.ink3, 0.8));
        if (g.closedAt >= 0) {
          ctx.beginPath();
          ctx.arc(x(g.closedAt), y(g.path[g.closedAt]), 5, 0, TAU);
          ctx.fillStyle = rgba(pal.gold, 1);
          ctx.fill();
        }
      },
    [phase],
  );
  const g = game.current;
  const open = phase === "run" && g.closedAt < 0;
  const value = phase === "idle" ? 0 : g.path[g.closedAt >= 0 ? g.closedAt : Math.min(now, P_TICKS)];
  const last = log[log.length - 1];
  const early = log.filter((l) => l.at < P_TICKS);
  const cutGains = early.filter((l) => l.closed > 0).length;
  const cutLosses = early.filter((l) => l.closed <= 0).length;
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-34 gap-y-5">
        <p>
          <span className="label">Time left</span> <span className="num ml-5 font-display text-2xl text-ink">{phase === "run" ? Math.max(0, Math.ceil(P_SECONDS - now / (P_TICKS / P_SECONDS))) : phase === "done" ? 0 : P_SECONDS}s</span>
        </p>
        <p>
          <span className="label">{g.closedAt >= 0 ? "Closed at" : "Open result"}</span>{" "}
          <span className={`num ml-5 font-display text-2xl ${value > 0 ? "text-pos" : value < 0 ? "text-neg" : "text-ink"}`}>
            {value > 0 ? "+" : ""}
            {value.toFixed(1)}
          </span>{" "}
          <span className="text-xs text-ink-3">pips</span>
        </p>
      </div>
      <div className="mt-13">
        <Stage draw={draw} ratio={2.2} rev={now + (phase === "done" ? 1000 : 0) + (g.closedAt >= 0 ? 500 : 0)} />
      </div>
      <div className="mt-13 flex flex-wrap gap-13">
        {phase === "run" ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!open}
            onClick={() => {
              game.current.closedAt = idx();
              setNow(idx());
            }}
          >
            {open ? "Close" : "Closed: wait for the end"}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={start}>
            {phase === "done" ? "Another trade" : "Open the trade"}
          </button>
        )}
      </div>
      <p className="mt-13 min-h-[4.5rem] text-ink-2" aria-live="polite">
        {phase === "idle" && "One trade, thirty seconds, one button. Close whenever you like, or not at all."}
        {phase === "run" && (open ? "It is open. Watch what your hand wants to do." : "You are out. The rest plays on without you, and is shown at the end.")}
        {phase === "done" &&
          last &&
          (last.at < P_TICKS
            ? `You closed at ${last.closed > 0 ? "+" : ""}${last.closed.toFixed(1)}; left alone it would have ended at ${last.end > 0 ? "+" : ""}${last.end.toFixed(1)}. Neither was knowable: the price was a coin-flip walk.`
            : `You held to the end: ${last.end > 0 ? "+" : ""}${last.end.toFixed(1)}. On a coin-flip walk, holding was no wiser than closing.`)}
        {phase === "done" && early.length >= 3 ? ` So far you closed early on a gain ${cutGains} ${cutGains === 1 ? "time" : "times"} and on a loss ${cutLosses}. Many people take gains quickly and sit on losses.` : ""}
      </p>
      <Note>A coin-flip walk from a new seed each time, with no spread. It is about the urge to act, not a way to practise trading.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 3. THE BIAS DETECTOR — six quick choices. Each is a classic from the study
 *    of how people decide; the answer many people give shows a well-known
 *    lean. Nothing is scored: the result is a list of the leans your own
 *    answers showed, each with the reason it matters to a trader.
 * ------------------------------------------------------------------------- */

const QUESTIONS: { q: string; a: [string, string]; lean: 0 | 1; name: string; why: string }[] = [
  {
    q: "You are offered a choice. Which do you take?",
    a: ["A certain gain of 500", "A coin flip: 1,000 or nothing"],
    lean: 0,
    name: "Risk-averse in gains",
    why: "Both are worth the same on average. Preferring the sure thing is why winning trades get closed early.",
  },
  {
    q: "Now a different choice. Which do you take?",
    a: ["A certain loss of 500", "A coin flip: lose 1,000 or lose nothing"],
    lean: 1,
    name: "Risk-seeking in losses",
    why: "Again the same on average. Preferring the gamble is why losing trades get held, and stops get moved.",
  },
  {
    q: "A coin has landed heads five times in a row. The next flip is…",
    a: ["More likely tails: it is due", "Still an even chance"],
    lean: 0,
    name: "The gambler’s fallacy",
    why: "The coin has no memory. Nor does a run of losing trades make the next one more likely to win.",
  },
  {
    q: "You bought at 100. It is now 80, and what you know says it is fairly priced at 80. You…",
    a: ["Hold until it is back at 100", "Decide as if you had no position"],
    lean: 0,
    name: "Anchoring on your entry",
    why: "The market does not know your entry price. Only you are anchored to it.",
  },
  {
    q: "You hold a view on a pair. Which do you read first?",
    a: ["An article that agrees with you", "An article that argues the opposite"],
    lean: 0,
    name: "Confirmation bias",
    why: "Evidence that agrees feels better and teaches less. The case against your trade is the useful one.",
  },
  {
    q: "Compared with other people who trade, your judgement is…",
    a: ["Better than most", "About average, or I cannot know"],
    lean: 0,
    name: "Overconfidence",
    why: "Most people place themselves above average, which cannot be true of most. It shows up as size that is too large.",
  },
];

export function BiasDetector() {
  const [answers, setAnswers] = useState<number[]>([]);
  const at = answers.length;
  const done = at >= QUESTIONS.length;
  const shown = QUESTIONS.filter((x, i) => answers[i] === x.lean);
  return (
    <div>
      {!done ? (
        <div>
          <p className="label">
            Question {at + 1} of {QUESTIONS.length}
          </p>
          <p className="mt-8 font-display text-xl leading-snug text-ink">{QUESTIONS[at].q}</p>
          <div className="mt-13 grid gap-8 sm:grid-cols-2" role="group" aria-label="Choose one">
            {QUESTIONS[at].a.map((opt, i) => (
              <button key={opt} type="button" className="btn btn-ghost justify-start text-left !normal-case" onClick={() => setAnswers((a) => [...a, i])}>
                {opt}
              </button>
            ))}
          </div>
          <p className="mt-13 text-sm text-ink-3">Answer quickly, as you would in the moment. There are no right answers yet.</p>
        </div>
      ) : (
        <div aria-live="polite">
          <p className="font-display text-xl leading-snug text-ink">
            {shown.length === 0 ? "None of the six leans showed in your answers." : `Your answers showed ${shown.length} of the six common leans.`}
          </p>
          <ul className="mt-13 border-t border-line">
            {QUESTIONS.map((x, i) => {
              const hit = answers[i] === x.lean;
              return (
                <li key={x.name} className="grid grid-cols-[1.3125rem_minmax(0,1fr)] gap-x-13 border-b border-line py-13">
                  <span aria-hidden className={`mt-[0.45em] h-[0.625rem] w-[0.625rem] rounded-full ${hit ? "bg-accent" : "border border-line-strong"}`} />
                  <div>
                    <p className={`font-medium ${hit ? "text-ink" : "text-ink-3"}`}>
                      {x.name}
                      <span className="sr-only">{hit ? ": shown" : ": not shown"}</span>
                    </p>
                    <p className="mt-3 text-sm text-ink-2">{x.why}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn btn-ghost mt-13" onClick={() => setAnswers([])}>
            Start again
          </button>
        </div>
      )}
      <Note>Six well-known questions from the study of decisions. A lean is a habit of mind that everyone has to some degree, not a fault; knowing it is there is the use of it.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 4. THE HEADLINE GAME — an invented headline. Up, down, or cannot say? Then
 *    both stories are told: why such news has sent a price up, and why the
 *    same news has sent it down. The lesson is that a headline alone does not
 *    settle the direction: what was already expected does.
 * ------------------------------------------------------------------------- */

const HEADLINES: { h: string; up: string; down: string }[] = [
  {
    h: "The jobs report beats the forecast",
    up: "More jobs suggest a stronger economy and rates staying higher: the currency firms.",
    down: "A strong report had been expected and bought in advance; with the news out, those buyers take their profit and it falls.",
  },
  {
    h: "The central bank raises its rate, as expected",
    up: "The statement beside the decision hints at more rises to come: the currency firms.",
    down: "The rise was fully expected and the statement hints it may be the last: the currency falls on the very day rates went up.",
  },
  {
    h: "Inflation falls more than forecast",
    up: "Lower inflation means the bank can cut rates, which lifts share indices.",
    down: "Lower inflation means lower rates ahead, which weakens the currency.",
  },
  {
    h: "Growth figures are revised down",
    up: "Weaker growth brings rate cuts nearer, and shares rise on cheaper money.",
    down: "Weaker growth means weaker profits, and shares fall.",
  },
  {
    h: "Oil inventories rise sharply",
    up: "The rise was smaller than traders had feared: the price recovers.",
    down: "More oil in store than expected means more supply: the price falls.",
  },
];

export function Headlines() {
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [cannot, setCannot] = useState(0);
  const [played, setPlayed] = useState(0);
  const item = HEADLINES[at % HEADLINES.length];
  const choose = (c: string) => {
    if (picked) return;
    setPicked(c);
    setPlayed((n) => n + 1);
    if (c === "Cannot say") setCannot((n) => n + 1);
  };
  return (
    <div>
      <p className="label">A headline, invented</p>
      <p className="mt-8 font-display text-2xl leading-snug text-ink">“{item.h}”</p>
      <div className="mt-13 flex flex-wrap gap-8" role="group" aria-label="What happens to the price?">
        {["Up", "Down", "Cannot say"].map((c) => (
          <button key={c} type="button" className="btn btn-ghost" disabled={!!picked} aria-pressed={picked === c} onClick={() => choose(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="mt-13 min-h-[9rem]" aria-live="polite">
        {picked ? (
          <>
            <dl className="grid gap-13 sm:grid-cols-2">
              <div className="border-l-2 border-pos pl-13">
                <dt className="label">How it has gone up</dt>
                <dd className="mt-3 text-sm text-ink-2">{item.up}</dd>
              </div>
              <div className="border-l-2 border-neg pl-13">
                <dt className="label">How it has gone down</dt>
                <dd className="mt-3 text-sm text-ink-2">{item.down}</dd>
              </div>
            </dl>
            <p className="mt-13 text-ink">
              {picked === "Cannot say" ? "That is the honest answer." : "Both have happened."} A headline does not settle the direction: what was already expected does, and the headline does not tell you that.
            </p>
          </>
        ) : (
          <p className="text-ink-2">The news is out. Which way does the price go?</p>
        )}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-13">
        {picked && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPicked(null);
              setAt((n) => n + 1);
            }}
          >
            Another headline
          </button>
        )}
        <span className="num ml-auto text-sm text-ink-3">
          “Cannot say” {cannot} of {played}
        </span>
      </div>
      <Note>Invented headlines and general explanations. Neither story is a prediction; each is a way such news has been read.</Note>
    </div>
  );
}
