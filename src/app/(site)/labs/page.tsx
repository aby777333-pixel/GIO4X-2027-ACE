import Link from "next/link";
import { Constellation, STAGE_COMPACT } from "@/components/labs/Constellation";
import { DotsDiagram } from "@/components/labs/DotsDiagram";
import { computeLayout } from "@/components/labs/layout";
import { EXAMPLE_PICKS, picksQuery } from "@/components/labs/picks";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { connect, graphStats } from "@/data/graph";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "GIO4X Labs",
  description:
    "GIO4X Labs is where experiments live, apart from the core brokerage pages: the Market Universe, an explorable knowledge graph, and Connect the Dots, which explains how markets, institutions and concepts are related.",
  path: "/labs",
});

const heroLayout = computeLayout("i:xau-usd", STAGE_COMPACT);
const fedLayout = computeLayout("cb:fed", STAGE_COMPACT);
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
          <figure className="mx-auto max-w-[26rem] lg:mx-0 lg:ml-auto">
            <Constellation layout={heroLayout} cfg={STAGE_COMPACT} ground="var(--bg)" />
            <figcaption className="mt-8 text-center text-xs text-ink-3">Gold and what it is documented as related to. A still from the Market Universe.</figcaption>
          </figure>
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
                Two experiments, one graph.
              </h2>
            </div>
            <p className="max-w-[34rem] text-ink-2">
              Both are views of the same thing: the GIO4X Graph, which today holds <span className="num">{graphStats.nodes}</span> nodes and <span className="num">{graphStats.edges}</span> relations, built from the pages and reference data of this site.
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
