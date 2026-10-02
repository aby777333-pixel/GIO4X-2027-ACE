import Link from "next/link";
import { BlogLatest } from "@/components/blog/BlogLatest";
import { RouteScene } from "@/components/cockpit/RouteScene";
import { FixingMoment } from "@/components/knowledge/FixingMoment";
import { AnalysisRows, articleHref, ExplainerList, liveSections, SectionNav, sectionHref, StoryMeta } from "@/components/knowledge/intelligence";
import { EditionDate } from "@/components/knowledge/Today";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs, EmptyState, NextSteps } from "@/components/ui/Page";
import { articles, articlesBySection, sectionLabels } from "@/data/articles";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";
import "@/components/knowledge/knowledge.css";

const description = "GIO4X Intelligence: analysis, explainers and guides on currencies, commodities, risk and market structure. Desk bylines, dated pieces, no forecasts and no trade calls.";

export const metadata = {
  ...pageMeta({ title: "GIO4X Intelligence", description, path: "/intelligence" }),
  alternates: { canonical: "/intelligence", types: { "application/rss+xml": [{ url: "/intelligence/feed.xml", title: "GIO4X Intelligence" }] } },
};

// The reference fixing in the data moment is refreshed hourly (its own fetch is cached for the hour).
// The page itself is read again each minute, so that a post published in the console reaches "From the daily blog".
export const revalidate = 60;

/**
 * The front page of the publication. Its rhythm, top to bottom: masthead,
 * one lead with its 30-second brief, two secondaries, a data moment, analysis
 * rows, an explainer index. Formats differ on purpose; nothing is ranked by
 * popularity because nothing is counted.
 */
export default function IntelligencePage() {
  const [lead, ...rest] = articles;
  const secondaries = rest.slice(0, 2);
  const remaining = rest.slice(2);
  const analysis = remaining.filter((a) => a.format === "Analysis" || a.format === "Deep Dive" || a.format === "Research Note");
  const explainers = remaining.filter((a) => !analysis.includes(a));

  return (
    <>
      <JsonLd data={webPageSchema({ path: "/intelligence", name: "GIO4X Intelligence", description, type: "CollectionPage" })} />

      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header className="cx-hero on-night">
        <div className="cx-stage" aria-hidden>
          <RouteScene />
        </div>
        <div className="cx-main">
          <div className="cx-statement">
          <Breadcrumbs crumbs={[{ name: "Intelligence", href: "/intelligence" }]} />
          <div className="mt-34 flex flex-wrap items-center justify-between gap-x-34 gap-y-3 border-t-2 border-ink pt-8 text-xs text-ink-3">
            <EditionDate className="label text-ink-2" />
            <span className="hidden md:inline">The publication of GIO4X · {articles.length} pieces in the archive</span>
            <span className="no-print flex items-center gap-21">
              <Link href="/morning-room" className="link-quiet inline-flex min-h-[2.75rem] items-center">
                Morning Room
              </Link>
              <a href="/intelligence/feed.xml" className="link-quiet inline-flex min-h-[2.75rem] items-center" type="application/rss+xml">
                RSS
              </a>
            </span>
          </div>
          <div className="cx-statement-body">
            <h1 className="h1">
              GIO4X
              <br />
              Intelligence
            </h1>
            <p className="lead mt-21 max-w-[38ch]">A publication, not a blog. Analysis, explainers and guides for people who take markets seriously, written to explain and never to predict.</p>
          </div>
          <hr className="dna-rule" />
          <SectionNav />
          </div>
        </div>
      </header>

      {!lead ? (
        <section className="section">
          <div className="wrap">
            <EmptyState
              title="Nothing is published yet."
              actions={
                <Link href="/academy" className="btn btn-ghost">
                  Go to the Academy
                </Link>
              }
            >
              Every piece carried over from the previous site is being audited before it appears here. Until then, the Academy and the glossary are open.
            </EmptyState>
          </div>
        </section>
      ) : (
        <>
          {/* ── Lead + its brief ─────────────────────────────────────────── */}
          <section className="hairline section-quiet" aria-labelledby="lead-story">
            <div className="wrap phi items-start">
              <article>
                <p className="label">
                  Lead · {lead.format} · {sectionLabels[lead.section]}
                </p>
                <h2 id="lead-story" className="h2 mt-21 max-w-[20ch]">
                  <Link href={articleHref(lead)} className="transition-colors duration-fast hover:text-accent">
                    {lead.title}
                  </Link>
                </h2>
                <p className="lead mt-21 max-w-measure">{lead.excerpt}</p>
                <StoryMeta a={lead} className="mt-21" />
                <Link href={articleHref(lead)} className="btn btn-primary no-print mt-34">
                  Read the piece
                </Link>
              </article>
              <aside aria-labelledby="lead-brief" className="border-t-2 border-ink pt-13">
                <div className="flex items-baseline justify-between gap-13">
                  <h3 id="lead-brief" className="label text-ink">
                    The 30-second brief
                  </h3>
                  <span className="text-xs text-ink-3">of the lead</span>
                </div>
                <ol className="mt-8">
                  {lead.brief.map((b, i) => (
                    <li key={i} className="grid grid-cols-[2.125rem_1fr] gap-x-8 border-t border-line py-13 first:border-t-0">
                      <span className="num pt-2 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-ink-2">{b}</span>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          </section>

          {/* ── Secondaries ──────────────────────────────────────────────── */}
          {secondaries.length > 0 && (
            <section className="hairline" aria-label="Also in this edition">
              <div className="wrap grid md:grid-cols-2">
                {secondaries.map((a, i) => (
                  <article key={a.slug} className={`py-34 lg:py-55 ${i === 0 ? "border-b border-line md:border-b-0 md:border-r md:pr-34 lg:pr-55" : "md:pl-34 lg:pl-55"}`} data-reveal style={{ ["--i" as string]: i }}>
                    <p className="label">
                      {a.format} · {sectionLabels[a.section]}
                    </p>
                    <h2 className="h3 mt-13 max-w-[24ch]">
                      <Link href={articleHref(a)} className="transition-colors duration-fast hover:text-accent">
                        {a.title}
                      </Link>
                    </h2>
                    <p className="mt-13 max-w-[52ch] text-ink-2">{a.excerpt}</p>
                    <StoryMeta a={a} className="mt-21" />
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ── Data moment ──────────────────────────────────────────────── */}
          <section className="hairline bg-paper section" aria-label="The reference fixing">
            <div className="wrap phi items-end">
              <div data-reveal>
                <FixingMoment />
              </div>
              <div className="border-t border-line pt-21 lg:border-l lg:border-t-0 lg:pl-55 lg:pt-0" data-reveal style={{ ["--i" as string]: 2 }}>
                <p className="label">Before the first trade of the day</p>
                <p className="h4 mt-13 max-w-[26ch]">The Morning Room puts the sessions, the fixings and the day’s reading on one calm page.</p>
                <Link href="/morning-room" className="go no-print mt-13 min-h-[2.75rem]">
                  Open the Morning Room
                </Link>
              </div>
            </div>
          </section>

          {/* ── Analysis rows ────────────────────────────────────────────── */}
          {analysis.length > 0 && (
            <section className="section" aria-labelledby="analysis">
              <div className="wrap">
                <div className="flex items-end justify-between gap-21">
                  <div>
                    <p className="eyebrow">Analysis</p>
                    <h2 id="analysis" className="h2 mt-13 max-w-[20ch]">
                      What a market is made of.
                    </h2>
                  </div>
                  <p className="hidden max-w-[34ch] text-sm text-ink-3 md:block">Longer pieces on how a market is structured and what it responds to. Dated, and marked when time-sensitive.</p>
                </div>
                <div className="mt-34">
                  <AnalysisRows items={analysis} />
                </div>
              </div>
            </section>
          )}

          {/* ── Explainer index ──────────────────────────────────────────── */}
          {explainers.length > 0 && (
            <section className="section hairline bg-paper" aria-labelledby="explainers">
              <div className="wrap phi phi-r items-start">
                <div data-reveal>
                  <p className="eyebrow">Explainers and guides</p>
                  <h2 id="explainers" className="h2 mt-13">
                    One idea, properly explained.
                  </h2>
                  <p className="mt-13 max-w-[40ch] text-ink-2">Each takes a single concept and works it through, with the arithmetic shown. Most have a matching tool or Academy lesson.</p>
                  <Link href="/academy" className="go no-print mt-13 min-h-[2.75rem]">
                    The Academy
                  </Link>
                </div>
                <ExplainerList items={explainers} />
              </div>
            </section>
          )}

          {/* ── Sections and standards ───────────────────────────────────── */}
          <section className="section-quiet hairline" aria-labelledby="sections">
            <div className="wrap phi items-start">
              <div>
                <h2 id="sections" className="label">
                  Sections
                </h2>
                <ul className="mt-13 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
                  {liveSections.map((s) => {
                    const n = articlesBySection(s).length;
                    return (
                      <li key={s} className="border-b border-r border-line">
                        <Link href={sectionHref(s)} className="group flex min-h-[3.4375rem] items-baseline justify-between gap-13 p-13 transition-colors duration-fast hover:bg-surface sm:p-21">
                          <span className="font-medium transition-colors duration-fast group-hover:text-accent">{sectionLabels[s]}</span>
                          <span className="num text-xs text-ink-3">
                            {n} {n === 1 ? "piece" : "pieces"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="text-sm text-ink-2">
                <h2 className="label">How this is written</h2>
                <p className="mt-13 max-w-[46ch]">Pieces are signed by a desk, never by an invented name. Each carries its publication date and the date of its last revision. Nothing here is a forecast or a recommendation to trade, and nothing is ranked by popularity because reading is not tracked.</p>
                <p className="mt-5 flex flex-wrap gap-x-21">
                  <Link href="/trust/editorial-standards" className="link inline-flex min-h-[2.75rem] items-center">
                    Editorial standards
                  </Link>
                  <a href="/intelligence/feed.xml" className="link inline-flex min-h-[2.75rem] items-center" type="application/rss+xml">
                    RSS feed
                  </a>
                </p>
              </div>
            </div>
          </section>
        </>
      )}

      <BlogLatest />

      <NextSteps
        items={[
          { kind: "Daily", label: "Morning Room", href: "/morning-room", note: "Sessions, fixings and today’s reading." },
          { kind: "Learn", label: "Academy", href: "/academy", note: "Lessons in order, from first principles." },
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "Every term, defined plainly." },
          { kind: "Markets", label: "Market Command", href: "/markets", note: "What trades, when, and what moves it." },
        ]}
      />
    </>
  );
}
