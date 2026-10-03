import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, Button } from "@gio4x/ui";
import { Plus } from "lucide-react";
import { SampleDataBanner } from "@/components/SampleDataBanner";

type SubIb = { id: number; name: string; uid: string; joined: string; clients: number; volume30d: number; commission30d: number; share: number; status: "active" | "pending" | "suspended" };

const rows: SubIb[] = [
  { id: 1, name: "Raja K.", uid: "1814022", joined: "2025-08-04", clients: 12, volume30d: 980000, commission30d: 9.8, share: 15, status: "active" },
  { id: 2, name: "Lakshmi M.", uid: "1817744", joined: "2025-11-22", clients: 8, volume30d: 612000, commission30d: 6.12, share: 15, status: "active" },
  { id: 3, name: "Vikram T.", uid: "1820055", joined: "2026-02-14", clients: 4, volume30d: 220000, commission30d: 2.2, share: 10, status: "active" },
  { id: 4, name: "Meera P.", uid: "1821100", joined: "2026-05-12", clients: 0, volume30d: 0, commission30d: 0, share: 10, status: "pending" },
];

const cols: Column<SubIb>[] = [
  {
    key: "name",
    header: "Sub-IB",
    render: (r) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky to-navy text-[11px] font-bold text-white">
          {r.name.split(" ").map((n) => n[0]).join("")}
        </div>
        <div>
          <div className="text-sm font-medium text-navy">{r.name}</div>
          <div className="text-[10px] text-steel">UID {r.uid} · joined {r.joined}</div>
        </div>
      </div>
    ),
  },
  { key: "clients", header: "Clients", align: "right", render: (r) => <span className="text-navy">{r.clients}</span> },
  { key: "volume", header: "Volume 30D", align: "right", render: (r) => <span className="text-steel">${r.volume30d.toLocaleString()}</span> },
  { key: "comm", header: "Comm 30D", align: "right", render: (r) => <span className="font-semibold text-success">${r.commission30d.toFixed(2)}</span> },
  { key: "share", header: "Your share", align: "right", render: (r) => <span className="text-navy">{r.share}%</span> },
  { key: "status", header: "Status", render: (r) => <StatusBadge tone={r.status === "active" ? "success" : r.status === "pending" ? "warning" : "danger"}>{r.status}</StatusBadge> },
];

export default function SubIbPage() {
  return (
    <Shell title="Sub-IB Management">
      <PageHeader
        title="Sub-IB Management"
        subtitle="Your direct sub-IBs (L1). Configure revenue share and monitor performance."
        actions={
          <Link href="/ib/referrals">
            <Button variant="primary">
              <Plus size={14} className="mr-1" /> Invite a Sub-IB
            </Button>
          </Link>
        }
      />

      <SampleDataBanner />

      <Card>
        <CardBody className="px-0 pt-2">
          <DataTable columns={cols} rows={rows} />
        </CardBody>
      </Card>

      <Card className="mt-6 border-sky/20 bg-sky/5">
        <CardBody className="text-xs text-navy">
          <strong>Default share for new Sub-IBs:</strong> 10%. You can override per Sub-IB after invitation.
          Share is applied to the commission their downline generates — paid into your IB Funds at the same
          monthly cycle.
        </CardBody>
      </Card>
    </Shell>
  );
}
