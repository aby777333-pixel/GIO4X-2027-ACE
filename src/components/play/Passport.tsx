"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { endPassport, readPlay, stamp, startPassport, usePlay } from "./store";

/**
 * THE PASSPORT — a stamp for each kind of place on the site, collected by
 * going there.
 *
 * It is off until the visitor presses "Start my passport" on My desk. Until
 * then nothing about the pages opened is noted (the recorder below reads one
 * value and writes nothing). Once started, opening one of the places listed
 * here for a moment adds its stamp: only the stamp's short name is kept, never
 * an address, a time or an order. "Hand it back" deletes the stamps.
 *
 * Stamps mark pages opened on this device. They are not an achievement in
 * trading and the desk says so.
 */

export const STAMPS: { id: string; name: string; href: string; test: RegExp }[] = [
  { id: "universe", name: "Market Universe", href: "/labs/market-universe", test: /^\/labs\/market-universe$/ },
  { id: "dots", name: "Connect the Dots", href: "/labs/connect-the-dots", test: /^\/labs\/connect-the-dots$/ },
  { id: "day", name: "One day of markets", href: "/labs/market-day", test: /^\/labs\/market-day$/ },
  { id: "anatomy", name: "Trade Anatomy", href: "/labs/trade-anatomy", test: /^\/labs\/trade-anatomy$/ },
  { id: "desk", name: "Practice desk", href: "/labs/simulator", test: /^\/labs\/simulator$/ },
  { id: "globe", name: "Session globe", href: "/labs/session-globe", test: /^\/labs\/session-globe$/ },
  { id: "book", name: "Order book 3D", href: "/labs/order-book-3d", test: /^\/labs\/order-book-3d$/ },
  { id: "workshop", name: "The Workshop", href: "/labs/workshop", test: /^\/labs\/workshop$/ },
  { id: "engine", name: "The Engine Room", href: "/labs/engine-room", test: /^\/labs\/engine-room$/ },
  { id: "forces", name: "Forces", href: "/labs/forces", test: /^\/labs\/forces$/ },
  { id: "scale", name: "The Long Scroll", href: "/labs/scale", test: /^\/labs\/scale$/ },
  { id: "practice", name: "Practice room", href: "/academy/practice", test: /^\/academy\/practice$/ },
  { id: "tool", name: "A tool", href: "/tools", test: /^\/tools\/[a-z0-9-]+$/ },
  { id: "lesson", name: "A lesson", href: "/academy", test: /^\/academy\/(?!books$|practice$)[a-z0-9-]+$/ },
  { id: "term", name: "A glossary term", href: "/glossary", test: /^\/glossary\/[a-z0-9-]+$/ },
  { id: "post", name: "A blog post", href: "/intelligence/blog", test: /^\/intelligence\/blog\/[a-z0-9-]+$/ },
  { id: "instrument", name: "An instrument", href: "/markets", test: /^\/markets\/(forex|metals|indices|energy|equities|crypto)\/[a-z0-9-]+$/ },
  { id: "bank", name: "A central bank", href: "/markets/central-banks", test: /^\/markets\/central-banks\/[a-z0-9-]+$/ },
  { id: "clock", name: "World Market Clock", href: "/markets/clock", test: /^\/markets\/clock$/ },
  { id: "risk", name: "Risk disclosure", href: "/legal/risk", test: /^\/legal\/risk$/ },
];

/** Adds a stamp for the page that is open, once the passport has been started. Renders nothing. */
export function PassportRecorder() {
  const pathname = usePathname();
  useEffect(() => {
    if (!readPlay().s) return;
    const hit = STAMPS.find((s) => s.test.test(pathname));
    if (!hit) return;
    // a page passed through on the way to another does not earn its stamp
    const t = window.setTimeout(() => stamp(hit.id), 1600);
    return () => window.clearTimeout(t);
  }, [pathname]);
  return null;
}

export function Passport() {
  const play = usePlay();
  const started = !!play.s;
  const have = new Set(play.s ?? []);
  const count = STAMPS.filter((s) => have.has(s.id)).length;
  const complete = count === STAMPS.length;

  if (!started) {
    return (
      <div>
        <p className="max-w-measure text-ink-2">
          {STAMPS.length} stamps, one for each kind of place on the site: the labs, a tool, a lesson, a glossary term and more. Nothing is noted until you start it, and then only the name of each stamp.
        </p>
        <button type="button" className="btn btn-primary mt-13" onClick={startPassport}>
          Start my passport
        </button>
      </div>
    );
  }
  return (
    <div>
      <p className="text-ink-2" aria-live="polite">
        <span className="num font-semibold text-ink">{count}</span> of {STAMPS.length} stamps.{" "}
        {complete ? "Every page stamped: the passport is full." : "Open a place below for a moment and its stamp is added."}
      </p>
      <ul className={`gx-passport mt-21 ${complete ? "is-complete" : ""}`}>
        {STAMPS.map((s, i) => {
          const on = have.has(s.id);
          return (
            <li key={s.id} style={{ ["--i" as string]: i, ["--tilt" as string]: `${((i * 37) % 13) - 6}deg` }}>
              <Link href={s.href} className={`gx-stamp ${on ? "is-on" : ""}`} aria-label={`${s.name}: ${on ? "stamped" : "not yet stamped"}`}>
                <span className="gx-stamp-n num">{String(i + 1).padStart(2, "0")}</span>
                <span className="gx-stamp-name">{s.name}</span>
                <span className="gx-stamp-state">{on ? "Visited" : "To visit"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-21 text-xs text-ink-3">Stamps mark pages opened on this device. They are not a qualification and say nothing about trading.</p>
      <button type="button" className="go mt-8 min-h-[2.75rem]" onClick={endPassport}>
        Hand it back and delete the stamps
      </button>
    </div>
  );
}
