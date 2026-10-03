"use client";

import { useMemo, useState } from "react";
import { ChipFilter } from "@/components/ChipFilter";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricGrid } from "@/components/MetricGrid";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { Card, CardBody } from "@gio4x/ui";
import { History as HistoryIcon, TrendingUp, TrendingDown, Activity } from "lucide-react";

export type Trade = {
  id: string;
  ticket: string;
  account: string;
  symbol: string;
  side: "BUY" | "SELL";
  lots: number;
  open: number | null;
  close: number | null;
  pnl: number;
  openedAt: string;
  closedAt: string;
};

const cols: Column<Trade>[] = [
  { key: "closed", header: "Closed", render: (r) => <span className="text-steel">{r.closedAt}</span> },
  { key: "ticket", header: "Ticket", render: (r) => <span className="font-mono text-[11px] text-steel">{r.ticket}</span> },
  { key: "account", header: "Account", render: (r) => <span className="text-steel">{r.account}</span> },
  { key: "symbol", header: "Symbol", render: (r) => <span className="font-medium text-navy">{r.symbol}</span> },
  { key: "side", header: "Side", render: (r) => <StatusBadge tone={r.side === "BUY" ? "success" : "danger"}>{r.side}</StatusBadge> },
  { key: "lots", header: "Lots", align: "right", render: (r) => <span className="text-navy">{r.lots.toFixed(2)}</span> },
  { key: "open", header: "Open", align: "right", render: (r) => <span className="text-steel">{r.open ?? "—"}</span> },
  { key: "close", header: "Close", align: "right", render: (r) => <span className="text-navy">{r.close ?? "—"}</span> },
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
];

const range = ["7D", "30D", "90D", "1Y", "All"] as const;
const rangeDays: Record<(typeof range)[number], number | null> = { "7D": 7, "30D": 30, "90D": 90, "1Y": 365, All: null };

export function TradeHistoryClient({ trades }: { trades: Trade[] }) {
  const [r, setR] = useState<(typeof range)[number]>("30D");
  const [account, setAccount] = useState("all");
  const [symbol, setSymbol] = useState("all");

  const accounts = useMemo(() => Array.from(new Set(trades.map((t) => t.account))).sort(), [trades]);
  const symbols = useMemo(() => Array.from(new Set(trades.map((t) => t.symbol))).sort(), [trades]);

  const filtered = useMemo(() => {
    const days = rangeDays[r];
    const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
    return trades.filter((t) => {
      if (account !== "all" && t.account !== account) return false;
      if (symbol !== "all" && t.symbol !== symbol) return false;
      if (cutoff && new Date(t.closedAt).getTime() < cutoff) return false;
      return true;
    });
  }, [trades, r, account, symbol]);

  const wins = filtered.filter((t) => t.pnl > 0);
  const totalPnl = filtered.reduce((s, t) => s + t.pnl, 0);
  const winRate = filtered.length ? (wins.length / filtered.length) * 100 : 0;

  const csvRows = filtered.map((t) => [t.closedAt, t.ticket, t.account, t.symbol, t.side, t.lots, t.open ?? "", t.close ?? "", t.pnl]);

  return (
    <>
      <div className="mb-6 flex justify-end">
        <ExportCsvButton
          filename={`gio4x-trade-history-${new Date().toISOString().slice(0, 10)}.csv`}
          headers={["Closed", "Ticket", "Account", "Symbol", "Side", "Lots", "Open", "Close", "PnL"]}
          rows={csvRows}
        />
      </div>

      <MetricGrid
        columns={4}
        metrics={[
          { label: "Closed trades", value: String(filtered.length), icon: <HistoryIcon size={14} /> },
          { label: "Win rate", value: `${winRate.toFixed(0)}%`, icon: <Activity size={14} /> },
          { label: "Realised P&L", value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`, icon: totalPnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />, deltaDirection: totalPnl >= 0 ? "up" : "down" },
          { label: "Avg trade", value: `$${(filtered.length ? totalPnl / filtered.length : 0).toFixed(2)}` },
        ]}
      />

      <Card className="mt-6">
        <CardBody>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <ChipFilter options={range} value={r} onChange={setR} />
            <div className="flex gap-2 text-xs">
              <select value={account} onChange={(e) => setAccount(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1">
                <option value="all">All accounts</option>
                {accounts.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1">
                <option value="all">All symbols</option>
                {symbols.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-steel">No closed trades in this range.</div>
          ) : (
            <DataTable columns={cols} rows={filtered} />
          )}
        </CardBody>
      </Card>
    </>
  );
}
