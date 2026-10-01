import Link from "next/link";
import { AskLine, NumberedRows, PendingList, RiskNote } from "@/components/trading/Blocks";
import { NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { riskWarning } from "@/config/legal";
import { moneyManagers as mm } from "@/data/trading";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Money managers",
  description: "The GIO4X money manager programme: trading several client accounts as one, who it is for, how to apply, and the responsibilities that come with managing other people’s money.",
  path: "/partners/money-managers",
});

/** One instruction, allocated across several accounts: drawn with shapes, no figures. */
function AllocationStudy() {
  const rows = [0.86, 0.52, 0.68, 0.34];
  return (
    <svg viewBox="0 0 400 236" className="h-auto w-full" role="img" aria-label="Diagram: one instruction from the manager’s master account is allocated across several client accounts">
      <rect x="0.5" y="0.5" width="399" height="52" rx="4" fill="var(--surface)" stroke="var(--line-strong)" />
      <text x="16" y="22" fill="var(--ink-3)" fontFamily="var(--font-inter), system-ui, sans-serif" fontSize="10" fontWeight="600" letterSpacing="1">
        MASTER ACCOUNT · ONE INSTRUCTION
      </text>
      <rect x="16" y="32" width="180" height="8" rx="1" fill="var(--ink)" opacity="0.8" />
      <path d="M200 53v22" stroke="var(--line-strong)" />
      <path d="M40 75.5h320" stroke="var(--line-strong)" />
      {rows.map((w, i) => (
        <g key={i} transform={`translate(${i * 100 + 8} 76)`}>
          <path d="M42 0v20M37 14l5 6 5-6" fill="none" stroke="var(--line-strong)" />
          <rect x="0.5" y="24.5" width="83" height="112" rx="3" fill="var(--paper)" stroke="var(--line)" />
          <rect x="12" y="38" width="34" height="4" rx="1" fill="var(--ink-3)" opacity="0.6" />
          <rect x="12" y={124 - w * 64} width="60" height={w * 64} rx="1" fill="var(--accent)" opacity="0.55" />
          <text x="42" y="154" textAnchor="middle" fill="var(--ink-3)" fontFamily="var(--font-inter), system-ui, sans-serif" fontSize="9.5" fontWeight="600" letterSpacing="0.9">
            CLIENT {String.fromCharCode(65 + i)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function MoneyManagersPage() {
  return (
    <>
      <PageHero
        crumbs={[
          { name: "Partners", href: "/partners" },
          { name: "Money managers", href: "/partners/money-managers" },
        ]}
        eyebrow="Partners · Money managers"
        title="Trade several accounts as one."
        lead="For those who trade on behalf of clients. One instruction from a master account, allocated across the accounts under management by rules agreed in advance."
        aside={
          <figure>
            <div className="panel p-21">
              <AllocationStudy />
            </div>
            <figcaption className="mt-8 text-xs text-ink-3">Illustration of allocation. Proportions are arbitrary; no real account is shown.</figcaption>
          </figure>
        }
      >
        <Link href="/contact" className="btn btn-primary">
          Enquire about the programme
        </Link>
        <Link href="/trading/pamm" className="btn btn-ghost">
          How PAMM works
        </Link>
      </PageHero>

      <section className="section" aria-labelledby="mm-what">
        <div className="wrap phi items-start">
          <div>
            <p className="eyebrow">What it is</p>
            <h2 id="mm-what" className="h2 mt-13">
              One instruction, many accounts.
            </h2>
            <div className="prose-gx mt-21">
              {mm.what.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
          </div>
          <div>
            <h3 className="label">Who it is for</h3>
            <dl className="mt-13 border-t border-line-strong">
              {mm.who.map((w) => (
                <div key={w.title} className="border-b border-line py-21">
                  <dt className="h4">{w.title}</dt>
                  <dd className="mt-5 text-sm text-ink-2">{w.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="mm-gio">
        <div className="wrap">
          <SectionHead eyebrow="At GIO4X" title={<span id="mm-gio">What the programme provides.</span>} lead="Four things both previous GIO4X websites describe. They are named here without figures, because the figures were not published consistently." />
          <div className="mt-34 grid gap-55 lg:mt-55 lg:grid-cols-phi lg:gap-89">
            <ul className="grid border-l border-t border-line sm:grid-cols-2">
              {mm.gioAgreed.map((g, i) => (
                <li key={g.title} className="border-b border-r border-line bg-bg p-21 lg:p-34" data-reveal style={{ ["--i" as string]: i }}>
                  <h3 className="h4">{g.title}</h3>
                  <p className="mt-5 text-sm text-ink-2">{g.body}</p>
                </li>
              ))}
            </ul>
            <div data-reveal>
              <h3 className="label">Provided on application</h3>
              <PendingList items={mm.pending} className="mt-13" />
              <AskLine className="mt-13">The terms come with the manager agreement:</AskLine>
            </div>
          </div>
        </div>
      </section>

      <section className="section hairline" aria-labelledby="mm-apply">
        <div className="wrap phi phi-r items-start">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2.125rem)]" data-reveal>
            <p className="eyebrow">Becoming a manager</p>
            <h2 id="mm-apply" className="h2 mt-13">
              Apply, verify, set up, launch.
            </h2>
            <p className="lead mt-21">The sequence as GIO4X has described it. How long each step takes depends on what verification requires.</p>
            <Link href="/contact" className="btn btn-primary mt-34">
              Contact GIO4X
            </Link>
          </div>
          <div>
            <NumberedRows items={mm.steps} />
            <h3 className="label mt-55">What the role asks of you</h3>
            <ul className="mt-13 border-t border-line-strong">
              {mm.duties.map((d) => (
                <li key={d} className="grid grid-cols-[1.3125rem_1fr] gap-x-8 border-b border-line py-13 text-ink-2">
                  <span aria-hidden className="mt-[0.7em] h-px w-8 bg-accent" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <RiskNote text={riskWarning} />

      <NextSteps
        items={[
          { kind: "Trading", label: "PAMM", href: "/trading/pamm", note: "The arrangement from the investor’s side." },
          { kind: "Partners", label: "Introducing Brokers", href: "/partners", note: "For those who introduce rather than manage." },
          { kind: "Trading", label: "Account types", href: "/trading/accounts", note: "The accounts under management." },
          { kind: "Help", label: "Contact", href: "/contact", note: "Manager enquiries." },
        ]}
      />
    </>
  );
}
