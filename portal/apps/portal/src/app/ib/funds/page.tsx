import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { Coins, Calendar } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { loadMyRebateSummary } from "@/lib/rebate-actions";
import { RebateButtons } from "./rebate-buttons";

export const dynamic = "force-dynamic";

type Payout = { id: string; date: string; amount: number; status: string; ref: string };

const cols: Column<Payout>[] = [
  { key: "date", header: "Date", render: (r) => <span className="text-navy">{r.date}</span> },
  { key: "amount", header: "Amount", align: "right", render: (r) => <span className="font-semibold text-success">{r.amount.toFixed(2)}</span> },
  { key: "ref", header: "Reference", render: (r) => <span className="font-mono text-[11px] text-steel">{r.ref}</span> },
  { key: "status", header: "Status", render: (r) => <StatusBadge tone={r.status === "completed" ? "success" : "warning"}>{r.status}</StatusBadge> },
];

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function IbFundsPage() {
  const user = await getCurrentUser();
  const summary = await loadMyRebateSummary("USD");

  return (
    <Shell title="IB Funds">
      <PageHeader title="IB Funds" subtitle="Your rebate wallet and payout history." />

      {!user ? (
        <Card>
          <CardBody className="px-6 py-10 text-center text-sm text-steel">
            <Link href="/auth/login?redirect=/ib/funds" className="font-medium text-sky hover:underline">Sign in</Link>{" "}
            to see your IB rebate wallet.
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card className="overflow-hidden">
              <div className="relative bg-gradient-to-br from-white via-sky/5 to-sky/15 p-7">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky/20 blur-3xl" />
                <div className="relative">
                  <div className="text-xs uppercase tracking-wider text-sky">Rebate wallet</div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-4xl font-bold text-navy">{fmt(summary.rebateBalance)}</span>
                    <span className="text-lg text-steel">{summary.currency}</span>
                  </div>
                  <div className="mt-1 text-xs text-steel-light">
                    Unclaimed: ${fmt(summary.unclaimed)} · Lifetime accrued: ${fmt(summary.lifetime)}
                  </div>
                  <div className="mt-5">
                    <RebateButtons
                      currency={summary.currency}
                      hasUnclaimed={summary.unclaimed > 0}
                      hasRebateBalance={summary.rebateBalance > 0}
                    />
                  </div>
                </div>
              </div>
              <CardBody>
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-steel">Unclaimed</div>
                    <div className="mt-1 text-sm font-semibold text-navy">${fmt(summary.unclaimed)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-steel">In rebate wallet</div>
                    <div className="mt-1 text-sm font-semibold text-navy">${fmt(summary.rebateBalance)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-steel">Lifetime</div>
                    <div className="mt-1 text-sm font-semibold text-navy">${fmt(summary.lifetime)}</div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>How rebates work</CardTitle></CardHeader>
              <CardBody className="space-y-3 text-xs text-steel">
                <div className="flex items-start gap-2"><Coins size={14} className="mt-0.5 text-sky" /><span><strong className="text-navy">Claim</strong> moves your accrued commission into your rebate wallet.</span></div>
                <div className="flex items-start gap-2"><Calendar size={14} className="mt-0.5 text-sky" /><span><strong className="text-navy">Transfer to Wallet</strong> sends the rebate balance to your main wallet, ready to withdraw.</span></div>
                <p className="border-t border-slate-100 pt-2">
                  Commission accrues automatically as your referred clients trade.{" "}
                  <Link href="/ib/report" className="text-sky hover:underline">View your IB report →</Link>
                </p>
              </CardBody>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Rebate wallet activity</CardTitle>
              <ExportCsvButton
                filename={`gio4x-ib-rebates-${new Date().toISOString().slice(0, 10)}.csv`}
                headers={["Date", "Amount", "Reference", "Status"]}
                rows={summary.payouts.map((p) => [p.date, p.amount, p.ref, p.status])}
              />
            </CardHeader>
            <CardBody className="px-0 pt-2">
              {summary.payouts.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-steel">
                  No rebate activity yet. Commission appears here once your clients trade and you claim it.
                </div>
              ) : (
                <DataTable columns={cols} rows={summary.payouts} />
              )}
            </CardBody>
          </Card>
        </>
      )}
    </Shell>
  );
}
