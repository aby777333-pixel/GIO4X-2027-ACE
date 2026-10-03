import Link from "next/link";
import { LAYERS } from "@/components/about/world/places";
import { ThreeLayers } from "@/components/figures/extra/ShortColumns";
import { WorldMap } from "@/components/about/world/WorldMap";
import { bankHref } from "@/components/markets/graph";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { centralBanks } from "@/data/knowledge";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";
import { centres } from "@/lib/sessions";

const DESCRIPTION =
  "GIO4X on one explorable globe: the two published offices, nine financial centres with their regular hours, and the central banks the site covers, with day and night drawn from the sun’s real position. A schematic map; it does not ask for your location.";

export const metadata = pageMeta({ title: "GIO4X on the map", description: DESCRIPTION, path: "/about/world" });

const offices = LAYERS.find((l) => l.key === "offices")?.places.length ?? 0;
const bankHrefs = Object.fromEntries(centralBanks.map((b) => [b.slug, bankHref(b.slug)]));

const notes = [
  {
    t: "Offices",
    d: `Only the ${offices === 2 ? "two" : offices} offices GIO4X has published with an address are shown: the head office in Ruislip, London, and the support office in Chennai. No other office is marked, because no other address has been published. Each stands at the town its address names, not at the building.`,
    href: "/about#company",
    go: "Company details",
  },
  {
    t: "Financial centres",
    d: `The ${centres.length} centres whose regular weekday hours the site’s clocks read. Each marker carries the state of its exchange’s regular session at the present minute; the card gives the hours in the centre’s own time and in yours.`,
    href: "/markets/clock",
    go: "World Market Clock",
  },
  {
    t: "Central banks",
    d: `The ${centralBanks.length} central banks covered by Central Bank Watch, at the city where each announces its decisions. The card names the policy body and its instrument and links to the bank’s page. No policy rate is shown, here or there.`,
    href: "/markets/central-banks",
    go: "Central Bank Watch",
  },
];

const limits = [
  "The land is a coarse field of points made for the homepage instrument. It is a schematic, not a coastline dataset, and it carries no borders.",
  "Day and night come from the sun’s position, computed from the date and the UTC time on your device.",
  "Your location is not requested and not used. The only preference read is the time zone you may have chosen on the World Market Clock.",
  "Nothing is stored and nothing is sent: the map is drawn in your browser.",
];

export default function WorldPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/about/world", name: "GIO4X on the map", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "About", href: "/about" },
          { name: "GIO4X on the map", href: "/about/world" },
        ]}
        eyebrow="Company · Map"
        title="GIO4X on the map"
        lead={`${offices === 2 ? "Two" : offices} published offices, ${centres.length} financial centres and ${centralBanks.length} central banks on one globe you can turn, lit by where the sun actually is.`}
      />

      <section className="section-quiet" aria-label="The globe">
        <div className="wrap">
          <WorldMap bankHrefs={bankHrefs} />
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="world-layers">
        <div className="wrap phi phi-r items-start">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
            <p className="eyebrow">What is on it</p>
            <h2 id="world-layers" className="h2 mt-13">
              Three layers, each a list the site already keeps.
            </h2>
            <p className="lead mt-13 max-w-[30rem]">The globe adds nothing of its own. Every marker is a place this site publishes elsewhere, with the page it comes from.</p>
            {/* the short column was empty beneath the heading: a figure that says the same thing as the text beside it */}
            <div className="mt-34 max-w-[28rem]">
              <div className="flat gx-stage">
                <ThreeLayers offices={offices} centres={centres.length} banks={centralBanks.length} />
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <ul className="border-t border-line-strong">
              {notes.map((n) => (
                <li key={n.t} className="grid gap-x-21 gap-y-5 border-b border-line py-21 sm:grid-cols-[10rem_1fr]">
                  <h3 className="h4">{n.t}</h3>
                  <div>
                    <p className="max-w-measure text-ink-2">{n.d}</p>
                    <Link href={n.href} className="go mt-8">
                      {n.go}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            <h3 className="label mt-34">What kind of map this is</h3>
            <ul className="mt-8 border-t border-line">
              {limits.map((x) => (
                <li key={x} className="flex gap-8 border-b border-line py-8 text-sm text-ink-2">
                  <span aria-hidden className="mt-[0.7em] h-px w-13 shrink-0 bg-ink-3" />
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-13 max-w-measure text-xs text-ink-3">
              The same globe plays one whole day of sessions as a film in{" "}
              <Link href="/labs/market-day" className="link">
                One day of markets
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Company", label: "About GIO4X", href: "/about", note: "The house, the company line and the two addresses." },
          { kind: "Markets", label: "World Market Clock", href: "/markets/clock", note: "Who is in regular hours right now." },
          { kind: "Markets", label: "Central Bank Watch", href: "/markets/central-banks", note: "Who sets policy, and where." },
          { kind: "Labs", label: "One day of markets", href: "/labs/market-day", note: "Twenty-four hours as a two-minute film." },
        ]}
      />
    </>
  );
}
