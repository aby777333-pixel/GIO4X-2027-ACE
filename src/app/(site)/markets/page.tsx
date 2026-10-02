import Link from "next/link";
import { HeroCompanion } from "@/components/figures/markets/HeroCompanion";
import { SixDecks } from "@/components/figures/markets/SixDecks";
import { DayRibbon } from "@/components/markets/DayRibbon";
import { MarketOverviewPanel, TickerTapePanel } from "@/components/markets/MarketPanels";
import { NowAside } from "@/components/markets/Now";
import { RatesTable } from "@/components/markets/RatesTable";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { Head } from "@/components/markets/Head";
import { assetClasses, instrumentHref, instruments, instrumentsByClass } from "@/data/instruments";
import { centralBanks, econEvents } from "@/data/knowledge";
import { pageMeta } from "@/lib/meta";
import { getReferenceRates, RATE_CURRENCIES } from "@/lib/rates";
import { webPageSchema } from "@/lib/schema";
import { centres } from "@/lib/sessions";

const DESCRIPTION =
  "The GIO4X market overview: which sessions and exchanges are in regular hours, ECB reference fixings for the major currency pairs, and the structure of six asset classes. Sourced, dated and never presented as live.";

export const metadata = pageMeta({ title: "Market Command", description: DESCRIPTION, path: "/markets" });

// Reference fixings are refreshed hourly; the timetable is computed in the browser.
export const revalidate = 3600;

const desks = [
  {
    href: "/markets/clock",
    k: "Schedule",
    t: "World Market Clock",
    d: `${centres.length} financial centres with their state, local time and time to the next change, in the time zone you choose.`,
  },
  {
    href: "/markets/currency-strength",
    k: "Reference data",
    t: "Currency Strength",
    d: `How the ${RATE_CURRENCIES.length} major currencies have moved against each other over 1, 5, 21 and 63 ECB fixings. A description of the past, not a signal.`,
  },
  {
    href: "/markets/central-banks",
    k: "Institutions",
    t: "Central Bank Watch",
    d: `${centralBanks.length} central banks: who sets policy, with which instrument, under what mandate, and where each publishes its decisions.`,
  },
  {
    href: "/markets/events",
    k: "Explainers",
    t: "Economic Events",
    d: `${econEvents.length} scheduled releases explained: what each measures, how, and why markets commonly watch it.`,
  },
];

const absent = [
  { t: "Live quotes of its own", d: "GIO4X shows no streaming bid and ask prices. The only exchange rates it publishes here are the ECB’s daily reference fixings, labelled as such. The quote panels are TradingView’s." },
  { t: "A calendar of its own", d: "GIO4X lists no release dates, forecasts or outcomes itself. The dated calendar on the Economic Events page is TradingView’s, and the explainers link to each publisher’s own calendar." },
  { t: "Movers and rankings of its own", d: "GIO4X compiles no gainers, losers or heat lists: that would require a licensed real-time feed that is not connected. The heat maps on the asset-class pages are TradingView’s." },
];

export default async function MarketsPage() {
  const rates = await getReferenceRates();
  const fx = instrumentsByClass("forex");

  return (
    <>
      <JsonLd data={webPageSchema({ path: "/markets", name: "Market Command", description: DESCRIPTION, type: "CollectionPage" })} />
      <PageHero
        eyebrow="Markets"
        title="Market Command"
        lead={`One calm overview of ${assetClasses.length} asset classes and ${instruments.length} instruments: what is in session, where the major pairs last fixed, and how each market is built. Every figure carries its source and its date.`}
        aside={<NowAside />}
        companion={
          <HeroCompanion figure={<SixDecks decks={assetClasses.map((a) => ({ name: a.name, count: instrumentsByClass(a.key).length }))} />} label="Worth knowing">
            Where a licensed feed is not connected, these pages say so: nothing is estimated to fill a gap.{" "}
            <Link href="/trust/data-methodology" className="link">
              Data methodology
            </Link>
          </HeroCompanion>
        }
      >
        <a href="#asset-classes" className="btn btn-primary">
          Browse the markets
        </a>
        <Link href="/markets/clock" className="btn btn-ghost">
          World Market Clock
        </Link>
      </PageHero>

      {/* (b) the day, as a timetable */}
      <section className="section-quiet" aria-labelledby="day-title">
        <div className="wrap">
          <Head
            eyebrow="The market day"
            id="day-title" title={<>Twenty-four hours, four sessions.</>}
            lead="Foreign exchange passes from Sydney to Tokyo, London and New York. Where two session windows overlap, more participants are typically present at the same time."
            action={
              <Link href="/markets/clock" className="go py-13 md:py-0">
                Change the time zone
              </Link>
            }
          />
          <div className="mt-34">
            <DayRibbon id="command-ribbon" />
          </div>
        </div>
      </section>

      {/* (c) reference rates */}
      <section className="section hairline bg-paper" aria-labelledby="rates-title">
        <div className="wrap">
          <Head
            eyebrow="Reference rates"
            id="rates-title" title={<>Where the major pairs last fixed.</>}
            lead="The European Central Bank publishes one reference rate per currency each working day. They show where a pair stood and how far it has travelled. They are not prices you can trade."
            action={
              <Link href="/markets/currency-strength" className="go py-13 md:py-0">
                Currency strength
              </Link>
            }
          />
          <div className="mt-34">
            <RatesTable rates={rates} list={fx} />
          </div>
        </div>
      </section>

      {/* (c2) TradingView's overview: third party, loaded on request */}
      <section className="section hairline scroll-mt-[var(--header-h)]" id="third-party" aria-labelledby="overview-title">
        <div className="wrap">
          <Head
            eyebrow="Third-party view"
            id="overview-title"
            title={<>The markets now, as TradingView shows them.</>}
            lead="GIO4X does not publish its own live prices here. The panels below are TradingView’s, loaded at your request: a tape of seven widely followed symbols, and an overview of forex, indices, commodities and crypto."
            action={
              <Link href="/trust/data-methodology" className="go py-13 md:py-0">
                Data methodology
              </Link>
            }
          />
          <div className="mt-34 grid min-w-0 gap-21">
            <TickerTapePanel />
            <MarketOverviewPanel />
          </div>
        </div>
      </section>

      {/* (d) asset classes */}
      <section className="section hairline scroll-mt-[var(--header-h)]" id="asset-classes" aria-labelledby="classes-title">
        <div className="wrap">
          <Head eyebrow="Asset classes" id="classes-title" title={<>Six markets, each with its own structure.</>} lead="Open a class for how it is built and what is commonly monitored, or go straight to an instrument." />
          <ul className="mt-55 border-t border-line-strong">
            {assetClasses.map((a, n) => (
              <li key={a.key} className="grid gap-x-34 gap-y-8 border-b border-line py-21 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)]" data-reveal style={{ ["--i" as string]: n }}>
                <div>
                  <Link href={`/markets/${a.key}`} className="group inline-flex items-baseline gap-13">
                    <span className="num w-21 text-xs text-ink-3">{String(n + 1).padStart(2, "0")}</span>
                    <span className="h3 transition-colors duration-fast group-hover:text-accent">{a.name}</span>
                    <span className="go" aria-hidden />
                  </Link>
                  <p className="mt-5 max-w-[34rem] pl-34 text-sm text-ink-2">{a.line}</p>
                </div>
                <ul className="flex flex-wrap content-start gap-x-21 gap-y-3 pl-34 lg:pl-0 lg:pt-8" aria-label={`${a.name} instruments`}>
                  {instrumentsByClass(a.key).map((i) => (
                    <li key={i.slug}>
                      <Link href={instrumentHref(i)} className="link-quiet num inline-flex min-h-[2.75rem] items-center text-sm font-medium tracking-[0.02em] hover:text-accent" title={i.name}>
                        {i.symbol}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* (e) the four desks */}
      <section className="section hairline bg-paper" aria-labelledby="desks-title">
        <div className="wrap phi phi-r items-start">
          <div data-reveal>
            <p className="eyebrow">Go deeper</p>
            <h2 id="desks-title" className="h2 mt-13">
              Four desks behind the overview.
            </h2>
            <p className="lead mt-13 max-w-[30rem]">Time, relative movement, institutions and the releases they respond to. Each page explains its subject and names its sources.</p>
          </div>
          <ul className="border-t border-line-strong">
            {desks.map((d, n) => (
              <li key={d.href} className="border-b border-line" data-reveal style={{ ["--i" as string]: n }}>
                <Link href={d.href} className="group grid gap-x-21 gap-y-5 py-21 transition-colors duration-fast hover:bg-surface sm:grid-cols-[7.5rem_1fr_auto] sm:items-baseline sm:px-13">
                  <span className="label">{d.k}</span>
                  <span>
                    <span className="h4 block transition-colors duration-fast group-hover:text-accent">{d.t}</span>
                    <span className="mt-5 block max-w-measure text-sm text-ink-2">{d.d}</span>
                  </span>
                  <span className="go" aria-hidden>
                    Open
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* (f) what is not here */}
      <section className="section-quiet hairline" aria-labelledby="absent-title">
        <div className="wrap phi items-start">
          <div>
            <p className="eyebrow">Said plainly</p>
            <h2 id="absent-title" className="h3 mt-13 max-w-[22ch]">
              What GIO4X does not publish itself.
            </h2>
            <p className="mt-13 max-w-measure text-ink-2">
              GIO4X has no licensed market-data feed connected to this website. Until one is, GIO4X itself shows only what can be sourced: reference fixings, published conditions and timetables. Nothing is estimated to fill a gap. Panels from TradingView are third-party frames, loaded at your request and labelled as such.
            </p>
            <Link href="/trust/data-methodology" className="go mt-8 py-13 md:mt-21 md:py-0">
              Data methodology
            </Link>
          </div>
          <ul className="border-t border-line">
            {absent.map((x) => (
              <li key={x.t} className="border-b border-line py-13">
                <p className="flex items-center gap-8 font-medium">
                  <span aria-hidden className="h-px w-13 bg-ink-3" />
                  {x.t}
                </p>
                <p className="mt-3 pl-21 text-sm text-ink-3">{x.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Tools", label: "Trader Toolkit", href: "/tools", note: "Pip value, margin and position size, with the formulae shown." },
          { kind: "Trading", label: "Trading conditions", href: "/trading/conditions", note: "Spreads, leverage and lot sizes as published." },
          { kind: "Learn", label: "Glossary", href: "/glossary", note: "Every term used on these pages, defined." },
          { kind: "Account", label: "Open an account", href: "/open-account", note: "When you have read enough to decide." },
        ]}
      />
    </>
  );
}
