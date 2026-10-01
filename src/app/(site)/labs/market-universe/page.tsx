import Link from "next/link";
import { MarketUniverse } from "@/components/labs/MarketUniverse";
import { NextSteps, PageHero, SpecList } from "@/components/ui/Page";
import { KIND_LABEL, RELATIONS, edges, graphStats, type Relation } from "@/data/graph";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Market Universe",
  description:
    "An explorable map of documented relationships between markets, currencies, central banks, economic events and trading concepts. It describes how things are connected, not how prices will move.",
  path: "/labs/market-universe",
});

const relationRows = (Object.keys(RELATIONS) as Relation[])
  .map((r) => ({ label: RELATIONS[r].label, value: edges.filter((e) => e.rel === r).length }))
  .filter((r) => r.value > 0);

export default function MarketUniversePage() {
  return (
    <>
      <PageHero
        quiet
        crumbs={[
          { name: "Labs", href: "/labs" },
          { name: "Market Universe", href: "/labs/market-universe" },
        ]}
        eyebrow="GIO4X Labs · Experiment"
        title="Market Universe"
        lead="A map of documented relationships between markets, institutions and concepts. It describes how things are connected, not how prices will move."
      />

      <section className="section-quiet" aria-label="The map">
        <div className="wrap">
          <MarketUniverse />
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="mu-method">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">Method</p>
            <h2 id="mu-method" className="h2 mt-13">
              Software over curated relations. Not a model.
            </h2>
          </div>
          <div>
            <div className="prose-gx">
              <p>
                Every node here is a page that already exists on this site: an instrument, a currency, a central bank, an economic release, a glossary term, a tool or a platform. Every line between two nodes is a relation recorded in GIO4X’s own reference data, such as “is priced in”, “is issued by” or “is commonly watched alongside”.
              </p>
              <p>
                The layout is computed, not simulated: the node you choose sits at the centre, what it is directly related to sits on the first ring grouped by kind, and a selection of what those relate to sits on a second ring whose radius is φ times the first. The same choice always draws the same picture.
              </p>
              <p>
                <strong>What it is not.</strong> There is no language model, no market data, no score and no signal behind this map. A line says that two things are documented as connected. It says nothing about direction, timing or price, and it is not advice.
              </p>
            </div>
            <div className="mt-34 grid gap-x-55 gap-y-34 sm:grid-cols-2">
              <div>
                <h3 className="label">Nodes in the graph · {graphStats.nodes}</h3>
                <SpecList className="mt-8 border-t border-line-strong" rows={graphStats.byKind.map((k) => ({ label: KIND_LABEL[k.kind].many, value: k.count }))} />
              </div>
              <div>
                <h3 className="label">Relations in the graph · {graphStats.edges}</h3>
                <SpecList className="mt-8 border-t border-line-strong" rows={relationRows} />
              </div>
            </div>
            <p className="mt-13 max-w-measure text-xs text-ink-3">
              Counts are computed from the site’s data when the page is built. The concepts shown are a curated subset of the{" "}
              <Link href="/glossary" className="link">
                glossary
              </Link>
              , not all of it.
            </p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Labs", label: "Connect the Dots", href: "/labs/connect-the-dots", note: "Pick a few things and read how they connect." },
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "Every concept on the map, defined." },
          { kind: "Markets", label: "Market Command", href: "/markets", note: "Sessions, reference rates and structure." },
          { kind: "Labs", label: "All experiments", href: "/labs", note: "What Labs is, and what is on the bench." },
        ]}
      />
    </>
  );
}
