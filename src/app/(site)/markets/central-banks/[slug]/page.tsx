import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { FigureNote } from "@/components/figures/Figure";
import { BankGlobe } from "@/components/figures/markets/BankGlobe";
import { HeroCompanion } from "@/components/figures/markets/HeroCompanion";
import { BankReleases } from "@/components/figures/product/BankReleases";
import { bankHref, eventsForBank, instrumentsForBank, resolveEvents, resolveTerms } from "@/components/markets/graph";
import { InlineLinks, LinkRows } from "@/components/markets/LinkRows";
import { ZoneTime } from "@/components/markets/Now";
import { RatesTable } from "@/components/markets/RatesTable";
import { JsonLd } from "@/components/seo/JsonLd";
import { DataNote, NextSteps, PageHero } from "@/components/ui/Page";
import { instrumentHref } from "@/data/instruments";
import { centralBanks, getBank, getCurrency, type CentralBank } from "@/data/knowledge";
import { pageMeta } from "@/lib/meta";
import { getReferenceRates } from "@/lib/rates";
import { webPageSchema } from "@/lib/schema";

type Params = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export function generateStaticParams() {
  return centralBanks.map((b) => ({ slug: b.slug }));
}

const areaPhrase = (area: string) => (/^(United|Euro)/.test(area) ? `the ${area.replace(/^Euro/, "euro")}` : area);

const describe = (b: CentralBank) =>
  `${b.name} (${b.short}): the central bank of ${areaPhrase(b.area)}. Policy body: ${b.committee}. Policy instrument: ${b.instrument}. Mandate, primary source and the ${b.currency} instruments connected to it.`;

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const b = getBank(slug);
  if (!b) return {};
  return pageMeta({ title: `${b.name} (${b.short})`, description: describe(b), path: bankHref(b.slug) });
}

export default async function CentralBankPage({ params }: Params) {
  const { slug } = await params;
  const b = getBank(slug);
  if (!b) notFound();

  const currency = getCurrency(b.currency);
  const { pairs, others } = instrumentsForBank(b);
  const rates = pairs.length ? await getReferenceRates() : null;
  const events = resolveEvents(["interest-rate-decision", ...eventsForBank(b).map((e) => e.slug)]);
  const terms = resolveTerms(["monetary-policy", "central-bank", "hawkish", "dovish", "interest-rate-differential", "inflation", "real-yields"]).slice(0, 5);
  const at = centralBanks.findIndex((x) => x.slug === b.slug);
  const next = centralBanks[(at + 1) % centralBanks.length];
  const prev = centralBanks[(at - 1 + centralBanks.length) % centralBanks.length];
  const host = new URL(b.url).hostname.replace(/^www\./, "");
  const path = bankHref(b.slug);

  const profile: { label: string; value: ReactNode }[] = [
    { label: "Currency", value: currency ? `${currency.name} (${b.currency})` : b.currency },
    { label: "Area", value: b.area },
    { label: "Policy body", value: b.committee },
    { label: "Policy instrument", value: b.instrument },
    { label: "Mandate", value: b.mandate },
    { label: "City", value: b.city },
    { label: "Local time now", value: <ZoneTime tz={b.tz} withDay className="font-medium" /> },
  ];

  return (
    <>
      <JsonLd data={webPageSchema({ path, name: `${b.name} (${b.short})`, description: describe(b) })} />
      <PageHero
        crumbs={[
          { name: "Markets", href: "/markets" },
          { name: "Central Bank Watch", href: "/markets/central-banks" },
          { name: b.short, href: path },
        ]}
        eyebrow={`Central bank · ${b.currency}`}
        title={b.name}
        lead={`The central bank of ${areaPhrase(b.area)}${currency ? ` and the institution behind the ${currency.name}` : ""}. Policy is set by its ${b.committee}.`}
        aside={
          <aside aria-label={`Local time in ${b.city}`} className="border-t-2 border-ink pt-13">
            <div className="flex items-baseline justify-between gap-13">
              <p className="label">{b.city}, now</p>
              <p className="text-xs text-ink-3">{b.tz.replace(/_/g, " ")}</p>
            </div>
            <p className="mt-13">
              <ZoneTime tz={b.tz} className="font-display text-4xl font-light leading-none tracking-[-0.02em]" />
            </p>
            <p className="mt-8 text-sm text-ink-3">
              <ZoneTime tz={b.tz} withDay className="sr-only" />
              Read from your device clock. Decisions are announced in this time zone.
            </p>
          </aside>
        }
        companion={
          <HeroCompanion layout="beside" label="At the source" figure={<BankGlobe lat={b.lat} lon={b.lon} />}>
            The policy rate, the last decision and the next meeting are not shown here: they are read at the bank’s own publication.
          </HeroCompanion>
        }
      >
        <a href={b.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          {b.short} monetary policy
          <span aria-hidden>↗</span>
          <span className="sr-only"> (opens {host} in a new tab)</span>
        </a>
        <Link href="/markets/central-banks" className="btn btn-ghost">
          All banks
        </Link>
      </PageHero>

      {/* profile + the deliberately empty state */}
      <section className="section" aria-labelledby="profile-title">
        <div className="wrap phi items-start">
          <div>
            <p className="eyebrow">Profile</p>
            <h2 id="profile-title" className="h2 mt-13">
              How the {b.short} is set up.
            </h2>
            <dl className="mt-34 border-t border-line-strong">
              {profile.map((r) => (
                <div key={r.label} className="grid gap-x-21 gap-y-3 border-b border-line py-13 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-sm text-ink-3">{r.label}</dt>
                  <dd className="text-ink">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="panel-quiet p-21 lg:mt-55 lg:p-34">
            <p className="label">Published by the bank, not by us</p>
            <h3 className="h4 mt-8">The figures that change are read at the source.</h3>
            <dl className="mt-21 border-t border-line">
              {["Current policy rate", "Last decision", "Next scheduled meeting"].map((k) => (
                <div key={k} className="flex items-baseline justify-between gap-13 border-b border-line py-13">
                  <dt className="text-sm text-ink-2">{k}</dt>
                  <dd className="text-right text-sm">
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="link">
                      See the bank’s own publication
                      <span className="sr-only">
                        {" "}
                        for the {k.toLowerCase()} (opens {host} in a new tab)
                      </span>
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-13 text-sm text-ink-3">GIO4X has no licensed feed for central bank data connected to this site, so these values are not shown here. A rate that might be out of date is worse than no rate.</p>
            <DataNote className="mt-13" status="unavailable" source={b.name} sourceHref={b.url} />
          </div>
        </div>
      </section>

      {/* the currency and its instruments */}
      <section className="section hairline scroll-mt-[var(--header-h)] bg-paper" id="currency" aria-labelledby="currency-title">
        <div className="wrap">
          <div className="phi items-end">
            <div>
              <p className="eyebrow">The currency</p>
              <h2 id="currency-title" className="h2 mt-13">
                {currency ? currency.name : b.currency}
                <span className="num ml-13 align-baseline font-sans text-md font-medium tracking-[0.06em] text-ink-3">{b.currency}</span>
              </h2>
            </div>
            {currency && (
              <p className="text-ink-2">
                {currency.note}
                <span className="mt-5 block text-sm text-ink-3">
                  Symbol {currency.symbol} · also called {currency.nicknames.join(", ")}
                </span>
              </p>
            )}
          </div>

          {pairs.length > 0 && rates ? (
            <div className="mt-34">
              <h3 className="label mb-8">
                {b.currency} pairs on this site, at the last reference fixing
              </h3>
              <RatesTable rates={rates} list={pairs} caption={`ECB reference fixings for currency pairs that include ${b.currency}`} />
            </div>
          ) : (
            <div className="mt-34 border-t border-line-strong pt-21">
              <p className="h4">No {b.currency} instrument is listed on this site.</p>
              <p className="mt-8 max-w-measure text-sm text-ink-2">
                The {b.name} is included because its decisions are widely followed. None of the instruments published on these pages is quoted in {b.currency}, so there are no pairs or reference fixings to show. To ask about availability, write to{" "}
                <a href="mailto:info@gio4x.com" className="link">
                  info@gio4x.com
                </a>
                .
              </p>
            </div>
          )}

          {others.length > 0 && (
            <div className="mt-34 grid gap-x-21 gap-y-5 border-t border-line pt-13 sm:grid-cols-[14rem_1fr]">
              <h3 className="text-sm text-ink-3">Other instruments whose pages name the {b.short}</h3>
              <InlineLinks items={others.map((i) => ({ id: `i:${i.slug}`, kind: "Instrument" as const, label: i.symbol, href: instrumentHref(i), note: i.name }))} />
            </div>
          )}
        </div>
      </section>

      {/* events and concepts */}
      <section className="section hairline" aria-labelledby="context-title">
        <div className="wrap">
          <p className="eyebrow">Context</p>
          <h2 id="context-title" className="h2 mt-13 max-w-[22ch]">
            What is commonly read alongside it.
          </h2>
          <div className="mt-34 grid gap-34 lg:grid-cols-2 lg:gap-55">
            <div>
              <h3 className="label">Economic events</h3>
              <LinkRows items={events} className="mt-13" />
              <p className="mt-13 text-xs text-ink-3">Releases commonly monitored in connection with {b.currency} or published for {areaPhrase(b.area)}. Dates are on each publisher’s own calendar.</p>
              {/* only where this list is much shorter than the concepts beside it */}
              {events.length <= 2 && (
                <FigureNote figure={<BankReleases ratio={events.length > 1 ? 3.2 : 2.4} />} label={events.length > 1 ? undefined : "At the source"}>
                  What each release is, and how it is commonly read, is on these pages. The rate itself is read at the bank’s own publication, linked in the profile above.
                </FigureNote>
              )}
            </div>
            <div>
              <h3 className="label">Concepts</h3>
              <LinkRows items={terms} className="mt-13" />
            </div>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Next bank", label: next.name, href: bankHref(next.slug), note: `${next.currency} · ${next.city}` },
          { kind: "Previous bank", label: prev.name, href: bankHref(prev.slug), note: `${prev.currency} · ${prev.city}` },
          { kind: "Explainer", label: "Interest Rate Decision", href: "/markets/events/interest-rate-decision", note: "What is announced, and how it is read." },
          { kind: "Institutions", label: "Central Bank Watch", href: "/markets/central-banks", note: `All ${centralBanks.length} banks on one page.` },
        ]}
      />
    </>
  );
}
