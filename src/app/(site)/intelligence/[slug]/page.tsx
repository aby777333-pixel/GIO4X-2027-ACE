import Link from "next/link";
import { notFound } from "next/navigation";
import { Dates, Reader, ReadRows, SideBlock } from "@/components/knowledge/Reader";
import { conceptSlugs, renderProse, shortDate } from "@/components/knowledge/prose";
import { ofKind, resolveAll } from "@/components/markets/graph";
import { LinkRows } from "@/components/markets/LinkRows";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps } from "@/components/ui/Page";
import { absoluteUrl } from "@/config/site";
import { articles, getArticle, relatedArticles, sectionLabels } from "@/data/articles";
import { pageMeta } from "@/lib/meta";
import { articleSchema } from "@/lib/schema";

type Params = { params: Promise<{ slug: string }> };


export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  return pageMeta({ title: a.title, description: a.description, path: `/intelligence/${a.slug}`, type: "article", publishedTime: a.published, modifiedTime: a.updated });
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();

  const path = `/intelligence/${a.slug}`;
  const url = absoluteUrl(path);
  const section = sectionLabels[a.section];
  const { html, linked } = renderProse(a.body, { prefer: conceptSlugs(a.related) });
  const graph = resolveAll(a.related);
  const markets = graph.filter((r) => r.kind !== "Concept").slice(0, 4);
  // concepts already linked in the text are not repeated beside it
  const concepts = ofKind(graph, "Concept")
    .filter((r) => !linked.some((t) => r.href.endsWith(`/${t.slug}`)))
    .slice(0, 4);
  const more = relatedArticles(a, 3);
  const year = a.published.slice(0, 4);
  const citation = `${a.byline} (${year}). “${a.title}”. GIO4X Intelligence, ${shortDate(a.published)}${a.updated && a.updated !== a.published ? `, revised ${shortDate(a.updated)}` : ""}. ${url}`;

  return (
    <>
      <JsonLd
        data={articleSchema({
          path,
          headline: a.title,
          description: a.description,
          datePublished: a.published,
          dateModified: a.updated,
          author: a.byline,
          section,
        })}
      />
      <Reader
        crumbs={[
          { name: "Intelligence", href: "/intelligence" },
          { name: section, href: `/intelligence/section/${a.section}` },
          { name: a.title, href: path },
        ]}
        kicker={
          <>
            <Link href={`/intelligence/section/${a.section}`} className="transition-colors duration-fast hover:text-ink">
              {section}
            </Link>
            <span aria-hidden>·</span>
            <span>{a.format}</span>
          </>
        }
        title={a.title}
        lead={a.excerpt}
        meta={
          <>
            <span className="font-medium text-ink-2">{a.byline}</span>
            <Dates published={a.published} updated={a.updated} />
            <span className="num">{a.readMinutes} min read</span>
          </>
        }
        notice={a.notice}
        brief={a.brief}
        toc={a.toc}
        html={html}
        url={url}
        citation={citation}
        aside={
          <>
            {markets.length > 0 && (
              <SideBlock label="Related markets">
                <LinkRows items={markets} showKind />
              </SideBlock>
            )}
            {concepts.length > 0 && (
              <SideBlock label="Terms in this piece">
                <LinkRows items={concepts} />
              </SideBlock>
            )}
          </>
        }
      >
        {more.length > 0 && (
          <section aria-labelledby="more-reading" className="no-print mt-55">
            <h2 id="more-reading" className="eyebrow">
              Keep reading
            </h2>
            <ReadRows className="mt-21" items={more.map((m) => ({ href: `/intelligence/${m.slug}`, kicker: m.format, title: m.title, note: `${sectionLabels[m.section]} · ${m.readMinutes} min read` }))} />
          </section>
        )}
      </Reader>
      <NextSteps
        items={[
          { kind: "Intelligence", label: "Today’s edition", href: "/intelligence", note: "The front page of the publication." },
          { kind: "Section", label: section, href: `/intelligence/section/${a.section}`, note: "Everything filed under this section." },
          { kind: "Academy", label: "Learn it in order", href: "/academy", note: "Lessons from first principles." },
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "Every term on this page, defined." },
        ]}
      />
    </>
  );
}
