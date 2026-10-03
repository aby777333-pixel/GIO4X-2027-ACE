import { Shell } from "@/components/Shell";
import { PageHero } from "@/components/PageHero";
import { MetricGrid } from "@/components/MetricGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { PieChart, TrendingUp, Users, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import {
  loadFunds,
  loadMyInvestments,
  loadMyFund,
  loadMyTradingAccounts,
} from "@/lib/pamm-actions";
import { FundsGrid, InvestmentActions, BecomeManagerForm } from "./pamm-tools";
import { withBase } from "@/lib/base-path";

export const dynamic = "force-dynamic";

const fundStatusTone = {
  active: "success",
  pending: "warning",
  paused: "neutral",
  closed: "danger",
} as const;

export default async function PammPage() {
  const user = await getCurrentUser();
  const [funds, investments, myFund, accounts] = await Promise.all([
    loadFunds(),
    user ? loadMyInvestments() : Promise.resolve([]),
    user ? loadMyFund() : Promise.resolve(null),
    user ? loadMyTradingAccounts() : Promise.resolve([]),
  ]);

  const totalAum = funds.reduce((s, f) => s + f.aum, 0);
  const totalInvestors = funds.reduce((s, f) => s + f.investors, 0);
  const medianReturn =
    funds.length > 0
      ? [...funds].sort((a, b) => a.return_pct - b.return_pct)[Math.floor(funds.length / 2)]
          .return_pct
      : 0;

  const activeInvestments = investments.filter((i) => i.status === "active" && i.units > 0);
  const investedTotal = activeInvestments.reduce((s, i) => s + i.invested_amount, 0);
  const currentValue = activeInvestments.reduce((s, i) => s + i.current_value, 0);
  const unrealized = activeInvestments.reduce((s, i) => s + i.unrealized_pnl, 0);

  return (
    <Shell title="PAMM">
      <PageHero
        eyebrow="Managed Pools"
        image="/hero/hero-pamm.jpg"
        title="PAMM Pools"
        subtitle="Invest in professionally-managed pools. You buy NAV units; your stake scales proportionally with the pool's performance. Fees are charged only on redemption."
      />

      <MetricGrid
        columns={4}
        metrics={[
          { label: "Active pools", value: String(funds.length), icon: <PieChart size={14} /> },
          {
            label: "Total AUM",
            value: totalAum.toLocaleString(undefined, { maximumFractionDigits: 0 }),
            icon: <Wallet size={14} />,
          },
          {
            label: "Active investors",
            value: totalInvestors.toLocaleString(),
            icon: <Users size={14} />,
          },
          {
            label: "Median return",
            value: `${medianReturn >= 0 ? "+" : ""}${medianReturn.toFixed(1)}%`,
            icon: <TrendingUp size={14} />,
            deltaDirection: medianReturn >= 0 ? "up" : "down",
            delta: "NAV vs. inception",
          },
        ]}
      />

      {/* My positions */}
      {user && activeInvestments.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>My investments</CardTitle>
          </CardHeader>
          <CardBody className="px-0">
            <div className="grid gap-3 px-5 pb-4 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-steel-light">Invested</div>
                <div className="text-lg font-bold text-navy">
                  {investedTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-steel-light">
                  Current value
                </div>
                <div className="text-lg font-bold text-navy">
                  {currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-steel-light">
                  Unrealised P&L
                </div>
                <div className={unrealized >= 0 ? "text-lg font-bold text-success" : "text-lg font-bold text-danger"}>
                  {unrealized >= 0 ? "+" : ""}
                  {unrealized.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-steel-light">
                <tr>
                  <th className="py-3 pl-5 pr-4 font-medium">Pool</th>
                  <th className="px-4 py-3 text-right font-medium">Units</th>
                  <th className="px-4 py-3 text-right font-medium">Invested</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 text-right font-medium">P&L</th>
                  <th className="px-4 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {activeInvestments.map((i) => (
                  <tr key={i.investment_id} className="border-t border-slate-50">
                    <td className="py-3 pl-5 pr-4 font-medium text-navy">{i.fund_name}</td>
                    <td className="px-4 py-3 text-right text-navy">{i.units.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right text-navy">
                      {i.invested_amount.toFixed(2)} {i.currency}
                    </td>
                    <td className="px-4 py-3 text-right text-navy">{i.current_value.toFixed(2)}</td>
                    <td
                      className={
                        i.unrealized_pnl >= 0
                          ? "px-4 py-3 text-right font-medium text-success"
                          : "px-4 py-3 text-right font-medium text-danger"
                      }
                    >
                      {i.unrealized_pnl >= 0 ? "+" : ""}
                      {i.unrealized_pnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <InvestmentActions investment={i} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      {/* Discover */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-navy">Discover pools</h2>
        <FundsGrid funds={funds} signedIn={!!user} />
      </div>

      {/* Become a money manager */}
      <div id="become-manager" className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {myFund ? "Manage your fund" : "Become a money manager"}
            </CardTitle>
          </CardHeader>
          <CardBody>
            {!user ? (
              <p className="text-sm text-steel">
                <a href={withBase("/auth/login?redirect=/pamm")} className="font-medium text-sky hover:underline">
                  Sign in
                </a>{" "}
                to launch a managed pool.
              </p>
            ) : (
              <>
                {myFund ? (
                  <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <div>
                      <div className="text-sm font-semibold text-navy">{myFund.name}</div>
                      <div className="text-[11px] text-steel">
                        NAV {myFund.nav_per_unit.toFixed(4)} · AUM{" "}
                        {myFund.aum.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
                        {myFund.currency}
                      </div>
                    </div>
                    <StatusBadge tone={fundStatusTone[myFund.status]}>{myFund.status}</StatusBadge>
                  </div>
                ) : null}
                <BecomeManagerForm existing={myFund} accounts={accounts} />
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How payouts work</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-xs text-steel">
            <p>
              Investors buy NAV units in your pool. Every closed trade on your master account reprices
              the NAV, so all stakes move together.
            </p>
            <p>
              On redemption a time-prorated <strong>management fee</strong> and a high-water{" "}
              <strong>performance fee</strong> are netted from the investor&apos;s payout through the
              fee engine.
            </p>
            <p>
              Your share of those fees accrues to your IB commission wallet and settles alongside your
              other earnings.
            </p>
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}
