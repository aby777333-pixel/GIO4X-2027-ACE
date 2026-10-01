import Link from "next/link";
import { notFound } from "next/navigation";
import { Dates, Reader, SideBlock } from "@/components/knowledge/Reader";
import { conceptSlugs, renderProse, shortDate } from "@/components/knowledge/prose";
import { resolveAll, resolveTools } from "@/components/markets/graph";
import { LinkRows } from "@/components/markets/LinkRows";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps } from "@/components/ui/Page";
import { absoluteUrl } from "@/config/site";
import { getLesson, getModule, lessons, lessonsOf, neighbours } from "@/data/academy";
import { pageMeta } from "@/lib/meta";
import { articleSchema } from "@/lib/schema";

type Params = { params: Promise<{ slug: string }> };


export function generateStaticParams() {
  return lessons.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const l = getLesson(slug);
  if (!l) return {};
  return pageMeta({ title: `${l.title} | Academy`, description: l.description, path: `/academy/${l.slug}`, type: "article", publishedTime: l.published, modifiedTime: l.updated });
}

export default async function LessonPage({ params }: Params) {
  const { slug } = await params;
  const l = getLesson(slug);
  if (!l) notFound();

  const path = `/academy/${l.slug}`;
  const url = absoluteUrl(path);
  const mod = getModule(l.module);
  const inModule = mod ? lessonsOf(mod) : [];
  const position = inModule.findIndex((x) => x.slug === l.slug) + 1;
  const { prev, next } = neighbours(l);
  const { html } = renderProse(l.body, { prefer: conceptSlugs(l.related) });
  const tools = resolveTools(l.tools);
  const related = resolveAll(l.related)
    .filter((r) => r.kind !== "Concept")
    .slice(0, 4);
  const citation = `${l.byline} (${l.published.slice(0, 4)}). “${l.title}”. GIO4X Academy, ${shortDate(l.published)}${l.updated && l.updated !== l.published ? `, revised ${shortDate(l.updated)}` : ""}. ${url}`;

  return (
    <>
      <JsonLd data={articleSchema({ path, headline: l.title, description: l.description, datePublished: l.published, dateModified: l.updated, author: l.byline, section: mod?.title ?? "Academy", type: "Article" })} />
      <Reader
        crumbs={[
          { name: "Academy", href: "/academy" },
          { name: l.title, href: path },
        ]}
        kicker={
          <>
            <span>Lesson</span>
            <span aria-hidden>·</span>
            <span>{l.level}</span>
            {mod && (
              <>
                <span aria-hidden>·</span>
                <span>{mod.title}</span>
              </>
            )}
          </>
        }
        title={l.title}
        lead={l.description}
        meta={
          <>
            <span className="font-medium text-ink-2">{l.byline}</span>
            <Dates published={l.published} updated={l.updated} />
            <span className="num">{l.readMinutes} min read</span>
          </>
        }
        toc={l.toc}
        html={html}
        url={url}
        citation={citation}
        aside={
          <>
            {mod && inModule.length > 1 && (
              <SideBlock label={`In this module: ${mod.title}`}>
                <ol className="border-t border-line-strong">
                  {inModule.map((x, i) => (
                    <li key={x.slug} className="border-b border-line">
                      {x.slug === l.slug ? (
                        <span aria-current="page" className="grid min-h-[2.75rem] grid-cols-[1.625rem_1fr] items-baseline gap-x-8 py-8 text-sm font-medium text-ink">
                          <span className="num text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                          <span>
                            {x.title}
                            <span className="sr-only"> (this lesson)</span>
                          </span>
                        </span>
                      ) : (
                        <Link href={`/academy/${x.slug}`} className="grid min-h-[2.75rem] grid-cols-[1.625rem_1fr] items-baseline gap-x-8 py-8 text-sm text-ink-2 transition-colors duration-fast hover:text-accent">
                          <span className="num text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                          <span>{x.title}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              </SideBlock>
            )}
            {tools.length > 0 && (
              <SideBlock label="See it move">
                <LinkRows items={tools} />
              </SideBlock>
            )}
            {related.length > 0 && (
              <SideBlock label="Related markets">
                <LinkRows items={related} showKind />
              </SideBlock>
            )}
          </>
        }
      >
        {(prev || next) && (
          <nav aria-label="Lessons in this module" className="no-print mt-55 grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-2">
            {prev ? (
              <Link href={`/academy/${prev.slug}`} className="group bg-bg p-21 transition-colors duration-fast hover:bg-paper">
                <span className="label">Previous in this module</span>
                <span className="h4 mt-5 block transition-colors duration-fast group-hover:text-accent">{prev.title}</span>
              </Link>
            ) : (
              <span className="hidden bg-bg sm:block" />
            )}
            {next ? (
              <Link href={`/academy/${next.slug}`} className="group bg-bg p-21 transition-colors duration-fast hover:bg-paper sm:text-right">
                <span className="label">Next in this module</span>
                <span className="h4 mt-5 block transition-colors duration-fast group-hover:text-accent">{next.title}</span>
              </Link>
            ) : (
              <Link href="/academy#curriculum" className="group bg-bg p-21 transition-colors duration-fast hover:bg-paper sm:text-right">
                <span className="label">End of this module</span>
                <span className="h4 mt-5 block transition-colors duration-fast group-hover:text-accent">Back to the curriculum</span>
              </Link>
            )}
          </nav>
        )}
        {mod && position > 0 && (
          <p className="mt-13 text-xs text-ink-3">
            Lesson {position} of {inModule.length} in {mod.title}. A suggested order: nothing here is graded, timed or certified.
          </p>
        )}
      </Reader>
      <NextSteps
        items={[
          { kind: "Academy", label: "The curriculum", href: "/academy#curriculum", note: "All levels and modules." },
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "Every term in this lesson, defined." },
          { kind: "Practice", label: "Trader Toolkit", href: "/tools", note: "Work the numbers yourself." },
          { kind: "Read", label: "Intelligence", href: "/intelligence", note: "One idea at a time." },
        ]}
      />
    </>
  );
}
