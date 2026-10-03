import { GeneratedCover } from "@/components/ui/GeneratedCover";
import Link from "next/link";
import { EmptyState } from "@/components/ui/Page";
import { BLOG_CATEGORIES, BLOG_CATEGORY_LABEL, BLOG_PATH } from "@/lib/blog";
import type { BlogCard, BlogCover } from "@/lib/server/blog";
import type { BlogCategory } from "@/lib/supabase/types";
import { blogIso, blogShortDate } from "./format";

/**
 * The daily blog as a list. Everything here is presentation: the posts arrive
 * as props, already read and already public. Nothing is invented when there
 * are none: the page says so and points somewhere useful.
 */

export const blogPostHref = (slug: string) => `${BLOG_PATH}/${slug}`;

/** The address of a page of the list. Page one and "all categories" add nothing to it. */
export function blogListHref(page = 1, category: BlogCategory | null = null): string {
  const query = [category ? `category=${category}` : "", page > 1 ? `page=${page}` : ""].filter(Boolean).join("&");
  return query ? `${BLOG_PATH}?${query}` : BLOG_PATH;
}

/**
 * A cover picture from the blog bucket. The stored size is given to the
 * browser when the row has it, and the frame has a fixed shape either way, so
 * the page does not move when the picture arrives.
 */
export function BlogCoverImage({ cover, eager = false, className = "" }: { cover: BlogCover; eager?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served from the project's own storage bucket
    <img
      src={cover.src}
      alt={cover.alt}
      {...(cover.width && cover.height ? { width: cover.width, height: cover.height } : {})}
      {...(eager ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
      decoding="async"
      className={`rounded border border-line bg-surface ${className}`}
    />
  );
}

/** Byline, date and reading time: the line under every post in a list. */
export function BlogCardMeta({ post, date = true, className = "" }: { post: BlogCard; date?: boolean; className?: string }) {
  return (
    <p className={`flex flex-wrap gap-x-13 gap-y-2 text-xs text-ink-3 ${className}`}>
      <span>{post.byline}</span>
      {date && <time dateTime={blogIso(post.published_at)}>{blogShortDate(post.published_at)}</time>}
      <span className="num">{post.minutes} min read</span>
    </p>
  );
}

/** The category rail. Real addresses, so a filtered list can be linked to and opened in a new tab. */
export function BlogCategoryNav({ current }: { current: BlogCategory | null }) {
  const item = "inline-flex min-h-[2.75rem] shrink-0 snap-start items-center whitespace-nowrap border-b-2 px-13 text-sm font-medium transition-colors duration-fast first:pl-0";
  const on = "border-ink text-ink";
  const off = "border-transparent text-ink-3 hover:text-ink";
  return (
    <nav aria-label="Blog categories" className="scroll-x no-print -mx-[var(--gutter)] px-[var(--gutter)]">
      <ul className="flex snap-x gap-5">
        <li>
          <Link href={blogListHref()} aria-current={current ? undefined : "page"} className={`${item} ${current ? off : on}`}>
            All posts
          </Link>
        </li>
        {BLOG_CATEGORIES.map((c) => (
          <li key={c}>
            <Link href={blogListHref(1, c)} aria-current={current === c ? "page" : undefined} className={`${item} ${current === c ? on : off}`}>
              {BLOG_CATEGORY_LABEL[c]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The newest post of page one, set larger. */
function Featured({ post }: { post: BlogCard }) {
  const href = blogPostHref(post.slug);
  return (
    <article className="grid items-center gap-34 border-b border-line pb-34 lg:grid-cols-phi lg:gap-55 lg:pb-55" aria-labelledby="blog-latest-post">
      <Link href={href} tabIndex={-1} aria-hidden className="block">
        {/* a post without a picture of its own is given a drawn cover, worked out from its address */}
        {post.cover ? <BlogCoverImage cover={post.cover} className="aspect-[16/10] w-full object-cover" /> : <GeneratedCover seed={post.slug} className="aspect-[16/10] w-full" />}
      </Link>
      <div>
        <p className="label">Latest · {BLOG_CATEGORY_LABEL[post.category]}</p>
        <h3 id="blog-latest-post" className="h2 mt-13 max-w-[22ch] [overflow-wrap:anywhere]">
          <Link href={href} className="transition-colors duration-fast hover:text-accent">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && <p className="lead mt-21 max-w-measure">{post.excerpt}</p>}
        <BlogCardMeta post={post} className="mt-21" />
        <Link href={href} className="btn btn-primary no-print mt-34">
          Read the post
        </Link>
      </div>
    </article>
  );
}

/** Every other post: a row with the date in the margin, as the Intelligence archive is set. */
function Rows({ posts }: { posts: BlogCard[] }) {
  return (
    <ul className="border-t border-line-strong">
      {posts.map((p) => (
        <li key={p.slug} className="border-b border-line">
          <Link
            href={blogPostHref(p.slug)}
            className={`group grid gap-x-34 gap-y-8 py-21 transition-colors duration-fast hover:bg-surface md:px-13 lg:py-34 ${"md:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,13rem)]"}`}
          >
            <span className="flex items-baseline gap-13 md:flex-col md:gap-3">
              <span className="label text-ink-2">{BLOG_CATEGORY_LABEL[p.category]}</span>
              <time dateTime={blogIso(p.published_at)} className="num text-xs text-ink-3">
                {blogShortDate(p.published_at)}
              </time>
            </span>
            <span className="min-w-0">
              <span role="heading" aria-level={3} className="h3 block max-w-[30ch] transition-colors duration-fast [overflow-wrap:anywhere] group-hover:text-accent">
                {p.title}
              </span>
              {p.excerpt && <span className="mt-8 block max-w-measure text-ink-2">{p.excerpt}</span>}
              <span className="mt-13 flex flex-wrap items-center gap-x-13 gap-y-2 text-xs text-ink-3">
                <span>{p.byline}</span>
                <span className="num">{p.minutes} min read</span>
              </span>
            </span>
            {p.cover ? <BlogCoverImage cover={p.cover} className="aspect-[16/10] w-full max-w-[21rem] self-start object-cover md:max-w-none" /> : <GeneratedCover seed={p.slug} className="aspect-[16/10] w-full max-w-[21rem] self-start md:max-w-none" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Pages({ page, pages, category }: { page: number; pages: number; category: BlogCategory | null }) {
  if (pages <= 1) return null;
  const link = "link inline-flex min-h-[2.75rem] items-center text-sm font-medium";
  return (
    <nav aria-label="Pages of posts" className="no-print mt-34 grid grid-cols-[1fr_auto_1fr] items-center gap-13">
      <span>
        {page > 1 && (
          <Link href={blogListHref(page - 1, category)} rel="prev" className={link}>
            Newer posts
          </Link>
        )}
      </span>
      <p className="num text-sm text-ink-3">
        Page {page} of {pages}
      </p>
      <span className="text-right">
        {page < pages && (
          <Link href={blogListHref(page + 1, category)} rel="next" className={link}>
            Older posts
          </Link>
        )}
      </span>
    </nav>
  );
}

export function BlogListView({ posts, page, pages, total, category }: { posts: BlogCard[]; page: number; pages: number; total: number; category: BlogCategory | null }) {
  const feature = page === 1 ? posts[0] : undefined;
  const rest = feature ? posts.slice(1) : posts;
  return (
    <>
      <p className="num text-xs text-ink-3">
        {total} {total === 1 ? "post" : "posts"}
        {category ? ` in ${BLOG_CATEGORY_LABEL[category]}` : ""}, newest first
      </p>
      <div className="mt-21">
        {feature && <Featured post={feature} />}
        {rest.length > 0 && (
          <div className={feature ? "mt-34 lg:mt-55" : ""}>
            <Rows posts={rest} />
          </div>
        )}
      </div>
      <Pages page={page} pages={pages} category={category} />
    </>
  );
}

/** Nothing has been published (at all, or under one category). Said plainly, with somewhere to go. */
export function BlogEmpty({ category = null }: { category?: BlogCategory | null }) {
  return (
    <EmptyState
      title={category ? `No post has been published under ${BLOG_CATEGORY_LABEL[category]} yet.` : "No post has been published yet."}
      actions={
        <>
          {category && (
            <Link href={BLOG_PATH} className="btn btn-ghost">
              All posts
            </Link>
          )}
          <Link href="/intelligence" className="btn btn-ghost">
            GIO4X Intelligence
          </Link>
          <Link href="/academy" className="btn btn-ghost">
            The Academy
          </Link>
        </>
      }
    >
      The daily blog is written by GIO4X staff, and each post appears here when it is published. Until the first one is, the longer pieces in GIO4X Intelligence and the lessons in the Academy are open.
    </EmptyState>
  );
}

/** The posts could not be read: said as that, never as "there are none". */
export function BlogUnavailable() {
  return (
    <p className="max-w-measure text-ink-2" role="status">
      Posts could not be loaded just now. Please reload the page in a moment. GIO4X Intelligence and the Academy do not depend on this and are open.
    </p>
  );
}

/** A few posts as compact cells, for a section on another page. */
export function BlogCompactList({ posts }: { posts: BlogCard[] }) {
  return (
    <ul className="grid border-l border-t border-line md:grid-cols-3">
      {posts.map((p) => (
        <li key={p.slug} className="border-b border-r border-line">
          <Link href={blogPostHref(p.slug)} className="group flex h-full flex-col gap-13 p-21 transition-colors duration-fast hover:bg-surface">
            <span className="flex flex-wrap items-baseline justify-between gap-x-13 gap-y-2">
              <span className="label">{BLOG_CATEGORY_LABEL[p.category]}</span>
              <time dateTime={blogIso(p.published_at)} className="num text-xs text-ink-3">
                {blogShortDate(p.published_at)}
              </time>
            </span>
            <span role="heading" aria-level={3} className="h4 block transition-colors duration-fast [overflow-wrap:anywhere] group-hover:text-accent">
              {p.title}
            </span>
            {p.excerpt && <span className="line-clamp-3 text-sm text-ink-2">{p.excerpt}</span>}
            <span className="mt-auto flex flex-wrap gap-x-13 gap-y-2 text-xs text-ink-3">
              <span>{p.byline}</span>
              <span className="num">{p.minutes} min read</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
