import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { MetricGrid } from "@/components/MetricGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { Users, TrendingUp, Wallet, Receipt } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { loadMySubscriptions } from "@/lib/copy-actions";
import { SubscriptionActions } from "../copy-tools";

export const dynamic = "force-dynamic";

function tone(status: string) {
  return status === "active" ? "success" : status === "paused" ? "warning" : "neutral";
}

export default async function CopierPage() {
  const user = await getCurrentUser();
  const subs = user ? await loadMySubscriptions() : [];

  const totalAllocated = subs.reduce((s, f) => s + f.allocation, 0);
  const totalPnl = subs.reduce((s, f) => s + f.realized_pnl, 0);
  const totalFees = subs.reduce((s, f) => s + f.fees_paid, 0);
  const activeCount = subs.filter((f) => f.status === "active").length;

  return (
    <Shell title="GIO4X Copy · Copier">
      <PageHeader
        title="My Copy Trading"
        subtitle="Manage the providers you follow, their allocation and copy ratio."
        actions={
          <Link
            href="/copy/discover"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white hover:bg-sky-light"
          >
            Discover providers
          </Link>
        }
      />

      {!user ? (
        <div className="mb-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-steel">
          <Link href="/auth/login?redirect=/copy/copier" className="font-medium text-sky hover:underline">
            Sign in
          </Link>{" "}
          to manage the strategies you copy.
        </div>
      ) : null}

      <MetricGrid
        columns={4}
        metrics={[
          { label: "Active follows", value: String(activeCount), icon: <Users size={14} /> },
          { label: "Total allocated", value: `$${totalAllocated.toFixed(2)}`, icon: <Wallet size={14} /> },
          {
            label: "Realised P&L",
            value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`,
            icon: <TrendingUp size={14} />,
            deltaDirection: totalPnl >= 0 ? "up" : "down",
          },
          { label: "Performance fees paid", value: `$${totalFees.toFixed(2)}`, icon: <Receipt size={14} /> },
        ]}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Strategies I copy</CardTitle>
        </CardHeader>
        <CardBody className="px-0">
          {subs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-steel">
              You&apos;re not copying any strategies yet.{" "}
              <Link href="/copy/discover" className="font-medium text-sky hover:underline">
                Discover providers
              </Link>{" "}
              to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-steel-light">
                <tr>
                  <th className="py-3 pl-5 pr-4 font-medium">Provider</th>
                  <th className="px-4 py-3 text-right font-medium">Allocation</th>
                  <th className="px-4 py-3 text-right font-medium">Ratio</th>
                  <th className="px-4 py-3 text-right font-medium">Realised P&L</th>
                  <th className="px-4 py-3 text-right font-medium">Fees</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.subscription_id} className="border-t border-slate-50">
                    <td className="py-3 pl-5 pr-4">
                      <div className="font-medium text-navy">{s.provider_name}</div>
                      <div className="text-[10px] text-steel">
                        since {new Date(s.started_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-navy">
                      ${s.allocation.toFixed(2)} {s.currency}
                    </td>
                    <td className="px-4 py-3 text-right text-navy">{s.copy_ratio.toFixed(2)}×</td>
                    <td
                      className={
                        s.realized_pnl >= 0
                          ? "px-4 py-3 text-right font-medium text-success"
                          : "px-4 py-3 text-right font-medium text-danger"
                      }
                    >
                      {s.realized_pnl >= 0 ? "+" : ""}${s.realized_pnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-steel">${s.fees_paid.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge tone={tone(s.status)}>{s.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <SubscriptionActions sub={s} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </Shell>
  );
}
