import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { Card, CardBody } from "@gio4x/ui";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { ExportCsvButton } from "@/components/ExportCsvButton";

type Row = {
  id: string;
  date: string;
  type: string;
  amount: number;
  currency: string;
  method: string;
  reference: string;
  status: string;
};

const toneFor = (s: string): StatusTone =>
  s === "completed" ? "success" : s === "pending" || s === "processing" ? "warning" : "danger";

const cols: Column<Row>[] = [
  { key: "date", header: "Date", render: (r) => <span className="text-steel">{r.date}</span> },
  { key: "type", header: "Type", render: (r) => <span className="font-medium text-navy capitalize">{r.type.replace("_", " ")}</span> },
  { key: "method", header: "Method", render: (r) => <span className="text-steel">{r.method}</span> },
  { key: "ref", header: "Reference", render: (r) => <span className="font-mono text-[11px] text-steel">{r.reference}</span> },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    render: (r) => {
      const out = r.type.startsWith("withdraw") || r.type === "transfer_out" || r.type === "fee";
      return (
        <span className={out ? "text-danger" : "text-success font-medium"}>
          {out ? "-" : "+"}{r.amount.toFixed(2)} {r.currency}
        </span>
      );
    },
  },
  { key: "status", header: "Status", render: (r) => <StatusBadge tone={toneFor(r.status)}>{r.status}</StatusBadge> },
];

export default async function HistoryPage() {
  const user = await getCurrentUser();
  let rows: Row[] = [];

  if (user) {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("wallet_transactions")
      .select("id, type, amount, currency, status, gateway, gateway_ref, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (data ?? []).map((t) => ({
      id: t.id,
      date: new Date(t.created_at).toISOString().slice(0, 16).replace("T", " "),
      type: t.type,
      amount: Number(t.amount),
      currency: t.currency,
      method: t.gateway ?? "—",
      reference: t.gateway_ref ?? t.id.slice(0, 8),
      status: t.status,
    }));
  }

  return (
    <Shell title="Fund History">
      <PageHeader
        title="Fund History"
        subtitle={user ? "Every money-movement event on your wallets." : "Sign in to view your real history."}
        actions={
          <ExportCsvButton
            filename={`gio4x-fund-history-${new Date().toISOString().slice(0, 10)}.csv`}
            headers={["Date", "Type", "Method", "Reference", "Amount", "Currency", "Status"]}
            rows={rows.map((r) => [r.date, r.type, r.method, r.reference, r.amount, r.currency, r.status])}
          />
        }
      />

      <Card>
        <CardBody>
          {rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-steel">
              {user ? "No transactions yet." : "Sign in to view your real history."}
            </div>
          ) : (
            <DataTable columns={cols} rows={rows} />
          )}
        </CardBody>
      </Card>
    </Shell>
  );
}
