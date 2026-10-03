import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { MetricGrid } from "@/components/MetricGrid";
import { DataTable, type Column } from "@/components/DataTable";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { Coins, TrendingUp, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";

type DayRow = {
  date: string;
  clients: number;
  lots: number;
  commission: number;
};

type LedgerRow = {
  id: string;
  created_at: string;
  source_user_id: string;
  amount: number;
  lots: number;
  currency: string;
  settled: boolean;
};

function aggregateByDay(rows: LedgerRow[]): DayRow[] {
  const map = new Map<string, DayRow>();
  for (const r of rows) {
    const d = r.created_at.slice(0, 10);
    const cur = map.get(d) ?? { date: d, clients: 0, lots: 0, commission: 0 };
    cur.lots += Number(r.lots ?? 0);
    cur.commission += Number(r.amount ?? 0);
    map.set(d, cur);
  }
  // clients = distinct source_user_id per day
  const seenPerDay = new Map<string, Set<string>>();
  for (const r of rows) {
    const d = r.created_at.slice(0, 10);
    let s = seenPerDay.get(d);
    if (!s) {
      s = new Set();
      seenPerDay.set(d, s);
    }
    s.add(r.source_user_id);
  }
  for (const [d, set] of seenPerDay) {
    const cur = map.get(d);
    if (cur) cur.clients = set.size;
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

const cols: Column<DayRow>[] = [
  { key: "date", header: "Date", render: (r) => <span className="font-medium text-navy">{r.date}</span> },
  {
    key: "clients",
    header: "Active clients",
    align: "right",
    render: (r) => <span className="text-navy">{r.clients}</span>,
  },
  {
    key: "lots",
    header: "Lots",
    align: "right",
    render: (r) => <span className="text-navy">{r.lots.toFixed(2)}</span>,
  },
  {
    key: "commission",
    header: "Commission",
    align: "right",
    render: (r) => <span className="font-semibold text-success">+${r.commission.toFixed(2)}</span>,
  },
];

export default async function IbReportPage() {
  const user = await getCurrentUser();

  let ledger: LedgerRow[] = [];
  if (user) {
    const supabase = getSupabaseServer();
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("commission_ledger")
      .select("id, created_at, source_user_id, amount, lots, currency, settled")
      .eq("ib_user_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    ledger = (data ?? []) as LedgerRow[];
  }

  const days = aggregateByDay(ledger);
  const totalCommission = ledger.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalLots = ledger.reduce((s, r) => s + Number(r.lots ?? 0), 0);
  const uniqueClients = new Set(ledger.map((r) => r.source_user_id)).size;

  return (
    <Shell title="IB Report">
      <PageHeader title="IB Report" subtitle="Day-by-day breakdown of clients, volume, and commission." />

      {!user ? (
        <div className="mb-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-steel">
          <Link href="/auth/login?redirect=/ib/report" className="font-medium text-sky hover:underline">
            Sign in
          </Link>{" "}
          to see your IB report.
        </div>
      ) : null}

      <MetricGrid
        columns={4}
        metrics={[
          {
            label: "Total commission (90D)",
            value: `$${totalCommission.toFixed(2)}`,
            icon: <Coins size={14} />,
          },
          {
            label: "Total lots",
            value: totalLots.toFixed(2),
            icon: <TrendingUp size={14} />,
          },
          {
            label: "Active clients",
            value: String(uniqueClients),
            icon: <Users size={14} />,
          },
          {
            label: "Avg commission / lot",
            value: totalLots > 0 ? `$${(totalCommission / totalLots).toFixed(2)}` : "—",
          },
        ]}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Daily breakdown</CardTitle>
        </CardHeader>
        <CardBody className="px-0 pt-2">
          {days.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-steel">
              No commission entries in the last 90 days.
            </div>
          ) : (
            <DataTable columns={cols} rows={days.map((d, i) => ({ ...d, id: i }))} />
          )}
        </CardBody>
      </Card>
    </Shell>
  );
}
