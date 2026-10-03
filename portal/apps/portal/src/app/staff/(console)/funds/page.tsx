import { Card, CardBody, CardHeader, CardTitle, StatTile } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  loadPendingSettlements,
  loadTradingAccountOptions,
  loadRecentTrades,
} from "@/lib/funds-actions";
import { formatMoney } from "@/lib/fee-constants";
import { SettleButtons, RecordTradeButton } from "./funds-tools";
import { ArrowDownToLine, ArrowUpFromLine, Wallet, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StaffFundsPage() {
  const [pending, accounts, trades] = await Promise.all([
    loadPendingSettlements(80),
    loadTradingAccountOptions(),
    loadRecentTrades(30),
  ]);

  const deposits = pending.filter((p) => p.type === "deposit");
  const withdrawals = pending.filter((p) => p.type === "withdraw");
  const pendingDepositTotal = deposits.reduce((s, d) => s + d.amount, 0);
  const pendingWithdrawTotal = withdrawals.reduce((s, w) => s + w.amount, 0);

  const tiles = [
    {
      label: "Pending deposits",
      value: String(deposits.length),
      unit: formatMoney(pendingDepositTotal),
      icon: <ArrowDownToLine size={16} />,
    },
    {
      label: "Pending withdrawals",
      value: String(withdrawals.length),
      unit: formatMoney(pendingWithdrawTotal),
      icon: <ArrowUpFromLine size={16} />,
    },
    { label: "Recent trades", value: String(trades.length), unit: "", icon: <Activity size={16} /> },
  ];

  return (
    <>
      <PageHeader
        title="Funds & Settlement"
        subtitle="Approve deposits & withdrawals — the Fee Engine charges the matching fee automatically on settlement. Book trades to fire per-lot commission and IB rebates."
        actions={<RecordTradeButton accounts={accounts} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <StatTile key={t.label} icon={t.icon} label={t.label} value={t.value} unit={t.unit} />
        ))}
      </div>

      {/* Pending settlement queue */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Settlement queue</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-steel">
              Nothing awaiting settlement. New deposits & withdrawals will appear here.
            </p>
          ) : (
            pending.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={
                      p.type === "deposit"
                        ? "flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
                        : "flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600"
                    }
                  >
                    {p.type === "deposit" ? (
                      <ArrowDownToLine size={15} />
                    ) : (
                      <ArrowUpFromLine size={15} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-navy">
                        {formatMoney(p.amount, p.currency)}
                      </span>
                      <span className="capitalize text-steel">{p.type}</span>
                      {p.gateway ? (
                        <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-steel">
                          {p.gateway}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-steel-light">
                      {p.user?.full_name || p.user?.email || "—"} ·{" "}
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <SettleButtons txId={p.id} />
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* Recent trades */}
      <Card>
        <CardHeader>
          <CardTitle>Recent trades</CardTitle>
        </CardHeader>
        <CardBody className="space-y-1.5">
          {trades.length === 0 ? (
            <p className="py-6 text-center text-sm text-steel">
              No trades booked yet. Use “Book trade” to record a closed trade.
            </p>
          ) : (
            trades.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <Wallet size={14} className="text-steel-light" />
                  <span className="font-medium text-navy">{t.symbol}</span>
                  <StatusBadge tone={t.side === "buy" ? "success" : "danger"}>
                    {t.side}
                  </StatusBadge>
                  <span className="text-steel">{Number(t.lots).toFixed(2)} lots</span>
                  <span className="text-[11px] text-steel-light">
                    #{t.account_number ?? "—"} · {t.full_name ?? "—"}
                  </span>
                </div>
                <span
                  className={
                    Number(t.pnl) >= 0 ? "text-sm font-semibold text-emerald-600" : "text-sm font-semibold text-rose-600"
                  }
                >
                  {formatMoney(Number(t.pnl), t.currency)}
                </span>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </>
  );
}
