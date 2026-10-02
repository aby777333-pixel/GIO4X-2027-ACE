import Link from "next/link";
import { notFound } from "next/navigation";
import { HeroCompanion } from "@/components/figures/markets/HeroCompanion";
import { ReleaseRipple } from "@/components/figures/markets/ReleaseRipple";
import { banksForEvent, eventHref, resolveAll } from "@/components/markets/graph";
import { LinkRows } from "@/components/markets/LinkRows";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero, SpecList } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { econEvents, getEvent } from "@/data/knowledge";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

type Params = { params: Promise<{ slug: string }> };


export function generateStaticParams() {
  return econEvents.map((e) => ({ slug: e.slug }));
}

const titleOf = (e: { name: string; short: string }) => (e.short.toLowerCase() === e.name.toLowerCase() ? `${e.name}, explained` : `${e.name} (${e.short}), explained`);

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const e = getEvent(slug);
  if (!e) return {};
  return pageMeta({ title: titleOf(e), description: `${e.what} How it is measured, why markets watch it, who publishes it and what is commonly monitored alongside it.`, path: eventHref(e.slug) });
}

export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  const e = getEvent(slug);
  if (!e) notFound();

  const watched = resolveAll(e.watchedBy);
  const banks = resolveAll(banksForEvent(e).map((b) => `cb:${b.slug}`));
  const related = resolveAll(e.related).filter((r) => r.kind !== "Central bank");
  const at = econEvents.findIndex((x) => x.slug === e.slug);
  const next = econEvents[(at + 1) % econEvents.length];
  const prev = econEvents[(at - 1 + econEvents.length) % econEvents.length];
  const path = eventHref(e.slug);

  return (
    <>
      <JsonLd data={webPageSchema({ path, name: titleOf(e), description: e.what })} />
      <PageHero
        crumbs={[
          { name: "Markets", href: "/markets" },
          { name: "Economic Events", href: "/markets/events" },
          { name: e.short, href: path },
        ]}
        eyebrow={`Economic event · ${e.kind}`}
        title={e.name}
        lead={e.what}
        aside={
          <aside aria-label="At a glance" className="border-t-2 border-ink pt-13">
            <p className="label">At a glance</p>
            <SpecList
              className="mt-8"
              rows={[
                { label: "Known as", value: e.short },
                { label: "Measures", value: e.kind },
                { label: "Cadence", value: <span className="font-normal">{e.cadence}</span> },
                { label: "Next release", value: <span className="font-normal text-ink-2">See the publisher</span>, note: "no calendar feed is connected" },
              ]}
            />
          </aside>
        }
        companion={
          <HeroCompanion figure={<ReleaseRipple count={watched.length} />} label="Around a release">
            Spreads may widen, prices may gap and an order may be filled at a different price from the one requested.{" "}
            <Link href="/tools/order-anatomy" className="link">
              Order anatomy
            </Link>
          </HeroCompanion>
        }
      />

      <section className="section" aria-labelledby="how-title">
        <div className="wrap phi items-start">
          <div className="max-w-measure">
            <p className="eyebrow">The release</p>
            <h2 id="how-title" className="h2 mt-13">
              How it is measured.
            </h2>
            <p className="lead mt-21 text-ink">{e.how}</p>

            <h2 className="h3 mt-55">Why markets watch it.</h2>
            <p className="mt-13 text-md text-ink-2">{e.why}</p>
            <p className="mt-21 border-l-2 border-line-strong pl-13 text-sm text-ink-3">An explanation of why the release is followed, not a view on what any market will do when it is published. {educationalNote}</p>
          </div>

          <div className="lg:pt-55">
            <h2 className="label">Commonly monitored alongside it</h2>
            <LinkRows items={watched} showKind className="mt-13" />
            <p className="mt-13 text-xs text-ink-3">Currencies and instruments that market participants commonly follow around this release. Listed for context; inclusion says nothing about direction.</p>
          </div>
        </div>
      </section>

      {/* publishers */}
      <section className="section hairline bg-paper" aria-labelledby="pub-title">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">Primary sources</p>
            <h2 id="pub-title" className="h2 mt-13">
              Who publishes it.
            </h2>
            <p className="mt-13 max-w-[30rem] text-ink-2">The figures, the methodology and the release schedule are on the publisher’s own website. That is the only place this page sends you for a date.</p>
          </div>
          <div className="min-w-0">
            <div className="scroll-x">
              <table className="table-gx min-w-[30rem]">
                <caption className="sr-only">Publishers of the {e.name}, by area, with links to the primary source</caption>
                <thead>
                  <tr>
                    <th scope="col">Area</th>
                    <th scope="col">Publisher</th>
                    <th scope="col" className="!pr-0 !text-right">
                      Primary source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {e.publishers.map((p) => (
                    <tr key={p.url}>
                      <th scope="row" className="!border-line !text-sm !font-normal !normal-case !tracking-normal !text-ink-2">
                        {p.area}
                      </th>
                      <td className="text-[0.9375rem] font-medium">{p.body}</td>
                      <td className="!pr-0 text-right text-sm">
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="link inline-flex min-h-[2.75rem] items-center whitespace-nowrap">
                          {new URL(p.url).hostname.replace(/^www\./, "")}
                          <span aria-hidden> ↗</span>
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-21 grid gap-x-21 gap-y-3 sm:grid-cols-[8rem_1fr]">
              <dt className="text-sm text-ink-3">Cadence</dt>
              <dd className="text-sm text-ink">{e.cadence}</dd>
              <dt className="text-sm text-ink-3">Dates</dt>
              <dd className="text-sm text-ink-2">
                Not shown on this site: a live economic calendar is not connected yet.{" "}
                <Link href="/markets/events#calendars" className="link">
                  All publishers’ pages
                </Link>
              </dd>
            </dl>
          </div>
        </div>
      </section>

      {/* related */}
      {(related.length > 0 || banks.length > 0) && (
        <section className="section hairline" aria-labelledby="rel-title">
          <div className="wrap">
            <p className="eyebrow">Connected</p>
            <h2 id="rel-title" className="h2 mt-13 max-w-[22ch]">
              Read it in context.
            </h2>
            <div className="mt-34 grid gap-34 lg:grid-cols-2 lg:gap-55">
              {related.length > 0 && (
                <div>
                  <h3 className="label">Related concepts and releases</h3>
                  <LinkRows items={related} showKind className="mt-13" />
                </div>
              )}
              {banks.length > 0 && (
                <div>
                  <h3 className="label">Central banks it is read against</h3>
                  <LinkRows items={banks} className="mt-13" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <NextSteps
        items={[
          { kind: "Next explainer", label: next.name, href: eventHref(next.slug), note: `${next.kind} · ${next.cadence}` },
          { kind: "Previous explainer", label: prev.name, href: eventHref(prev.slug), note: `${prev.kind} · ${prev.cadence}` },
          { kind: "Explainers", label: "All economic events", href: "/markets/events", note: `All ${econEvents.length} releases, and where their dates are published.` },
          { kind: "Tool", label: "Order Anatomy", href: "/tools/order-anatomy", note: "Why an order can fill at a different price from the one requested." },
        ]}
      />
    </>
  );
}
