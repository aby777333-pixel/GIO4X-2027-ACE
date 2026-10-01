import type { ComponentType } from "react";
import { notFound } from "next/navigation";
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
import type { RatesProp } from "@/components/tools/calc";
import { toolContent } from "@/components/tools/content";
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

export const dynamicParams = false;

export function generateStaticParams() {
  return tools.filter((t) => t.slug in TOOLS).map((t) => ({ slug: t.slug }));
}

type Params = { params: Promise<{ slug: string }> };

const pageTitle = (name: string, kind: string) => (kind === "Calculator" && !/calculator|converter/i.test(name) ? `${name} Calculator` : name);

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return pageMeta({ title: pageTitle(tool.name, tool.kind), description: tool.description, path: `/tools/${tool.slug}` });
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

  return (
    <>
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
      />

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

      <NextSteps title="Continue" items={[...next.slice(0, 3), content.context]} />
    </>
  );
}
