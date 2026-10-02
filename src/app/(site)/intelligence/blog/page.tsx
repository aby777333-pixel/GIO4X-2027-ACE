import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogCategoryNav, BlogEmpty, blogListHref, BlogListView, blogPostHref, BlogUnavailable } from "@/components/blog/BlogList";
import { blogIso } from "@/components/blog/format";
import { BLOG_FEED } from "@/components/blog/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { absoluteUrl } from "@/config/site";
import { BLOG_CATEGORY_LABEL, BLOG_PATH } from "@/lib/blog";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";
import { BLOG_MAX_PAGE, isBlogCategory, listPosts } from "@/lib/server/blog";
import type { BlogCategory } from "@/lib/supabase/types";

type Search = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const FEED = BLOG_FEED;
const description = "The GIO4X daily blog: short notes from GIO4X’s desks on markets, platforms and the firm, published by staff. Dated, signed by a desk, educational and never advice.";

/**
 * Posts are written in GIO4X Control and change without a deploy, so nothing
 * here is frozen at build time: the page is rendered on demand and what it
 * reads is kept for a minute (see src/lib/server/blog.ts).
 */
export const revalidate = 60;

/**
 * The query string, validated. `?page=` is a whole number from 1; `?category=`
 * is one of the four categories. Anything else is not an address of this page.
 */
function readQuery(q: Record<string, string | string[] | undefined>): { page: number; category: BlogCategory | null } | null {
  let page = 1;
  if (q.page !== undefined) {
    if (typeof q.page !== "string" || !/^[1-9]\d{0,3}$/.test(q.page)) return null;
    page = Number(q.page);
    if (page > BLOG_MAX_PAGE) return null;
  }
  let category: BlogCategory | null = null;
  if (q.category !== undefined) {
    if (!isBlogCategory(q.category)) return null;
    category = q.category;
  }
  return { page, category };
}

export async function generateMetadata({ searchParams }: Search): Promise<Metadata> {
  const query = readQuery(await searchParams);
  if (!query) return { title: "Daily blog", robots: { index: false, follow: true } };
  const { page, category } = query;
  const title = `Daily blog${category ? `: ${BLOG_CATEGORY_LABEL[category]}` : ""}${page > 1 ? `, page ${page}` : ""}`;
  return {
    // a page of the list is its own page; a category is a filter of the same posts and is left out of search
    ...pageMeta({ title, description, path: blogListHref(page, category), index: category ? false : undefined }),
    alternates: { canonical: blogListHref(page, category), types: { "application/rss+xml": [FEED] } },
  };
}

export default async function BlogPage({ searchParams }: Search) {
  const query = readQuery(await searchParams);
  if (!query) notFound();
  const { page, category } = query;
  const result = await listPosts({ page, category });
  if (result.state === "out-of-range") notFound();

  return (
    <>
      <JsonLd
        data={{
          ...webPageSchema({ path: BLOG_PATH, name: "GIO4X daily blog", description, type: "Blog" }),
          "@id": `${absoluteUrl(BLOG_PATH)}#blog`,
          ...(result.state === "ok"
            ? {
                blogPost: result.posts.map((p) => ({
                  "@type": "BlogPosting",
                  headline: p.title,
                  url: absoluteUrl(blogPostHref(p.slug)),
                  datePublished: blogIso(p.published_at),
                  author: { "@type": "Organization", name: p.byline },
                })),
              }
            : {}),
        }}
      />
      <PageHero
        crumbs={[
          { name: "Intelligence", href: "/intelligence" },
          { name: "Daily blog", href: BLOG_PATH },
        ]}
        eyebrow="Daily blog"
        title="The daily blog"
        lead="Short notes from GIO4X’s desks, written and published by staff. They explain what happened or how something works. They are educational, and they are not advice or a recommendation to trade."
      />

      <section className="section-quiet" aria-labelledby="blog-posts">
        <div className="wrap">
          <h2 id="blog-posts" className="sr-only">
            {category ? `Posts in ${BLOG_CATEGORY_LABEL[category]}` : "Posts"}
            {page > 1 ? `, page ${page}` : ""}
          </h2>
          <BlogCategoryNav current={category} />
          <div className="mt-34">
            {result.state === "ok" ? (
              <BlogListView posts={result.posts} page={result.page} pages={result.pages} total={result.total} category={category} />
            ) : result.state === "none" ? (
              <BlogEmpty category={category} />
            ) : (
              <BlogUnavailable />
            )}
          </div>
          <p className="mt-34 flex flex-wrap gap-x-21 text-sm">
            <a href={FEED.url} className="link inline-flex min-h-[2.75rem] items-center" type="application/rss+xml">
              RSS feed
            </a>
            <Link href="/trust/editorial-standards" className="link inline-flex min-h-[2.75rem] items-center">
              Editorial standards
            </Link>
          </p>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Intelligence", label: "GIO4X Intelligence", href: "/intelligence", note: "Longer analysis, explainers and guides." },
          { kind: "Learn", label: "Academy", href: "/academy", note: "Lessons in order, from first principles." },
          { kind: "Daily", label: "Morning Room", href: "/morning-room", note: "Sessions, fixings and today’s reading." },
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "Every term, defined plainly." },
        ]}
      />
    </>
  );
}
