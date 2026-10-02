import { absoluteUrl, site } from "@/config/site";
import { BLOG_CATEGORY_LABEL, BLOG_PATH } from "@/lib/blog";
import { blogPostPath, feedPosts } from "@/lib/server/blog";

/** Read again at most once a minute: posts are published from the console, without a deploy. */
export const revalidate = 60;

const ITEMS = 30;

/** Everything that goes into the document is escaped, and characters XML 1.0 does not allow are dropped. */
const esc = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex -- these are exactly the characters XML 1.0 forbids
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** RFC 822 date, as RSS 2.0 requires. */
const rfc822 = (timestamp: string) => new Date(timestamp).toUTCString();

/**
 * The daily blog as RSS 2.0. Summaries only: the full text lives on the site.
 * When there is no post, or the posts cannot be read, the feed is still a
 * valid channel with no items; a minute later it is read again.
 */
export async function GET() {
  const self = absoluteUrl(`${BLOG_PATH}/feed.xml`);
  const result = await feedPosts(ITEMS);
  const posts = result.state === "ok" ? result.items : [];
  const items = posts.map((p) => {
    const url = absoluteUrl(blogPostPath(p.slug));
    return [
      "    <item>",
      `      <title>${esc(p.title)}</title>`,
      `      <link>${esc(url)}</link>`,
      `      <guid isPermaLink="true">${esc(url)}</guid>`,
      `      <pubDate>${esc(rfc822(p.published_at))}</pubDate>`,
      `      <dc:creator>${esc(p.byline)}</dc:creator>`,
      `      <category>${esc(BLOG_CATEGORY_LABEL[p.category] ?? p.category)}</category>`,
      ...(p.excerpt.trim() ? [`      <description>${esc(p.excerpt)}</description>`] : []),
      "    </item>",
    ].join("\n");
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    "    <title>GIO4X daily blog</title>",
    `    <link>${esc(absoluteUrl(BLOG_PATH))}</link>`,
    `    <atom:link href="${esc(self)}" rel="self" type="application/rss+xml" />`,
    "    <description>Short notes from GIO4X’s desks. Educational, not advice or a recommendation to trade.</description>",
    "    <language>en-GB</language>",
    `    <copyright>${esc(site.legalName)}</copyright>`,
    // the newest post dates the feed; a feed with no post carries no build date, never "now"
    ...(posts.length ? [`    <lastBuildDate>${esc(rfc822(posts[0].published_at))}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=60" } });
}
