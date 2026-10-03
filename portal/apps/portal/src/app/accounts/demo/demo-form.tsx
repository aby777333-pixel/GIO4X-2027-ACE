"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@gio4x/ui";
import { createDemoAccount } from "@/lib/account-actions";

type Plan = {
  label: string;
  planName: string;
  baseCurrency: "USD" | "USC";
  leverage: number;
};

const PLANS: Plan[] = [
  { label: "Premium Demo (USD, 1:500)", planName: "Premium Demo", baseCurrency: "USD", leverage: 500 },
  { label: "Classic Demo (USD, 1:500)", planName: "Classic Demo", baseCurrency: "USD", leverage: 500 },
  { label: "ECN Demo (USD, 1:500)", planName: "ECN Demo", baseCurrency: "USD", leverage: 500 },
  { label: "Cent Demo (USC, 1:500)", planName: "Cent Demo", baseCurrency: "USC", leverage: 500 },
];

const BALANCES = [10000, 25000, 100000, 1000000];
const LEVERAGES = [500, 200, 100, 50];

export function DemoAccountForm({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [planIdx, setPlanIdx] = useState(0);
  const [balance, setBalance] = useState(10000);
  const [leverage, setLeverage] = useState(500);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!signedIn) {
      setError("Sign in to create a demo account.");
      return;
    }
    const plan = PLANS[planIdx];
    startTransition(async () => {
      const res = await createDemoAccount({
        accountKind: "demo",
        baseCurrency: plan.baseCurrency,
        leverage,
        startingBalance: balance,
        planName: plan.planName,
      });
      if (res.ok) {
        setSuccess(res.message ?? "Demo account created.");
        router.refresh();
        setTimeout(() => router.push("/accounts"), 800);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-steel">Platform</label>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <button
            type="button"
            className="flex items-center justify-between rounded-lg border-2 border-sky bg-sky/5 px-3 py-3 text-sm font-medium text-navy"
          >
            <span>GIO Raptor</span>
            <span className="text-[10px] uppercase tracking-wider text-sky">Selected</span>
          </button>
        </div>
        <div className="mt-1 text-[11px] text-steel-light">
          One execution engine across web, desktop, and mobile.
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-steel">Account type</label>
        <select
          value={planIdx}
          onChange={(e) => setPlanIdx(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {PLANS.map((p, i) => (
            <option key={p.planName} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-steel">Starting balance</label>
        <select
          value={balance}
          onChange={(e) => setBalance(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {BALANCES.map((b) => (
            <option key={b} value={b}>
              ${b.toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-steel">Leverage</label>
        <select
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {LEVERAGES.map((l) => (
            <option key={l} value={l}>
              1:{l}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="flex justify-end pt-3">
        {!signedIn ? (
          <Link
            href="/auth/login?redirect=/accounts/demo"
            className="rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white"
          >
            Sign in to create
          </Link>
        ) : (
          <Button variant="primary" type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create Demo Account"}
          </Button>
        )}
      </div>
    </form>
  );
}
