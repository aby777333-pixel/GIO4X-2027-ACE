import { ConnectTheDots } from "@/components/labs/ConnectTheDots";
import { parsePicks } from "@/components/labs/picks";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Connect the Dots",
  description:
    "Pick two to five markets, currencies, central banks, events or concepts and read, one relation at a time, how GIO4X’s curated knowledge graph connects them. Deterministic: no language model is involved.",
  path: "/labs/connect-the-dots",
});

export default async function ConnectTheDotsPage({ searchParams }: { searchParams: Promise<{ n?: string | string[] }> }) {
  const { n } = await searchParams;
  const raw = Array.isArray(n) ? n[0] : n;
  const initial = parsePicks(raw);
  return (
    <>
      <PageHero
        quiet
        crumbs={[
          { name: "Labs", href: "/labs" },
          { name: "Connect the Dots", href: "/labs/connect-the-dots" },
        ]}
        eyebrow="GIO4X Labs · Experiment"
        title="Connect the Dots"
        lead="Choose a few things. The page finds the shortest documented route between them and writes it out, one relation per sentence."
      />

      <section className="section-quiet" aria-label="Connect the Dots">
        <div className="wrap">
          {/* keyed by the incoming selection so a shared link always opens on its own set */}
          <ConnectTheDots key={raw ?? "example"} initial={initial} example={raw === undefined} />
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="ctd-method">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">Method</p>
            <h2 id="ctd-method" className="h3 mt-13">
              How the sentences are made.
            </h2>
          </div>
          <div className="prose-gx">
            <p>
              Each relation in the GIO4X graph has a fixed sentence pattern in both directions. For every pair of picks the page runs a breadth-first search for the shortest route, preferring structural relations (“is issued by”) over associative ones (“is commonly watched alongside”) when two routes are equally short, then prints the pattern for each step.
            </p>
            <p>
              <strong>No language model is involved: these sentences come from GIO4X’s curated relationship data.</strong> The same picks always give the same text. A route describes how things are documented as connected. It is not a view on where any price is going, and it is not advice.
            </p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Labs", label: "Market Universe", href: "/labs/market-universe", note: "Walk the whole graph, one node at a time." },
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "The vocabulary behind the sentences." },
          { kind: "Markets", label: "Economic Events", href: "/markets/events", note: "What the scheduled releases measure." },
          { kind: "Labs", label: "All experiments", href: "/labs", note: "What Labs is, and what is on the bench." },
        ]}
      />
    </>
  );
}
