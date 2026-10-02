import Link from "next/link";
import { ReadingProgress } from "@/components/knowledge/ReadingProgress";
import { SideBlock } from "@/components/knowledge/Reader";
import { Share } from "@/components/knowledge/Share";
import { PageHero } from "@/components/ui/Page";
import { educationalNote, riskWarning } from "@/config/legal";
import { BLOG_CATEGORY_LABEL, BLOG_PATH, readingMinutes } from "@/lib/blog";
import type { BlogCover, BlogNeighbour, BlogPost } from "@/lib/server/blog";
import { BlogBody, blogHeadings } from "./BlogBody";
import { BlogCoverImage, blogListHref, blogPostHref } from "./BlogList";
import { blogIso, blogLongDate, blogShortDate } from "./format";
import "@/components/knowledge/knowledge.css";

/**
 * One post of the daily blog. Presentation only: the post, its cover and its
 * neighbours arrive as props.
 *
 * What the editorial standards promise is on the page, not behind it: who
 * stands behind the post (a desk), the day it was published, and, when it has
 * been materially changed since, the day of that change and what was changed.
 */

type Heading = { id: string; text: string };

function Contents({ headings }: { headings: Heading[] }) {
  return (
    <ol className="grid">
      {headings.map((h, i) => (
        <li key={h.id} className="border-b border-line">
          <a href={`#${h.id}`} className="group grid min-h-[2.75rem] grid-cols-[1.625rem_1fr] items-baseline gap-x-8 py-8 text-sm text-ink-2 transition-colors duration-fast hover:text-accent">
            <span className="num text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
            <span className="[overflow-wrap:anywhere]">{h.text}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

function Neighbour({ post, kind, align = "left" }: { post: BlogNeighbour; kind: string; align?: "left" | "right" }) {
  return (
    <Link href={blogPostHref(post.slug)} rel={kind === "Previous post" ? "prev" : "next"} className={`group flex min-h-[2.75rem] flex-col gap-5 py-21 transition-colors duration-fast hover:bg-surface sm:px-13 ${align === "right" ? "sm:items-end sm:text-right" : ""}`}>
      <span className="label">{kind}</span>
      <span className="h4 transition-colors duration-fast [overflow-wrap:anywhere] group-hover:text-accent">{post.title}</span>
      <time dateTime={blogIso(post.published_at)} className="num text-xs text-ink-3">
        {blogShortDate(post.published_at)}
      </time>
    </Link>
  );
}

export function BlogPostView({
  post,
  cover,
  previous,
  next,
  url,
}: {
  post: BlogPost;
  /** the cover as the page can show it (see blogCover), or null */
  cover: BlogCover | null;
  /** the post published just before this one, and the one just after */
  previous: BlogNeighbour | null;
  next: BlogNeighbour | null;
  /** the post's absolute address, for sharing */
  url: string;
}) {
  const path = blogPostHref(post.slug);
  const category = BLOG_CATEGORY_LABEL[post.category];
  const minutes = readingMinutes(post.body);
  const headings = blogHeadings(post.body);
  const contents = headings.length >= 3 ? headings : [];
  const tags = post.tags.map((t) => t.trim()).filter(Boolean);

  return (
    <>
      <ReadingProgress target="reading" />
      <PageHero
        quiet
        crumbs={[
          { name: "Intelligence", href: "/intelligence" },
          { name: "Daily blog", href: BLOG_PATH },
          { name: post.title, href: path },
        ]}
        eyebrow={category}
        title={<span className="[overflow-wrap:anywhere]">{post.title}</span>}
        lead={post.excerpt || undefined}
      />

      <div className="wrap section-quiet">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-55 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:gap-89">
          <article id="reading" className="min-w-0">
            <p className="flex max-w-measure flex-wrap items-center gap-x-21 gap-y-5 border-b border-line pb-21 text-sm text-ink-3">
              <span className="font-medium text-ink-2">{post.byline}</span>
              <span>
                Published <time dateTime={blogIso(post.published_at)}>{blogLongDate(post.published_at)}</time>
              </span>
              {post.corrected_at && (
                <span>
                  Updated <time dateTime={blogIso(post.corrected_at)}>{blogLongDate(post.corrected_at)}</time>
                </span>
              )}
              <span className="num">{minutes} min read</span>
            </p>

            {post.corrected_at && (
              <p role="note" className="mt-34 max-w-measure border-l-2 border-[var(--warn)] pl-13 text-sm text-ink-2">
                <span className="label mb-3 block">
                  Correction · <time dateTime={blogIso(post.corrected_at)}>{blogLongDate(post.corrected_at)}</time>
                </span>
                <span className="[overflow-wrap:anywhere]">{post.correction_note.trim() || "This post was materially changed after it was published."}</span>
              </p>
            )}

            {cover && (
              <figure className="mt-34">
                <BlogCoverImage cover={cover} eager className="h-auto w-full" />
                {(post.cover_caption || post.cover_credit) && (
                  <figcaption className="mt-8 max-w-measure text-sm text-ink-3">
                    {post.cover_caption}
                    {post.cover_caption && post.cover_credit ? " " : ""}
                    {post.cover_credit && <span>Picture: {post.cover_credit}</span>}
                  </figcaption>
                )}
              </figure>
            )}

            {contents.length > 0 && (
              <details className="disclose no-print mt-34 max-w-measure border-y border-line lg:hidden">
                <summary className="label min-h-[2.75rem] py-13 text-ink">On this page</summary>
                <nav aria-label="On this page" className="pb-13">
                  <Contents headings={contents} />
                </nav>
              </details>
            )}

            <BlogBody source={post.body} className="editorial mt-34 [overflow-wrap:anywhere]" />

            {tags.length > 0 && (
              <div className="mt-34 flex max-w-measure flex-wrap items-center gap-8">
                <h2 className="label mr-5">Tags</h2>
                <ul className="flex flex-wrap gap-8">
                  {tags.map((t) => (
                    <li key={t} className="chip">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <aside aria-label="Risk note" className="mt-55 max-w-measure border-t border-line pt-21 text-sm text-ink-3">
              <p className="text-ink-2">{educationalNote}</p>
              <p className="mt-8">{riskWarning}</p>
              <Link href="/legal/risk" className="go no-print mt-13">
                Risk disclosure
              </Link>
            </aside>

            <nav aria-label="More posts" className="no-print mt-55 border-t border-line-strong">
              {(previous || next) && (
                <div className="grid border-b border-line sm:grid-cols-2">
                  <div className={previous && next ? "border-b border-line sm:border-b-0 sm:border-r" : ""}>{previous && <Neighbour post={previous} kind="Previous post" />}</div>
                  <div>{next && <Neighbour post={next} kind="Next post" align="right" />}</div>
                </div>
              )}
              <Link href={blogListHref()} className="go mt-13 min-h-[2.75rem]">
                All posts
              </Link>
            </nav>
          </article>

          <aside className="min-w-0 lg:border-l lg:border-line lg:pl-34" aria-label="About this post">
            <div className="grid gap-34 lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)] lg:max-h-[calc(100dvh-var(--header-h)-2.625rem)] lg:overflow-y-auto lg:pb-13 lg:pr-3">
              {contents.length > 0 && (
                <nav aria-label="On this page" className="no-print hidden lg:block">
                  <p className="label">On this page</p>
                  <div className="mt-8 border-t border-line-strong">
                    <Contents headings={contents} />
                  </div>
                </nav>
              )}
              <SideBlock label="About this post">
                <p className="text-sm leading-relaxed text-ink-2">
                  A short note from a GIO4X desk, filed under{" "}
                  <Link href={blogListHref(1, post.category)} className="link">
                    {category}
                  </Link>
                  . It explains; it does not forecast and it does not tell you to trade. GIO4X is a broker and earns money when clients trade.
                </p>
                <Link href="/trust/editorial-standards" className="link mt-8 inline-flex min-h-[2.75rem] items-center text-sm">
                  Editorial standards
                </Link>
              </SideBlock>
              <SideBlock label="Share" className="no-print">
                <Share url={url} title={post.title} />
              </SideBlock>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
