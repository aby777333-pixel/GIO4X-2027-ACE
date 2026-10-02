/**
 * The Blog list's filters, in one place: the list screen (/control/blog) and
 * a saved view pinned to the dashboard build their query here, so a pinned
 * view's count can never mean something different from the list it opens.
 *
 * "Scheduled" and "Published" are the same status in the database and differ
 * by whether the publication time has passed, so both are asked for against
 * the moment the caller names (`nowIso`).
 */
import { type BlogFilter } from "@/components/control/views/blog-shared";
import { BLOG_LIST_COLUMNS } from "@/components/control/views/BlogListView";
import { viewParamsFrom, type ViewParams } from "@/components/control/views-shared";
import type { Db } from "@/lib/supabase/server";
import type { BlogCategory } from "@/lib/supabase/types";

export type BlogFilters = {
  /** "" is every post */
  status: BlogFilter | "";
  category: BlogCategory | "";
  /** search words, each already through cleanSearch(): only [A-Za-z0-9@._+-] */
  words: string[];
};

/**
 * `blog_posts` with the filters applied, read as the signed-in member of
 * staff. The caller adds the order and the range. With `head` the database
 * returns the count and no rows.
 */
export function blogFiltered(supabase: Db, f: BlogFilters, nowIso: string, head = false) {
  let query = supabase.from("blog_posts").select(BLOG_LIST_COLUMNS, { count: "exact", head });
  if (f.status === "scheduled") query = query.eq("status", "published").gt("published_at", nowIso);
  else if (f.status === "published") query = query.eq("status", "published").lte("published_at", nowIso);
  else if (f.status) query = query.eq("status", f.status);
  if (f.category) query = query.eq("category", f.category);
  // each word contains only [A-Za-z0-9@._+-]; the quotes keep dots inside the value
  for (const word of f.words) query = query.or(`title.ilike."%${word}%",slug.ilike."%${word}%"`);
  return query;
}

/** How many posts a saved view matches now. Null when it could not be counted. */
export async function countBlogView(supabase: Db, stored: ViewParams, nowIso: string): Promise<number | null> {
  const p = viewParamsFrom("blog", stored);
  const { count, error } = await blogFiltered(supabase, { status: (p.status ?? "") as BlogFilter | "", category: (p.category ?? "") as BlogCategory | "", words: [] }, nowIso, true);
  return error || count === null ? null : count;
}
