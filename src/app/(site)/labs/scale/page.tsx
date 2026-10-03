import { LongScroll } from "@/components/labs/scale/LongScroll";
import { SCALES } from "@/components/labs/scale/scales";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PunchLine } from "@/components/ui/PunchLine";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "One long fall from a single tick out to a decade. Scroll, and the window on one invented walk widens through seven scales. It looks much the same at each, which is the lesson: a move is large or small only once the scale is chosen. Not market data.";

export const metadata = pageMeta({ title: "The Long Scroll", description: DESCRIPTION, path: "/labs/scale" });

export default function ScalePage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/labs/scale", name: "The Long Scroll", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Labs", href: "/labs" },
          { name: "The Long Scroll", href: "/labs/scale" },
        ]}
        eyebrow="GIO4X Labs · Experiment"
        title="The Long Scroll"
        lead="One tick, then a minute, an hour, a day, a month, a year, a decade. Scroll down and fall through all seven. An invented walk: not market data."
      />

      <LongScroll />

      <section className="section hairline bg-paper" aria-labelledby="scale-h">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">What the fall shows</p>
            <h2 id="scale-h" className="h2 mt-13">
              It looks the same at every scale.
            </h2>
            <p className="lead mt-13 max-w-[30rem]">Cover the label and you could not say whether you were looking at a minute or a year. So “a big move” means nothing until the scale is named.</p>
          </div>
          <div className="min-w-0">
            <ol className="border-t border-line-strong">
              {SCALES.map((s, i) => (
                <li key={s.name} className="grid grid-cols-[2.125rem_minmax(0,1fr)] gap-x-13 border-b border-line py-13">
                  <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="h4">{s.name}</h3>
                    <p className="mt-3 max-w-measure text-sm text-ink-2">{s.line}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-13 max-w-measure text-xs text-ink-3">
              The walk is generated from a fixed seed and belongs to no instrument. The seven names are a way of speaking about scale; they do not claim that this many points make a year. Real markets are not this walk, though they share this property to a striking degree.
            </p>
          </div>
        </div>
      </section>

      <PunchLine k="scale" />

      <NextSteps
        items={[
          { kind: "Labs", label: "The Workshop", href: "/labs/workshop", note: "Candle forge, tightrope, pip reels and sixty seconds." },
          { kind: "Labs", label: "The Engine Room", href: "/labs/engine-room", note: "Six machines about what happens to a trade." },
          { kind: "Blog", label: "Reading a candle in ten seconds", href: "/intelligence/blog/reading-a-candle-in-ten-seconds", note: "Four prices, one shape." },
          { kind: "Labs", label: "All experiments", href: "/labs", note: "What Labs is, and what is on the bench." },
        ]}
      />
    </>
  );
}
