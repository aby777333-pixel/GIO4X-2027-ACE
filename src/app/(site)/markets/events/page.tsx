import Link from "next/link";
import { EmptyCalendar } from "@/components/figures/markets/EmptyCalendar";
import { HeroCompanion } from "@/components/figures/markets/HeroCompanion";
import { eventHref, firstSentence } from "@/components/markets/graph";
import { Head } from "@/components/markets/Head";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { econEvents } from "@/data/knowledge";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "Seven scheduled economic releases explained in plain language: what each one measures, how it is compiled, why markets commonly watch it and who publishes it. No dates are invented: each explainer links to the publisher’s own calendar.";

export const metadata = pageMeta({ title: "Economic Events", description: DESCRIPTION, path: "/markets/events" });

/** Every publishing body named in the explainers, once, with the releases it is responsible for. */
function publishers() {
  const map = new Map<string, { body: string; area: string; url: string; events: { name: string; slug: string }[]; urls: Set<string> }>();
  for (const e of econEvents)
    for (const p of e.publishers) {
      const row = map.get(p.body) ?? { body: p.body, area: p.area, url: p.url, events: [], urls: new Set<string>() };
      row.events.push({ name: e.short, slug: e.slug });
      row.urls.add(p.url);
      map.set(p.body, row);
    }
  return [...map.values()].sort((a, b) => a.area.localeCompare(b.area) || a.body.localeCompare(b.body));
}

export default function EventsPage() {
  const sources = publishers();
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/markets/events", name: "Economic Events", description: DESCRIPTION, type: "CollectionPage" })} />
      <PageHero
        crumbs={[
          { name: "Markets", href: "/markets" },
          { name: "Economic Events", href: "/markets/events" },
        ]}
        eyebrow="Explainers"
        title="Economic Events"
        lead={`${econEvents.length} scheduled releases that markets commonly watch, explained: what each measures, how it is compiled, and why it matters to prices.`}
        aside={
          <div className="border-l-2 border-warn pl-13">
            <p className="label">Not a calendar</p>
            <p className="mt-5 text-sm text-ink">A live economic calendar is not connected to this site yet, so no release dates, forecasts or outcomes are shown here.</p>
            <p className="mt-5 text-sm text-ink-3">
              For dates, use{" "}
              <a href="#calendars" className="link">
                the publishers’ own calendars
              </a>
              .
            </p>
          </div>
        }
        companion={
          <HeroCompanion layout="beside" figure={<EmptyCalendar count={econEvents.length} />}>
            Release dates move, and a wrong date is worse than none. Each explainer links to its publisher’s own calendar.
          </HeroCompanion>
        }
      />

      <section className="section" aria-labelledby="events-title">
        <div className="wrap">
          <h2 id="events-title" className="sr-only">
            The explainers
          </h2>
          <ol className="border-t border-line-strong">
            {econEvents.map((e, n) => (
              <li key={e.slug} className="border-b border-line">
                <Link href={eventHref(e.slug)} className="group grid gap-x-34 gap-y-5 py-21 transition-colors duration-fast hover:bg-surface md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)_auto] md:items-baseline md:px-13">
                  <span className="flex items-baseline gap-13">
                    <span className="num w-21 shrink-0 text-xs text-ink-3">{String(n + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="label block">{e.kind}</span>
                      <span className="h3 mt-3 block transition-colors duration-fast group-hover:text-accent">{e.name}</span>
                    </span>
                  </span>
                  <span className="pl-34 md:pl-0">
                    <span className="block text-ink-2">{firstSentence(e.what, 220)}</span>
                    <span className="mt-5 block text-sm text-ink-3">
                      {e.short} · {e.cadence}
                    </span>
                  </span>
                  <span className="go hidden md:inline-flex" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* the honest calendar block */}
      <section className="section hairline scroll-mt-[var(--header-h)] bg-paper" id="calendars" aria-labelledby="calendars-title">
        <div className="wrap">
          <Head
            id="calendars-title"
            eyebrow="Where the dates are"
            title="The calendar belongs to the publishers."
            lead="Release dates move, and a wrong date is worse than none. Until a licensed calendar feed is connected, the authoritative schedule for each release is the one kept by the body that publishes it."
          />
          <div className="scroll-x mt-34">
            <table className="table-gx min-w-[40rem]">
              <caption className="sr-only">Publishers of the economic releases explained on this site, with links to their own pages</caption>
              <thead>
                <tr>
                  <th scope="col">Publisher</th>
                  <th scope="col">Area</th>
                  <th scope="col">Releases explained here</th>
                  <th scope="col" className="!pr-0 !text-right">
                    Primary source
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.body}>
                    <th scope="row" className="!border-line !text-[0.9375rem] !font-medium !normal-case !tracking-normal !text-ink">
                      {s.body}
                    </th>
                    <td className="text-sm text-ink-2">{s.area}</td>
                    <td className="text-sm">
                      <span className="flex flex-wrap gap-x-13">
                        {s.events.map((e) => (
                          <Link key={e.slug} href={eventHref(e.slug)} className="link inline-flex min-h-[2.75rem] items-center">
                            {e.name}
                          </Link>
                        ))}
                      </span>
                    </td>
                    <td className="!pr-0 text-right text-sm">
                      <a href={s.urls.size > 1 ? new URL(s.url).origin : s.url} target="_blank" rel="noopener noreferrer" className="link inline-flex min-h-[2.75rem] items-center whitespace-nowrap">
                        {new URL(s.url).hostname.replace(/^www\./, "")}
                        <span aria-hidden> ↗</span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-13 max-w-measure text-xs text-ink-3">Links go to each body’s own website. Where a body publishes more than one of these releases, the explainer for each release carries its specific link.</p>
        </div>
      </section>

      <section className="section-quiet hairline" aria-labelledby="around-title">
        <div className="wrap phi phi-r items-start">
          <h2 id="around-title" className="h3">
            Around a scheduled release.
          </h2>
          <div className="max-w-measure">
            <p className="text-ink-2">
              Trading conditions can change quickly around a major release: spreads may widen, prices may gap, and an order may be filled at a different price from the one requested. The explainers describe why a release is watched. They do not say what a market will do when it is published.
            </p>
            <p className="mt-13 flex flex-wrap gap-x-21 gap-y-5">
              <Link href="/tools/order-anatomy" className="go py-13 md:py-0">
                Order anatomy
              </Link>
              <Link href="/legal/risk" className="go py-13 md:py-0">
                Risk disclosure
              </Link>
            </p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Institutions", label: "Central Bank Watch", href: "/markets/central-banks", note: "The banks whose decisions these releases inform." },
          { kind: "Schedule", label: "World Market Clock", href: "/markets/clock", note: "Which centres are in regular hours right now." },
          { kind: "Learn", label: "Glossary", href: "/glossary", note: "Inflation, real yields, slippage and the rest." },
          { kind: "Markets", label: "Market Command", href: "/markets", note: "Back to the overview." },
        ]}
      />
    </>
  );
}
