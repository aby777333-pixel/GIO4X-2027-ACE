import { indexResponse, SITEMAP_NAMES } from "@/lib/sitemap";
import { sitemapLastmod } from "@/lib/sitemap-data";

export const dynamic = "force-static";

/** Sitemap index. Child sitemaps are listed in robots.txt through this one URL. */
export function GET() {
  return indexResponse(SITEMAP_NAMES.map((name) => ({ name, lastmod: sitemapLastmod(name) })));
}
