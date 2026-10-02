import Link from "next/link";
import { notFound } from "next/navigation";
import { SaveButton } from "@/components/desk/Buttons";
import { TermLinks } from "@/components/figures/company/TermLinks";
import { FigureNote } from "@/components/figures/Figure";
import { TermDiagram } from "@/components/glossary/diagrams/TermDiagram";
import { LearnCount, NextUnchecked } from "@/components/glossary/Progress";
import { TermQuiz } from "@/components/glossary/TermQuiz";
import { ReadRows } from "@/components/knowledge/Reader";
import { CopyButton } from "@/components/knowledge/Share";
import { firstSentence, resolveAll, resolveTools } from "@/components/markets/graph";
import { LinkRows } from "@/components/markets/LinkRows";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { absoluteUrl } from "@/config/site";
import { lessonsForTerm } from "@/data/academy";
import { articles } from "@/data/articles";
import { getTerm, glossary, relatedTerms } from "@/data/glossary";
import { getLesson, lessonCount } from "@/data/glossary-learn";
import { assetClasses, instruments } from "@/data/instruments";
import { econEvents } from "@/data/knowledge";
import { pageMeta } from "@/lib/meta";
import { definedTermSchema } from "@/lib/schema";
import "@/components/knowledge/knowledge.css";

type Params = { params: Promise<{ slug: string }> };


export function generateStaticParams() {
  return glossary.map((t) => ({ slug: t.slug }));
}

const metaDescription = (definition: string) => {
  const s = firstSentence(definition, 155);
  return s.length < 70 && definition.length > s.length ? `${definition.slice(0, 152).trimEnd()}…` : s;
};

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const t = getTerm(slug);
  if (!t) return {};
  return pageMeta({ ownCard: true, title: `${t.term}: definition | Glossary`, description: metaDescription(t.definition), path: `/glossary/${t.slug}` });
}

/** a step of working is often written "what: arithmetic"; the two are set apart as the tools set them */
function splitStep(step: string): { what: string | null; calc: string } {
  const at = step.indexOf(": ");
  return at > 0 && at < step.length - 2 ? { what: step.slice(0, at), calc: step.slice(at + 2) } : { what: null, calc: step };
}

const prose = "mt-8 max-w-measure text-[1.0625rem] leading-relaxed text-ink-2";

export default async function TermPage({ params }: Params) {
  const { slug } = await params;
  const t = getTerm(slug);
  if (!t) notFound();

  const path = `/glossary/${t.slug}`;
  const id = `c:${t.slug}`;
  const lesson = getLesson(t.slug);
  const related = relatedTerms(t, 6);
  const tools = resolveTools(t.tools ?? []);
  // markets that name this concept in their own data, or are this term (XAU/USD)
  const markets = resolveAll([
    ...instruments.filter((i) => i.slug === t.slug || i.related.includes(id)).map((i) => `i:${i.slug}`),
    ...econEvents.filter((e) => e.related.includes(id)).map((e) => `ev:${e.slug}`),
    ...assetClasses.filter((a) => a.related.glossary.includes(t.slug)).map((a) => `ac:${a.key}`),
  ]).slice(0, 5);
  const lessons = lessonsForTerm(t.slug, 2);
  const reads = articles.filter((a) => a.related.includes(id)).slice(0, 2);
  const at = glossary.findIndex((x) => x.slug === t.slug);
  const prev = glossary[at - 1];
  const next = glossary[at + 1];
  // the course goes on through the related terms that have a lesson of their own
  const onward = related.filter((r) => getLesson(r.slug)).map((r) => ({ slug: r.slug, term: r.term }));
  const [lede, ...rest] = t.definition.split(/(?<=[.!?])\s+(?=[A-Z])/);
  // rough heights, in pixels: the lists beside the definition, and the definition's own column without a lesson
  const beside = related.reduce((sum, r) => sum + (firstSentence(r.definition, 110).length > 56 ? 104 : 82), related.length ? 35 : 0) + (tools.length ? 60 + tools.length * 64 : 0) + (markets.length ? 60 + markets.length * 64 : 0);
  const body =
    110 +
    44 * Math.ceil(lede.length / 44) +
    (rest.length ? 21 + 29 * Math.ceil(rest.join(" ").length / 68) : 0) +
    (t.formula ? 150 : 0) +
    (t.example ? 150 : 0) +
    (lessons.length + reads.length ? 110 + (lessons.length + reads.length) * 100 : 0);
  // without a lesson, the reading aid under a short definition appears only where the lists beside it run well past it
  const roomy = !lesson && beside - body >= 360;
  // with a lesson the left column is the long one, and the lists keep it company while it scrolls: short lists hold under
  // the header; long ones scroll with the page until their last row is in view, then hold there
  const stick = !lesson ? "" : beside <= 520 ? "lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]" : "lg:sticky lg:bottom-21 lg:self-end";
  const example = lesson?.example && Array.isArray(lesson.example.steps) ? lesson.example : null;

  return (
    <>
      <JsonLd data={definedTermSchema({ path, term: t.term, definition: t.definition })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Glossary", href: "/glossary" },
          { name: t.term, href: path },
        ]}
        eyebrow={`Glossary · ${t.topic}`}
        title={t.term}
        aside={
          t.aliases && t.aliases.length > 0 ? (
            <p className="border-t border-line pt-13 text-sm text-ink-3">
              <span className="label mb-3 block">Also written</span>
              {t.aliases.join(" · ")}
            </p>
          ) : undefined
        }
      />

      <div className="wrap section-quiet">
        <div className="phi items-start">
          <article>
            <p className="font-display text-xl font-normal leading-snug text-ink lg:text-2xl">{lede}</p>
            {rest.length > 0 && <p className="mt-21 max-w-measure text-[1.0625rem] leading-relaxed text-ink-2">{rest.join(" ")}</p>}

            {lesson && (
              <section aria-labelledby="plain" className="mt-34">
                <h2 id="plain" className="eyebrow">
                  In plain words
                </h2>
                <p className={prose}>{lesson.plain}</p>
              </section>
            )}

            {t.formula && (
              <figure className="panel mt-34 max-w-measure p-21">
                <figcaption className="label">Formula</figcaption>
                <p className="num mt-8 font-display text-lg text-ink [overflow-wrap:anywhere]">{t.formula}</p>
              </figure>
            )}

            {lesson && (
              <section aria-labelledby="see-it-move" className="mt-55">
                <h2 id="see-it-move" className="eyebrow">
                  See it move
                </h2>
                <TermDiagram spec={lesson.diagram} caption={lesson.diagramCaption} className="mt-13" />
              </section>
            )}

            {lesson && (
              <section aria-labelledby="why" className="mt-55">
                <h2 id="why" className="eyebrow">
                  Why it matters
                </h2>
                <p className={prose}>{lesson.why}</p>
              </section>
            )}

            {example ? (
              <section aria-labelledby="example" className="mt-55 max-w-measure">
                <h2 id="example" className="eyebrow">
                  Worked example
                </h2>
                <p className="mt-5 text-xs text-ink-3">An example only. The figures are round and invented for the arithmetic: they are not market prices.</p>
                <p className="mt-13 text-[1.0625rem] leading-relaxed text-ink-2">{example.setup}</p>
                <ol className="mt-13 border-t border-line">
                  {example.steps.map((step, i) => {
                    const s = splitStep(step);
                    return (
                      <li key={i} className="grid grid-cols-[1.3125rem_minmax(0,1fr)] gap-x-8 border-b border-line py-13">
                        <span className="num pt-2 text-xs font-semibold text-prestige-ink">{i + 1}</span>
                        <span>
                          {s.what && <span className="block text-xs text-ink-3">{s.what}</span>}
                          <span className={`num block text-[0.9375rem] text-ink [overflow-wrap:anywhere] ${s.what ? "mt-2" : ""}`}>{s.calc}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-13 border-l border-accent pl-21 font-medium text-ink">{example.result}</p>
              </section>
            ) : (
              t.example && (
                <section aria-labelledby="example" className={`${lesson ? "mt-55" : "mt-34"} max-w-measure border-l border-accent pl-21`}>
                  <h2 id="example" className="label">
                    Worked example
                  </h2>
                  <p className="mt-8 text-ink-2">{t.example}</p>
                </section>
              )
            )}

            {lesson?.mistake && (
              <section aria-labelledby="mistake" className="mt-55">
                <h2 id="mistake" className="eyebrow">
                  A common mistake
                </h2>
                <p className={prose}>{lesson.mistake}</p>
              </section>
            )}

            {lesson && (
              <section aria-labelledby="check" className="mt-55">
                <h2 id="check" className="eyebrow">
                  Check yourself
                </h2>
                <TermQuiz slug={t.slug} quiz={lesson.quiz} />
                <LearnCount total={lessonCount} className="mt-13 max-w-measure" />
              </section>
            )}

            {(lessons.length > 0 || reads.length > 0) && (
              <section aria-labelledby="learn-more" className="mt-55">
                <h2 id="learn-more" className="eyebrow">
                  Learn more
                </h2>
                <ReadRows
                  className="mt-21"
                  items={[
                    ...lessons.map((l) => ({ href: `/academy/${l.slug}`, kicker: "Academy lesson", title: l.title, note: l.description })),
                    ...reads.map((a) => ({ href: `/intelligence/${a.slug}`, kicker: a.format, title: a.title, note: a.excerpt })),
                  ]}
                />
              </section>
            )}

            <div className="no-print mt-34 flex flex-wrap items-center gap-13">
              <SaveButton href={path} title={t.term} />
              <CopyButton text={absoluteUrl(path)} label="Copy link" done="Link copied" />
              <CopyButton text={`${t.term}: ${t.definition} (GIO4X Financial Glossary, ${absoluteUrl(path)})`} label="Copy definition" done="Definition copied" className="btn btn-quiet btn-sm" />
            </div>
            <p className="mt-21 max-w-measure text-xs text-ink-3">{educationalNote}</p>
            {roomy && (
              <FigureNote figure={<TermLinks />} label="How to read this page">
                The definition stands on its own. The lists beside it lead to the terms it leans on and, where there are any, to the tools that work it out and the markets where it matters.
              </FigureNote>
            )}
          </article>

          <aside aria-label="Connections" className={`grid gap-34 lg:border-l lg:border-line lg:pl-34 ${stick}`}>
            {related.length > 0 && (
              <section aria-labelledby="related-terms">
                <h2 id="related-terms" className="label">
                  Related terms
                </h2>
                <ul className="mt-13 border-t border-line-strong">
                  {related.map((r) => (
                    <li key={r.slug} className="border-b border-line">
                      <Link href={`/glossary/${r.slug}`} className="group block min-h-[2.75rem] py-13 transition-colors duration-fast hover:bg-[var(--brand-soft)]">
                        <span className="block font-medium text-ink transition-colors duration-fast group-hover:text-accent">{r.term}</span>
                        <span className="mt-2 block text-sm text-ink-3">{firstSentence(r.definition, 110)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {tools.length > 0 && (
              <section aria-labelledby="related-tools">
                <h2 id="related-tools" className="label">
                  Work it out
                </h2>
                <LinkRows items={tools} className="mt-13" />
              </section>
            )}
            {markets.length > 0 && (
              <section aria-labelledby="related-markets">
                <h2 id="related-markets" className="label">
                  Where it matters
                </h2>
                <LinkRows items={markets} showKind className="mt-13" />
              </section>
            )}
          </aside>
        </div>

        <nav aria-labelledby="next-term" className="no-print mt-55 border-t border-line pt-21">
          <h2 id="next-term" className={lesson ? "eyebrow" : "sr-only"}>
            Next term
          </h2>
          <div className={`grid gap-x-34 gap-y-13 text-sm sm:grid-cols-3 sm:items-start ${lesson ? "mt-13" : ""}`}>
            <div>
              {prev && (
                <Link href={`/glossary/${prev.slug}`} className="group block min-h-[2.75rem]">
                  <span className="label mb-3 block">
                    <span aria-hidden>← </span>Previous, A to Z
                  </span>
                  <span className="font-medium text-ink transition-colors duration-fast group-hover:text-accent">{prev.term}</span>
                </Link>
              )}
            </div>
            <div className="sm:text-center">
              {lesson && onward.length > 0 ? (
                <NextUnchecked candidates={onward} />
              ) : (
                <Link href={`/glossary#letter-${t.letter}`} className="label inline-flex min-h-[2.75rem] items-center">
                  All terms under {t.letter}
                </Link>
              )}
            </div>
            <div className="sm:text-right">
              {next && (
                <Link href={`/glossary/${next.slug}`} className="group block min-h-[2.75rem]">
                  <span className="label mb-3 block">
                    Next, A to Z<span aria-hidden> →</span>
                  </span>
                  <span className="font-medium text-ink transition-colors duration-fast group-hover:text-accent">{next.term}</span>
                </Link>
              )}
            </div>
          </div>
          {lesson && onward.length > 0 && (
            <p className="mt-13 text-sm sm:text-center">
              <Link href={`/glossary#letter-${t.letter}`} className="label inline-flex min-h-[2.75rem] items-center">
                All terms under {t.letter}
              </Link>
            </p>
          )}
        </nav>
      </div>

      <NextSteps
        items={[
          { kind: "Reference", label: "The whole glossary", href: "/glossary", note: `${glossary.length} terms, A to Z.` },
          { kind: "Learn", label: "Academy", href: "/academy", note: "The same ideas, in order." },
          { kind: "Practice", label: "Trader Toolkit", href: "/tools", note: "Calculators that show their formulae." },
        ]}
      />
    </>
  );
}
