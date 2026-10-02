import { absoluteUrl } from "@/config/site";

/**
 * XML SITEMAP ECOSYSTEM
 *   /sitemap.xml              → index
 *   /sitemap-pages.xml        → institutional, trading, platform, trust, legal pages
 *   /sitemap-markets.xml      → Market Command, asset classes, central banks, events
 *   /sitemap-instruments.xml  → one URL per instrument
 *   /sitemap-intelligence.xml → articles
 *   /sitemap-academy.xml      → lessons
 *   /sitemap-glossary.xml     → terms
 *   /sitemap-tools.xml        → calculators and visualisers
 *   /sitemap-blog.xml         → the daily blog (read from the database, see its route)
 *
 * Only canonical, indexable URLs are listed. `lastmod` is a real date: the
 * article's own published/updated date, or the date the page template last
 * changed materially (CONTENT_REVISED). It is never "now".
 */

/** Date of the last material revision of the static page set. Update when page content changes. */
export const CONTENT_REVISED = "2026-10-01";

export type SitemapEntry = { path: string; lastmod?: string };

export const SITEMAP_NAMES = ["pages", "markets", "instruments", "intelligence", "academy", "glossary", "tools", "blog"] as const;
export type SitemapName = (typeof SITEMAP_NAMES)[number];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const XML_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
};

export function urlsetResponse(entries: SitemapEntry[]): Response {
  const seen = new Set<string>();
  const body = entries
    .filter((e) => (seen.has(e.path) ? false : (seen.add(e.path), true)))
    .map((e) => `  <url><loc>${esc(absoluteUrl(e.path))}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod)}</lastmod>` : ""}</url>`)
    .join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, { headers: XML_HEADERS });
}

export function indexResponse(items: { name: SitemapName; lastmod: string }[]): Response {
  const body = items.map((i) => `  <sitemap><loc>${esc(absoluteUrl(`/sitemap-${i.name}.xml`))}</loc><lastmod>${esc(i.lastmod)}</lastmod></sitemap>`).join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`, { headers: XML_HEADERS });
}

export const latest = (dates: (string | undefined)[], fallback = CONTENT_REVISED) =>
  dates.filter((d): d is string => !!d).sort().pop() ?? fallback;
