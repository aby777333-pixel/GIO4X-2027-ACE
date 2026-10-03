import Link from "next/link";
import { SessionGlobe } from "@/components/labs/session-globe/SessionGlobe";
import { SessionGlobeStill } from "@/components/labs/session-globe/SessionGlobeStill";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";
import "@/components/labs/three/labs3d.css";

const DESCRIPTION =
  "A globe you can turn, showing which of the four FX sessions (Sydney, Tokyo, London, New York) are open now and where day meets night. Computed from the clock and the conventional session windows, with the same reading as a plain list. A schedule, not a data feed.";

export const metadata = pageMeta({ title: "Session globe", description: DESCRIPTION, path: "/labs/session-globe" });

const reads = [
  { t: "Open or closed", d: "Each session has a conventional window in its own city’s time, Monday to Friday. The clock is converted to that city’s time, daylight saving included, and compared with the window. That is all “open” means here." },
  { t: "Overlap", d: "When two sessions are inside their windows at once, a line joins them on the globe and the list says so. It shows that both are open, and nothing about what passes between them." },
  { t: "Day and night", d: "The sun’s position is worked out from the date and the UTC time. The champagne line is where it is on the horizon; the small ring is where it is overhead." },
  { t: "The land", d: "A coarse field of points, the same one the other globes on this site use. It is there to tell the continents apart, not to navigate by." },
];

const absent = ["Prices, volumes or any measure of how busy a session is.", "Public holidays and early closes.", "The hours GIO4X offers on any particular instrument.", "Anything fetched from a server: the reading is made in your browser from your own clock."];

export default function SessionGlobePage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/labs/session-globe", name: "Session globe", description: DESCRIPTION })} />
      <PageHero
        quiet
        scene="clock"
        crumbs={[
          { name: "Labs", href: "/labs" },
          { name: "Session globe", href: "/labs/session-globe" },
        ]}
        eyebrow="GIO4X Labs · Experiment"
        title="Session globe"
        lead="Which of the four FX sessions are open at this minute, on a globe you can turn, with the line between day and night. Worked out from the clock, and from nothing else."
      />

      <section className="section-quiet" aria-label="The globe and the four sessions">
        <div className="wrap">
          <SessionGlobe still={<SessionGlobeStill />} />
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="sg-read">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">How it is worked out</p>
            <h2 id="sg-read" className="h2 mt-13">
              A clock, four windows and the sun.
            </h2>
            <p className="lead mt-13 max-w-[30rem]">
              The globe is a picture of the list beside it. For the whole day as a film, see{" "}
              <Link href="/labs/market-day" className="link">
                One day of markets
              </Link>
              ; for nine exchanges and their own hours, the{" "}
              <Link href="/markets/clock" className="link">
                World Market Clock
              </Link>
              .
            </p>
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

            <h3 className="label mt-34">What the globe does not know</h3>
            <ul className="mt-8 border-t border-line">
              {absent.map((x) => (
                <li key={x} className="flex gap-8 border-b border-line py-8 text-sm text-ink-2">
                  <span aria-hidden className="mt-[0.7em] h-px w-13 shrink-0 bg-ink-3" />
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-13 max-w-measure text-xs text-ink-3">
              The 3D view needs WebGL. Where it is not available, a flat map stands in its place and the list is unchanged. With reduced motion the globe does not turn by itself.{" "}
              <Link href="/trust/data-methodology" className="link">
                Data methodology
              </Link>
            </p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Markets", label: "World Market Clock", href: "/markets/clock", note: "Nine exchanges and the four sessions, for the present minute." },
          { kind: "Labs", label: "One day of markets", href: "/labs/market-day", note: "The same day, played as a two-minute film." },
          { kind: "Asset class", label: "Forex", href: "/markets/forex", note: "The market the four sessions describe." },
          { kind: "Labs", label: "All experiments", href: "/labs", note: "What Labs is, and what is on the bench." },
        ]}
      />
    </>
  );
}
