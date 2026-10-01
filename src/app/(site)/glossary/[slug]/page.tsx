import Link from "next/link";
import { notFound } from "next/navigation";
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

export default async function TermPage({ params }: Params) {
  const { slug } = await params;
  const t = getTerm(slug);
  if (!t) notFound();

  const path = `/glossary/${t.slug}`;
  const id = `c:${t.slug}`;
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
  const [lede, ...rest] = t.definition.split(/(?<=[.!?])\s+(?=[A-Z])/);

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

            {t.formula && (
              <figure className="panel mt-34 max-w-measure p-21">
                <figcaption className="label">Formula</figcaption>
                <p className="num mt-8 font-display text-lg text-ink [overflow-wrap:anywhere]">{t.formula}</p>
              </figure>
            )}

            {t.example && (
              <section aria-labelledby="example" className="mt-34 max-w-measure border-l border-accent pl-21">
                <h2 id="example" className="label">
                  Worked example
                </h2>
                <p className="mt-8 text-ink-2">{t.example}</p>
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
              <CopyButton text={absoluteUrl(path)} label="Copy link" done="Link copied" />
              <CopyButton text={`${t.term}: ${t.definition} (GIO4X Financial Glossary, ${absoluteUrl(path)})`} label="Copy definition" done="Definition copied" className="btn btn-quiet btn-sm" />
            </div>
            <p className="mt-21 max-w-measure text-xs text-ink-3">{educationalNote}</p>
          </article>

          <aside aria-label="Connections" className="grid gap-34 lg:border-l lg:border-line lg:pl-34">
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

        <nav aria-label="Neighbouring terms" className="no-print mt-55 flex items-baseline justify-between gap-21 border-t border-line pt-21 text-sm">
          {prev ? (
            <Link href={`/glossary/${prev.slug}`} className="link-quiet inline-flex min-h-[2.75rem] items-center">
              <span aria-hidden className="mr-8">
                ←
              </span>
              {prev.term}
            </Link>
          ) : (
            <span />
          )}
          <Link href={`/glossary#letter-${t.letter}`} className="label hidden sm:block">
            All terms under {t.letter}
          </Link>
          {next ? (
            <Link href={`/glossary/${next.slug}`} className="link-quiet inline-flex min-h-[2.75rem] items-center text-right">
              {next.term}
              <span aria-hidden className="ml-8">
                →
              </span>
            </Link>
          ) : (
            <span />
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
