import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { Download, FileText } from "lucide-react";

type Statement = {
  id: number;
  period: string;
  account: string;
  deposits: number;
  withdrawals: number;
  netPnl: number;
  endingBalance: number;
  format: "PDF" | "CSV" | "Excel";
  status: "ready" | "generating";
};

const statements: Statement[] = [
  { id: 1, period: "May 2026", account: "12044510", deposits: 700, withdrawals: 75, netPnl: 42.8, endingBalance: 1480.5, format: "PDF", status: "ready" },
  { id: 2, period: "April 2026", account: "12044510", deposits: 500, withdrawals: 200, netPnl: 18.4, endingBalance: 812.7, format: "PDF", status: "ready" },
  { id: 3, period: "March 2026", account: "12044510", deposits: 1000, withdrawals: 0, netPnl: -32.6, endingBalance: 494.3, format: "PDF", status: "ready" },
  { id: 4, period: "Q1 2026", account: "All accounts", deposits: 2200, withdrawals: 350, netPnl: -8.4, endingBalance: 0, format: "PDF", status: "ready" },
  { id: 5, period: "FY 2025-26", account: "All accounts", deposits: 12400, withdrawals: 2800, netPnl: 612.4, endingBalance: 0, format: "PDF", status: "generating" },
];

const cols: Column<Statement>[] = [
  { key: "period", header: "Period", render: (r) => <span className="font-medium text-navy">{r.period}</span> },
  { key: "account", header: "Account", render: (r) => <span className="text-steel">{r.account}</span> },
  { key: "deposits", header: "Deposits", align: "right", render: (r) => <span className="text-success">+${r.deposits.toFixed(2)}</span> },
  { key: "withdrawals", header: "Withdrawals", align: "right", render: (r) => <span className="text-danger">-${r.withdrawals.toFixed(2)}</span> },
  {
    key: "pnl",
    header: "Net P&L",
    align: "right",
    render: (r) => (
      <span className={r.netPnl >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
        {r.netPnl >= 0 ? "+" : ""}${r.netPnl.toFixed(2)}
      </span>
    ),
  },
  { key: "balance", header: "Ending balance", align: "right", render: (r) => <span className="font-medium text-navy">${r.endingBalance.toFixed(2)}</span> },
  { key: "status", header: "Status", render: (r) => <StatusBadge tone={r.status === "ready" ? "success" : "info"}>{r.status}</StatusBadge> },
  {
    key: "action",
    header: "",
    align: "right",
    render: (r) =>
      r.status === "ready" ? (
        <Link href="/funds/history" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-navy hover:border-sky/40">
          <Download size={11} /> Open
        </Link>
      ) : (
        <span className="text-[11px] text-steel">~5 min</span>
      ),
  },
];

export default function StatementsPage() {
  return (
    <Shell title="Statements">
      <PageHeader
        title="Account Statements"
        subtitle="Monthly, quarterly, and annual reports for accounting and tax."
        actions={
          <Link href="/funds/history" className="inline-flex items-center gap-1.5 rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white hover:bg-sky-light">
            <FileText size={14} /> Full transaction history
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Available statements</CardTitle>
        </CardHeader>
        <CardBody className="px-0 pt-2">
          <DataTable columns={cols} rows={statements} />
        </CardBody>
      </Card>

      <Card className="mt-6 border-sky/20 bg-sky/5">
        <CardBody className="text-xs text-navy">
          <strong>Annual tax statement (FY 2025-26)</strong> will be available from 1 April 2026, with
          a CSV format suitable for India ITR-2 (Capital Gains).
        </CardBody>
      </Card>
    </Shell>
  );
}
