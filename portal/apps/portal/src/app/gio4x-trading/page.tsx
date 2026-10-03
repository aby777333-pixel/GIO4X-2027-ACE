import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHero } from "@/components/PageHero";
import { MetricGrid } from "@/components/MetricGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@gio4x/ui";
import { LINKS } from "@/lib/constants";
import { Bot, Star, TrendingUp, Zap } from "lucide-react";

const products = [
  {
    name: "GIO4X Index — Conservative",
    risk: "Low",
    target: "8–12% / yr",
    drawdown: "≤ 4%",
    minTicket: 250,
    blurb: "Multi-asset basket weighted toward investment-grade carry trades. Monthly rebalance.",
  },
  {
    name: "GIO4X Macro — Balanced",
    risk: "Medium",
    target: "15–22% / yr",
    drawdown: "≤ 10%",
    minTicket: 1000,
    blurb: "Discretionary macro overlay on FX majors and gold. Active risk on event-driven days.",
    badge: "Most popular",
  },
  {
    name: "GIO4X Momentum — Aggressive",
    risk: "High",
    target: "30%+ / yr",
    drawdown: "≤ 25%",
    minTicket: 2500,
    blurb: "Trend-following on indices and crypto with leverage. Designed for risk-on environments.",
  },
  {
    name: "GIO4X AI — GIO Bots",
    risk: "Medium",
    target: "18–28% / yr",
    drawdown: "≤ 15%",
    minTicket: 500,
    blurb: "Quant ensemble of in-house models running 24/7 on FX, metals, and indices.",
    badge: "New",
  },
];

export default function Gio4xTradingPage() {
  return (
    <Shell title="GIO4X Trading">
      <PageHero
        eyebrow="GIO4X Strategies"
        image="/hero/hero-trading.jpg"
        title="GIO4X Trading"
        subtitle="GIO4X-curated structured strategies. One-click subscribe — we handle execution."
      />

      <MetricGrid
        columns={4}
        metrics={[
          { label: "Live strategies", value: "12", icon: <Star size={14} /> },
          { label: "Median 12M return", value: "+18.2%", icon: <TrendingUp size={14} />, deltaDirection: "up", delta: "vs SP500 +12.4%" },
          { label: "Avg drawdown", value: "9.1%", icon: <Zap size={14} /> },
          { label: "AUM (all strategies)", value: "$48.2M", icon: <Bot size={14} /> },
        ]}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {products.map((p) => (
          <Card key={p.name}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>{p.name}</CardTitle>
                {p.badge ? <StatusBadge tone={p.badge === "New" ? "info" : "warning"}>{p.badge}</StatusBadge> : null}
              </div>
              <StatusBadge tone={p.risk === "High" ? "danger" : p.risk === "Medium" ? "warning" : "success"}>
                {p.risk} risk
              </StatusBadge>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-steel">{p.blurb}</p>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-steel">Target</dt>
                  <dd className="mt-1 text-sm font-semibold text-navy">{p.target}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-steel">Max DD</dt>
                  <dd className="mt-1 text-sm font-semibold text-navy">{p.drawdown}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-steel">Min ticket</dt>
                  <dd className="mt-1 text-sm font-semibold text-navy">${p.minTicket.toLocaleString()}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <Link href="/pamm">
                  <Button variant="primary">Subscribe</Button>
                </Link>
                <Link
                  href={LINKS.raptor.terminal}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-navy hover:border-sky/40"
                >
                  View in Raptor
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
