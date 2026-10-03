"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * THE GLOSSARY, AS A STAR MAP — every term a star, gathered into eight
 * constellations by topic, with a line between a term and the terms the
 * glossary lists as related to it.
 *
 * The places are worked out on the server (see /glossary/map) and are the
 * same on every visit. Each star is an ordinary link to its term. Choosing a
 * topic brings its constellation forward and lets the others fade; choosing a
 * star names it and lists what it is tied to. On a phone the map is as wide
 * as the screen and can be pinched like any picture.
 */

export type Star = { slug: string; term: string; topic: number; x: number; y: number; links: string[] };

export function StarMap({ stars, topics, lines }: { stars: Star[]; topics: string[]; lines: [number, number][] }) {
  const [topic, setTopic] = useState<number | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const cur = stars.find((s) => s.slug === at) ?? null;
  const near = new Set(cur ? [cur.slug, ...cur.links] : []);
  const dim = (s: Star) => (cur ? !near.has(s.slug) : topic !== null && s.topic !== topic);

  return (
    <div>
      <div className="flex flex-wrap gap-8" role="group" aria-label="Choose a constellation">
        <button type="button" className="btn btn-ghost btn-sm" aria-pressed={topic === null} onClick={() => setTopic(null)}>
          All
        </button>
        {topics.map((t, i) => (
          <button key={t} type="button" className="btn btn-ghost btn-sm !normal-case" aria-pressed={topic === i} onClick={() => setTopic(topic === i ? null : i)}>
            {t}
          </button>
        ))}
      </div>
      <div className="gx-sky on-night mt-13" onPointerLeave={() => setAt(null)}>
        <svg viewBox="0 0 1000 620" className="block h-auto w-full" role="img" aria-label={`A star map of ${stars.length} glossary terms in ${topics.length} constellations`}>
          {lines.map(([a, b], i) => {
            const A = stars[a];
            const B = stars[b];
            const on = cur ? near.has(A.slug) && near.has(B.slug) && (A.slug === cur.slug || B.slug === cur.slug) : topic === null || (A.topic === topic && B.topic === topic);
            return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} className="gx-sky-line" style={{ opacity: on ? (cur ? 0.9 : 0.32) : 0.05 }} />;
          })}
          {topics.map((t, i) => {
            const mine = stars.filter((s) => s.topic === i);
            const cx = mine.reduce((n, s) => n + s.x, 0) / mine.length;
            const top = Math.min(...mine.map((s) => s.y));
            return (
              <text key={t} x={cx} y={top - 14} textAnchor="middle" className="gx-sky-topic" style={{ opacity: topic === null || topic === i ? 0.9 : 0.2 }}>
                {t.toUpperCase()}
              </text>
            );
          })}
          {stars.map((s) => (
            <Link key={s.slug} href={`/glossary/${s.slug}`} aria-label={s.term} onPointerEnter={() => setAt(s.slug)} onFocus={() => setAt(s.slug)} onBlur={() => setAt(null)}>
              <circle cx={s.x} cy={s.y} r="11" fill="transparent" />
              <circle cx={s.x} cy={s.y} r={cur?.slug === s.slug ? 6 : 3 + (s.links.length > 3 ? 1.4 : 0)} className={`gx-sky-star gx-sky-t${s.topic % 4}`} style={{ opacity: dim(s) ? 0.16 : 1 }} />
            </Link>
          ))}
          {cur && (
            <text x={Math.min(900, Math.max(100, cur.x))} y={cur.y - 14} textAnchor="middle" className="gx-sky-name">
              {cur.term}
            </text>
          )}
        </svg>
      </div>
      <p className="mt-13 min-h-[3rem] text-ink-2" aria-live="polite">
        {cur ? (
          <>
            <Link href={`/glossary/${cur.slug}`} className="link font-medium">
              {cur.term}
            </Link>
            {cur.links.length ? `, tied to ${cur.links.map((l) => stars.find((s) => s.slug === l)?.term).filter(Boolean).join(", ")}.` : ", with no ties drawn."}
          </>
        ) : (
          "Point at a star, or move to it with the Tab key, to name it and see what it is tied to. Each star opens its term."
        )}
      </p>
    </div>
  );
}
