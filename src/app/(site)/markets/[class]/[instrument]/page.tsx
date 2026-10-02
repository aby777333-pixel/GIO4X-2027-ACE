import Link from "next/link";
import { notFound } from "next/navigation";
import { WatchButton } from "@/components/desk/Buttons";
import { HeroCompanion } from "@/components/figures/markets/HeroCompanion";
import { InstrumentHelix } from "@/components/figures/markets/InstrumentHelix";
import { firstSentence, ofKind, ratePair, resolveAll, resolveTerms, resolveTools, toneStyle } from "@/components/markets/graph";
import { RelatedColumn } from "@/components/markets/LinkRows";
import { MarketDna } from "@/components/markets/MarketDna";
import { RatesUnavailable } from "@/components/markets/RatesTable";
import { ReferencePanel } from "@/components/markets/ReferencePanel";
import { TradingViewChart } from "@/components/markets/TradingViewChart";
import { JsonLd } from "@/components/seo/JsonLd";
import { Change, Sparkline } from "@/components/ui/Data";
import { DataNote, NextSteps, PageHero, SpecList } from "@/components/ui/Page";
import { educationalNote, indicativeNote, riskWarning } from "@/config/legal";
import { getAssetClass, getInstrument, instrumentHref, instruments, instrumentsByClass, type AssetClass, type Instrument } from "@/data/instruments";
import { pageMeta } from "@/lib/meta";
import { crossChange, crossRate, crossSeries, formatFixingDate, formatRate, getReferenceRates, RATES_SOURCE, type ReferenceRates } from "@/lib/rates";
import { webPageSchema } from "@/lib/schema";

type Params = { params: Promise<{ class: string; instrument: string }> };

export const revalidate = 3600;

export function generateStaticParams() {
  return instruments.map((i) => ({ class: i.class, instrument: i.slug }));
}

const describe = (i: Instrument, cls: AssetClass) => `${firstSentence(i.about, 200)} Structure, typical sessions, related central banks and events, and indicative ${cls.name.toLowerCase()} trading conditions at GIO4X.`;

export async function generateMetadata({ params }: Params) {
  const { class: key, instrument: slug } = await params;
  const i = getInstrument(key, slug);
  const cls = getAssetClass(key);
  if (!i || !cls) return {};
  return pageMeta({ ownCard: true, title: `${i.symbol}: ${i.name}`, description: describe(i, cls), path: instrumentHref(i) });
}

/** The hero's right-hand figure: the last ECB fixing where one exists, otherwise the published conditions. */
function HeroFigure({ i, cls, rates }: { i: Instrument; cls: AssetClass; rates?: ReferenceRates }) {
  const pair = ratePair(i);
  if (pair && rates?.status === "ok") {
    const [b, q] = pair;
    return (
      <aside aria-label="Last reference fixing" className="border-t-2 border-[var(--tone)] pt-13">
        <div className="flex items-baseline justify-between gap-13">
          <p className="label">Last reference fixing</p>
          <p className="num text-xs text-ink-3">{formatFixingDate(rates.date)}</p>
        </div>
        <div className="mt-13 flex items-end justify-between gap-21">
          <p className="num font-display text-4xl font-light leading-none tracking-[-0.02em]">{formatRate(crossRate(rates, b, q), q)}</p>
          <Sparkline values={crossSeries(rates, b, q).slice(-21)} width={144} height={34} className="mb-3 w-[38.2%] min-w-[5.5rem]" label={`${i.symbol} reference fixings, last 21 working days`} />
        </div>
        <p className="mt-13 flex items-baseline gap-8 text-sm text-ink-3">
          <Change value={crossChange(rates, b, q, 1)} className="font-medium" />
          <span>versus the previous fixing</span>
        </p>
        <DataNote className="mt-13 border-t border-line pt-13" status="reference" source="ECB" sourceHref={RATES_SOURCE.href}>
          A daily fixing, not a live or tradable price.
        </DataNote>
      </aside>
    );
  }
  const cells = [
    { k: "Spread from", v: i.conditions.spreadFrom, u: cls.spreadUnit },
    { k: "Leverage", v: i.conditions.leverage, u: "" },
    { k: "Min. lot", v: i.conditions.minLot, u: "" },
  ];
  return (
    <aside aria-label="Indicative conditions at a glance" className="border-t-2 border-[var(--tone)] pt-13">
      <p className="label">At a glance</p>
      <dl className="mt-13 grid grid-cols-3 border-l border-t border-line">
        {cells.map((c) => (
          <div key={c.k} className="border-b border-r border-line p-13">
            <dt className="label">{c.k}</dt>
            <dd className="num mt-8 font-display text-xl font-light sm:text-2xl">
              {c.v}
              {/* the space lets the unit drop below the figure when the cell is narrow, instead of touching its edge */}
              {c.u && (
                <span className="font-sans text-xs font-normal text-ink-3">
                  {" "}
                  {c.u}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <DataNote className="mt-13" status="indicative" source="GIO4X">
        Not a live quote.
      </DataNote>
    </aside>
  );
}

export default async function InstrumentPage({ params }: Params) {
  const { class: key, instrument: slug } = await params;
  const i = getInstrument(key, slug);
  const cls = getAssetClass(key);
  if (!i || !cls) notFound();

  const pair = ratePair(i);
  const rates = pair ? await getReferenceRates() : undefined;
  const siblings = instrumentsByClass(cls.key);
  const at = siblings.findIndex((s) => s.slug === i.slug);
  const prev = siblings[(at - 1 + siblings.length) % siblings.length];
  const next = siblings[(at + 1) % siblings.length];

  const concepts = ofKind(resolveAll(i.related), "Concept").map((c) => c.id.slice(2));
  const terms = resolveTerms([...new Set([...concepts, ...cls.related.glossary])]).slice(0, 6);
  const tools = resolveTools([...new Set([...cls.related.tools, "cost-lab", "profit-loss"])]).slice(0, 5);
  const night = cls.tone === "night";
  const path = instrumentHref(i);

  return (
    <div style={toneStyle(cls.key)}>
      <JsonLd data={webPageSchema({ path, name: `${i.symbol}: ${i.name}`, description: describe(i, cls) })} />
      <PageHero
        crumbs={[
          { name: "Markets", href: "/markets" },
          { name: cls.name, href: `/markets/${cls.key}` },
          { name: i.symbol, href: path },
        ]}
        eyebrow={cls.name}
        title={
          <>
            <span className="num block">{i.symbol}</span>
            <span className="sr-only">: </span>
            <span className="mt-8 block font-sans text-lg font-normal leading-snug tracking-normal text-ink-2">{i.name}</span>
          </>
        }
        lead={i.about}
        aside={<HeroFigure i={i} cls={cls} rates={rates} />}
        companion={
          <HeroCompanion figure={<InstrumentHelix />} label="Market DNA">
            Below, {i.symbol} is taken apart: its class, its contract, its hours and what is connected to it. Structure, not a signal.
          </HeroCompanion>
        }
        night={night}
      >
        <Link href="/open-account" className="btn btn-primary">
          Open an account
        </Link>
        <a href="#chart" className="btn btn-ghost">
          Chart
        </a>
        {/* keeps the instrument on My desk (/desk), in this browser only */}
        <WatchButton id={`${i.class}/${i.slug}`} symbol={i.symbol} />
      </PageHero>

      {/* Market DNA */}
      <section className="section" aria-labelledby="dna-title">
        <div className="wrap phi phi-r items-start">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2.125rem)]">
            <p className="eyebrow">Market DNA</p>
            <h2 id="dna-title" className="h2 mt-13">
              What {i.symbol} is made of.
            </h2>
            <p className="lead mt-13 max-w-[30rem]">Its class, its contract, the hours it lives in and the institutions, releases and ideas connected to it.</p>
            <p className="mt-21 max-w-[30rem] border-l-2 border-[var(--tone)] pl-13 text-sm text-ink-2">This is structure. It is not a score and it is not a signal: it tells you what the instrument is, not what it will do.</p>
          </div>
          <MarketDna instrument={i} cls={cls} />
        </div>
      </section>

      {/* reference fixings: currency pairs covered by the ECB only */}
      {pair && rates && (
        <section className="section hairline bg-paper" aria-labelledby="ref-title">
          <div className="wrap">
            <p className="eyebrow">Reference data</p>
            <h2 id="ref-title" className="h2 mt-13 max-w-[22ch]">
              Where {i.symbol} has fixed.
            </h2>
            <div className="mt-34">{rates.status === "ok" ? <ReferencePanel rates={rates} instrument={i} peers={instrumentsByClass("forex")} /> : <RatesUnavailable reason={rates.reason} />}</div>
          </div>
        </section>
      )}

      {/* conditions and chart */}
      <section className={`section hairline ${pair ? "" : "bg-paper"}`} aria-labelledby="conditions-title">
        <div className="wrap grid gap-34 lg:grid-cols-phi lg:gap-55">
          <div className="lg:order-2">
            <p className="eyebrow">Trading conditions</p>
            <h2 id="conditions-title" className="h3 mt-13">
              As published by GIO4X.
            </h2>
            <SpecList
              className="mt-21 border-t border-line-strong"
              rows={[
                { label: "Spread from", value: `${i.conditions.spreadFrom} ${cls.spreadUnit}`, note: "minimum, widens with market conditions" },
                { label: "Leverage", value: i.conditions.leverage, note: "depends on instrument and jurisdiction" },
                { label: "Minimum lot", value: i.conditions.minLot },
                { label: "Contract", value: <span className="font-normal">{i.contract}</span> },
                { label: "Platform symbol", value: i.code },
              ]}
            />
            <DataNote className="mt-13" status="indicative" source="GIO4X">
              {indicativeNote}
            </DataNote>
            <Link href="/trading/conditions" className="go mt-8 py-13 md:mt-21 md:py-0">
              All trading conditions
            </Link>
          </div>
          <div id="chart" className="scroll-mt-[calc(var(--header-h)+1.3125rem)] lg:order-1">
            <TradingViewChart symbol={i.symbol} tv={i.tv} name={i.name} />
          </div>
        </div>
      </section>

      {/* tools and glossary */}
      <section className={`section hairline ${pair ? "bg-paper" : ""}`} aria-labelledby="work-title">
        <div className="wrap">
          <p className="eyebrow">Before you trade it</p>
          <h2 id="work-title" className="h2 mt-13 max-w-[20ch]">
            Work the numbers. Know the words.
          </h2>
          <div className="mt-34 grid gap-34 lg:grid-cols-2 lg:gap-55">
            <RelatedColumn label="Tools" items={tools} more={{ href: "/tools", label: "All tools" }} />
            <RelatedColumn label="Glossary" items={terms} more={{ href: "/glossary", label: "Full glossary" }} />
          </div>
        </div>
      </section>

      {/* risk, in ordinary type */}
      <section className="section-quiet hairline" aria-labelledby="risk-title">
        <div className="wrap phi phi-r items-start">
          <h2 id="risk-title" className="h3">
            The risk, in ordinary type.
          </h2>
          <div className="max-w-measure">
            <p className="text-ink-2">{riskWarning}</p>
            <p className="mt-13 text-sm text-ink-3">
              {i.symbol} is traded on margin. {educationalNote}
            </p>
            <Link href="/legal/risk" className="go mt-8 py-13 md:mt-21 md:py-0">
              Risk disclosure
            </Link>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          ...(next.slug !== i.slug ? [{ kind: `Next in ${cls.name}`, label: next.symbol, href: instrumentHref(next), note: next.name }] : []),
          ...(prev.slug !== i.slug && prev.slug !== next.slug ? [{ kind: `Previous in ${cls.name}`, label: prev.symbol, href: instrumentHref(prev), note: prev.name }] : []),
          { kind: "Asset class", label: cls.name, href: `/markets/${cls.key}`, note: "Structure, hours and every instrument in the class." },
          { kind: "Platforms", label: "Compare platforms", href: "/platforms/compare", note: "MetaTrader 5 and 777 Raptor, side by side." },
        ]}
      />
    </div>
  );
}
