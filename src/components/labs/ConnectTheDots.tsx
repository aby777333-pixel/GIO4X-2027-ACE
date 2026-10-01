"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Rosette } from "@/components/brand/Rosette";
import { KIND_LABEL, KIND_ORDER, compareNodes, connect, getNode, neighbours, type GraphNode, type Hop, type NodeKind, type SentencePart } from "@/data/graph";
import { DotsDiagram } from "./DotsDiagram";
import { KindLegend, KindMark } from "./glyph";
import { NodeSearch } from "./NodeSearch";
import { MAX_PICKS, MIN_PICKS, PICK_PARAM, SUGGESTED_SETS, parsePicks, picksQuery } from "./picks";

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function Sentence({ parts }: { parts: SentencePart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.href ? (
          <Link key={i} href={p.href} className="link">
            {p.text}
          </Link>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

const DEEPER: { kind: NodeKind; title: string }[] = [
  { kind: "concept", title: "Glossary" },
  { kind: "event", title: "Economic events" },
  { kind: "tool", title: "Tools" },
];

/** Glossary terms, events and tools that touch the sub-graph, most connected first. */
function goDeeper(sub: GraphNode[]): { kind: NodeKind; title: string; items: GraphNode[] }[] {
  const inSub = new Set(sub.map((n) => n.id));
  const count = new Map<string, { node: GraphNode; k: number }>();
  for (const n of sub) {
    for (const l of neighbours(n.id)) {
      if (inSub.has(l.node.id)) continue;
      const c = count.get(l.node.id) ?? { node: l.node, k: 0 };
      c.k++;
      count.set(l.node.id, c);
    }
  }
  return DEEPER.map(({ kind, title }) => ({
    kind,
    title,
    items: [...count.values()]
      .filter((c) => c.node.kind === kind)
      .sort((a, b) => b.k - a.k || compareNodes(a.node, b.node))
      .slice(0, 4)
      .map((c) => c.node),
  })).filter((g) => g.items.length > 0);
}

export function ConnectTheDots({ initial, example }: { initial: string[]; example: boolean }) {
  const [ids, setIds] = useState(initial);
  const [isExample, setIsExample] = useState(example);
  const c = useMemo(() => connect(ids), [ids]);
  const deeper = useMemo(() => goDeeper(c.nodes), [c]);

  const update = useCallback((next: string[]) => {
    setIds((cur) => (same(cur, next) ? cur : next));
    setIsExample(false);
    const q = picksQuery(next);
    if (window.location.search !== q) window.history.pushState(null, "", q);
  }, []);

  // the selection lives in the query string: Back and Forward walk through sets
  useEffect(() => {
    const onPop = () => {
      const raw = new URLSearchParams(window.location.search).get(PICK_PARAM);
      setIds(parsePicks(raw));
      setIsExample(raw === null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const onSet = (next: string[]) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    update(next);
  };

  const picks = c.ids.map((id) => getNode(id)).filter((n): n is GraphNode => !!n);
  const full = picks.length >= MAX_PICKS;
  const ready = picks.length >= MIN_PICKS;
  const joining = c.nodes.length - picks.length;
  const total = c.chain.length + c.also.length;
  const summary = !ready
    ? "Pick at least two things to connect."
    : total === 0
      ? "No documented path connects these picks."
      : `${picks.length} picks connected by ${total} ${total === 1 ? "relation" : "relations"}${joining > 0 ? `, through ${joining} joining ${joining === 1 ? "node" : "nodes"}` : ""}.`;

  return (
    <div>
      {/* the picker */}
      <div className="grid gap-34 lg:grid-cols-phi lg:gap-55">
        <div>
          <NodeSearch
            label={`Add something to connect (${picks.length} of ${MAX_PICKS})`}
            placeholder={full ? "Remove one to add another" : "Gold, US dollar, Fed, CPI, leverage…"}
            onPick={(id) => update([...c.ids, id])}
            exclude={c.ids}
            disabled={full}
            hint="Two to five instruments, currencies, central banks, events, concepts or tools. Order matters: the explanation walks from each pick to the next."
          />
          <ul className="mt-21 border-t border-line-strong" aria-label="Your picks, in order">
            {picks.map((n, i) => (
              <li key={n.id} className="flex items-center gap-13 border-b border-line">
                <span className="num w-21 shrink-0 text-xs font-semibold text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                <KindMark kind={n.kind} />
                <span className="min-w-0 flex-1 py-8">
                  <span className="block truncate text-[0.9375rem] font-medium">{n.label}</span>
                  <span className="block truncate text-xs text-ink-3">{KIND_LABEL[n.kind].one}{n.sub && n.kind === "instrument" ? ` · ${n.sub}` : ""}</span>
                </span>
                <button type="button" className="btn btn-quiet !h-[2.75rem] !px-13" onClick={() => update(c.ids.filter((x) => x !== n.id))} aria-label={`Remove ${n.label}`}>
                  Remove
                </button>
              </li>
            ))}
            {picks.length === 0 && <li className="border-b border-line py-13 text-sm text-ink-3">Nothing picked yet.</li>}
          </ul>
          {picks.length > 0 && (
            <a href={picksQuery([])} onClick={onSet([])} className="link-quiet mt-13 inline-flex min-h-[2.75rem] items-center text-sm underline decoration-line-strong underline-offset-4">
              Clear all
            </a>
          )}
        </div>

        <div>
          <p className="label">Suggested sets</p>
          <ul className="mt-8 border-t border-line">
            {SUGGESTED_SETS.map((s) => {
              const on = same(s.ids, c.ids);
              return (
                <li key={s.name} className="border-b border-line">
                  <a href={picksQuery(s.ids)} onClick={onSet(s.ids)} aria-current={on ? "true" : undefined} className={`group flex min-h-[2.75rem] items-center justify-between gap-13 py-8 text-[0.9375rem] transition-colors duration-fast hover:text-accent ${on ? "font-semibold text-ink" : "text-ink-2"}`}>
                    <span>{s.name}</span>
                    <span className="flex shrink-0 items-center gap-5" aria-hidden>
                      {s.ids.map((id) => {
                        const n = getNode(id);
                        return n ? <KindMark key={id} kind={n.kind} size={11} /> : null;
                      })}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* the result */}
      <div className="mt-55 border-t border-line-strong pt-34">
        <p className="sr-only" role="status" aria-live="polite">
          {summary}
        </p>
        {!ready ? (
          <div className="panel-quiet grid justify-items-start gap-13 p-34">
            <Rosette size={34} blades={5} className="text-ink-3" />
            <p className="h4">Pick at least two things.</p>
            <p className="max-w-measure text-sm text-ink-2">Use the search field, or start from one of the suggested sets. The page will show how the graph connects them, one relation at a time.</p>
          </div>
        ) : (
          <div className="grid gap-34 lg:grid-cols-phi lg:items-start lg:gap-55">
            <div>
              <p className="eyebrow">{isExample ? "A worked example" : "How they connect"}</p>
              <h2 className="h3 mt-13 max-w-[26ch]">{picks.map((n) => n.short).join(" · ")}</h2>
              <p className="mt-8 text-sm text-ink-3">{summary}</p>

              {c.chain.length > 0 && (
                <ol className="mt-21 border-t border-line">
                  {c.chain.map((h, i) => (
                    <Step key={`${h.edge.from}|${h.edge.to}`} hop={h} n={i + 1} />
                  ))}
                </ol>
              )}

              {c.missing.length > 0 && (
                <ul className="mt-21 grid gap-8">
                  {c.missing.map(([a, b]) => (
                    <li key={`${a.id}|${b.id}`} className="border-l border-line-strong pl-13 text-ink-2">
                      No documented path connects <Link href={a.href} className="link">{a.label}</Link> and <Link href={b.href} className="link">{b.label}</Link> in the GIO4X graph. That means the relation is not recorded here, not that none exists.
                    </li>
                  ))}
                </ul>
              )}

              {c.also.length > 0 && (
                <div className="mt-34">
                  <h3 className="label">Also related, among your picks</h3>
                  <ul className="mt-8 border-t border-line">
                    {c.also.map((h) => (
                      <li key={`${h.edge.from}|${h.edge.to}`} className="border-b border-line py-13 text-[0.9375rem] text-ink-2">
                        <Sentence parts={h.parts} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-21 flex flex-wrap items-center gap-x-13 gap-y-5 text-xs text-ink-3">
                <span className="chip">Deterministic</span>
                <span className="max-w-[60ch]">No language model is involved: these sentences come from GIO4X’s curated relationship data. They describe how things are connected, not how prices will move.</span>
              </p>
            </div>

            <figure className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
              <div className="grid-field overflow-hidden rounded border border-line bg-paper">
                <DotsDiagram connection={c} />
              </div>
              <figcaption className="mt-13 grid gap-8">
                <KindLegend kinds={KIND_ORDER.filter((k) => c.nodes.some((n) => n.kind === k))} />
                <p className="text-xs text-ink-3">Ringed marks are your picks; smaller marks are the nodes that join them. Solid lines follow the explanation; dashed lines are the other direct relations. The text beside this figure says the same thing in words.</p>
              </figcaption>
            </figure>
          </div>
        )}
      </div>

      {ready && deeper.length > 0 && (
        <div className="mt-55">
          <p className="eyebrow">Go deeper</p>
          <div className="mt-21 grid gap-x-55 gap-y-34 md:grid-cols-3">
            {deeper.map((g) => (
              <div key={g.kind}>
                <h3 className="label border-b border-line-strong pb-8">{g.title}</h3>
                <ul>
                  {g.items.map((n) => (
                    <li key={n.id} className="border-b border-line">
                      <Link href={n.href} className="group flex min-h-[2.75rem] items-center gap-13 py-8">
                        <KindMark kind={n.kind} />
                        <span className="text-[0.9375rem] font-medium transition-colors duration-fast group-hover:text-accent">{n.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ hop, n }: { hop: Hop; n: number }) {
  return (
    <li className="grid grid-cols-[2.125rem_1fr] gap-x-13 border-b border-line py-21">
      <span className="num pt-[0.3rem] text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(n).padStart(2, "0")}</span>
      <div>
        <p className="text-md text-ink">
          <Sentence parts={hop.parts} />
        </p>
        <p className="label mt-5 flex items-center gap-8">
          <KindMark kind={hop.from.kind} size={11} />
          <span>{hop.from.short}</span>
          <span aria-hidden className="h-px w-13 bg-line-strong" />
          <KindMark kind={hop.to.kind} size={11} />
          <span>{hop.to.short}</span>
        </p>
      </div>
    </li>
  );
}
