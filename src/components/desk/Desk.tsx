"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Rosette } from "@/components/brand/Rosette";
import { countLearned, countLessons, LESSON_PREFIX, useLearned } from "@/components/glossary/learn";
import type { RatesProp } from "@/components/tools/calc";
import { useCalc } from "@/components/tools/store";
import { DataNote } from "@/components/ui/Page";
import type { MilestoneData } from "@/data/milestones";
import { isRateCurrency } from "@/lib/rates";
import { DeskTransfer } from "./DeskTransfer";
import { InstallApp } from "./InstallApp";
import { Milestones } from "./Milestones";
import {
  forgetCalc,
  MAX_RECENT_PAGES,
  MAX_RECENT_SEARCHES,
  MAX_WATCH,
  savedKind,
  startRecent,
  stopRecent,
  toggleSaved,
  toggleWatch,
  useHeldCalc,
  useRecent,
  useSaved,
  useWatch,
  type CalcField,
  type PageRef,
  type SavedKind,
} from "./store";

/**
 * MY DESK — one page for what this browser already holds: the watchlist, saved
 * pages, recently viewed, the figures typed into the tools and learning
 * progress. Everything is read from local storage after the page has mounted;
 * the server sends the same neutral shell to everyone, so there is nothing to
 * mismatch on hydration and nothing personal in the HTML.
 */
export type DeskInstrument = { id: string; symbol: string; name: string; cls: string; base?: string; quote?: string };
export type DeskData = {
  instruments: DeskInstrument[];
  /** glossary terms that carry a "Check yourself" question */
  terms: { slug: string; term: string }[];
  /** Academy lessons, in course order */
  lessons: { slug: string; title: string }[];
  /** what the milestones are measured against: glossary topics, Academy levels and learning paths */
  milestones: MilestoneData;
  /** the latest ECB reference fixing, fetched by the server; never a live price */
  rates: RatesProp;
  /** the fixing date, already formatted */
  ratesDate: string | null;
  ratesSource: { name: string; href: string };
};

/* ---- shared pieces ------------------------------------------------------------- */

function Block({ id, title, lead, children, tinted = false }: { id: string; title: string; lead: ReactNode; children: ReactNode; tinted?: boolean }) {
  return (
    <section id={id} className={`section-quiet hairline scroll-mt-[var(--header-h)] ${tinted ? "bg-paper" : ""}`} aria-labelledby={`${id}-h`}>
      <div className="wrap phi phi-r items-start">
        <div>
          <h2 id={`${id}-h`} className="h3">
            {title}
          </h2>
          <div className="mt-13 max-w-narrow text-sm text-ink-2">{lead}</div>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

/** Shown until storage has been read: the same on the server and on first paint. */
function Reading() {
  return (
    <div className="grid gap-13" aria-hidden>
      <div className="skeleton h-[13px] w-[38.2%]" />
      <div className="skeleton h-[8px] w-full" />
      <div className="skeleton h-[8px] w-[61.8%]" />
    </div>
  );
}

function Empty({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="panel-quiet grid justify-items-start gap-8 p-21">
      <Rosette size={21} blades={5} className="text-ink-3" />
      <p className="h4">{title}</p>
      <div className="max-w-measure text-sm text-ink-2">{children}</div>
      {actions && <div className="mt-8 flex flex-wrap items-center gap-13">{actions}</div>}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn btn-quiet btn-sm shrink-0" onClick={onClick} aria-label={label}>
      Remove
    </button>
  );
}

/* ---- pick up where you left off ---------------------------------------------------- */

/**
 * The shortest way back to each thing this browser already holds: the last
 * page opened (only if the visitor switched that list on), the next Academy
 * lesson and glossary term, and the tools kept or in use. It reads the same
 * keys as the sections below and stores nothing of its own.
 */
function PickUp({ data }: { data: DeskData }) {
  const recent = useRecent();
  const saved = useSaved();
  const held = useHeldCalc();
  const learned = useLearned();
  if (recent === undefined || saved === undefined || held === undefined || learned === null) return <Reading />;

  const last = recent?.p[0] ?? null;
  const lessonCount = Math.min(countLessons(learned), data.lessons.length);
  const termCount = Math.min(countLearned(learned), data.terms.length);
  const nextLesson = data.lessons.find((l) => !learned[`${LESSON_PREFIX}${l.slug}`]);
  const nextTerm = data.terms.find((t) => !learned[t.slug]);
  const tools = saved.filter((s) => savedKind(s.h) === "tool").slice(0, 3);
  const figures = held ? FIGURES.filter((f) => typeof held[f.field] === "string" && held[f.field] !== "").length : 0;

  type Row = { kind: string; body: ReactNode };
  const rows: Row[] = [];
  if (last) {
    rows.push({
      kind: "Last page",
      body: (
        <>
          <Link href={last.h} className="go">
            {last.t}
          </Link>
          {recent && recent.p.length > 1 && (
            <a href="#continue" className="link-quiet mt-3 block text-xs text-ink-3 underline decoration-line-strong decoration-dotted underline-offset-4">
              and {recent.p.length - 1} more below
            </a>
          )}
        </>
      ),
    });
  }
  if (lessonCount > 0) {
    const share = data.lessons.length ? (lessonCount / data.lessons.length) * 100 : 0;
    rows.push({
      kind: "Academy",
      body: (
        <>
          <p className="text-sm text-ink-2">
            <span className="num font-medium text-ink">{lessonCount}</span> of <span className="num">{data.lessons.length}</span> lessons completed
          </p>
          {/* drawn progress; the sentence above says the same in words */}
          <span aria-hidden className="mt-5 block h-[3px] max-w-[21rem] rounded-full bg-line">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
          </span>
          {nextLesson ? (
            <Link href={`/academy/${nextLesson.slug}`} className="go mt-8">
              Continue: {nextLesson.title}
            </Link>
          ) : (
            <p className="mt-5 text-sm text-ink-3">Every lesson has been completed.</p>
          )}
        </>
      ),
    });
  }
  if (termCount > 0 && nextTerm) {
    rows.push({
      kind: "Glossary",
      body: (
        <>
          <p className="text-sm text-ink-2">
            <span className="num font-medium text-ink">{termCount}</span> of <span className="num">{data.terms.length}</span> terms checked
          </p>
          <Link href={`/glossary/${nextTerm.slug}`} className="go mt-8">
            Continue: {nextTerm.term}
          </Link>
        </>
      ),
    });
  }
  if (tools.length > 0 || figures > 0) {
    rows.push({
      kind: tools.length > 0 ? "Saved tools" : "Tools",
      body: (
        <>
          {tools.length > 0 && (
            <ul className="flex flex-wrap gap-8">
              {tools.map((t) => (
                <li key={t.h}>
                  <Link href={t.h} className="chip h-auto min-h-[2.125rem] whitespace-normal py-3 normal-case tracking-normal transition-colors duration-fast hover:border-line-strong hover:text-ink">
                    {t.t}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {figures > 0 && (
            <p className={`text-sm text-ink-2 ${tools.length > 0 ? "mt-8" : ""}`}>
              {figures === 1 ? "One figure you typed is" : `${figures} figures you typed are`} still in the calculators.{" "}
              <Link href="/tools" className="link">
                Trader Toolkit
              </Link>
            </p>
          )}
        </>
      ),
    });
  }

  if (rows.length === 0) {
    return <p className="max-w-measure text-sm text-ink-2">Nothing to pick up yet. As you save tools, type figures into a calculator, complete a lesson or switch on the list of recent pages below, the shortest way back to each appears here.</p>;
  }
  return (
    <dl className="border-t border-line-strong">
      {rows.map((r) => (
        <div key={r.kind} className="grid gap-x-21 gap-y-5 border-b border-line py-13 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)]">
          <dt className="label pt-3">{r.kind}</dt>
          <dd className="min-w-0">{r.body}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---- watchlist ------------------------------------------------------------------- */

function formatFixing(v: number): string {
  // the same precision the instrument pages use for a reference fixing
  return v.toFixed(v >= 100 ? 2 : v >= 10 ? 3 : 4);
}

function Watchlist({ data }: { data: DeskData }) {
  const watch = useWatch();
  const selectId = useId();
  const [pick, setPick] = useState("");
  if (watch === undefined) return <Reading />;

  const byId = new Map(data.instruments.map((i) => [i.id, i]));
  const rows = watch.flatMap((id) => byId.get(id) ?? []);
  const free = data.instruments.filter((i) => !watch.includes(i.id));
  const classes = [...new Set(free.map((i) => i.cls))];
  const rates = data.rates;
  const fixing = (i: DeskInstrument): string | null => (rates.status === "ok" && isRateCurrency(i.base) && isRateCurrency(i.quote) ? formatFixing(rates.perEur[i.quote] / rates.perEur[i.base]) : null);
  const anyFixing = rows.some((i) => fixing(i) !== null);

  return (
    <div>
      {rows.length === 0 ? (
        <Empty title="No instruments are being watched.">
          <p>
            Instruments you choose to keep an eye on are listed here, each with a link to its page. Add one below, or press <span className="font-medium text-ink">Watch</span> on any instrument page.
          </p>
        </Empty>
      ) : (
        <ul className="border-t border-line-strong">
          {rows.map((i) => {
            const f = fixing(i);
            return (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-21 gap-y-5 border-b border-line py-13">
                <Link href={`/markets/${i.id}`} className="group min-w-0 flex-1 basis-[12rem]">
                  <span className="num block text-[0.9375rem] font-semibold text-ink transition-colors duration-fast group-hover:text-accent">{i.symbol}</span>
                  <span className="block truncate text-sm text-ink-3">
                    {i.cls} · {i.name}
                  </span>
                </Link>
                {f && (
                  <p className="text-right">
                    <span className="num block text-[0.9375rem] font-medium text-ink">{f}</span>
                    <span className="block text-xs text-ink-3">reference fixing</span>
                  </p>
                )}
                <RemoveButton label={`Remove ${i.symbol} from the watchlist`} onClick={() => toggleWatch(i.id)} />
              </li>
            );
          })}
        </ul>
      )}

      {anyFixing && (
        <DataNote className="mt-13" status="reference" source={data.ratesSource.name} sourceHref={data.ratesSource.href} updated={data.ratesDate ?? undefined}>
          A daily fixing, not a live or tradable price. Shown only for pairs of the eight currencies the ECB publishes; other instruments carry no figure here.
        </DataNote>
      )}
      {rows.length > 0 && !anyFixing && <p className="mt-13 text-xs text-ink-3">{rates.status === "ok" ? "None of these instruments is covered by the ECB reference fixings, so no figure is shown." : "Reference fixings are unavailable at the moment, so no figure is shown."}</p>}

      {free.length > 0 && watch.length < MAX_WATCH && (
        <form
          className="mt-21 flex flex-wrap items-end gap-13"
          onSubmit={(e) => {
            e.preventDefault();
            if (pick) toggleWatch(pick);
            setPick("");
          }}
        >
          <div className="field min-w-0 flex-1 basis-[14rem]">
            <label htmlFor={selectId}>Add an instrument</label>
            <select id={selectId} className="select" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose…</option>
              {classes.map((c) => (
                <optgroup key={c} label={c}>
                  {free
                    .filter((i) => i.cls === c)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.symbol} · {i.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-ghost" disabled={!pick}>
            Watch
          </button>
        </form>
      )}
      {watch.length >= MAX_WATCH && <p className="mt-13 text-xs text-ink-3">The watchlist holds {MAX_WATCH} instruments. Remove one to add another.</p>}
    </div>
  );
}

/* ---- saved --------------------------------------------------------------------------- */

const SAVED_GROUPS: { kind: SavedKind; title: string }[] = [
  { kind: "article", title: "Articles" },
  { kind: "lesson", title: "Academy lessons" },
  { kind: "term", title: "Glossary terms" },
  { kind: "tool", title: "Tools" },
];

function Saved() {
  const saved = useSaved();
  if (saved === undefined) return <Reading />;
  if (saved.length === 0) {
    return (
      <Empty
        title="Nothing is saved."
        actions={
          <>
            <Link href="/intelligence" className="link text-sm">
              Intelligence
            </Link>
            <Link href="/glossary" className="link text-sm">
              Glossary
            </Link>
            <Link href="/tools" className="link text-sm">
              Trader Toolkit
            </Link>
          </>
        }
      >
        <p>
          Articles, Academy lessons, glossary terms and tools you keep for later are listed here, grouped. Press <span className="font-medium text-ink">Save</span> on any of those pages to add it.
        </p>
      </Empty>
    );
  }
  return (
    <div className="grid gap-34">
      {SAVED_GROUPS.map((g) => {
        const items = saved.filter((s) => savedKind(s.h) === g.kind);
        if (items.length === 0) return null;
        return (
          <div key={g.kind}>
            <h3 className="label">
              {g.title} <span className="num font-normal">{items.length}</span>
            </h3>
            <ul className="mt-8 border-t border-line-strong">
              {items.map((s) => (
                <li key={s.h} className="flex items-center justify-between gap-13 border-b border-line py-8">
                  <Link href={s.h} className="min-w-0 py-5 text-[0.9375rem] font-medium text-ink transition-colors duration-fast [overflow-wrap:anywhere] hover:text-accent">
                    {s.t}
                  </Link>
                  <RemoveButton label={`Remove “${s.t}” from saved`} onClick={() => toggleSaved(s.h, s.t)} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* ---- continue: recently viewed -------------------------------------------------------- */

function PageList({ items }: { items: PageRef[] }) {
  return (
    <ul className="mt-8 border-t border-line-strong">
      {items.map((p) => (
        <li key={p.h} className="border-b border-line">
          <Link href={p.h} className="group flex min-h-[2.75rem] flex-wrap items-baseline justify-between gap-x-21 py-8">
            <span className="text-[0.9375rem] font-medium text-ink transition-colors duration-fast [overflow-wrap:anywhere] group-hover:text-accent">{p.t}</span>
            <span className="text-xs text-ink-3 [overflow-wrap:anywhere]">{p.h}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Continue() {
  const recent = useRecent();
  if (recent === undefined) return <Reading />;
  if (recent === null) {
    return (
      <Empty
        title="No list of recent pages is being kept."
        actions={
          <button type="button" className="btn btn-ghost" onClick={startRecent}>
            Keep a list of recent pages
          </button>
        }
      >
        <p>
          Switched on, this browser remembers the last {MAX_RECENT_PAGES} pages you opened and the last {MAX_RECENT_SEARCHES} searches you made on this site, so you can return to them from here. Until you switch it on, nothing about the pages you open is recorded.
        </p>
      </Empty>
    );
  }
  return (
    <div className="grid gap-34">
      {recent.p.length === 0 && recent.s.length === 0 && <p className="text-sm text-ink-2">The list is on and empty. Pages you open from now on, and searches you make, will appear here.</p>}
      {recent.p.length > 0 && (
        <div>
          <h3 className="label">Pages</h3>
          <PageList items={recent.p} />
        </div>
      )}
      {recent.s.length > 0 && (
        <div>
          <h3 className="label">Searches</h3>
          <ul className="mt-13 flex flex-wrap gap-8">
            {recent.s.map((q) => (
              <li key={q}>
                <Link href={`/search?q=${encodeURIComponent(q)}`} className="chip h-auto min-h-[2.125rem] max-w-full whitespace-normal py-3 normal-case tracking-normal transition-colors duration-fast [overflow-wrap:anywhere] hover:border-line-strong hover:text-ink">
                  {q}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <button type="button" className="btn btn-quiet btn-sm -ml-13" onClick={stopRecent}>
          Stop and clear this list
        </button>
      </div>
    </div>
  );
}

/* ---- your figures ---------------------------------------------------------------------- */

type FigureRow = { field: CalcField; label: string; show: (v: string, all: Partial<Record<CalcField, string>>, data: DeskData) => string; tools: { slug: string; name: string }[] };

const T = {
  size: { slug: "position-size", name: "Position Size" },
  pip: { slug: "pip-value", name: "Pip Value" },
  margin: { slug: "margin", name: "Margin" },
  pl: { slug: "profit-loss", name: "Profit & Loss" },
  cost: { slug: "cost-lab", name: "Cost Lab" },
  lev: { slug: "leverage-visualizer", name: "Leverage, visualised" },
  spread: { slug: "spread-visualizer", name: "Spread, visualised" },
  dd: { slug: "drawdown", name: "Drawdown" },
  growth: { slug: "compound-growth", name: "Compound Growth" },
};

/** Which tools read each figure (see components/tools: every tool that uses a field is linked from it). */
const FIGURES: FigureRow[] = [
  { field: "balance", label: "Balance", show: (v, all) => `${v} ${all.accountCurrency ?? ""}`.trim(), tools: [T.size, T.margin, T.lev, T.dd, T.growth] },
  { field: "accountCurrency", label: "Account currency", show: (v) => v, tools: [T.size, T.pip, T.margin, T.pl, T.cost] },
  { field: "riskPct", label: "Risk per trade", show: (v) => `${v} %`, tools: [T.size] },
  {
    field: "instrument",
    label: "Instrument",
    show: (v, _all, data) => (v === "custom" ? "Another instrument (your own contract)" : (data.instruments.find((i) => i.id.endsWith(`/${v}`))?.symbol ?? v)),
    tools: [T.size, T.pip, T.margin, T.pl, T.cost, T.spread],
  },
  { field: "lots", label: "Lot size", show: (v) => `${v} ${v === "1" ? "lot" : "lots"}`, tools: [T.pip, T.margin, T.pl, T.cost, T.spread] },
  { field: "leverage", label: "Leverage", show: (v) => `1:${v}`, tools: [T.margin, T.lev] },
];

function Figures({ data }: { data: DeskData }) {
  const held = useHeldCalc();
  const [, , reset] = useCalc();
  const [cleared, setCleared] = useState(false);
  if (held === undefined) return <Reading />;

  const rows = held ? FIGURES.filter((f) => typeof held[f.field] === "string" && held[f.field] !== "") : [];
  if (!held || rows.length === 0) {
    return (
      <div>
        <Empty
          title="No figures are held."
          actions={
            <Link href="/tools" className="link text-sm">
              Trader Toolkit
            </Link>
          }
        >
          <p>The balance, account currency, risk, instrument, lot size and leverage you type into any calculator are kept in this browser and shared by all of them. They are listed here once you have changed one. Until then the tools show their starting placeholders, which are not suggestions.</p>
        </Empty>
        <p role="status" className="mt-13 text-sm text-ink-3">
          {cleared ? "Figures cleared. The tools are back to their starting placeholders." : ""}
        </p>
      </div>
    );
  }
  return (
    <div>
      <dl className="border-t border-line-strong">
        {rows.map((f) => (
          <div key={f.field} className="grid gap-x-21 gap-y-5 border-b border-line py-13 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
            <dt className="text-sm text-ink-3">{f.label}</dt>
            <dd className="min-w-0">
              <span className="num block text-[0.9375rem] font-medium text-ink [overflow-wrap:anywhere]">{f.show(held[f.field] ?? "", held, data)}</span>
              <span className="mt-3 flex flex-wrap gap-x-13 gap-y-2 text-xs text-ink-3">
                <span>Used by</span>
                {f.tools.map((t) => (
                  <Link key={t.slug} href={`/tools/${t.slug}`} className="link-quiet inline-flex min-h-[1.625rem] items-center underline decoration-line-strong decoration-dotted underline-offset-4">
                    {t.name}
                  </Link>
                ))}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-13 max-w-measure text-xs text-ink-3">These are the figures as you typed them. They are inputs to arithmetic, not a record of any account, and nothing here is advice.</p>
      <button
        type="button"
        className="btn btn-quiet btn-sm -ml-13 mt-13"
        onClick={() => {
          // the tools keep their own copy in memory: put that back to the placeholders, then remove the stored key
          reset();
          forgetCalc();
          setCleared(true);
        }}
      >
        Clear figures
      </button>
    </div>
  );
}

/* ---- learning ------------------------------------------------------------------------------ */

function Learning({ data }: { data: DeskData }) {
  const learned = useLearned();
  if (learned === null) return <Reading />;

  const termCount = Math.min(countLearned(learned), data.terms.length);
  const lessonCount = Math.min(countLessons(learned), data.lessons.length);
  // stored in the order they were answered: the most recent are last
  const checked = data.terms.length ? Object.keys(learned).filter((s) => !s.startsWith(LESSON_PREFIX)) : [];
  const termName = new Map(data.terms.map((t) => [t.slug, t.term]));
  const recentTerms = checked
    .filter((s) => termName.has(s))
    .slice(-6)
    .reverse();
  const nextTerm = data.terms.find((t) => !learned[t.slug]);
  const nextLesson = data.lessons.find((l) => !learned[`${LESSON_PREFIX}${l.slug}`]);

  if (termCount === 0 && lessonCount === 0) {
    return (
      <Empty
        title="No progress is recorded."
        actions={
          <>
            <Link href="/glossary" className="link text-sm">
              Glossary
            </Link>
            <Link href="/academy" className="link text-sm">
              Academy
            </Link>
          </>
        }
      >
        <p>Glossary terms whose “Check yourself” question you answer correctly, and Academy lessons you complete, are counted here. No score is kept: only which ones.</p>
      </Empty>
    );
  }

  return (
    <div className="grid gap-34 sm:grid-cols-2">
      <div>
        <h3 className="label">Glossary</h3>
        <p className="mt-8 text-ink-2">
          <span className="num font-display text-2xl font-light text-ink">{termCount}</span> of <span className="num">{data.terms.length}</span> terms checked
        </p>
        {recentTerms.length > 0 && (
          <ul className="mt-13 flex flex-wrap gap-8" aria-label="Most recently checked terms">
            {recentTerms.map((s) => (
              <li key={s}>
                <Link href={`/glossary/${s}`} className="chip h-auto min-h-[2.125rem] whitespace-normal py-3 normal-case tracking-normal transition-colors duration-fast hover:border-line-strong hover:text-ink">
                  <span aria-hidden className="text-accent">
                    ✓
                  </span>
                  {termName.get(s)}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {nextTerm ? (
          <Link href={`/glossary/${nextTerm.slug}`} className="go mt-21">
            Continue: {nextTerm.term}
          </Link>
        ) : (
          <p className="mt-13 text-sm text-ink-3">Every term with a question has been checked.</p>
        )}
      </div>
      <div>
        <h3 className="label">Academy</h3>
        <p className="mt-8 text-ink-2">
          <span className="num font-display text-2xl font-light text-ink">{lessonCount}</span> of <span className="num">{data.lessons.length}</span> lessons completed
        </p>
        {nextLesson ? (
          <Link href={`/academy/${nextLesson.slug}`} className="go mt-21">
            {lessonCount === 0 ? "Start" : "Continue"}: {nextLesson.title}
          </Link>
        ) : (
          <p className="mt-13 text-sm text-ink-3">Every lesson has been completed.</p>
        )}
      </div>
    </div>
  );
}

/* ---- the page ---------------------------------------------------------------------------------- */

export function Desk({ data }: { data: DeskData }) {
  return (
    <>
      <Block id="resume" title="Pick up where you left off" tinted lead="The shortest way back to what you were doing, read from what this browser already holds. Nothing extra is stored for it.">
        <PickUp data={data} />
      </Block>

      <Block id="watchlist" title="Watchlist" lead="Instruments you chose to keep an eye on. Each opens its own page.">
        <Watchlist data={data} />
      </Block>

      <Block id="saved" title="Saved" lead="Articles, lessons, glossary terms and tools you kept for later." tinted>
        <Saved />
      </Block>

      <Block id="continue" title="Continue" lead="The pages you opened and the searches you made most recently, if you have asked this browser to remember them.">
        <Continue />
      </Block>

      <Block id="figures" title="Your figures" lead="What the calculators are currently holding, and the tools each figure feeds." tinted>
        <Figures data={data} />
      </Block>

      <Block id="learning" title="Learning" lead="Glossary questions answered and Academy lessons completed.">
        <Learning data={data} />
      </Block>

      <Block id="milestones" title="Milestones" lead="Badges for glossary questions answered, lessons completed and the tour, read from the same record as Learning above. Nothing more is stored for them.">
        <Milestones data={data.milestones} fallback={<Reading />} />
      </Block>

      <Block
        id="device"
        title="This device only"
        tinted
        lead={
          <>
            <p>Everything on this page lives in this browser. It is not sent to GIO4X, there is no account behind it, and it is lost if this site’s data is cleared.</p>
            <Link href="/preferences" className="go mt-21">
              Display &amp; privacy
            </Link>
          </>
        }
      >
        <div className="grid gap-34">
          <DeskTransfer />
          <InstallApp className="border-t border-line pt-21" />
        </div>
      </Block>
    </>
  );
}
