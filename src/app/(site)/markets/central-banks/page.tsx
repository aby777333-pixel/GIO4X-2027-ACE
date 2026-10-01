import Link from "next/link";
import { BankMap } from "@/components/markets/BankMap";
import { bankHref } from "@/components/markets/graph";
import { Head } from "@/components/markets/Head";
import { ZoneTime } from "@/components/markets/Now";
import { JsonLd } from "@/components/seo/JsonLd";
import { DataNote, NextSteps, PageHero } from "@/components/ui/Page";
import { centralBanks, getCurrency } from "@/data/knowledge";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "Central Bank Watch: nine central banks, the body that sets policy at each, the instrument it uses, its mandate and where it publishes its decisions. Current rates and meeting dates are deliberately left to each bank’s own publication.";

export const metadata = pageMeta({ title: "Central Bank Watch", description: DESCRIPTION, path: "/markets/central-banks" });

export default function CentralBanksPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/markets/central-banks", name: "Central Bank Watch", description: DESCRIPTION, type: "CollectionPage" })} />
      <PageHero
        crumbs={[
          { name: "Markets", href: "/markets" },
          { name: "Central Bank Watch", href: "/markets/central-banks" },
        ]}
        eyebrow="Institutions"
        title="Central Bank Watch"
        lead={`${centralBanks.length} central banks whose decisions set the cost of money in their currencies: who decides, with which instrument, under what mandate, and where to read the decision at its source.`}
      >
        <Link href="/markets/events/interest-rate-decision" className="btn btn-primary">
          What a rate decision is
        </Link>
        <a href="#banks" className="btn btn-ghost">
          The {centralBanks.length} banks
        </a>
      </PageHero>

      <section className="section-quiet" aria-labelledby="map-title">
        <div className="wrap">
          <h2 id="map-title" className="sr-only">
            Where the banks are
          </h2>
          <BankMap banks={centralBanks} />
        </div>
      </section>

      <section className="section hairline scroll-mt-[var(--header-h)] bg-paper" id="banks" aria-labelledby="banks-title">
        <div className="wrap">
          <Head id="banks-title" eyebrow="The banks" title="Who sets policy, and where." lead="Local time is read from your clock. Each row opens the bank’s page, with its currency’s pairs and the releases it responds to." />
          <ul className="mt-34 border-t border-line-strong">
            {centralBanks.map((b) => {
              const c = getCurrency(b.currency);
              return (
                <li key={b.slug} className="border-b border-line">
                  <Link href={bankHref(b.slug)} className="group grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-x-13 gap-y-3 py-21 transition-colors duration-fast hover:bg-surface md:grid-cols-[7.5rem_minmax(0,1.618fr)_minmax(0,1fr)_7rem_1.3125rem] md:gap-x-21 md:px-13">
                    <span className="h3 transition-colors duration-fast group-hover:text-accent">{b.short}</span>
                    <span>
                      <span className="block font-medium">{b.name}</span>
                      <span className="mt-2 block text-sm text-ink-3">{b.committee}</span>
                    </span>
                    <span className="col-start-2 md:col-start-auto">
                      <span className="block text-sm text-ink-2">
                        <span className="num font-semibold tracking-[0.04em] text-ink">{b.currency}</span>
                        {c ? ` · ${c.name}` : ""}
                      </span>
                      <span className="mt-2 block text-sm text-ink-3">{b.city}</span>
                    </span>
                    <span className="col-start-3 row-start-1 text-right md:col-start-auto md:row-start-auto">
                      <ZoneTime tz={b.tz} className="text-[0.9375rem] font-medium" />
                      <span className="block text-xs text-ink-3">local time</span>
                    </span>
                    <span className="go hidden self-center md:inline-flex" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          <DataNote className="mt-13" status="schedule">
            Local times are computed from your device clock and each city’s time zone.
          </DataNote>
        </div>
      </section>

      <section className="section-quiet hairline" aria-labelledby="absent-title">
        <div className="wrap phi items-start">
          <div>
            <p className="eyebrow">Deliberately absent</p>
            <h2 id="absent-title" className="h3 mt-13 max-w-[24ch]">
              No policy rates, no meeting dates.
            </h2>
            <p className="mt-13 max-w-measure text-ink-2">
              A policy rate is only useful if it is current, and GIO4X has no licensed feed for central bank data connected to this site. Rather than print a number that could be out of date on the day you read it, every bank’s page links to the place where the bank itself publishes its rate, its last decision and its calendar.
            </p>
          </div>
          <div className="lg:pt-34">
            <h3 className="label">What each page does carry</h3>
            <ul className="mt-13 border-t border-line">
              {["The policy body and the instrument it sets", "The mandate, summarised", "The currency’s pairs, with ECB reference fixings", "The scheduled releases commonly read alongside it"].map((x) => (
                <li key={x} className="flex gap-8 border-b border-line py-8 text-sm text-ink-2">
                  <span aria-hidden className="mt-[0.7em] h-px w-13 shrink-0 bg-accent" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Explainers", label: "Economic Events", href: "/markets/events", note: "Inflation, employment and growth releases, explained." },
          { kind: "Reference data", label: "Currency Strength", href: "/markets/currency-strength", note: "How the eight major currencies have moved against each other." },
          { kind: "Glossary", label: "Glossary", href: "/glossary", note: "Monetary policy, real yields and the terms around them." },
          { kind: "Markets", label: "Market Command", href: "/markets", note: "The overview of sessions, rates and asset classes." },
        ]}
      />
    </>
  );
}
