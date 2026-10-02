import Link from "next/link";
import type { ReactNode } from "react";
import { FigureNote } from "@/components/figures/Figure";
import { CrossRate } from "@/components/figures/trust/CrossRate";
import { NotedChapter } from "@/components/figures/trust/NotedChapter";
import { JsonLd } from "@/components/seo/JsonLd";
import { Chapter, Ext, Rows } from "@/components/trust/Parts";
import { TimeZones } from "@/components/trust/TimeZones";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { educationalNote, indicativeNote } from "@/config/legal";
import { pageMeta } from "@/lib/meta";
import { PERIODS, RATE_CURRENCIES, RATES_SOURCE } from "@/lib/rates";
import { webPageSchema } from "@/lib/schema";
import { SCHEDULE_NOTE } from "@/lib/sessions";

const description = "Where every number on the GIO4X website comes from: the five data states, their sources and timing, the formulae behind changes and correlations, and what “unavailable” means.";

export const metadata = pageMeta({ title: "Data methodology", description, path: "/trust/data-methodology" });

type DataState = { chip: string; name: string; what: ReactNode; source: ReactNode; when: string; not: string };

const states: DataState[] = [
  {
    chip: "Reference data",
    name: "Reference",
    what: `Exchange rates for ${RATE_CURRENCIES.join(", ")}: the euro foreign exchange reference rates set by the European Central Bank.`,
    source: (
      <>
        <Ext href={RATES_SOURCE.href}>{RATES_SOURCE.name}</Ext>, retrieved through the open {RATES_SOURCE.via}.
      </>
    ),
    when: `${RATES_SOURCE.cadence}. GIO4X’s server asks for them at most once an hour and shows the date of the fixing beside every figure.`,
    not: "Not live prices, not tradable quotes and not GIO4X prices. A reference rate is one published value per day.",
  },
  {
    chip: "Indicative",
    name: "Indicative",
    what: "Spreads, margin levels, minimum sizes and similar trading conditions.",
    source: "GIO4X’s own published trading conditions, carried over from its previous websites where the two agreed.",
    when: "Changed only when GIO4X changes the published condition. They do not move with the market.",
    not: indicativeNote,
  },
  {
    chip: "Schedule",
    name: "Schedule",
    what: "Which financial centres and trading sessions are open, and how long until the next one.",
    source: SCHEDULE_NOTE,
    when: "Recalculated in your browser as your clock advances.",
    not: "Not a statement from any exchange that it is open. Public holidays and early closes are not modelled.",
  },
  {
    chip: "Simulation",
    name: "Simulation",
    what: "Everything the calculators and visualisers produce: position size, margin, pip value, cost, drawdown.",
    source: "Arithmetic on the figures you enter, using the formula shown beside each tool.",
    when: "Instant, in your browser. Your inputs are not sent to GIO4X.",
    not: educationalNote,
  },
  {
    chip: "Third party",
    name: "Third-party charts and panels",
    what: "Interactive price charts on the instrument pages, and on the market pages and the Morning Room an economic calendar, heat maps, cross rates, quote tables, a market overview and a ticker tape.",
    source: (
      <>
        Embedded frames from <Ext href="https://www.tradingview.com/">TradingView</Ext>. Each one is loaded only when you ask for it, or as it scrolls into view if you have switched that on in your <Link href="/preferences#third-party" className="link">preferences</Link>. The data, its timing and its accuracy are TradingView’s. No TradingView script runs on GIO4X’s pages, and no panel showing ratings or trade ideas is used.
      </>
    ),
    when: "As TradingView supplies it. Depending on the instrument and exchange it may be delayed.",
    not: "Not GIO4X prices, not the prices at which a GIO4X order would be filled, and not a GIO4X calendar or forecast.",
  },
];

function Formula({ title, expr, children }: { title: string; expr: string; children: ReactNode }) {
  return (
    <figure className="border-b border-line py-21" data-reveal suppressHydrationWarning>
      <figcaption className="h4">{title}</figcaption>
      <div className="scroll-x mt-13">
        <p className="num w-max whitespace-nowrap border-l-2 border-accent bg-paper px-21 py-13 font-mono text-[0.9375rem] text-ink">{expr}</p>
      </div>
      <div className="mt-13 max-w-measure text-sm text-ink-2">{children}</div>
    </figure>
  );
}

export default function DataMethodologyPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/trust/data-methodology", name: "Data methodology", description })} />
      <PageHero
        crumbs={[
          { name: "Trust Centre", href: "/trust" },
          { name: "Data methodology", href: "/trust/data-methodology" },
        ]}
        eyebrow="Data methodology"
        title="Where every number comes from."
        lead="GIO4X does not have a licensed live market-data feed connected to this website, so nothing here is labelled live. Every figure belongs to one of five states, and each state says what it is and what it is not."
      />

      <section className="section-quiet" aria-labelledby="states">
        <div className="wrap">
          <h2 id="states" className="sr-only">
            The five data states
          </h2>
          <ol className="border-t border-line-strong">
            {states.map((s, i) => (
              <li key={s.name} className="grid gap-x-34 gap-y-13 border-b border-line py-34 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.618fr)]" data-reveal suppressHydrationWarning>
                <div>
                  <span className="num text-xs font-semibold tracking-[0.1em] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="h3 mt-5">{s.name}</h3>
                  <p className="mt-13">
                    <span className="chip">{s.chip}</span>
                  </p>
                </div>
                <dl className="grid gap-x-34 gap-y-13 sm:grid-cols-2">
                  <div>
                    <dt className="label">What it covers</dt>
                    <dd className="mt-5 text-ink-2">{s.what}</dd>
                  </div>
                  <div>
                    <dt className="label">Source</dt>
                    <dd className="mt-5 text-ink-2">{s.source}</dd>
                  </div>
                  <div>
                    <dt className="label">When it changes</dt>
                    <dd className="mt-5 text-ink-2">{s.when}</dd>
                  </div>
                  <div>
                    <dt className="label">What it is not</dt>
                    <dd className="mt-5 text-ink">{s.not}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
          <p className="mt-21 max-w-measure text-sm text-ink-3">For the first four states, the label in the row is the one printed beside the data wherever it appears on the site, together with its source and date. Third-party charts and panels carry the label “Third party” and TradingView’s own attribution.</p>
        </div>
      </section>

      <Chapter id="unavailable" eyebrow="When data is missing" title="What “unavailable” means" paper>
        <div className="grid max-w-measure gap-21 text-ink-2" data-reveal suppressHydrationWarning>
          <p>
            If the reference rates cannot be retrieved, the module that uses them shows <span className="chip mx-3 align-middle">Data unavailable</span> and nothing else. It does not show zeros, it does not show a placeholder, and it does not show an older value as if it were today’s.
          </p>
          <p>The same applies to a calculation that lacks enough history to be meaningful, such as a correlation over too few fixings. The cell is marked unavailable; no number is estimated to fill it.</p>
          <p className="text-sm text-ink-3">
            A sixth label, “Delayed”, is reserved for a delayed market-data feed should one be connected. See also the{" "}
            <Link href="/status" className="link">
              status page
            </Link>
            .
          </p>
        </div>
      </Chapter>

      <NotedChapter
        id="calculations"
        eyebrow="Calculations"
        title="How changes, strength and correlations are worked out"
        lead="All four are descriptive statistics of reference fixings that have already been published. None is a signal and none is a forecast."
        note={
          <FigureNote figure={<CrossRate />} label="Worth knowing">
            Each of the four starts from one published value per currency per day. With too few fixings the result is shown as unavailable, and no number is estimated to fill it. They are applied on the{" "}
            <Link href="/markets/currency-strength" className="link">
              currency strength
            </Link>{" "}
            page.
          </FigureNote>
        }
      >
        <div className="border-t border-line-strong">
          <Formula title="Cross rates" expr="BASE/QUOTE  =  (QUOTE per EUR) ÷ (BASE per EUR)">
            <p>The ECB publishes each currency against the euro. A pair that does not include the euro is derived by dividing one euro rate by the other, on the same fixing date.</p>
          </Formula>
          <Formula title="Change" expr="change %  =  (rate today ÷ rate n fixings ago − 1) × 100">
            <p>
              Periods are counted in fixings, not calendar days: {PERIODS.map((p) => p.n).join(", ")} fixings, which correspond roughly to a day, a week, a month and three months. A change over one fixing compares the latest published value with the one before it.
            </p>
          </Formula>
          <Formula title="Currency strength" expr="strength(C)  =  mean of change %(C/X) over the other seven currencies X">
            <p>For each currency, the average of its percentage change against each of the other seven over the chosen period. It ranks what has already happened in reference rates.</p>
          </Formula>
          <Formula title="Correlation" expr="r  =  Σ(a − ā)(b − b̄) ÷ √( Σ(a − ā)² · Σ(b − b̄)² ),   a, b = ln(Pₜ ÷ Pₜ₋₁)">
            <p>
              The Pearson correlation of the two pairs’ daily log returns over the available window of about three months of fixings. It needs at least twelve fixings; with fewer, or if either series does not move, the result is shown as unavailable. Correlations change, and a
              past value says nothing certain about the next period.
            </p>
          </Formula>
        </div>
      </NotedChapter>

      {/* Chapter's own markup, written out so the drawing can sit under the heading in the narrow column */}
      <section className="section-quiet hairline bg-paper" aria-labelledby="time-zones">
        <div className="wrap phi items-start">
          <div className="lg:order-2">
            <div data-reveal suppressHydrationWarning>
              <p className="eyebrow">Time</p>
              <h2 id="time-zones" className="h3 mt-13 max-w-[20ch] scroll-mt-[calc(var(--header-h)+2.125rem)]">
                Time zones
              </h2>
            </div>
            <TimeZones className="mt-21" />
          </div>
          <div className="lg:order-1">
            <Rows
              items={[
                { t: "Fixing dates are the ECB’s.", d: "A reference rate carries the date on which the European Central Bank set it, around 16:00 Central European Time. It is shown as a date, never as a time of day in your zone." },
                {
                  t: "Sessions are computed in each venue’s own zone.",
                  d: "Opening and closing times are held in the local time of each financial centre and converted with your browser’s time-zone database, so daylight-saving changes in either place are handled on the correct dates.",
                },
                {
                  t: "They are shown in the zone you choose.",
                  d: (
                    <>
                      By default that is your device’s zone. You can set another in{" "}
                      <Link href="/preferences" className="link">
                        preferences
                      </Link>
                      . Dials that span the whole day are marked in UTC.
                    </>
                  ),
                },
                { t: "Your clock is the clock.", d: "Schedules use the time reported by your device. If that clock is wrong, the schedule will be wrong by the same amount." },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="section-quiet hairline" aria-labelledby="no-live">
        <div className="wrap phi items-start">
          <div data-reveal suppressHydrationWarning>
            <p className="eyebrow">The rule</p>
            <h2 id="no-live" className="h2 mt-13 max-w-[16ch]">
              Nothing on this site is labelled live.
            </h2>
          </div>
          <div className="grid gap-13 text-ink-2" data-reveal suppressHydrationWarning>
            <p>A live label would be a claim that a figure is the market’s price at this moment. GIO4X has no source of its own that could support that claim, so the word is not used, and no GIO4X figure is animated to look as though it were ticking.</p>
            <p>The panels from TradingView are a different thing: they are TradingView’s own frames, they update as TradingView updates them, and each is labelled third party. GIO4X still publishes no prices of its own.</p>
            <p>If a licensed feed is connected in future, this page will name the provider, the delay if any and the instruments covered before the first live figure appears.</p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { label: "Currency strength", href: "/markets/currency-strength", kind: "Reference data", note: "The formulae above, applied" },
          { label: "World Market Clock", href: "/markets/clock", kind: "Schedule", note: "Sessions from your clock" },
          { label: "Trader Toolkit", href: "/tools", kind: "Simulation", note: "Calculators that show their working" },
          { label: "Editorial standards", href: "/trust/editorial-standards", kind: "Trust", note: "How market data is used in articles" },
        ]}
      />
    </>
  );
}
