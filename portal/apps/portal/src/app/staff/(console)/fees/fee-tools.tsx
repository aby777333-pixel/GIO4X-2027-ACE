"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { Plus, X, Calculator, Receipt, Power } from "lucide-react";
import {
  createFeeSchedule,
  createFeeRule,
  simulateFee,
  chargeFeeManual,
  setFeeRuleActive,
  type FeeQuote,
} from "@/lib/fee-actions";
import {
  FEE_TYPES,
  FEE_TYPE_LABEL,
  CALC_METHODS,
  CALC_METHOD_LABEL,
  RATE_HINT,
  CURRENCIES,
  formatMoney,
  type FeeType,
  type FeeCalcMethod,
  type WalletCurrency,
} from "@/lib/fee-constants";

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[10px] text-steel-light">{hint}</span> : null}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{msg}</div>
  );
}

function buildScope(channel: string, currency: string, accountKind: string, country: string) {
  const scope: Record<string, unknown> = {};
  if (channel.trim()) scope.channel = channel.trim();
  if (currency.trim()) scope.currency = currency.trim();
  if (accountKind.trim()) scope.account_kind = accountKind.trim();
  if (country.trim()) scope.country = country.trim().toUpperCase();
  return scope;
}

// ---------------------------------------------------------------------------
// Fee simulator — read-only, no writes. Staff-callable.
// ---------------------------------------------------------------------------
export function FeeSimulator() {
  const [feeType, setFeeType] = useState<FeeType>("deposit");
  const [baseAmount, setBaseAmount] = useState("100");
  const [lots, setLots] = useState("1");
  const [channel, setChannel] = useState("");
  const [currency, setCurrency] = useState("");
  const [accountKind, setAccountKind] = useState("");
  const [country, setCountry] = useState("");
  const [quote, setQuote] = useState<FeeQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setQuote(null);
    startTransition(async () => {
      const res = await simulateFee({
        fee_type: feeType,
        base_amount: Number(baseAmount) || 0,
        lots: Number(lots) || 0,
        scope: buildScope(channel, currency, accountKind, country),
      });
      if (res.ok && res.data) setQuote(res.data);
      else if (!res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={run} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fee type">
          <select value={feeType} onChange={(e) => setFeeType(e.target.value as FeeType)} className={inputCls}>
            {FEE_TYPES.map((t) => (
              <option key={t} value={t}>
                {FEE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Base amount">
            <input value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} className={inputCls} inputMode="decimal" />
          </Field>
          <Field label="Lots">
            <input value={lots} onChange={(e) => setLots(e.target.value)} className={inputCls} inputMode="decimal" />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Field label="Channel"><input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="card" className={inputCls} /></Field>
        <Field label="Currency"><input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" className={inputCls} /></Field>
        <Field label="Acct kind"><input value={accountKind} onChange={(e) => setAccountKind(e.target.value)} placeholder="live" className={inputCls} /></Field>
        <Field label="Country"><input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="IN" className={inputCls} /></Field>
      </div>

      <ErrorBox msg={error} />

      <div className="flex items-center gap-3">
        <Button variant="primary" type="submit" disabled={pending}>
          <Calculator size={16} className="mr-1.5" /> {pending ? "Computing…" : "Simulate"}
        </Button>
        {quote ? (
          <div className="text-sm">
            {quote.matched ? (
              <span>
                <span className="font-semibold text-navy">{formatMoney(quote.amount, quote.currency)}</span>{" "}
                <span className="text-steel">
                  · {quote.is_rebate ? "rebate" : "fee"} · {quote.calc_method ? CALC_METHOD_LABEL[quote.calc_method] : "—"}
                </span>
              </span>
            ) : (
              <span className="text-amber-600">No schedule matched — zero fee.</span>
            )}
          </div>
        ) : null}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Charge a fee manually (applies + posts journal + optional wallet move).
// ---------------------------------------------------------------------------
export function ChargeFeeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [feeType, setFeeType] = useState<FeeType>("withdrawal");
  const [baseAmount, setBaseAmount] = useState("0");
  const [lots, setLots] = useState("0");
  const [override, setOverride] = useState("");
  const [userId, setUserId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [moveWallet, setMoveWallet] = useState(false);
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await chargeFeeManual({
        fee_type: feeType,
        base_amount: Number(baseAmount) || 0,
        lots: Number(lots) || 0,
        override_amount: override.trim() ? Number(override) : null,
        user_id: userId.trim() || null,
        wallet_id: walletId.trim() || null,
        move_wallet: moveWallet,
        notes: notes.trim() || undefined,
      });
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
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Receipt size={16} className="mr-1.5" /> Charge fee
      </Button>
    );
  }

  return (
    <Modal title="Charge a fee / rebate" onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fee type">
            <select value={feeType} onChange={(e) => setFeeType(e.target.value as FeeType)} className={inputCls}>
              {FEE_TYPES.map((t) => (
                <option key={t} value={t}>{FEE_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </Field>
          <Field label="Override amount" hint="Leave blank to resolve from schedule">
            <input value={override} onChange={(e) => setOverride(e.target.value)} className={inputCls} inputMode="decimal" placeholder="auto" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Base amount"><input value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} className={inputCls} inputMode="decimal" /></Field>
          <Field label="Lots"><input value={lots} onChange={(e) => setLots(e.target.value)} className={inputCls} inputMode="decimal" /></Field>
        </div>
        <Field label="Client user ID" hint="UUID of the profile being charged (optional)">
          <input value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls} placeholder="00000000-…" />
        </Field>
        <Field label="Wallet ID" hint="UUID of the wallet to debit/credit (optional)">
          <input value={walletId} onChange={(e) => setWalletId(e.target.value)} className={inputCls} placeholder="00000000-…" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-steel">
          <input type="checkbox" checked={moveWallet} onChange={(e) => setMoveWallet(e.target.checked)} />
          Move the wallet balance (requires a wallet ID)
        </label>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="Why this fee is being applied…" />
        </Field>

        <ErrorBox msg={error} />
        <p className="text-[11px] text-steel-light">
          Posts a balanced double-entry journal automatically. Idempotent per submission.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={pending}>{pending ? "Charging…" : "Charge"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// New schedule (admin)
// ---------------------------------------------------------------------------
export function NewScheduleButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [precedence, setPrecedence] = useState("100");
  const [description, setDescription] = useState("");
  const [channel, setChannel] = useState("");
  const [currency, setCurrency] = useState("");
  const [accountKind, setAccountKind] = useState("");
  const [country, setCountry] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createFeeSchedule({
        code,
        name,
        precedence: Number(precedence) || 100,
        description,
        scope: buildScope(channel, currency, accountKind, country),
      });
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
        <Plus size={16} className="mr-1.5" /> New schedule
      </Button>
    );
  }

  return (
    <Modal title="New fee schedule" onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code *"><input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="vip_tier1" autoFocus /></Field>
          <Field label="Precedence" hint="Lower wins"><input value={precedence} onChange={(e) => setPrecedence(e.target.value)} className={inputCls} inputMode="numeric" /></Field>
        </div>
        <Field label="Name *"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="VIP Tier 1 pricing" /></Field>
        <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} /></Field>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-steel-light">Scope (all optional — empty = global)</div>
          <div className="grid grid-cols-4 gap-2">
            <Field label="Channel"><input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="card" className={inputCls} /></Field>
            <Field label="Currency"><input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" className={inputCls} /></Field>
            <Field label="Acct kind"><input value={accountKind} onChange={(e) => setAccountKind(e.target.value)} placeholder="live" className={inputCls} /></Field>
            <Field label="Country"><input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="IN" className={inputCls} /></Field>
          </div>
        </div>

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
// New rule (admin) — bound to a schedule
// ---------------------------------------------------------------------------
export function NewRuleButton({ schedules }: { schedules: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [scheduleId, setScheduleId] = useState(schedules[0]?.id ?? "");
  const [feeType, setFeeType] = useState<FeeType>("deposit");
  const [calcMethod, setCalcMethod] = useState<FeeCalcMethod>("percentage");
  const [rate, setRate] = useState("0");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [currency, setCurrency] = useState<WalletCurrency>("USD");
  const [isRebate, setIsRebate] = useState(false);
  const [priority, setPriority] = useState("100");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createFeeRule({
        schedule_id: scheduleId,
        fee_type: feeType,
        calc_method: calcMethod,
        rate: Number(rate) || 0,
        min_amount: minAmount.trim() ? Number(minAmount) : null,
        max_amount: maxAmount.trim() ? Number(maxAmount) : null,
        currency,
        is_rebate: isRebate,
        priority: Number(priority) || 100,
      });
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
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={schedules.length === 0}>
        <Plus size={16} className="mr-1.5" /> Add rule
      </Button>
    );
  }

  return (
    <Modal title="New fee rule" onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Schedule *">
          <select value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} className={inputCls}>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fee type">
            <select value={feeType} onChange={(e) => setFeeType(e.target.value as FeeType)} className={inputCls}>
              {FEE_TYPES.map((t) => <option key={t} value={t}>{FEE_TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="Method">
            <select value={calcMethod} onChange={(e) => setCalcMethod(e.target.value as FeeCalcMethod)} className={inputCls}>
              {CALC_METHODS.map((m) => <option key={m} value={m}>{CALC_METHOD_LABEL[m]}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Rate" hint={RATE_HINT[calcMethod]}>
          <input value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} inputMode="decimal" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Min amount"><input value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className={inputCls} inputMode="decimal" placeholder="none" /></Field>
          <Field label="Max amount"><input value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className={inputCls} inputMode="decimal" placeholder="none" /></Field>
          <Field label="Currency">
            <select value={currency} onChange={(e) => setCurrency(e.target.value as WalletCurrency)} className={inputCls}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-steel">
            <input type="checkbox" checked={isRebate} onChange={(e) => setIsRebate(e.target.checked)} />
            This is a rebate (negative / payout)
          </label>
          <div className="w-24">
            <Field label="Priority"><input value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls} inputMode="numeric" /></Field>
          </div>
        </div>

        <ErrorBox msg={error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={pending}>{pending ? "Adding…" : "Add rule"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Toggle a rule active/inactive (admin) — inline button
// ---------------------------------------------------------------------------
export function RuleActiveToggle({ ruleId, active }: { ruleId: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setFeeRuleActive(ruleId, !active);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        active
          ? "inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100"
          : "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-steel transition hover:bg-slate-100"
      }
      title={active ? "Active — click to disable" : "Disabled — click to enable"}
    >
      <Power size={12} /> {active ? "Active" : "Off"}
    </button>
  );
}
