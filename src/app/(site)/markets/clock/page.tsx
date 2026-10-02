import Link from "next/link";
import { HeroCompanion } from "@/components/figures/markets/HeroCompanion";
import { Sundial } from "@/components/figures/markets/Sundial";
import { ClockBoard } from "@/components/markets/ClockBoard";
import { hhmm } from "@/components/markets/time";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";
import { centres, fxSessions, SCHEDULE_NOTE } from "@/lib/sessions";

const DESCRIPTION =
  "Which financial centres are in regular trading hours right now: nine exchanges and the four FX sessions with local time, time to the next change and a 24-hour ribbon in your time zone, UTC, London or New York. A schedule computed from your clock, not a data feed.";

export const metadata = pageMeta({ title: "World Market Clock", description: DESCRIPTION, path: "/markets/clock" });

const overlaps = [
  {
    t: "Sydney × Tokyo",
    d: "The Asia-Pacific morning. Both windows are open for most of the Tokyo business day, which is when the yen, the Australian dollar and the New Zealand dollar have their home sessions.",
  },
  {
    t: "Tokyo × London",
    d: "A short hand-over at the start of the European day, as Asian desks close and London opens. Its length changes with daylight saving in the United Kingdom.",
  },
  {
    t: "London × New York",
    d: "The European afternoon and the American morning. Two of the largest FX centres are open together, and it is typically the most active window of the day. Activity is not direction: it says nothing about where a price will go.",
  },
];

const lunchCities = centres
  .filter((c) => c.lunch)
  .map((c) => c.city)
  .join(", ")
  .replace(/, ([^,]*)$/, " and $1");

export default function ClockPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/markets/clock", name: "World Market Clock", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Markets", href: "/markets" },
          { name: "World Market Clock", href: "/markets/clock" },
        ]}
        eyebrow="Schedule"
        title="World Market Clock"
        lead={`${centres.length} financial centres and the four foreign-exchange sessions, read from your own clock.`}
        aside={
          <div className="border-l-2 border-warn pl-13">
            <p className="label">Read this first</p>
            <p className="mt-5 text-sm text-ink">This is a timetable, not a data feed. {SCHEDULE_NOTE}</p>
            <p className="mt-5 text-sm text-ink-3">Before trading around a holiday, check the exchange’s own calendar.</p>
          </div>
        }
        companion={
          <HeroCompanion layout="beside" figure={<Sundial />}>
            The FX week runs from Monday morning in Sydney to 17:00 on Friday in New York. Between sessions, quotes continue with fewer participants.
          </HeroCompanion>
        }
      />

      <section className="section-quiet" aria-label="Clock">
        <div className="wrap">
          <ClockBoard />
        </div>
      </section>

      {/* the sessions, explained */}
      <section className="section hairline bg-paper" aria-labelledby="sessions-title">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">How to read it</p>
            <h2 id="sessions-title" className="h2 mt-13">
              Four sessions, one continuous market.
            </h2>
            <p className="lead mt-13 max-w-[30rem]">Foreign exchange has no single exchange and no opening bell. It trades wherever banks are at their desks, so the day is described by the business hours of four cities.</p>
            <p className="mt-21 max-w-[30rem] text-sm text-ink-3">
              The FX week runs from Monday morning in Sydney to 17:00 on Friday in New York. The session windows below are a convention, not a rule: quotes continue between them, with fewer participants.
            </p>
          </div>
          <div className="min-w-0">
            <div className="scroll-x">
              <table className="table-gx min-w-[26rem]">
                <caption className="sr-only">Conventional FX session windows in each city’s local time</caption>
                <thead>
                  <tr>
                    <th scope="col">Session</th>
                    <th scope="col">Window, local time</th>
                    <th scope="col" className="!pr-0">
                      Time zone
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fxSessions.map((s) => (
                    <tr key={s.key}>
                      <th scope="row" className="!border-line !text-[0.9375rem] !font-medium !normal-case !tracking-normal !text-ink">
                        {s.name}
                      </th>
                      <td className="num text-[0.9375rem]">
                        {hhmm(s.open)}–{hhmm(s.close)}
                      </td>
                      <td className="!pr-0 text-sm text-ink-3">{s.tz.replace(/_/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="label mt-34">The overlaps</h3>
            <ul className="mt-13 border-t border-line-strong">
              {overlaps.map((o) => (
                <li key={o.t} className="grid gap-x-21 gap-y-3 border-b border-line py-13 sm:grid-cols-[11rem_1fr]">
                  <span className="state state-overlap self-start pt-3">{o.t}</span>
                  <span className="text-sm text-ink-2">{o.d}</span>
                </li>
              ))}
            </ul>
            <p className="mt-13 text-xs text-ink-3">
              Which overlaps exist, and for how long, depends on the season: the ribbon above draws them for today’s date.{" "}
              <Link href="/markets/forex" className="link">
                How the forex market is structured
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* reading the states */}
      <section className="section-quiet hairline" aria-labelledby="states-title">
        <div className="wrap phi items-start">
          <div>
            <h2 id="states-title" className="h3">
              What the four states mean.
            </h2>
            <dl className="mt-21 grid border-l border-t border-line sm:grid-cols-2">
              {[
                { c: "state-open", k: "Open", d: "Inside the venue’s regular weekday session." },
                { c: "state-pre", k: "Pre-open", d: "Within the hour before the regular session begins." },
                { c: "state-pre", k: "Midday break", d: `The scheduled lunch pause observed by ${lunchCities}.` },
                { c: "state-off", k: "Closed", d: "Outside regular hours, or a weekend. The time shown is to the next regular open." },
              ].map((x) => (
                <div key={x.k} className="border-b border-r border-line p-13">
                  <dt className={`state ${x.c}`}>{x.k}</dt>
                  <dd className="mt-5 text-sm text-ink-2">{x.d}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:pt-55">
            <h3 className="label">What it does not know</h3>
            <ul className="mt-13 border-t border-line">
              {["Public holidays and half-days at any venue.", "Pre-market, after-hours and auction phases.", "Trading halts or changes to an exchange’s timetable.", "The hours GIO4X offers on any particular instrument."].map((x) => (
                <li key={x} className="flex gap-8 border-b border-line py-8 text-sm text-ink-2">
                  <span aria-hidden className="mt-[0.7em] h-px w-13 shrink-0 bg-ink-3" />
                  {x}
                </li>
              ))}
            </ul>
            <Link href="/trust/data-methodology" className="go mt-8 py-13 md:mt-21 md:py-0">
              Data methodology
            </Link>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Markets", label: "Market Command", href: "/markets", note: "Sessions, reference rates and six asset classes." },
          { kind: "Asset class", label: "Forex", href: "/markets/forex", note: "The market the four sessions describe." },
          { kind: "Explainers", label: "Economic Events", href: "/markets/events", note: "The scheduled releases markets commonly watch." },
          { kind: "Trading", label: "Trading conditions", href: "/trading/conditions", note: "Published spreads, leverage and lot sizes." },
        ]}
      />
    </>
  );
}
