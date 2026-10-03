import { toolRhymes } from "@/data/tool-rhymes";
import type { ComponentType } from "react";
import { notFound } from "next/navigation";
import { SaveButton } from "@/components/desk/Buttons";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { CompoundGrowth } from "@/components/tools/CompoundGrowth";
import { CostLab } from "@/components/tools/CostLab";
import { CurrencyConverter } from "@/components/tools/CurrencyConverter";
import { Drawdown } from "@/components/tools/Drawdown";
import { LeverageVisualizer } from "@/components/tools/LeverageVisualizer";
import { Margin } from "@/components/tools/Margin";
import { OrderAnatomy } from "@/components/tools/OrderAnatomy";
import { PipValue } from "@/components/tools/PipValue";
import { PositionSize } from "@/components/tools/PositionSize";
import { ProfitLoss } from "@/components/tools/ProfitLoss";
import { RiskReward } from "@/components/tools/RiskReward";
import { SpreadVisualizer } from "@/components/tools/SpreadVisualizer";
import { SwipeNav } from "@/components/tools/SwipeNav";
import { ToolPager, type PagerTool } from "@/components/tools/ToolPager";
import type { RatesProp } from "@/components/tools/calc";
import { toolContent, toolGroups } from "@/components/tools/content";
import type { ToolProps } from "@/components/tools/ui";
import { getTerm } from "@/data/glossary";
import { getTool, tools } from "@/data/tools";
import { pageMeta } from "@/lib/meta";
import { getReferenceRates, RATE_CURRENCIES, type RateCurrency } from "@/lib/rates";
import { webPageSchema } from "@/lib/schema";

/** slug → the interactive component, and whether it converts with the ECB reference rates */
const TOOLS: Record<string, { Component: ComponentType<ToolProps>; rates: boolean }> = {
  "position-size": { Component: PositionSize, rates: true },
  "pip-value": { Component: PipValue, rates: true },
  margin: { Component: Margin, rates: true },
  "profit-loss": { Component: ProfitLoss, rates: true },
  "risk-reward": { Component: RiskReward, rates: true },
  drawdown: { Component: Drawdown, rates: false },
  "compound-growth": { Component: CompoundGrowth, rates: false },
  "currency-converter": { Component: CurrencyConverter, rates: true },
  "cost-lab": { Component: CostLab, rates: true },
  "leverage-visualizer": { Component: LeverageVisualizer, rates: false },
  "spread-visualizer": { Component: SpreadVisualizer, rates: true },
  "order-anatomy": { Component: OrderAnatomy, rates: false },
};

/** The tools in the order the hub lists them (its groups, then anything not yet grouped): the order "previous" and "next" follow. */
const ORDER: string[] = [...toolGroups.flatMap((g) => g.slugs), ...tools.map((t) => t.slug)].filter((s, i, all) => s in TOOLS && getTool(s) !== undefined && all.indexOf(s) === i);

function pagerTool(slug: string | undefined): PagerTool | null {
  const t = slug ? getTool(slug) : undefined;
  return t ? { href: `/tools/${t.slug}`, name: t.name } : null;
}

export function generateStaticParams() {
  return tools.filter((t) => t.slug in TOOLS).map((t) => ({ slug: t.slug }));
}

type Params = { params: Promise<{ slug: string }> };

const pageTitle = (name: string, kind: string) => (kind === "Calculator" && !/calculator|converter/i.test(name) ? `${name} Calculator` : name);

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return pageMeta({ ownCard: true, title: pageTitle(tool.name, tool.kind), description: tool.description, path: `/tools/${tool.slug}` });
}

/** Only the latest fixing crosses to the client: eight numbers and a date. */
async function latestRates(): Promise<RatesProp> {
  const r = await getReferenceRates();
  if (r.status !== "ok") return r;
  const last = r.dates.length - 1;
  const perEur = Object.fromEntries(RATE_CURRENCIES.map((c) => [c, r.perEur[c][last]])) as Record<RateCurrency, number>;
  return { status: "ok", date: r.date, perEur };
}

export default async function ToolPage({ params }: Params) {
  const { slug } = await params;
  const tool = getTool(slug);
  const entry = TOOLS[slug];
  const content = toolContent[slug];
  if (!tool || !entry || !content) notFound();

  const rates: RatesProp = entry.rates ? await latestRates() : { status: "unavailable", reason: "Not used by this tool" };
  const glossary = tool.glossary.flatMap((g) => {
    const term = getTerm(g);
    return term ? [{ slug: term.slug, term: term.term }] : [];
  });
  const next = tool.next.flatMap((s) => {
    const t = getTool(s);
    return t ? [{ label: t.name, href: `/tools/${t.slug}`, note: t.line, kind: t.kind }] : [];
  });
  const { Component } = entry;
  const at = ORDER.indexOf(slug);
  const prev = pagerTool(at > 0 ? ORDER[at - 1] : undefined);
  const nextTool = pagerTool(at >= 0 ? ORDER[at + 1] : undefined);
  const pager = { prev, next: nextTool, index: Math.max(0, at), total: ORDER.length };

  return (
    // on a touch screen a swipe left or right does what the pager's links do
    <SwipeNav prev={prev?.href ?? null} next={nextTool?.href ?? null}>
      <JsonLd data={webPageSchema({ path: `/tools/${tool.slug}`, name: pageTitle(tool.name, tool.kind), description: tool.description })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Tools", href: "/tools" },
          { name: tool.name, href: `/tools/${tool.slug}` },
        ]}
        eyebrow={`Trader Toolkit · ${tool.kind}`}
        title={tool.name}
        lead={tool.line}
      >
        {/* keeps the tool on My desk (/desk), in this browser only */}
        <SaveButton href={`/tools/${tool.slug}`} title={tool.name} className="btn btn-ghost" />
      </PageHero>

      <ToolPager {...pager} />

      {toolRhymes[tool.slug] && (
        <div className="wrap pt-21">
          <p className="gx-couplet !mb-0" aria-label="A couplet to remember this tool by">
            <span>{toolRhymes[tool.slug][0]}</span>
            <span>{toolRhymes[tool.slug][1]}</span>
          </p>
        </div>
      )}

      <section className="section-quiet" aria-label={`${tool.name}: the tool`}>
        <div className="wrap">
          <Component meta={{ slug: tool.slug, name: tool.name, formula: tool.formula, glossary }} rates={rates} />
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="plain">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">In plain language</p>
            <h2 id="plain" className="h3 mt-13 max-w-[18ch]">
              {content.heading}
            </h2>
          </div>
          <div className="prose-gx">
            {content.paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      <ToolPager {...pager} foot />

      <NextSteps title="Continue" items={[...next.slice(0, 3), content.context]} />
    </SwipeNav>
  );
}
