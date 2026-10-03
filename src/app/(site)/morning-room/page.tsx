import { SeasonNote } from "@/components/fx/Extras";
import Link from "next/link";
import type { ReactNode } from "react";
import { Cadence } from "@/components/figures/company/Cadence";
import { FigureNote } from "@/components/figures/Figure";
import { DayWheel } from "@/components/figures/markets/DayWheel";
import { HeroCompanion } from "@/components/figures/markets/HeroCompanion";
import { DepthRoom, FxSessionsToday } from "@/components/knowledge/MorningRoom";
import { EditionDate, Greeting, LocalClock } from "@/components/knowledge/Today";
import { firstSentence } from "@/components/markets/graph";
import { EconomicCalendar } from "@/components/markets/MarketPanels";
import { SessionStrip } from "@/components/market/SessionStrip";
import { JsonLd } from "@/components/seo/JsonLd";
import { Change, Sparkline } from "@/components/ui/Data";
import { DataNote, NextSteps, PageHero } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { lessons } from "@/data/academy";
import { latestArticles, sectionLabels } from "@/data/articles";
import { glossary } from "@/data/glossary";
import { econEvents } from "@/data/knowledge";
import { pageMeta } from "@/lib/meta";
import { crossChange, crossRate, crossSeries, formatFixingDate, formatPct, formatRate, getReferenceRates, RATES_SOURCE, strength, type RateCurrency } from "@/lib/rates";
import { webPageSchema } from "@/lib/schema";
import { SCHEDULE_NOTE } from "@/lib/sessions";
import "@/components/knowledge/knowledge.css";

const description = "The GIO4X Morning Room: which sessions are open, where the ECB reference fixings stand, what is scheduled, and something worth reading. No signals and no predictions.";

export const metadata = pageMeta({ title: "Morning Room", description, path: "/morning-room" });

// Reference fixings and the day's reading are refreshed hourly.
export const revalidate = 3600;

const PAIRS: { base: RateCurrency; quote: RateCurrency; slug: string; show?: "standard" }[] = [
  { base: "EUR", quote: "USD", slug: "eur-usd" },
  { base: "GBP", quote: "USD", slug: "gbp-usd" },
  { base: "USD", quote: "JPY", slug: "usd-jpy" },
  { base: "USD", quote: "CHF", slug: "usd-chf", show: "standard" },
  { base: "AUD", quote: "USD", slug: "aud-usd", show: "standard" },
  { base: "USD", quote: "CAD", slug: "usd-cad", show: "standard" },
];

/** One module of the room: a numbered heading in the margin, content beside it. */
function Module({ n, id, title, lead, note, children }: { n: string; id: string; title: string; lead: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="hairline">
      <div className="wrap grid grid-cols-[minmax(0,1fr)] gap-x-55 gap-y-21 py-34 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.618fr)] lg:py-55">
        <div>
          <p className="num text-xs font-semibold tracking-[0.1em] text-ink-3">{n}</p>
          <h2 id={id} className="h3 mt-8">
            {title}
          </h2>
          <p className="mt-8 max-w-[32ch] text-sm text-ink-3" data-show="standard">
            {lead}
          </p>
          {note}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

async function Fixings() {
  const r = await getReferenceRates();
  if (r.status !== "ok") {
    return (
      <div className="panel-quiet p-21">
        <p className="h4">Reference rates are temporarily unavailable.</p>
        <p className="mt-8 max-w-measure text-sm text-ink-2">The provider of the ECB daily fixings could not be reached ({r.reason.toLowerCase()}). Nothing is shown in their place.</p>
        <DataNote className="mt-13" status="unavailable" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} />
      </div>
    );
  }
  const ranking = strength(r, 5);
  return (
    <div>
      <ul className="grid grid-cols-1 border-l border-t border-line sm:grid-cols-3">
        {PAIRS.map((p) => (
          <li key={p.slug} className="border-b border-r border-line" data-show={p.show}>
            <Link href={`/markets/forex/${p.slug}`} className="group block p-13 transition-colors duration-fast hover:bg-surface sm:p-21">
              <span className="flex items-baseline justify-between gap-8">
                <span className="text-sm font-semibold tracking-[0.04em]">
                  {p.base}/{p.quote}
                </span>
                <Change value={crossChange(r, p.base, p.quote, 1)} className="text-xs" />
              </span>
              <span className="num mt-8 block font-display text-xl font-light">{formatRate(crossRate(r, p.base, p.quote), p.quote)}</span>
              <span data-show="standard" className="mt-8 block">
                <Sparkline values={crossSeries(r, p.base, p.quote).slice(-21)} width={144} height={34} className="w-full" label={`${p.base}/${p.quote} reference fixings, last 21 working days`} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-34" data-show="deep">
        <h3 className="label">Relative strength over the last five fixings</h3>
        <ol className="mt-13 grid gap-x-34 border-t border-line-strong sm:grid-cols-2">
          {ranking.map((c, i) => (
            <li key={c.code} className="flex items-baseline justify-between gap-13 border-b border-line py-8">
              <span className="flex items-baseline gap-13">
                <span className="num w-[1.3125rem] text-xs text-ink-3">{i + 1}</span>
                <span className="font-medium">{c.code}</span>
              </span>
              <span className="num text-sm text-ink-2">{formatPct(c.value)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-13 max-w-measure text-xs text-ink-3">
          Each figure is the currency’s average change against the other seven over five fixings: a description of what the reference rates already did, not a signal or a forecast.{" "}
          <Link href="/markets/currency-strength" className="link">
            Currency strength
          </Link>
        </p>
      </div>

      <DataNote className="mt-21" status="reference" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} updated={formatFixingDate(r.date)}>
        Daily fixings, not live or tradable prices. Change is versus the previous fixing.
      </DataNote>
    </div>
  );
}

export default function MorningRoomPage() {
  // The day's lesson and term are chosen by the calendar, not by an editor or an algorithm:
  // the day number (UTC) indexes each list, so every visitor sees the same pair on the same day.
  const day = Math.floor(Date.now() / 86_400_000);
  const [article] = latestArticles(1);
  const lesson = lessons.length ? lessons[day % lessons.length] : undefined;
  const term = glossary[(day * 7) % glossary.length];

  return (
    <>
      <JsonLd data={webPageSchema({ path: "/morning-room", name: "Morning Room", description })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Intelligence", href: "/intelligence" },
          { name: "Morning Room", href: "/morning-room" },
        ]}
        eyebrow="The Morning Room"
        title={
          <>
            <Greeting />.
          </>
        }
        lead="A calm page for the start of the day: what is open, where the reference fixings stand, what is scheduled, and something worth reading. No signals and no predictions."
        aside={
          <aside aria-label="Today" className="border-t-2 border-ink pt-13">
            <p className="label">Today</p>
            <p className="mt-13 font-display text-xl font-light leading-tight lg:text-2xl">
              <EditionDate />
            </p>
            <p className="mt-8 text-sm text-ink-2">
              <LocalClock />
            </p>
            <p className="mt-8 text-xs text-ink-3">Read from your device clock.</p>
          </aside>
        }
        companion={
          <HeroCompanion layout="beside" label="By the date" figure={<DayWheel />}>
            The lesson and the term further down are picked by the calendar date, in rotation, and change at 00:00 UTC. Nothing here is personalised, ranked or tracked.
          </HeroCompanion>
        }
      />

      {/* in three stretches of the year markets are known to be different: one line says so, and nothing is shown outside them */}
      <div className="wrap empty:hidden pt-21">
        <SeasonNote />
      </div>
      <SessionStrip />

      <DepthRoom>
        <Module n="01" id="mr-sessions" title="Sessions" lead="Where the trading day is, in the four conventional FX sessions and in your own time.">
          <FxSessionsToday />
          <p className="mt-21 flex flex-wrap items-center gap-x-13 gap-y-3 text-xs text-ink-3">
            <span className="chip">Schedule</span>
            <span data-show="standard">{SCHEDULE_NOTE}</span>
            <Link href="/markets/clock" className="link inline-flex min-h-[2.75rem] items-center">
              World Market Clock
            </Link>
          </p>
        </Module>

        <Module n="02" id="mr-fixings" title="Reference fixings" lead="The European Central Bank’s daily euro reference rates, crossed into the major pairs.">
          <Fixings />
        </Module>

        <Module
          n="03"
          id="mr-events"
          title="Scheduled events"
          lead="TradingView’s calendar, on request, and where each release is published."
          note={
            <div data-show="standard">
              <FigureNote figure={<Cadence />} label="How to read this list" className="!mt-21">
                Each row names a release, its kind and how often it appears. Open one to see what it measures. For the date and time of the next one, the publisher’s own calendar is the authority.
              </FigureNote>
            </div>
          }
        >
          <p className="max-w-measure text-sm text-ink-2">
            GIO4X does not publish its own economic calendar. The panel below is TradingView’s, loaded at your request; each publisher’s own calendar remains the authority.{" "}
            <Link href="/markets/events" className="link">
              What the main releases measure
            </Link>
          </p>
          <EconomicCalendar compact className="mt-13" />
          <div className="mt-21" data-show="standard">
            <h3 className="label">Releases most calendars carry</h3>
            <ul className="mt-13 border-t border-line-strong">
              {econEvents.map((e) => (
                <li key={e.slug} className="grid gap-x-34 gap-y-3 border-b border-line py-13 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)] sm:items-baseline">
                  <Link href={`/markets/events/${e.slug}`} className="font-medium text-ink transition-colors duration-fast hover:text-accent">
                    {e.name}
                  </Link>
                  <span className="text-sm text-ink-3">
                    {e.kind}. {e.cadence}.
                    <span data-show="deep" className="mt-3 block">
                      Published by{" "}
                      {e.publishers.map((p, i) => (
                        <span key={p.url}>
                          {i > 0 && ", "}
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="link">
                            {p.body}
                          </a>
                        </span>
                      ))}
                      .
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Module>

        <Module n="04" id="mr-reading" title="Today’s reading" lead="The latest piece from Intelligence, with a lesson and a term chosen by the calendar.">
          <div className="grid gap-px overflow-hidden rounded border border-line bg-line lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)]">
            {article && (
              <article className="bg-bg p-21 lg:p-34">
                <p className="label">
                  Intelligence · {article.format} · {sectionLabels[article.section]}
                </p>
                <h3 className="h3 mt-13 max-w-[22ch]">
                  <Link href={`/intelligence/${article.slug}`} className="transition-colors duration-fast hover:text-accent">
                    {article.title}
                  </Link>
                </h3>
                <p className="mt-13 max-w-measure text-ink-2" data-show="standard">
                  {article.excerpt}
                </p>
                <ol className="mt-21 max-w-measure border-t border-line" data-show="deep">
                  {article.brief.map((b, i) => (
                    <li key={i} className="grid grid-cols-[2.125rem_1fr] gap-x-8 border-b border-line py-8 text-sm text-ink-2">
                      <span className="num pt-2 text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-21 flex flex-wrap items-center gap-x-21 gap-y-5 text-xs text-ink-3">
                  <span className="num">{article.readMinutes} min read</span>
                  <Link href="/intelligence" className="go min-h-[2.75rem]">
                    All Intelligence
                  </Link>
                </p>
              </article>
            )}
            <div className="grid gap-px bg-line">
              <article className="bg-bg p-21">
                <p className="label">Term of the day</p>
                <h3 className="h4 mt-8">
                  <Link href={`/glossary/${term.slug}`} className="transition-colors duration-fast hover:text-accent">
                    {term.term}
                  </Link>
                </h3>
                <p className="mt-5 text-sm text-ink-2">{firstSentence(term.definition, 180)}</p>
                {term.formula && (
                  <p className="num mt-8 text-sm text-ink" data-show="deep">
                    {term.formula}
                  </p>
                )}
                {term.example && (
                  <p className="mt-8 text-sm text-ink-3" data-show="deep">
                    {term.example}
                  </p>
                )}
              </article>
              {lesson && (
                <article className="bg-bg p-21" data-show="standard">
                  <p className="label">Lesson of the day · {lesson.level}</p>
                  <h3 className="h4 mt-8">
                    <Link href={`/academy/${lesson.slug}`} className="transition-colors duration-fast hover:text-accent">
                      {lesson.title}
                    </Link>
                  </h3>
                  <p className="mt-5 text-sm text-ink-2">{lesson.description}</p>
                  <p className="num mt-8 text-xs text-ink-3">{lesson.readMinutes} min read</p>
                </article>
              )}
            </div>
          </div>
          <p className="mt-13 max-w-measure text-xs text-ink-3" data-show="deep">
            The lesson and the term change each day at 00:00 UTC. They are picked by the calendar date, in rotation: nothing here is personalised, ranked or tracked.
          </p>
        </Module>
      </DepthRoom>

      <section className="hairline section-quiet" aria-label="Note">
        <div className="wrap">
          <p className="max-w-measure text-sm text-ink-3">{educationalNote} Nothing on this page is a signal, a forecast or a suggestion to trade.</p>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Markets", label: "Market Command", href: "/markets", note: "Sessions, structure and reference data." },
          { kind: "Schedule", label: "World Market Clock", href: "/markets/clock", note: "Nine financial centres, right now." },
          { kind: "Read", label: "Intelligence", href: "/intelligence", note: "Today’s edition." },
          { kind: "Practice", label: "Trader Toolkit", href: "/tools", note: "Work the numbers before the day begins." },
        ]}
      />
    </>
  );
}
