import Link from "next/link";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { Icon, type IconName } from "@/components/control/icons";
import { ViewsControl, type ViewsProps } from "@/components/control/ViewsControl";
import { viewParamsFrom } from "@/components/control/views-shared";
import { BLOG_FILTER_LABEL, BLOG_FILTERS, BLOG_STATE_LABEL, blogState, type BlogFilter, type BlogState } from "@/components/control/views/blog-shared";
import { BLOG_CATEGORIES, BLOG_CATEGORY_LABEL, BLOG_PATH } from "@/lib/blog";
import type { BlogCategory, BlogPostRow } from "@/lib/supabase/types";

export type BlogListItem = Pick<BlogPostRow, "id" | "slug" | "title" | "category" | "status" | "published_at" | "byline" | "updated_at">;

export const BLOG_LIST_COLUMNS = "id, slug, title, category, status, published_at, byline, updated_at";

/** How many posts stand in each state, counted from the rows. */
export type BlogCounts = Record<BlogFilter | "all", number>;

export type BlogListViewProps = {
  /** "" is every post */
  status: BlogFilter | "";
  category: BlogCategory | "";
  q: string;
  posts: BlogListItem[];
  /** null when a figure could not be counted: none is shown rather than a wrong one */
  counts: BlogCounts | null;
  /** rendered-at time: decides "scheduled" against "published" */
  now: number;
  /** may create a post (blog.write) */
  canWrite: boolean;
  total: number;
  page: number;
  pageCount: number;
  failed: boolean;
  pastEnd: boolean;
  /** the person's saved views for this screen; left out, the Views control is not drawn */
  views?: ViewsProps;
  error?: string;
};

// shape + words, never colour alone
const STATE_CLASS: Record<BlogState, string> = {
  draft: "state-off",
  review: "state-pre",
  scheduled: "state-overlap",
  live: "state-open",
  archived: "state-off",
};

const TILES: { key: BlogFilter | "all"; label: string; icon: IconName }[] = [
  { key: "all", label: "All posts", icon: "documents" },
  { key: "draft", label: "Drafts", icon: "inbox" },
  { key: "review", label: "Ready for review", icon: "tasks" },
  { key: "scheduled", label: "Scheduled", icon: "clock" },
  { key: "published", label: "Published", icon: "reports" },
  { key: "archived", label: "Archived", icon: "audit" },
];

/** The status in words, with the time that matters to it: when a scheduled post appears, when a published one did. */
export function BlogStateBadge({ post, now, withTime = false }: { post: Pick<BlogPostRow, "status" | "published_at">; now: number; withTime?: boolean }) {
  const state = blogState(post, now);
  const time = withTime && (state === "scheduled" || state === "live") && post.published_at ? fmtDateTime(post.published_at) : "";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-8 gap-y-3">
      <span className={`state ${STATE_CLASS[state]}`}>{state === "scheduled" && time ? "Scheduled for" : BLOG_STATE_LABEL[state]}</span>
      {time && <span className="num whitespace-nowrap text-xs text-ink-3">{time}</span>}
    </span>
  );
}

/** Presentation only. The filters shown here were validated by the page before they reached the database. */
export function BlogListView({ status, category, q, posts, counts, now, canWrite, total, page, pageCount, failed, pastEnd, views, error }: BlogListViewProps) {
  const filtered = !!(status || category || q);
  const href = (next: { status?: BlogFilter | ""; page?: number }) => {
    const sp = new URLSearchParams();
    const s = next.status ?? status;
    if (s) sp.set("status", s);
    if (category) sp.set("category", category);
    if (q) sp.set("q", q);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    const query = sp.toString();
    return query ? `/control/blog?${query}` : "/control/blog";
  };
  const caption = filtered ? "Posts matching the current filters, the most recently changed first" : "Every post, the most recently changed first";

  return (
    <>
      <ControlHead
        title="Blog"
        lead={
          <>
            The website’s daily blog, written here. A post is public once it is published and its publication time has passed; until then only staff see it.{" "}
            <Link href={BLOG_PATH} className="link" target="_blank" rel="noopener">
              Open the blog on the website<span className="sr-only"> (opens in a new tab)</span>
            </Link>
            .
          </>
        }
        actions={
          <>
            <Link href="/control/blog/calendar" className="btn btn-ghost">
              Calendar
            </Link>
            {canWrite && (
              <Link href="/control/blog/new" className="btn btn-primary">
                New post
              </Link>
            )}
          </>
        }
      />

      {error && (
        <div className="mt-21">
          <Notice title={error} tone="error" />
        </div>
      )}

      {counts ? (
        <ul className="mt-21 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6" aria-label="Posts by status">
          {TILES.map((tile) => {
            const current = tile.key === "all" ? status === "" : status === tile.key;
            return (
              <li key={tile.key} className="grid">
                <Link href={tile.key === "all" ? "/control/blog" : `/control/blog?status=${tile.key}`} className="gxc-stat" aria-current={current && !category && !q ? "page" : undefined}>
                  <span className="gxc-stat-icon">
                    <Icon name={tile.icon} size={16} />
                  </span>
                  <span className="gxc-stat-label">{tile.label}</span>
                  <span className="gxc-stat-value">{counts[tile.key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-21">
          <Notice title="The posts could not be counted">The figures are left out rather than shown wrong. The list below is unaffected.</Notice>
        </div>
      )}

      {views && <ViewsControl screen="blog" current={viewParamsFrom("blog", { status, category })} searching={!!q} {...views} />}

      <form method="get" action="/control/blog" role="search" aria-label="Filter posts" className="mt-21 grid gap-13 border-b border-line pb-21 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <div className="field sm:col-span-2 lg:col-span-1">
          <label htmlFor="blog-q">Title or address</label>
          <input id="blog-q" name="q" type="search" className="input" defaultValue={q} maxLength={100} placeholder="Words from the title, or the slug" autoComplete="off" spellCheck={false} />
        </div>
        <div className="field">
          <label htmlFor="blog-status">Status</label>
          <select id="blog-status" name="status" className="select" defaultValue={status}>
            <option value="">All</option>
            {BLOG_FILTERS.map((s) => (
              <option key={s} value={s}>
                {BLOG_FILTER_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="blog-category">Category</label>
          <select id="blog-category" name="category" className="select" defaultValue={category}>
            <option value="">Any category</option>
            {BLOG_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {BLOG_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <button type="submit" className="btn btn-primary">
            Apply
          </button>
          {filtered && (
            <Link href="/control/blog" className="btn btn-quiet">
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="mt-13">
        {failed ? (
          <Notice title="The posts could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        ) : posts.length ? (
          <PostsTable posts={posts} now={now} caption={caption} />
        ) : pastEnd ? (
          <Empty title="There is no such page">
            <p>
              <Link href={href({ page: 1 })} className="link">
                Go to the first page
              </Link>
            </p>
          </Empty>
        ) : filtered ? (
          <Empty title="Nothing matches these filters">
            <p>
              Try a different status or category, fewer words, or{" "}
              <Link href="/control/blog" className="link">
                see every post
              </Link>
              .
            </p>
          </Empty>
        ) : (
          <Empty title="No post has been written yet">
            <p>
              The blog on the website is empty until a post is published here.{" "}
              {canWrite ? (
                <Link href="/control/blog/new" className="link">
                  Write the first post
                </Link>
              ) : (
                "Your role can read posts but not write them."
              )}
            </p>
          </Empty>
        )}
      </div>

      {!failed && !pastEnd && total > 0 && <Pager page={page} pageCount={pageCount} total={total} noun={total === 1 ? "post" : "posts"} href={(p) => href({ page: p })} />}
    </>
  );
}

function PublicLink({ post, now }: { post: BlogListItem; now: number }) {
  // only a post that is in front of the public has a page to open
  if (blogState(post, now) !== "live") return null;
  return (
    <a href={`${BLOG_PATH}/${post.slug}`} target="_blank" rel="noopener" className="gxc-card-link whitespace-nowrap">
      View on the website<span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * Posts as a table from `md` up and as stacked rows on a phone: the same
 * facts, composed for the width rather than squeezed into it.
 */
function PostsTable({ posts, now, caption }: { posts: BlogListItem[]; now: number; caption: string }) {
  return (
    <>
      <div className="scroll-x hidden md:block">
        <table className="table-gx min-w-[54rem] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Category</th>
              <th scope="col">Status</th>
              <th scope="col">Byline</th>
              <th scope="col">Last changed</th>
              <th scope="col">
                <span className="sr-only">On the website</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td className="max-w-[22rem] py-13">
                  <Link href={`/control/blog/${post.id}`} className="link block truncate text-sm font-medium" title={post.title}>
                    {post.title}
                  </Link>
                  <span className="num mt-3 block truncate text-xs text-ink-3">{post.slug}</span>
                </td>
                <td className="whitespace-nowrap text-ink-2">{BLOG_CATEGORY_LABEL[post.category]}</td>
                <td className="py-8">
                  <BlogStateBadge post={post} now={now} withTime />
                </td>
                <td className="max-w-[11rem] truncate text-ink-2">{post.byline}</td>
                <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(post.updated_at)}</td>
                <td className="text-right">
                  <PublicLink post={post} now={now} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden" aria-label={caption}>
        {posts.map((post) => (
          <li key={post.id} className="border-b border-line py-13">
            <Link href={`/control/blog/${post.id}`} className="block break-words text-sm font-medium text-accent">
              {post.title}
            </Link>
            <p className="num mt-3 break-all text-xs text-ink-3">{post.slug}</p>
            <p className="mt-8">
              <BlogStateBadge post={post} now={now} withTime />
            </p>
            <p className="mt-5 flex flex-wrap gap-x-13 text-xs text-ink-3">
              <span>{BLOG_CATEGORY_LABEL[post.category]}</span>
              <span>{post.byline}</span>
              <span className="num">Changed {fmtDateTime(post.updated_at)}</span>
            </p>
            <p className="mt-5 empty:hidden">
              <PublicLink post={post} now={now} />
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
