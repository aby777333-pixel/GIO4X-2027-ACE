import Link from "next/link";
import { notFound } from "next/navigation";
import { ClassCompanion } from "@/components/figures/markets/ClassCompanion";
import { ClassAside, ClassNav } from "@/components/markets/ClassAside";
import { resolveEvents, resolveTerms, resolveTools, toneStyle } from "@/components/markets/graph";
import { InstrumentTable } from "@/components/markets/InstrumentTable";
import { RelatedColumn } from "@/components/markets/LinkRows";
import { ClassPanels } from "@/components/markets/MarketPanels";
import { InTheRound } from "@/components/markets/round/InTheRound";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { Head } from "@/components/markets/Head";
import { assetClasses, getAssetClass, instrumentsByClass } from "@/data/instruments";
import { pageMeta } from "@/lib/meta";
import { getReferenceRates, isRateCurrency } from "@/lib/rates";
import { webPageSchema } from "@/lib/schema";

type Params = { params: Promise<{ class: string }> };

export const revalidate = 3600;

export function generateStaticParams() {
  return assetClasses.map((a) => ({ class: a.key }));
}

const describe = (name: string, line: string) => `${name} at GIO4X. ${line} How the market is structured, what is commonly monitored, typical hours and indicative trading conditions for each instrument.`;

export async function generateMetadata({ params }: Params) {
  const { class: key } = await params;
  const cls = getAssetClass(key);
  if (!cls) return {};
  return pageMeta({ title: `${cls.name} markets`, description: describe(cls.name, cls.line), path: `/markets/${cls.key}` });
}

export default async function AssetClassPage({ params }: Params) {
  const { class: key } = await params;
  const cls = getAssetClass(key);
  if (!cls) notFound();

  const list = instrumentsByClass(cls.key);
  const needsRates = list.some((i) => isRateCurrency(i.base) && isRateCurrency(i.quote));
  const rates = needsRates ? await getReferenceRates() : undefined;

  const terms = resolveTerms(cls.related.glossary);
  const tools = resolveTools(cls.related.tools);
  const events = resolveEvents(cls.related.events);
  const index = assetClasses.findIndex((a) => a.key === cls.key);
  const next = assetClasses[(index + 1) % assetClasses.length];
  const night = cls.tone === "night";

  return (
    <div style={toneStyle(cls.key)}>
      <JsonLd data={webPageSchema({ path: `/markets/${cls.key}`, name: `${cls.name} markets`, description: describe(cls.name, cls.line), type: "CollectionPage" })} />
      <PageHero
        crumbs={[
          { name: "Markets", href: "/markets" },
          { name: cls.name, href: `/markets/${cls.key}` },
        ]}
        eyebrow={`Asset class ${String(index + 1).padStart(2, "0")} of ${String(assetClasses.length).padStart(2, "0")}`}
        title={cls.name}
        lead={cls.line}
        aside={<ClassAside cls={cls} list={list} />}
        companion={<ClassCompanion cls={cls} list={list} />}
        night={night}
      >
        <a href="#instruments" className="btn btn-primary">
          {list.length} instruments
        </a>
        <Link href="/trading/conditions" className="btn btn-ghost">
          Trading conditions
        </Link>
      </PageHero>
      <ClassNav classes={assetClasses} current={cls.key} />

      {/* what it is, how it is structured */}
      <section className="section" aria-labelledby="what-title">
        <div className="wrap phi items-start">
          <div>
            <p className="eyebrow">The market</p>
            <h2 id="what-title" className="h2 mt-13 max-w-[18ch]">
              What it is.
            </h2>
            <p className="lead mt-21 max-w-measure text-ink">{cls.summary}</p>
            <div className="mt-34 border-l-2 border-[var(--tone)] pl-21">
              <h3 className="label">How it is structured at GIO4X</h3>
              <p className="mt-8 max-w-measure text-ink-2">{cls.structure}</p>
            </div>
          </div>
          <div className="lg:pt-55">
            <h3 className="label">Commonly monitored</h3>
            <ol className="mt-13 border-t border-line-strong">
              {cls.drivers.map((d, n) => (
                <li key={d} className="grid grid-cols-[2.125rem_1fr] gap-x-8 border-b border-line py-13">
                  <span className="num pt-2 text-xs font-semibold text-[var(--tone)]">{String(n + 1).padStart(2, "0")}</span>
                  <span className="text-ink">{d}</span>
                </li>
              ))}
            </ol>
            <p className="mt-13 text-xs text-ink-3">Factors market participants commonly follow for this asset class. A description of practice, not a view on where prices will go.</p>
            <h3 className="label mt-34">Hours</h3>
            <p className="mt-8 text-ink-2">{cls.hours}</p>
            <Link href="/markets/clock" className="go py-13 md:mt-13 md:py-0">
              World Market Clock
            </Link>
          </div>
        </div>
      </section>

      {/* the class as one object that can be turned, with facts from this page pinned to it */}
      <InTheRound cls={cls} list={list} />

      {/* instruments */}
      <section className="section hairline scroll-mt-[var(--header-h)] bg-paper" id="instruments" aria-labelledby="instruments-title">
        <div className="wrap">
          <Head
            eyebrow="Instruments"
            id="instruments-title" title={<>{cls.name}, instrument by instrument.</>}
            lead={`Spreads are quoted in ${cls.spreadUnit} and are minimums. Each row opens the instrument’s own page.`}
          />
          <div className="mt-34">
            <InstrumentTable cls={cls} list={list} rates={rates} />
          </div>
        </div>
      </section>

      {/* TradingView's panels for this class: third party, loaded on request */}
      <ClassPanels cls={cls.key} name={cls.name} />

      {/* related */}
      <section className="section hairline" aria-labelledby="related-title">
        <div className="wrap">
          <Head eyebrow="Understand it" id="related-title" title={<>The terms, the tools and the releases.</>} />
          <div className="mt-34 grid gap-34 lg:grid-cols-3 lg:gap-55">
            <RelatedColumn label="Glossary" items={terms} more={{ href: "/glossary", label: "Full glossary" }} />
            <RelatedColumn label="Tools" items={tools} more={{ href: "/tools", label: "All tools" }} />
            <RelatedColumn label="Economic events" items={events} more={{ href: "/markets/events", label: "All events" }} />
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Next class", label: next.name, href: `/markets/${next.key}`, note: next.line },
          { kind: "Trading", label: "Account types", href: "/trading/accounts", note: "How spreads and commission differ between accounts." },
          { kind: "Risk", label: "Risk disclosure", href: "/legal/risk", note: "Leveraged products can lose money quickly." },
          { kind: "Overview", label: "Market Command", href: "/markets", note: "Sessions, reference rates and all six classes." },
        ]}
      />
    </div>
  );
}
