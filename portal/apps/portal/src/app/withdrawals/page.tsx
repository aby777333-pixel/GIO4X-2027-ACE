import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { WithdrawForm } from "./withdraw-form";

export const dynamic = "force-dynamic";

type WTx = {
  id: string;
  date: string;
  method: string;
  amount: number;
  currency: string;
  status: string;
};

const dangerStatuses = new Set(["failed", "cancelled", "reversed", "rejected"]);

const cols: Column<WTx>[] = [
  { key: "date", header: "Date", render: (r) => <span className="text-steel">{r.date}</span> },
  { key: "method", header: "Method", render: (r) => <span className="text-navy">{r.method}</span> },
  { key: "amount", header: "Amount", align: "right", render: (r) => <span className="font-medium text-navy">{r.amount.toFixed(2)} {r.currency}</span> },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <StatusBadge tone={r.status === "completed" ? "success" : dangerStatuses.has(r.status) ? "danger" : "warning"}>
        {r.status}
      </StatusBadge>
    ),
  },
];

export default async function WithdrawalsPage() {
  const user = await getCurrentUser();
  const kycApproved = user?.profile?.kyc_status === "approved";

  let wallets: Array<{ id: string; label: string; balance: number }> = [];
  let past: WTx[] = [];

  if (user) {
    const supabase = getSupabaseServer();
    const [{ data: walletRows }, { data: txs }] = await Promise.all([
      supabase
        .from("wallets")
        .select("id, wallet_id, balance, currency, type")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase
        .from("wallet_transactions")
        .select("id, amount, currency, status, gateway, created_at, type")
        .eq("type", "withdraw")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    wallets = (walletRows ?? []).map((w) => ({
      id: w.id,
      label: `${w.type === "main" ? "Main wallet" : w.type} · ${Number(w.balance).toFixed(2)} ${w.currency}`,
      balance: Number(w.balance),
    }));

    past = (txs ?? []).map((t) => ({
      id: t.id,
      date: new Date(t.created_at).toISOString().slice(0, 16).replace("T", " "),
      method: t.gateway ?? "—",
      amount: Number(t.amount),
      currency: t.currency,
      status: t.status,
    }));
  }

  return (
    <Shell title="Withdrawals">
      <PageHeader
        title="Withdraw Funds"
        subtitle="Withdrawals process within 24 hours on business days. Fees are absorbed by GIO4X."
      />

      {user && !kycApproved ? (
        <Card className="mb-5 border-amber-200 bg-amber-50">
          <CardBody className="!py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 text-amber-700" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-900">Verification required</div>
                <div className="mt-0.5 text-xs text-amber-800">
                  We can accept your first deposit before verification, but withdrawals require a
                  completed KYC. It usually takes under 10 minutes.
                </div>
              </div>
              <Link
                href="/verification"
                className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800"
              >
                Verify now
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardBody>
            <WithdrawForm signedIn={!!user} kycApproved={!!kycApproved} wallets={wallets} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Withdrawal rules</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-xs text-steel">
            <p><strong className="text-navy">Min:</strong> $10 (crypto) · $50 (card, bank).</p>
            <p><strong className="text-navy">Limit:</strong> $50,000 per day.</p>
            <p>
              <strong className="text-navy">First withdrawal</strong> must go to the same method used
              for your first deposit (AML rule).
            </p>
            <p>
              <strong className="text-navy">Processing time:</strong> crypto 10–30 min · card 1–2 business
              days · bank 1–3 business days.
            </p>
            <p className="border-t border-slate-100 pt-2">
              Withdraw from your wallet. To withdraw trading-account funds,{" "}
              <Link href="/transfers" className="text-sky hover:underline">transfer them to your wallet</Link> first.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Past withdrawals</CardTitle>
        </CardHeader>
        <CardBody className="px-0 pt-2">
          {past.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-steel">
              {user ? "No withdrawals yet." : "Sign in to see your withdrawal history."}
            </div>
          ) : (
            <DataTable columns={cols} rows={past} />
          )}
        </CardBody>
      </Card>
    </Shell>
  );
}
