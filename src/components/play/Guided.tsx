"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Figure, clamp, lerp, rgba, smooth, type Colour, type FigureDraw } from "@/components/figures/Figure";
import { FixTheTrade } from "@/components/academy/practice/Drills";
import { OrderBuilder } from "@/components/academy/practice/OrderBuilder";
import { SixtySeconds } from "@/components/labs/workshop/SixtySeconds";
import { punchLines } from "@/data/punchlines";
import { RELEASES } from "@/data/releases";
import { readPlay, noteSeen, usePlay } from "./store";

/**
 * Things that lead a visitor through, or greet them.
 *
 *   FirstTrade   three rooms in order (build an order, check a ticket, one
 *                minute on an invented price) with an ending: a ten-minute
 *                course made of machines that already exist
 *   ScrollStory  leverage told in six steps, the drawing changing as each
 *                paragraph arrives
 *   TermOfDay    one glossary term a day, chosen from the date
 *   FooterMotto  a line to remember at the foot of every page, a new one daily
 *   NewRibbon    what has been added lately; "Got it" puts it away until
 *                something newer is added (the only thing here that is stored,
 *                and only when that button is pressed: gx:play)
 */

/* ---- THE FIRST TRADE ------------------------------------------------------- */

const ROOMS = [
  { name: "Build it", lead: "Before any trade: where you get in, where you are wrong, where you would be content. Then the size that makes being wrong cost what you chose.", body: <OrderBuilder /> },
  { name: "Check it", lead: "Before it is sent: read the ticket the way you would read someone else’s. Six to try.", body: <FixTheTrade /> },
  { name: "Live with it", lead: "One minute on an invented price. Every trade pays the spread. See what is left, and why.", body: <SixtySeconds /> },
] as const;

export function FirstTrade() {
  const [at, setAt] = useState(0);
  const top = useRef<HTMLDivElement>(null);
  const go = (n: number) => {
    setAt(n);
    top.current?.scrollIntoView({ block: "start" });
  };
  const done = at >= ROOMS.length;
  return (
    <div ref={top} className="scroll-mt-[calc(var(--header-h)+1.3125rem)]">
      <ol className="flex flex-wrap gap-8" aria-label="The three rooms">
        {[...ROOMS.map((r) => r.name), "The ending"].map((name, i) => (
          <li key={name}>
            <button type="button" className={`btn btn-ghost ${i === at ? "border-accent" : ""}`} aria-current={i === at ? "step" : undefined} onClick={() => go(i)}>
              <span className="num mr-8 text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
              {name}
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-21" aria-live="polite">
        {!done ? (
          <>
            <h2 className="h2">{ROOMS[at].name}</h2>
            <p className="lead mt-8 max-w-[40rem]">{ROOMS[at].lead}</p>
            <div className="mt-21 max-w-[52rem]">{ROOMS[at].body}</div>
            <div className="mt-34 flex flex-wrap gap-13 border-t border-line pt-21">
              {at > 0 && (
                <button type="button" className="btn btn-ghost" onClick={() => go(at - 1)}>
                  Back
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={() => go(at + 1)}>
                {at === ROOMS.length - 1 ? "To the ending" : `Next: ${ROOMS[at + 1].name.toLowerCase()}`}
              </button>
            </div>
          </>
        ) : (
          <div className="max-w-[40rem]">
            <h2 className="h2">That was the whole of it.</h2>
            <p className="lead mt-8">A trade is three decisions made before it is sent, one check, and then the waiting.</p>
            <ol className="mt-21 grid gap-13 border-t border-line pt-21 text-ink-2">
              <li>
                <strong className="text-ink">The stop decides the size.</strong> Never the other way round.
              </li>
              <li>
                <strong className="text-ink">A ticket can be in order and still lose.</strong> Checking removes only the avoidable mistakes.
              </li>
              <li>
                <strong className="text-ink">Every trade pays the spread.</strong> On a price that goes nowhere on average, that cost is the result.
              </li>
            </ol>
            <p className="mt-21 text-sm text-ink-3">None of this was a real market and none of it is advice. Trading with leverage carries a high risk of loss.</p>
            <div className="mt-21 flex flex-wrap gap-13">
              <Link href="/academy" className="btn btn-primary">
                The lessons
              </Link>
              <Link href="/academy/cheat-sheets" className="btn btn-ghost">
                The cheat sheets
              </Link>
              <button type="button" className="btn btn-ghost" onClick={() => go(0)}>
                Start again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- LEVERAGE, TOLD BY SCROLLING ------------------------------------------- */

const STORY = [
  { h: "You put down 1,000.", p: "That is your money. Call it the stake. On its own it could buy a position of 1,000, and a 1% move would change it by 10." },
  { h: "At 1:100, it controls 100,000.", p: "The stake has not grown. It is set aside as margin, and it answers for a position a hundred times its size." },
  { h: "The market moves 1%.", p: "It would have moved 1% whatever you did. Leverage does not make a market move more." },
  { h: "On 100,000, that is 1,000.", p: "The move is measured on the position, not on the stake. One per cent of the position is the whole of the stake." },
  { h: "For you, or against you.", p: "If it went your way, the stake has doubled. If it went the other way, the stake is gone. Same move, same size, the other direction." },
  { h: "So choose a smaller position.", p: "At 10,000 the same 1% move is 100: a tenth of the stake. The leverage on offer did not change. The size you took did." },
] as const;
const RED: Colour = [214, 96, 88, 1];

export function ScrollStory() {
  const [at, setAt] = useState(0);
  const steps = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setAt(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    steps.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const target = useRef(0);
  target.current = at;
  const drawRef = useRef<FigureDraw | null>(null);
  if (!drawRef.current) {
    let s = 0; // the step being shown, eased
    drawRef.current = ({ ctx, w, h, dt, pal, still }) => {
      if (w < 160 || h < 120) return;
      s = still ? target.current : s + (target.current - s) * (1 - Math.exp(-dt * 5));
      const k = (n: number) => smooth(clamp(s - n + 1)); // 0 before step n, 1 once it is reached
      const base = h - 30;
      const full = base - 24;
      const stakeX = w * 0.2;
      const posX = w * 0.62;
      const bw = Math.min(70, w * 0.16);
      const small = k(5); // the last step: a position a tenth of the size
      const posH = full * lerp(1, 0.1, small) * k(1);
      const stakeH = full * 0.01 * 6; // drawn six times its true share, or it could not be seen; the label says what it is
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 10px ${pal.font}`;
      // the stake
      ctx.fillStyle = rgba(pal.accent, 0.9);
      ctx.fillRect(stakeX - bw / 2, base - stakeH, bw, stakeH);
      ctx.fillStyle = rgba(pal.ink2, 1);
      ctx.fillText("YOUR STAKE: 1,000", stakeX, base + 14);
      // the position it answers for
      if (posH > 1) {
        ctx.fillStyle = rgba(pal.ink3, 0.28);
        ctx.fillRect(posX - bw / 2, base - posH, bw, posH);
        ctx.strokeStyle = rgba(pal.ink3, 0.9);
        ctx.lineWidth = 1;
        ctx.strokeRect(posX - bw / 2 + 0.5, base - posH + 0.5, bw - 1, posH - 1);
        ctx.fillStyle = rgba(pal.ink2, 1);
        ctx.fillText(small > 0.5 ? "POSITION: 10,000" : "POSITION: 100,000", posX, base + 14);
        // the 1% move, as a slice of the position
        const move = k(2);
        if (move > 0.02) {
          const slice = Math.max(2, posH * 0.01 * 6) * move;
          const against = k(4);
          ctx.fillStyle = rgba(against > 0.5 ? RED : pal.emerald, 0.95);
          ctx.fillRect(posX - bw / 2, base - posH, bw, slice);
          ctx.textAlign = "left";
          ctx.fillStyle = rgba(pal.ink, 1);
          ctx.fillText(`1% = ${small > 0.5 ? "100" : "1,000"}`, posX + bw / 2 + 8, base - posH + slice / 2);
          ctx.textAlign = "center";
          // carried across to the stake: what that slice is, measured against what you put down
          const carry = k(3);
          if (carry > 0.02) {
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = rgba(pal.gold, carry);
            ctx.beginPath();
            ctx.moveTo(posX - bw / 2, base - posH + slice / 2);
            ctx.lineTo(stakeX + bw / 2, base - stakeH / 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = rgba(against > 0.5 ? RED : pal.emerald, carry);
            ctx.fillRect(stakeX - bw / 2, base - stakeH, bw, stakeH * lerp(1, 0.1, small));
            ctx.fillStyle = rgba(pal.ink, carry);
            ctx.fillText(small > 0.5 ? "A TENTH OF THE STAKE" : "THE WHOLE STAKE", stakeX, base - stakeH - 12);
          }
        }
      }
      ctx.strokeStyle = rgba(pal.ink3, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, base + 0.5);
      ctx.lineTo(w - 10, base + 0.5);
      ctx.stroke();
    };
  }
  return (
    <div className="grid gap-34 lg:grid-cols-2 lg:gap-55">
      <div className="lg:order-2">
        <div className="gx-stage lg:sticky lg:top-[calc(var(--header-h)+2.125rem)]">
          <Figure draw={drawRef.current} ratio={1.15} rev={at} />
          <p className="mt-8 text-xs text-ink-3">The stake is drawn larger than its true share, or it could not be seen. The figures are examples.</p>
        </div>
      </div>
      <ol className="lg:order-1">
        {STORY.map((x, i) => (
          <li
            key={x.h}
            data-step={i}
            ref={(el) => {
              steps.current[i] = el;
            }}
            className={`border-l-2 py-34 pl-21 transition-colors duration-slow lg:min-h-[60vh] ${i === at ? "border-accent" : "border-line"}`}
          >
            <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">0{i + 1}</p>
            <h2 className={`h2 mt-8 transition-opacity duration-slow ${i === at ? "" : "opacity-50"}`}>{x.h}</h2>
            <p className={`lead mt-13 max-w-[30rem] transition-opacity duration-slow ${i === at ? "" : "opacity-50"}`}>{x.p}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---- TERM OF THE DAY ------------------------------------------------------- */

export type DayTerm = { slug: string; term: string; says: string; a?: string; b?: string };

export function TermOfDay({ terms }: { terms: DayTerm[] }) {
  const [at, setAt] = useState<number | null>(null);
  // a different term from the riddle's: the same day, counted from the other end of the list
  useEffect(() => setAt(terms.length - 1 - (Math.floor(Date.now() / 86400000) % terms.length)), [terms.length]);
  if (at === null) return <p className="gx-wait text-ink-3">Today’s term appears once the page has loaded.</p>;
  const t = terms[at];
  return (
    <div>
      <p className="font-display text-3xl text-ink">{t.term}</p>
      {t.a && (
        <p className="gx-couplet mt-13 !mb-0">
          <span>{t.a}</span>
          <span>{t.b}</span>
        </p>
      )}
      <p className="mt-13 max-w-measure text-ink-2">{t.says}</p>
      <Link href={`/glossary/${t.slug}`} className="go mt-13">
        The full definition
      </Link>
    </div>
  );
}

/* ---- THE FOOTER'S MOTTO ---------------------------------------------------- */

const MOTTOS = Object.values(punchLines);

export function FooterMotto() {
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => setAt(Math.floor(Date.now() / 86400000) % MOTTOS.length), []);
  if (at === null) return null;
  const m = MOTTOS[at];
  return (
    <p className="gx-motto" aria-label="A line to remember">
      <span>{m.a}</span> <span className="gx-motto-b">{m.b}</span>
    </p>
  );
}

/* ---- WHAT IS NEW ----------------------------------------------------------- */

export function NewRibbon() {
  const play = usePlay();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  const latest = RELEASES[0];
  // put away with "Got it" until something newer is added; a first-time visitor sees it once, as "recently added"
  if ((play.v ?? "") >= latest.id) return null;
  const fresh = RELEASES.filter((r) => r.id > (play.v ?? "")).slice(0, 3);
  return (
    <aside className="gx-ribbon no-print" aria-label="Recently added">
      <p className="label shrink-0">{readPlay().v ? "New since you were last here" : "Recently added"}</p>
      <ul className="flex min-w-0 flex-wrap gap-x-21 gap-y-3">
        {fresh.map((r) => (
          <li key={r.id}>
            <Link href={r.href} className="link text-sm">
              {r.title}
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-ghost btn-sm ml-auto shrink-0" onClick={() => noteSeen(latest.id)}>
        Got it
      </button>
    </aside>
  );
}
