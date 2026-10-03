import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { MetricGrid } from "@/components/MetricGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { Network, Users, TrendingUp, Layers } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { loadDownline, type DownlineMember } from "@/lib/ib-actions";

export default async function TreePage() {
  const user = await getCurrentUser();

  let rows: DownlineMember[] = [];
  if (user) {
    rows = await loadDownline();
  }

  const directs = rows.filter((r) => r.level === 1).length;
  const total = rows.length;
  const deepest = rows.reduce((m, r) => Math.max(m, r.level), 0);
  const totalLots = rows.reduce((s, r) => s + r.lots, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);

  return (
    <Shell title="Multi-Level IB">
      <PageHeader
        title="Multi-Level IB Tree"
        subtitle="Your downline up to 8 levels deep, with rolled-up volume and commission per member."
      />

      {!user ? (
        <div className="mb-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-steel">
          <Link href="/auth/login?redirect=/ib/tree" className="font-medium text-sky hover:underline">
            Sign in
          </Link>{" "}
          to view your downline.
        </div>
      ) : null}

      <MetricGrid
        columns={4}
        metrics={[
          { label: "Direct sub-IBs", value: String(directs), icon: <Network size={14} /> },
          { label: "Total downline", value: String(total), icon: <Layers size={14} /> },
          { label: "Deepest level", value: deepest ? `L${deepest}` : "—", icon: <Users size={14} /> },
          {
            label: "Commission earned",
            value: `$${totalCommission.toFixed(2)}`,
            icon: <TrendingUp size={14} />,
          },
        ]}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Downline tree</CardTitle>
        </CardHeader>
        <CardBody className="px-0">
          {rows.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-steel">
              No sub-IBs in your downline yet. Share your referral link to start building your network.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-steel-light">
                <tr>
                  <th className="py-3 pl-4 pr-4 font-medium">Sub-IB</th>
                  <th className="px-4 py-3 text-center font-medium">Level</th>
                  <th className="px-4 py-3 text-right font-medium">Lots</th>
                  <th className="px-4 py-3 text-right font-medium">Commission</th>
                  <th className="px-4 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const name = r.full_name ?? `User ${r.member_id.slice(0, 8)}`;
                  const init = name
                    .split(" ")
                    .map((n) => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <tr key={r.member_id} className="border-t border-slate-50">
                      <td className="py-3 pr-4" style={{ paddingLeft: 16 + (r.level - 1) * 28 }}>
                        <div className="flex items-center gap-2">
                          {r.level > 1 ? <span className="text-steel-light">└</span> : null}
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky to-navy text-[10px] font-bold text-white">
                            {init}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-navy">{name}</div>
                            <div className="text-[10px] text-steel">UID {r.member_id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded-full bg-sky/10 px-2 py-0.5 text-[10px] font-semibold text-sky">
                          L{r.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-navy">{r.lots.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-success">
                        ${r.commission.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StatusBadge tone={r.member_status === "active" ? "success" : "neutral"}>
                          {r.member_status}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-100 bg-slate-50/50 text-xs font-semibold text-navy">
                  <td className="py-2.5 pl-4">Total ({total} members)</td>
                  <td />
                  <td className="px-4 py-2.5 text-right">{totalLots.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right text-success">${totalCommission.toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </CardBody>
      </Card>
    </Shell>
  );
}
