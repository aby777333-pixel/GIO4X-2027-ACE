"use client";

import { useMemo, useState } from "react";
import { Card, CardBody } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { ChipFilter } from "@/components/ChipFilter";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricGrid } from "@/components/MetricGrid";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { CandlestickChart, LayersIcon, DoorOpen, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import type { StaffTrade } from "@/lib/staff-trades-actions";

const statusFilters = ["All", "open", "closed", "cancelled"] as const;
type StatusFilter = (typeof statusFilters)[number];

const statusTone = {
  open: "warning",
  closed: "neutral",
  cancelled: "danger",
} as const;

const num = (n: number, dp = 2) => n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const price = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 5 }));

const cols: Column<StaffTrade>[] = [
  { key: "opened", header: "Opened (UTC)", render: (r) => <span className="whitespace-nowrap font-mono text-[11px] text-steel">{r.openedAt}</span> },
  { key: "closed", header: "Closed (UTC)", render: (r) => <span className="whitespace-nowrap font-mono text-[11px] text-steel">{r.closedAt ?? "—"}</span> },
  { key: "ticket", header: "Ticket", render: (r) => <span className="font-mono text-[11px] text-navy">{r.ticket}</span> },
  {
    key: "trader",
    header: "Trader",
    render: (r) => (
      <div className="min-w-[8rem] leading-tight">
        <div className="font-medium text-navy">{r.trader}</div>
        {r.traderEmail ? <div className="text-[10px] text-steel">{r.traderEmail}</div> : null}
      </div>
    ),
  },
  {
    key: "account",
    header: "Account",
    render: (r) => (
      <div className="leading-tight">
        <div className="font-mono text-[11px] text-navy">{r.account}</div>
        {r.server ? <div className="text-[10px] text-steel">{r.server}</div> : null}
      </div>
    ),
  },
  { key: "symbol", header: "Symbol", render: (r) => <span className="font-medium text-navy">{r.symbol}</span> },
  { key: "side", header: "Side", render: (r) => <StatusBadge tone={r.side === "BUY" ? "success" : "danger"}>{r.side}</StatusBadge> },
  { key: "lots", header: "Lots", align: "right", render: (r) => <span className="text-navy">{num(r.lots)}</span> },
  { key: "open", header: "Open", align: "right", render: (r) => <span className="font-mono text-steel">{price(r.open)}</span> },
  { key: "close", header: "Close", align: "right", render: (r) => <span className="font-mono text-navy">{price(r.close)}</span> },
  { key: "commission", header: "Comm.", align: "right", render: (r) => <span className="text-steel">{num(r.commission)}</span> },
  { key: "swap", header: "Swap", align: "right", render: (r) => <span className="text-steel">{num(r.swap)}</span> },
  {
    key: "pnl",
    header: "P&L",
    align: "right",
    render: (r) => (
      <span className={r.pnl >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
        {r.pnl >= 0 ? "+" : ""}
        {num(r.pnl)}
      </span>
    ),
  },
  { key: "status", header: "Status", align: "center", render: (r) => <StatusBadge tone={statusTone[r.status]}>{r.status}</StatusBadge> },
  { key: "source", header: "Source", render: (r) => <span className="text-[11px] capitalize text-steel">{r.source}</span> },
];

export function StaffTradeLog({ trades }: { trades: StaffTrade[] }) {
  const [status, setStatus] = useState<StatusFilter>("All");
  const [symbol, setSymbol] = useState("all");
  const [account, setAccount] = useState("all");
  const [search, setSearch] = useState("");

  const symbols = useMemo(() => Array.from(new Set(trades.map((t) => t.symbol))).sort(), [trades]);
  const accounts = useMemo(() => Array.from(new Set(trades.map((t) => t.account))).sort(), [trades]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trades.filter((t) => {
      if (status !== "All" && t.status !== status) return false;
      if (symbol !== "all" && t.symbol !== symbol) return false;
      if (account !== "all" && t.account !== account) return false;
      if (q && !`${t.ticket} ${t.trader} ${t.traderEmail ?? ""} ${t.symbol} ${t.account}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [trades, status, symbol, account, search]);

  const volume = filtered.reduce((s, t) => s + t.lots, 0);
  const netPnl = filtered.reduce((s, t) => s + t.pnl, 0);
  const openCount = filtered.filter((t) => t.status === "open").length;
  const closedCount = filtered.filter((t) => t.status === "closed").length;

  const csvRows = filtered.map((t) => [
    t.openedAt,
    t.closedAt ?? "",
    t.ticket,
    t.trader,
    t.traderEmail ?? "",
    t.account,
    t.server ?? "",
    t.symbol,
    t.side,
    t.lots,
    t.open ?? "",
    t.close ?? "",
    t.commission,
    t.swap,
    t.pnl,
    t.currency,
    t.status,
    t.source,
  ]);

  return (
    <>
      <PageHeader
        title="Trade Log"
        subtitle="Immutable, MT5-style record of every trade across all GIO4X accounts — ticket, price, execution time, commission, swap and P&L. Your evidence of record for any execution dispute."
      />

      <MetricGrid
        columns={5}
        metrics={[
          { label: "Trades", value: String(filtered.length), icon: <CandlestickChart size={14} /> },
          { label: "Open", value: String(openCount), icon: <DoorOpen size={14} /> },
          { label: "Closed", value: String(closedCount), icon: <CheckCircle2 size={14} /> },
          { label: "Volume", value: `${num(volume)} lots`, icon: <LayersIcon size={14} /> },
          {
            label: "Net P&L",
            value: `${netPnl >= 0 ? "+" : ""}${num(netPnl)}`,
            icon: netPnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />,
            deltaDirection: netPnl >= 0 ? "up" : "down",
          },
        ]}
      />

      <Card className="mt-6">
        <CardBody>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <ChipFilter options={statusFilters} value={status} onChange={setStatus} />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket / trader / symbol"
                className="w-56 rounded-md border border-slate-200 px-2 py-1 focus:border-sky focus:outline-none"
              />
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1">
                <option value="all">All symbols</option>
                {symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select value={account} onChange={(e) => setAccount(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1">
                <option value="all">All accounts</option>
                {accounts.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <ExportCsvButton
                filename={`gio4x-trade-log-${new Date().toISOString().slice(0, 10)}.csv`}
                headers={[
                  "Opened (UTC)",
                  "Closed (UTC)",
                  "Ticket",
                  "Trader",
                  "Email",
                  "Account",
                  "Server",
                  "Symbol",
                  "Side",
                  "Lots",
                  "Open",
                  "Close",
                  "Commission",
                  "Swap",
                  "PnL",
                  "Currency",
                  "Status",
                  "Source",
                ]}
                rows={csvRows}
              />
            </div>
          </div>

          <DataTable
            columns={cols}
            rows={filtered}
            empty={
              <div className="px-6 py-10 text-center text-sm text-steel">
                {trades.length === 0
                  ? "No trades recorded yet. Executed trades will appear here automatically."
                  : "No trades match these filters."}
              </div>
            }
          />
        </CardBody>
      </Card>
    </>
  );
}
