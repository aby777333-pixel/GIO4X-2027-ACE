import Link from "next/link";
import { Forge } from "@/components/labs/workshop/Forge";
import { GuessCandle } from "@/components/labs/workshop/GuessCandle";
import { BuildCandle, DrawChart, RiskDial } from "@/components/labs/more/More";
import { PipReels } from "@/components/labs/workshop/PipReels";
import { SixtySeconds } from "@/components/labs/workshop/SixtySeconds";
import { Tightrope } from "@/components/labs/workshop/Tightrope";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PunchLine } from "@/components/ui/PunchLine";
import { riskWarning } from "@/config/legal";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "Five small machines that each teach one idea: a candle forged from its four prices, leverage walked on a tightrope, a hidden candle to guess, reels that work out what a pip is worth, and one minute on an invented price. Invented figures only: no market data and nothing to win.";

export const metadata = pageMeta({ title: "The Workshop", description: DESCRIPTION, path: "/labs/workshop" });

const machines = [
  {
    id: "forge",
    n: "01",
    eyebrow: "Candle forge",
    title: "Four prices, hammered into one shape.",
    lead: "A candlestick made the way a blade is made: poured at the open, drawn out to the high and the low, cooled at the close.",
    go: { href: "/glossary/candlestick", label: "Candlestick, defined" },
    body: <Forge />,
  },
  {
    id: "tightrope",
    n: "02",
    eyebrow: "Leverage on a tightrope",
    title: "The market sways the same. The line moves.",
    lead: "Leverage does not make a market move more. It brings closer the point at which the margin for a position is gone. Move the slider and watch the line rise to the wire.",
    go: { href: "/tools/leverage-visualizer", label: "Leverage visualiser" },
    body: <Tightrope />,
  },
  {
    id: "guess",
    n: "03",
    eyebrow: "Guess the candle",
    title: "Up or down? Nobody can know.",
    lead: "Sixteen candles and one you cannot see. The hidden one is a coin flip, so the chart cannot help you. That is the lesson.",
    go: { href: "/intelligence/blog/reading-a-candle-in-ten-seconds", label: "Reading a candle in ten seconds" },
    body: <GuessCandle />,
  },
  {
    id: "reels",
    n: "04",
    eyebrow: "The pip reels",
    title: "A pair, a size, a move: what is it worth?",
    lead: "Three reels and one sum. A pip is a distance; it only becomes money when the size is known.",
    go: { href: "/tools/pip-value", label: "Pip value calculator" },
    body: <PipReels />,
  },
  {
    id: "sixty",
    n: "05",
    eyebrow: "Sixty seconds",
    title: "One minute to beat the desk.",
    lead: "An invented price, one position at a time, and one pip of spread on every trade. See what is left when the minute ends, and why.",
    go: { href: "/intelligence/blog/what-the-spread-costs-you-over-a-year", label: "What the spread costs you over a year" },
    body: <SixtySeconds />,
  },
  {
    id: "build",
    n: "06",
    eyebrow: "Build a candle",
    title: "Four handles, one shape, and its name.",
    lead: "Set where it opened, where it closed and how far it reached each way. The shape you make is named, with what the name does and does not mean.",
    go: { href: "/academy/candlestick-patterns-masterclass", label: "Lesson: candlestick patterns" },
    body: <BuildCandle />,
  },
  {
    id: "draw",
    n: "07",
    eyebrow: "Draw a chart",
    title: "Sketch a line. It is read back to you.",
    lead: "Draw with a finger or the mouse. Its average is laid over it and each stretch is named: a rise, a fall, a range.",
    go: { href: "/glossary/moving-average", label: "Moving average, defined" },
    body: <DrawChart />,
  },
  {
    id: "dial",
    n: "08",
    eyebrow: "The risk dial",
    title: "One dial. Turn it and watch the weather.",
    lead: "The share of the account risked on each trade, and what ten losses in a row would leave.",
    go: { href: "/tools/position-size", label: "Position size calculator" },
    body: <RiskDial />,
  },
];

export default function WorkshopPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/labs/workshop", name: "The Workshop", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Labs", href: "/labs" },
          { name: "The Workshop", href: "/labs/workshop" },
        ]}
        eyebrow="GIO4X Labs · Experiment"
        title="The Workshop"
        lead="Eight small machines, one idea each. Everything in them is invented: there is no market data here and nothing to win."
      >
        <a href="#forge" className="btn btn-primary">
          Start at the forge
        </a>
      </PageHero>

      {machines.map((m, i) => (
        <section key={m.id} id={m.id} data-machine className={`section scroll-mt-[var(--header-h)] ${i ? "hairline" : ""} ${i % 2 ? "bg-paper" : ""}`} aria-labelledby={`${m.id}-h`}>
          <div className="wrap phi phi-r items-start">
            <div className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
              <p className="gx-numeral" aria-hidden>
                {m.n}
              </p>
              <p className="eyebrow mt-8">{m.eyebrow}</p>
              <h2 id={`${m.id}-h`} className="h2 mt-13">
                {m.title}
              </h2>
              <p className="lead mt-13 max-w-[30rem]">{m.lead}</p>
              <Link href={m.go.href} className="go mt-21">
                {m.go.label}
              </Link>
            </div>
            <div className="min-w-0">{m.body}</div>
          </div>
        </section>
      ))}

      <section className="section-quiet hairline" aria-label="Risk warning">
        <div className="wrap">
          <p className="text-sm text-ink-3">{riskWarning}</p>
        </div>
      </section>

      <PunchLine k="risk" />

      <NextSteps
        items={[
          { kind: "Labs", label: "Practice desk", href: "/labs/simulator", note: "A practice trade on invented prices, told step by step." },
          { kind: "Tool", label: "Position size", href: "/tools/position-size", note: "The size that fits a stop and a risk amount." },
          { kind: "Blog", label: "Leverage: the loan nobody reads", href: "/intelligence/blog/leverage-the-loan-nobody-reads", note: "What leverage changes, and what it does not." },
          { kind: "Labs", label: "All experiments", href: "/labs", note: "What Labs is, and what is on the bench." },
        ]}
      />
    </>
  );
}
