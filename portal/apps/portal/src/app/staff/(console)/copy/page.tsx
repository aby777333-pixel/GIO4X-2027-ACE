import { Card, CardBody, CardHeader, CardTitle, StatTile } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { loadAllProviders } from "@/lib/copy-actions";
import { ProviderStatusButtons } from "./copy-tools";
import { Copy, Clock, CheckCircle2, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const statusTone = {
  active: "success",
  pending: "warning",
  paused: "neutral",
  closed: "danger",
} as const;

export default async function StaffCopyPage() {
  const providers = await loadAllProviders();
  const pending = providers.filter((p) => p.status === "pending");
  const active = providers.filter((p) => p.status === "active");

  const tiles = [
    { label: "Total strategies", value: String(providers.length), unit: "", icon: <Copy size={16} /> },
    { label: "Awaiting review", value: String(pending.length), unit: "", icon: <Clock size={16} /> },
    { label: "Live providers", value: String(active.length), unit: "", icon: <CheckCircle2 size={16} /> },
  ];

  return (
    <>
      <PageHeader
        title="Copy Trading"
        subtitle="Review signal-provider applications and manage the live roster. Approving a provider lets their closed trades mirror to followers and charge performance fees through the fee engine."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <StatTile key={t.label} icon={t.icon} label={t.label} value={t.value} unit={t.unit} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signal providers</CardTitle>
        </CardHeader>
        <CardBody className="px-0">
          {providers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-steel">
              No signal-provider applications yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-steel-light">
                <tr>
                  <th className="py-3 pl-5 pr-4 font-medium">Strategy</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 text-center font-medium">Risk</th>
                  <th className="px-4 py-3 text-right font-medium">Perf fee</th>
                  <th className="px-4 py-3 text-right font-medium">Min</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id} className="border-t border-slate-50 align-top">
                    <td className="py-3 pl-5 pr-4">
                      <div className="font-medium text-navy">{p.display_name}</div>
                      {p.headline ? (
                        <div className="mt-0.5 line-clamp-2 max-w-xs text-[11px] text-steel">
                          {p.headline}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-navy">{p.full_name ?? "—"}</div>
                      <div className="text-[10px] text-steel">{p.email ?? p.user_id.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3 text-center capitalize text-navy">{p.risk}</td>
                    <td className="px-4 py-3 text-right text-navy">
                      {(p.performance_fee_bps / 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-right text-navy">
                      {p.min_allocation.toFixed(0)} {p.currency}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge tone={statusTone[p.status]}>{p.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ProviderStatusButtons provider={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-steel-light">
        <Users size={12} /> Follower allocations and per-trade mirroring are visible on each client&apos;s profile.
      </div>
    </>
  );
}
