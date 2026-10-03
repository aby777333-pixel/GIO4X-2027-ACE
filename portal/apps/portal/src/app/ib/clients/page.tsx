import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@gio4x/ui";
import { Phone, Mail } from "lucide-react";
import { SampleDataBanner } from "@/components/SampleDataBanner";

type Client = { id: number; name: string; country: string; flag: string; signedUp: string; accounts: number; deposited: number; lastTrade: string; ftd: boolean; kyc: "verified" | "pending" | "rejected" };

const rows: Client[] = [
  { id: 1, name: "LOGUPRABHU T", country: "IN", flag: "🇮🇳", signedUp: "2026-02-14", accounts: 1, deposited: 21000, lastTrade: "2 hours ago", ftd: true, kyc: "verified" },
  { id: 2, name: "Arul B", country: "IN", flag: "🇮🇳", signedUp: "2025-09-22", accounts: 3, deposited: 53000, lastTrade: "30 min ago", ftd: true, kyc: "verified" },
  { id: 3, name: "BHUVANESWARI L", country: "IN", flag: "🇮🇳", signedUp: "2026-01-30", accounts: 1, deposited: 5200, lastTrade: "Yesterday", ftd: true, kyc: "verified" },
  { id: 4, name: "GANESAN P", country: "IN", flag: "🇮🇳", signedUp: "2026-05-22", accounts: 1, deposited: 800, lastTrade: "3 days ago", ftd: true, kyc: "pending" },
  { id: 5, name: "MD AFSAR", country: "BD", flag: "🇧🇩", signedUp: "2026-05-27", accounts: 1, deposited: 0, lastTrade: "Never", ftd: false, kyc: "pending" },
  { id: 6, name: "SIVANESAN P", country: "IN", flag: "🇮🇳", signedUp: "2026-05-26", accounts: 1, deposited: 1500, lastTrade: "1 hour ago", ftd: true, kyc: "verified" },
];

const cols: Column<Client>[] = [
  {
    key: "name",
    header: "Client",
    render: (r) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky to-navy text-[10px] font-bold text-white">
          {r.name.split(" ").map((n) => n[0]).join("")}
        </div>
        <div>
          <div className="text-sm font-medium text-navy">{r.name}</div>
          <div className="text-[10px] text-steel">{r.flag} {r.country}</div>
        </div>
      </div>
    ),
  },
  { key: "signedUp", header: "Joined", render: (r) => <span className="text-steel">{r.signedUp}</span> },
  { key: "accounts", header: "Accounts", align: "right", render: (r) => <span className="text-navy">{r.accounts}</span> },
  { key: "deposited", header: "Total deposited", align: "right", render: (r) => <span className="text-navy">${r.deposited.toLocaleString()}</span> },
  { key: "lastTrade", header: "Last trade", render: (r) => <span className="text-steel">{r.lastTrade}</span> },
  { key: "ftd", header: "FTD", render: (r) => <StatusBadge tone={r.ftd ? "success" : "neutral"}>{r.ftd ? "Yes" : "No"}</StatusBadge> },
  { key: "kyc", header: "KYC", render: (r) => <StatusBadge tone={r.kyc === "verified" ? "success" : r.kyc === "pending" ? "warning" : "danger"}>{r.kyc}</StatusBadge> },
  {
    key: "contact",
    header: "",
    render: () => (
      <div className="flex gap-1">
        <button className="rounded-md border border-slate-200 p-1.5 text-steel hover:border-sky/40 hover:text-sky"><Mail size={11} /></button>
        <button className="rounded-md border border-slate-200 p-1.5 text-steel hover:border-sky/40 hover:text-sky"><Phone size={11} /></button>
      </div>
    ),
  },
];

export default function IbClientsPage() {
  return (
    <Shell title="Client Report">
      <PageHeader
        title="Client Report"
        subtitle="All clients under your IB code."
        actions={
          <Link href="/ib/referrals">
            <Button variant="primary">
              Invite new client
            </Button>
          </Link>
        }
      />

      <SampleDataBanner />

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} clients</CardTitle>
          <div className="flex gap-2 text-xs">
            <input type="search" placeholder="Search by name or UID" className="w-64 rounded-md border border-slate-200 px-2 py-1" />
            <select className="rounded-md border border-slate-200 px-2 py-1">
              <option>All countries</option>
              <option>India</option>
              <option>UAE</option>
              <option>Bangladesh</option>
            </select>
            <select className="rounded-md border border-slate-200 px-2 py-1">
              <option>All KYC</option>
              <option>Verified</option>
              <option>Pending</option>
              <option>Rejected</option>
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
