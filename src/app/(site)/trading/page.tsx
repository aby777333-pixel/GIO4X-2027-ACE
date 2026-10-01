import Link from "next/link";
import { RiskNote } from "@/components/trading/Blocks";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { riskWarning } from "@/config/legal";
import { tradingIndex } from "@/data/trading";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Trading",
  description: "How trading with GIO4X is arranged: account types, trading conditions, funding, copy trading, PAMM, partner programmes and the tools to work the numbers yourself.",
  path: "/trading",
});

export default function TradingPage() {
  const starts = tradingIndex.map((_, gi) => tradingIndex.slice(0, gi).reduce((sum, g) => sum + g.items.length, 0));
  return (
    <>
      <PageHero
        eyebrow="Trading"
        title="How trading with GIO4X is arranged."
        lead="The account you hold, what it costs to trade, how money moves, and the ways of taking part beyond placing your own orders. Each page says what is published and names what is not."
      >
        <Link href="/trading/accounts" className="btn btn-primary">
          Account types
        </Link>
        <Link href="/trading/conditions" className="btn btn-ghost">
          Trading conditions
        </Link>
      </PageHero>

      <section className="section" aria-label="Trading index">
        <div className="wrap grid gap-55 lg:gap-89">
          {tradingIndex.map((g, gi) => (
            <div key={g.group} className="grid gap-x-55 gap-y-13 lg:grid-cols-[13rem_minmax(0,1fr)]">
              <h2 className="label pt-21 lg:border-t lg:border-line-strong">
                {g.group}
              </h2>
              <ul className="border-t border-line-strong">
                {g.items.map((it, ii) => {
                  const n = starts[gi] + ii + 1;
                  return (
                    <li key={it.href} className="border-b border-line">
                      <Link href={it.href} className="group grid items-baseline gap-x-21 gap-y-5 py-21 transition-colors duration-fast hover:bg-paper md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:px-13 xl:grid-cols-[25rem_minmax(0,1fr)_12rem]">
                        <span className="flex items-baseline gap-13">
                          <span className="num w-21 shrink-0 text-xs text-ink-3">{String(n).padStart(2, "0")}</span>
                          <span className="h3 transition-colors duration-fast group-hover:text-accent">{it.name}</span>
                        </span>
                        <span className="pl-34 text-ink-2 md:pl-0">{it.line}</span>
                        <span className="flex items-baseline gap-13 pl-34 md:col-span-2 xl:col-span-1 xl:justify-end xl:pl-0">
                          <span className="text-xs text-ink-3">{it.detail}</span>
                          <span className="go" aria-hidden />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <RiskNote text={riskWarning} />

      <NextSteps
        items={[
          { kind: "Start here", label: "Account types", href: "/trading/accounts", note: "Classic, Premium and ECN, compared." },
          { kind: "Platforms", label: "Choose a platform", href: "/platforms", note: "777 Raptor and MetaTrader 5." },
          { kind: "Tools", label: "Cost Lab", href: "/tools/cost-lab", note: "Spread, commission and swap, added up." },
          { kind: "Open", label: "Open an account", href: "/open-account", note: "When you are ready, not before." },
        ]}
      />
    </>
  );
}
