import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { MetricGrid } from "@/components/MetricGrid";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { LINKS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { ChartLine, TrendingUp, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

type Position = {
  id: string;
  ticket: string;
  account: string;
  symbol: string;
  side: "BUY" | "SELL";
  lots: number;
  open: number | null;
  pnl: number;
  swap: number;
  openedAt: string;
};

const cols: Column<Position>[] = [
  { key: "ticket", header: "Ticket", render: (r) => <span className="font-mono text-[11px] text-steel">{r.ticket}</span> },
  { key: "account", header: "Account", render: (r) => <span className="text-steel">{r.account}</span> },
  { key: "symbol", header: "Symbol", render: (r) => <span className="font-medium text-navy">{r.symbol}</span> },
  { key: "side", header: "Side", render: (r) => <StatusBadge tone={r.side === "BUY" ? "success" : "danger"}>{r.side}</StatusBadge> },
  { key: "lots", header: "Lots", align: "right", render: (r) => <span className="text-navy">{r.lots.toFixed(2)}</span> },
  { key: "open", header: "Open", align: "right", render: (r) => <span className="text-steel">{r.open ?? "—"}</span> },
  { key: "swap", header: "Swap", align: "right", render: (r) => <span className="text-steel">{r.swap.toFixed(2)}</span> },
  {
    key: "pnl",
    header: "P&L",
    align: "right",
    render: (r) => (
      <span className={r.pnl >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
        {r.pnl >= 0 ? "+" : ""}${r.pnl.toFixed(2)}
      </span>
    ),
  },
  {
    key: "actions",
    header: "",
    render: () => (
      <div className="flex gap-1">
        <Link href={LINKS.raptor.terminal} target="_blank" rel="noreferrer" className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-steel hover:border-sky/40 hover:text-navy">Modify</Link>
        <Link href={LINKS.raptor.terminal} target="_blank" rel="noreferrer" className="rounded-md border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50">Close</Link>
      </div>
    ),
  },
];

export default async function PositionsPage() {
  const user = await getCurrentUser();
  let positions: Position[] = [];

  if (user) {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("trades")
      .select("id, ticket, symbol, side, lots, open_price, pnl, swap, opened_at, trading_accounts(account_number)")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(200);

    positions = (data ?? []).map((t) => {
      const acct = t.trading_accounts as unknown as { account_number: string } | null;
      return {
        id: t.id,
        ticket: t.ticket ? String(t.ticket) : t.id.slice(0, 8),
        account: acct?.account_number ?? "—",
        symbol: t.symbol,
        side: t.side === "sell" ? "SELL" : "BUY",
        lots: Number(t.lots),
        open: t.open_price !== null ? Number(t.open_price) : null,
        pnl: Number(t.pnl),
        swap: Number(t.swap),
        openedAt: t.opened_at ? new Date(t.opened_at).toISOString().slice(0, 16).replace("T", " ") : "",
      };
    });
  }

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalLots = positions.reduce((s, p) => s + p.lots, 0);

  return (
    <Shell title="Open Positions">
      <PageHeader
        title="Open Positions"
        subtitle="Live positions across all your trading accounts. Execution happens in the GIORAPTOR terminal."
        actions={
          <Link
            href={LINKS.raptor.terminal}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-light"
          >
            <ChartLine size={14} /> Open terminal
          </Link>
        }
      />

      {!user ? (
        <Card>
          <CardBody className="px-6 py-10 text-center text-sm text-steel">
            <Link href="/auth/login?redirect=/positions" className="font-medium text-sky hover:underline">
              Sign in
            </Link>{" "}
            to see your open positions.
          </CardBody>
        </Card>
      ) : (
        <>
          <MetricGrid
            columns={3}
            metrics={[
              { label: "Open positions", value: String(positions.length), icon: <ChartLine size={14} /> },
              { label: "Total lots", value: totalLots.toFixed(2), icon: <Activity size={14} /> },
              { label: "Realised so far", value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`, deltaDirection: totalPnl >= 0 ? "up" : "down", icon: <TrendingUp size={14} /> },
            ]}
          />

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>All open positions</CardTitle>
              <Link href={LINKS.raptor.terminal} target="_blank" rel="noreferrer" className="text-xs font-medium text-sky hover:underline">
                Manage in terminal →
              </Link>
            </CardHeader>
            <CardBody className="px-0 pt-2">
              {positions.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-steel">
                  No open positions. Open the{" "}
                  <Link href={LINKS.raptor.terminal} target="_blank" rel="noreferrer" className="font-medium text-sky hover:underline">
                    GIORAPTOR terminal
                  </Link>{" "}
                  to place a trade.
                </div>
              ) : (
                <DataTable columns={cols} rows={positions} />
              )}
            </CardBody>
          </Card>
        </>
      )}
    </Shell>
  );
}
