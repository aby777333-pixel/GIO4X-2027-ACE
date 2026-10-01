import { absoluteUrl, site } from "@/config/site";
import { articles, sectionLabels } from "@/data/articles";

export const dynamic = "force-static";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
/** RFC 822 date, as RSS 2.0 requires. Articles carry a date only, so noon UTC is used. */
const rfc822 = (iso: string) => new Date(`${iso}T12:00:00Z`).toUTCString();

/** GIO4X Intelligence as RSS 2.0. Summaries only: the full text lives on the site. */
export function GET() {
  const self = absoluteUrl("/intelligence/feed.xml");
  const latest = articles.reduce((d, a) => ((a.updated ?? a.published) > d ? (a.updated ?? a.published) : d), "1970-01-01");
  const items = articles
    .map((a) => {
      const url = absoluteUrl(`/intelligence/${a.slug}`);
      return [
        "    <item>",
        `      <title>${esc(a.title)}</title>`,
        `      <link>${esc(url)}</link>`,
        `      <guid isPermaLink="true">${esc(url)}</guid>`,
        `      <pubDate>${rfc822(a.published)}</pubDate>`,
        `      <dc:creator>${esc(a.byline)}</dc:creator>`,
        `      <category>${esc(sectionLabels[a.section])}</category>`,
        `      <description>${esc(a.excerpt)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    "    <title>GIO4X Intelligence</title>",
    `    <link>${esc(absoluteUrl("/intelligence"))}</link>`,
    `    <atom:link href="${esc(self)}" rel="self" type="application/rss+xml" />`,
    "    <description>Analysis, explainers and guides from GIO4X. Explanatory, never predictive.</description>",
    "    <language>en-GB</language>",
    `    <copyright>${esc(site.legalName)}</copyright>`,
    `    <lastBuildDate>${rfc822(latest)}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
