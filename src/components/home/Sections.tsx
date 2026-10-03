import Link from "next/link";
import { Rosette } from "@/components/brand/Rosette";
import { SectionHead } from "@/components/ui/Page";
import { accountRows, accounts } from "@/data/accounts";
import { assetClasses, instrumentsByClass } from "@/data/instruments";
import { latestArticles } from "@/data/articles";

/** A quiet section. Three principles set as numbered lines, not cards. */
export function Philosophy() {
  const principles = [
    { n: "01", t: "Say only what can be shown.", d: "Trading conditions are published as they are. Data carries its source and its date. Where we do not yet have a verified answer, the page says so." },
    { n: "02", t: "Explain before you sell.", d: "Every market, cost and order type on this site has a plain explanation one step away, and most have a tool that lets you work the numbers yourself." },
    { n: "03", t: "Respect the client’s capital.", d: "No countdowns, no bonuses dressed as urgency, no pressure. Risk is stated in ordinary type, in the place where the decision is made." },
  ];
  return (
    <section className="section relative overflow-clip" aria-labelledby="philosophy">
      {/* a watermark behind the text; it has a little depth where motion is allowed (HomeStory) */}
      <div aria-hidden data-depth="-3" className="gx-depth-mark -right-[5.5rem] top-[2.125rem] hidden lg:block">
        <Rosette size={377} bare strokeWidth={0.5} />
      </div>
      <div className="wrap phi phi-r relative items-start">
        <div data-reveal>
          <p className="eyebrow">The house philosophy</p>
          <h2 id="philosophy" className="h2 mt-13">
            A gentleman is known by his conduct. So is a broker.
          </h2>
        </div>
        <ol className="grid gap-px border-t border-line">
          {principles.map((p, i) => (
            <li key={p.n} className="grid grid-cols-[3.4375rem_1fr] gap-x-13 border-b border-line py-21" data-reveal style={{ ["--i" as string]: i }}>
              <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{p.n}</span>
              <div>
                <h3 className="h4">{p.t}</h3>
                <p className="mt-8 max-w-measure text-ink-2">{p.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The six asset classes as a typographic index. Each row is one link. */
export function AssetIndex() {
  return (
    <section className="section hairline bg-paper" aria-labelledby="asset-index">
      <div className="wrap">
        <SectionHead
          eyebrow="Markets"
          title={<span id="asset-index">Six asset classes. One account.</span>}
          lead="Each market has its own structure, hours and drivers. Start with the one you want to understand."
          action={
            <Link href="/markets" className="go">
              Market Command
            </Link>
          }
        />
        <ul className="mt-55 border-t border-line-strong">
          {assetClasses.map((a, i) => {
            const list = instrumentsByClass(a.key);
            return (
              <li key={a.key} className="border-b border-line" data-reveal style={{ ["--i" as string]: i }}>
                <Link href={`/markets/${a.key}`} className="group grid items-baseline gap-x-21 gap-y-5 py-21 transition-colors duration-fast hover:bg-surface md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)_15rem] md:px-13">
                  <span className="flex items-baseline gap-13">
                    <span className="num w-21 text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                    <span className="h3 transition-colors duration-fast group-hover:text-accent">{a.name}</span>
                  </span>
                  <span className="pl-34 text-ink-2 md:pl-0">{a.line}</span>
                  <span className="flex items-baseline gap-13 pl-34 md:justify-end md:pl-0">
                    <span className="text-xs text-ink-3">
                      {list
                        .slice(0, 3)
                        .map((x) => x.symbol)
                        .join(" · ")}
                      {list.length > 3 ? ` +${list.length - 3}` : ""}
                    </span>
                    <span className="go" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** The dominant chapter: two platforms, set in the night material. */
export function PlatformsChapter() {
  return (
    <section className="on-night relative overflow-hidden" aria-labelledby="platforms-chapter">
      {/* taller than the section, so that its few pixels of depth (HomeStory) never show an edge */}
      <div aria-hidden data-depth="-2" className="grid-field pointer-events-none absolute inset-x-0 -bottom-[2.125rem] -top-[2.125rem] opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <div className="wrap relative section-quiet pb-55 lg:pb-89">
        <div className="phi items-end">
          <div data-reveal>
            <p className="eyebrow">Platforms</p>
            <h2 id="platforms-chapter" className="h1 mt-21">
              Two platforms.
              <br />
              One market universe.
            </h2>
          </div>
          <p className="lead" data-reveal>
            Choose the trading environment that matches how you work. Neither is the better one; they are different instruments for the same markets.
          </p>
        </div>

        {/* The workspace itself has just been drawn by the sequence above, so this
            chapter is typographic: two platforms, stated side by side. */}
        <div className="mt-55 grid border-t border-night-line md:grid-cols-2">
          <article className="flex flex-col justify-between gap-34 py-34 md:pr-55" data-reveal>
            <div>
              <p className="label">The GIO4X flagship</p>
              <h3 className="h2 mt-13">777 Raptor</h3>
              <p className="mt-13 max-w-[38ch] text-on-night-2">Built for the market. A multi-asset workspace on web, desktop and mobile, designed around how a trading day actually unfolds: see, organise, analyse, act, monitor.</p>
            </div>
            <Link href="/platforms/raptor" className="btn btn-primary self-start">
              Explore Raptor
            </Link>
          </article>
          <article className="flex flex-col justify-between gap-34 border-t border-night-line py-34 md:border-l md:border-t-0 md:pl-55" data-reveal style={{ ["--i" as string]: 2 }}>
            <div>
              <p className="label">The established standard</p>
              <h3 className="h2 mt-13">MetaTrader 5</h3>
              <p className="mt-13 max-w-[38ch] text-on-night-2">Global markets, familiar workflow. The multi-asset platform from MetaQuotes that many traders already know, with its charting, order types and automated trading through Expert Advisors.</p>
            </div>
            <Link href="/platforms/metatrader-5" className="btn btn-ghost self-start">
              Explore MT5
            </Link>
          </article>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-34 gap-y-13 border-t border-night-line pt-21">
          <p className="text-sm text-on-night-2">
            Not sure which suits you?{" "}
            <Link href="/platforms/compare" className="link text-on-night">
              Compare the two, without a winner
            </Link>
            .
          </p>
          <p className="text-xs text-on-night-2">MetaTrader 5 is a trademark of MetaQuotes Ltd.</p>
        </div>
      </div>
    </section>
  );
}

/** Accounts as one comparison table: no three pricing cards. */
export function AccountsTable() {
  return (
    <section className="section" aria-labelledby="accounts-home">
      <div className="wrap">
        <SectionHead
          eyebrow="Accounts"
          title={<span id="accounts-home">Three accounts, compared plainly.</span>}
          lead="The difference between them is how you pay for trading: through the spread, or through a raw spread plus commission."
          action={
            <Link href="/trading/accounts" className="go">
              Account types
            </Link>
          }
        />
        <div className="panel scroll-x mt-34 px-21 pb-8 pt-13 lg:px-34" data-reveal>
          <table className="table-gx min-w-[38rem]">
            <caption className="sr-only">Comparison of Classic, Premium and ECN accounts</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[30%]">
                  <span className="sr-only">Specification</span>
                </th>
                {accounts.map((a) => (
                  <th key={a.key} scope="col">
                    <span className="block font-display text-xl font-normal normal-case tracking-normal text-ink">{a.name}</span>
                    <span className="mt-2 block font-sans normal-case tracking-normal text-ink-3">{a.suits}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accountRows.slice(0, 6).map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="!border-line !py-0 !text-[0.8125rem] !font-normal !normal-case !tracking-normal">
                    {r.term ? (
                      <Link href={`/glossary/${r.term}`} className="link-quiet underline decoration-line-strong decoration-dotted underline-offset-4">
                        {r.label}
                      </Link>
                    ) : (
                      r.label
                    )}
                  </th>
                  {accounts.map((a) => (
                    <td key={a.key} className="num text-[0.9375rem] font-medium">
                      {String(a[r.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-13 max-w-measure text-xs text-ink-3">Conditions as published by GIO4X. Spreads are minimums and widen with market conditions; leverage available to you depends on the instrument and your jurisdiction.</p>
      </div>
    </section>
  );
}

/** Tools: one worked example in the layout itself (drawdown mathematics), then the hub. */
export function ToolsTeaser() {
  const rows = [10, 25, 50, 75].map((loss) => ({ loss, gain: (loss / (100 - loss)) * 100 }));
  const tools = [
    { href: "/tools/position-size", t: "Position size", d: "From the risk you accept to the size you trade." },
    { href: "/tools/margin", t: "Margin", d: "What a position ties up, at any leverage." },
    { href: "/tools/pip-value", t: "Pip value", d: "What one pip is worth in your currency." },
    { href: "/tools/cost-lab", t: "Cost Lab", d: "Spread, commission and swap, added up in the open." },
  ];
  return (
    <section className="section hairline bg-paper" aria-labelledby="tools-home">
      <div className="wrap phi items-start">
        <div>
          <SectionHead eyebrow="Trader Toolkit" title={<span id="tools-home">Work the numbers before the market does.</span>} lead="Twelve calculators and visualisers that share their inputs, show their formulae and never tell you what to trade." />
          <ul className="mt-34 grid border-l border-t border-line sm:grid-cols-2">
            {tools.map((t, i) => (
              <li key={t.href} className="border-b border-r border-line" data-reveal style={{ ["--i" as string]: i }}>
                <Link href={t.href} className="group block p-21 transition-colors duration-fast hover:bg-surface">
                  <span className="h4 block">{t.t}</span>
                  <span className="mt-5 block text-sm text-ink-3">{t.d}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/tools" className="go mt-21">
            All tools
          </Link>
        </div>
        <figure className="panel p-21 lg:p-34" data-reveal>
          <figcaption>
            <p className="label">Drawdown mathematics</p>
            <p className="h4 mt-8">A loss needs a larger gain to recover.</p>
          </figcaption>
          <dl className="mt-21 grid gap-13">
            {rows.map((r) => (
              <div key={r.loss} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-13">
                <dt className="num text-sm text-neg">
                  <span aria-hidden>{"▼"} </span>
                  {r.loss}%
                </dt>
                <dd className="contents">
                  <span className="relative block h-[13px]" aria-hidden>
                    <span className="absolute inset-y-0 left-0 bg-[color-mix(in_srgb,var(--neg)_24%,transparent)]" style={{ width: `${r.loss / 3}%` }} />
                    <span className="absolute inset-y-0 border-r border-ink" style={{ left: `${r.loss / 3}%` }} />
                    <span className="absolute inset-y-0 bg-[color-mix(in_srgb,var(--pos)_24%,transparent)]" style={{ left: `${r.loss / 3}%`, width: `${Math.min(100 - r.loss / 3, r.gain / 3)}%` }} />
                  </span>
                  <span className="num text-right text-sm text-pos">
                    <span aria-hidden>{"▲"} </span>
                    {r.gain.toFixed(r.gain < 100 ? 1 : 0)}%
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-21 text-xs text-ink-3">Gain required = loss ÷ (1 − loss). Arithmetic, not a forecast.</p>
          <Link href="/tools/drawdown" className="go mt-13">
            Try your own figures
          </Link>
        </figure>
      </div>
    </section>
  );
}

/** Trust, shown as architecture: four doors, each to something verifiable. */
export function TrustBlock() {
  const doors = [
    { href: "/trust/verify", k: "Verify", t: "Is this link really GIO4X?", d: "Paste any address and check it against the official registry." },
    { href: "/trust/transparency", k: "Disclose", t: "What we publish, and what we don’t yet.", d: "Costs, conditions, company details and the questions still open." },
    { href: "/trust/data-methodology", k: "Source", t: "Where every number comes from.", d: "What “reference”, “indicative” and “schedule” mean on this site." },
    { href: "/legal/risk", k: "Risk", t: "The risk disclosure, in readable type.", d: "Leveraged trading can lose money quickly. Read this first." },
  ];
  return (
    <section className="section" aria-labelledby="trust-home">
      <div className="wrap">
        <div className="phi phi-r items-end">
          <div className="relative" data-reveal>
            <Rosette size={89} dna className="mb-21" />
            <p className="eyebrow">Trust Centre</p>
            <h2 id="trust-home" className="h2 mt-13">
              Trust is not a claim. It is an architecture.
            </h2>
          </div>
          <p className="lead" data-reveal>
            You should not have to take a broker at its word. These four pages exist so that you can check.
          </p>
        </div>
        <ul className="mt-55 grid gap-px overflow-hidden rounded border border-line bg-line md:grid-cols-2 xl:grid-cols-4">
          {doors.map((d, i) => (
            <li key={d.href} className="bg-bg" data-reveal style={{ ["--i" as string]: i }}>
              <Link href={d.href} className="group flex h-full flex-col gap-55 p-21 transition-colors duration-fast hover:bg-paper lg:p-34">
                <span className="label text-prestige-ink">{d.k}</span>
                <span>
                  <span className="h4 block">{d.t}</span>
                  <span className="mt-8 block text-sm text-ink-3">{d.d}</span>
                  <span className="go mt-21" aria-hidden>
                    Open
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Intelligence: a lead and two secondaries, set like a front page. Hidden when nothing is published. */
export function IntelligenceTeaser() {
  const [lead, ...rest] = latestArticles(3);
  if (!lead) return null;
  return (
    <section className="section hairline bg-paper" aria-labelledby="intel-home">
      <div className="wrap">
        <SectionHead
          eyebrow="GIO4X Intelligence"
          title={<span id="intel-home">Read something worth your time.</span>}
          action={
            <Link href="/intelligence" className="go">
              All Intelligence
            </Link>
          }
        />
        <div className="mt-34 grid gap-34 border-t border-line-strong pt-34 lg:grid-cols-phi lg:gap-55">
          <article data-reveal>
            <p className="label">{lead.format}</p>
            <h3 className="h2 mt-13">
              <Link href={`/intelligence/${lead.slug}`} className="transition-colors duration-fast hover:text-accent">
                {lead.title}
              </Link>
            </h3>
            <p className="lead mt-13 max-w-measure">{lead.excerpt}</p>
            <p className="mt-21 text-xs text-ink-3">
              {lead.byline} · {lead.readMinutes} min read
            </p>
          </article>
          <div className="grid content-start gap-px border-t border-line lg:border-l lg:border-t-0 lg:pl-55">
            {rest.map((a, i) => (
              <article key={a.slug} className="border-b border-line py-21 first:pt-21 lg:first:pt-0" data-reveal style={{ ["--i" as string]: i + 1 }}>
                <p className="label">{a.format}</p>
                <h3 className="h4 mt-8">
                  <Link href={`/intelligence/${a.slug}`} className="transition-colors duration-fast hover:text-accent">
                    {a.title}
                  </Link>
                </h3>
                <p className="mt-5 text-sm text-ink-3">{a.readMinutes} min read</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
