import Link from "next/link";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { accounts } from "@/data/accounts";
import { glossary } from "@/data/glossary";
import { tools } from "@/data/tools";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Why GIO4X",
  description: "Six reasons expressed as things you can check: published conditions, open tools that show their formulae, sourced data, a link verifier, readable risk disclosure and two platforms.",
  path: "/about/why-gio4x",
});

type Reason = { claim: string; detail: string; proofs: { label: string; href: string }[]; evidence: string };

const reasons: Reason[] = [
  {
    claim: "The conditions are published before you apply.",
    detail: `${accounts.map((a) => a.name).join(", ")}: minimum deposit, spread from, commission, swap, margin call and stop-out levels sit in one table, with the caveats beside them. Per-instrument conditions are labelled indicative, because that is what they are.`,
    proofs: [
      { label: "Account types", href: "/trading/accounts" },
      { label: "Trading conditions", href: "/trading/conditions" },
    ],
    evidence: "One comparison table",
  },
  {
    claim: "The tools show their working.",
    detail: `${tools.length} calculators and visualisers, each with its formula printed on the page. They use your inputs, share them between tools, and none of them tells you what to trade.`,
    proofs: [
      { label: "Trader Toolkit", href: "/tools" },
      { label: "Cost Lab", href: "/tools/cost-lab" },
    ],
    evidence: `${tools.length} tools, ${tools.length} formulae`,
  },
  {
    claim: "Every number says where it came from.",
    detail: "Exchange rates are European Central Bank reference fixings, labelled with their date. Session times are schedules computed from your own clock. Nothing on the site is presented as a live price, because no live feed is connected to it.",
    proofs: [
      { label: "Data methodology", href: "/trust/data-methodology" },
      { label: "Currency strength", href: "/markets/currency-strength" },
    ],
    evidence: "Source, status and date on each data module",
  },
  {
    claim: "You can check whether a link is ours.",
    detail: "Paste any address from an email, a message or an advertisement and compare it with the official GIO4X registry. The check is a comparison on the page: the link is never opened or fetched.",
    proofs: [{ label: "Verify a GIO4X link", href: "/trust/verify" }],
    evidence: "A public registry of official destinations",
  },
  {
    claim: "The risk disclosure is written to be read.",
    detail: "Ordinary type, ordinary language, placed where the decision is made. Leveraged trading can lose money quickly, and the site says so without a footnote.",
    proofs: [
      { label: "Risk disclosure", href: "/legal/risk" },
      { label: "Leverage, visualised", href: "/tools/leverage-visualizer" },
    ],
    evidence: "The disclosure itself",
  },
  {
    claim: "There are two platforms, and neither is ranked above the other.",
    detail: "MetaTrader 5 from MetaQuotes and 777 Raptor are set side by side with their differences described. Which one suits you depends on how you work.",
    proofs: [
      { label: "Compare platforms", href: "/platforms/compare" },
      { label: "MetaTrader 5", href: "/platforms/metatrader-5" },
      { label: "777 Raptor", href: "/platforms/raptor" },
    ],
    evidence: "A side-by-side comparison",
  },
];

export default function WhyPage() {
  return (
    <>
      <PageHero
        crumbs={[
          { name: "About", href: "/about" },
          { name: "Why GIO4X", href: "/about/why-gio4x" },
        ]}
        eyebrow="Why GIO4X"
        title="Six reasons, each with its proof attached."
        lead="A list of adjectives would be easy to write and impossible to check. These are behaviours of this website and this offering instead, and every one links to the page where you can see it for yourself."
      />

      <section className="section" aria-label="Reasons">
        <div className="wrap">
          <ol className="border-t border-line-strong">
            {reasons.map((r, i) => (
              <li key={r.claim} className="grid gap-x-34 gap-y-13 border-b border-line py-34 lg:grid-cols-[5.5625rem_minmax(0,1.618fr)_minmax(0,1fr)] lg:py-55" data-reveal>
                <span className="num font-display text-2xl font-light text-ink-3" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="h3 max-w-[24ch]">{r.claim}</h2>
                  <p className="mt-13 max-w-measure text-ink-2">{r.detail}</p>
                </div>
                <div className="lg:border-l lg:border-line lg:pl-34">
                  <p className="label">See it</p>
                  <ul className="mt-8 grid gap-8">
                    {r.proofs.map((p) => (
                      <li key={p.href}>
                        <Link href={p.href} className="go min-h-[2.125rem]">
                          {p.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-13 text-xs text-ink-3">Evidence: {r.evidence}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="not-listed">
        <div className="wrap phi phi-r items-start">
          <h2 id="not-listed" className="h3" data-reveal>
            What is not on this list.
          </h2>
          <div className="max-w-measure text-ink-2" data-reveal>
            <p>
              Speed, size, rankings, awards and the opinions of clients. None of them can be demonstrated on a web page, so none of them is offered as a reason. The glossary, with its {glossary.length} definitions, and the rest of the library are free to use whether or not you ever open an account.
            </p>
            <p className="mt-13">
              <Link href="/about#unsaid" className="link">
                What we have chosen not to say
              </Link>
            </p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Company", label: "What we are", note: "What a brokerage does, and does not do.", href: "/about/what-we-are" },
          { kind: "Trust", label: "Transparency", note: "What is published, and what is still open.", href: "/trust/transparency" },
          { kind: "Trading", label: "Account types", note: "The three accounts, compared plainly.", href: "/trading/accounts" },
          { kind: "Tools", label: "Trader Toolkit", note: "Work the numbers yourself.", href: "/tools" },
        ]}
      />
    </>
  );
}
