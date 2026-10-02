import { indexResponse, latest, SITEMAP_NAMES } from "@/lib/sitemap";
import { sitemapLastmod } from "@/lib/sitemap-data";
import { indexablePosts } from "@/lib/server/blog";

/**
 * Everything listed here is built from the site's own data except the blog,
 * whose posts are rows in the database: the index is read again hourly so that
 * the blog sitemap's date follows its newest post.
 */
export const revalidate = 3600;

/** Sitemap index. Child sitemaps are listed in robots.txt through this one URL. */
export async function GET() {
  const posts = await indexablePosts();
  // when the posts cannot be read, the blog sitemap keeps the date of its list page: never "now"
  const blog = latest(posts.state === "ok" ? posts.entries.map((e) => e.lastmod) : [], sitemapLastmod("blog"));
  return indexResponse(SITEMAP_NAMES.map((name) => ({ name, lastmod: name === "blog" ? blog : sitemapLastmod(name) })));
}
