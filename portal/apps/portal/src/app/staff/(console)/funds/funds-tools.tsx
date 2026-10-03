"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { Check, X, BookPlus, TrendingUp } from "lucide-react";
import {
  settleTransaction,
  recordTrade,
  type TradingAccountOption,
} from "@/lib/funds-actions";

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
        {label}
      </span>
      {children}
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/30 p-4 backdrop-blur-sm">
      <div className="mt-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-navy">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-steel transition hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Settle (approve / reject) buttons for a single pending transaction row.
export function SettleButtons({ txId }: { txId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function act(action: "approve" | "reject") {
    setErr(null);
    startTransition(async () => {
      const res = await settleTransaction(txId, action);
      if (res.ok) router.refresh();
      else setErr(res.error);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => act("approve")}
        disabled={pending}
        title="Approve & settle"
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        <Check size={14} /> Approve
      </button>
      <button
        type="button"
        onClick={() => act("reject")}
        disabled={pending}
        title="Reject"
        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
      >
        <X size={14} /> Reject
      </button>
      {err ? <span className="text-[11px] text-rose-600">{err}</span> : null}
    </div>
  );
}

// Book a closed trade → fires commission + IB rebate.
export function RecordTradeButton({ accounts }: { accounts: TradingAccountOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [tradingAccountId, setTradingAccountId] = useState("");
  const [symbol, setSymbol] = useState("XAUUSD");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [lots, setLots] = useState("");
  const [pnl, setPnl] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await recordTrade({
        tradingAccountId,
        symbol,
        side,
        lots: Number(lots),
        pnl: pnl ? Number(pnl) : 0,
      });
      if (res.ok) {
        setOpen(false);
        setLots("");
        setPnl("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)} disabled={accounts.length === 0}>
        <BookPlus size={16} className="mr-1.5" /> Book trade
      </Button>
    );
  }

  return (
    <Modal title="Book a closed trade" onClose={() => setOpen(false)}>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-steel">
        <TrendingUp size={14} /> Booking a closed trade charges the per-lot commission and
        distributes the IB rebate up the tree automatically.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Trading account *">
          <select
            value={tradingAccountId}
            onChange={(e) => setTradingAccountId(e.target.value)}
            className={inputCls}
            required
          >
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Symbol">
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className={inputCls}
              placeholder="XAUUSD"
            />
          </Field>
          <Field label="Side">
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as "buy" | "sell")}
              className={inputCls}
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </Field>
          <Field label="Lots *">
            <input
              value={lots}
              onChange={(e) => setLots(e.target.value)}
              className={inputCls}
              inputMode="decimal"
              placeholder="1.00"
            />
          </Field>
        </div>
        <Field label="Realised P&L (optional)">
          <input
            value={pnl}
            onChange={(e) => setPnl(e.target.value)}
            className={inputCls}
            inputMode="decimal"
            placeholder="0.00"
          />
        </Field>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={pending || !tradingAccountId}>
            {pending ? "Booking…" : "Book trade"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
