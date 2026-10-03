import { HiddenRiddle } from "@/components/verse/Verse";
import { PunchLine } from "@/components/ui/PunchLine";
import Link from "next/link";
import { FigureNote } from "@/components/figures/Figure";
import { LeverBeam } from "@/components/figures/product/LeverBeam";
import { WorkedLines } from "@/components/figures/product/WorkedLines";
import { HeroCompanion } from "@/components/figures/stage/HeroCompanion";
import { SharedFigures } from "@/components/figures/stage/SharedFigures";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { HubMini } from "@/components/tools/HubMini";
import { PageTour } from "@/components/tour/PageTour";
import type { PageTourStop } from "@/components/tour/stops";
import { toolGroups } from "@/components/tools/content";
import { educationalNote } from "@/config/legal";
import { getTool, tools, type Tool } from "@/data/tools";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const description =
  "Twelve calculators and visualisers for position size, pip value, margin, cost, leverage and order types. They share your inputs, show their formulae and working, and never tell you what to trade.";

export const metadata = pageMeta({ title: "Trader Toolkit", description, path: "/tools" });

const grouped = toolGroups.map((g) => ({ ...g, items: g.slugs.flatMap((s) => getTool(s) ?? []) }));
/** Anything added to the registry later still appears, even before it is given a group. */
const ungrouped = tools.filter((t) => !toolGroups.some((g) => g.slugs.includes(t.slug)));

/** The first-visit Toolkit tour. Each step repeats what the page says at the place it points to. */
const tour: PageTourStop[] = [
  { title: "Twelve tools, one system", body: "Calculators and visualisers that work together. Each shows its formula and the working with your own numbers. None of them tells you what to trade." },
  { target: "main .cx-hero .cx-aside", title: "One set of figures", body: "Set a balance and a risk share here. Instrument, account currency, balance, lot size, leverage and risk are kept in your browser and shared by all twelve tools. Nothing is sent to GIO4X." },
  ...toolGroups.map((g): PageTourStop => ({ target: `[data-tour-group="${g.key}"]`, title: g.title, body: `${g.question} ${g.note}` })),
  { target: "#rules", title: "Arithmetic in the open", body: "Every result sits beside its formula and the same formula with your numbers in it, line by line, so any figure can be checked by hand. Starting figures are placeholders, not suggestions." },
  { title: "Inside a tool", body: "Save keeps a tool on My desk, in this browser only. Previous and next links at the top and foot of each tool lead through all twelve in order; on a phone, a swipe left or right does the same." },
];

function ToolRow({ tool }: { tool: Tool }) {
  return (
    <li className="border-b border-line">
      <Link href={`/tools/${tool.slug}`} className="group grid gap-x-21 gap-y-5 py-21 transition-colors duration-fast hover:bg-surface md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)_auto] md:items-baseline md:px-13">
        <span>
          <span className="h4 block transition-colors duration-fast group-hover:text-accent">{tool.name}</span>
          <span className="label mt-3 block">{tool.kind}</span>
        </span>
        <span>
          <span className="block text-ink-2">{tool.line}</span>
          <span className="num mt-5 block text-xs text-ink-3">{tool.formula}</span>
        </span>
        <span className="go mt-8 md:mt-0" aria-hidden>
          Open
        </span>
      </Link>
    </li>
  );
}

export default function ToolsHub() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/tools", name: "GIO4X Trader Toolkit", description })} />
      <PageTour id="tools" stops={tour} />
      <PageHero
        crumbs={[{ name: "Tools", href: "/tools" }]}
        eyebrow="Trader Toolkit"
        title="GIO4X Trader Toolkit"
        lead="Twelve calculators and visualisers that work as one system. Set a balance, an instrument or a risk figure in one and it is there in the next. Each shows its formula and the working with your own numbers. None of them tells you what to trade."
        aside={<HubMini />}
        companion={
          <HeroCompanion figure={<SharedFigures />} label="One set of figures">
            Instrument, account currency, balance, lot size, leverage and risk are kept in your browser and shared by all twelve tools. Nothing is sent to GIO4X. Set a balance and a risk share here, open any tool below, and both are already in place.
          </HeroCompanion>
        }
      >
        <a href="#size" className="btn btn-primary">
          Browse the tools
        </a>
        <Link href="/glossary" className="btn btn-ghost">
          Glossary
        </Link>
      </PageHero>

      {grouped.map((g, i) => (
        <section key={g.key} id={g.key} className={`${i === 0 ? "section" : "section-quiet"} ${i > 0 ? "hairline" : ""} ${i % 2 === 1 ? "bg-paper" : ""}`} aria-labelledby={`${g.key}-title`}>
          <div className="wrap phi phi-r items-start">
            <div className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]" data-reveal={i > 0 ? true : undefined}>
              <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</p>
              <h2 id={`${g.key}-title`} className="h2 mt-13">
                {g.title}
              </h2>
              <p className="lead mt-13">{g.question}</p>
              <p className="mt-13 max-w-narrow text-sm text-ink-3">{g.note}</p>
              {g.key === "cost" && (
                // three tools make a short list: on wide screens the heading column carries where the inputs come from, as the rules below state
                <p className="mt-21 hidden max-w-narrow border-l border-line-strong pl-13 text-sm leading-relaxed text-ink-3 lg:block">
                  Costs start from the conditions GIO4X publishes, and conversions use the European Central Bank’s daily reference rate, named and dated. Everything else is a number you typed.
                </p>
              )}
              {g.key === "mechanics" && (
                <FigureNote figure={<LeverBeam />}>Each one starts from placeholder figures. Change a figure and the drawing follows, with its formula and the working beside it.</FigureNote>
              )}
            </div>
            <ul className="border-t border-line-strong" data-reveal={i > 0 ? true : undefined} data-tour={i === 0 ? "tools" : undefined} data-tour-group={g.key}>
              {g.items.map((t) => (
                <ToolRow key={t.slug} tool={t} />
              ))}
            </ul>
          </div>
        </section>
      ))}

      {ungrouped.length > 0 && (
        <section className="section-quiet hairline" aria-label="More tools">
          <div className="wrap">
            <ul className="border-t border-line-strong">
              {ungrouped.map((t) => (
                <ToolRow key={t.slug} tool={t} />
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="section hairline" aria-labelledby="rules">
        <div className="wrap phi items-start">
          <div data-reveal>
            <p className="eyebrow">How the toolkit behaves</p>
            <h2 id="rules" className="h2 mt-13 max-w-[16ch]">
              Arithmetic in the open, and nothing more.
            </h2>
            <FigureNote figure={<WorkedLines />} label="Checking by hand">
              In any tool, the column headed “How it works” gives the formula, then the same formula with your numbers, one step to a line. Follow one figure down the lines and the result can be reproduced on paper.
            </FigureNote>
          </div>
          <ol className="border-t border-line">
            {[
              { t: "One set of figures.", d: "Instrument, account currency, balance, lot size, leverage and risk are kept in your browser and shared by all twelve tools. Nothing is sent to GIO4X." },
              { t: "No hidden step.", d: "Every result sits beside its formula and the same formula with your numbers in it, line by line, so any figure can be checked by hand." },
              { t: "Sourced or yours.", d: "Conversions use the European Central Bank’s daily reference rate, named and dated. Costs start from the conditions GIO4X publishes. Everything else is a number you typed." },
              { t: "No suggestions.", d: "There are no recommended settings and no “optimal” values. Starting figures are placeholders that make the working visible." },
            ].map((p, i) => (
              <li key={p.t} className="grid grid-cols-[2.125rem_minmax(0,1fr)] gap-x-13 border-b border-line py-21" data-reveal style={{ ["--i" as string]: i }}>
                <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="h4">{p.t}</h3>
                  <p className="mt-5 max-w-measure text-ink-2">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="wrap">
          <p className="mt-34 max-w-measure text-xs text-ink-3">{educationalNote} Results are calculations on the figures you enter and do not describe any real account, quote or trade.</p>
        </div>
      </section>

      <HiddenRiddle id="tools" />

      <PunchLine k="tools" />

      <NextSteps
        items={[
          { label: "Account types", href: "/trading/accounts", note: "The published spread and commission each tool starts from.", kind: "Trading" },
          { label: "Glossary", href: "/glossary", note: "Every term the tools use, defined.", kind: "Reference" },
          { label: "Market Command", href: "/markets", note: "Instruments, contracts and trading hours.", kind: "Markets" },
          { label: "Risk disclosure", href: "/legal/risk", note: "Read this before trading with leverage.", kind: "Legal" },
        ]}
      />
    </>
  );
}
