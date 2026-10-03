"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Button } from "@gio4x/ui";
import { ChipFilter } from "@/components/ChipFilter";
import { Sparkline } from "@/components/Sparkline";
import { StatusBadge } from "@/components/StatusBadge";
import { Users, X, Pause, Play, Square } from "lucide-react";
import {
  subscribe,
  setSubscriptionStatus,
  becomeProvider,
  type ProviderCard,
  type MySubscription,
  type MyProvider,
  type TradingAccountOption,
} from "@/lib/copy-actions";
import type { Enums } from "@gio4x/supabase";
import { withBase } from "@/lib/base-path";

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

function riskTone(risk: string) {
  return risk === "high" ? "danger" : risk === "medium" ? "warning" : "success";
}

// ---------------------------------------------------------------------------
// Discover — provider leaderboard with client-side sort + a copy modal.
// ---------------------------------------------------------------------------
const sortBy = ["Top return", "Most followers", "Highest win rate"] as const;
type Sort = (typeof sortBy)[number];

export function DiscoverGrid({
  providers,
  signedIn,
}: {
  providers: ProviderCard[];
  signedIn: boolean;
}) {
  const [sort, setSort] = useState<Sort>("Top return");
  const [active, setActive] = useState<ProviderCard | null>(null);

  const sorted = useMemo(() => {
    const copy = [...providers];
    copy.sort((a, b) => {
      if (sort === "Most followers") return b.followers - a.followers;
      if (sort === "Highest win rate") return b.win_rate - a.win_rate;
      return b.total_pnl - a.total_pnl;
    });
    return copy;
  }, [providers, sort]);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <ChipFilter options={sortBy} value={sort} onChange={setSort} />
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-steel">
            No active signal providers yet. Be the first —{" "}
            <a href={withBase("/copy/signal-provider")} className="font-medium text-sky hover:underline">
              publish your strategy
            </a>
            .
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((p) => {
            const init = p.display_name
              .split(/\s+/)
              .map((w) => w[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <Card key={p.provider_id}>
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-navy text-sm font-bold text-white">
                        {init || "GP"}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-navy">{p.display_name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-steel">
                          <Users size={11} /> {p.followers.toLocaleString()} followers
                        </div>
                      </div>
                    </div>
                    <StatusBadge tone={riskTone(p.risk)}>{p.risk}</StatusBadge>
                  </div>

                  {p.headline ? (
                    <p className="mt-3 line-clamp-2 text-xs text-steel">{p.headline}</p>
                  ) : null}

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-steel-light">
                        Realised P&L
                      </div>
                      <div
                        className={
                          p.total_pnl >= 0
                            ? "text-2xl font-bold text-success"
                            : "text-2xl font-bold text-danger"
                        }
                      >
                        {p.total_pnl >= 0 ? "+" : ""}
                        {p.total_pnl.toFixed(2)}
                      </div>
                    </div>
                    <Sparkline data={[100, 102, 101, 105, 108, 112, 110, 118]} up={p.total_pnl >= 0} />
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="rounded-md bg-slate-50 px-1 py-1.5">
                      <dt className="text-steel">Win rate</dt>
                      <dd className="font-semibold text-navy">{p.win_rate.toFixed(0)}%</dd>
                    </div>
                    <div className="rounded-md bg-slate-50 px-1 py-1.5">
                      <dt className="text-steel">Trades</dt>
                      <dd className="font-semibold text-navy">{p.trades_count}</dd>
                    </div>
                    <div className="rounded-md bg-slate-50 px-1 py-1.5">
                      <dt className="text-steel">Perf fee</dt>
                      <dd className="font-semibold text-navy">{(p.performance_fee_bps / 100).toFixed(0)}%</dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    <Button variant="primary" className="!w-full" onClick={() => setActive(p)}>
                      Copy strategy
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {active ? (
        <CopyModal provider={active} signedIn={signedIn} onClose={() => setActive(null)} />
      ) : null}
    </>
  );
}

function CopyModal({
  provider,
  signedIn,
  onClose,
}: {
  provider: ProviderCard;
  signedIn: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [allocation, setAllocation] = useState(String(provider.min_allocation || 100));
  const [ratio, setRatio] = useState("1");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setErr(null);
    if (!signedIn) {
      window.location.href = withBase("/auth/login?redirect=/copy/discover");
      return;
    }
    startTransition(async () => {
      const res = await subscribe(provider.provider_id, Number(allocation), Number(ratio));
      if (res.ok) {
        router.push("/copy/copier");
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-bold text-navy">Copy {provider.display_name}</div>
            <div className="text-xs text-steel">
              Min {provider.min_allocation.toFixed(0)} {provider.currency} ·{" "}
              {(provider.performance_fee_bps / 100).toFixed(0)}% performance fee
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} className="text-steel" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
              Allocation ({provider.currency})
            </span>
            <input
              type="number"
              min={provider.min_allocation}
              step="any"
              value={allocation}
              onChange={(e) => setAllocation(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
              Copy ratio
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              className={inputCls}
            />
            <span className="mt-1 block text-[11px] text-steel-light">
              1.0 mirrors the provider&apos;s lot size; 0.5 copies at half size.
            </span>
          </label>
          {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}
          <Button variant="primary" className="!w-full" onClick={submit} disabled={pending}>
            {pending ? "Starting…" : signedIn ? "Start copying" : "Sign in to copy"}
          </Button>
          <p className="text-[11px] text-steel-light">
            Performance fees are charged only on new high-water-mark profit and settled from your main
            wallet automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copier — pause / resume / stop a subscription.
// ---------------------------------------------------------------------------
export function SubscriptionActions({ sub }: { sub: MySubscription }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(status: Enums<"copy_subscription_status">) {
    setErr(null);
    startTransition(async () => {
      const res = await setSubscriptionStatus(sub.subscription_id, status);
      if (res.ok) router.refresh();
      else setErr(res.error);
    });
  }

  if (sub.status === "stopped") {
    return (
      <button
        type="button"
        onClick={() => run("active")}
        disabled={pending}
        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-steel hover:border-sky/40 hover:text-navy disabled:opacity-50"
      >
        <Play size={11} className="mr-1 inline" /> Resume
      </button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {err ? <span className="text-[10px] text-rose-600">{err}</span> : null}
      {sub.status === "active" ? (
        <button
          type="button"
          onClick={() => run("paused")}
          disabled={pending}
          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-steel hover:border-amber/40 hover:text-navy disabled:opacity-50"
        >
          <Pause size={11} className="mr-1 inline" /> Pause
        </button>
      ) : (
        <button
          type="button"
          onClick={() => run("active")}
          disabled={pending}
          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-steel hover:border-sky/40 hover:text-navy disabled:opacity-50"
        >
          <Play size={11} className="mr-1 inline" /> Resume
        </button>
      )}
      <button
        type="button"
        onClick={() => run("stopped")}
        disabled={pending}
        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-steel hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
      >
        <Square size={11} className="mr-1 inline" /> Stop
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signal provider — apply / update a strategy profile.
// ---------------------------------------------------------------------------
export function BecomeProviderForm({
  existing,
  accounts,
}: {
  existing: MyProvider | null;
  accounts: TradingAccountOption[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(existing?.display_name ?? "");
  const [headline, setHeadline] = useState(existing?.headline ?? "");
  const [accountId, setAccountId] = useState(existing?.trading_account_id ?? "");
  const [risk, setRisk] = useState<Enums<"copy_risk">>(existing?.risk ?? "medium");
  const [feePct, setFeePct] = useState(String((existing?.performance_fee_bps ?? 2000) / 100));
  const [minAlloc, setMinAlloc] = useState(String(existing?.min_allocation ?? 100));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await becomeProvider({
        displayName,
        headline,
        tradingAccountId: accountId || null,
        risk,
        performanceFeeBps: Math.round(Number(feePct) * 100),
        minAllocation: Number(minAlloc),
      });
      if (res.ok) {
        setMsg(res.message ?? "Submitted.");
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
          Strategy name
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputCls}
          placeholder="e.g. Gold Momentum Pro"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
          Headline / edge
        </span>
        <textarea
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className={inputCls + " min-h-[64px] resize-y"}
          placeholder="Describe your instruments, risk model and edge."
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Master trading account
          </span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
            <option value="">— none / link later —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Risk profile
          </span>
          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value as Enums<"copy_risk">)}
            className={inputCls}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Performance fee (%)
          </span>
          <input
            type="number"
            min="0"
            max="50"
            step="1"
            value={feePct}
            onChange={(e) => setFeePct(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Min allocation
          </span>
          <input
            type="number"
            min="0"
            step="any"
            value={minAlloc}
            onChange={(e) => setMinAlloc(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      {msg ? <p className="text-xs font-medium text-emerald-600">{msg}</p> : null}
      {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}

      <Button variant="primary" onClick={submit} disabled={pending || !displayName.trim()}>
        {pending ? "Submitting…" : existing ? "Update strategy" : "Submit application"}
      </Button>
    </div>
  );
}
