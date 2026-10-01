import Link from "next/link";
import { RiskNote } from "@/components/trading/Blocks";
import { ConditionsExplorer } from "@/components/trading/ConditionsExplorer";
import { DataNote, NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { indicativeNote, riskWarning } from "@/config/legal";
import { accounts } from "@/data/accounts";
import { hasTerm } from "@/data/glossary";
import { getTool } from "@/data/tools";
import { costConcepts } from "@/data/trading";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Trading conditions",
  description: "Explore GIO4X’s indicative trading conditions by asset class: spread from, leverage, minimum lot and contract for each instrument, with margin call and stop out levels explained.",
  path: "/trading/conditions",
});

export default function ConditionsPage() {
  // Margin call and stop out are the same on all three accounts; read them from the data rather than restating them.
  const marginCall = accounts[0].marginCall;
  const stopOut = accounts[0].stopOut;
  const uniform = accounts.every((a) => a.marginCall === marginCall && a.stopOut === stopOut);

  return (
    <>
      <PageHero
        crumbs={[
          { name: "Trading", href: "/trading" },
          { name: "Trading conditions", href: "/trading/conditions" },
        ]}
        eyebrow="Trading conditions"
        title="Explore trading conditions."
        lead="Choose an asset class, find an instrument, and read what GIO4X has published for it: the minimum spread, the leverage, the smallest trade and what one lot represents."
      />

      <section className="section" aria-label="Instrument conditions">
        <div className="wrap">
          <ConditionsExplorer />
          <DataNote status="indicative" source="GIO4X published trading conditions" className="mt-21">
            {indicativeNote}
          </DataNote>
          <p className="mt-13 max-w-measure text-xs text-ink-3">
            “Spread from” is the minimum, in the unit shown, and is not tied to an account type here; the account you hold changes the spread you pay (see{" "}
            <Link href="/trading/accounts" className="link">
              account types
            </Link>
            ). Leverage is a ceiling, not a recommendation, and may be lower in your jurisdiction. Swap rates and trading hours per instrument are not yet published.
          </p>
        </div>
      </section>

      {/* margin call and stop out */}
      <section className="section hairline bg-paper" aria-labelledby="levels">
        <div className="wrap phi phi-r items-start">
          <div data-reveal>
            <p className="eyebrow">Margin levels</p>
            <h2 id="levels" className="h2 mt-13">
              Margin call and stop out.
            </h2>
            <p className="lead mt-21">Two thresholds on one scale. Margin level is your equity as a percentage of the margin your open positions are using.</p>
            <p className="num mt-21 border-l border-accent pl-13 text-sm text-ink-2">margin level = equity ÷ used margin × 100%</p>
          </div>
          <div data-reveal>
            {uniform ? (
              <>
                <figure>
                  <div className="relative h-55" aria-hidden>
                    <div className="absolute inset-x-0 top-21 h-13 border border-line-strong bg-surface" />
                    <div className="absolute left-0 top-21 h-13 bg-[color-mix(in_srgb,var(--neg)_30%,transparent)]" style={{ width: `${(Number.parseFloat(stopOut) / 200) * 100}%` }} />
                    {[
                      { v: Number.parseFloat(stopOut), l: `Stop out ${stopOut}` },
                      { v: Number.parseFloat(marginCall), l: `Margin call ${marginCall}` },
                    ].map((m) => (
                      <div key={m.l} className="absolute top-0 h-full border-l border-ink" style={{ left: `${(m.v / 200) * 100}%` }}>
                        <span className="num absolute left-5 top-0 whitespace-nowrap text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink">{m.l}</span>
                      </div>
                    ))}
                  </div>
                  <figcaption className="mt-5 flex justify-between text-xs text-ink-3">
                    <span className="num">0%</span>
                    <span>Margin level, lower is closer to closure</span>
                    <span className="num">200%</span>
                  </figcaption>
                </figure>
                <dl className="mt-34 border-t border-line-strong">
                  <div className="grid gap-x-34 gap-y-5 border-b border-line py-21 md:grid-cols-[9rem_1fr]">
                    <dt>
                      <span className="label block">Margin call</span>
                      <span className="num mt-3 block font-display text-2xl text-ink">{marginCall}</span>
                    </dt>
                    <dd className="text-ink-2">
                      When equity falls to the level of the margin in use, the account is at its margin call level. It is a warning: no new positions can be supported, and the account is one adverse move away from positions being closed.{" "}
                      {hasTerm("margin-call") && (
                        <Link href="/glossary/margin-call" className="link">
                          Margin call
                        </Link>
                      )}
                    </dd>
                  </div>
                  <div className="grid gap-x-34 gap-y-5 border-b border-line py-21 md:grid-cols-[9rem_1fr]">
                    <dt>
                      <span className="label block">Stop out</span>
                      <span className="num mt-3 block font-display text-2xl text-ink">{stopOut}</span>
                    </dt>
                    <dd className="text-ink-2">
                      If margin level reaches the stop out level, open positions begin to be closed automatically. In a fast or gapping market the closing price can be worse than the level implies.{" "}
                      {hasTerm("stop-out") && (
                        <Link href="/glossary/stop-out" className="link">
                          Stop out
                        </Link>
                      )}
                    </dd>
                  </div>
                </dl>
                <DataNote status="indicative" source="GIO4X published account conditions" className="mt-13">
                  The same on Classic, Premium and ECN.
                </DataNote>
              </>
            ) : (
              <p className="text-ink-2">
                Margin call and stop out levels differ by account. See{" "}
                <Link href="/trading/accounts" className="link">
                  account types
                </Link>
                .
              </p>
            )}
            <Link href="/tools/margin" className="go mt-21 min-h-[2.75rem] md:min-h-0">
              Work it through in the margin calculator
            </Link>
          </div>
        </div>
      </section>

      {/* plain explanations */}
      <section className="section hairline" aria-labelledby="costs">
        <div className="wrap">
          <SectionHead eyebrow="In plain terms" title={<span id="costs">Four words that decide what a trade costs.</span>} lead="Three of them are costs. The fourth, margin, is not a cost at all, and is the one most often mistaken for one." />
          <dl className="mt-34 border-t border-line-strong lg:mt-55">
            {costConcepts.map((c, i) => {
              const tool = getTool(c.tool.slug);
              return (
                <div key={c.key} className="grid gap-x-34 gap-y-8 border-b border-line py-21 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.618fr)] lg:grid-cols-[3.4375rem_minmax(0,0.7fr)_minmax(0,1.618fr)_minmax(0,0.8fr)]" data-reveal style={{ ["--i" as string]: i }}>
                  <span className="num hidden pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink lg:block">{String(i + 1).padStart(2, "0")}</span>
                  <dt className="h3">{c.name}</dt>
                  <dd className="text-ink-2">{c.plain}</dd>
                  <dd className="flex flex-wrap gap-x-21 gap-y-5 text-sm md:col-start-2 lg:col-start-auto lg:flex-col lg:items-end">
                    {hasTerm(c.glossary) && (
                      <Link href={`/glossary/${c.glossary}`} className="link inline-flex min-h-[2.75rem] items-center lg:min-h-0">
                        Glossary: {c.glossary === "ecn" ? "ECN" : c.name}
                      </Link>
                    )}
                    {tool && (
                      <Link href={`/tools/${tool.slug}`} className="link inline-flex min-h-[2.75rem] items-center lg:min-h-0">
                        {c.tool.label}
                      </Link>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      <RiskNote text={riskWarning} />

      <NextSteps
        items={[
          { kind: "Trading", label: "Account types", href: "/trading/accounts", note: "How the spread you pay depends on the account." },
          { kind: "Tools", label: "Cost Lab", href: "/tools/cost-lab", note: "Spread, commission and swap, added up." },
          { kind: "Tools", label: "Margin calculator", href: "/tools/margin", note: "What a position ties up." },
          { kind: "Markets", label: "Markets", href: "/markets", note: "Structure, hours and drivers by asset class." },
        ]}
      />
    </>
  );
}
