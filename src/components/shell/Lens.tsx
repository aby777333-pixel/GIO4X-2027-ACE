"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Rosette } from "@/components/brand/Rosette";
import { loadSearchIndex, openCommandBar } from "@/components/shell/CommandBar";
import { search, type SearchEntry } from "@/lib/search";

/**
 * GIO4X LENS — contextual intelligence for the page you are on.
 *
 * Three views, all derived from the page itself and from GIO4X's own curated
 * data. No language model is involved and nothing is generated:
 *   Explain  — glossary terms that actually appear on this page, defined
 *   Related  — what this page's subject is connected to in the GIO4X graph
 *   Sources  — every data note on the page: status, source and date
 * "Source mode" outlines those notes on the page itself.
 */

const OPEN_EVENT = "gx:lens";
export const openLens = () => window.dispatchEvent(new Event(OPEN_EVENT));

type GraphNode = { id: string; kind: string; label: string; href: string; blurb?: string };
type GraphEdge = { from: string; to: string; text?: string };
type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

let graphPromise: Promise<Graph> | null = null;
function loadGraph(): Promise<Graph> {
  if (!graphPromise) {
    graphPromise = fetch("/graph.json")
      .then((r) => (r.ok ? (r.json() as Promise<Graph>) : Promise.reject(new Error(String(r.status)))))
      .catch((e) => {
        graphPromise = null;
        throw e;
      });
  }
  return graphPromise;
}

type Explained = { title: string; definition: string; href: string };
type Related = { label: string; href: string; kind: string; text?: string };
type SourceNote = { status: string; source: string; updated: string };
type Tab = "explain" | "related" | "sources";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function termsOnPage(index: SearchEntry[], pathname: string): Explained[] {
  const main = document.getElementById("main");
  if (!main) return [];
  const text = ` ${main.innerText.toLowerCase().replace(/\s+/g, " ")} `;
  const found: { e: SearchEntry; at: number }[] = [];
  for (const e of index) {
    if (e.g !== "Glossary" || e.h === pathname) continue;
    const name = e.t.toLowerCase().replace(/\s*\([^)]*\)/g, "").trim();
    if (name.length < 3) continue;
    const m = new RegExp(`[^a-z0-9]${escapeRe(name)}s?[^a-z0-9]`).exec(text);
    if (m) found.push({ e, at: m.index });
  }
  return found
    .sort((a, b) => a.at - b.at)
    .slice(0, 8)
    .map(({ e }) => ({ title: e.t, definition: e.d ?? "", href: e.h }));
}

function notesOnPage(): SourceNote[] {
  const seen = new Set<string>();
  const out: SourceNote[] = [];
  document.querySelectorAll<HTMLElement>("#main [data-source-note]").forEach((el) => {
    const n = { status: el.dataset.status ?? "", source: el.dataset.source ?? "", updated: el.dataset.updated ?? "" };
    const key = `${n.status}|${n.source}|${n.updated}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(n);
    }
  });
  return out;
}

export function LensButton() {
  return (
    <button type="button" className="btn btn-quiet h-[2.125rem] gap-8 px-8 normal-case tracking-normal" onClick={openLens} aria-label="Open GIO4X Lens: explain, related and sources for this page">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.25" />
        <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.25" />
        <path d="M8 .8v2M8 13.2v2M.8 8h2M13.2 8h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
      <span className="hidden text-[0.8125rem] font-medium 2xl:inline">Lens</span>
    </button>
  );
}

export function Lens() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("explain");
  const [explained, setExplained] = useState<Explained[] | null>(null);
  const [related, setRelated] = useState<Related[] | null>(null);
  const [notes, setNotes] = useState<SourceNote[]>([]);
  const [title, setTitle] = useState("");
  const [sourceMode, setSourceMode] = useState(false);
  const [failed, setFailed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    restoreRef.current?.focus?.();
  }, []);

  useEffect(() => {
    const onOpen = () => {
      restoreRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // a new page is a new context
  useEffect(() => {
    setOpen(false);
    setExplained(null);
    setRelated(null);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.dataset.sources = sourceMode ? "on" : "off";
    return () => {
      delete document.documentElement.dataset.sources;
    };
  }, [sourceMode]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    setFailed(false);
    setTitle(document.title.split(" | ")[0]);
    setNotes(notesOnPage());
    let alive = true;
    loadSearchIndex()
      .then(async (index) => {
        if (!alive) return;
        setExplained(termsOnPage(index, pathname));
        let rel: Related[] = [];
        try {
          const g = await loadGraph();
          const node = g.nodes.find((n) => n.href === pathname);
          if (node) {
            const byId = new Map(g.nodes.map((n) => [n.id, n]));
            for (const e of g.edges) {
              const otherId = e.from === node.id ? e.to : e.to === node.id ? e.from : null;
              const other = otherId ? byId.get(otherId) : undefined;
              if (other && other.href !== pathname && !rel.some((r) => r.href === other.href)) rel.push({ label: other.label, href: other.href, kind: other.kind, text: e.text });
            }
          }
        } catch {
          /* graph unavailable: fall through to search */
        }
        if (!rel.length) {
          const h1 = document.querySelector("h1")?.textContent ?? "";
          rel = search(index, h1, { limit: 9 })
            .filter((h) => h.h !== pathname)
            .slice(0, 8)
            .map((h) => ({ label: h.t, href: h.h, kind: h.g, text: h.d }));
        }
        if (alive) setRelated(rel.slice(0, 12));
      })
      .catch(() => alive && setFailed(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, pathname, close]);

  if (!open) return null;

  const tabs: { key: Tab; label: string; count: number | null }[] = [
    { key: "explain", label: "Explain", count: explained?.length ?? null },
    { key: "related", label: "Related", count: related?.length ?? null },
    { key: "sources", label: "Sources", count: notes.length },
  ];

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label="GIO4X Lens"
      data-command
      className="no-print fixed inset-x-0 bottom-0 z-overlay flex max-h-[82svh] flex-col rounded-t-md border border-line-strong bg-paper shadow-3 focus:outline-none lg:inset-x-auto lg:bottom-0 lg:right-0 lg:top-[3.4375rem] lg:max-h-none lg:w-[min(38.2vw,30rem)] lg:rounded-none lg:border-y-0 lg:border-r-0"
      style={{ animation: "gx-rise 260ms var(--ease-out)" }}
    >
      <header className="flex items-start justify-between gap-13 border-b border-line p-21">
        <div className="min-w-0">
          <p className="eyebrow plain">
            <Rosette size={13} dna /> GIO4X Lens
          </p>
          <p className="h4 mt-5 truncate">{title}</p>
        </div>
        <button type="button" className="chip shrink-0 cursor-pointer" onClick={close} aria-label="Close Lens">
          Esc
        </button>
      </header>

      <div role="tablist" aria-label="Lens views" className="flex border-b border-line px-21">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`lens-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`-mb-px mr-21 border-b py-13 text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-fast ${tab === t.key ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
          >
            {t.label}
            {t.count !== null && <span className="num ml-5 font-normal text-ink-3">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-21" aria-live="polite">
        {failed && <p className="text-sm text-ink-2">The Lens could not load its index. The page itself is unaffected.</p>}

        {tab === "explain" && (
          <div id="lens-explain" role="tabpanel">
            {explained === null && !failed ? (
              <LensSkeleton />
            ) : explained && explained.length ? (
              <dl className="grid gap-21">
                {explained.map((t) => (
                  <div key={t.href}>
                    <dt className="text-[0.9375rem] font-semibold">
                      <Link href={t.href} className="link">
                        {t.title}
                      </Link>
                    </dt>
                    <dd className="mt-3 text-sm leading-relaxed text-ink-2">{t.definition}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-ink-2">No glossary terms were found in this page&rsquo;s text.</p>
            )}
          </div>
        )}

        {tab === "related" && (
          <div id="lens-related" role="tabpanel">
            {related === null && !failed ? (
              <LensSkeleton />
            ) : related && related.length ? (
              <ul className="grid gap-px border-t border-line">
                {related.map((r) => (
                  <li key={r.href} className="border-b border-line">
                    <Link href={r.href} className="group block py-13">
                      <span className="label">{r.kind}</span>
                      <span className="mt-2 block text-[0.9375rem] font-medium transition-colors duration-fast group-hover:text-accent">{r.label}</span>
                      {r.text && <span className="mt-2 block text-xs text-ink-3">{r.text}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2">Nothing in the GIO4X graph is linked to this page yet.</p>
            )}
            <p className="mt-21 text-xs text-ink-3">
              Relationships are curated and explanatory. They describe how things are connected, not how prices will move.{" "}
              <Link href="/labs/market-universe" className="link">
                Explore the Market Universe
              </Link>
            </p>
          </div>
        )}

        {tab === "sources" && (
          <div id="lens-sources" role="tabpanel">
            {notes.length ? (
              <ul className="grid gap-13">
                {notes.map((n, i) => (
                  <li key={i} className="border-b border-line pb-13">
                    <span className="chip">{n.status}</span>
                    {n.source && <p className="mt-8 text-sm text-ink-2">Source: {n.source}</p>}
                    {n.updated && <p className="num mt-2 text-xs text-ink-3">Updated {n.updated}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2">This page carries no market data, so there is nothing to source.</p>
            )}
            <div className="mt-21 flex items-start justify-between gap-21">
              <label htmlFor="lens-source-mode" className="cursor-pointer text-sm text-ink-2">
                Source mode
                <span className="block text-xs text-ink-3">Outline every data note on the page.</span>
              </label>
              <button
                id="lens-source-mode"
                type="button"
                role="switch"
                aria-checked={sourceMode}
                onClick={() => setSourceMode((v) => !v)}
                className={`relative mt-2 h-[21px] w-[34px] shrink-0 rounded-full border transition-colors duration-fast ${sourceMode ? "border-accent bg-accent" : "border-line-strong"}`}
              >
                <span aria-hidden className={`absolute left-0 top-[3px] h-[13px] w-[13px] rounded-full transition-transform duration-[260ms] ${sourceMode ? "translate-x-[16px] bg-[var(--accent-ink)]" : "translate-x-[3px] bg-ink-3"}`} />
              </button>
            </div>
            <p className="mt-21 text-xs text-ink-3">
              <Link href="/trust/data-methodology" className="link">
                How GIO4X labels data
              </Link>
            </p>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-13 border-t border-line px-21 py-13">
        <p className="text-xs text-ink-3">Derived from this page and GIO4X&rsquo;s curated data. No AI model.</p>
        <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => openCommandBar()}>
          Search
        </button>
      </footer>
    </aside>
  );
}

function LensSkeleton() {
  return (
    <div className="grid gap-21" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="skeleton h-[13px] w-[38.2%]" />
          <div className="skeleton mt-8 h-[8px] w-full" />
          <div className="skeleton mt-5 h-[8px] w-[61.8%]" />
        </div>
      ))}
    </div>
  );
}
