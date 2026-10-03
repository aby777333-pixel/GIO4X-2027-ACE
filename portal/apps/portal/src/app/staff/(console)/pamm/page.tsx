import { Card, CardBody, CardHeader, CardTitle, StatTile } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { loadAllFunds } from "@/lib/pamm-actions";
import { FundStatusButtons } from "./pamm-tools";
import { PieChart, Clock, CheckCircle2, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

const statusTone = {
  active: "success",
  pending: "warning",
  paused: "neutral",
  closed: "danger",
} as const;

export default async function StaffPammPage() {
  const funds = await loadAllFunds();
  const pending = funds.filter((f) => f.status === "pending");
  const active = funds.filter((f) => f.status === "active");
  const totalAum = active.reduce((s, f) => s + f.aum, 0);

  const tiles = [
    { label: "Total funds", value: String(funds.length), unit: "", icon: <PieChart size={16} /> },
    { label: "Awaiting review", value: String(pending.length), unit: "", icon: <Clock size={16} /> },
    { label: "Live funds", value: String(active.length), unit: "", icon: <CheckCircle2 size={16} /> },
    {
      label: "Live AUM",
      value: totalAum.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      unit: "",
      icon: <Wallet size={16} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="PAMM / MAM"
        subtitle="Review money-manager fund applications and manage the live roster. Approving a fund opens it for investment and lets each closed master trade reprice its NAV through the pool engine."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatTile key={t.label} icon={t.icon} label={t.label} value={t.value} unit={t.unit} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Managed pools</CardTitle>
        </CardHeader>
        <CardBody className="px-0">
          {funds.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-steel">
              No money-manager applications yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-steel-light">
                <tr>
                  <th className="py-3 pl-5 pr-4 font-medium">Fund</th>
                  <th className="px-4 py-3 font-medium">Manager</th>
                  <th className="px-4 py-3 text-right font-medium">Mgmt</th>
                  <th className="px-4 py-3 text-right font-medium">Perf</th>
                  <th className="px-4 py-3 text-right font-medium">NAV</th>
                  <th className="px-4 py-3 text-right font-medium">AUM</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {funds.map((f) => (
                  <tr key={f.id} className="border-t border-slate-50 align-top">
                    <td className="py-3 pl-5 pr-4">
                      <div className="font-medium text-navy">{f.name}</div>
                      {f.headline ? (
                        <div className="mt-0.5 line-clamp-2 max-w-xs text-[11px] text-steel">
                          {f.headline}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-navy">{f.full_name ?? "—"}</div>
                      <div className="text-[10px] text-steel">{f.email ?? f.manager_id.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-navy">
                      {(f.management_fee_bps / 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-navy">
                      {(f.performance_fee_bps / 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-right text-navy">{f.nav_per_unit.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right text-navy">
                      {f.aum.toLocaleString(undefined, { maximumFractionDigits: 0 })} {f.currency}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge tone={statusTone[f.status]}>{f.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <FundStatusButtons fund={f} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-steel-light">
        <Wallet size={12} /> Investor positions and per-trade NAV history are recorded in pamm_transactions.
      </div>
    </>
  );
}
