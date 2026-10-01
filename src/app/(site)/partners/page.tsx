import Link from "next/link";
import { Rosette } from "@/components/brand/Rosette";
import { AgreedList, AskLine, NumberedRows, PendingList, RiskNote } from "@/components/trading/Blocks";
import { NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { riskWarning } from "@/config/legal";
import { introducingBrokers as ib } from "@/data/trading";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Introducing Brokers",
  description: "The GIO4X Introducing Broker programme: what an IB does, who it suits, how to apply and what the role requires. Commercial terms are provided on application.",
  path: "/partners",
});

export default function PartnersPage() {
  return (
    <>
      <PageHero eyebrow="Partners · Introducing Brokers" title="Introduce clients. Keep your good name." lead="An Introducing Broker brings clients to GIO4X and stays alongside them afterwards. The programme suits people whose recommendation already carries weight, and who intend to keep it that way.">
        <Link href="/contact" className="btn btn-primary">
          Enquire about the programme
        </Link>
        <Link href="/partners/money-managers" className="btn btn-ghost">
          Money managers
        </Link>
      </PageHero>

      <section className="section" aria-labelledby="ib-what">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">What it is</p>
            <h2 id="ib-what" className="h2 mt-13">
              A referral, with responsibilities attached.
            </h2>
          </div>
          <div className="prose-gx">
            {ib.what.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="ib-who">
        <div className="wrap">
          <SectionHead eyebrow="Who it is for" title={<span id="ib-who">Four kinds of partner.</span>} />
          <ul className="mt-34 grid border-t border-line-strong md:grid-cols-2 md:gap-x-55 lg:mt-55">
            {ib.who.map((w, i) => (
              <li key={w.title} className="grid grid-cols-[2.125rem_1fr] gap-x-13 border-b border-line py-21" data-reveal style={{ ["--i" as string]: i }}>
                <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="h4">{w.title}</h3>
                  <p className="mt-5 text-sm text-ink-2">{w.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section hairline" aria-labelledby="ib-apply">
        <div className="wrap phi items-start">
          <div>
            <p className="eyebrow">Becoming a partner</p>
            <h2 id="ib-apply" className="h2 mb-34 mt-13">
              Four steps, as GIO4X has described them.
            </h2>
            <NumberedRows items={ib.steps} />
          </div>
          <div className="grid gap-34" data-reveal>
            <div>
              <h3 className="label">Published consistently</h3>
              <div className="mt-13">
                <AgreedList items={ib.gioAgreed} />
              </div>
            </div>
            <div>
              <h3 className="label">Provided on application</h3>
              <PendingList items={ib.pending} className="mt-13" />
              <AskLine className="mt-13">Rebate amounts, payout schedules and partner numbers were published in several conflicting versions, so none appears here. The current terms come with the partner agreement:</AskLine>
            </div>
          </div>
        </div>
      </section>

      <section className="on-night relative overflow-hidden" aria-labelledby="ib-duties">
        <div aria-hidden className="pointer-events-none absolute -right-[4%] top-1/2 hidden -translate-y-1/2 text-ink opacity-[0.06] lg:block">
          <Rosette size={460} strokeWidth={0.6} />
        </div>
        <div className="wrap section relative">
          <div className="phi phi-r items-start">
            <div data-reveal>
              <p className="eyebrow">Conduct</p>
              <h2 id="ib-duties" className="h2 mt-13">
                What the role asks of you.
              </h2>
              <p className="lead mt-21">A partner speaks for the house. These are not small print; they are the job.</p>
            </div>
            <ol className="border-t border-line-strong">
              {ib.duties.map((d, i) => (
                <li key={d} className="grid grid-cols-[2.125rem_1fr] gap-x-13 border-b border-line py-21" data-reveal style={{ ["--i" as string]: i }}>
                  <span className="num pt-[0.35rem] text-xs font-semibold text-prestige-ink">{i + 1}</span>
                  <p className="font-display text-lg leading-snug text-ink">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="ib-cta">
        <div className="wrap flex flex-col gap-34 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[40rem]">
            <h2 id="ib-cta" className="h2">
              Start with a conversation.
            </h2>
            <p className="lead mt-13">Tell us who you would be introducing and how you work with them. You will receive the programme terms and the partner agreement to read before you commit to anything.</p>
          </div>
          <Link href="/contact" className="btn btn-primary btn-lg">
            Contact GIO4X
          </Link>
        </div>
      </section>

      <RiskNote text={riskWarning} />

      <NextSteps
        items={[
          { kind: "Partners", label: "Money managers", href: "/partners/money-managers", note: "For those who trade on behalf of others." },
          { kind: "Trading", label: "Account types", href: "/trading/accounts", note: "What the clients you introduce will be offered." },
          { kind: "Trust", label: "Transparency", href: "/trust/transparency", note: "What GIO4X publishes, and what it does not yet." },
          { kind: "Help", label: "Contact", href: "/contact", note: "Partnership enquiries." },
        ]}
      />
    </>
  );
}
