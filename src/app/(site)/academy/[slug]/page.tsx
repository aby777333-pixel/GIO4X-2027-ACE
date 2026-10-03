import { limericks } from "@/data/limericks";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lab } from "@/components/academy/labs";
import { LessonQuiz } from "@/components/academy/LessonQuiz";
import { LessonStory } from "@/components/academy/LessonStory";
import { storyChapters } from "@/components/academy/story-panels";
import { Dates, Reader, SideBlock } from "@/components/knowledge/Reader";
import { conceptSlugs, renderProse, shortDate } from "@/components/knowledge/prose";
import { resolveAll, resolveTools } from "@/components/markets/graph";
import { LinkRows } from "@/components/markets/LinkRows";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps } from "@/components/ui/Page";
import { absoluteUrl } from "@/config/site";
import { getLesson, getModule, lessons, lessonsOf, neighbours } from "@/data/academy";
import { labFor } from "@/data/academy-labs";
import { quizFor } from "@/data/academy-quiz";
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
  return pageMeta({ ownCard: true, title: `${l.title} | Academy`, description: l.description, path: `/academy/${l.slug}`, type: "article", publishedTime: l.published, modifiedTime: l.updated });
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
  // what follows the lesson text: an exercise (some lessons) and three questions (every lesson)
  const lab = labFor(l.slug);
  const questions = quizFor(l.slug);
  const toc = [...l.toc, ...(lab ? [{ id: "try-it", text: "Try it yourself" }] : []), ...(questions ? [{ id: "check", text: "Check what you have read" }] : [])];
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
        toc={toc}
        html={html}
        // the same HTML, cut at its headings: shown whole ("Read") or as chapters with a panel beside each ("Story")
        body={<LessonStory chapters={storyChapters(l.slug, html)} after={toc.slice(l.toc.length)} />}
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
        {lab && (
          <section aria-labelledby="try-it" className="no-print mt-55 scroll-mt-[calc(var(--header-h)+1.3125rem)] border-t border-line-strong pt-34">
            <p className="eyebrow">Try it yourself</p>
            <h2 id="try-it" className="h3 mt-13 scroll-mt-[calc(var(--header-h)+1.3125rem)]">
              {lab.title}
            </h2>
            <p className="mt-8 max-w-measure text-ink-2">{lab.intro}</p>
            <div className="mt-21">
              <Lab lab={lab.lab} />
            </div>
          </section>
        )}
        {questions && (
          <section aria-labelledby="check" className="no-print mt-55 border-t border-line-strong pt-34">
            <p className="eyebrow">Three questions</p>
            <h2 id="check" className="h3 mt-13 scroll-mt-[calc(var(--header-h)+1.3125rem)]">
              Check what you have read
            </h2>
            <p className="mt-8 max-w-measure text-ink-2">Each answer is in the lesson above. Nothing is timed or graded: when all three are answered correctly, this browser remembers the lesson as completed, and nothing is sent anywhere.</p>
            <div className="mt-21">
              <LessonQuiz slug={l.slug} questions={questions} />
            </div>
          </section>
        )}
        {limericks[l.slug] && (
          <section aria-labelledby="limerick" className="mt-55 border-t border-line-strong pt-34">
            <h2 id="limerick" className="eyebrow">
              The lesson, in a limerick
            </h2>
            <p className="gx-couplet mt-13 !mb-0">
              {limericks[l.slug].map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
          </section>
        )}
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
