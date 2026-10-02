import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { BLOG_FILTERS, type BlogFilter } from "@/components/control/views/blog-shared";
import { BLOG_LIST_COLUMNS, BlogListView, type BlogCounts, type BlogListItem } from "@/components/control/views/BlogListView";
import { BLOG_CATEGORIES } from "@/lib/blog";
import { can, requireStaff } from "@/lib/server/staff";
import { cleanSearch } from "@/lib/server/validate";
import type { BlogCategory } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Blog", "/control/blog");

const PER_PAGE = 25;
/** A search is a few words: each must appear in the title or the address. */
const MAX_WORDS = 5;

const ERRORS: Record<string, string> = {
  invalid: "That request was not valid. Nothing was changed.",
  gone: "That post no longer exists.",
};

/**
 * Every post, the one changed most recently first. Filters and search arrive
 * as query parameters and are validated against allow-lists before they reach
 * the database; each search word is reduced to characters that cannot alter
 * the filter. "Scheduled" and "Published" are the same status in the database
 * and differ by whether the publication time has passed, so both are asked
 * for against the moment this page was rendered.
 */
export default async function BlogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "blog.read")) return <NoAccess title="Blog" />;
  const { supabase } = ctx;

  const params = await searchParams;
  const statusParam = firstParam(params.status);
  const status: BlogFilter | "" = (BLOG_FILTERS as readonly string[]).includes(statusParam) ? (statusParam as BlogFilter) : "";
  const categoryParam = firstParam(params.category);
  const category: BlogCategory | "" = (BLOG_CATEGORIES as readonly string[]).includes(categoryParam) ? (categoryParam as BlogCategory) : "";
  const words = firstParam(params.q)
    .slice(0, 200)
    .split(/\s+/)
    .map(cleanSearch)
    .filter(Boolean)
    .slice(0, MAX_WORDS);
  const pageParam = Number.parseInt(firstParam(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 100000 ? pageParam : 1;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  let query = supabase.from("blog_posts").select(BLOG_LIST_COLUMNS, { count: "exact" });
  if (status === "scheduled") query = query.eq("status", "published").gt("published_at", nowIso);
  else if (status === "published") query = query.eq("status", "published").lte("published_at", nowIso);
  else if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  // each word contains only [A-Za-z0-9@._+-]; the quotes keep dots inside the value
  for (const word of words) query = query.or(`title.ilike."%${word}%",slug.ilike."%${word}%"`);
  query = query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  // the figures at the top: one count per state, from the rows themselves
  const count = () => supabase.from("blog_posts").select("id", { count: "exact", head: true });
  const [result, all, draft, review, scheduled, live, archived] = await Promise.all([
    query,
    count(),
    count().eq("status", "draft"),
    count().eq("status", "review"),
    count().eq("status", "published").gt("published_at", nowIso),
    count().eq("status", "published").lte("published_at", nowIso),
    count().eq("status", "archived"),
  ]);
  const tallies = [all, draft, review, scheduled, live, archived];
  // a figure that could not be counted is not shown as zero
  const counts: BlogCounts | null = tallies.some((t) => t.error || t.count === null)
    ? null
    : { all: all.count ?? 0, draft: draft.count ?? 0, review: review.count ?? 0, scheduled: scheduled.count ?? 0, published: live.count ?? 0, archived: archived.count ?? 0 };

  // PGRST103: the requested page is past the end of the result
  const pastEnd = result.error?.code === "PGRST103";
  const failed = !!result.error && !pastEnd;
  const total = result.count ?? 0;

  return (
    <BlogListView
      status={status}
      category={category}
      q={words.join(" ")}
      posts={(result.data ?? []) as BlogListItem[]}
      counts={counts}
      now={now}
      canWrite={can(ctx, "blog.write")}
      total={total}
      page={page}
      pageCount={Math.max(1, Math.ceil(total / PER_PAGE))}
      failed={failed}
      pastEnd={pastEnd}
      error={ERRORS[firstParam(params.error)]}
    />
  );
}
