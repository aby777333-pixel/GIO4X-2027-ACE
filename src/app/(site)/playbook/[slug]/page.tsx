import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayFigure } from "@/components/playbook/PlayFigure";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PrintButton } from "@/components/ui/PrintButton";
import { riskWarning } from "@/config/legal";
import { getTerm } from "@/data/glossary";
import { PLAYBOOK, getPlay } from "@/data/playbook";
import { pageMeta } from "@/lib/meta";
import { articleSchema, faqSchema } from "@/lib/schema";

/** the day these pages were written; changed when their words are */
const WRITTEN = "2026-10-04";

export const dynamicParams = false;
export function generateStaticParams() {
  return PLAYBOOK.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const play = getPlay((await params).slug);
  if (!play) return {};
  return pageMeta({ title: play.title, description: play.description, path: `/playbook/${play.slug}` });
}

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-34 border-t border-line pt-21">
      <h2 id={id} className="h4">
        {title}
      </h2>
      <div className="mt-13 max-w-measure text-ink-2">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: readonly string[] }) => (
  <ul className="grid gap-8">
    {items.map((x) => (
      <li key={x} className="grid grid-cols-[0.8125rem_1fr] gap-x-8">
        <span aria-hidden className="mt-[0.7em] h-px w-full bg-accent" />
        <span>{x}</span>
      </li>
    ))}
  </ul>
);

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const play = getPlay((await params).slug);
  if (!play) notFound();
  const path = `/playbook/${play.slug}`;
  const pattern = play.kind === "pattern";
  const terms = play.terms.map((s) => getTerm(s)).filter((t): t is NonNullable<typeof t> => !!t);
  const same = PLAYBOOK.filter((p) => p.kind === play.kind && p.slug !== play.slug);
  const at = PLAYBOOK.findIndex((p) => p.slug === play.slug);
  const others = [PLAYBOOK[(at + 1) % PLAYBOOK.length], same[at % same.length], same[(at + 3) % same.length]].filter((p, i, all) => p && p.slug !== play.slug && all.findIndex((q) => q.slug === p.slug) === i);

  return (
    <>
      <JsonLd data={articleSchema({ path, headline: play.title, description: play.description, datePublished: WRITTEN, author: "GIO4X Academy", section: pattern ? "Candlestick patterns" : "Trading situations", type: "TechArticle" })} />
      <JsonLd data={faqSchema([...play.faq])} />
      <PageHero
        quiet
        crumbs={[
          { name: "Academy", href: "/academy" },
          { name: "The Playbook", href: "/playbook" },
          { name: play.name, href: path },
        ]}
        eyebrow={pattern ? "Playbook · candlestick pattern" : "Playbook · when this happens"}
        title={play.title}
        lead={play.is}
      >
        <PrintButton className="btn btn-primary">Save this page as a PDF</PrintButton>
      </PageHero>

      <article className="section">
        <div className="wrap grid grid-cols-[minmax(0,1fr)] gap-34 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-55">
          <div className="min-w-0 lg:order-2">
            <div className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
              <div className="gx-stage">
                <PlayFigure play={play} />
                <p className="mt-8 text-xs text-ink-3">{pattern ? "The candles of the pattern are ringed." : "The moment is ringed."} An invented chart, drawn to show the shape. Not market data.</p>
              </div>
              <p className="no-print mt-13 text-sm text-ink-3">
                <span className="label mr-8">Also searched as</span>
                {play.also.join(" · ")}
              </p>
            </div>
          </div>

          <div className="min-w-0 lg:order-1">
            <section aria-labelledby="pb-see">
              <h2 id="pb-see" className="h4">
                {pattern ? `How to recognise ${/^[aeiou]/i.test(play.name) ? "an" : "a"} ${play.name.toLowerCase()}` : "What you see"}
              </h2>
              <div className="mt-13 max-w-measure text-ink-2">
                <List items={play.see} />
              </div>
            </section>
            <Block id="pb-said" title={pattern ? "What it is taken to mean" : "Why it happens"}>
              <p>{play.said}</p>
            </Block>
            <Block id="pb-check" title="What traders check next">
              <List items={play.check} />
            </Block>
            <Block id="pb-traps" title="Where people go wrong">
              <List items={play.traps} />
            </Block>
            <Block id="pb-faq" title="Questions people ask">
              <dl className="grid gap-21">
                {play.faq.map((f) => (
                  <div key={f.q}>
                    <dt className="font-medium text-ink">{f.q}</dt>
                    <dd className="mt-5">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </Block>
            {terms.length > 0 && (
              <Block id="pb-terms" title="The words on this page">
                <ul className="flex flex-wrap gap-8">
                  {terms.map((t) => (
                    <li key={t.slug}>
                      <Link href={`/glossary/${t.slug}`} className="btn btn-ghost btn-sm">
                        {t.term}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Block>
            )}
            <p className="mt-34 border-t border-line pt-13 text-sm text-ink-3">An explanation for study. It is not advice, a recommendation or a forecast, and a pattern or a situation described here says nothing certain about what a price will do next.</p>
          </div>
        </div>
      </article>

      <section className="section-quiet hairline" aria-label="Risk warning">
        <div className="wrap">
          <p className="text-sm text-ink-3">{riskWarning}</p>
        </div>
      </section>
      <NextSteps
        title="More from the Playbook"
        items={[...others.map((p) => ({ kind: p.kind === "pattern" ? "Pattern" : "Situation", label: p.name, href: `/playbook/${p.slug}`, note: p.also[0] })), { kind: "Playbook", label: "All patterns and situations", href: "/playbook", note: `${PLAYBOOK.length} pages.` }]}
      />
    </>
  );
}
