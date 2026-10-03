import { PunchLine } from "@/components/ui/PunchLine";
import Link from "next/link";
import { FigureNote } from "@/components/figures/Figure";
import { CurrencyOrbits } from "@/components/figures/stage/CurrencyOrbits";
import { HeroCompanion } from "@/components/figures/stage/HeroCompanion";
import { ReturnLoop } from "@/components/figures/trading/ReturnLoop";
import { AskLine, NumberedRows, PendingList, RiskNote } from "@/components/trading/Blocks";
import { NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { riskWarning } from "@/config/legal";
import { fundingConfirmed, fundingCurrencies, fundingExplainers, fundingFlow, fundingPending } from "@/data/trading";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Funding and withdrawals",
  description: "How deposits and withdrawals work at GIO4X: the accepted currencies, the same-name rule, verification before withdrawal, and which details are confirmed in your client area.",
  path: "/trading/funding",
});

export default function FundingPage() {
  return (
    <>
      <PageHero
        crumbs={[
          { name: "Trading", href: "/trading" },
          { name: "Funding and withdrawals", href: "/trading/funding" },
        ]}
        eyebrow="Funding and withdrawals"
        title="How money moves in and out."
        lead="This page publishes only what GIO4X has stated consistently. Fees, methods and timings that were published in more than one version are not repeated here; they are confirmed in your client area before you commit to a payment."
        aside={
          <div className="border-t border-line-strong pt-21">
            <p className="label">Accepted currencies</p>
            <ul className="mt-13 grid grid-cols-4 border-l border-t border-line" aria-label="Accepted currencies">
              {fundingCurrencies.map((c) => (
                <li key={c} className="num border-b border-r border-line py-13 text-center text-sm font-semibold tracking-[0.06em] text-ink">
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-xs text-ink-3">As listed on both previous GIO4X websites. Whether a given method supports a given currency is confirmed in your client area.</p>
          </div>
        }
        companion={
          <HeroCompanion figure={<CurrencyOrbits />} label="On the way in">
            Eleven currencies are accepted, but every payment still travels through a bank or payment provider, which may apply its own transfer or conversion charges.{" "}
            <Link href="#path" className="link">
              The path of a payment
            </Link>{" "}
            sets out the six steps.
          </HeroCompanion>
        }
      />

      {/* confirmed vs pending */}
      <section className="section" aria-labelledby="confirmed">
        <div className="wrap grid gap-55 lg:grid-cols-phi lg:gap-89">
          <div>
            <p className="eyebrow">Published</p>
            <h2 id="confirmed" className="h2 mt-13">
              What is settled.
            </h2>
            <dl className="mt-34 border-t border-line-strong">
              {fundingConfirmed.map((f) => (
                <div key={f.title} className="border-b border-line py-21">
                  <dt className="h4 flex items-baseline gap-8">
                    <span aria-hidden className="text-pos">
                      ✓
                    </span>
                    {f.title}
                  </dt>
                  <dd className="mt-5 max-w-measure pl-21 text-ink-2">{f.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <p className="eyebrow">Not yet published</p>
            <h2 className="h3 mt-13">What is confirmed in your client area.</h2>
            <p className="mt-13 text-sm text-ink-2">GIO4X’s two previous websites gave different answers on each of these. Rather than choose one, this site publishes none until the owner confirms it.</p>
            <PendingList items={fundingPending} className="mt-21" />
            <AskLine className="mt-13" />
          </div>
        </div>
      </section>

      {/* the path of a payment */}
      <section className="section hairline bg-paper" aria-labelledby="path">
        <div className="wrap">
          <SectionHead eyebrow="In general" title={<span id="path">The path of a payment.</span>} lead="Six steps, three parties. It is the same with any broker, and it explains most of what people find slow about moving money." />
          <ol className="mt-34 grid border-l border-t border-line sm:grid-cols-2 lg:mt-55 lg:grid-cols-3">
            {fundingFlow.map((s, i) => (
              <li key={s.step} className="flex flex-col gap-21 border-b border-r border-line bg-bg p-21 lg:p-34" data-reveal style={{ ["--i" as string]: i }}>
                <div className="flex items-baseline justify-between gap-13">
                  <span className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                  <span className="label">{s.who}</span>
                </div>
                <div>
                  <h3 className="h4">{s.step}</h3>
                  <p className="mt-5 text-sm text-ink-2">{s.note}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-13 text-xs text-ink-3">A general description of how funding works, not a statement of GIO4X’s processing times.</p>
        </div>
      </section>

      {/* why */}
      <section className="section hairline" aria-labelledby="why">
        <div className="wrap phi phi-r items-start">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2.125rem)]" data-reveal>
            <p className="eyebrow">The reasons</p>
            <h2 id="why" className="h2 mt-13">
              Why it works this way.
            </h2>
            <p className="lead mt-21">The rules around funding can feel like obstacles. Each one exists for a reason, and most of them are there to protect the account holder.</p>
            <Link href="/trust/client-funds" className="go mt-21 min-h-[2.75rem] md:min-h-0">
              Client fund security
            </Link>
            <FigureNote figure={<ReturnLoop ratio={3} />} className="!mt-21">
              Most of this comes down to two ideas: the money stays in one name, and it leaves by the way it arrived.{" "}
              <Link href="#path" className="link">
                The path of a payment
              </Link>
              , above, shows the steps where each applies.
            </FigureNote>
          </div>
          <NumberedRows items={fundingExplainers} as="ul" />
        </div>
      </section>

      <RiskNote text={riskWarning} />

      <PunchLine k="funding" />

      <NextSteps
        items={[
          { kind: "Trading", label: "Account types", href: "/trading/accounts", note: "Minimum deposits and what you need to open one." },
          { kind: "Trust", label: "Client fund security", href: "/trust/client-funds", note: "What is published about how funds are held." },
          { kind: "Trust", label: "Verify a GIO4X link", href: "/trust/verify", note: "Check a payment page before you use it." },
          { kind: "Help", label: "Contact", href: "/contact", note: "Ask before you send money, not after." },
        ]}
      />
    </>
  );
}
