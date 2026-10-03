"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@gio4x/ui";
import { ArrowLeftRight, ArrowRight, CheckCircle2 } from "lucide-react";
import { transferFunds, type TransferEndpoint } from "@/lib/transfers-actions";

const sym = (ccy: string) => (ccy === "USC" ? "¢" : ccy === "USD" ? "$" : "");

// Mirror the FX rule in transfer_funds(): same currency 1:1, USD<->USC 1:100.
function convert(amount: number, from: string, to: string): number | null {
  if (from === to) return amount;
  if (from === "USD" && to === "USC") return amount * 100;
  if (from === "USC" && to === "USD") return amount / 100;
  return null; // unsupported pair
}

export function TransferForm({ endpoints }: { endpoints: TransferEndpoint[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fromId, setFromId] = useState(endpoints[0]?.id ?? "");
  const [toId, setToId] = useState(endpoints[1]?.id ?? "");
  const [amount, setAmount] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const byId = useMemo(() => new Map(endpoints.map((e) => [e.id, e])), [endpoints]);
  const fromAcc = byId.get(fromId);
  const toAcc = byId.get(toId);

  const received = fromAcc && toAcc ? convert(amount, fromAcc.currency, toAcc.currency) : null;
  const unsupportedPair = !!fromAcc && !!toAcc && received === null;
  const overBalance = fromAcc ? amount > fromAcc.balance : false;

  function swap() {
    setError(null);
    setDone(false);
    setFromId(toId);
    setToId(fromId);
  }

  function onTransfer() {
    setError(null);
    setDone(false);
    if (!fromAcc || !toAcc) {
      setError("Pick both a source and a destination.");
      return;
    }
    if (fromAcc.id === toAcc.id) {
      setError("Pick two different accounts.");
      return;
    }
    if (!(amount > 0)) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (unsupportedPair) {
      setError(`Transfers between ${fromAcc.currency} and ${toAcc.currency} aren't supported.`);
      return;
    }
    if (overBalance) {
      setError("Amount exceeds the available balance.");
      return;
    }
    const idempotencyKey = `xfer-${crypto.randomUUID()}`;
    startTransition(async () => {
      const res = await transferFunds({
        fromKind: fromAcc.kind,
        fromId: fromAcc.id,
        toKind: toAcc.kind,
        toId: toAcc.id,
        amount,
        idempotencyKey,
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <div>
              <label className="block text-xs font-medium text-steel">From</label>
              <select
                value={fromId}
                onChange={(e) => { setFromId(e.target.value); setError(null); setDone(false); }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {endpoints.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-steel">
                Available: {fromAcc ? `${fromAcc.balance.toFixed(2)} ${fromAcc.currency}` : "—"}
              </div>
            </div>

            <div className="flex items-end justify-center pb-2">
              <button
                onClick={swap}
                className="rounded-full border border-slate-200 bg-white p-2 text-sky shadow-sm transition hover:rotate-180"
                aria-label="Swap source and destination"
                type="button"
              >
                <ArrowLeftRight size={16} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-steel">To</label>
              <select
                value={toId}
                onChange={(e) => { setToId(e.target.value); setError(null); setDone(false); }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {endpoints.filter((s) => s.id !== fromId).map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-steel">
                Current: {toAcc ? `${toAcc.balance.toFixed(2)} ${toAcc.currency}` : "—"}
              </div>
            </div>
          </div>

          <label className="mt-5 block text-xs font-medium text-steel">Amount</label>
          <div className="mt-1 flex items-center rounded-lg border border-slate-200 px-3 py-2">
            <span className="mr-2 text-steel">{fromAcc ? sym(fromAcc.currency) : "$"}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => { setAmount(Number(e.target.value)); setError(null); setDone(false); }}
              className="w-full bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => fromAcc && setAmount(fromAcc.balance)}
              className="text-[11px] font-semibold text-sky"
            >
              MAX
            </button>
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-steel">{fromAcc?.label ?? "—"}</span>
              <ArrowRight size={14} className="text-sky" />
              <span className="text-steel">{toAcc?.label ?? "—"}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <div className="text-steel">You send</div>
                <div className="mt-1 font-semibold text-navy">
                  {amount.toFixed(2)} {fromAcc?.currency ?? ""}
                </div>
              </div>
              <div>
                <div className="text-steel">Fee</div>
                <div className="mt-1 font-semibold text-success">$0.00</div>
              </div>
              <div>
                <div className="text-steel">They receive</div>
                <div className="mt-1 font-semibold text-navy">
                  {received !== null
                    ? `${received.toFixed(toAcc?.currency === "USC" ? 0 : 2)} ${toAcc?.currency ?? ""}`
                    : "—"}
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}
          {done ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 size={14} /> Transfer completed. Balances updated.
            </div>
          ) : null}

          <div className="mt-5 flex justify-end">
            <Button
              variant="primary"
              onClick={onTransfer}
              disabled={pending || !fromAcc || !toAcc || unsupportedPair || overBalance || !(amount > 0)}
            >
              {pending ? "Transferring…" : "Transfer Now"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-xs text-steel">
          <p>Transfers between accounts of the same currency are instant and free.</p>
          <p>Cross-currency transfers (e.g. USD → USC) use a 1:100 fixed rate for cent accounts.</p>
          <p>You can only transfer between your own wallet and trading accounts.</p>
          <p>Transfers count toward IB volume tracking the moment they settle.</p>
        </CardBody>
      </Card>
    </div>
  );
}
