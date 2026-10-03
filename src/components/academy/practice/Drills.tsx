"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signalSound } from "@/components/sound/signal";

/**
 * Two drills for the practice room. Nothing in either is stored.
 *
 * FIX THE TRADE: an order ticket with one thing wrong. Say what it is.
 * THE FLASHCARD DUEL: a glossary couplet, four terms, sixty seconds.
 *
 * The tickets are invented, on an example pair quoted in US dollars (10 a pip
 * on a standard lot). They teach how to check an order, not what to trade.
 */

/* ---- FIX THE TRADE ------------------------------------------------------- */

type Ticket = {
  side: "Buy" | "Sell";
  entry: string;
  stop: string;
  target: string;
  lots: string;
  balance: string;
  options: readonly string[];
  answer: number;
  why: string;
  fixed: Partial<Record<"stop" | "target" | "lots", string>>;
};

const TICKETS: readonly Ticket[] = [
  {
    side: "Buy",
    entry: "1.0900",
    stop: "1.0940",
    target: "1.0980",
    lots: "0.10",
    balance: "5,000",
    options: ["The stop is on the wrong side", "The size is too large", "The target is too close", "Nothing is wrong"],
    answer: 0,
    why: "A buy is wrong if the price falls, so its stop belongs below the entry. This one sits above it, on the way to the target, and would close the trade for moving the right way.",
    fixed: { stop: "1.0860" },
  },
  {
    side: "Buy",
    entry: "1.0900",
    stop: "1.0850",
    target: "1.1000",
    lots: "2.00",
    balance: "1,000",
    options: ["The stop is on the wrong side", "The size is too large", "The target is on the wrong side", "Nothing is wrong"],
    answer: 1,
    why: "Fifty pips at 2 lots is 50 × 20 = 1,000: the whole account on one stop. At 0.02 lots the same stop costs 10, which is 1%.",
    fixed: { lots: "0.02" },
  },
  {
    side: "Sell",
    entry: "1.0900",
    stop: "1.0950",
    target: "1.0960",
    lots: "0.10",
    balance: "5,000",
    options: ["The stop is on the wrong side", "The size is too large", "The target is on the wrong side", "Nothing is wrong"],
    answer: 2,
    why: "A sell gains if the price falls, so its target belongs below the entry. This target is above it, beyond the stop: the order could never reach it.",
    fixed: { target: "1.0800" },
  },
  {
    side: "Buy",
    entry: "1.0900",
    stop: "1.0850",
    target: "1.0910",
    lots: "0.10",
    balance: "5,000",
    options: ["The stop is on the wrong side", "The size is too large", "It risks far more than it aims for", "Nothing is wrong"],
    answer: 2,
    why: "It risks 50 pips to make 10. Five trades like this must win for every one that loses just to stand still, before costs. Either the target is too near or the stop is too far.",
    fixed: { target: "1.1000" },
  },
  {
    side: "Sell",
    entry: "1.0900",
    stop: "none",
    target: "1.0820",
    lots: "0.10",
    balance: "5,000",
    options: ["There is no stop", "The size is too large", "The target is on the wrong side", "Nothing is wrong"],
    answer: 0,
    why: "With no stop the loss has no planned end, and the size cannot be worked out, because size comes from the distance to the stop. “I will watch it” depends on being at the screen and calm.",
    fixed: { stop: "1.0940" },
  },
  {
    side: "Buy",
    entry: "1.0900",
    stop: "1.0860",
    target: "1.0980",
    lots: "0.10",
    balance: "5,000",
    options: ["The stop is on the wrong side", "The size is too large", "The target is on the wrong side", "Nothing is wrong"],
    answer: 3,
    why: "Stop below a buy, target above it, 40 pips risked to make 80, and 40 × 1 = 40, under 1% of the account. A ticket can be in order and still lose: checking it only removes the avoidable mistakes.",
    fixed: {},
  },
];

export function FixTheTrade() {
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const t = TICKETS[at];
  const done = picked !== null;
  const ok = picked === t.answer;
  const cell = (label: string, key: "stop" | "target" | "lots" | null, value: string) => {
    const fixed = done && key ? t.fixed[key] : undefined;
    return (
      <div>
        <dt className="label">{label}</dt>
        <dd className="num mt-3 text-lg text-ink">
          {fixed ? (
            <>
              <s className="text-ink-3">{value}</s> <span className="text-accent">{fixed}</span>
            </>
          ) : (
            value
          )}
        </dd>
      </div>
    );
  };
  const choose = (i: number) => {
    if (done) return;
    setPicked(i);
    if (i === t.answer) {
      setRight((n) => n + 1);
      signalSound("chime");
    } else signalSound("knock");
  };
  return (
    <div>
      <div className={`gx-ticket rounded-[8px] border p-21 ${done ? "border-accent" : "border-line"} bg-surface`}>
        <p className="flex items-baseline justify-between gap-13">
          <span className="label">Order ticket {at + 1} of {TICKETS.length}</span>
          <span className={`font-display text-xl ${t.side === "Buy" ? "text-pos" : "text-neg"}`}>{t.side}</span>
        </p>
        <dl className="mt-13 grid grid-cols-2 gap-x-21 gap-y-13 sm:grid-cols-5">
          {cell("Entry", null, t.entry)}
          {cell("Stop", "stop", t.stop)}
          {cell("Target", "target", t.target)}
          {cell("Lots", "lots", t.lots)}
          {cell("Account", null, t.balance)}
        </dl>
      </div>
      <div className="mt-13 grid gap-8 sm:grid-cols-2" role="group" aria-label="What is wrong with this ticket?">
        {t.options.map((o, i) => (
          <button
            key={o}
            type="button"
            className={`btn btn-ghost justify-start text-left !normal-case ${done && i === t.answer ? "border-accent" : ""} ${done && i === picked && !ok ? "line-through opacity-60" : ""}`}
            onClick={() => choose(i)}
            disabled={done}
            aria-pressed={picked === i}
          >
            {o}
          </button>
        ))}
      </div>
      <p className="mt-13 min-h-[5rem] text-ink-2" aria-live="polite">
        {!done && "One thing is wrong, or nothing is. Which?"}
        {done && (
          <>
            <strong className="text-ink">{ok ? "Yes. " : `No: ${t.options[t.answer].toLowerCase()}. `}</strong>
            {t.why}
          </>
        )}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-13">
        {done && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPicked(null);
              if (at === TICKETS.length - 1) setRight(0);
              setAt((n) => (n + 1) % TICKETS.length);
            }}
          >
            {at === TICKETS.length - 1 ? "Start again" : "Next ticket"}
          </button>
        )}
        <span className="num ml-auto text-sm text-ink-3">{right} right</span>
      </div>
    </div>
  );
}

/* ---- THE FLASHCARD DUEL -------------------------------------------------- */

export type Card = { slug: string; term: string; a: string; b: string };

const SECONDS = 60;
const pick = (n: number) => Math.floor(Math.random() * n);

export function FlashDuel({ cards }: { cards: Card[] }) {
  const [phase, setPhase] = useState<"idle" | "run" | "done">("idle");
  const [left, setLeft] = useState(SECONDS);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [q, setQ] = useState<{ card: Card; options: Card[] } | null>(null);
  const [flash, setFlash] = useState<"" | "ok" | "no">("");
  const missed = useRef<Card[]>([]);
  const [review, setReview] = useState<Card[]>([]);

  const deal = () => {
    const card = cards[pick(cards.length)];
    const others = new Set<Card>();
    while (others.size < 3) {
      const o = cards[pick(cards.length)];
      if (o.slug !== card.slug) others.add(o);
    }
    setQ({ card, options: [card, ...others].sort(() => Math.random() - 0.5) });
  };
  const start = () => {
    missed.current = [];
    setReview([]);
    setScore({ right: 0, wrong: 0 });
    setLeft(SECONDS);
    setPhase("run");
    deal();
  };
  useEffect(() => {
    if (phase !== "run") return;
    const id = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          setPhase("done");
          setReview([...new Map(missed.current.map((c) => [c.slug, c])).values()].slice(0, 6));
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const answer = (c: Card) => {
    if (phase !== "run" || !q) return;
    const ok = c.slug === q.card.slug;
    if (ok) signalSound("tick");
    else missed.current.push(q.card);
    setScore((s) => (ok ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 }));
    setFlash(ok ? "ok" : "no");
    window.setTimeout(() => setFlash(""), 220);
    deal();
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-34 gap-y-5">
        <p>
          <span className="label">Time left</span> <span className="num ml-5 font-display text-2xl text-ink">{left}s</span>
        </p>
        <p>
          <span className="label">Right</span> <span className="num ml-5 font-display text-2xl text-pos">{score.right}</span>
        </p>
        <p>
          <span className="label">Wrong</span> <span className="num ml-5 font-display text-2xl text-ink-3">{score.wrong}</span>
        </p>
      </div>
      <div className={`mt-13 min-h-[9rem] rounded-[8px] border p-21 transition-colors duration-fast ${flash === "ok" ? "border-pos" : flash === "no" ? "border-neg" : "border-line"} bg-surface`} aria-live="polite">
        {phase === "run" && q ? (
          <p className="gx-couplet !mb-0">
            <span>{q.card.a}</span>
            <span>{q.card.b}</span>
          </p>
        ) : phase === "done" ? (
          <p className="text-ink">
            Time. <strong className="num">{score.right}</strong> right and <strong className="num">{score.wrong}</strong> wrong in a minute.
            {review.length ? " The ones to look at again are below." : score.right ? " None missed." : ""}
          </p>
        ) : (
          <p className="text-ink-2">A couplet from the glossary appears here. Choose the term it describes. As many as you can in sixty seconds.</p>
        )}
      </div>
      {phase === "run" && q ? (
        <div className="mt-13 grid gap-8 sm:grid-cols-2" role="group" aria-label="Which term does the couplet describe?">
          {q.options.map((o) => (
            <button key={o.slug} type="button" className="btn btn-ghost justify-start text-left !normal-case" onClick={() => answer(o)}>
              {o.term}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="btn btn-primary mt-13" onClick={start}>
          {phase === "done" ? "Duel again" : "Start the duel"}
        </button>
      )}
      {phase === "done" && review.length > 0 && (
        <ul className="mt-13 border-t border-line">
          {review.map((c) => (
            <li key={c.slug} className="border-b border-line py-8 text-sm">
              <Link href={`/glossary/${c.slug}`} className="link font-medium">
                {c.term}
              </Link>
              <span className="text-ink-3">: {c.a} {c.b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
