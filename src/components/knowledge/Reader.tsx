import Link from "next/link";
import type { ReactNode } from "react";
import { RouteScene } from "@/components/cockpit/RouteScene";
import { Breadcrumbs } from "@/components/ui/Page";
import { educationalNote, riskWarning } from "@/config/legal";
import type { Crumb } from "@/lib/schema";
import { CopyButton, Share } from "./Share";
import { ReadingProgress } from "./ReadingProgress";
import { longDate } from "./prose";
import "./knowledge.css";

export type TocItem = { id: string; text: string };

/** Published / revised dates as machine-readable `<time>` elements. */
export function Dates({ published, updated }: { published: string; updated?: string }) {
  return (
    <>
      <span>
        Published <time dateTime={published}>{longDate(published)}</time>
      </span>
      {updated && updated !== published && (
        <span>
          Revised <time dateTime={updated}>{longDate(updated)}</time>
        </span>
      )}
    </>
  );
}

function TocLinks({ toc }: { toc: TocItem[] }) {
  return (
    <ol className="grid">
      {toc.map((t, i) => (
        <li key={t.id} className="border-b border-line">
          <a href={`#${t.id}`} className="group grid min-h-[2.75rem] grid-cols-[1.625rem_1fr] items-baseline gap-x-8 py-8 text-sm text-ink-2 transition-colors duration-fast hover:text-accent">
            <span className="num text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
            <span>{t.text}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/** A labelled group in the side column. */
export function SideBlock({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h2 className="label">{label}</h2>
      <div className="mt-13">{children}</div>
    </section>
  );
}

type ReaderProps = {
  crumbs: Crumb[];
  /** small line above the title, e.g. "Technical analysis · Explainer" */
  kicker: ReactNode;
  title: string;
  lead: string;
  /** byline, dates, reading time */
  meta: ReactNode;
  notice?: string;
  brief?: string[];
  toc: TocItem[];
  /** prepared HTML (see prose.ts) */
  html: string;
  /** shown in place of the prepared HTML when given: an Academy lesson passes its own body, which can also lay the same text out as a story */
  body?: ReactNode;
  /** canonical absolute URL, for sharing */
  url: string;
  /** a ready-made citation */
  citation: string;
  /** side-column blocks under the table of contents */
  aside?: ReactNode;
  /** main-column content after the body (previous / next, related reading) */
  children?: ReactNode;
};

/**
 * The reading experience shared by Intelligence articles and Academy lessons:
 * an editorial header, a 68-character measure, a side column that stays in
 * view on desktop and folds under the text on small screens.
 */
export function Reader({ crumbs, kicker, title, lead, meta, notice, brief, toc, html, body, url, citation, aside, children }: ReaderProps) {
  return (
    <>
      <ReadingProgress target="reading" />
      <header className="cx-hero on-night">
        <div className="cx-stage" aria-hidden>
          <RouteScene />
        </div>
        <div className="cx-main">
          <div className="cx-statement">
            <Breadcrumbs crumbs={crumbs} />
            <div className="cx-statement-body max-w-[56rem]">
              <p className="eyebrow">{kicker}</p>
              <h1 className="h2 mt-21 max-w-[26ch]">{title}</h1>
              <p className="lead mt-21 max-w-[60ch]">{lead}</p>
              <p className="mt-34 flex flex-wrap items-center gap-x-21 gap-y-5 text-sm text-ink-3">{meta}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="wrap section-quiet">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-55 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:gap-89">
          <article id="reading" className="min-w-0">
            {notice && (
              <p role="note" className="mb-34 max-w-measure border-l-2 border-[var(--warn)] pl-13 text-sm text-ink-2">
                <span className="label mb-3 block">Editor’s note</span>
                {notice}
              </p>
            )}

            {brief && brief.length > 0 && (
              <section aria-labelledby="brief" className="mb-55 max-w-measure border-t-2 border-ink pt-13">
                <div className="flex items-baseline justify-between gap-13">
                  <h2 id="brief" className="label text-ink">
                    The 30-second brief
                  </h2>
                  <span className="text-xs text-ink-3">
                    {brief.length} points
                  </span>
                </div>
                <ol className="mt-13">
                  {brief.map((b, i) => (
                    <li key={i} className="grid grid-cols-[2.125rem_1fr] gap-x-8 border-t border-line py-13 first:border-t-0">
                      <span className="num pt-2 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-[1.0625rem] leading-relaxed text-ink">{b}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {toc.length > 1 && (
              <details className="disclose no-print mb-34 max-w-measure border-y border-line lg:hidden">
                <summary className="label min-h-[2.75rem] py-13 text-ink">On this page</summary>
                <nav aria-label="On this page" className="pb-13">
                  <TocLinks toc={toc} />
                </nav>
              </details>
            )}

            {body ?? <div className="prose-gx editorial" dangerouslySetInnerHTML={{ __html: html }} />}

            <aside aria-label="Risk note" className="mt-55 max-w-measure border-t border-line pt-21 text-sm text-ink-3">
              <p className="text-ink-2">{educationalNote}</p>
              <p className="mt-8">{riskWarning}</p>
              <Link href="/legal/risk" className="go no-print mt-13">
                Risk disclosure
              </Link>
            </aside>

            {children}
          </article>

          <aside className="min-w-0 lg:border-l lg:border-line lg:pl-34" aria-label="About this page">
            <div className="grid gap-34 lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)] lg:max-h-[calc(100dvh-var(--header-h)-2.625rem)] lg:overflow-y-auto lg:pb-13 lg:pr-3">
              {toc.length > 1 && (
                <nav aria-label="On this page" className="no-print hidden lg:block">
                  <p className="label">On this page</p>
                  <div className="mt-8 border-t border-line-strong">
                    <TocLinks toc={toc} />
                  </div>
                </nav>
              )}
              {aside}
              <SideBlock label="Share" className="no-print">
                <Share url={url} title={title} />
              </SideBlock>
              <SideBlock label="Cite this page">
                <p className="text-sm leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{citation}</p>
                <div className="no-print mt-13">
                  <CopyButton text={citation} label="Copy citation" done="Citation copied" />
                </div>
              </SideBlock>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

/** Related reading as rows: a label, a title, one line. */
export function ReadRows({ items, className = "" }: { items: { href: string; kicker: string; title: string; note?: string }[]; className?: string }) {
  if (!items.length) return null;
  return (
    <ul className={`border-t border-line-strong ${className}`}>
      {items.map((r) => (
        <li key={r.href} className="border-b border-line">
          <Link href={r.href} className="group grid gap-x-21 gap-y-3 py-21 transition-colors duration-fast hover:bg-[var(--brand-soft)] sm:grid-cols-[9rem_1fr_auto] sm:items-baseline">
            <span className="label">{r.kicker}</span>
            <span>
              <span className="h4 block transition-colors duration-fast group-hover:text-accent">{r.title}</span>
              {r.note && <span className="mt-3 block text-sm text-ink-3">{r.note}</span>}
            </span>
            <span className="go hidden self-center sm:inline-flex" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
