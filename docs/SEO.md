# SEO, discovery and sharing

Legitimate technical SEO only: no doorway pages, hidden text, cloaking, keyword stuffing or mass-generated
thin pages. Every indexable page must be worth indexing.

## Metadata

- Every route builds its metadata with `pageMeta()` (`src/lib/meta.ts`): title, description, canonical,
  Open Graph and X card, always consistent.
- Title template: `<Page title> | GIO4X`. Examples: `EUR/USD: Euro / US Dollar | GIO4X`,
  `Forex markets | GIO4X`, `Margin | GIO4X Glossary`.
- The canonical path is passed explicitly, so tracking parameters (`utm_*`), filters, hashes and themes can
  never leak into it. Theme and palette never create URLs.
- Share cards: `src/lib/og.tsx` renders one composition (ivory ground, logo, eyebrow, TT Norms statement,
  DNA rule). The default card is `src/app/opengraph-image.tsx`; articles, instruments, glossary terms and
  tools define their own with the page title. Cards never contain market data.

## Indexing policy

| Surface | Policy |
|---|---|
| Production public pages | index, follow |
| Any non-production environment (`NEXT_PUBLIC_SITE_ENV` ≠ `production`) | `noindex, nofollow` in metadata **and** `Disallow: /` in robots.txt |
| `/search`, `/preferences`, `/sign-in`, `/open-account` | `noindex, follow`; disallowed in robots.txt; absent from sitemaps |
| `/control/**`, `/api/**` | `X-Robots-Tag: noindex`, disallowed, authenticated or write-only |
| Unknown slugs | real 404 (`dynamicParams = false`), never a soft 404 |

`robots.txt` never blocks CSS, JS, fonts or images. Disallow is not treated as a security control.

## Sitemaps

`/sitemap.xml` is an index of `/sitemap-pages.xml`, `-markets`, `-instruments`, `-intelligence`,
`-academy`, `-glossary`, `-tools` (`src/lib/sitemap.ts`, `src/lib/sitemap-data.ts`). Only canonical,
indexable URLs are listed. `lastmod` is real: an article's own published/updated date, or
`CONTENT_REVISED` (the date the static page set last changed materially). It is never "now".
The human-facing directory is `/explore`.

## Structured data (JSON-LD)

| Type | Where |
|---|---|
| `Organization`, `WebSite` (+ `SearchAction` → `/search?q=`) | every page (root layout) |
| `BreadcrumbList` | every page with visible breadcrumbs (`<Breadcrumbs/>`) |
| `WebPage` | instrument and hub pages |
| `Article` | Intelligence articles (desk byline as `Organization` author: no invented people) |
| `DefinedTerm` / `DefinedTermSet` | glossary terms / glossary index |
| `FAQPage` | `/faq`, only for questions visibly on the page |
| `SoftwareApplication` | `/platforms/raptor` (no ratings, no price) |

Never marked up: ratings, reviews, prices, awards, employee counts, anything not visible on the page.

## URL architecture and redirects

Readable, hierarchical, lowercase, no IDs, no trailing slashes:
`/markets/forex/eur-usd`, `/glossary/spread`, `/tools/pip-value`, `/intelligence/<slug>`.

All 39 URLs of the previous site either still exist or have a single-hop permanent redirect in
`src/config/redirects.json` (served by `next.config.mjs`). No chains. Add new legacy URLs there.

## Internal linking

Links are structural, not decorative: instrument ↔ currencies ↔ central banks ↔ events ↔ glossary ↔ tools
↔ lessons, driven by the knowledge graph and each data module's `related` fields. Every substantial page
ends with one to four considered next steps (`<NextSteps/>`). The footer is a directory, not a link farm.

## Feeds and machine-readable extras

- RSS 2.0: `/intelligence/feed.xml`.
- `/llms.txt`: experimental, supplementary pointer to public reference material.
- `/manifest.webmanifest`, full icon set, `theme-color` updated with the theme.

## Search-console readiness

Set `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` in the production environment (they are rendered
as meta tags; nothing is hard-coded). Submit `/sitemap.xml` in both consoles after the first production
deploy. IndexNow is not implemented; add it only when content is published frequently enough to matter.

## Checks

`npm run audit:links` crawls a running instance from the sitemaps and from links and fails on: non-200
pages, pages without exactly one `<h1>`, missing title / description / canonical, placeholder links,
broken in-page anchors, images without `alt`, visible `\uXXXX` escapes, and sitemap entries that do not
resolve. Run it against a production build before every deploy.
