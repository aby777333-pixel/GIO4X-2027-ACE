"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { CheckCircle2 } from "lucide-react";
import { claimMyRebate, transferRebateToWallet } from "@/lib/rebate-actions";

export function RebateButtons({
  currency,
  hasUnclaimed,
  hasRebateBalance,
}: {
  currency: string;
  hasUnclaimed: boolean;
  hasRebateBalance: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setMsg(res.message ?? "Done.");
        router.refresh();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => run(() => claimMyRebate(currency))} disabled={pending || !hasUnclaimed}>
          {pending ? "Working…" : "Claim Rebate"}
        </Button>
        <button
          type="button"
          onClick={() => run(() => transferRebateToWallet(currency))}
          disabled={pending || !hasRebateBalance}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-navy transition hover:border-sky/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Transfer to Wallet
        </button>
      </div>
      {msg ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <CheckCircle2 size={14} /> {msg}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      ) : null}
    </div>
  );
}
