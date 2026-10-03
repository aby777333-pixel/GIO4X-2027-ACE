"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Button } from "@gio4x/ui";
import { Sparkline } from "@/components/Sparkline";
import { StatusBadge } from "@/components/StatusBadge";
import { X, PieChart, Users, Lock } from "lucide-react";
import {
  invest,
  redeem,
  createFund,
  type FundCard,
  type MyInvestment,
  type MyFund,
  type TradingAccountOption,
} from "@/lib/pamm-actions";
import { withBase } from "@/lib/base-path";

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

// ---------------------------------------------------------------------------
// Funds grid — active pools with an invest modal.
// ---------------------------------------------------------------------------
export function FundsGrid({
  funds,
  signedIn,
}: {
  funds: FundCard[];
  signedIn: boolean;
}) {
  const [active, setActive] = useState<FundCard | null>(null);

  if (funds.length === 0) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-steel">
          No active managed pools yet. Be the first —{" "}
          <a href="#become-manager" className="font-medium text-sky hover:underline">
            launch your fund
          </a>
          .
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {funds.map((f) => (
          <Card key={f.fund_id}>
            <CardBody>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-navy text-white">
                    <PieChart size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-navy">{f.name}</div>
                    <div className="mt-0.5 text-[11px] text-steel">
                      Managed by {f.manager_name ?? "—"}
                    </div>
                  </div>
                </div>
                <StatusBadge tone={f.return_pct >= 0 ? "success" : "danger"}>
                  {f.return_pct >= 0 ? "+" : ""}
                  {f.return_pct.toFixed(2)}%
                </StatusBadge>
              </div>

              {f.headline ? (
                <p className="mt-3 line-clamp-2 text-xs text-steel">{f.headline}</p>
              ) : null}

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-steel-light">
                    NAV / unit
                  </div>
                  <div className="text-2xl font-bold text-navy">{f.nav_per_unit.toFixed(4)}</div>
                </div>
                <Sparkline data={[100, 102, 101, 105, 108, 112, 110, 118]} up={f.return_pct >= 0} />
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-md bg-slate-50 px-1 py-1.5">
                  <dt className="text-steel">AUM</dt>
                  <dd className="font-semibold text-navy">
                    {f.aum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </dd>
                </div>
                <div className="rounded-md bg-slate-50 px-1 py-1.5">
                  <dt className="text-steel">Investors</dt>
                  <dd className="font-semibold text-navy">{f.investors}</dd>
                </div>
                <div className="rounded-md bg-slate-50 px-1 py-1.5">
                  <dt className="text-steel">Win rate</dt>
                  <dd className="font-semibold text-navy">{f.win_rate.toFixed(0)}%</dd>
                </div>
                <div className="rounded-md bg-slate-50 px-1 py-1.5">
                  <dt className="text-steel">Mgmt fee</dt>
                  <dd className="font-semibold text-navy">{(f.management_fee_bps / 100).toFixed(1)}%</dd>
                </div>
                <div className="rounded-md bg-slate-50 px-1 py-1.5">
                  <dt className="text-steel">Perf fee</dt>
                  <dd className="font-semibold text-navy">{(f.performance_fee_bps / 100).toFixed(0)}%</dd>
                </div>
                <div className="rounded-md bg-slate-50 px-1 py-1.5">
                  <dt className="text-steel">Lockup</dt>
                  <dd className="font-semibold text-navy">
                    {f.lockup_days > 0 ? `${f.lockup_days}d` : "None"}
                  </dd>
                </div>
              </dl>

              <div className="mt-4">
                <Button variant="primary" className="!w-full" onClick={() => setActive(f)}>
                  Invest
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {active ? (
        <InvestModal fund={active} signedIn={signedIn} onClose={() => setActive(null)} />
      ) : null}
    </>
  );
}

function InvestModal({
  fund,
  signedIn,
  onClose,
}: {
  fund: FundCard;
  signedIn: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(fund.min_investment || 100));
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const units = Number(amount) > 0 && fund.nav_per_unit > 0 ? Number(amount) / fund.nav_per_unit : 0;

  function submit() {
    setErr(null);
    if (!signedIn) {
      window.location.href = withBase("/auth/login?redirect=/pamm");
      return;
    }
    startTransition(async () => {
      const res = await invest(fund.fund_id, Number(amount));
      if (res.ok) {
        onClose();
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
            <div className="text-sm font-bold text-navy">Invest in {fund.name}</div>
            <div className="text-xs text-steel">
              Min {fund.min_investment.toFixed(0)} {fund.currency} · NAV{" "}
              {fund.nav_per_unit.toFixed(4)} ·{" "}
              {fund.lockup_days > 0 ? `${fund.lockup_days}-day lockup` : "no lockup"}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} className="text-steel" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
              Amount ({fund.currency})
            </span>
            <input
              type="number"
              min={fund.min_investment}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
            />
            <span className="mt-1 block text-[11px] text-steel-light">
              ≈ {units.toFixed(4)} units at the current NAV.
            </span>
          </label>
          {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}
          <Button variant="primary" className="!w-full" onClick={submit} disabled={pending}>
            {pending ? "Investing…" : signedIn ? "Confirm investment" : "Sign in to invest"}
          </Button>
          <p className="text-[11px] text-steel-light">
            Capital is debited from your main {fund.currency} wallet. Management +
            high-water performance fees are netted from your payout when you redeem.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investment row actions — redeem (all or partial).
// ---------------------------------------------------------------------------
export function InvestmentActions({ investment }: { investment: MyInvestment }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState(String(investment.units));
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const locked =
    investment.locked_until != null && new Date(investment.locked_until).getTime() > Date.now();

  function run(allUnits: boolean) {
    setErr(null);
    startTransition(async () => {
      const res = await redeem(investment.investment_id, allUnits ? null : Number(units));
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  }

  if (investment.status === "redeemed" || investment.units <= 0) {
    return <span className="text-[11px] text-steel-light">Redeemed</span>;
  }

  if (locked) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-steel-light">
        <Lock size={11} /> Locked until{" "}
        {new Date(investment.locked_until as string).toLocaleDateString()}
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-steel hover:border-sky/40 hover:text-navy"
      >
        Redeem
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          max={investment.units}
          step="any"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          className="w-24 rounded-md border border-slate-200 px-2 py-1 text-[11px]"
        />
        <button
          type="button"
          onClick={() => run(false)}
          disabled={pending}
          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-steel hover:border-sky/40 hover:text-navy disabled:opacity-50"
        >
          {pending ? "…" : "Redeem"}
        </button>
        <button
          type="button"
          onClick={() => run(true)}
          disabled={pending}
          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-steel hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
        >
          All
        </button>
      </div>
      {err ? <span className="text-[10px] text-rose-600">{err}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Become a money manager — apply / update a fund profile.
// ---------------------------------------------------------------------------
export function BecomeManagerForm({
  existing,
  accounts,
}: {
  existing: MyFund | null;
  accounts: TradingAccountOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [headline, setHeadline] = useState(existing?.headline ?? "");
  const [accountId, setAccountId] = useState(existing?.trading_account_id ?? "");
  const [mgmtPct, setMgmtPct] = useState(String((existing?.management_fee_bps ?? 200) / 100));
  const [perfPct, setPerfPct] = useState(String((existing?.performance_fee_bps ?? 2000) / 100));
  const [minInv, setMinInv] = useState(String(existing?.min_investment ?? 100));
  const [lockup, setLockup] = useState(String(existing?.lockup_days ?? 0));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await createFund({
        name,
        headline,
        tradingAccountId: accountId || null,
        managementFeeBps: Math.round(Number(mgmtPct) * 100),
        performanceFeeBps: Math.round(Number(perfPct) * 100),
        minInvestment: Number(minInv),
        lockupDays: Math.round(Number(lockup)),
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
          Fund name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          placeholder="e.g. GIO Macro Pool"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
          Headline / mandate
        </span>
        <textarea
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className={inputCls + " min-h-[64px] resize-y"}
          placeholder="Describe your instruments, risk model and edge."
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
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
            Management fee (% / yr)
          </span>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={mgmtPct}
            onChange={(e) => setMgmtPct(e.target.value)}
            className={inputCls}
          />
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
            value={perfPct}
            onChange={(e) => setPerfPct(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Min investment
          </span>
          <input
            type="number"
            min="0"
            step="any"
            value={minInv}
            onChange={(e) => setMinInv(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Lockup (days)
          </span>
          <input
            type="number"
            min="0"
            step="1"
            value={lockup}
            onChange={(e) => setLockup(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      {msg ? <p className="text-xs font-medium text-emerald-600">{msg}</p> : null}
      {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}

      <Button variant="primary" onClick={submit} disabled={pending || !name.trim()}>
        {pending ? "Submitting…" : existing ? "Update fund" : "Submit application"}
      </Button>
    </div>
  );
}
