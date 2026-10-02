import Link from "next/link";
import { MARKET, ROLLOVER_TICKS, SIM } from "@/components/labs/simulator/engine";
import { PracticeDesk } from "@/components/labs/simulator/PracticeDesk";
import { DataNote, NextSteps, PageHero } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Practice desk: a trading simulation on invented prices",
  description:
    "A sandbox for the mechanics of a trade. Place, manage and close example positions on an invented price generated in your browser, with every calculation shown. A simulation: no real instrument, prices or money.",
  path: "/labs/simulator",
});

/** How the engine decides things, in the order it decides them (components/labs/simulator/engine.ts). */
const rules = [
  { t: "The price is a seeded random walk.", d: `It starts at ${SIM.startPrice.toFixed(4)}, moves a fraction of a pip every tick of ${SIM.tickSeconds} simulated seconds, now and then runs faster for a stretch, and rarely jumps: a gap of ${MARKET.gapMinPips} to ${MARKET.gapMinPips + MARKET.gapSpanPips - 1} pips with no trading in between. The same market number always produces the same prices.` },
  { t: "Fills are at the simulated bid and ask.", d: `A buy opens at the ask and closes at the bid; a sell does the opposite. The spread is fixed at ${SIM.spreadPips} pips and is paid on entry, which is why a new position starts slightly negative.` },
  { t: "On an ordinary tick an order fills at its own level.", d: "Between two ordinary ticks the price is treated as having traded through every level in between, so a stop loss, a take profit, a limit or a stop order is filled at the price it names." },
  { t: "After a gap it fills at the first price available.", d: "Nothing traded inside a gap. A stop that the price jumped over is filled at the next bid or ask, and the journal says “slipped by” and how many pips. A stop is an instruction, not a promise of a price. A limit that was jumped over is filled at the better price." },
  { t: "Margin is set aside when a position opens.", d: "Lots × contract size × price ÷ leverage, at the fill price. An order that needs more margin than is free is refused, and a waiting order that cannot be margined when it triggers is cancelled; both are written in the journal." },
  { t: "The account is revalued every tick.", d: `Equity is the balance plus the floating result; free margin is equity less used margin; the margin level is equity ÷ used margin × 100. At or below ${SIM.marginCallLevel}% a margin call warning appears. At or below ${SIM.stopOutLevel}% positions are closed automatically, the largest loss first, until the level is above it again.` },
  { t: "Swap is charged at the simulated rollover.", d: `Every ${SIM.rolloverMinutes} simulated minutes (${ROLLOVER_TICKS} ticks) each open position is charged ${SIM.swapPerLot.toFixed(2)} ${SIM.unit} per lot, taken from the balance. A real trading day has one rollover; this one is shortened so that it arrives while you practise.` },
];

const differs = [
  { t: "Liquidity.", d: "Here every order of every size is filled in full, at once. A real market has a limited amount available at each price: large orders move it, quiet hours thin it, and the spread widens and narrows instead of standing still." },
  { t: "Emotions.", d: "Nothing is at stake here, so nothing is felt. Decisions made with real money, after a real loss or in a fast market, are not the decisions made on a practice desk." },
  { t: "Costs.", d: "The spread, the swap and the absence of commission on this page are invented. Real costs depend on the account, the instrument and the moment, and they are charged whether a trade gains or loses." },
  { t: "The price itself.", d: "This price is a random walk with no news, no sessions and no other participants. It cannot be analysed, and nothing learned about its direction applies to any market." },
];

export default function SimulatorPage() {
  return (
    <>
      <PageHero
        quiet
        crumbs={[
          { name: "Labs", href: "/labs" },
          { name: "Practice desk", href: "/labs/simulator" },
        ]}
        eyebrow="GIO4X Labs · Simulation"
        title="Practice desk"
        lead="A sandbox for the mechanics of a trade: place, manage and close example positions on a price that is invented in your browser. It is a simulation throughout. No real instrument, no real prices, no real money."
      />

      <section className="section-quiet" aria-label="Practice desk, a simulation on invented prices">
        <div className="wrap">
          <PracticeDesk />
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="sim-rules">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">The engine’s rules</p>
            <h2 id="sim-rules" className="h3 mt-13">
              How the simulation decides.
            </h2>
            <p className="mt-21 max-w-narrow text-ink-2">
              Ordinary software and a seeded random number generator: no language model, no data feed, nothing sent anywhere. The arithmetic is the same as the{" "}
              <Link href="/tools" className="link">
                Trader Toolkit
              </Link>
              ’s, and the journal shows it for every fill, charge and close.
            </p>
          </div>
          <ol className="border-t border-line">
            {rules.map((r, i) => (
              <li key={r.t} className="grid grid-cols-[3.4375rem_1fr] gap-x-13 border-b border-line py-21">
                <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="h4">{r.t}</h3>
                  <p className="mt-8 max-w-measure text-ink-2">{r.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-quiet hairline" aria-labelledby="sim-differs">
        <div className="wrap phi items-start">
          <div>
            <p className="eyebrow">What it is not</p>
            <h2 id="sim-differs" className="h3 mt-13">
              Real markets behave differently.
            </h2>
            <p className="mt-21 max-w-narrow text-ink-2">
              The desk teaches what the buttons do and how the figures are worked out. It does not show what trading is like, and a result here, good or bad, says nothing about a result anywhere else. The settings are made up for practice: they are not GIO4X’s{" "}
              <Link href="/trading/conditions" className="link">
                trading conditions
              </Link>
              .
            </p>
            <div className="mt-21 grid gap-8">
              <DataNote status="simulation">Invented prices, an invented instrument and an example account. {educationalNote}</DataNote>
            </div>
          </div>
          <ul className="border-t border-line">
            {differs.map((r) => (
              <li key={r.t} className="border-b border-line py-21">
                <h3 className="h4">{r.t}</h3>
                <p className="mt-8 max-w-measure text-ink-2">{r.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Tool", label: "Position Size", href: "/tools/position-size", note: "The sizing formula the ticket uses, with your own figures." },
          { kind: "Glossary", label: "Slippage", href: "/glossary/slippage", note: "Why a fill can differ from the price asked for." },
          { kind: "Trading", label: "Trading conditions", href: "/trading/conditions", note: "What GIO4X publishes, as opposed to this page’s invented settings." },
          { kind: "Labs", label: "All experiments", href: "/labs", note: "What Labs is, and what is on the bench." },
        ]}
      />
    </>
  );
}
