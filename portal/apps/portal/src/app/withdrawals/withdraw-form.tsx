"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@gio4x/ui";
import { ShieldCheck } from "lucide-react";
import { requestWithdrawal } from "@/lib/wallet-actions";

type Wallet = { id: string; label: string; balance: number };

export function WithdrawForm({
  signedIn,
  kycApproved,
  wallets,
}: {
  signedIn: boolean;
  kycApproved: boolean;
  wallets: Wallet[];
}) {
  const router = useRouter();
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [amount, setAmount] = useState<number>(100);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const max = wallets.find((w) => w.id === walletId)?.balance ?? 0;
  const disabled = !signedIn || !kycApproved;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!signedIn) {
      setError("Sign in to withdraw.");
      return;
    }
    if (!kycApproved) {
      setError("Complete KYC before withdrawing.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("amount", String(amount));
    fd.set("wallet_id", walletId);
    startTransition(async () => {
      const res = await requestWithdrawal(fd);
      if (res.ok) {
        setSuccess(res.message ?? "Submitted.");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-steel">Withdraw from</label>
        {wallets.length === 0 ? (
          <div className="mt-1 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-steel">
            {signedIn ? "No wallets available." : "Sign in to see your wallets."}
          </div>
        ) : (
          <select
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-steel">Amount</label>
        <div className="mt-1 flex items-center rounded-lg border border-slate-200 px-3 py-2">
          <span className="mr-2 text-steel">$</span>
          <input
            type="number"
            min={10}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setAmount(max)}
            className="text-[11px] font-semibold text-sky"
            disabled={!walletId}
          >
            MAX
          </button>
        </div>
        {walletId ? (
          <div className="mt-1 text-[11px] text-steel-light">Available: ${max.toFixed(2)}</div>
        ) : null}
      </div>

      <div>
        <label className="block text-xs font-medium text-steel">Method</label>
        <select
          name="gateway"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          defaultValue="usdt_trc20"
        >
          <option value="usdt_trc20">USDT (TRC20)</option>
          <option value="bank">Bank Transfer</option>
          <option value="card">Original Card</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>
      ) : null}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 text-[11px] text-steel">
          <ShieldCheck size={14} className="text-sky" /> Withdrawals are reviewed by our team before payout.
        </div>
        {!signedIn ? (
          <Link href="/auth/login?redirect=/withdrawals" className="rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white">
            Sign in
          </Link>
        ) : (
          <Button variant="primary" type="submit" disabled={pending || disabled || !walletId}>
            {pending ? "Submitting…" : `Request $${amount.toLocaleString()}`}
          </Button>
        )}
      </div>
    </form>
  );
}
