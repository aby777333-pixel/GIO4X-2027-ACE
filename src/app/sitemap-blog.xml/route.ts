import { latest, urlsetResponse } from "@/lib/sitemap";
import { sitemapEntries } from "@/lib/sitemap-data";
import { blogPostPath, indexablePosts } from "@/lib/server/blog";

/** Posts are published from the console, without a deploy: read again at most once a minute. */
export const revalidate = 60;

/**
 * The daily blog: the list page and one URL per post that is public, not
 * marked noindex and canonical to itself. `lastmod` is the day the post last
 * changed. When the project is not configured, or the posts cannot be read,
 * this is still a valid urlset (the list page alone).
 */
export async function GET() {
  const result = await indexablePosts();
  const posts = result.state === "ok" ? result.entries : [];
  const [list] = sitemapEntries("blog");
  // the list page changes when its newest post does
  const newest = latest(posts.map((p) => p.lastmod), list.lastmod);
  return urlsetResponse([{ ...list, lastmod: newest }, ...posts.map((p) => ({ path: blogPostPath(p.slug), lastmod: p.lastmod }))]);
}
