import Link from "next/link";
import type { ReactNode } from "react";
import { RouteScene } from "@/components/cockpit/RouteScene";
import { BeatRail } from "@/components/platforms/BeatRail";
import { NotPublished } from "@/components/platforms/FactState";
import { RaptorTour } from "@/components/platforms/RaptorTour";
import { LayoutStudies, RaptorWorkspace } from "@/components/platforms/RaptorWorkspace";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs, NextSteps, SectionHead } from "@/components/ui/Page";
import { riskWarning } from "@/config/legal";
import { site } from "@/config/site";
import { assetClasses } from "@/data/instruments";
import { platforms, raptorBeats, raptorPending } from "@/data/platforms";
import { pageMeta } from "@/lib/meta";
import { softwareSchema } from "@/lib/schema";

const p = platforms.raptor;
const description = "777 Raptor is the GIO4X flagship platform: a multi-asset trading workspace on web, desktop and mobile. See how a trader uses each part of it, and what has not been published yet.";

export const metadata = pageMeta({ title: "777 Raptor", description, path: "/platforms/raptor" });

function Frame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-md border border-line bg-surface p-8 shadow-2 sm:p-13 ${className}`}>{children}</div>;
}

function BeatText({ beat }: { beat: { n: number; title: string; body: string; links: { label: string; href: string }[] } }) {
  const { n, title, body, links } = beat;
  return (
    <div>
      <p className="num text-xs font-semibold tracking-[0.12em] text-prestige-ink">{String(n).padStart(2, "0")}</p>
      <h3 className="h2 mt-13">{title}</h3>
      <p className="lead mt-21 max-w-[46ch]">{body}</p>
      {links.length > 0 && (
        <ul className="mt-21 flex flex-wrap gap-x-21 gap-y-8">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="link text-sm">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const devices: { key: string; name: string; line: string; pending: string; icon: ReactNode }[] = [
  {
    key: "web",
    name: "Web",
    line: "In a browser, with nothing to install.",
    pending: "Address not yet published",
    icon: (
      <>
        <rect x="1.5" y="6.5" width="52" height="34" rx="3" />
        <path d="M1.5 14.5h52M7 10.5h2M12 10.5h2M17 10.5h2" />
      </>
    ),
  },
  {
    key: "desktop",
    name: "Desktop",
    line: "As an application on a computer.",
    pending: "Installer not yet published",
    icon: (
      <>
        <rect x="1.5" y="4.5" width="52" height="32" rx="3" />
        <path d="M20 44.5h15M27.5 36.5v8" />
      </>
    ),
  },
  {
    key: "mobile",
    name: "Mobile",
    line: "As an app on a phone.",
    pending: "Store listing not yet published",
    icon: (
      <>
        <rect x="16.5" y="1.5" width="22" height="44" rx="4" />
        <path d="M24 40.5h7" />
      </>
    ),
  },
];

export default function RaptorPage() {
  const beat = (key: string) => {
    const i = raptorBeats.findIndex((b) => b.key === key);
    return { n: i + 1, ...raptorBeats[i] };
  };
  const see = beat("see");
  const build = beat("build");
  const analyse = beat("analyse");
  const act = beat("act");
  const monitor = beat("monitor");

  return (
    <>
      <JsonLd data={softwareSchema({ path: p.href, name: p.name, description })} />

      {/* ── The night chapter: hero, story, tour ─────────────────────────── */}
      <div className="on-night">
        <header className="cx-hero on-night">
          <div className="cx-stage" aria-hidden>
            <RouteScene />
          </div>
          <div className="cx-main">
            <div className="cx-statement">
              <Breadcrumbs
                crumbs={[
                  { name: "Platforms", href: "/platforms" },
                  { name: "777 Raptor", href: p.href },
                ]}
              />
              <div className="cx-statement-body" style={{ animation: "gx-rise 680ms var(--ease-out) both" }}>
                <p className="eyebrow">{p.role}</p>
                <h1 className="h1 mt-21">
                  777 Raptor
                  <br />
                  <span className="text-ink-3">Built for the market.</span>
                </h1>
                <p className="lead mt-21 max-w-[52ch]">{p.summary}</p>
                <div className="mt-34 flex flex-wrap items-center gap-13">
                  <a href="#tour" className="btn btn-primary">
                    Walk around it
                  </a>
                  <Link href="/platforms/compare" className="btn btn-ghost">
                    Compare platforms
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* the workspace study: the first thing under the stage */}
        <div className="relative overflow-hidden">
          <div aria-hidden className="grid-field pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%]"
            style={{
              background:
                "radial-gradient(50% 60% at 50% 100%, color-mix(in srgb, var(--dna-blue) 22%, transparent), transparent 70%), radial-gradient(34% 44% at 72% 100%, color-mix(in srgb, var(--dna-emerald) 14%, transparent), transparent 70%), radial-gradient(34% 44% at 28% 100%, color-mix(in srgb, var(--dna-teal) 14%, transparent), transparent 70%)",
            }}
          />
          <div className="wrap relative">
            <figure className="relative pt-55 lg:pt-89" style={{ animation: "gx-rise 1100ms var(--ease-out) 260ms both" }}>
              <figcaption className="mb-13 flex items-center justify-between gap-21 text-xs text-ink-3">
                <span className="label">The workspace</span>
                <span>Illustrative study, not a screenshot</span>
              </figcaption>
              <div className="[mask-image:linear-gradient(to_bottom,black_52%,transparent_98%)]">
                <div className="rounded-t-md border border-b-0 border-line-strong bg-surface p-8 pb-0 shadow-3 sm:p-13 sm:pb-0">
                  <RaptorWorkspace className="h-auto w-full" />
                </div>
              </div>
            </figure>
          </div>
        </div>

        {/* the five-beat narrative */}
        <section aria-labelledby="story" className="relative">
          <div className="wrap section">
            <div className="grid grid-cols-1 gap-34 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-55">
              <div>
                <h2 id="story" className="label mb-13 lg:mb-21">
                  A trading day, in five movements
                </h2>
                <BeatRail beats={raptorBeats.map((b) => ({ id: `beat-${b.key}`, label: b.title.split(" ")[0].replace(/\.$/, "") }))} />
              </div>

              <div className="grid grid-cols-1 gap-89 lg:gap-144">
                {/* 01 — see */}
                <article id="beat-see" className="grid scroll-mt-[8rem] grid-cols-1 items-center gap-34 lg:grid-cols-phi-r lg:gap-55" data-reveal>
                  <BeatText beat={see} />
                  <Frame>
                    <RaptorWorkspace className="h-auto w-full" focus={see.regions} label="Illustrative study: market explorer, watchlist and chart brought forward" />
                  </Frame>
                </article>

                {/* 02 — build */}
                <article id="beat-build" className="scroll-mt-[8rem]" data-reveal>
                  <div className="grid items-end gap-21 lg:grid-cols-2 lg:gap-55">
                    <div>
                      <p className="num text-xs font-semibold tracking-[0.12em] text-prestige-ink">{String(build.n).padStart(2, "0")}</p>
                      <h3 className="h2 mt-13">{build.title}</h3>
                    </div>
                    <p className="lead">{build.body}</p>
                  </div>
                  <div className="mt-34 border-y border-line py-34">
                    <div className="scroll-x">
                      <LayoutStudies className="h-auto w-full min-w-[34rem]" />
                    </div>
                  </div>
                  <p className="mt-13 text-xs text-ink-3">Three arrangements of the same panels, drawn to show the idea. They are not a list of layouts the platform ships with.</p>
                </article>

                {/* 03 — analyse */}
                <article id="beat-analyse" className="grid scroll-mt-[8rem] grid-cols-1 items-center gap-34 lg:grid-cols-phi lg:gap-55" data-reveal>
                  <Frame className="order-2 lg:order-1">
                    <RaptorWorkspace className="h-auto w-full" viewBox="200 37 520 363" focus={["chart"]} label="Illustrative study of the chart area, enlarged" />
                  </Frame>
                  <div className="order-1 lg:order-2">
                    <BeatText beat={analyse} />
                  </div>
                </article>

                {/* 04 — act */}
                <article id="beat-act" className="grid scroll-mt-[8rem] grid-cols-1 items-center gap-34 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-89" data-reveal>
                  <Frame className="order-2 max-w-[19rem] sm:order-1">
                    <RaptorWorkspace className="h-auto w-full" viewBox="720 37 240 299" focus={["order"]} label="Illustrative study of the order entry area, enlarged" />
                  </Frame>
                  <div className="order-1 sm:order-2">
                    <BeatText beat={act} />
                    <dl className="mt-34 grid max-w-[34rem] border-t border-line">
                      {[
                        ["Size", "How much, set from the risk you accept."],
                        ["Stop", "The price at which the idea is wrong."],
                        ["Target", "Where you would be content to be out."],
                      ].map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[5.5rem_1fr] gap-13 border-b border-line py-13 text-sm">
                          <dt className="label pt-2">{k}</dt>
                          <dd className="text-ink-2">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </article>

                {/* 05 — monitor */}
                <article id="beat-monitor" className="scroll-mt-[8rem]" data-reveal>
                  <div className="grid items-end gap-21 lg:grid-cols-phi lg:gap-55">
                    <div>
                      <p className="num text-xs font-semibold tracking-[0.12em] text-prestige-ink">{String(monitor.n).padStart(2, "0")}</p>
                      <h3 className="h2 mt-13">{monitor.title}</h3>
                      <p className="lead mt-21 max-w-[52ch]">{monitor.body}</p>
                    </div>
                    <ul className="flex flex-wrap gap-x-21 gap-y-8 lg:justify-end">
                      {monitor.links.map((l) => (
                        <li key={l.href}>
                          <Link href={l.href} className="link text-sm">
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Frame className="mt-34">
                    <div className="scroll-x">
                      <RaptorWorkspace className="h-auto w-full min-w-[38rem]" viewBox="200 400 760 200" focus={["positions", "history", "risk"]} label="Illustrative study of positions, history and risk controls, enlarged" />
                    </div>
                  </Frame>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* interface tour */}
        <section id="tour" aria-labelledby="tour-title" className="relative scroll-mt-[4rem] border-t border-line bg-paper">
          <div className="wrap section">
            <SectionHead
              eyebrow="Interface tour"
              title={<span id="tour-title">Walk around the workspace.</span>}
              lead="Nine areas, each with one job. Choose a marker, or a name in the list, to see what that part of a trading workspace is for."
            />
            <div className="mt-34 lg:mt-55">
              <RaptorTour />
            </div>
          </div>
        </section>
      </div>

      {/* ── Back in daylight: what is known, and what is not ─────────────── */}
      <section className="section" aria-labelledby="runs">
        <div className="wrap">
          <SectionHead eyebrow="Availability" title={<span id="runs">Where Raptor runs.</span>} lead="Both previous GIO4X websites describe Raptor on the web, on desktop and on mobile. The links that take you there have not been published yet, so none are shown." />
          <ul className="mt-34 grid border-t border-line-strong md:grid-cols-3 lg:mt-55">
            {devices.map((d, i) => (
              <li key={d.key} className={`flex flex-col gap-21 border-b border-line py-34 md:border-b-0 md:px-34 md:first:pl-0 md:last:pr-0 ${i > 0 ? "md:border-l" : ""}`} data-reveal style={{ ["--i" as string]: i }}>
                <svg viewBox="0 0 55 47" className="h-[2.9375rem] w-[3.4375rem] text-ink-2" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
                  {d.icon}
                </svg>
                <div>
                  <h3 className="h3">{d.name}</h3>
                  <p className="mt-8 text-ink-2">{d.line}</p>
                </div>
                <NotPublished className="mt-auto">{d.pending}</NotPublished>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="raptor-markets">
        <div className="wrap phi phi-r items-start">
          <div data-reveal>
            <p className="eyebrow">Markets</p>
            <h2 id="raptor-markets" className="h2 mt-13">
              The asset classes GIO4X lists.
            </h2>
            <p className="lead mt-21">Raptor is described as a multi-asset workspace. Each class below opens the market page, with its structure, hours and indicative conditions.</p>
            <p className="mt-21">
              <NotPublished>An instrument-by-instrument list for Raptor is not yet published</NotPublished>
            </p>
          </div>
          <ul className="border-t border-line-strong">
            {assetClasses.map((a, i) => (
              <li key={a.key} className="border-b border-line" data-reveal style={{ ["--i" as string]: i }}>
                <Link href={`/markets/${a.key}`} className="group grid grid-cols-[2.125rem_1fr_auto] items-baseline gap-x-13 py-21 transition-colors duration-fast hover:bg-surface md:px-13">
                  <span className="num text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="h4 block transition-colors duration-fast group-hover:text-accent">{a.name}</span>
                    <span className="mt-3 block text-sm text-ink-3">{a.line}</span>
                  </span>
                  <span className="go" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section hairline" aria-labelledby="pending">
        <div className="wrap phi items-start">
          <div data-reveal>
            <p className="eyebrow">Stated plainly</p>
            <h2 id="pending" className="h2 mt-13">
              What is not published yet.
            </h2>
            <p className="lead mt-21">
              This page describes what a trader does in each part of a workspace. It does not list features, speeds or figures, because none have been verified for publication. These are the documents still to come.
            </p>
            <p className="mt-21 text-sm text-ink-2">
              If you need one of them before you decide, ask:{" "}
              <a href={`mailto:${site.email}`} className="link">
                {site.email}
              </a>{" "}
              or the{" "}
              <Link href="/contact" className="link">
                contact page
              </Link>
              .
            </p>
          </div>
          <ul className="border-t border-line-strong">
            {raptorPending.map((r, i) => (
              <li key={r.id} id={r.id} className="scroll-mt-[8rem] border-b border-line py-21" data-reveal style={{ ["--i" as string]: i }}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-5">
                  <h3 className="h4">{r.label}</h3>
                  <NotPublished />
                </div>
                <p className="mt-5 text-sm text-ink-2">{r.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* technology credit */}
      <section className="on-night" aria-label="Technology credit">
        <div className="wrap flex flex-col gap-21 py-55 md:flex-row md:items-center md:justify-between">
          <div className="max-w-[40rem]">
            <p className="label">Technology</p>
            <p className="h3 mt-8">Technology provided by 777 Raptor.</p>
            <p className="mt-8 text-ink-2">The Raptor platform is built by 777 Raptor and offered to GIO4X clients as the house flagship.</p>
            <a href={site.technologyPartner.url} target="_blank" rel="noopener noreferrer" className="go mt-21 min-h-[2.75rem] md:min-h-0">
              777raptor.com
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
          <picture>
            <source srcSet="/brand/777-raptor-logo.webp" type="image/webp" />
            <img src={site.technologyPartner.logo} alt="777 Raptor" width={site.technologyPartner.logoWidth} height={site.technologyPartner.logoHeight} loading="lazy" decoding="async" className="h-[5.5625rem] w-auto opacity-90" />
          </picture>
        </div>
      </section>

      <section className="section-quiet" aria-labelledby="raptor-risk">
        <div className="wrap">
          <h2 id="raptor-risk" className="label">
            Risk warning
          </h2>
          <p className="mt-13 max-w-measure text-sm text-ink-2">{riskWarning}</p>
          <Link href="/legal/risk" className="go mt-21 min-h-[2.75rem] md:min-h-0">
            Risk disclosure
          </Link>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Platforms", label: "MetaTrader 5", href: "/platforms/metatrader-5", note: "The other way into the same markets." },
          { kind: "Platforms", label: "Compare platforms", href: "/platforms/compare", note: "What each one documents, side by side." },
          { kind: "Trading", label: "Account types", href: "/trading/accounts", note: "Classic, Premium and ECN." },
          { kind: "Tools", label: "Order anatomy", href: "/tools/order-anatomy", note: "What each order type actually does." },
        ]}
      />
    </>
  );
}
