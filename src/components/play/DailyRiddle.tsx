"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { noteRiddle, standingStreak, today, usePlay } from "./store";

/**
 * The day's riddle: four lines of verse, three glossary terms to choose from,
 * one try. A right answer opens the term's page and adds a day to the run of
 * days answered in a row, which is kept in this browser only (gx:play).
 *
 * The riddle is chosen from the date, counted in UTC, on the visitor's device:
 * so the server sends the whole small list and the choice is made after the
 * page loads. Until then a line says so; without JavaScript that line stays
 * and the glossary link beside it still works.
 */

export type RiddleItem = { q: readonly string[]; answer: { slug: string; term: string }; options: { slug: string; term: string }[] };

/** which riddle a day shows: the count of days since 1 January 1970 (UTC), wrapped to the list */
const indexFor = (count: number) => Math.floor(Date.now() / 86400000) % count;

export function DailyRiddle({ items }: { items: RiddleItem[] }) {
  const [at, setAt] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const play = usePlay();
  useEffect(() => setAt(indexFor(items.length)), [items.length]);

  if (at === null) return <p className="text-ink-3">Today’s riddle appears once the page has loaded.</p>;

  const item = items[at];
  const already = play.r?.last === today();
  const done = picked !== null || already;
  const right = already || picked === item.answer.slug;
  const streak = standingStreak(play);

  const choose = (slug: string) => {
    if (done) return;
    setPicked(slug);
    if (slug === item.answer.slug) noteRiddle();
  };

  return (
    <div>
      <blockquote className="gx-riddle font-display text-xl leading-snug text-ink lg:text-2xl">
        {item.q.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </blockquote>
      <div className="mt-21 flex flex-wrap gap-13" role="group" aria-label="Choose the term the riddle describes">
        {item.options.map((o) => {
          const isAnswer = o.slug === item.answer.slug;
          const state = !done ? "" : isAnswer ? "border-accent text-ink" : o.slug === picked ? "border-line text-ink-3 line-through" : "opacity-50";
          return (
            <button key={o.slug} type="button" className={`btn btn-ghost ${state}`} onClick={() => choose(o.slug)} disabled={done} aria-pressed={picked === o.slug}>
              {o.term}
            </button>
          );
        })}
      </div>
      <p className="mt-13 min-h-[3rem] text-ink-2" aria-live="polite">
        {!done && "One try. Which term is it?"}
        {done && (
          <>
            {already && picked === null ? "You have answered today’s riddle. " : right ? "That is it. " : "Not that one. "}
            The answer is{" "}
            <Link href={`/glossary/${item.answer.slug}`} className="link">
              {item.answer.term}
            </Link>
            . A new riddle arrives at midnight, UTC.
          </>
        )}
      </p>
      <p className="mt-5 text-sm text-ink-3">
        {streak > 0 ? (
          <>
            <span className="num font-semibold text-ink">{streak}</span> {streak === 1 ? "day" : "days"} in a row
            {play.r && play.r.best > streak ? `, best ${play.r.best}` : ""}. Kept in this browser only.
          </>
        ) : (
          "Answer correctly on consecutive days to build a run. It is kept in this browser only."
        )}
      </p>
    </div>
  );
}
