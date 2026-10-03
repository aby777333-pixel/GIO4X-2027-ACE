"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { Plus, X } from "lucide-react";
import { openTradingAccount } from "@/lib/account-actions";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED"] as const;
const LEVERAGES = [50, 100, 200, 500, 1000, 2000] as const;
const PLANS = ["Classic", "Premium", "ECN", "Cent", "Swap-Free STP"] as const;

export function OpenLiveAccountButton({
  variant = "primary",
  label = "Open Live Account",
  plans,
}: {
  variant?: "primary" | "ghost";
  label?: string;
  plans?: { name: string; leverage: number }[];
}) {
  const router = useRouter();
  // Broker-configured plans (from Configuration → Account types) with a safe
  // fallback to the built-in list, so the form always works.
  const planList = plans && plans.length > 0 ? plans : PLANS.map((name) => ({ name, leverage: 500 }));
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("USD");
  const [leverage, setLeverage] = useState<number>(planList[0].leverage);
  const [plan, setPlan] = useState<string>(planList[0].name);

  // Selecting a plan defaults the leverage to that plan's configured value;
  // the trader can still override it below.
  const onPlanChange = (name: string) => {
    setPlan(name);
    const found = planList.find((p) => p.name === name);
    if (found) setLeverage(found.leverage);
  };
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await openTradingAccount({
        accountKind: "live",
        baseCurrency: currency,
        leverage,
        planName: plan,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "inline-flex items-center gap-1.5 rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-light"
            : "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-navy hover:border-sky/40"
        }
      >
        <Plus size={14} /> {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-navy">Open a live account</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-steel hover:bg-slate-50"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-steel">Plan</label>
                <select
                  value={plan}
                  onChange={(e) => onPlanChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {planList.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-steel">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
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
                    {Array.from(new Set([...LEVERAGES, leverage])).sort((a, b) => a - b).map((l) => (
                      <option key={l} value={l}>1:{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-steel">
                Your live account opens with a $0 balance. Fund it from your wallet via Deposit or Transfer.
              </p>

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy"
                >
                  Cancel
                </button>
                <Button variant="primary" onClick={submit} disabled={pending}>
                  {pending ? "Opening…" : "Open account"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
