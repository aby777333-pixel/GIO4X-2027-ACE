import { HiddenRiddle } from "@/components/verse/Verse";
import { PunchLine } from "@/components/ui/PunchLine";
import Link from "next/link";
import { TwoOffices } from "@/components/figures/extra/SideFigures";
import { Rosette } from "@/components/brand/Rosette";
import { Offices } from "@/components/company/Offices";
import { PlumbLines } from "@/components/figures/company/PlumbLines";
import { Caliper } from "@/components/figures/extra/Caliper";
import { FigureNote } from "@/components/figures/Figure";
import { HeroCompanion } from "@/components/figures/markets/HeroCompanion";
import { NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { companyLine } from "@/config/legal";
import { site } from "@/config/site";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "About GIO4X",
  description: "GIO4X is a multi-asset brokerage offering access to markets through MetaTrader 5 and 777 Raptor. The house philosophy, the company details and how to verify them.",
  path: "/about",
});

const conduct = [
  { n: "I", t: "Integrity", d: "Say what is true, including when the true answer is “not yet published”. A condition, a cost or a company detail appears on this site as it is, or it does not appear." },
  { n: "II", t: "Restraint", d: "No countdowns, no pop-ups, no urgency. A page is finished when nothing on it is trying to hurry you." },
  { n: "III", t: "Discipline", d: "Every number carries its source, its status and its date. Every calculator shows its formula. The same rule applies on the hundredth page as on the first." },
  { n: "IV", t: "Discretion", d: "Ask for what is needed and no more. This site runs no advertising and no third-party trackers. It counts its own page views as daily totals, with no cookie and nothing that identifies you, and you can switch that off. What it remembers about you stays in your own browser, where you can clear it." },
  { n: "V", t: "Respect for capital", d: "Money placed in a leveraged market can be lost. Risk is stated in ordinary type at the point of decision, and nothing here tells you what to trade." },
];

const provides = [
  { t: "Access to markets", d: "Forex, metals, indices, energy, equities and crypto, traded as margined products on one account.", href: "/markets", go: "Markets" },
  { t: "Two platforms", d: "MetaTrader 5, the MetaQuotes platform many traders already know, and 777 Raptor, a multi-asset workspace. Different instruments for the same markets.", href: "/platforms", go: "Platforms" },
  { t: "Three accounts", d: "Classic, Premium and ECN. The difference between them is how you pay for trading, and it is set out in one table.", href: "/trading/accounts", go: "Accounts" },
  { t: "An open library", d: "Calculators, visualisers, a glossary and long-form explanation. Open to anyone, account or not.", href: "/tools", go: "Trader Toolkit" },
];

const verify = [
  { k: "Links", t: "Check any address against the official registry", d: "Paste a link from an email or message and see whether it belongs to GIO4X.", href: "/trust/verify" },
  { k: "Disclosure", t: "What is published, and what is still open", d: "The company details, costs and conditions on record, and the questions not yet answered.", href: "/trust/transparency" },
  { k: "Data", t: "Where each number comes from", d: "The meaning of reference, indicative, schedule and simulation on this site.", href: "/trust/data-methodology" },
  { k: "Risk", t: "The risk disclosure, in readable type", d: "What leveraged trading can cost. Read it before anything else.", href: "/legal/risk" },
];

const unsaid = [
  { t: "Client counts", d: "How many people trade with a broker says little about how it will treat you, and a figure we cannot evidence on this page does not belong on it." },
  { t: "Trading volumes", d: "A daily volume number is easy to print and hard to check. None is printed." },
  { t: "Awards", d: "No award is claimed, because none can be shown here with its awarding body, year and criteria." },
  { t: "Testimonials", d: "A quotation without a verifiable author is decoration. There are none." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "About", href: "/about" }]}
        eyebrow={site.tagline}
        title="A brokerage that prefers to be checked."
        lead="GIO4X offers access to global markets through MetaTrader 5 and 777 Raptor, and keeps an open library of tools and education beside them. This page says what the house is, how it behaves and how you can verify it."
        aside={
          <div className="border-l border-line-strong pl-21">
            <p className="label">The company</p>
            <p className="mt-8 font-display text-lg leading-snug text-ink">{companyLine}</p>
            <Link href="#company" className="go mt-21">
              Company details
            </Link>
          </div>
        }
        companion={
          <HeroCompanion layout="beside" label="To check it" figure={<Caliper />}>
            The company line is repeated with the two published addresses further down, and the four pages under Verify exist so that what is said here can be checked.
          </HeroCompanion>
        }
      >
        <Link href="/about/what-we-are" className="btn btn-primary">
          What we are
        </Link>
        <Link href="/trust" className="btn btn-ghost">
          Trust Centre
        </Link>
      </PageHero>

      {/* philosophy: conduct, set as a numbered code */}
      <section className="section" aria-labelledby="conduct">
        <div className="wrap phi phi-r items-start">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2.125rem)]" data-reveal>
            <p className="eyebrow">The house philosophy</p>
            <h2 id="conduct" className="h2 mt-13">
              “Gentleman” is a standard of conduct.
            </h2>
            <p className="lead mt-21">It is not a costume. It describes how a firm behaves when it would be easier, or more profitable in the short run, to behave otherwise. Five commitments follow from it.</p>
            <FigureNote figure={<PlumbLines />} label="In practice">
              Each commitment can be tested against the site itself. The four pages under{" "}
              <Link href="#verify" className="link">
                Verify
              </Link>
              , further down, exist so that what is said here can be checked.
            </FigureNote>
          </div>
          <ol className="border-t border-line-strong">
            {conduct.map((c, i) => (
              <li key={c.t} className="grid grid-cols-[2.125rem_1fr] gap-x-13 border-b border-line py-21 sm:grid-cols-[3.4375rem_1fr]" data-reveal style={{ ["--i" as string]: i }}>
                <span className="num pt-[0.4rem] text-xs font-semibold tracking-[0.1em] text-ink-3" aria-hidden>
                  {c.n}
                </span>
                <div>
                  <h3 className="h3">{c.t}</h3>
                  <p className="mt-8 max-w-measure text-ink-2">{c.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* what GIO4X is */}
      <section className="section hairline bg-paper" aria-labelledby="what">
        <div className="wrap">
          <SectionHead
            eyebrow="What GIO4X is"
            title={<span id="what">A multi-asset brokerage, and a library.</span>}
            lead="A brokerage gives you access to a market and carries out your instructions in it. GIO4X adds the means to understand what you are instructing."
            action={
              <Link href="/about/what-we-are" className="go">
                The longer answer
              </Link>
            }
          />
          <ul className="mt-55 grid border-l border-t border-line sm:grid-cols-2">
            {provides.map((p, i) => (
              <li key={p.t} className="border-b border-r border-line" data-reveal style={{ ["--i" as string]: i }}>
                <Link href={p.href} className="group flex h-full flex-col justify-between gap-34 p-21 transition-colors duration-fast hover:bg-surface lg:p-34">
                  <span>
                    <span className="h4 block">{p.t}</span>
                    <span className="mt-8 block max-w-narrow text-ink-2">{p.d}</span>
                  </span>
                  <span className="go" aria-hidden>
                    {p.go}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* the restraint IS the brand */}
      <section className="on-night relative overflow-hidden" aria-labelledby="unsaid">
        <div aria-hidden className="pointer-events-none absolute -left-[5%] top-1/2 hidden -translate-y-1/2 text-on-night opacity-[0.05] lg:block">
          <Rosette size={520} blades={5} strokeWidth={0.6} />
        </div>
        <div className="wrap section relative">
          <div className="phi items-end">
            <div data-reveal>
              <p className="eyebrow">Restraint</p>
              <h2 id="unsaid" className="h1 mt-21 max-w-[14ch]">
                What we have chosen not to say.
              </h2>
            </div>
            <p className="lead" data-reveal>
              This site carries no client counts, no trading volumes, no awards and no testimonials. They are absent because they cannot be independently evidenced here, and a claim you cannot check is not worth your attention.
            </p>
          </div>
          <dl className="mt-55 grid gap-x-34 border-t border-night-line md:grid-cols-2">
            {unsaid.map((u, i) => (
              <div key={u.t} className="grid grid-cols-[1.3125rem_1fr] gap-x-13 border-b border-night-line py-21" data-reveal style={{ ["--i" as string]: i }}>
                <span aria-hidden className="mt-[0.72rem] h-px w-full bg-on-night-2" />
                <div>
                  <dt className="h4">{u.t}</dt>
                  <dd className="mt-5 max-w-narrow text-on-night-2">{u.d}</dd>
                </div>
              </div>
            ))}
          </dl>
          <p className="mt-34 max-w-measure text-on-night-2" data-reveal>
            If any of these appear in future, each will arrive with its source, its date and a way to confirm it. Until then the space stays empty, on purpose.{" "}
            <Link href="/trust/transparency" className="link">
              See what is published
            </Link>
          </p>
        </div>
      </section>

      {/* company details */}
      <section id="company" className="section scroll-mt-[calc(var(--header-h)+1.3125rem)]" aria-labelledby="company-h">
        <div className="wrap phi items-start">
          <div data-reveal>
            <p className="eyebrow">Company</p>
            <h2 id="company-h" className="h2 mt-13">
              The details on record.
            </h2>
            <p className="mt-21 max-w-measure font-display text-xl leading-snug text-ink">{companyLine}</p>
            <Offices className="mt-34" />
            <p className="mt-21 max-w-measure text-sm text-ink-3">
              These are the company line and the two addresses GIO4X has published. Details that have not been published, including any statement about regulatory status, are not shown here; the Transparency page lists what is still open.
            </p>
            <p className="mt-13 max-w-measure text-sm text-ink-3">
              Both offices are marked on{" "}
              <Link href="/about/world" className="link">
                GIO4X on the map
              </Link>
              , a globe that also carries the financial centres and central banks this site covers.
            </p>
          </div>
          <div className="grid content-start gap-21">
          <aside className="panel-quiet p-21 lg:p-34" aria-labelledby="write-h" data-reveal>
            <p id="write-h" className="label">
              Write to us
            </p>
            <p className="mt-8">
              <a href={`mailto:${site.email}`} className="link font-display text-xl">
                {site.email}
              </a>
            </p>
            <p className="mt-13 text-sm text-ink-2">One address for general questions. The contact page routes account, platform, press, security, privacy and complaint messages to the right place.</p>
            <Link href="/contact" className="btn btn-ghost mt-21">
              Contact GIO4X
            </Link>
          </aside>
          {/* this column ended well short of the one beside it: a figure that says what the text says */}
          <div className="max-w-[28rem]">
            <div className="flat gx-stage">
              <TwoOffices />
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* verification */}
      <section className="section hairline bg-paper" aria-labelledby="verify">
        <div className="wrap">
          <SectionHead
            eyebrow="Verify"
            title={<span id="verify">You should not have to take our word.</span>}
            lead="Four pages exist so that what is said here can be checked."
            action={
              <Link href="/trust" className="go">
                Trust Centre
              </Link>
            }
          />
          <ul className="mt-34 border-t border-line-strong">
            {verify.map((d, i) => (
              <li key={d.href} className="border-b border-line" data-reveal style={{ ["--i" as string]: i }}>
                <Link href={d.href} className="group grid items-baseline gap-x-21 gap-y-5 py-21 transition-colors duration-fast hover:bg-surface md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)_auto] md:px-13">
                  <span className="label text-prestige-ink">{d.k}</span>
                  <span className="h4 transition-colors duration-fast group-hover:text-accent">{d.t}</span>
                  <span className="text-sm text-ink-2">{d.d}</span>
                  <span className="go hidden md:inline-flex" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <HiddenRiddle id="about" />

      <PunchLine k="company" />

      <NextSteps
        items={[
          { kind: "Company", label: "Why GIO4X", note: "Reasons you can check for yourself.", href: "/about/why-gio4x" },
          { kind: "Company", label: "What we are", note: "And what we are not.", href: "/about/what-we-are" },
          { kind: "Trading", label: "Account types", note: "Classic, Premium and ECN, compared.", href: "/trading/accounts" },
          { kind: "Company", label: "Contact", note: "One form, routed by topic.", href: "/contact" },
        ]}
      />
    </>
  );
}
