"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Rosette } from "@/components/brand/Rosette";
import { loadSearchIndex } from "@/components/shell/CommandBar";
import { sendSearch } from "@/lib/pulse-client";
import { groupHits, parseIntent, search, type SearchEntry, type SearchGroup, type SearchHit } from "@/lib/search";

type Outcome = {
  /** what the query was understood as, shown to the visitor */
  reading: string | null;
  hits: SearchHit[];
  /** shown when nothing matched exactly */
  nearest: SearchHit[];
  /** a direct action for prefixes that are not a list (verify:, φ, display commands) */
  action: { label: string; note: string; href: string } | null;
};

/**
 * The query last counted as a search, in memory only. Kept outside the
 * component so that the same results shown again (a remount, or coming back
 * to them with the browser's back button) are not counted as a second search.
 */
let lastCounted: string | null = null;

const SUGGESTIONS = ["EUR/USD", "gold", "define: slippage", "calc: margin", "leverage", "London session"];

function resolve(index: SearchEntry[], raw: string): Outcome {
  const q = raw.trim();
  const intent = parseIntent(q);
  const only = (groups: SearchGroup[], query: string, limit = 30) => search(index, query, { only: groups, limit });
  let reading: string | null = null;
  let hits: SearchHit[] = [];
  let action: Outcome["action"] = null;

  switch (intent.kind) {
    case "symbol":
      reading = "Instruments only";
      hits = only(["Instruments"], intent.query);
      break;
    case "define":
      reading = "Glossary only";
      hits = only(["Glossary"], intent.query);
      break;
    case "calc":
      reading = "Tools only";
      hits = only(["Tools"], intent.query || "calculator");
      break;
    case "verify":
      action = {
        label: "Check this link against the official GIO4X registry",
        note: intent.query || "Open the link verifier and paste the address there.",
        href: `/trust/verify${intent.query ? `#${encodeURIComponent(intent.query)}` : ""}`,
      };
      break;
    case "phi":
      action = { label: "φ = 1.618…", note: "Designing GIO4X: the proportion behind every page.", href: "/design" };
      break;
    case "command":
      action = { label: intent.label, note: "Display settings are changed on the preferences page.", href: "/preferences" };
      break;
    case "search":
      hits = search(index, intent.query, { bias: intent.bias, limit: 60 });
      break;
  }

  let nearest: SearchHit[] = [];
  if (!hits.length && !action && q) {
    // nothing matched exactly: try each word on its own, across everything
    const seen = new Set<string>();
    const body = "query" in intent ? intent.query : q;
    for (const word of body.split(/\s+/).filter((w) => w.length >= 2)) {
      for (const h of search(index, word, { limit: 6 })) {
        if (seen.has(h.h)) continue;
        seen.add(h.h);
        nearest.push(h);
      }
    }
    nearest = nearest.sort((a, b) => b.score - a.score).slice(0, 8);
  }
  return { reading, hits, nearest, action };
}

function HitRow({ h }: { h: SearchHit }) {
  return (
    <li className="border-b border-line">
      <Link href={h.h} className="group grid gap-x-21 gap-y-2 py-13 transition-colors duration-fast hover:bg-surface sm:px-13 md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)] md:items-baseline">
        <span className="text-md font-medium text-ink transition-colors duration-fast group-hover:text-accent">{h.t}</span>
        <span className="text-sm text-ink-3">{h.d ?? h.h}</span>
      </Link>
    </li>
  );
}

/**
 * The full results page. Reads ?q=, loads the same index as the command bar,
 * and never ends in a dead end: an unmatched query still shows the nearest
 * things and the way to the directory.
 */
export function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const inputId = useId();
  const q = (params.get("q") ?? "").slice(0, 120);
  const [draft, setDraft] = useState(q);
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(q), [q]);

  const load = () => {
    setFailed(false);
    loadSearchIndex()
      .then(setIndex)
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  // One query shown on this page is one search, added to the day's total (src/lib/pulse-client.ts).
  // What was typed is compared with the site's own terms in this browser and is not sent.
  useEffect(() => {
    if (!index || !q.trim() || lastCounted === q) return;
    lastCounted = q;
    sendSearch(q, index);
  }, [index, q]);

  const outcome = useMemo(() => (index && q.trim() ? resolve(index, q) : null), [index, q]);
  const groups = useMemo(() => (outcome ? groupHits(outcome.hits) : []), [outcome]);
  const total = outcome?.hits.length ?? 0;

  const go = (value: string) => {
    const v = value.trim();
    router.push(v ? `${pathname}?q=${encodeURIComponent(v)}` : pathname);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    go(draft);
  };

  return (
    <div>
      <form role="search" onSubmit={onSubmit} className="flex flex-col gap-13 sm:flex-row sm:items-end">
        <div className="field grow">
          <label htmlFor={inputId}>Search GIO4X</label>
          <input
            ref={inputRef}
            id={inputId}
            name="q"
            type="search"
            className="input h-[3.4375rem] text-md"
            placeholder="A symbol, a term, a tool, a page"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={120}
            enterKeyHint="search"
          />
        </div>
        <button type="submit" className="btn btn-primary btn-lg">
          Search
        </button>
      </form>
      <p className="mt-8 flex flex-wrap gap-x-21 gap-y-3 text-xs text-ink-3">
        <span>
          <kbd className="font-sans font-semibold text-ink-2">$EURUSD</kbd> symbol
        </span>
        <span>
          <kbd className="font-sans font-semibold text-ink-2">define:</kbd> glossary
        </span>
        <span>
          <kbd className="font-sans font-semibold text-ink-2">calc:</kbd> tools
        </span>
        <span>
          <kbd className="font-sans font-semibold text-ink-2">verify:</kbd> a link
        </span>
      </p>

      <div className="mt-34" aria-live="polite" aria-busy={!index && !failed}>
        {failed && (
          <div className="panel-quiet grid justify-items-start gap-13 p-21 sm:p-34" role="alert">
            <p className="h4">Search could not load.</p>
            <p className="max-w-measure text-sm text-ink-2">The search index did not arrive. The site directory lists every page and does not depend on it.</p>
            <div className="flex flex-wrap gap-13">
              <button type="button" className="btn btn-primary" onClick={load}>
                Try again
              </button>
              <Link href="/explore" className="btn btn-ghost">
                Site directory
              </Link>
            </div>
          </div>
        )}

        {!failed && !index && (
          <p className="flex items-center gap-13 text-sm text-ink-3">
            <Rosette size={21} dna spin />
            Loading the index…
          </p>
        )}

        {index && !q.trim() && (
          <div>
            <p className="label">Try</p>
            <ul className="mt-13 flex flex-wrap gap-8">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" className="btn btn-ghost btn-sm h-[2.75rem] normal-case tracking-normal" onClick={() => go(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-21 text-sm text-ink-3">
              <span className="num">{index.length.toLocaleString("en-GB")}</span> entries indexed: instruments, markets, tools, glossary terms, articles and pages. Or browse the{" "}
              <Link href="/explore" className="link">
                site directory
              </Link>
              .
            </p>
          </div>
        )}

        {outcome && (
          <>
            {outcome.action && (
              <Link href={outcome.action.href} className="group panel flex flex-wrap items-center justify-between gap-21 p-21 transition-colors duration-fast hover:border-line-strong sm:p-34">
                <span>
                  <span className="h4 block">{outcome.action.label}</span>
                  <span className="mt-5 block break-all text-sm text-ink-3">{outcome.action.note}</span>
                </span>
                <span className="go" aria-hidden>
                  Open
                </span>
              </Link>
            )}

            {total > 0 && (
              <>
                <p className="text-sm text-ink-3">
                  <span className="num font-medium text-ink">{total}</span> {total === 1 ? "result" : "results"} for “{q.trim()}”
                  {outcome.reading && <span className="chip ml-13 align-middle">{outcome.reading}</span>}
                </p>
                {groups.length > 1 && (
                  <ul className="mt-13 flex flex-wrap gap-8" aria-label="Jump to a group">
                    {groups.map((g) => (
                      <li key={g.group}>
                        <a href={`#g-${g.group.replace(/[^a-z]+/gi, "-").toLowerCase()}`} className="chip min-h-[2.125rem] transition-colors duration-fast hover:border-line-strong">
                          {g.group} <span className="num text-ink-3">{g.hits.length}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-21 grid gap-34">
                  {groups.map((g) => (
                    <section key={g.group} id={`g-${g.group.replace(/[^a-z]+/gi, "-").toLowerCase()}`} className="scroll-mt-[calc(var(--header-h)+1.3125rem)]" aria-label={g.group}>
                      <h2 className="label border-b border-line-strong pb-8">{g.group}</h2>
                      <ul>
                        {g.hits.map((h) => (
                          <HitRow key={`${h.g}:${h.h}`} h={h} />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </>
            )}

            {total === 0 && !outcome.action && (
              <div>
                <div className="flex items-start gap-13">
                  <Rosette size={34} blades={5} className="mt-3 shrink-0 text-ink-3" />
                  <div>
                    <h2 className="h3">Nothing matched exactly.</h2>
                    <p className="mt-5 max-w-measure text-ink-2">
                      There is no entry for “{q.trim()}”{outcome.reading ? ` in ${outcome.reading.replace(" only", "").toLowerCase()}` : ""}.{" "}
                      {outcome.nearest.length ? "These are the nearest things we have." : "Try a shorter word, a symbol such as EURUSD, or the directory."}
                    </p>
                  </div>
                </div>
                {outcome.nearest.length > 0 && (
                  <section className="mt-21" aria-label="Nearest matches">
                    <h2 className="label border-b border-line-strong pb-8">Nearest matches</h2>
                    <ul>
                      {outcome.nearest.map((h) => (
                        <HitRow key={`${h.g}:${h.h}`} h={h} />
                      ))}
                    </ul>
                  </section>
                )}
                <div className="mt-21 flex flex-wrap gap-13">
                  <Link href="/explore" className="btn btn-primary">
                    Site directory
                  </Link>
                  <Link href="/glossary" className="btn btn-ghost">
                    Glossary
                  </Link>
                  <Link href="/contact" className="btn btn-ghost">
                    Ask us
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
