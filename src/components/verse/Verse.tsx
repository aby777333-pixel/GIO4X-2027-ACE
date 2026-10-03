"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Figure, TAU, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";
import { HUNT, noteHunt, usePlay } from "@/components/play/store";

/**
 * THE VERSE ROOM — rhyme as a way of remembering. A harder riddle each week,
 * an alphabet, a game of finishing couplets, a wall of old market sayings
 * with a verdict on each, and the riddles hidden round the site.
 *
 * Everything here describes what a word means or weighs up a saying. None of
 * it is advice and none of it says what a market will do.
 */

/* ---- 1. THE WEEKLY RIDDLE, THE HARD ONE ---------------------------------- */

const HARD: { clues: [string, string, string]; answer: string; options: string[]; slug: string }[] = [
  { clues: ["I am paid by everyone and charged by no one in particular.", "I am widest when the room is empty and narrowest when it is full.", "Buy and sell at the same instant, and I am what you have lost."], answer: "The spread", options: ["The spread", "The swap", "Commission", "Slippage"], slug: "spread" },
  { clues: ["I make nothing happen that would not have happened anyway.", "I am quoted as two numbers with a colon between them.", "With me, a small sum answers for a large one, in gain and in loss alike."], answer: "Leverage", options: ["Leverage", "Margin", "Volatility", "Liquidity"], slug: "leverage" },
  { clues: ["I exist only when you are not looking at the price.", "A weekend can make me; so can a single sentence from a central bank.", "On a chart I am the space where nothing was traded."], answer: "A gap", options: ["A gap", "A wick", "A breakout", "A pullback"], slug: "gap" },
  { clues: ["I am counted from the highest point, never from the start.", "The deeper I go, the further the way back, and not in proportion.", "At a half, it takes a doubling to undo me."], answer: "Drawdown", options: ["Drawdown", "Retracement", "Slippage", "Stop-out"], slug: "drawdown" },
  { clues: ["I am an instruction that may never be carried out.", "I wait at a price that is better than the one on offer now.", "If the market does not come to me, I do nothing at all."], answer: "A limit order", options: ["A limit order", "A market order", "A stop order", "A trailing stop"], slug: "limit-order" },
  { clues: ["I am charged at an hour most people are asleep.", "Once a week I arrive three times over.", "I am the difference between two countries’ interest rates, settled nightly."], answer: "Swap", options: ["Swap", "Spread", "Margin", "Rollover gap"], slug: "swap" },
  { clues: ["I am set aside, not spent, and I come back if all goes well.", "I am a fraction of the size of what I answer for.", "When there is too little above me, positions are closed."], answer: "Margin", options: ["Margin", "Equity", "Leverage", "Balance"], slug: "margin" },
  { clues: ["I am a number between minus one and one.", "I am measured over the past and can change without notice.", "When I am high, two trades are closer to one."], answer: "Correlation", options: ["Correlation", "Volatility", "Momentum", "Divergence"], slug: "correlation" },
];

export function WeeklyRiddle() {
  const [when, setWhen] = useState<{ week: number; day: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    const days = Math.floor(Date.now() / 86400000) - 4; // days since Monday 5 January 1970, UTC
    setWhen({ week: Math.floor(days / 7), day: ((days % 7) + 7) % 7 });
  }, []);
  if (!when) return <p className="gx-wait text-ink-3">This week’s riddle appears once the page has loaded.</p>;
  const r = HARD[when.week % HARD.length];
  const open = Math.min(3, when.day + 1);
  const done = picked !== null;
  return (
    <div>
      <ol className="grid gap-13">
        {r.clues.map((c, i) => (
          <li key={c} className={`grid grid-cols-[2.125rem_minmax(0,1fr)] gap-x-13 border-l-2 pl-13 ${i < open ? "border-prestige" : "border-line"}`}>
            <span className="num pt-2 text-xs font-semibold tracking-[0.1em] text-prestige-ink">0{i + 1}</span>
            <p className={i < open ? "font-display text-lg leading-snug text-ink" : "text-ink-3"}>{i < open ? c : `The ${["first", "second", "third"][i]} clue arrives on ${["Monday", "Tuesday", "Wednesday"][i]}.`}</p>
          </li>
        ))}
      </ol>
      <div className="mt-21 grid gap-8 sm:grid-cols-2" role="group" aria-label="Choose the answer">
        {r.options.map((o) => (
          <button
            key={o}
            type="button"
            className={`btn btn-ghost justify-start !normal-case ${done && o === r.answer ? "border-accent" : ""} ${done && o === picked && o !== r.answer ? "line-through opacity-60" : ""}`}
            disabled={done}
            aria-pressed={picked === o}
            onClick={() => setPicked(o)}
          >
            {o}
          </button>
        ))}
      </div>
      <p className="mt-13 min-h-[3rem] text-ink-2" aria-live="polite">
        {!done && (open < 3 ? "Answer now on the clues you have, or wait for the rest. One try." : "All three clues are out. One try.")}
        {done && (
          <>
            {picked === r.answer ? `Yes${open < 3 ? `, and on ${open === 1 ? "one clue" : "two clues"}` : ""}. ` : "Not that one. "}
            The answer is{" "}
            <Link href={`/glossary/${r.slug}`} className="link">
              {r.answer.replace(/^(A|An|The) /, "").toLowerCase()}
            </Link>
            . A new riddle begins each Monday.
          </>
        )}
      </p>
    </div>
  );
}

/* ---- 2. THE TRADER'S ALPHABET -------------------------------------------- */

type Motif = "rise" | "fall" | "candle" | "bars" | "wave" | "gap" | "scale" | "pair";
const ABC: { l: string; word: string; a: string; b: string; m: Motif }[] = [
  { l: "A", word: "Ask", a: "A is the Ask, the seller’s say:", b: "to buy at once, it’s what you pay.", m: "pair" },
  { l: "B", word: "Bid", a: "B is the Bid, the buyer’s price:", b: "to sell at once, it must suffice.", m: "pair" },
  { l: "C", word: "Candle", a: "C is the Candle, four in one:", b: "open, high, low, and close, then done.", m: "candle" },
  { l: "D", word: "Drawdown", a: "D is the Drawdown, peak to low:", b: "the deeper it is, the further to go.", m: "fall" },
  { l: "E", word: "Equity", a: "E is for Equity, the truer sum:", b: "the balance plus what’s yet to come.", m: "bars" },
  { l: "F", word: "Fill", a: "F is the Fill, the price you got:", b: "the one you asked for, or it’s not.", m: "gap" },
  { l: "G", word: "Gap", a: "G is the Gap, a leap through air:", b: "one price here and the next up there.", m: "gap" },
  { l: "H", word: "Hedge", a: "H is the Hedge, a second trade", b: "to blunt the loss the first has made.", m: "pair" },
  { l: "I", word: "Inflation", a: "I is Inflation, prices’ climb:", b: "the same note buys you less, in time.", m: "rise" },
  { l: "J", word: "Jobs", a: "J is for Jobs, the Friday count", b: "that markets wait for, large amount.", m: "bars" },
  { l: "K", word: "Kiwi", a: "K is the Kiwi, a dollar’s name:", b: "New Zealand’s own, a bird its claim.", m: "wave" },
  { l: "L", word: "Leverage", a: "L is for Leverage, small moves grown:", b: "the gain and the loss are both full-blown.", m: "scale" },
  { l: "M", word: "Margin", a: "M is for Margin, set aside:", b: "a stake that’s held while trades are live.", m: "scale" },
  { l: "N", word: "News", a: "N is the News that lands at a stroke:", b: "what matters is what was thought before it broke.", m: "gap" },
  { l: "O", word: "Order", a: "O is the Order, plain and clear:", b: "buy or sell, and the price you’d bear.", m: "candle" },
  { l: "P", word: "Pip", a: "P is the Pip, the smallest stride:", b: "the fourth decimal, on most, the guide.", m: "bars" },
  { l: "Q", word: "Quote", a: "Q is the Quote, two prices shown:", b: "one to sell at, one to own.", m: "pair" },
  { l: "R", word: "Risk", a: "R is for Risk, decided first:", b: "know before you trade the worst.", m: "scale" },
  { l: "S", word: "Spread", a: "S is the Spread, the gap between:", b: "a cost that’s paid though seldom seen.", m: "pair" },
  { l: "T", word: "Trend", a: "T is the Trend, the general way:", b: "plain looking back, less so today.", m: "rise" },
  { l: "U", word: "Uptick", a: "U is the Uptick, one step more:", b: "a trade above the one before.", m: "rise" },
  { l: "V", word: "Volatility", a: "V is Volatility, the size of the swing:", b: "not which way, just how wide a thing.", m: "wave" },
  { l: "W", word: "Wick", a: "W is the Wick, the thin line’s reach:", b: "how far price went, and then its breach.", m: "candle" },
  { l: "X", word: "XAU", a: "X is for XAU, gold by code:", b: "an ounce in dollars, bought or owed.", m: "bars" },
  { l: "Y", word: "Yield", a: "Y is the Yield, what a bond will pay:", b: "as its price goes up, it falls away.", m: "fall" },
  { l: "Z", word: "Zigzag", a: "Z is the Zigzag, price’s way:", b: "never a straight line, come what may.", m: "wave" },
];

export function Alphabet() {
  const [at, setAt] = useState(0);
  const cur = ABC[at];
  const draw = useMemo<FigureDraw>(() => {
    let began: number | null = null;
    const m = cur.m;
    return ({ ctx, w, h, t, pal, still }) => {
      if (w < 120 || h < 80) return;
      if (began === null) began = t;
      const T = still ? 9 : t - began;
      const u = smooth(T / 1.4);
      // the letter, large and faint, behind its picture
      ctx.font = `300 ${Math.min(h * 1.05, w * 0.42)}px ${pal.font}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(pal.ink3, 0.22);
      ctx.fillText(cur.l, 10, h / 2 + 4);
      const x0 = w * 0.42;
      const x1 = w - 16;
      const top = 16;
      const bot = h - 16;
      const mid = (top + bot) / 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(pal.accent, 1);
      const path = (f: (k: number) => number, upTo = u) => {
        ctx.beginPath();
        for (let i = 0; i <= 40 * upTo; i++) {
          const k = i / 40;
          const x = lerp(x0, x1, k);
          if (i === 0) ctx.moveTo(x, f(k));
          else ctx.lineTo(x, f(k));
        }
        ctx.stroke();
      };
      if (m === "rise") path((k) => lerp(bot, top, k) + Math.sin(k * 9) * 7);
      else if (m === "fall") path((k) => lerp(top, bot, k) + Math.sin(k * 9) * 7);
      else if (m === "wave") path((k) => mid + Math.sin(k * TAU * 2.2 + (still ? 0 : t * 2)) * (bot - top) * 0.3, 1);
      else if (m === "gap") {
        path((k) => mid - 8 + Math.sin(k * 30) * 3, Math.min(u, 0.46));
        if (u > 0.5) {
          ctx.strokeStyle = rgba(pal.gold, 1);
          ctx.beginPath();
          for (let i = 22; i <= 40 * u; i++) {
            const k = i / 40;
            const y = top + 14 + Math.sin(k * 30) * 3;
            if (i === 22) ctx.moveTo(lerp(x0, x1, k), y);
            else ctx.lineTo(lerp(x0, x1, k), y);
          }
          ctx.stroke();
        }
      } else if (m === "candle") {
        const cx = (x0 + x1) / 2;
        ctx.beginPath();
        ctx.moveTo(cx, lerp(mid, top, u));
        ctx.lineTo(cx, lerp(mid, bot, u));
        ctx.stroke();
        ctx.fillStyle = rgba(pal.emerald, 1);
        ctx.fillRect(cx - 14, mid - (bot - top) * 0.22 * u, 28, (bot - top) * 0.44 * u);
      } else if (m === "bars") {
        for (let i = 0; i < 7; i++) {
          const bh = (bot - top) * (0.25 + ((i * 37) % 60) / 100) * smooth(T / 0.8 - i * 0.12);
          ctx.fillStyle = rgba(i % 2 ? pal.accent : pal.teal, 0.95);
          ctx.fillRect(lerp(x0, x1, i / 7), bot - bh, (x1 - x0) / 9, bh);
        }
      } else if (m === "scale") {
        const tilt = (still ? 0.12 : Math.sin(t * 1.3) * 0.16) * u;
        const cx = (x0 + x1) / 2;
        const arm = (x1 - x0) * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx, bot);
        ctx.lineTo(cx, mid - 6);
        ctx.moveTo(cx - Math.cos(tilt) * arm, mid - 6 + Math.sin(tilt) * arm);
        ctx.lineTo(cx + Math.cos(tilt) * arm, mid - 6 - Math.sin(tilt) * arm);
        ctx.stroke();
        ctx.fillStyle = rgba(pal.gold, 1);
        ctx.fillRect(cx - Math.cos(tilt) * arm - 5, mid - 6 + Math.sin(tilt) * arm, 10, 10);
        ctx.fillRect(cx + Math.cos(tilt) * arm - 11, mid - 6 - Math.sin(tilt) * arm, 22, 22);
      } else {
        // a pair: two lines with a gap held between them
        const g = 10 + (still ? 0 : Math.sin(t * 1.5) * 4);
        path((k) => mid - g + Math.sin(k * 8) * 6);
        ctx.strokeStyle = rgba(pal.gold, 1);
        path((k) => mid + g + Math.sin(k * 8) * 6);
      }
    };
  }, [cur]);
  return (
    <div>
      <div className="flex flex-wrap gap-3" role="group" aria-label="Choose a letter">
        {ABC.map((x, i) => (
          <button key={x.l} type="button" className={`h-[2.75rem] w-[2.75rem] rounded border font-display text-lg transition-colors duration-fast ${i === at ? "border-accent bg-surface text-ink" : "border-line text-ink-3 hover:text-ink"}`} aria-pressed={i === at} aria-label={`${x.l}: ${x.word}`} onClick={() => setAt(i)}>
            {x.l}
          </button>
        ))}
      </div>
      <div className="flat mt-13 rounded-[8px] border border-line bg-surface/60 p-13 max-sm:[&>div]:![aspect-ratio:1.9]">
        <Figure draw={draw} ratio={2.6} rev={at} />
      </div>
      <p className="gx-couplet mt-13 !mb-0" aria-live="polite">
        <span>{cur.a}</span>
        <span>{cur.b}</span>
      </p>
    </div>
  );
}

/* ---- 3. FINISH THE RHYME -------------------------------------------------- */

export type Couplet = { slug: string; term: string; a: string; b: string };

export function FinishTheRhyme({ cards }: { cards: Couplet[] }) {
  const [q, setQ] = useState<{ card: Couplet; options: Couplet[] } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [tally, setTally] = useState({ played: 0, right: 0 });
  const deal = () => {
    const pick = () => cards[Math.floor(Math.random() * cards.length)];
    const card = pick();
    const others = new Set<Couplet>();
    while (others.size < 2) {
      const o = pick();
      if (o.slug !== card.slug) others.add(o);
    }
    setPicked(null);
    setQ({ card, options: [card, ...others].sort(() => Math.random() - 0.5) });
  };
  // the first couplet is dealt after the page loads, so the server and the browser agree on what was sent
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(deal, []);
  if (!q) return <p className="gx-wait text-ink-3">A couplet is dealt once the page has loaded.</p>;
  const done = picked !== null;
  const ok = picked === q.card.slug;
  return (
    <div>
      <p className="font-display text-xl leading-snug text-ink lg:text-2xl">{q.card.a}</p>
      <div className="mt-13 grid gap-8" role="group" aria-label="Choose the second line">
        {q.options.map((o) => (
          <button
            key={o.slug}
            type="button"
            className={`btn btn-ghost justify-start text-left !normal-case ${done && o.slug === q.card.slug ? "border-accent" : ""} ${done && o.slug === picked && !ok ? "line-through opacity-60" : ""}`}
            disabled={done}
            aria-pressed={picked === o.slug}
            onClick={() => {
              setPicked(o.slug);
              setTally((s) => ({ played: s.played + 1, right: s.right + (o.slug === q.card.slug ? 1 : 0) }));
            }}
          >
            {o.b}
          </button>
        ))}
      </div>
      <p className="mt-13 min-h-[3rem] text-ink-2" aria-live="polite">
        {!done && "Which line finishes it?"}
        {done && (
          <>
            {ok ? "That is the one. " : "Not quite. "}The couplet is for{" "}
            <Link href={`/glossary/${q.card.slug}`} className="link">
              {q.card.term}
            </Link>
            .
          </>
        )}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-13">
        {done && (
          <button type="button" className="btn btn-primary" onClick={deal}>
            Another
          </button>
        )}
        <span className="num ml-auto text-sm text-ink-3">
          {tally.right} right of {tally.played}
        </span>
      </div>
    </div>
  );
}

/* ---- 4. THE PROVERB WALL -------------------------------------------------- */

const PROVERBS: { say: string; verdict: "Holds" | "Half true" | "Folklore"; why: string }[] = [
  { say: "The trend is your friend.", verdict: "Half true", why: "Trends are plain looking back. The saying leaves off its ending, “until it bends”, and nothing announces the bend." },
  { say: "Cut your losses and let your profits run.", verdict: "Holds", why: "It is arithmetic: small losses and larger gains can pay even when fewer than half of trades win. It is hard because people lean the other way." },
  { say: "Buy the rumour, sell the news.", verdict: "Half true", why: "It describes something real: prices move on what is expected, so the news itself can be an anticlimax. It is not a rule you can trade by." },
  { say: "Never catch a falling knife.", verdict: "Half true", why: "A sound caution against buying only because something has fallen. But a fall can stop at any point, and the saying cannot tell you where." },
  { say: "The market can stay irrational longer than you can stay solvent.", verdict: "Holds", why: "Being right eventually is no use if leverage closes the position first. It is a warning about size and time." },
  { say: "Sell in May and go away.", verdict: "Folklore", why: "A seasonal saying about share markets. It has not been dependable, and it says nothing about currencies." },
  { say: "Don’t put all your eggs in one basket.", verdict: "Holds", why: "With one addition: baskets that move together are one basket. Two closely tied positions are one larger position." },
  { say: "Bulls make money, bears make money, pigs get slaughtered.", verdict: "Holds", why: "It is about greed and size, not direction. Either side can work; too much on one trade undoes both." },
  { say: "It’s time in the market, not timing the market.", verdict: "Half true", why: "Said of long-term investing in shares, where it has merit. It does not carry over to leveraged trading, where holding costs money each night." },
];

export function ProverbWall() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <ul className="grid gap-13 sm:grid-cols-2 lg:grid-cols-3">
      {PROVERBS.map((p, i) => {
        const on = !!open[i];
        return (
          <li key={p.say}>
            <button type="button" className={`gx-flip ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => setOpen((s) => ({ ...s, [i]: !s[i] }))}>
              <span className="gx-flip-face gx-flip-front">
                <span className="font-display text-lg leading-snug text-ink">“{p.say}”</span>
                <span className="label mt-auto">Turn it over</span>
              </span>
              <span className="gx-flip-face gx-flip-back" aria-hidden={!on}>
                <span className={`label ${p.verdict === "Holds" ? "!text-pos" : p.verdict === "Folklore" ? "!text-neg" : "!text-prestige-ink"}`}>{p.verdict}</span>
                <span className="mt-8 text-sm text-ink-2">{p.why}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---- 5. THE RIDDLE HUNT ---------------------------------------------------- */

/** A small mark on a page that opens one hidden riddle. Solving it is noted in this browser (gx:play). */
export function HiddenRiddle({ id }: { id: keyof typeof HUNT }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const play = usePlay();
  const r = HUNT[id];
  const found = !!play.h?.includes(id);
  const done = picked !== null || found;
  return (
    <aside className="wrap py-21" aria-label="A hidden riddle">
      <button type="button" className="gx-hunt-mark" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden>?</span>
        <span className="sr-only">{found ? "A hidden riddle, already solved" : "A hidden riddle"}</span>
      </button>
      {open && (
        <div className="mt-13 max-w-[34rem] rounded-[8px] border border-line bg-surface p-21">
          <p className="label">Hidden riddle · {found ? "found" : "one of five"}</p>
          <p className="gx-couplet mt-8 !mb-0">
            <span>{r.a}</span>
            <span>{r.b}</span>
          </p>
          <div className="mt-13 flex flex-wrap gap-8" role="group" aria-label="Choose the answer">
            {r.options.map((o) => (
              <button
                key={o}
                type="button"
                className={`btn btn-ghost !normal-case ${done && o === r.answer ? "border-accent" : ""}`}
                disabled={done}
                onClick={() => {
                  setPicked(o);
                  if (o === r.answer) noteHunt(id);
                }}
              >
                {o}
              </button>
            ))}
          </div>
          <p className="mt-13 text-sm text-ink-2" aria-live="polite">
            {found ? "Solved. " : picked ? "Not that one: close this and try again. " : "Solve it and it is added to your hunt. "}
            <Link href="/verse#hunt" className="link">
              The riddle hunt
            </Link>
          </p>
        </div>
      )}
    </aside>
  );
}

export function HuntProgress() {
  const play = usePlay();
  const ids = Object.keys(HUNT) as (keyof typeof HUNT)[];
  const found = ids.filter((i) => play.h?.includes(i));
  return (
    <div>
      <p className="text-ink-2" aria-live="polite">
        <span className="num font-semibold text-ink">{found.length}</span> of {ids.length} found.{" "}
        {found.length === ids.length ? "All five: the hunt is complete, and it has stamped your passport if you have one." : "Each is behind a small “?” near the foot of a page."}
      </p>
      <ul className="mt-13 border-t border-line">
        {ids.map((i) => {
          const on = found.includes(i);
          return (
            <li key={i} className="flex items-center gap-13 border-b border-line py-13">
              <span aria-hidden className={`h-[0.625rem] w-[0.625rem] rounded-full ${on ? "bg-accent" : "border border-line-strong"}`} />
              <Link href={HUNT[i].href} className={on ? "text-ink-3 line-through" : "link"}>
                {HUNT[i].where}
              </Link>
              <span className="ml-auto text-xs text-ink-3">{on ? "Found" : "Hidden"}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-13 text-xs text-ink-3">What you have found is kept in this browser only, with the riddle run and the passport.</p>
    </div>
  );
}
