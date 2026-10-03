import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { MetricGrid } from "@/components/MetricGrid";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  Wallet,
  TrendingUp,
  Coins,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";

type TxRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
};

const toneFor = (s: string): StatusTone =>
  s === "completed" ? "success" : s === "pending" || s === "processing" ? "warning" : "danger";

const cols: Column<TxRow>[] = [
  { key: "date", header: "Date", render: (r) => <span className="text-steel">{r.date}</span> },
  { key: "type", header: "Type", render: (r) => <span className="font-medium text-navy capitalize">{r.type.replace("_", " ")}</span> },
  { key: "method", header: "Method", render: (r) => <span className="text-steel">{r.method}</span> },
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

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default async function WalletPage() {
  const user = await getCurrentUser();
  let walletBalance = 1232.4;
  let walletCurrency = "USD";
  let recent: TxRow[] = [];
  let deposited30d = 0;
  let withdrawn30d = 0;
  let rebated30d = 0;

  if (user) {
    const supabase = getSupabaseServer();
    const { data: mainWallet } = await supabase
      .from("wallets")
      .select("id, balance, currency")
      .eq("user_id", user.id)
      .eq("type", "main")
      .maybeSingle();
    if (mainWallet) {
      walletBalance = Number(mainWallet.balance);
      walletCurrency = mainWallet.currency;
    }

    const { data: txs } = await supabase
      .from("wallet_transactions")
      .select("id, type, amount, currency, status, gateway, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    recent = (txs ?? []).map((t) => ({
      id: t.id,
      date: new Date(t.created_at).toISOString().slice(0, 16).replace("T", " "),
      type: t.type,
      amount: Number(t.amount),
      currency: t.currency,
      method: t.gateway ?? "—",
      status: t.status,
    }));

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: agg } = await supabase
      .from("wallet_transactions")
      .select("type, amount, status")
      .gte("created_at", since)
      .eq("status", "completed");
    for (const t of agg ?? []) {
      const amt = Number(t.amount);
      if (t.type === "deposit") deposited30d += amt;
      else if (t.type === "withdraw") withdrawn30d += amt;
      else if (t.type === "rebate" || t.type === "commission") rebated30d += amt;
    }
  }

  return (
    <Shell title="Wallet">
      <PageHeader
        title="Wallet"
        subtitle={user ? "Unified balance and transaction history across all your accounts." : "Sign in to see your real wallet."}
        actions={
          <>
            <Link
              href="/deposits"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-light"
            >
              <ArrowDownToLine size={14} /> Deposit
            </Link>
            <Link
              href="/withdrawals"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-navy hover:border-sky/40"
            >
              <ArrowUpFromLine size={14} /> Withdraw
            </Link>
            <Link
              href="/transfers"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-navy hover:border-sky/40"
            >
              <ArrowLeftRight size={14} /> Transfer
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="overflow-hidden">
          <div className="relative bg-gradient-to-br from-white via-sky/5 to-sky/15 px-8 py-7">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky/20 blur-3xl" />
            <div className="relative">
              <div className="text-xs uppercase tracking-wider text-sky">Wallet Balance</div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-4xl font-bold text-navy">{fmt(walletBalance)}</span>
                <span className="text-lg text-steel">{walletCurrency}</span>
              </div>
              <div className="mt-1 text-xs text-steel-light">
                {user ? "Live balance — main wallet" : "Demo value — sign in for live data"}
              </div>
              <div className="mt-6 flex gap-2">
                <Link
                  href="/deposits"
                  className="rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-light"
                >
                  Deposit Now
                </Link>
                <Link
                  href="/transfers"
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-navy transition hover:border-sky/40"
                >
                  Transfer to Account
                </Link>
              </div>
            </div>
          </div>
          <CardBody className="!pt-5">
            <MetricGrid
              columns={3}
              metrics={[
                { label: "Deposited (30D)", value: `$${fmt(deposited30d)}`, icon: <ArrowDownToLine size={14} /> },
                { label: "Withdrawn (30D)", value: `$${fmt(withdrawn30d)}`, icon: <ArrowUpFromLine size={14} /> },
                { label: "Rebates (30D)", value: `$${fmt(rebated30d)}`, icon: <Coins size={14} /> },
              ]}
            />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <Link href="/bank-accounts" className="flex items-center justify-between rounded-lg px-2 py-2 text-navy hover:bg-slate-50">
                <span className="flex items-center gap-2"><Wallet size={14} /> Manage payment methods</span>
                <span className="text-steel-light">→</span>
              </Link>
              <Link href="/statements" className="flex items-center justify-between rounded-lg px-2 py-2 text-navy hover:bg-slate-50">
                <span className="flex items-center gap-2"><History size={14} /> Account statements</span>
                <span className="text-steel-light">→</span>
              </Link>
              <Link href="/funds/history" className="flex items-center justify-between rounded-lg px-2 py-2 text-navy hover:bg-slate-50">
                <span className="flex items-center gap-2"><TrendingUp size={14} /> Full transaction history</span>
                <span className="text-steel-light">→</span>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <Link href="/funds/history" className="text-xs font-medium text-sky hover:underline">
            View all →
          </Link>
        </CardHeader>
        <CardBody className="px-0 pt-2">
          {recent.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-steel">
              {user ? "No transactions yet. Try a deposit." : "Sign in to see your real transactions."}
            </div>
          ) : (
            <DataTable columns={cols} rows={recent} />
          )}
        </CardBody>
      </Card>
    </Shell>
  );
}
