import Link from "next/link";
import { DayRing } from "@/components/figures/extra/ShortColumns";
import { FX_SHORT } from "@/components/labs/market-day/film";
import { MarketDay } from "@/components/labs/market-day/MarketDay";
import { hhmm } from "@/components/markets/time";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";
import { centres, fxSessions } from "@/lib/sessions";

const DESCRIPTION =
  "One whole UTC day of markets as a two-minute film you can scrub: the line between night and day crossing a globe, nine financial centres lighting as their regular sessions open, and the four FX sessions on a 24-hour dial. A schedule and the sun’s position, not a data feed.";

export const metadata = pageMeta({ title: "One day of markets", description: DESCRIPTION, path: "/labs/market-day" });

const reads = [
  { t: "The globe", d: "Land is a coarse field of points, brighter where the sun is up. The line between night and day is where the sun puts it at that minute of that date; a small rayed ring marks the place where the sun is overhead." },
  { t: "The nine centres", d: "A filled lamp is a centre inside its regular session, a half lamp is its midday break, a ring is the hour before its open, and a small dot is closed. A half sun stands over a centre while sunrise or sunset passes it." },
  { t: "The arcs", d: "A line joins every two centres that are inside their regular sessions at the same time. It shows that both are open, and nothing about what passes between them." },
  { t: "The dial", d: "Twenty-four hours of UTC run clockwise from the top. The four FX windows sit on it in two lanes, so that an overlap reads as two bands side by side, and the hand marks the minute being shown." },
];

const absent = ["Prices, volumes or any measure of how busy a market is.", "Public holidays, half-days and early closes at any venue.", "Pre-market, after-hours and auction phases.", "The hours GIO4X offers on any particular instrument."];

export default function MarketDayPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/labs/market-day", name: "One day of markets", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Labs", href: "/labs" },
          { name: "One day of markets", href: "/labs/market-day" },
        ]}
        eyebrow="GIO4X Labs · Experiment"
        title="One day of markets"
        lead="Twenty-four hours of UTC, played in about two minutes. Watch the day cross the globe and the centres open and close in turn, or take the slider and stop on any minute."
      />

      <section className="section-quiet" aria-label="The film">
        <div className="wrap">
          <MarketDay />
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="md-read">
        <div className="wrap phi phi-r items-start">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
            <p className="eyebrow">How to read it</p>
            <h2 id="md-read" className="h2 mt-13">
              A timetable and the sun. Nothing else.
            </h2>
            <p className="lead mt-13 max-w-[30rem]">
              The film is drawn from the regular hours of {centres.length} exchanges, the {fxSessions.length} conventional FX windows and the position of the sun. It is the cinematic companion of the{" "}
              <Link href="/markets/clock" className="link">
                World Market Clock
              </Link>
              , which reads the same timetable for the present minute.
            </p>
            {/* the short column was empty beneath the heading: a figure that says the same thing as the text beside it */}
            <div className="mt-34 hidden max-w-[28rem] lg:block">
              <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">
                <DayRing />
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <dl className="border-t border-line-strong">
              {reads.map((r) => (
                <div key={r.t} className="grid gap-x-21 gap-y-3 border-b border-line py-13 sm:grid-cols-[9rem_1fr]">
                  <dt className="h4">{r.t}</dt>
                  <dd className="text-sm text-ink-2">{r.d}</dd>
                </div>
              ))}
            </dl>

            <h3 className="label mt-34">The FX windows on the dial</h3>
            <div className="scroll-x mt-8">
              <table className="table-gx min-w-[24rem]">
                <caption className="sr-only">Conventional FX session windows in each city’s local time, with the letters each carries on the dial</caption>
                <thead>
                  <tr>
                    <th scope="col">On the dial</th>
                    <th scope="col">Session</th>
                    <th scope="col" className="!pr-0">
                      Window, local time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fxSessions.map((s, k) => (
                    <tr key={s.key}>
                      <td className="num text-sm">
                        {FX_SHORT[s.key] ?? s.name} · {k % 2 ? "outer" : "inner"} lane
                      </td>
                      <th scope="row" className="!border-line !text-[0.9375rem] !font-medium !normal-case !tracking-normal !text-ink">
                        {s.name}
                      </th>
                      <td className="num !pr-0 text-[0.9375rem]">
                        {hhmm(s.open)}–{hhmm(s.close)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="label mt-34">What the film does not know</h3>
            <ul className="mt-8 border-t border-line">
              {absent.map((x) => (
                <li key={x} className="flex gap-8 border-b border-line py-8 text-sm text-ink-2">
                  <span aria-hidden className="mt-[0.7em] h-px w-13 shrink-0 bg-ink-3" />
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-13 max-w-measure text-xs text-ink-3">
              The land is schematic, sunrise and sunset are computed and good to a few minutes, and nothing is stored or sent: the film runs in your browser from your own clock.{" "}
              <Link href="/trust/data-methodology" className="link">
                Data methodology
              </Link>
            </p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Markets", label: "World Market Clock", href: "/markets/clock", note: "The same timetable, for the present minute." },
          { kind: "Company", label: "GIO4X on the map", href: "/about/world", note: "Offices, centres and central banks on one globe." },
          { kind: "Asset class", label: "Forex", href: "/markets/forex", note: "The market the four sessions describe." },
          { kind: "Labs", label: "All experiments", href: "/labs", note: "What Labs is, and what is on the bench." },
        ]}
      />
    </>
  );
}
