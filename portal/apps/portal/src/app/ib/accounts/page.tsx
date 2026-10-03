import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { AccountChip } from "@/components/AccountChip";
import { Download } from "lucide-react";
import { SampleDataBanner } from "@/components/SampleDataBanner";

type AcctRow = { id: number; account: string; type: string; client: string; balance: number; volume30d: number; commission30d: number; status: "active" | "dormant" };

const rows: AcctRow[] = [
  { id: 1, account: "24819714", type: "Premium", client: "LOGUPRABHU T", balance: 20920.62, volume30d: 480000, commission30d: 4.8, status: "active" },
  { id: 2, account: "24819546", type: "Classic", client: "Arul B", balance: 20977.94, volume30d: 320000, commission30d: 3.2, status: "active" },
  { id: 3, account: "24819533", type: "Cent", client: "Arul B", balance: 0, volume30d: 0, commission30d: 0, status: "dormant" },
  { id: 4, account: "24813368", type: "ECN", client: "Arul B", balance: 31741.35, volume30d: 920000, commission30d: 9.2, status: "active" },
  { id: 5, account: "22486049", type: "Classic", client: "BHUVANESWARI L", balance: 5104.21, volume30d: 240000, commission30d: 2.4, status: "active" },
];

const cols: Column<AcctRow>[] = [
  { key: "account", header: "Account", render: (r) => <span className="font-medium text-navy">{r.account}</span> },
  { key: "platform", header: "Platform", render: (r) => <AccountChip type={r.type} /> },
  { key: "client", header: "Client", render: (r) => <span className="text-steel">{r.client}</span> },
  { key: "balance", header: "Balance", align: "right", render: (r) => <span className="text-navy">${r.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> },
  { key: "volume", header: "Volume 30D", align: "right", render: (r) => <span className="text-steel">${r.volume30d.toLocaleString()}</span> },
  { key: "commission", header: "Comm 30D", align: "right", render: (r) => <span className="font-semibold text-success">${r.commission30d.toFixed(2)}</span> },
  { key: "status", header: "Status", render: (r) => <StatusBadge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</StatusBadge> },
];

export default function IbAccountsPage() {
  return (
    <Shell title="Account Report">
      <PageHeader
        title="Account Report"
        subtitle="Every trading account opened under your IB code — performance and commission per account."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-navy hover:border-sky/40">
            <Download size={14} /> Export
          </button>
        }
      />

      <SampleDataBanner />

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} accounts</CardTitle>
          <div className="flex gap-2 text-xs">
            <input type="search" placeholder="Search account or client" className="rounded-md border border-slate-200 px-2 py-1 w-64" />
            <select className="rounded-md border border-slate-200 px-2 py-1">
              <option>All account types</option>
              <option>Classic</option>
              <option>Premium</option>
              <option>ECN</option>
              <option>Cent</option>
              <option>Swap-Free STP</option>
            </select>
            <select className="rounded-md border border-slate-200 px-2 py-1">
              <option>All status</option>
              <option>Active</option>
              <option>Dormant</option>
            </select>
          </div>
        </CardHeader>
        <CardBody className="px-0 pt-2">
          <DataTable columns={cols} rows={rows} />
        </CardBody>
      </Card>
    </Shell>
  );
}
