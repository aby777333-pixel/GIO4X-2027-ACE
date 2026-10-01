import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisRows, liveSections, SectionNav, sectionHref } from "@/components/knowledge/intelligence";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { articlesBySection, sectionLabels, type ArticleSection } from "@/data/articles";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";
import "@/components/knowledge/knowledge.css";

type Params = { params: Promise<{ section: string }> };

export const dynamicParams = false;

/** Only sections that have articles exist as routes. */
export function generateStaticParams() {
  return liveSections.map((section) => ({ section }));
}

const isLive = (s: string): s is ArticleSection => (liveSections as string[]).includes(s);

const standfirst: Partial<Record<ArticleSection, string>> = {
  macro: "Central banks, policy and the economic data that sits behind exchange rates.",
  commodities: "Metals and energy as markets: what they are made of and what they respond to.",
  education: "How accounts, costs and decisions work, explained without the sales pitch.",
  risk: "Sizing, stops and the arithmetic of staying in the game.",
  technical: "Chart-reading tools, with how each is built and where it stops being useful.",
  forex: "Currency pairs and the forces behind them.",
  markets: "Market structure across asset classes.",
  crypto: "Digital assets as traded instruments.",
  platforms: "The software, described as it is.",
  gio4x: "The firm, in its own words.",
};

const describe = (s: ArticleSection) => `${sectionLabels[s]} in GIO4X Intelligence. ${standfirst[s] ?? ""}`.trim();

export async function generateMetadata({ params }: Params) {
  const { section } = await params;
  if (!isLive(section)) return {};
  return pageMeta({ title: `${sectionLabels[section]} | Intelligence`, description: describe(section), path: sectionHref(section) });
}

export default async function SectionPage({ params }: Params) {
  const { section } = await params;
  if (!isLive(section)) notFound();
  const items = articlesBySection(section);
  const others = liveSections.filter((s) => s !== section);
  const label = sectionLabels[section];

  return (
    <>
      <JsonLd data={webPageSchema({ path: sectionHref(section), name: `${label}: GIO4X Intelligence`, description: describe(section), type: "CollectionPage" })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Intelligence", href: "/intelligence" },
          { name: label, href: sectionHref(section) },
        ]}
        eyebrow="Intelligence · Section"
        title={label}
        lead={standfirst[section]}
      />
      <div className="wrap">
        <SectionNav current={section} />
      </div>

      <section className="section-quiet" aria-labelledby="section-list">
        <div className="wrap">
          <h2 id="section-list" className="sr-only">
            {label}: all pieces
          </h2>
          <p className="num text-xs text-ink-3">
            {items.length} {items.length === 1 ? "piece" : "pieces"}, newest first
          </p>
          <div className="mt-13">
            <AnalysisRows items={items} />
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="section-quiet hairline bg-paper" aria-labelledby="other-sections">
          <div className="wrap">
            <h2 id="other-sections" className="label">
              Other sections
            </h2>
            <ul className="mt-13 flex flex-wrap gap-x-34 gap-y-8">
              {others.map((s) => (
                <li key={s}>
                  <Link href={sectionHref(s)} className="h4 inline-flex min-h-[2.75rem] items-center transition-colors duration-fast hover:text-accent">
                    {sectionLabels[s]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <NextSteps
        items={[
          { kind: "Intelligence", label: "Front page", href: "/intelligence", note: "Today’s edition." },
          { kind: "Learn", label: "Academy", href: "/academy", note: "Lessons in order." },
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "Terms, defined plainly." },
        ]}
      />
    </>
  );
}
