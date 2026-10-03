import { PunchLine } from "@/components/ui/PunchLine";
import Link from "next/link";
import { Constellation, STAGE_COMPACT } from "@/components/labs/Constellation";
import { DotsDiagram } from "@/components/labs/DotsDiagram";
import { KindMark } from "@/components/labs/glyph";
import { computeLayout } from "@/components/labs/layout";
import { EXAMPLE_PICKS, picksQuery } from "@/components/labs/picks";
import { MarketDayStill } from "@/components/labs/market-day/MarketDayStill";
import { TradeStill } from "@/components/labs/trade-anatomy/TradeStill";
import { SimulatorStill } from "@/components/labs/simulator/Still";
import { Forge } from "@/components/labs/workshop/Forge";
import { OrderBookStill } from "@/components/labs/order-book-3d/OrderBookStill";
import { SessionGlobeStill } from "@/components/labs/session-globe/SessionGlobeStill";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { Tabs } from "@/components/ui/Tabs";
import { connect, graphStats, KIND_LABEL, KIND_ORDER } from "@/data/graph";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "GIO4X Labs",
  description:
    "GIO4X Labs is where experiments live, apart from the core brokerage pages: the Market Universe, an explorable knowledge graph; Connect the Dots, which explains how markets, institutions and concepts are related; Trade Anatomy; One day of markets; a practice desk on invented prices; a globe of the four FX sessions; and a 3D illustration of an order book.",
  path: "/labs",
});

const heroLayout = computeLayout("i:xau-usd", STAGE_COMPACT);
const fedLayout = computeLayout("cb:fed", STAGE_COMPACT);
// what the picture beside the tabs actually contains, read from the same layout that draws it
const heroFocus = heroLayout.index.get(heroLayout.focus)?.node;
const heroRing = heroLayout.ring1.map((id) => heroLayout.index.get(id)?.node).filter((n) => n !== undefined);
const heroKinds = KIND_ORDER.filter((k) => k === heroFocus?.kind || heroRing.some((n) => n.kind === k));
const example = connect(EXAMPLE_PICKS);

const rules = [
  { n: "01", t: "Deterministic.", d: "Everything in Labs today is ordinary software over curated data. No language model writes or ranks anything, and the same input always gives the same output." },
  { n: "02", t: "Explanatory, never predictive.", d: "An experiment may show how things are connected or how something works. It may not score, signal, forecast or suggest a trade." },
  { n: "03", t: "No data we are not licensed to show.", d: "If an idea needs prices or history that GIO4X has no licence to publish, it stays on the bench until that changes." },
];

/** Ideas, not products. Each line says what would have to exist first. */
const bench = [
  { name: "Time Machine", what: "Step back through a past trading day and see sessions, releases and decisions in the order they happened.", needs: "Needs a licensed archive of historical prices and a dated record of releases; GIO4X has neither connected to this site." },
  { name: "Macro Weather", what: "A regional map of the economic climate, drawn from official statistics rather than opinion.", needs: "Needs a maintained pipeline from each statistical agency, with the reuse terms of every series checked before it is shown." },
  { name: "Research Canvas", what: "A private board for pinning instruments, events and notes, with the graph drawing the lines between them.", needs: "Needs no market data, but does need saved workspaces that stay in your browser and a design for them; that work has not started." },
  { name: "Market Sonification", what: "A price series rendered as sound, for listening to the shape of a session.", needs: "Needs a licensed intraday data feed, and an audio design that never plays without being asked." },
];

export default function LabsPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "Labs", href: "/labs" }]}
        eyebrow="GIO4X Labs"
        title="Experiments, kept apart on purpose."
        lead="Labs is where GIO4X tries other ways of seeing markets. Experiments live here so that the core site stays calm: accounts, conditions and disclosures do not move because an idea did."
        aside={
          <div className="cx-wide grid gap-34 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-55">
            <figure className="mx-auto w-full max-w-[26rem]">
              <Constellation layout={heroLayout} cfg={STAGE_COMPACT} ground="var(--bg)" />
              <figcaption className="mt-8 text-center text-xs text-ink-3">Gold and what it is documented as related to. A still from the Market Universe.</figcaption>
            </figure>
            <Tabs
              label="About this picture"
              minHeight="19rem"
              tabs={[
                {
                  key: "shows",
                  label: "What it shows",
                  content: (
                    <>
                      <p className="max-w-measure text-sm text-ink-2">
                        {heroFocus?.label ?? "Gold"} sits at the centre. On the first ring are the {heroRing.length} things this site documents it as directly related to; the outer ring holds what those are related to in turn.
                      </p>
                      <ul className="mt-13 grid gap-x-21 border-t border-line sm:grid-cols-2">
                        {heroRing.map((n) => (
                          <li key={n.id} className="border-b border-line">
                            <Link href={n.href} className="flex min-h-[2.75rem] items-center gap-8 py-5 text-sm text-ink transition-colors duration-fast hover:text-accent">
                              <KindMark kind={n.kind} />
                              <span className="min-w-0 truncate">{n.label}</span>
                              <span className="ml-auto shrink-0 text-xs text-ink-3">{KIND_LABEL[n.kind].one}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  ),
                },
                {
                  key: "read",
                  label: "How to read it",
                  content: (
                    <>
                      <p className="max-w-measure text-sm text-ink-2">Each kind of thing has its own shape, so the picture can be read without colour. A line means the site documents a relationship between the two; it does not say how strong it is or which way it runs.</p>
                      <ul className="mt-13 grid gap-x-21 border-t border-line sm:grid-cols-2">
                        {heroKinds.map((k) => (
                          <li key={k} className="flex min-h-[2.75rem] items-center gap-8 border-b border-line py-5 text-sm text-ink">
                            <KindMark kind={k} />
                            {KIND_LABEL[k].one}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-13 text-xs text-ink-3">
                        The whole graph holds <span className="num">{graphStats.nodes}</span> nodes and <span className="num">{graphStats.edges}</span> relations, built from the pages and reference data of this site.
                      </p>
                    </>
                  ),
                },
                {
                  key: "not",
                  label: "What it is not",
                  content: (
                    <>
                      <ul className="grid gap-13 text-sm text-ink-2">
                        <li className="border-l border-accent pl-13">Not a forecast. It describes how things are connected, not how prices will move.</li>
                        <li className="border-l border-accent pl-13">Not live. There are no prices, rates or volumes in it, and nothing in it changes during the trading day.</li>
                        <li className="border-l border-accent pl-13">Not advice. A line between gold and the dollar is a documented relationship, not a reason to trade either.</li>
                      </ul>
                      <p className="mt-21 flex flex-wrap gap-x-21 gap-y-8">
                        <Link href="/labs/market-universe" className="go">
                          Open the full map
                        </Link>
                        <Link href="/labs/connect-the-dots" className="go">
                          Connect the Dots
                        </Link>
                      </p>
                    </>
                  ),
                },
              ]}
            />
          </div>
        }
      >
        <Link href="/labs/market-universe" className="btn btn-primary">
          Enter the Market Universe
        </Link>
        <Link href="/labs/connect-the-dots" className="btn btn-ghost">
          Connect the Dots
        </Link>
      </PageHero>

      {/* what exists */}
      <section className="section" aria-labelledby="labs-open">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-21">
            <div>
              <p className="eyebrow">Open now</p>
              <h2 id="labs-open" className="h2 mt-13">
                Seven experiments.
              </h2>
            </div>
            <p className="max-w-[34rem] text-ink-2">
              The first two are views of the same thing: the GIO4X Graph, which today holds <span className="num">{graphStats.nodes}</span> nodes and <span className="num">{graphStats.edges}</span> relations, built from the pages and reference data of this site. The other five stand on their own: one order followed to its settlement, one day of sessions, a practice desk on invented prices, and two models you can turn: the four FX sessions on a globe, and the layout of an order book.
            </p>
          </div>

          <article className="mt-55 grid gap-34 border-t border-line-strong pt-34 lg:grid-cols-phi lg:items-center lg:gap-55">
            <Link href="/labs/market-universe" aria-hidden tabIndex={-1} className="grid-field block overflow-hidden rounded border border-line bg-paper">
              <div className="mx-auto max-w-[34rem]">
                <Constellation layout={fedLayout} cfg={STAGE_COMPACT} />
              </div>
            </Link>
            <div>
              <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">01</p>
              <h3 className="h2 mt-8">Market Universe</h3>
              <p className="lead mt-13">An explorable constellation. Choose a node (gold, the yen, the Federal Reserve, inflation, leverage) and the map reorganises around it, showing what it is related to and in what way.</p>
              <p className="mt-13 max-w-measure text-ink-2">Every view has its own address, so a path through the graph can be shared or retraced with the Back button. It works from the keyboard and reads as a plain list without the drawing.</p>
              <Link href="/labs/market-universe" className="go mt-21">
                Open Market Universe
              </Link>
            </div>
          </article>

          <article className="mt-55 grid gap-34 border-t border-line pt-34 lg:grid-cols-phi-r lg:items-center lg:gap-55">
            <div>
              <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">02</p>
              <h3 className="h2 mt-8">Connect the Dots</h3>
              <p className="lead mt-13">Pick two to five things and read how they connect, one relation per sentence, with every name linked to its page.</p>
              <blockquote className="mt-21 max-w-measure border-l border-accent pl-21 text-ink-2">
                {example.chain.map((h) => h.sentence).join(" ")}
              </blockquote>
              <p className="mt-8 text-xs text-ink-3">The actual output for gold, the US dollar, the Federal Reserve and CPI. No language model is involved.</p>
              <Link href={`/labs/connect-the-dots${picksQuery(EXAMPLE_PICKS)}`} className="go mt-21">
                Open Connect the Dots
              </Link>
            </div>
            <Link href="/labs/connect-the-dots" aria-hidden tabIndex={-1} className="grid-field order-first block overflow-hidden rounded border border-line bg-paper lg:order-none">
              <div className="mx-auto max-w-[30rem]">
                <DotsDiagram connection={example} />
              </div>
            </Link>
          </article>

          <article className="mt-55 grid gap-34 border-t border-line pt-34 lg:grid-cols-phi lg:items-center lg:gap-55">
            <Link href="/labs/trade-anatomy" aria-hidden tabIndex={-1} className="block overflow-hidden rounded border border-line">
              <TradeStill />
            </Link>
            <div>
              <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">03</p>
              <h3 className="h2 mt-8">Trade Anatomy</h3>
              <p className="lead mt-13">One order followed through the seven stages of its life: the ticket, the checks, routing, the fill, the open position, the close and settlement into the balance.</p>
              <p className="mt-13 max-w-measure text-ink-2">This one is not a view of the graph. It is a walkthrough of general mechanics, with the branches where an order’s path can change and what can go wrong at each stage. It holds no prices, and it reads in full without the animation.</p>
              <Link href="/labs/trade-anatomy" className="go mt-21">
                Open Trade Anatomy
              </Link>
            </div>
          </article>

          <article className="mt-55 grid gap-34 border-t border-line pt-34 lg:grid-cols-phi-r lg:items-center lg:gap-55">
            <div>
              <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">04</p>
              <h3 className="h2 mt-8">One day of markets</h3>
              <p className="lead mt-13">Twenty-four hours of UTC as a two-minute film you can scrub: the line between night and day crossing a globe, and nine financial centres opening and closing in turn.</p>
              <p className="mt-13 max-w-measure text-ink-2">It is drawn from the regular timetables and the position of the sun, and from nothing else: no prices and no measure of activity. Seven chapters carry the day in words, so it reads in full without the animation.</p>
              <Link href="/labs/market-day" className="go mt-21">
                Open One day of markets
              </Link>
            </div>
            <Link href="/labs/market-day" aria-hidden tabIndex={-1} className="order-first block overflow-hidden rounded border border-line lg:order-none">
              <MarketDayStill />
            </Link>
          </article>

          <article className="mt-55 grid gap-34 border-t border-line pt-34 lg:grid-cols-phi lg:items-center lg:gap-55">
            <Link href="/labs/simulator" aria-hidden tabIndex={-1} className="block overflow-hidden rounded border border-line bg-paper">
              <SimulatorStill />
            </Link>
            <div>
              <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">05</p>
              <h3 className="h2 mt-8">Practice desk</h3>
              <p className="lead mt-13">A trading simulation on invented prices: place, manage and close example positions to learn the mechanics, with the arithmetic of every fill, charge and close shown.</p>
              <p className="mt-13 max-w-measure text-ink-2">Not a view of the graph, and not a market. The price is a seeded random walk made in your browser, the instrument and the account are examples, and the settings are made up for practice: they are not GIO4X’s trading conditions.</p>
              <Link href="/labs/simulator" className="go mt-21">
                Open the Practice desk
              </Link>
            </div>
          </article>

          <article className="mt-55 grid gap-34 border-t border-line pt-34 lg:grid-cols-phi-r lg:items-center lg:gap-55">
            <div>
              <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">06</p>
              <h3 className="h2 mt-8">Session globe</h3>
              <p className="lead mt-13">A globe you can turn, showing which of the four FX sessions (Sydney, Tokyo, London, New York) are open at this minute, and the line between day and night.</p>
              <p className="mt-13 max-w-measure text-ink-2">It is worked out from your clock and the conventional session windows, and from nothing else: a schedule, not a data feed. The same reading stands beside it as a plain list, and a flat map takes the globe’s place where 3D is not available.</p>
              <Link href="/labs/session-globe" className="go mt-21">
                Open the Session globe
              </Link>
            </div>
            <Link href="/labs/session-globe" aria-hidden tabIndex={-1} className="order-first block overflow-hidden rounded border border-line bg-paper p-13 lg:order-none">
              <SessionGlobeStill />
            </Link>
          </article>

          <article className="mt-55 grid gap-34 border-t border-line pt-34 lg:grid-cols-phi lg:items-center lg:gap-55">
            <Link href="/labs/order-book-3d" aria-hidden tabIndex={-1} className="block overflow-hidden rounded border border-line bg-paper p-13">
              <OrderBookStill />
            </Link>
            <div>
              <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">07</p>
              <h3 className="h2 mt-8">Order book in 3D</h3>
              <p className="lead mt-13">A model you can turn that explains how an order book is laid out: bids, asks, the spread between them, depth, and how a market order walks the book.</p>
              <p className="mt-13 max-w-measure text-ink-2">An illustration, not market data. Its shapes come from a generator with a fixed seed, so it is the same on every visit; it holds no prices and no quantities, and its six readings stand in full as text.</p>
              <Link href="/labs/order-book-3d" className="go mt-21">
                Open the Order book in 3D
              </Link>
            </div>
          </article>

          <article className="mt-55 grid gap-34 border-t border-line pt-34 lg:grid-cols-phi lg:items-center lg:gap-55">
            <div>
              <Forge controls={false} />
            </div>
            <div>
              <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">08</p>
              <h3 className="h2 mt-8">The Workshop</h3>
              <p className="lead mt-13">Four small machines, one idea each: a candle forged from its four prices, leverage walked on a tightrope, a hidden candle to guess, and reels that work out what a pip is worth.</p>
              <p className="mt-13 max-w-measure text-ink-2">Everything in them is invented. There is no market data, nothing to win and nothing kept.</p>
              <Link href="/labs/workshop" className="go mt-21">
                Open the Workshop
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* house rules */}
      <section className="section hairline bg-paper" aria-labelledby="labs-rules">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">House rules</p>
            <h2 id="labs-rules" className="h2 mt-13">
              Curious is not the same as careless.
            </h2>
            <p className="mt-21 max-w-narrow text-ink-2">Labs is allowed to be unfinished. It is not allowed to be misleading. Three rules apply to everything here.</p>
          </div>
          <ol className="border-t border-line">
            {rules.map((r) => (
              <li key={r.n} className="grid grid-cols-[3.4375rem_1fr] gap-x-13 border-b border-line py-21">
                <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{r.n}</span>
                <div>
                  <h3 className="h4">{r.t}</h3>
                  <p className="mt-8 max-w-measure text-ink-2">{r.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* not built */}
      <section className="section" aria-labelledby="labs-bench">
        <div className="wrap">
          <div className="phi items-end">
            <div>
              <p className="eyebrow">On the bench</p>
              <h2 id="labs-bench" className="h2 mt-13">
                Ideas that are not built.
              </h2>
            </div>
            <p className="text-ink-2">These four are concepts only. None of them exists, none has a date, and each is waiting on something specific. They are listed so you can see what Labs is considering, and why it has not shipped.</p>
          </div>
          <ul className="mt-34 border-t border-line-strong">
            {bench.map((b) => (
              <li key={b.name} className="grid gap-x-34 gap-y-8 border-b border-line py-21 md:grid-cols-[14rem_minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <h3 className="h4 text-ink-2">{b.name}</h3>
                  <p className="state state-off mt-5">Concept · not built</p>
                </div>
                <p className="text-ink-2">{b.what}</p>
                <p className="text-sm text-ink-3">{b.needs}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PunchLine k="labs" />

      <NextSteps
        items={[
          { kind: "Experiment", label: "Market Universe", href: "/labs/market-universe", note: "Walk the knowledge graph." },
          { kind: "Experiment", label: "Connect the Dots", href: "/labs/connect-the-dots", note: "Read how a few things connect." },
          { kind: "Trust", label: "Data methodology", href: "/trust/data-methodology", note: "Where every number on this site comes from." },
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "The vocabulary the graph is built on." },
        ]}
      />
    </>
  );
}
