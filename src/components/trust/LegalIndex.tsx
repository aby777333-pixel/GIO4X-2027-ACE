"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

export type IndexDoc = {
  path: string;
  title: string;
  category: string;
  summary: string;
  version: string;
  updated: string;
  carried: boolean;
  /** lower-cased text the filter searches: title, summary, keywords, section titles */
  haystack: string;
  sections: number;
};

export type IndexPending = { title: string; category: string; note: string };

/**
 * Client-side search and category filter for the document centre.
 * The full list is server-rendered; this only hides rows, so the page is
 * complete without JavaScript.
 */
export function LegalIndex({ docs, pending, categories }: { docs: IndexDoc[]; pending: IndexPending[]; categories: readonly string[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const inputId = useId();

  const terms = useMemo(() => q.toLowerCase().split(/\s+/).filter(Boolean), [q]);
  const shown = docs.filter((d) => (cat === "All" || d.category === cat) && terms.every((t) => d.haystack.includes(t)));
  const shownPending = pending.filter((d) => (cat === "All" || d.category === cat) && terms.every((t) => `${d.title} ${d.note}`.toLowerCase().includes(t)));
  const count = (c: string) => (c === "All" ? docs.length : docs.filter((d) => d.category === c).length);
  const filtered = cat !== "All" || terms.length > 0;

  return (
    <div>
      <div className="grid gap-21 lg:grid-cols-phi lg:items-end">
        <div className="field">
          <label htmlFor={inputId}>Search documents</label>
          <input
            id={inputId}
            type="search"
            className="input"
            placeholder="For example: withdrawal, cookies, leverage"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <p className="text-sm text-ink-3 lg:pb-13 lg:text-right" aria-live="polite">
          <span className="num">{shown.length}</span> of <span className="num">{docs.length}</span> published documents shown
        </p>
      </div>

      <div className="scroll-x mt-21 pb-3" role="group" aria-label="Filter by category">
        <div className="seg">
          {["All", ...categories].map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className="!h-[2.75rem] whitespace-nowrap">
              {c}
              <span className="num ml-5 opacity-60">{count(c)}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-34 border-t border-line-strong">
        {shown.map((d) => (
          <li key={d.path} className="border-b border-line">
            <Link href={d.path} className="group grid gap-x-34 gap-y-8 py-21 transition-colors duration-fast hover:bg-surface md:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] md:px-13">
              <span>
                <span className="label">{d.category}</span>
                <span className="h3 mt-5 block transition-colors duration-fast group-hover:text-accent">{d.title}</span>
                <span className="mt-8 block max-w-measure text-ink-2">{d.summary}</span>
              </span>
              <span className="grid content-between gap-13 md:justify-items-end md:text-right">
                <span className="grid gap-3 text-sm text-ink-3">
                  <span>
                    Updated <span className="num text-ink">{d.updated}</span>
                  </span>
                  <span>
                    {d.version === "Carried-over text" ? d.version : `Version ${d.version}`} · <span className="num">{d.sections}</span> sections
                  </span>
                  <span className={`state ${d.carried ? "state-pre" : "state-open"} md:justify-self-end`}>{d.carried ? "Under legal review" : "Current"}</span>
                </span>
                <span className="go" aria-hidden>
                  Read
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {shown.length === 0 && (
        <div className="border-b border-line py-34">
          <p className="h4">No published document matches{cat !== "All" ? ` in ${cat}` : ""}.</p>
          <p className="mt-8 max-w-measure text-sm text-ink-2">
            {shownPending.length > 0
              ? "The documents below belong here and have not been published yet."
              : "Try a different word, or clear the filter to see every document."}
          </p>
          {filtered && (
            <button
              type="button"
              className="btn btn-ghost mt-21"
              onClick={() => {
                setQ("");
                setCat("All");
              }}
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {shownPending.length > 0 && (
        <div className="mt-55">
          <p className="label">Not yet published</p>
          <ul className="mt-13 border-t border-line">
            {shownPending.map((d) => (
              <li key={d.title} className="grid gap-x-34 gap-y-3 border-b border-line py-13 md:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] md:px-13">
                <span>
                  <span className="font-medium text-ink">{d.title}</span>
                  <span className="mt-2 block text-sm text-ink-3">{d.note}</span>
                </span>
                <span className="flex items-center gap-13 md:justify-end">
                  <span className="chip">{d.category}</span>
                  <span className="state state-off">Not yet published</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
