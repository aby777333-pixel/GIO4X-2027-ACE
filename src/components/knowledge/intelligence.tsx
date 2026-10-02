import Link from "next/link";
import { articles, sectionLabels, type Article, type ArticleSection } from "@/data/articles";
import { shortDate } from "./prose";

/** Sections that have at least one published article, in the publication's own order. */
export const liveSections: ArticleSection[] = (Object.keys(sectionLabels) as ArticleSection[]).filter((s) => articles.some((a) => a.section === s));

export const articleHref = (a: Article) => `/intelligence/${a.slug}`;
export const sectionHref = (s: ArticleSection) => `/intelligence/section/${s}`;

/** The section rail under the masthead. Real routes, not filters. */
export function SectionNav({ current }: { current?: ArticleSection }) {
  const item = "inline-flex min-h-[2.75rem] shrink-0 snap-start items-center whitespace-nowrap border-b-2 px-13 text-sm font-medium transition-colors duration-fast first:pl-0";
  return (
    <nav aria-label="Sections" className="scroll-x no-print -mx-[var(--gutter)] px-[var(--gutter)]">
      <ul className="flex snap-x gap-5">
        <li>
          <Link href="/intelligence" aria-current={current ? undefined : "page"} className={`${item} ${current ? "border-transparent text-ink-3 hover:text-ink" : "border-ink text-ink"}`}>
            Front page
          </Link>
        </li>
        {liveSections.map((s) => (
          <li key={s}>
            <Link href={sectionHref(s)} aria-current={current === s ? "page" : undefined} className={`${item} ${current === s ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}>
              {sectionLabels[s]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Byline line shared by every story format. */
export function StoryMeta({ a, date = true, className = "" }: { a: Article; date?: boolean; className?: string }) {
  return (
    <p className={`flex flex-wrap gap-x-13 gap-y-2 text-xs text-ink-3 ${className}`}>
      <span>{a.byline}</span>
      {date && <time dateTime={a.published}>{shortDate(a.published)}</time>}
      <span className="num">{a.readMinutes} min read</span>
    </p>
  );
}

/** Analysis format: a wide row with the date in the margin and the standfirst beside the headline. */
export function AnalysisRows({ items }: { items: Article[] }) {
  return (
    <ul className="border-t border-line-strong">
      {items.map((a, i) => (
        <li key={a.slug} className="border-b border-line" data-reveal style={{ ["--i" as string]: i }}>
          <Link href={articleHref(a)} className="group grid gap-x-34 gap-y-8 py-21 transition-colors duration-fast hover:bg-surface md:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1.2fr)] md:px-13 lg:py-34">
            <span className="flex items-baseline gap-13 md:flex-col md:gap-3">
              <span className="label text-ink-2">{a.format}</span>
              <time dateTime={a.published} className="num text-xs text-ink-3">
                {shortDate(a.published)}
              </time>
            </span>
            <span className="h3 transition-colors duration-fast group-hover:text-accent">{a.title}</span>
            <span>
              <span className="block text-ink-2">{a.excerpt}</span>
              <span className="mt-13 flex items-center gap-13 text-xs text-ink-3">
                <span>{sectionLabels[a.section]}</span>
                <span className="num">{a.readMinutes} min read</span>
                <span className="go ml-auto" aria-hidden />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Explainer format: a numbered index in two columns, title first, no standfirst. */
export function ExplainerList({ items }: { items: Article[] }) {
  return (
    <ol className="grid border-t border-line-strong md:grid-cols-2 md:gap-x-55">
      {items.map((a, i) => (
        <li key={a.slug} className="border-b border-line md:[&:last-child:nth-child(odd)]:col-span-2" data-reveal style={{ ["--i" as string]: i }}>
          <Link href={articleHref(a)} className="group grid min-h-[2.75rem] grid-cols-[2.125rem_1fr] gap-x-8 py-21">
            <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
            <span>
              <span className="h4 block transition-colors duration-fast group-hover:text-accent">{a.title}</span>
              <span className="mt-5 flex flex-wrap gap-x-13 text-xs text-ink-3">
                <span>{a.format}</span>
                <span>{sectionLabels[a.section]}</span>
                <span className="num">{a.readMinutes} min</span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
