import Link from "next/link";
import { FigureNote } from "@/components/figures/Figure";
import { PendingRack } from "@/components/figures/product/PendingRack";
import { SequenceRoute } from "@/components/figures/product/SequenceRoute";
import { HeroCompanion } from "@/components/figures/stage/HeroCompanion";
import { TerminalLayers } from "@/components/figures/stage/TerminalLayers";
import { NotPublished } from "@/components/platforms/FactState";
import { Screenshot } from "@/components/platforms/Screenshot";
import { JsonLd } from "@/components/seo/JsonLd";
import { DataNote, NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { riskWarning } from "@/config/legal";
import { site } from "@/config/site";
import { getTerm } from "@/data/glossary";
import { shots, shotsNote } from "@/data/platform-shots";
import { gioFacts, metaquotes, mt5Capabilities, mt5GettingStarted, mt5Learn, mt5Trademark, mt5Troubleshooting, platforms } from "@/data/platforms";
import { getTool } from "@/data/tools";
import { pageMeta } from "@/lib/meta";
import { softwareSchema } from "@/lib/schema";

const p = platforms.mt5;
const description = "MetaTrader 5 is the multi-asset trading platform developed by MetaQuotes. What it is, what it documents, how to learn it, and what GIO4X has still to publish about its own set-up.";

export const metadata = pageMeta({ title: "MetaTrader 5", description, path: "/platforms/metatrader-5" });

export default function Mt5Page() {
  const gioPending = gioFacts.filter((f) => f.mt5.status === "unverified" && f.key !== "features");

  return (
    <>
      <JsonLd data={softwareSchema({ path: p.href, name: p.name, description })} />

      <PageHero
        crumbs={[
          { name: "Platforms", href: "/platforms" },
          { name: "MetaTrader 5", href: p.href },
        ]}
        eyebrow="Third-party platform · by MetaQuotes"
        title="MetaTrader 5"
        lead={
          <>
            <span className="h3 block text-ink">{p.tagline}</span>
            <span className="mt-13 block">{p.summary}</span>
          </>
        }
        aside={
          <Screenshot shot={shots.mt5Terminal} sizes="(min-width: 1024px) 40vw, 100vw" eager caption="The MetaTrader 5 desktop terminal on a MetaQuotes demo account. Not a GIO4X account, and not GIO4X prices." />
        }
        companion={
          <HeroCompanion figure={<TerminalLayers />} label="One terminal">
            MetaTrader 5 is one terminal for quotes, charts, technical analysis, order entry and automated trading. It is developed by MetaQuotes and made available by many brokers. GIO4X does not make it and does not present it as its own.
          </HeroCompanion>
        }
      >
        <a href="#getting-started" className="btn btn-primary">
          Getting started
        </a>
        <Link href="/platforms/compare" className="btn btn-ghost">
          Compare platforms
        </Link>
      </PageHero>

      {/* what it is */}
      <section className="section" aria-labelledby="what">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">What it is</p>
            <h2 id="what" className="h2 mt-13">
              A platform many traders already know.
            </h2>
          </div>
          <div className="prose-gx">
            <p>
              MetaTrader 5 is a trading platform developed by MetaQuotes. It is multi-asset: one terminal for quotes, charts, technical analysis, order entry and automated trading. It is made available by many brokers around the world, which is why so many traders arrive already knowing where everything is.
            </p>
            <p>
              At GIO4X it is a third-party platform. GIO4X does not make MetaTrader 5 and does not present it as its own. What follows is, first, what MetaQuotes documents about the platform itself, and then, kept separate, what GIO4X has and has not yet published about its own set-up.
            </p>
            <p>
              <a href={metaquotes.href} target="_blank" rel="noopener noreferrer">
                The official MetaTrader 5 website
                <span className="sr-only"> (opens in a new tab)</span>
              </a>{" "}
              is the primary source for everything in the specification below.
            </p>
          </div>
        </div>
      </section>

      {/* the terminal itself */}
      <section className="section hairline" aria-labelledby="looks">
        <div className="wrap">
          <SectionHead eyebrow="The terminal" title={<span id="looks">What you will be looking at.</span>} lead="Two screens from the desktop terminal, on a MetaQuotes demo account: the everyday layout, and the windows used to place and review orders." />
          <div className="mt-34 grid items-start gap-34 lg:mt-55 lg:grid-cols-2 lg:gap-55">
            <div data-reveal>
              <Screenshot shot={shots.mt5Terminal} sizes="(min-width: 1024px) 50vw, 100vw" caption="Market Watch, Navigator, four charts and the Toolbox with open positions." />
            </div>
            <div data-reveal style={{ ["--i" as string]: 1 }}>
              <Screenshot shot={shots.mt5Order} sizes="(min-width: 1024px) 50vw, 100vw" caption="Depth of Market, the order window set to a pending order, and account history." />
            </div>
          </div>
          <p className="mt-21 max-w-measure text-xs text-ink-3">{shotsNote} MetaTrader 5 and its interface are the property of MetaQuotes.</p>
        </div>
      </section>

      {/* documented capabilities */}
      <section className="section hairline bg-paper" aria-labelledby="capabilities">
        <div className="wrap">
          <SectionHead eyebrow="Specification" title={<span id="capabilities">What the platform documents.</span>} lead="Capabilities of MetaTrader 5 itself, as published by its developer. They describe the software, not GIO4X’s trading conditions." />
          <div className="mt-34 grid gap-x-55 gap-y-34 md:grid-cols-2 lg:mt-55">
            {mt5Capabilities.map((g, i) => (
              <div key={g.group} data-reveal style={{ ["--i" as string]: i }}>
                <h3 className="label border-b border-line-strong pb-13">{g.group}</h3>
                <dl>
                  {g.rows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-baseline gap-21 border-b border-line py-13">
                      <dt className="text-sm text-ink-3">{row.label}</dt>
                      <dd className="num text-right text-[0.9375rem] font-medium text-ink">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <DataNote status="reference" source={metaquotes.label} sourceHref={metaquotes.href} className="mt-21">
            Platform capabilities only. Which of them apply to a GIO4X account depends on the account’s configuration.
          </DataNote>
        </div>
      </section>

      {/* GIO4X-specific: pending */}
      <section className="section hairline" aria-labelledby="at-gio4x">
        <div className="wrap phi items-start">
          <div data-reveal>
            <p className="eyebrow">MetaTrader 5 at GIO4X</p>
            <h2 id="at-gio4x" className="h2 mt-13">
              What GIO4X has still to publish.
            </h2>
            <p className="lead mt-21">These are the details that are specific to GIO4X rather than to the platform. None has been confirmed for publication, so each is shown as pending rather than guessed.</p>
            <p className="mt-21 text-sm text-ink-2">
              To ask about any of them, write to{" "}
              <a href={`mailto:${site.email}`} className="link">
                {site.email}
              </a>{" "}
              or use the{" "}
              <Link href="/contact" className="link">
                contact page
              </Link>
              .
            </p>
            <FigureNote figure={<PendingRack />} label="Worth knowing">
              None of these is published for 777 Raptor either. The{" "}
              <Link href="/platforms/compare" className="link">
                comparison page
              </Link>{" "}
              sets the two platforms side by side and marks every unpublished item in the same way.
            </FigureNote>
          </div>
          <ul className="border-t border-line-strong">
            {gioPending.map((f, i) => (
              <li key={f.key} className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-5 border-b border-line py-13" data-reveal style={{ ["--i" as string]: i }}>
                <span>
                  <span className="block font-medium text-ink">{f.label}</span>
                  <span className="block text-sm text-ink-3">{f.about}</span>
                </span>
                <NotPublished />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* learn */}
      <section className="section hairline bg-paper" aria-labelledby="learn">
        <div className="wrap">
          <SectionHead
            eyebrow="Learn MT5"
            title={<span id="learn">Eleven things worth knowing, in order.</span>}
            lead="An outline for learning the platform. Each topic points to the glossary terms and tools that already exist on this site."
            action={
              <Link href="/academy" className="go min-h-[2.75rem] md:min-h-0">
                Academy
              </Link>
            }
          />
          <ol className="mt-34 border-t border-line-strong lg:mt-55">
            {mt5Learn.map((t, i) => {
              const terms = t.glossary.map((s) => getTerm(s)).filter((x) => x !== undefined);
              const tls = t.tools.map((s) => getTool(s)).filter((x) => x !== undefined);
              return (
                <li key={t.topic} className="grid gap-x-21 gap-y-8 border-b border-line py-21 md:grid-cols-[2.125rem_minmax(0,1fr)_minmax(0,1.618fr)] md:items-baseline lg:grid-cols-[3.4375rem_minmax(0,0.8fr)_minmax(0,1.618fr)_minmax(0,1.2fr)]" data-reveal style={{ ["--i" as string]: Math.min(i, 6) }}>
                  <span className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="h4">{t.topic}</h3>
                  <p className="text-sm text-ink-2">{t.line}</p>
                  <ul className="flex flex-wrap gap-x-13 gap-y-5 text-sm md:col-span-2 md:col-start-2 lg:col-span-1 lg:col-start-auto lg:justify-end">
                    {terms.map((g) => (
                      <li key={g.slug}>
                        <Link href={`/glossary/${g.slug}`} className="link-quiet underline decoration-line-strong decoration-dotted underline-offset-4">
                          {g.term}
                        </Link>
                      </li>
                    ))}
                    {tls.map((tool) => (
                      <li key={tool.slug}>
                        <Link href={`/tools/${tool.slug}`} className="link">
                          {tool.name}
                        </Link>
                      </li>
                    ))}
                    {terms.length + tls.length === 0 && <li className="text-xs text-ink-3">Lesson to come</li>}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* getting started */}
      <section id="getting-started" className="section hairline scroll-mt-[4rem]" aria-labelledby="gs-title">
        <div className="wrap phi phi-r items-start">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2.125rem)]" data-reveal>
            <p className="eyebrow">Getting started</p>
            <h2 id="gs-title" className="h2 mt-13">
              The general sequence.
            </h2>
            <p className="lead mt-21">This is how starting on MetaTrader 5 usually goes with any broker.</p>
            <p className="mt-21 border-l border-accent pl-13 text-sm text-ink-2">The exact steps for GIO4X accounts will be published with the server details. Until then, do not rely on a server name or a download link from anywhere but GIO4X itself.</p>
            <Link href="/open-account" className="btn btn-primary mt-34">
              Open an account
            </Link>
            <FigureNote figure={<SequenceRoute />} label="In practice">
              Step four is the one that cannot be generalised. The server must be the one named by GIO4X, and the server name is among the details listed above as not yet published.
            </FigureNote>
          </div>
          <ol className="border-t border-line-strong">
            {mt5GettingStarted.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[3.4375rem_1fr] gap-x-13 border-b border-line py-21" data-reveal style={{ ["--i" as string]: Math.min(i, 6) }}>
                <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="h4">{s.title}</h3>
                  <p className="mt-5 max-w-measure text-sm text-ink-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* troubleshooting */}
      <section className="section hairline bg-paper" aria-labelledby="trouble">
        <div className="wrap phi items-start">
          <div data-reveal>
            <p className="eyebrow">Troubleshooting</p>
            <h2 id="trouble" className="h2 mt-13">
              When something does not work.
            </h2>
            <p className="lead mt-21">
              The honest answer to most of these depends on how a GIO4X account is configured, and that documentation is not published yet. Rather than print generic advice that may be wrong for your account, we would sooner you asked.
            </p>
            <div className="mt-34 flex flex-wrap gap-13">
              <Link href="/contact" className="btn btn-primary">
                Contact support
              </Link>
              <a href={`mailto:${site.email}`} className="btn btn-ghost normal-case tracking-normal">
                {site.email}
              </a>
            </div>
          </div>
          <div data-reveal>
            <p className="label">Support will help with</p>
            <ul className="mt-13 grid grid-cols-1 border-l border-t border-line sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {mt5Troubleshooting.map((t) => (
                <li key={t} className="border-b border-r border-line sm:max-lg:[&:last-child:nth-child(odd)]:col-span-2 xl:[&:last-child:nth-child(odd)]:col-span-2">
                  <Link href="/contact" className="flex min-h-[2.75rem] items-center justify-between gap-13 px-13 py-8 text-sm text-ink-2 transition-colors duration-fast hover:bg-surface hover:text-ink">
                    {t}
                    <span aria-hidden className="text-ink-3">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* trademark + risk */}
      <section className="section-quiet hairline" aria-label="Notices">
        <div className="wrap grid gap-34 md:grid-cols-2 md:gap-55">
          <div>
            <h2 className="label">Trademark notice</h2>
            <p className="mt-13 max-w-measure text-sm text-ink-2">{mt5Trademark}</p>
          </div>
          <div>
            <h2 className="label">Risk warning</h2>
            <p className="mt-13 text-sm text-ink-2">{riskWarning}</p>
            <Link href="/legal/risk" className="go mt-13 min-h-[2.75rem] md:min-h-0">
              Risk disclosure
            </Link>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Platforms", label: "777 Raptor", href: "/platforms/raptor", note: "The GIO4X flagship workspace." },
          { kind: "Platforms", label: "Compare platforms", href: "/platforms/compare", note: "What each one documents, side by side." },
          { kind: "Tools", label: "Order anatomy", href: "/tools/order-anatomy", note: "Market, limit and stop orders, visualised." },
          { kind: "Learn", label: "Glossary", href: "/glossary", note: "Every term on this page, defined." },
        ]}
      />
    </>
  );
}
