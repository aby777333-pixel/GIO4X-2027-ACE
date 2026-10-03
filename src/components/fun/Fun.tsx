"use client";

import { useEffect, useState } from "react";
import { BINGO, CARTOONS, EXCUSES, JOKES, LIMERICKS, RIDDLES, STRIPS } from "@/data/fun";
import { ToonPanel } from "./Toons";

/**
 * Fun@Finance: the parts that move.
 *
 *   JokeBox        the joke of the day, and another on request
 *   ComicReader    the strips, three panels at a time
 *   Cartoons       single drawings with a line beneath
 *   FunRiddles     riddles with their answers turned face down
 *   Limericks      one at a time
 *   ExcuseMachine  three reels of excuses
 *   Bingo          a card to mark; five in a row is called
 *
 * Nothing here is stored or sent anywhere: a marked card and a turned riddle
 * last as long as the page is open.
 */

/** which item a day shows: days since 1 January 1970 (UTC), wrapped to the list */
const today = (count: number) => Math.floor(Date.now() / 86400000) % count;

export function JokeBox() {
  const [at, setAt] = useState<number | null>(null);
  const [told, setTold] = useState(1);
  useEffect(() => setAt(today(JOKES.length)), []);
  if (at === null) return <p className="gx-wait text-ink-3">Today’s joke appears once the page has loaded.</p>;
  const first = today(JOKES.length);
  return (
    <div>
      <p className="label">{at === first ? "Today’s joke" : `Joke ${told} of ${JOKES.length}`}</p>
      <blockquote key={at} className="gx-joke mt-13 font-display text-xl leading-snug text-ink lg:text-2xl" aria-live="polite">
        {JOKES[at]}
      </blockquote>
      <div className="mt-21 flex flex-wrap items-center gap-13">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setAt((at + 1) % JOKES.length);
            setTold((n) => (n % JOKES.length) + 1);
          }}
        >
          Another one
        </button>
        <span className="text-sm text-ink-3">A new one leads each day. {JOKES.length} in the box.</span>
      </div>
    </div>
  );
}

export function ComicReader() {
  const [at, setAt] = useState(0);
  const strip = STRIPS[at];
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-13">
        <h3 className="h4" aria-live="polite">
          <span className="num mr-8 text-ink-3">
            {at + 1}/{STRIPS.length}
          </span>
          {strip.title}
        </h3>
        <div className="flex gap-8">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAt((at + STRIPS.length - 1) % STRIPS.length)}>
            Previous
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAt((at + 1) % STRIPS.length)}>
            Next strip
          </button>
        </div>
      </div>
      <ol key={at} className="gx-strip mt-13" aria-label={`Comic strip: ${strip.title}`}>
        {strip.panels.map((p, i) => (
          <li key={i} style={{ ["--i" as string]: i }}>
            <ToonPanel panel={p} />
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Cartoons() {
  return (
    <ul className="grid gap-21 sm:grid-cols-2">
      {CARTOONS.map((c) => (
        <li key={c.caption}>
          <ToonPanel panel={c} caption={c.caption} />
        </li>
      ))}
    </ul>
  );
}

export function FunRiddles() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <ul className="grid gap-13 sm:grid-cols-2">
      {RIDDLES.map((r, i) => (
        <li key={r.q}>
          <button type="button" className={`gx-flip ${open[i] ? "is-open" : ""}`} aria-expanded={!!open[i]} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>
            <span className="block text-ink">{r.q}</span>
            <span className="gx-flip-a mt-13 block font-display text-lg" aria-hidden={!open[i]}>
              {open[i] ? r.a : "Turn it over"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Limericks() {
  const [at, setAt] = useState(0);
  return (
    <div>
      <blockquote key={at} className="gx-joke font-display text-base leading-relaxed text-ink sm:text-lg" aria-live="polite">
        {LIMERICKS[at].map((line, i) => (
          <span key={line} className={`block ${i === 2 || i === 3 ? "pl-21" : ""}`}>
            {line}
          </span>
        ))}
      </blockquote>
      <button type="button" className="btn btn-ghost mt-21" onClick={() => setAt((at + 1) % LIMERICKS.length)}>
        Another limerick
        <span className="num ml-8 text-ink-3">
          {at + 1}/{LIMERICKS.length}
        </span>
      </button>
    </div>
  );
}

export function ExcuseMachine() {
  const [pick, setPick] = useState<[number, number, number] | null>(null);
  const [spins, setSpins] = useState(0);
  const spin = () => {
    // drawn on a click, in the browser: never during rendering
    setPick([Math.floor(Math.random() * EXCUSES.who.length), Math.floor(Math.random() * EXCUSES.did.length), Math.floor(Math.random() * EXCUSES.so.length)]);
    setSpins((n) => n + 1);
  };
  const reels = pick ? [EXCUSES.who[pick[0]], EXCUSES.did[pick[1]], EXCUSES.so[pick[2]]] : ["Who", "did what", "and so"];
  return (
    <div>
      <div className="gx-reels" key={spins}>
        {reels.map((text, i) => (
          <p key={i} className={`gx-reel ${pick ? "" : "text-ink-3"}`} style={{ ["--i" as string]: i }}>
            {text}
          </p>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {pick ? reels.join(" ") : ""}
      </p>
      <div className="mt-21 flex flex-wrap items-center gap-13">
        <button type="button" className="btn btn-primary" onClick={spin}>
          {pick ? "Find another excuse" : "Find me an excuse"}
        </button>
        <span className="text-sm text-ink-3">The real reason is usually in the journal.</span>
      </div>
    </div>
  );
}

const LINES: number[][] = [
  ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

export function Bingo() {
  const [on, setOn] = useState<boolean[]>(() => BINGO.map((_, i) => i === 12));
  const won = LINES.filter((l) => l.every((i) => on[i]));
  const lit = new Set(won.flat());
  const count = on.filter(Boolean).length - 1;
  return (
    <div>
      <ul className="gx-bingo" aria-label="Bingo card: habits of a trading week">
        {BINGO.map((text, i) => (
          <li key={text}>
            <button type="button" className={`gx-bingo-cell ${on[i] ? "is-on" : ""} ${lit.has(i) ? "is-line" : ""}`} aria-pressed={on[i]} disabled={i === 12} onClick={() => setOn((s) => s.map((v, j) => (j === i ? !v : v)))}>
              {text}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-13 min-h-[3rem] text-ink-2" aria-live="polite">
        {won.length ? (
          <>
            <strong className="text-ink">Bingo.</strong> {won.length === 1 ? "A line" : `${won.length} lines`} of habits worth a look in the journal.
          </>
        ) : (
          `Mark what happened this week. ${count} marked so far.`
        )}
      </p>
      <button type="button" className="btn btn-ghost btn-sm mt-5" onClick={() => setOn(BINGO.map((_, i) => i === 12))}>
        Clear the card
      </button>
      <p className="mt-13 text-xs text-ink-3">The card is not kept: it clears when the page is closed.</p>
    </div>
  );
}
