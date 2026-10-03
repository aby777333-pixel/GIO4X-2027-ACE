"use client";

// §24 Account types editor — admins tune the plans clients can open (leverage,
// min deposit, spread, commission) without code. Writes via admin-gated actions.

import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Pencil, Plus, Check } from "lucide-react";
import {
  upsertAccountType, setAccountTypeActive, type AccountTypeRow,
} from "@/lib/account-type-actions";

function Form({ initial, onDone, onCancel }: { initial?: AccountTypeRow; onDone: (m: string) => void; onCancel?: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [lev, setLev] = useState(String(initial?.leverage ?? 500));
  const [min, setMin] = useState(String(initial?.min_deposit ?? 0));
  const [cur, setCur] = useState(initial?.base_currency ?? "USD");
  const [spread, setSpread] = useState(initial?.spread_from ?? "");
  const [comm, setComm] = useState(initial?.commission ?? "");
  const [sort, setSort] = useState(String(initial?.sort ?? 0));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => start(async () => {
    setErr(null);
    const r = await upsertAccountType({
      id: initial?.id, name, leverage: Number(lev), minDeposit: Number(min),
      baseCurrency: cur, spreadFrom: spread, commission: comm, sort: Number(sort) || 0,
    });
    if (r.ok) onDone(initial ? `“${name}” updated` : `“${name}” created`);
    else setErr(r.error ?? "Save failed.");
  });

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <L label="Plan name"><input value={name} onChange={(e) => setName(e.target.value)} className={inp + " w-36"} /></L>
        <L label="Leverage 1:"><input value={lev} onChange={(e) => setLev(e.target.value)} inputMode="numeric" className={inp + " w-20 text-right font-mono"} /></L>
        <L label="Min deposit"><input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" className={inp + " w-24 text-right font-mono"} /></L>
        <L label="Currency"><input value={cur} onChange={(e) => setCur(e.target.value.toUpperCase())} className={inp + " w-20"} /></L>
        <L label="Spread from"><input value={spread} onChange={(e) => setSpread(e.target.value)} className={inp + " w-24"} /></L>
        <L label="Commission"><input value={comm} onChange={(e) => setComm(e.target.value)} className={inp + " w-24"} /></L>
        <L label="Sort"><input value={sort} onChange={(e) => setSort(e.target.value)} inputMode="numeric" className={inp + " w-14 text-right font-mono"} /></L>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {err && <span className="text-[11px] text-danger">{err}</span>}
        <div className="ml-auto flex gap-2">
          {onCancel && <button onClick={onCancel} disabled={pending} className="rounded px-3 py-1.5 text-[11px] font-semibold text-steel disabled:opacity-40">Cancel</button>}
          <button onClick={submit} disabled={pending || !name.trim()} className="flex items-center gap-1 rounded bg-sky px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">
            {initial ? <Check size={12} /> : <Plus size={12} />} {initial ? "Save" : "Add plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = "mt-0.5 block rounded border border-steel/25 px-2 py-1 text-[12px] text-navy outline-none focus:border-sky";
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-[10px] uppercase tracking-wide text-steel">{label}{children}</label>;
}

export function AccountTypesClient({ rows }: { rows: AccountTypeRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const done = (m: string) => { setNotice(`Saved: ${m}`); setEditing(null); setCreating(false); };
  const toggle = (r: AccountTypeRow) => start(async () => {
    const res = await setAccountTypeActive(r.id, !r.active);
    setNotice(res.ok ? `${r.name} ${!r.active ? "activated" : "deactivated"}` : (res.error ?? "Update failed"));
  });

  return (
    <div className="space-y-3">
      {notice && <div className="rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-[12px] text-success">{notice}</div>}
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-steel/25 text-[10px] uppercase tracking-wide text-steel">
            <th className="px-2 py-1.5">Plan</th>
            <th className="px-2 py-1.5 text-right">Leverage</th>
            <th className="px-2 py-1.5 text-right">Min deposit</th>
            <th className="px-2 py-1.5">Spread</th>
            <th className="px-2 py-1.5">Commission</th>
            <th className="px-2 py-1.5">Status</th>
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => editing === r.id ? (
            <tr key={r.id}><td colSpan={7} className="px-1 py-2"><Form initial={r} onDone={done} onCancel={() => setEditing(null)} /></td></tr>
          ) : (
            <tr key={r.id} className="border-b border-steel/10">
              <td className="px-2 py-2 font-semibold text-navy">{r.name}</td>
              <td className="px-2 py-2 text-right font-mono text-navy">1:{r.leverage}</td>
              <td className="px-2 py-2 text-right font-mono text-navy">{r.base_currency} {Number(r.min_deposit).toLocaleString()}</td>
              <td className="px-2 py-2 text-steel">{r.spread_from ?? "—"}</td>
              <td className="px-2 py-2 text-steel">{r.commission ?? "—"}</td>
              <td className="px-2 py-2"><button onClick={() => toggle(r)} disabled={pending}><StatusBadge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</StatusBadge></button></td>
              <td className="px-2 py-2 text-right"><button onClick={() => { setEditing(r.id); setCreating(false); }} className="flex items-center gap-1 text-[11px] font-semibold text-steel hover:text-sky"><Pencil size={12} /> Edit</button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="px-2 py-6 text-center text-steel">No account types — add one below.</td></tr>}
        </tbody>
      </table>
      {creating ? <Form onDone={done} onCancel={() => setCreating(false)} /> : (
        <button onClick={() => { setCreating(true); setEditing(null); }} className="flex items-center gap-1 rounded border border-sky/40 px-3 py-1.5 text-[12px] font-bold text-sky hover:bg-sky/5">
          <Plus size={13} /> New account type
        </button>
      )}
      <p className="text-[11px] text-steel">Inactive plans are hidden from the account-open form. Clients pick from the active plans; the form falls back to the built-in list if this is ever empty.</p>
    </div>
  );
}
