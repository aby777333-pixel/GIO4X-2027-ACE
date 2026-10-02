import { nav, secondaryNav } from "@/config/nav";
import { articles } from "@/data/articles";
import { lessons } from "@/data/academy";
import { glossary } from "@/data/glossary";
import { assetClasses, instrumentHref, instruments } from "@/data/instruments";
import { centralBanks, econEvents } from "@/data/knowledge";
import { tools } from "@/data/tools";
import { CONTENT_REVISED, latest, type SitemapEntry, type SitemapName } from "@/lib/sitemap";

/** Paths that exist but must never be listed: gateways, utilities, private surfaces. */
const NOT_INDEXED = new Set(["/search", "/preferences", "/sign-in", "/open-account", "/desk", "/offline"]);

const sectionOf = (path: string): SitemapName | null =>
  path.startsWith("/markets") ? "markets" : path.startsWith("/tools") ? "tools" : path.startsWith("/glossary") ? "glossary" : path.startsWith("/intelligence") ? "intelligence" : path.startsWith("/academy") ? "academy" : "pages";

function navPaths(): string[] {
  const out = new Set<string>(["/"]);
  for (const s of nav) {
    out.add(s.href);
    for (const g of s.groups) for (const i of g.items) out.add(i.href.split("#")[0]);
  }
  for (const g of secondaryNav) for (const i of g.items) out.add(i.href.split("#")[0]);
  // pages reached from within sections rather than from navigation
  for (const p of ["/trading", "/morning-room", "/labs", "/labs/market-universe", "/labs/connect-the-dots", "/status", "/media", "/whats-new", "/explore", "/design", "/trust/ai", "/trust/editorial-standards", "/legal/cookies"]) out.add(p);
  return [...out].filter((p) => !NOT_INDEXED.has(p));
}

export function sitemapEntries(name: SitemapName): SitemapEntry[] {
  const fromNav = navPaths()
    .filter((p) => sectionOf(p) === name)
    .map((path) => ({ path, lastmod: CONTENT_REVISED }));
  switch (name) {
    case "pages":
      return fromNav;
    case "markets":
      return [
        ...fromNav,
        ...assetClasses.map((a) => ({ path: `/markets/${a.key}`, lastmod: CONTENT_REVISED })),
        { path: "/markets/central-banks", lastmod: CONTENT_REVISED },
        ...centralBanks.map((b) => ({ path: `/markets/central-banks/${b.slug}`, lastmod: CONTENT_REVISED })),
        { path: "/markets/events", lastmod: CONTENT_REVISED },
        ...econEvents.map((e) => ({ path: `/markets/events/${e.slug}`, lastmod: CONTENT_REVISED })),
      ];
    case "instruments":
      return instruments.map((i) => ({ path: instrumentHref(i), lastmod: CONTENT_REVISED }));
    case "tools":
      return [{ path: "/tools", lastmod: CONTENT_REVISED }, ...tools.map((t) => ({ path: `/tools/${t.slug}`, lastmod: CONTENT_REVISED }))];
    case "glossary":
      return [{ path: "/glossary", lastmod: CONTENT_REVISED }, ...glossary.map((t) => ({ path: `/glossary/${t.slug}`, lastmod: CONTENT_REVISED }))];
    case "intelligence":
      return [
        { path: "/intelligence", lastmod: latest(articles.map((a) => a.updated ?? a.published)) },
        ...[...new Set(articles.map((a) => a.section))].map((sec) => ({ path: `/intelligence/section/${sec}`, lastmod: latest(articles.filter((a) => a.section === sec).map((a) => a.updated ?? a.published)) })),
        ...articles.map((a) => ({ path: `/intelligence/${a.slug}`, lastmod: a.updated ?? a.published })),
      ];
    case "academy":
      return [{ path: "/academy", lastmod: CONTENT_REVISED }, { path: "/academy/books", lastmod: CONTENT_REVISED }, ...lessons.map((l) => ({ path: `/academy/${l.slug}`, lastmod: l.updated ?? l.published }))];
    case "blog":
      // the list page only: the posts are rows in the database and are added by /sitemap-blog.xml itself
      return [{ path: "/intelligence/blog", lastmod: CONTENT_REVISED }];
  }
}

export function sitemapLastmod(name: SitemapName): string {
  return latest(sitemapEntries(name).map((e) => e.lastmod));
}
