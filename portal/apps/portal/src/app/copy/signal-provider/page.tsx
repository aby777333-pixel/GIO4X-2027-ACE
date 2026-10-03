import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { MetricGrid } from "@/components/MetricGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { Award, DollarSign, Star, TrendingUp, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { loadMyProvider, loadMyTradingAccounts } from "@/lib/copy-actions";
import { BecomeProviderForm } from "../copy-tools";

export const dynamic = "force-dynamic";

const statusTone = {
  active: "success",
  pending: "warning",
  paused: "neutral",
  closed: "danger",
} as const;

const statusCopy = {
  pending: "Under review — our team will activate your strategy once checks pass.",
  active: "Live. Your closed trades are mirrored to opted-in followers in real time.",
  paused: "Paused — new follower trades are not being mirrored.",
  closed: "Closed. Contact support to re-open your strategy.",
} as const;

export default async function SignalProviderPage() {
  const user = await getCurrentUser();
  const [existing, accounts] = user
    ? await Promise.all([loadMyProvider(), loadMyTradingAccounts()])
    : [null, []];

  return (
    <Shell title="GIO4X Copy · Signal Provider">
      <PageHeader
        title="Become a Signal Provider"
        subtitle="Publish your strategy to the GIO4X network and earn a share of follower performance fees."
      />

      {!user ? (
        <div className="mb-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-steel">
          <Link
            href="/auth/login?redirect=/copy/signal-provider"
            className="font-medium text-sky hover:underline"
          >
            Sign in
          </Link>{" "}
          to apply as a signal provider.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{existing ? "Your strategy" : "Apply"}</CardTitle>
          </CardHeader>
          <CardBody>
            {existing ? (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <div className="text-xs text-steel">{statusCopy[existing.status]}</div>
                <StatusBadge tone={statusTone[existing.status]}>{existing.status}</StatusBadge>
              </div>
            ) : null}
            {user ? (
              <BecomeProviderForm existing={existing} accounts={accounts} />
            ) : (
              <p className="text-sm text-steel">Sign in to start your application.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How payouts work</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3 text-xs">
              <li className="flex gap-2">
                <DollarSign size={14} className="mt-0.5 shrink-0 text-sky" />
                <span className="text-steel">
                  You set a performance fee up to 50%. It&apos;s charged to followers only on new
                  high-water-mark profit.
                </span>
              </li>
              <li className="flex gap-2">
                <Award size={14} className="mt-0.5 shrink-0 text-sky" />
                <span className="text-steel">
                  Your 80% share of each fee accrues to your IB commission balance and settles to your
                  wallet alongside your other earnings.
                </span>
              </li>
              <li className="flex gap-2">
                <TrendingUp size={14} className="mt-0.5 shrink-0 text-sky" />
                <span className="text-steel">
                  Link a master trading account so your closed trades mirror automatically. You never
                  share login credentials.
                </span>
              </li>
              <li className="flex gap-2">
                <Star size={14} className="mt-0.5 shrink-0 text-sky" />
                <span className="text-steel">
                  Top performers are featured on the Discover leaderboard, ranked by realised P&L.
                </span>
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-navy">Once you go live</h3>
        <MetricGrid
          columns={4}
          metrics={[
            { label: "Performance fee", value: "Up to 50%", icon: <DollarSign size={14} />, hint: "On high-water-mark profit" },
            { label: "Provider share", value: "80%", icon: <Award size={14} />, hint: "Of each fee, to your wallet" },
            { label: "Mirroring", value: "Real-time", icon: <TrendingUp size={14} /> },
            { label: "Leaderboard", value: "By P&L", icon: <Users size={14} /> },
          ]}
        />
      </div>
    </Shell>
  );
}
