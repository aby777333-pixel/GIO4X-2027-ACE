"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLearned } from "@/components/glossary/learn";
import { signalSound } from "@/components/sound/signal";
import type { MilestoneData } from "@/data/milestones";
import { usePrefs } from "@/hooks/usePrefs";
import { badges, newlyEarned, type Badge, type BadgeGroup } from "./badges";
import "./milestones.css";

/**
 * Milestones on My desk, and a strip of the Academy's on the Academy page.
 *
 * Everything is worked out, after the page has mounted, from what this
 * browser already holds (./badges): the server sends no badge and nothing
 * new is stored. A badge earned during the visit is struck once (a short
 * animation, and one chime if the visitor has interface sounds on) and
 * announced politely; with motion reduced it is simply shown as new.
 */

/** Said wherever badges are shown. */
const HONEST = "Milestones mark pages read and questions answered in this browser. They are not qualifications, and nothing about them is sent anywhere.";

/* ---- the medallion ----------------------------------------------------------------- */

const C = 32;

function Motif({ badge, ink, accent }: { badge: Badge; ink: string; accent: string }) {
  const on = badge.earned;
  const line = { fill: "none", stroke: ink, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (badge.family) {
    case "terms":
      // a numeral, engraved, over a short rule
      return (
        <>
          <text x={C} y={C - 1} textAnchor="middle" dominantBaseline="central" fontSize={badge.mark.length > 1 ? 12 : 21} fontWeight={600} fill={ink} className="font-display">
            {badge.mark}
          </text>
          <path d="M24 45H40" {...line} stroke={accent} />
        </>
      );
    case "topic": {
      // a ring of the glossary's topics with this one picked out, and its initials
      const of = badge.place?.of ?? 1;
      const at = badge.place?.at ?? 0;
      const r = 19;
      const round = 2 * Math.PI * r;
      const seg = round / of - 3;
      return (
        <>
          {Array.from({ length: of }, (_, i) => (
            <circle key={i} cx={C} cy={C} r={r} fill="none" stroke={i === at ? accent : ink} strokeWidth={i === at ? 3 : 1.5} strokeOpacity={i === at ? 1 : 0.45} strokeDasharray={`${seg} ${round - seg}`} strokeDashoffset={-(i * round) / of} transform={`rotate(-90 ${C} ${C})`} />
          ))}
          <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600} fill={ink} className="font-display">
            {badge.mark}
          </text>
        </>
      );
    }
    case "lesson":
      // an open book
      return (
        <>
          <path d="M17 24q7.5-4 15 0q7.5-4 15 0v18q-7.5-4-15 0q-7.5-4-15 0z" {...line} />
          <path d="M32 24v18" {...line} stroke={accent} />
        </>
      );
    case "level": {
      // steps: one for each level, climbed as far as this one
      const of = badge.place?.of ?? 1;
      const at = badge.place?.at ?? 0;
      const w = 28 / of;
      return (
        <>
          {Array.from({ length: of }, (_, i) => {
            const h = 6 + (i * 16) / Math.max(1, of - 1);
            const reached = i <= at;
            return <rect key={i} x={18 + i * w + 1} y={43 - h} width={w - 2} height={h} rx={0.75} fill={reached && on ? (i === at ? accent : ink) : "none"} stroke={i === at ? accent : ink} strokeWidth={1.25} strokeOpacity={reached ? 1 : 0.45} />;
          })}
          <path d="M17 46H47" {...line} strokeWidth={1} />
        </>
      );
    }
    case "path": {
      // a route with its stops: one more stop for each further path
      const stops = 3 + (badge.place?.at ?? 0);
      return (
        <>
          <path d="M17 42C25 42 23 30 32 31S40 22 47 22" {...line} />
          {Array.from({ length: stops }, (_, i) => {
            const t = i / (stops - 1);
            // points along the same curve, by eye: the two ends and between them
            const x = 17 + 30 * t;
            const y = 42 - 20 * t + Math.sin(t * Math.PI * 2) * 2.5;
            const end = i === stops - 1;
            return <circle key={i} cx={x} cy={y} r={end ? 3 : 2.25} fill={on ? (end ? accent : ink) : "var(--bg)"} stroke={end ? accent : ink} strokeWidth={1.25} />;
          })}
        </>
      );
    }
    case "lessons":
      // a shelf of books
      return (
        <>
          <rect x={19} y={38} width={26} height={6} rx={1} {...line} fill={on ? ink : "none"} />
          <rect x={21} y={30.5} width={24} height={6} rx={1} {...line} />
          <rect x={18} y={23} width={25} height={6} rx={1} {...line} stroke={accent} fill={on ? accent : "none"} />
        </>
      );
    case "tour":
      // a compass
      return (
        <>
          <circle cx={C} cy={C} r={16} {...line} strokeWidth={1} strokeOpacity={0.6} />
          <path d="M32 17l3.2 11.8L47 32l-11.8 3.2L32 47l-3.2-11.8L17 32l11.8-3.2z" {...line} fill={on ? "var(--surface)" : "none"} />
          <path d="M32 17l3.2 11.8h-6.4z" fill={on ? accent : "none"} stroke={accent} strokeWidth={1.25} strokeLinejoin="round" />
        </>
      );
    default:
      // the whole course: the eight blades of the mark
      return (
        <>
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d="M32 32C29.5 25 32.5 19 37 14.5C38 21.5 36.5 27.5 32 32Z" transform={`rotate(${i * 45} ${C} ${C})`} fill={on ? (i % 2 ? accent : ink) : "none"} stroke={i % 2 ? accent : ink} strokeWidth={1} strokeLinejoin="round" />
          ))}
        </>
      );
  }
}

/** A small engraved medallion: full when earned, an outline when not. Decorative: the words beside it carry the meaning. */
function Medallion({ badge, size }: { badge: Badge; size: number }) {
  const on = badge.earned;
  const ink = on ? "var(--prestige-ink)" : "var(--ink-3)";
  const accent = on ? "var(--accent)" : "var(--ink-3)";
  return (
    <span className="gx-medal-wrap" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="gx-medal" data-earned={on ? "" : undefined}>
        {on ? (
          <>
            {/* the rim, milled, and the field inside it */}
            <circle cx={C} cy={C} r={30.5} fill="var(--prestige)" stroke="var(--prestige-ink)" strokeWidth={1} />
            <circle cx={C} cy={C} r={28} fill="none" stroke="var(--prestige-ink)" strokeWidth={2.5} strokeDasharray="1 2.4" strokeOpacity={0.5} />
            <circle cx={C} cy={C} r={25} fill="color-mix(in srgb, var(--prestige) 14%, var(--surface))" stroke="var(--prestige-ink)" strokeWidth={1} />
          </>
        ) : (
          <>
            <circle cx={C} cy={C} r={30.5} fill="none" stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.7} />
            <circle cx={C} cy={C} r={25} fill="none" stroke="var(--ink-3)" strokeWidth={1} strokeOpacity={0.35} />
          </>
        )}
        <g opacity={on ? 1 : 0.7}>
          <Motif badge={badge} ink={ink} accent={accent} />
        </g>
      </svg>
    </span>
  );
}

/* ---- what this browser has earned --------------------------------------------------- */

function useBadges(data: MilestoneData): { list: Badge[] | null; fresh: ReadonlySet<string> } {
  const learned = useLearned();
  const [prefs, , ready] = usePrefs();
  const list = useMemo(() => (learned === null || !ready ? null : badges(data, learned, prefs?.tourDone === true)), [data, learned, ready, prefs?.tourDone]);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const earnedKey = list ? list.filter((b) => b.earned).map((b) => b.id).join("|") : null;

  useEffect(() => {
    if (!list || earnedKey === null) return;
    const now = newlyEarned(data, list);
    if (now.length === 0) return;
    setFresh((old) => new Set([...old, ...now]));
    // heard only if the visitor has switched interface sounds on: otherwise nobody is listening
    signalSound("chime");
    // the list is read at the moment the earned set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earnedKey, data]);

  return { list, fresh };
}

const progress = (b: Badge) => (b.need === 1 ? "Not yet earned" : `${b.have} of ${b.need}`);

function Announce({ list, fresh }: { list: Badge[]; fresh: ReadonlySet<string> }) {
  const names = list.filter((b) => fresh.has(b.id)).map((b) => b.title);
  return (
    <p role="status" aria-live="polite" className="sr-only" data-milestone-announce>
      {names.length === 0 ? "" : names.length === 1 ? `Milestone earned: ${names[0]}.` : `Milestones earned: ${names.join(", ")}.`}
    </p>
  );
}

/* ---- My desk ------------------------------------------------------------------------ */

const GROUPS: { group: BadgeGroup; title: string; topics?: boolean }[] = [
  { group: "glossary", title: "Glossary" },
  { group: "glossary", title: "Glossary topics", topics: true },
  { group: "academy", title: "Academy" },
  { group: "course", title: "The whole course" },
];

function Card({ badge, isNew }: { badge: Badge; isNew: boolean }) {
  return (
    <li className="grid grid-cols-[3.4375rem_minmax(0,1fr)] items-start gap-x-13 border-b border-line py-13" data-milestone={badge.id} data-earned={badge.earned ? "" : undefined} data-milestone-new={isNew ? "" : undefined}>
      <Medallion badge={badge} size={55} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <span className={`text-[0.9375rem] font-semibold ${badge.earned ? "text-ink" : "text-ink-2"}`}>{badge.title}</span>
          <span className={`num text-xs ${badge.earned ? "font-semibold text-prestige-ink" : "text-ink-3"}`} data-milestone-state>
            {badge.earned ? (isNew ? "Newly earned" : "Earned") : progress(badge)}
          </span>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">{badge.how}</p>
      </div>
    </li>
  );
}

export function Milestones({ data, fallback }: { data: MilestoneData; fallback: ReactNode }) {
  const { list, fresh } = useBadges(data);
  if (!list) return <>{fallback}</>;
  const earned = list.filter((b) => b.earned).length;

  return (
    <div data-milestones>
      <Announce list={list} fresh={fresh} />
      <p className="text-ink-2">
        <span className="num font-display text-2xl font-light text-ink" data-milestones-earned>
          {earned}
        </span>{" "}
        of <span className="num">{list.length}</span> earned
      </p>
      <p className="mt-5 max-w-measure text-sm text-ink-3">{HONEST}</p>
      <div className="mt-21 grid gap-34">
        {GROUPS.map((g) => {
          const items = list.filter((b) => b.group === g.group && (b.family === "topic") === Boolean(g.topics));
          if (items.length === 0) return null;
          return (
            <div key={g.title}>
              <h3 className="label">
                {g.title}{" "}
                <span className="num font-normal">
                  {items.filter((b) => b.earned).length} of {items.length}
                </span>
              </h3>
              <ul className="mt-8 grid gap-x-34 border-t border-line-strong sm:grid-cols-2">
                {items.map((b) => (
                  <Card key={b.id} badge={b} isNew={fresh.has(b.id)} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {earned === 0 && (
        <p className="mt-21 flex flex-wrap gap-x-21 gap-y-5 text-sm">
          <Link href="/glossary" className="link">
            Glossary
          </Link>
          <Link href="/academy" className="link">
            Academy
          </Link>
        </p>
      )}
    </div>
  );
}

/* ---- the Academy page: its own milestones, small ----------------------------------- */

export function MilestoneStrip({ data, className = "" }: { data: MilestoneData; className?: string }) {
  const { list, fresh } = useBadges(data);
  // absent on the server and until storage has been read: the HTML is the same for everyone
  if (!list) return null;
  const items = list.filter((b) => b.group === "academy" || b.id === "course");
  if (items.length === 0) return null;

  return (
    <aside aria-labelledby="academy-milestones" className={`border-t border-line pt-21 ${className}`} data-milestone-strip>
      <Announce list={items} fresh={fresh} />
      <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-5">
        <h3 id="academy-milestones" className="label">
          Milestones{" "}
          <span className="num font-normal">
            {items.filter((b) => b.earned).length} of {items.length}
          </span>
        </h3>
        <Link href="/desk#milestones" className="go">
          All milestones on My desk
        </Link>
      </div>
      <ul className="mt-13 grid grid-cols-2 gap-x-13 gap-y-21 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9">
        {items.map((b) => (
          <li key={b.id} className="grid justify-items-start gap-5" data-milestone={b.id} data-earned={b.earned ? "" : undefined} data-milestone-new={fresh.has(b.id) ? "" : undefined}>
            <Medallion badge={b} size={44} />
            <span className={`text-xs font-semibold leading-snug ${b.earned ? "text-ink" : "text-ink-2"}`}>{b.title}</span>
            <span className={`num text-xs ${b.earned ? "text-prestige-ink" : "text-ink-3"}`} data-milestone-state>
              {b.earned ? (fresh.has(b.id) ? "Newly earned" : "Earned") : progress(b)}
            </span>
            <span className="sr-only">{b.how}</span>
          </li>
        ))}
      </ul>
      <p className="mt-21 max-w-measure text-xs text-ink-3">{HONEST}</p>
    </aside>
  );
}
