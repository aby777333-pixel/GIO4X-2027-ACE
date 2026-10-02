import Link from "next/link";
import { Intermediary } from "@/components/figures/company/Intermediary";
import { FigureNote } from "@/components/figures/Figure";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "What we are",
  description: "What a brokerage is, what GIO4X provides and does not provide, who it is for and who it is not for. No investment advice, no managed returns, no signals.",
  path: "/about/what-we-are",
});

const provides = [
  "Access to six asset classes, traded as margined products on one account.",
  "Two trading platforms: MetaTrader 5 and 777 Raptor.",
  "Three account types with their conditions published in advance.",
  "Tools, a glossary and explanation, open to anyone.",
];

const doesNot = [
  { t: "Investment advice", d: "Nothing on this site is a recommendation to buy, sell or hold, and nothing on it is written with your personal circumstances in view. The decision and its consequences are yours." },
  { t: "Managed returns", d: "GIO4X does not promise, target or imply a return. No account type, programme or tool comes with one." },
  { t: "Signals", d: "No “buy now”, no “sell now”, no alerts that tell you what to do. The site explains how markets work; it does not predict them." },
];

const forWhom = [
  "You want to make your own decisions and are prepared to own the outcome.",
  "You would rather read the conditions and the risk disclosure than a headline.",
  "You can afford to lose the money you place in a leveraged market.",
  "You value an explanation more than a tip.",
];

const notFor = [
  "You are looking for someone to tell you what to trade.",
  "You need the money you would be trading with.",
  "You expect a steady income or a fixed return from trading.",
  "You live in a jurisdiction where GIO4X does not offer its services.",
];

export default function WhatWeArePage() {
  return (
    <>
      <PageHero
        crumbs={[
          { name: "About", href: "/about" },
          { name: "What we are", href: "/about/what-we-are" },
        ]}
        eyebrow="What we are"
        title="A broker. Nothing grander, nothing less."
        lead="It is worth being exact about what a brokerage does, because most disappointment in this industry begins with a misunderstanding about it."
        quiet
      />

      <article className="section">
        <div className="wrap phi items-start">
          <div className="prose-gx">
            <h2 className="!mt-0">What a brokerage is</h2>
            <p>
              A brokerage is an intermediary. You decide what to trade, in what size and at what moment; the broker provides the account, the platform and the access through which that instruction reaches a market, and it charges for doing so through a spread, a commission, or both.
            </p>
            <p>
              That is the whole of it. A broker is not an adviser, a fund manager or a forecaster. It does not know where a price is going, and a broker that speaks as though it does is selling something other than access.
            </p>

            <h2>What GIO4X provides</h2>
            <ul>
              {provides.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p>
              The products are leveraged. Leverage lets a small deposit control a larger position, which enlarges losses exactly as it enlarges gains. The{" "}
              <Link href="/tools/leverage-visualizer">leverage visualiser</Link> shows the arithmetic, and the <Link href="/legal/risk">risk disclosure</Link> states the consequences.
            </p>

            <h2>What GIO4X does not provide</h2>
            <p>Three things are deliberately absent, and their absence is a feature of the house rather than a gap in it.</p>
          </div>

          <div className="lg:sticky lg:top-[calc(var(--header-h)+2.125rem)]">
            <aside className="panel-quiet p-21 lg:p-34" aria-labelledby="short-h">
              <p id="short-h" className="label">
                In one paragraph
              </p>
              <p className="mt-13 font-display text-lg leading-snug text-ink">
                GIO4X gives you access to markets and the means to understand them. It does not advise you, promise a return or tell you what to trade.
              </p>
              <p className="mt-21 text-xs text-ink-3">{educationalNote}</p>
            </aside>
            <FigureNote figure={<Intermediary />} label="Worth knowing" className="lg:max-w-none">
              A broker charges through a spread, a commission, or both. At GIO4X the difference between the{" "}
              <Link href="/trading/accounts" className="link">
                three account types
              </Link>{" "}
              is how you pay for trading, and it is set out in one table.
            </FigureNote>
          </div>
        </div>

        <div className="wrap mt-34">
          <dl className="grid border-l border-t border-line md:grid-cols-3">
            {doesNot.map((d, i) => (
              <div key={d.t} className="border-b border-r border-line p-21 lg:p-34" data-reveal style={{ ["--i" as string]: i }}>
                <dt className="flex items-baseline gap-13">
                  <span className="label">No</span>
                  <span className="h3">{d.t}</span>
                </dt>
                <dd className="mt-13 text-ink-2">{d.d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </article>

      <section className="section hairline bg-paper" aria-labelledby="who">
        <div className="wrap">
          <h2 id="who" className="h2 max-w-[18ch]" data-reveal>
            Who it is for, and who it is not.
          </h2>
          <div className="mt-34 grid gap-34 lg:grid-cols-2 lg:gap-55">
            <div data-reveal>
              <h3 className="label border-b border-line-strong pb-13">GIO4X may suit you if</h3>
              <ul>
                {forWhom.map((f) => (
                  <li key={f} className="grid grid-cols-[1.3125rem_1fr] gap-x-13 border-b border-line py-13 text-ink">
                    <span aria-hidden className="mt-[0.5rem] h-[0.4375rem] w-[0.4375rem] rounded-full bg-accent" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal style={{ ["--i" as string]: 1 }}>
              <h3 className="label border-b border-line-strong pb-13">It is not the right place if</h3>
              <ul>
                {notFor.map((f) => (
                  <li key={f} className="grid grid-cols-[1.3125rem_1fr] gap-x-13 border-b border-line py-13 text-ink-2">
                    <span aria-hidden className="mt-[0.5rem] h-[0.4375rem] w-[0.4375rem] rounded-full border border-ink-3" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-34 max-w-measure text-ink-2" data-reveal>
            Telling some readers that this is not for them costs us accounts. It is still the right thing to print. The list of jurisdictions where services are not offered is on the{" "}
            <Link href="/open-account#jurisdictions" className="link">
              account opening
            </Link>{" "}
            page.
          </p>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Legal", label: "Risk disclosure", note: "Read this before anything else.", href: "/legal/risk" },
          { kind: "Company", label: "Why GIO4X", note: "Reasons with their proof attached.", href: "/about/why-gio4x" },
          { kind: "Academy", label: "Academy", note: "Mechanics and concepts, taught responsibly.", href: "/academy" },
          { kind: "Platforms", label: "Compare platforms", note: "MetaTrader 5 and 777 Raptor, side by side.", href: "/platforms/compare" },
        ]}
      />
    </>
  );
}
