"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import type { Faq, FaqCategory } from "@/data/faqs";

/**
 * Help, searchable. Every question is in the HTML as a native disclosure, so
 * the page works without JavaScript; search and the category rail only hide
 * what does not match. A link to a question (`/faq#id`) opens it.
 */
export function FaqBrowser({ categories, items }: { categories: FaqCategory[]; items: Faq[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) setQ(initial.slice(0, 80));
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  const { words, matches } = useMemo(() => {
    const w = q
      .toLowerCase()
      .split(/\s+/)
      .filter((x) => x.length > 1);
    if (!w.length) return { words: w, matches: items };
    return {
      words: w,
      matches: items.filter((f) => {
        const hay = `${f.q} ${f.a}`.toLowerCase();
        return w.every((x) => hay.includes(x));
      }),
    };
  }, [items, q]);
  const shown = cat ? matches.filter((f) => f.cat === cat) : matches;
  const count = (key: string) => matches.filter((f) => f.cat === key).length;
  const railItem = "flex min-h-[2.75rem] w-full shrink-0 items-center justify-between gap-13 whitespace-nowrap border-b border-line text-left text-sm transition-colors duration-fast";

  return (
    <div className="wrap section-quiet">
      <div className="field max-w-[52rem]">
        <label htmlFor={inputId}>Search the answers</label>
        <input id={inputId} type="search" className="input !h-[3.4375rem] !text-lg" placeholder="For example: margin, swap, identity, deposit currencies" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
        <p className="field-hint" aria-live="polite">
          {words.length ? `${matches.length} of ${items.length} answers match.` : `${items.length} answers in ${categories.length} categories.`}
        </p>
      </div>

      <div className="mt-34 grid grid-cols-[minmax(0,1fr)] gap-x-89 gap-y-21 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Categories" className="no-print lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)] lg:self-start">
          <p className="label">Categories</p>
          <ul className="scroll-x -mx-[var(--gutter)] mt-8 flex gap-x-21 px-[var(--gutter)] lg:mx-0 lg:block lg:border-t lg:border-line-strong lg:px-0">
            <li className="shrink-0">
              <button type="button" aria-pressed={cat === null} onClick={() => setCat(null)} className={`${railItem} ${cat === null ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"}`}>
                <span>All</span>
                <span className="num text-xs text-ink-3">{matches.length}</span>
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.key} className="shrink-0">
                <button type="button" aria-pressed={cat === c.key} onClick={() => setCat(cat === c.key ? null : c.key)} className={`${railItem} ${cat === c.key ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"}`}>
                  <span>{c.label}</span>
                  <span className="num text-xs text-ink-3">{count(c.key)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          {shown.length === 0 ? (
            <div className="panel-quiet p-34">
              <p className="h4">No answer matches{q.trim() ? ` “${q.trim()}”` : ""}.</p>
              <p className="mt-8 max-w-measure text-sm text-ink-2">Not every question has a published answer yet. The quickest route is to ask us directly.</p>
              <div className="mt-21 flex flex-wrap gap-13">
                <Link href="/contact" className="btn btn-primary">
                  Contact GIO4X
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setQ("");
                    setCat(null);
                  }}
                >
                  Clear the search
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-55">
              {categories
                .filter((c) => shown.some((f) => f.cat === c.key))
                .map((c) => (
                  <section key={c.key} id={c.key} aria-labelledby={`cat-${c.key}`} className="scroll-mt-[calc(var(--header-h)+1.3125rem)]">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3 border-b border-line-strong pb-13">
                      <h2 id={`cat-${c.key}`} className="h3">
                        {c.label}
                      </h2>
                      <p className="text-sm text-ink-3">{c.blurb}</p>
                    </div>
                    {shown
                      .filter((f) => f.cat === c.key)
                      .map((f) => (
                        <details key={f.id} id={f.id} className="disclose scroll-mt-[calc(var(--header-h)+1.3125rem)] border-b border-line">
                          <summary className="min-h-[3.4375rem] py-13">
                            <h3 className="text-[1.0625rem] font-medium leading-snug text-ink">{f.q}</h3>
                          </summary>
                          <div className="max-w-measure pb-21">
                            {f.kind === "open" && <p className="chip mb-13">Not yet published</p>}
                            <p className="text-ink-2">{f.a}</p>
                            {f.links && f.links.length > 0 && (
                              <p className="mt-13 flex flex-wrap gap-x-21 gap-y-5 text-sm">
                                {f.links.map((l) => (
                                  <Link key={l.href} href={l.href} className="link inline-flex min-h-[1.625rem] items-center">
                                    {l.label}
                                  </Link>
                                ))}
                              </p>
                            )}
                          </div>
                        </details>
                      ))}
                  </section>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
