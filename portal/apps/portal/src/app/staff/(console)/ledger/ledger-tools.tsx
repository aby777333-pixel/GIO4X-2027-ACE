"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { Plus, X, Trash2, BookPlus } from "lucide-react";
import {
  createLedgerAccount,
  postManualJournal,
  type JournalLineInput,
} from "@/lib/fee-actions";
import {
  LEDGER_ACCOUNT_TYPES,
  LEDGER_ACCOUNT_TYPE_LABEL,
  CURRENCIES,
  type LedgerAccountType,
  type WalletCurrency,
} from "@/lib/fee-constants";

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

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/30 p-4 backdrop-blur-sm">
      <div className={`mt-10 w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl border border-slate-200 bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-navy">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-steel transition hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{msg}</div>;
}

// ---------------------------------------------------------------------------
// New ledger account (admin)
// ---------------------------------------------------------------------------
export function NewAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<LedgerAccountType>("asset");
  const [currency, setCurrency] = useState<WalletCurrency>("USD");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createLedgerAccount({ code, name, type, currency });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus size={16} className="mr-1.5" /> New account
      </Button>
    );
  }

  return (
    <Modal title="New ledger account" onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code *"><input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="BANK_HDFC" autoFocus /></Field>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as LedgerAccountType)} className={inputCls}>
              {LEDGER_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{LEDGER_ACCOUNT_TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Name *"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="HDFC settlement account" /></Field>
        <Field label="Currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value as WalletCurrency)} className={inputCls}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <ErrorBox msg={error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Post a manual journal entry (staff). Balanced double-entry.
// ---------------------------------------------------------------------------
type DraftLine = {
  account_code: string;
  direction: "debit" | "credit";
  amount: string;
  currency: WalletCurrency;
  memo: string;
};

const blankLine = (direction: "debit" | "credit"): DraftLine => ({
  account_code: "",
  direction,
  amount: "",
  currency: "USD",
  memo: "",
});

export function PostJournalButton({ accountCodes }: { accountCodes: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine("debit"), blankLine("credit")]);

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, blankLine("debit")]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  // live balance preview per currency
  const net = new Map<string, number>();
  for (const l of lines) {
    const amt = Number(l.amount) || 0;
    if (amt <= 0 || !l.account_code.trim()) continue;
    const signed = l.direction === "debit" ? amt : -amt;
    net.set(l.currency, (net.get(l.currency) ?? 0) + signed);
  }
  const balanced = [...net.values()].every((v) => Math.round(v * 1e8) / 1e8 === 0) && net.size > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload: JournalLineInput[] = lines
        .filter((l) => l.account_code.trim() && Number(l.amount) > 0)
        .map((l) => ({
          account_code: l.account_code.trim(),
          direction: l.direction,
          amount: Number(l.amount),
          currency: l.currency,
          memo: l.memo.trim() || undefined,
        }));
      const res = await postManualJournal({ description, reference, lines: payload });
      if (res.ok) {
        setOpen(false);
        setLines([blankLine("debit"), blankLine("credit")]);
        setDescription("");
        setReference("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <BookPlus size={16} className="mr-1.5" /> Post journal
      </Button>
    );
  }

  return (
    <Modal title="Post manual journal" onClose={() => setOpen(false)} wide>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Description *"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder="Manual adjustment" autoFocus /></Field>
          <Field label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} placeholder="optional" /></Field>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Field label={i === 0 ? "Account code" : ""}>
                  <input
                    value={l.account_code}
                    onChange={(e) => setLine(i, { account_code: e.target.value.toUpperCase() })}
                    className={inputCls}
                    placeholder="CLIENT_FUNDS"
                    list="ledger-codes"
                  />
                </Field>
              </div>
              <div className="w-28">
                <Field label={i === 0 ? "Dir" : ""}>
                  <select value={l.direction} onChange={(e) => setLine(i, { direction: e.target.value as "debit" | "credit" })} className={inputCls}>
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </Field>
              </div>
              <div className="w-28">
                <Field label={i === 0 ? "Amount" : ""}>
                  <input value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} className={inputCls} inputMode="decimal" placeholder="0.00" />
                </Field>
              </div>
              <div className="w-24">
                <Field label={i === 0 ? "Ccy" : ""}>
                  <select value={l.currency} onChange={(e) => setLine(i, { currency: e.target.value as WalletCurrency })} className={inputCls}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 2}
                className="mb-1 rounded-lg p-2 text-steel transition hover:bg-slate-100 disabled:opacity-30"
                aria-label="Remove line"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <datalist id="ledger-codes">
          {accountCodes.map((c) => <option key={c} value={c} />)}
        </datalist>

        <div className="flex items-center justify-between">
          <button type="button" onClick={addLine} className="text-xs font-medium text-sky hover:underline">
            + Add line
          </button>
          <div className="text-xs">
            {net.size === 0 ? (
              <span className="text-steel-light">Enter lines…</span>
            ) : balanced ? (
              <span className="font-medium text-emerald-600">Balanced ✓</span>
            ) : (
              <span className="font-medium text-amber-600">
                Unbalanced: {[...net.entries()].map(([c, v]) => `${c} ${v.toFixed(2)}`).join(", ")}
              </span>
            )}
          </div>
        </div>

        <ErrorBox msg={error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={pending || !balanced}>{pending ? "Posting…" : "Post journal"}</Button>
        </div>
      </form>
    </Modal>
  );
}
