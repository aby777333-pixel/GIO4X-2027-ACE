import Link from "next/link";
import { Dance, Marbles, MarginCountdown, SlowSlip, Staircase, SwapClock } from "@/components/labs/engine/Machines";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PunchLine } from "@/components/ui/PunchLine";
import { riskWarning } from "@/config/legal";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION = "Six machines about what happens to a trade once it is on: the margin-call countdown, the swap clock, slippage in slow motion, the compounding staircase, the correlation dance and a hundred coin-flip accounts. Examples and arithmetic only: no market data and no account conditions.";

export const metadata = pageMeta({ title: "The Engine Room", description: DESCRIPTION, path: "/labs/engine-room" });

const machines = [
  { id: "margin", eyebrow: "The margin-call countdown", title: "Watch the cushion go.", lead: "An example account as the price moves against it: warning, margin call, stop-out.", go: { href: "/tools/margin", label: "Margin calculator" }, body: <MarginCountdown /> },
  { id: "swap", eyebrow: "The swap clock", title: "Five rollovers, seven nights.", lead: "Hold a position through the week and see when each night is settled, and which day settles three.", go: { href: "/glossary/swap", label: "Swap, defined" }, body: <SwapClock /> },
  { id: "slip", eyebrow: "Slippage in slow motion", title: "The stop was there. The price was not.", lead: "A release, a gap and a fill, one frame at a time.", go: { href: "/glossary/slippage", label: "Slippage, defined" }, body: <SlowSlip /> },
  { id: "stairs", eyebrow: "The compounding staircase", title: "The climb back is taller than the fall.", lead: "Set a loss and see the gain it takes to stand where you began.", go: { href: "/tools/drawdown", label: "Drawdown calculator" }, body: <Staircase /> },
  { id: "dance", eyebrow: "The correlation dance", title: "Two positions, or one in disguise?", lead: "Tie two series together, loosely or tightly, and watch them move.", go: { href: "/glossary/correlation", label: "Correlation, defined" }, body: <Dance /> },
  { id: "marbles", eyebrow: "The marbles", title: "Same coin. Different share risked.", lead: "A hundred accounts, fifty coin flips each. Change only how much each trade risks.", go: { href: "/tools/position-size", label: "Position size calculator" }, body: <Marbles /> },
];

export default function Page() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/labs/engine-room", name: "The Engine Room", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Labs", href: "/labs" },
          { name: "The Engine Room", href: "/labs/engine-room" },
        ]}
        eyebrow="GIO4X Labs · Experiment"
        title="The Engine Room"
        lead="Six machines about what happens to a trade once it is on. Each shows one mechanism, with figures that are arithmetic or plain examples and say which."
      />

      {machines.map((m, i) => (
        <section key={m.id} id={m.id} data-machine className={`section scroll-mt-[var(--header-h)] ${i ? "hairline" : ""} ${i % 2 ? "bg-paper" : ""}`} aria-labelledby={`${m.id}-h`}>
          <div className="wrap phi phi-r items-start">
            <div className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
              <p className="gx-numeral" aria-hidden>
                {String(i + 1).padStart(2, "0")}
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
          <p className="max-w-measure text-sm text-ink-3">{riskWarning}</p>
        </div>
      </section>

      <PunchLine k="arithmetic" />

      <NextSteps
        items={[
          { kind: "Labs", label: "The Workshop", href: "/labs/workshop", note: "Candle forge, tightrope, pip reels and sixty seconds." },
          { kind: "Labs", label: "Forces", href: "/labs/forces", note: "Four models of what moves a market." },
          { kind: "Academy", label: "Practice room", href: "/academy/practice", note: "Build an order, fix a ticket, race the glossary." },
          { kind: "Legal", label: "Risk disclosure", href: "/legal/risk", note: "Read this before trading with leverage." },
        ]}
      />
    </>
  );
}
