import { PunchLine } from "@/components/ui/PunchLine";
import Link from "next/link";
import { Screenshot } from "@/components/platforms/Screenshot";
import { shots } from "@/data/platform-shots";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { mt5Trademark, platforms } from "@/data/platforms";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Platforms",
  description: "GIO4X offers two trading environments: 777 Raptor, the house flagship, and MetaTrader 5 by MetaQuotes. What each one is, and how to compare them.",
  path: "/platforms",
});

/** Lines the outer edge of a full-bleed half up with the page's `.wrap` column. */
const edge = "max(var(--gutter), calc((100vw - var(--page)) / 2))";

const ways = [
  { n: "01", t: "Read the matrix", d: "One row per dimension, with what is documented for both platforms and what is not yet published.", href: "/platforms/compare#matrix" },
  { n: "02", t: "Say what matters to you", d: "Desktop, mobile, charting, automation: pick your priorities and the relevant rows come forward.", href: "/platforms/compare#matters" },
  { n: "03", t: "Answer two questions", d: "Where you trade and what you value. You get the documented facts for each platform, and the decision stays yours.", href: "/platforms/compare#finder" },
];

export default function PlatformsPage() {
  const r = platforms.raptor;
  const m = platforms.mt5;
  return (
    <>
      <PageHero
        eyebrow="Platforms"
        title={
          <>
            Two ways to enter the market.
            <br />
            <span className="text-ink-3">One GIO4X.</span>
          </>
        }
        lead="Two different trading environments under one roof. Neither is the better one; they are different rooms in the same house."
      />

      {/* two visual worlds, not two cards */}
      <section aria-label="The two platforms" className="grid lg:grid-cols-2" data-tour="platforms">
        <article className="on-night relative flex flex-col overflow-hidden" aria-labelledby="world-raptor">
          <div aria-hidden className="grid-field pointer-events-none absolute inset-0 opacity-80 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
            style={{ background: "radial-gradient(60% 70% at 40% 100%, color-mix(in srgb, var(--dna-blue) 20%, transparent), transparent 70%)" }}
          />
          <div className="relative flex h-full flex-col gap-34 py-55 pr-gutter lg:gap-55 lg:py-89 lg:pr-55" style={{ paddingLeft: edge }}>
            <div>
              <p className="label">
                <span className="num text-prestige-ink">01</span> · {r.role} · Technology by 777 Raptor
              </p>
              <h2 id="world-raptor" className="h1 mt-21">
                {r.name}
              </h2>
              <p className="h3 mt-8 text-ink-3">{r.tagline}</p>
            </div>
            <Screenshot shot={shots.raptorWorkspace} crop="16 / 9" sizes="(min-width: 1024px) 50vw, 100vw" eager />
            <div className="mt-auto">
              <p className="max-w-[34rem] text-md text-ink-2">{r.summary}</p>
              <Link href={r.href} className="btn btn-primary mt-34">
                Explore Raptor
              </Link>
            </div>
          </div>
        </article>

        <article className="relative flex flex-col overflow-hidden bg-paper" aria-labelledby="world-mt5">
          <div className="relative flex h-full flex-col gap-34 py-55 pl-gutter lg:gap-55 lg:py-89 lg:pl-55" style={{ paddingRight: edge }}>
            <div>
              <p className="label">
                <span className="num text-prestige-ink">02</span> · {m.role} · By MetaQuotes
              </p>
              <h2 id="world-mt5" className="h1 mt-21">
                {m.name}
              </h2>
              <p className="h3 mt-8 text-ink-3">{m.tagline}</p>
            </div>
            <Screenshot shot={shots.mt5Terminal} crop="16 / 9" sizes="(min-width: 1024px) 50vw, 100vw" eager />
            <div className="mt-auto">
              <p className="max-w-[34rem] text-md text-ink-2">{m.summary}</p>
              <Link href={m.href} className="btn btn-ghost mt-34">
                Explore MT5
              </Link>
            </div>
          </div>
        </article>
      </section>
      <div className="wrap">
        <p className="py-13 text-xs text-ink-3">Both images are screenshots of demo accounts, cropped to the same shape. The prices in them are what the demo showed when it was captured: not live data, and not GIO4X trading conditions.</p>
      </div>

      <section className="section hairline" aria-labelledby="choose">
        <div className="wrap phi phi-r items-start">
          <div data-reveal>
            <p className="eyebrow">Compare</p>
            <h2 id="choose" className="h2 mt-13">
              Choose your trading environment.
            </h2>
            <p className="lead mt-21">Not the “better” platform: the one that fits the way you work. The comparison has no winner and no scores, only what each platform documents.</p>
            <Link href="/platforms/compare" className="btn btn-primary mt-34">
              Compare platforms
            </Link>
          </div>
          <ol className="border-t border-line-strong">
            {ways.map((w, i) => (
              <li key={w.n} className="border-b border-line" data-reveal style={{ ["--i" as string]: i }}>
                <Link href={w.href} className="group grid grid-cols-[2.125rem_1fr_auto] items-baseline gap-x-13 py-21 transition-colors duration-fast hover:bg-paper md:px-13">
                  <span className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">{w.n}</span>
                  <span>
                    <span className="h4 block transition-colors duration-fast group-hover:text-accent">{w.t}</span>
                    <span className="mt-5 block max-w-measure text-sm text-ink-2">{w.d}</span>
                  </span>
                  <span className="go" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="independence">
        <div className="wrap grid gap-21 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-55">
          <h2 id="independence" className="label pt-3">
            Trademark and independence
          </h2>
          <div className="max-w-measure text-sm text-ink-2">
            <p>{mt5Trademark}</p>
            <p className="mt-13">
              777 Raptor technology is provided by 777 Raptor. Official software and addresses for both platforms are listed on the{" "}
              <Link href="/trust/verify" className="link">
                verification page
              </Link>{" "}
              once they are published; until then, this site links to no download.
            </p>
          </div>
        </div>
      </section>

      <PunchLine k="platforms" />

      <NextSteps
        items={[
          { kind: "Flagship", label: "777 Raptor", href: "/platforms/raptor", note: "Built for the market." },
          { kind: "Third-party", label: "MetaTrader 5", href: "/platforms/metatrader-5", note: "Global markets. Familiar workflow." },
          { kind: "Compare", label: "Compare platforms", href: "/platforms/compare", note: "No winner, no scores." },
          { kind: "Trading", label: "Account types", href: "/trading/accounts", note: "Classic, Premium and ECN." },
        ]}
      />
    </>
  );
}
