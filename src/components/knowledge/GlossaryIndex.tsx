"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { LearnCount, LearnedMark } from "@/components/glossary/Progress";

export type IndexTerm = { slug: string; term: string; first: string; letter: string; topic: string; aliases: string[] };

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * The glossary as a reference: an A–Z rail, a topic filter and a filter box
 * that narrows the list as you type. The whole list is in the HTML, so it
 * reads, prints and indexes without JavaScript; the filter only hides rows.
 * `?q=` pre-fills the box, so a filtered view can be linked to.
 */
export function GlossaryIndex({ terms, topics, lessonLine, lessonTotal = 0 }: { terms: IndexTerm[]; topics: string[]; /** a sentence above the filter about the lessons the terms open as */ lessonLine?: string; /** how many terms have a lesson */ lessonTotal?: number }) {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) setQ(initial.slice(0, 60));
  }, []);

  // keep the address in step with the box, without adding history entries
  useEffect(() => {
    const url = new URL(window.location.href);
    const value = q.trim();
    if ((url.searchParams.get("q") ?? "") === value) return;
    if (value) url.searchParams.set("q", value);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, [q]);

  const needle = q.trim().toLowerCase();
  const visible = useMemo(() => {
    return terms.filter((t) => {
      if (topic && t.topic !== topic) return false;
      if (!needle) return true;
      if (t.term.toLowerCase().includes(needle) || t.slug.replace(/-/g, " ").includes(needle)) return true;
      if (t.aliases.some((a) => a.includes(needle))) return true;
      return needle.length >= 4 && t.first.toLowerCase().includes(needle);
    });
  }, [terms, topic, needle]);

  const groups = useMemo(() => {
    const m = new Map<string, IndexTerm[]>();
    for (const t of visible) m.set(t.letter, [...(m.get(t.letter) ?? []), t]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);
  const live = new Set(groups.map(([l]) => l));
  const filtered = Boolean(needle || topic);

  return (
    <div className="wrap section-quiet">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-55 gap-y-21 lg:grid-cols-[2.75rem_minmax(0,1fr)]">
        {/* A–Z rail: a column on desktop, a snapping strip under the header on small screens */}
        <nav aria-label="Jump to a letter" className="az-rail no-print sticky top-[var(--header-h)] z-1 -mx-[var(--gutter)] border-b border-line bg-bg px-[var(--gutter)] lg:top-[calc(var(--header-h)+1.3125rem)] lg:mx-0 lg:self-start lg:border-b-0 lg:px-0">
          <ul className="scroll-x flex snap-x lg:grid lg:overflow-visible">
            {ALPHABET.map((l) => (
              <li key={l} className="shrink-0 snap-start">
                {live.has(l) ? (
                  <a href={`#letter-${l}`} className="num flex h-[2.75rem] w-[2.125rem] items-center justify-center text-sm font-semibold text-ink-2 transition-colors duration-fast hover:text-accent lg:h-[1.625rem] lg:w-[2.75rem] lg:justify-start">
                    {l}
                  </a>
                ) : (
                  // a letter with no terms is not a link: nothing to jump to
                  <span aria-hidden className="num flex h-[2.75rem] w-[2.125rem] items-center justify-center text-sm font-semibold text-ink-3 opacity-40 lg:h-[1.625rem] lg:w-[2.75rem] lg:justify-start">
                    {l}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          {lessonLine && (
            <div className="mb-21 max-w-measure border-l border-accent pl-21">
              <p className="text-ink-2">{lessonLine}</p>
              <LearnCount total={lessonTotal} className="mt-8" />
            </div>
          )}
          <div className="field">
            <label htmlFor={inputId}>Filter the glossary</label>
            <input
              id={inputId}
              type="search"
              className="input !h-[3.4375rem] !text-lg"
              placeholder="Type a term: pip, margin call, carry trade…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
            />
          </div>

          <div className="mt-13 flex flex-wrap items-center gap-8" role="group" aria-label="Filter by topic">
            <button type="button" className="chip !h-[2.125rem] cursor-pointer aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg" aria-pressed={topic === null} onClick={() => setTopic(null)}>
              All topics
            </button>
            {topics.map((t) => (
              <button key={t} type="button" className="chip !h-[2.125rem] cursor-pointer aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg" aria-pressed={topic === t} onClick={() => setTopic(topic === t ? null : t)}>
                {t}
              </button>
            ))}
          </div>

          <p className="num mt-13 text-xs text-ink-3" aria-live="polite">
            {filtered ? `${visible.length} of ${terms.length} terms` : `${terms.length} terms`}
            {filtered && (
              <button
                type="button"
                className="link ml-13"
                onClick={() => {
                  setQ("");
                  setTopic(null);
                }}
              >
                Clear
              </button>
            )}
          </p>

          {groups.length === 0 ? (
            <div className="panel-quiet mt-34 p-34">
              <p className="h4">No term matches{needle ? ` “${q.trim()}”` : " this topic"}.</p>
              <p className="mt-8 max-w-measure text-sm text-ink-2">It may be on the site under another name, or not be defined here yet. You can search the whole site, or tell us which term is missing.</p>
              <div className="mt-21 flex flex-wrap gap-13">
                <Link href={needle ? `/search?q=${encodeURIComponent(q.trim())}` : "/search"} className="btn btn-ghost">
                  Search the site
                </Link>
                <Link href="/contact" className="btn btn-quiet">
                  Suggest a term
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-34 grid gap-34">
              {groups.map(([letter, list]) => (
                <section key={letter} id={`letter-${letter}`} aria-labelledby={`h-${letter}`} className="scroll-mt-[calc(var(--header-h)+3.4375rem)] lg:scroll-mt-[calc(var(--header-h)+1.3125rem)]">
                  <h2 id={`h-${letter}`} className="flex items-baseline gap-13 border-b border-line-strong pb-8">
                    <span className="font-display text-3xl font-light leading-none">{letter}</span>
                    <span className="num text-xs text-ink-3">{list.length}</span>
                  </h2>
                  <ul>
                    {list.map((t) => (
                      <li key={t.slug} className="border-b border-line">
                        <Link href={`/glossary/${t.slug}`} className="group grid gap-x-34 gap-y-3 py-13 transition-colors duration-fast hover:bg-[var(--brand-soft)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)_8.5rem] md:items-baseline md:py-21">
                          <span className="h4 transition-colors duration-fast group-hover:text-accent">
                            {t.term}
                            <LearnedMark slug={t.slug} />
                          </span>
                          <span className="text-[0.9375rem] text-ink-2">{t.first}</span>
                          <span className="label md:text-right">{t.topic}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
