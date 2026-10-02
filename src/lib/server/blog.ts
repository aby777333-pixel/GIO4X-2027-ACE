/**
 * The daily blog, read for the public pages.
 *
 * Every read here is made as the anonymous role. The database decides what
 * that role may see (0011_blog.sql: a post whose status is "published" and
 * whose publication time has passed, and only the public columns), so the
 * filters below are a courtesy that lets the index be used; they are not the
 * gate.
 *
 * Each function says which of three things happened, because a page must not
 * show "nothing published yet" when the truth is "could not ask":
 *   ok      there is something to show
 *   none    the read worked and there is nothing
 *   failed  the project is not configured, or the read did not complete
 *
 * Nothing is frozen at build time. The pages that call these are rendered on
 * demand and kept for BLOG_REVALIDATE seconds, so a post published in the
 * console is on the site within about a minute, without a deploy. The console
 * can make that immediate by calling revalidateTag(BLOG_CACHE_TAG) and
 * revalidatePath(BLOG_PATH, "layout") after publishing.
 */
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { BLOG_CATEGORIES, BLOG_PAGE_SIZE, BLOG_PATH, blogImageUrl, readingMinutes } from "@/lib/blog";
import { createPublicSupabase } from "@/lib/supabase/server";
import { BLOG_PUBLIC_COLUMNS, type BlogCategory, type BlogPublicPost } from "@/lib/supabase/types";

/** Seconds a rendered page or a cached list may be served before it is read again. */
export const BLOG_REVALIDATE = 60;
export const BLOG_CACHE_TAG = "blog";
/** The highest page number that is ever asked of the database (a bound on what a visitor can make us read or keep). */
export const BLOG_MAX_PAGE = 500;

export type BlogCover = { src: string; alt: string; width: number | null; height: number | null };

/** A public post: the publication time is always there. */
export type BlogPost = Omit<BlogPublicPost, "published_at"> & { published_at: string };

/** What a list shows of a post. The body is read to count the minutes and is not carried further. */
export type BlogCard = Pick<BlogPost, "slug" | "title" | "excerpt" | "category" | "byline" | "published_at" | "corrected_at"> & {
  minutes: number;
  cover: BlogCover | null;
};

export type BlogNeighbour = Pick<BlogPost, "slug" | "title" | "published_at">;
export type BlogFeedItem = Pick<BlogPost, "slug" | "title" | "excerpt" | "category" | "byline" | "published_at">;
/** What a sitemap needs of a post. */
export type BlogIndexEntry = { slug: string; lastmod: string };

export type BlogFailure = { state: "failed"; reason: "not-configured" | "unavailable" };
export type BlogList =
  | { state: "ok"; posts: BlogCard[]; total: number; page: number; pages: number }
  | { state: "none" }
  /** the page asked for is past the last one */
  | { state: "out-of-range" }
  | BlogFailure;
export type BlogOne = { state: "ok"; post: BlogPost } | { state: "none" } | BlogFailure;
export type BlogLatest = { state: "ok"; posts: BlogCard[] } | { state: "none" } | BlogFailure;
export type BlogNeighbours = { state: "ok"; previous: BlogNeighbour | null; next: BlogNeighbour | null } | BlogFailure;
export type BlogFeed = { state: "ok"; items: BlogFeedItem[] } | { state: "none" } | BlogFailure;
export type BlogIndex = { state: "ok"; entries: BlogIndexEntry[] } | { state: "none" } | BlogFailure;

const NOT_CONFIGURED: BlogFailure = { state: "failed", reason: "not-configured" };
const UNAVAILABLE: BlogFailure = { state: "failed", reason: "unavailable" };

const CARD_COLUMNS = "slug, title, excerpt, body, category, byline, published_at, corrected_at, cover_path, cover_alt, cover_width, cover_height" as const;
type CardRow = Pick<BlogPublicPost, "slug" | "title" | "excerpt" | "body" | "category" | "byline" | "published_at" | "corrected_at" | "cover_path" | "cover_alt" | "cover_width" | "cover_height">;

export const isBlogCategory = (value: unknown): value is BlogCategory => typeof value === "string" && (BLOG_CATEGORIES as readonly string[]).includes(value);

export const blogPostPath = (slug: string) => `${BLOG_PATH}/${slug}`;

/** The cover of a post as a page can show it, or null when there is none (or the project has no storage address). */
export function blogCover(post: Pick<BlogPublicPost, "cover_path" | "cover_alt" | "cover_width" | "cover_height">): BlogCover | null {
  const src = post.cover_path ? blogImageUrl(post.cover_path) : null;
  if (!src) return null;
  return { src, alt: post.cover_alt, width: post.cover_width, height: post.cover_height };
}

function toCard(row: CardRow): BlogCard | null {
  if (!row.published_at) return null;
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    byline: row.byline,
    published_at: row.published_at,
    corrected_at: row.corrected_at,
    minutes: readingMinutes(row.body),
    cover: blogCover(row),
  };
}

const cards = (rows: CardRow[] | null): BlogCard[] => (rows ?? []).map(toCard).filter((c): c is BlogCard => c !== null);

/** One page of the list, read from the database. */
async function readList(page: number, category: BlogCategory | null): Promise<BlogList> {
  const supabase = createPublicSupabase();
  if (!supabase) return NOT_CONFIGURED;
  try {
    const from = (page - 1) * BLOG_PAGE_SIZE;
    let query = supabase.from("blog_posts").select(CARD_COLUMNS, { count: "exact" }).eq("status", "published").lte("published_at", new Date().toISOString());
    if (category) query = query.eq("category", category);
    const { data, count, error } = await query
      .order("published_at", { ascending: false })
      .order("slug", { ascending: true })
      .range(from, from + BLOG_PAGE_SIZE - 1);
    if (error) {
      // PostgREST answers "range not satisfiable" when the first row asked for is past the last one
      if (error.code === "PGRST103") return page > 1 ? { state: "out-of-range" } : { state: "none" };
      return UNAVAILABLE;
    }
    const posts = cards(data as CardRow[] | null);
    if (!posts.length) return page > 1 ? { state: "out-of-range" } : { state: "none" };
    const total = Math.max(count ?? 0, from + posts.length);
    return { state: "ok", posts, total, page, pages: Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE)) };
  } catch {
    return UNAVAILABLE;
  }
}

class BlogReadFailed extends Error {}

/**
 * The list page reads its query string, so it is rendered for every request.
 * What it reads is kept for a minute, so that many visitors, or one visitor
 * asking many times, are one question to the database. A failed read is thrown
 * through the cache so that it is never kept.
 */
const cachedList = unstable_cache(
  async (page: number, category: string): Promise<BlogList> => {
    const result = await readList(page, isBlogCategory(category) ? category : null);
    if (result.state === "failed") throw new BlogReadFailed(result.reason);
    return result;
  },
  ["blog-list"],
  { revalidate: BLOG_REVALIDATE, tags: [BLOG_CACHE_TAG] },
);

/** Published posts, newest first, BLOG_PAGE_SIZE to a page. `page` starts at 1. */
export async function listPosts({ page = 1, category = null }: { page?: number; category?: BlogCategory | null } = {}): Promise<BlogList> {
  if (!Number.isInteger(page) || page < 1 || page > BLOG_MAX_PAGE) return { state: "out-of-range" };
  if (category !== null && !isBlogCategory(category)) return { state: "none" };
  if (!createPublicSupabase()) return NOT_CONFIGURED;
  try {
    return await cachedList(page, category ?? "");
  } catch (e) {
    return e instanceof BlogReadFailed && e.message === "not-configured" ? NOT_CONFIGURED : UNAVAILABLE;
  }
}

/**
 * One public post by its address. The caller validates the slug (isBlogSlug)
 * before asking. Shared between a page and its metadata within one request.
 */
export const getPost = cache(async (slug: string): Promise<BlogOne> => {
  const supabase = createPublicSupabase();
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select(BLOG_PUBLIC_COLUMNS)
      .eq("slug", slug)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .maybeSingle();
    if (error) return UNAVAILABLE;
    const row = data as BlogPublicPost | null;
    if (!row || !row.published_at) return { state: "none" };
    return { state: "ok", post: { ...row, published_at: row.published_at } };
  } catch {
    return UNAVAILABLE;
  }
});

/** The post published just before this one ("previous") and just after it ("next"). */
export async function neighbours(post: Pick<BlogPost, "slug" | "published_at">): Promise<BlogNeighbours> {
  const supabase = createPublicSupabase();
  if (!supabase) return NOT_CONFIGURED;
  try {
    const columns = "slug, title, published_at";
    const now = new Date().toISOString();
    const [before, after] = await Promise.all([
      supabase.from("blog_posts").select(columns).eq("status", "published").lt("published_at", post.published_at).neq("slug", post.slug).order("published_at", { ascending: false }).limit(1),
      supabase.from("blog_posts").select(columns).eq("status", "published").gt("published_at", post.published_at).lte("published_at", now).neq("slug", post.slug).order("published_at", { ascending: true }).limit(1),
    ]);
    if (before.error || after.error) return UNAVAILABLE;
    const first = (rows: unknown): BlogNeighbour | null => {
      const row = ((rows as { slug: string; title: string; published_at: string | null }[] | null) ?? [])[0];
      return row && row.published_at ? { slug: row.slug, title: row.title, published_at: row.published_at } : null;
    };
    return { state: "ok", previous: first(before.data), next: first(after.data) };
  } catch {
    return UNAVAILABLE;
  }
}

/** The newest posts, for a short section on another page. */
export async function latestPosts(n: number): Promise<BlogLatest> {
  const supabase = createPublicSupabase();
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select(CARD_COLUMNS)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .order("slug", { ascending: true })
      .limit(Math.min(Math.max(1, Math.floor(n)), BLOG_PAGE_SIZE));
    if (error) return UNAVAILABLE;
    const posts = cards(data as CardRow[] | null);
    return posts.length ? { state: "ok", posts } : { state: "none" };
  } catch {
    return UNAVAILABLE;
  }
}

/** The newest posts as a feed lists them: no body is read. */
export async function feedPosts(n: number): Promise<BlogFeed> {
  const supabase = createPublicSupabase();
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("slug, title, excerpt, category, byline, published_at")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(Math.min(Math.max(1, Math.floor(n)), 100));
    if (error) return UNAVAILABLE;
    const items = ((data ?? []) as (Omit<BlogFeedItem, "published_at"> & { published_at: string | null })[]).flatMap((r) => (r.published_at ? [{ ...r, published_at: r.published_at }] : []));
    return items.length ? { state: "ok", items } : { state: "none" };
  } catch {
    return UNAVAILABLE;
  }
}

/** The canonical address a post declares, when it is not its own page. */
function pointsElsewhere(slug: string, canonical: string): boolean {
  const c = canonical.trim();
  if (!c) return false;
  const own = blogPostPath(slug);
  return !(c === own || c.endsWith(own));
}

/**
 * Every post a search engine should be told about, newest first: public, not
 * marked noindex, and canonical to itself. `lastmod` is the day the row last
 * changed, or the day it was published when that is later (a scheduled post).
 */
export async function indexablePosts(): Promise<BlogIndex> {
  const supabase = createPublicSupabase();
  if (!supabase) return NOT_CONFIGURED;
  try {
    const step = 1000;
    const entries: BlogIndexEntry[] = [];
    const now = new Date().toISOString();
    for (let from = 0; from < 10 * step; from += step) {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("slug, published_at, updated_at, canonical_url")
        .eq("status", "published")
        .eq("noindex", false)
        .lte("published_at", now)
        .order("published_at", { ascending: false })
        .order("slug", { ascending: true })
        .range(from, from + step - 1);
      if (error) {
        if (error.code === "PGRST103") break;
        return UNAVAILABLE;
      }
      const rows = (data ?? []) as { slug: string; published_at: string | null; updated_at: string; canonical_url: string }[];
      for (const r of rows) {
        if (!r.published_at || pointsElsewhere(r.slug, r.canonical_url)) continue;
        const day = blogDay(Date.parse(r.updated_at) > Date.parse(r.published_at) ? r.updated_at : r.published_at);
        if (day) entries.push({ slug: r.slug, lastmod: day });
      }
      if (rows.length < step) break;
    }
    return entries.length ? { state: "ok", entries } : { state: "none" };
  } catch {
    return UNAVAILABLE;
  }
}

/** "2026-10-02" from a timestamp, in UTC; "" when it is not a date. */
export function blogDay(timestamp: string): string {
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
