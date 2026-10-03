"use client";

import { useEffect, useMemo, useState } from "react";
import { Figure, TAU, rgba, type FigureDraw } from "@/components/figures/Figure";
import { LESSON_PREFIX, useLearned } from "@/components/glossary/learn";

/**
 * Two small things that change with time or with what has been learned.
 *
 * THE WEEKLY VERSE: four lines about one idea, a new one each Monday (chosen
 * from the date, on the visitor's device, counted in UTC).
 *
 * THE CONSTELLATION: on My desk, one star for each glossary term whose
 * question has been answered and each lesson completed, joined in the order
 * of their names. It is read from the record the desk already shows
 * (gx:learn): nothing more is stored for it.
 */

const VERSES: readonly (readonly [string, string, string, string])[] = [
  ["A pip is small, a lot is not:", "the two together make the pot.", "Before the trade, work out the sum,", "and know the cost before it's come."],
  ["The spread is paid on every trade,", "a quiet toll that's always made.", "Trade it once or trade it ten:", "you'll pay that toll each time again."],
  ["A stop is where you say you're wrong,", "set in advance, not strung along.", "Move it once and then once more,", "and small becomes a great deal more."],
  ["Leverage makes the small look tall,", "it lifts the rise and deepens the fall.", "The market's move remains the same:", "it's your exposure that's changed its frame."],
  ["A candle tells you what has been,", "not what tomorrow's bars will mean.", "Open, high and low and close:", "a record, not a thing that knows."],
  ["Lose a half and, to be square,", "you need to double what is there.", "The climb is steeper than the slide:", "keep losses small, and stay inside."],
  ["When London and New York both trade,", "the fullest market's being made.", "Yet busy hours are not calm:", "the news lands there, and can alarm."],
  ["Two pairs that move as if they're one", "are not two trades when all is done.", "Count the risk across the lot:", "it may be double what you thought."],
  ["The trade you take to win it back", "is seldom on a thoughtful track.", "Same size, same rules, or smaller still:", "revenge is paid for with a bill."],
  ["Hold a trade beyond the day", "and interest comes, to charge or pay.", "One midweek night it counts for three:", "the weekend's share, as you will see."],
  ["A plan is written while you're calm,", "before the market's sounded its alarm.", "Entry, exit, size and why:", "then let the plan, not mood, reply."],
  ["Nobody knows the next bar's turn,", "a thing each trader has to learn.", "What you can choose is what you stake:", "and that's the choice you ought to make."],
];

export function WeeklyVerse() {
  const [at, setAt] = useState<number | null>(null);
  // weeks since Monday 5 January 1970, in UTC
  useEffect(() => setAt(Math.floor((Date.now() / 86400000 - 4) / 7) % VERSES.length), []);
  const v = VERSES[at ?? 0];
  return (
    <figure className="mx-auto max-w-[34rem] text-center">
      <figcaption className="eyebrow justify-center">This week’s verse</figcaption>
      <blockquote className="mt-13 font-display text-xl leading-snug text-ink lg:text-2xl" aria-live="polite">
        {v.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </blockquote>
      <p className="mt-13 text-xs text-ink-3">A new one each Monday. A way to remember an idea, not advice.</p>
    </figure>
  );
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

export function Constellation() {
  const learned = useLearned();
  const stars = useMemo(() => Object.keys(learned ?? {}).sort(), [learned]);
  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, t, pal, still }) => {
        if (w < 160 || h < 100) return;
        const pts = stars.map((s) => ({ x: 16 + hash(s) * (w - 32), y: 14 + hash(`${s}#`) * (h - 28), lesson: s.startsWith(LESSON_PREFIX) }));
        // a few faint stars that are always there, so an empty sky is still a sky
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = rgba(pal.ink3, 0.25 + 0.2 * hash(`f${i}`));
          ctx.fillRect(hash(`x${i}`) * w, hash(`y${i}`) * h, 1.2, 1.2);
        }
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(pal.accent, 0.4);
        ctx.stroke();
        pts.forEach((p, i) => {
          const tw = still ? 0.5 : (Math.sin(t * 1.3 + i * 2.1) + 1) / 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (p.lesson ? 3.4 : 2.2) + tw * 0.9, 0, TAU);
          ctx.fillStyle = rgba(p.lesson ? pal.gold : pal.accent, 0.75 + tw * 0.25);
          ctx.fill();
        });
      },
    [stars],
  );
  const lessons = stars.filter((s) => s.startsWith(LESSON_PREFIX)).length;
  return (
    <div>
      <div className="flat on-night rounded-[8px] border border-night-line bg-night p-13">
        <Figure draw={draw} ratio={2.2} rev={stars.length} />
      </div>
      <p className="mt-13 text-ink-2" aria-live="polite">
        {learned === null
          ? "Your record is read once the page has loaded."
          : stars.length === 0
            ? "An empty sky. Each glossary question you answer and each lesson you complete adds a star."
            : `${stars.length - lessons} ${stars.length - lessons === 1 ? "term" : "terms"} and ${lessons} ${lessons === 1 ? "lesson" : "lessons"}: ${stars.length} ${stars.length === 1 ? "star" : "stars"}, joined in the order of their names. Lessons are the larger, gold ones.`}
      </p>
    </div>
  );
}
