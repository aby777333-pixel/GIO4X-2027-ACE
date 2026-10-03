"use client";

// IB commission plans manager (§16) — admins define tiered rebate plans the
// engine reads: $/lot plus the share each sub-IB level keeps. Every write goes
// through the admin-gated server actions.

import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Pencil, Plus, Star, Check, X } from "lucide-react";
import {
  createCommissionPlan, updateCommissionPlan, setPlanActive, makePlanDefault,
  type CommissionPlan,
} from "@/lib/commission-plan-actions";

const pctOf = (frac: number) => `${(Number(frac) * 100).toFixed(frac * 100 % 1 === 0 ? 0 : 1)}%`;

function PlanForm({ initial, onDone, onCancel }: {
  initial?: CommissionPlan;
  onDone: (msg: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [rate, setRate] = useState(String(initial?.rate_per_lot ?? "1"));
  const [l1, setL1] = useState(String(((initial?.sub_ib_share_l1 ?? 0.15) * 100)));
  const [l2, setL2] = useState(String(((initial?.sub_ib_share_l2 ?? 0.05) * 100)));
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [makeDefault, setMakeDefault] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setErr(null);
      const payload = { name, ratePerLot: Number(rate), l1Pct: Number(l1), l2Pct: Number(l2), description: desc };
      const r = initial
        ? await updateCommissionPlan(initial.id, payload)
        : await createCommissionPlan({ ...payload, makeDefault });
      if (r.ok) onDone(initial ? `plan “${name}” updated` : `plan “${name}” created`);
      else setErr(r.error ?? "Could not save the plan.");
    });

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] uppercase tracking-wide text-steel">Plan name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gold IB"
            className="mt-0.5 block w-40 rounded border border-steel/25 px-2 py-1 text-[12px] text-navy outline-none focus:border-sky" />
        </label>
        <label className="text-[10px] uppercase tracking-wide text-steel">$ / lot
          <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal"
            className="mt-0.5 block w-20 rounded border border-steel/25 px-2 py-1 text-right font-mono text-[12px] text-navy outline-none focus:border-sky" />
        </label>
        <label className="text-[10px] uppercase tracking-wide text-steel">L1 share %
          <input value={l1} onChange={(e) => setL1(e.target.value)} inputMode="decimal"
            className="mt-0.5 block w-20 rounded border border-steel/25 px-2 py-1 text-right font-mono text-[12px] text-navy outline-none focus:border-sky" />
        </label>
        <label className="text-[10px] uppercase tracking-wide text-steel">L2 share %
          <input value={l2} onChange={(e) => setL2(e.target.value)} inputMode="decimal"
            className="mt-0.5 block w-20 rounded border border-steel/25 px-2 py-1 text-right font-mono text-[12px] text-navy outline-none focus:border-sky" />
        </label>
        <label className="flex-1 text-[10px] uppercase tracking-wide text-steel">Description
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="optional"
            className="mt-0.5 block w-full rounded border border-steel/25 px-2 py-1 text-[12px] text-navy outline-none focus:border-sky" />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {!initial && (
          <label className="flex items-center gap-1.5 text-[11px] text-steel">
            <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="accent-sky" />
            Make this the default plan
          </label>
        )}
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <button onClick={onCancel} disabled={pending} className="rounded px-3 py-1.5 text-[11px] font-semibold text-steel disabled:opacity-40">Cancel</button>
          )}
          <button onClick={submit} disabled={pending || !name.trim()}
            className="flex items-center gap-1 rounded bg-sky px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">
            {initial ? <Check size={12} /> : <Plus size={12} />} {initial ? "Save" : "Create plan"}
          </button>
        </div>
      </div>
      {err && <p className="mt-2 text-[11px] text-danger">{err}</p>}
    </div>
  );
}

export function CommissionPlansTool({ plans }: { plans: CommissionPlan[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const done = (msg: string) => { setNotice(`Saved: ${msg}`); setEditing(null); setCreating(false); };
  const toggle = (p: CommissionPlan) =>
    start(async () => {
      const r = await setPlanActive(p.id, !p.active);
      setNotice(r.ok ? `${p.name} ${!p.active ? "activated" : "deactivated"}` : (r.error ?? "Update failed"));
    });
  const setDefault = (p: CommissionPlan) =>
    start(async () => {
      const r = await makePlanDefault(p.id);
      setNotice(r.ok ? `${p.name} is now the default plan` : (r.error ?? "Update failed"));
    });

  return (
    <div className="space-y-3">
      {notice && (
        <div className="rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-[12px] text-success">{notice}</div>
      )}

      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-steel/25 text-[10px] uppercase tracking-wide text-steel">
            <th className="px-2 py-1.5">Plan</th>
            <th className="px-2 py-1.5 text-right">$ / lot</th>
            <th className="px-2 py-1.5 text-right">L1 share</th>
            <th className="px-2 py-1.5 text-right">L2 share</th>
            <th className="px-2 py-1.5">Status</th>
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            editing === p.id ? (
              <tr key={p.id}><td colSpan={6} className="px-1 py-2"><PlanForm initial={p} onDone={done} onCancel={() => setEditing(null)} /></td></tr>
            ) : (
              <tr key={p.id} className="border-b border-steel/10">
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2 font-semibold text-navy">
                    {p.name}
                    {p.is_default && <StatusBadge tone="success">default</StatusBadge>}
                  </div>
                  {p.description && <div className="text-[10px] text-steel">{p.description}</div>}
                </td>
                <td className="px-2 py-2 text-right font-mono text-navy">${Number(p.rate_per_lot).toFixed(2)}</td>
                <td className="px-2 py-2 text-right font-mono text-navy">{pctOf(p.sub_ib_share_l1)}</td>
                <td className="px-2 py-2 text-right font-mono text-navy">{pctOf(p.sub_ib_share_l2)}</td>
                <td className="px-2 py-2">
                  <button onClick={() => toggle(p)} disabled={pending}>
                    <StatusBadge tone={p.active ? "success" : "neutral"}>{p.active ? "Active" : "Inactive"}</StatusBadge>
                  </button>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center justify-end gap-2">
                    {!p.is_default && (
                      <button onClick={() => setDefault(p)} disabled={pending} title="Make default"
                        className="flex items-center gap-1 text-[11px] font-semibold text-steel hover:text-sky">
                        <Star size={12} /> Default
                      </button>
                    )}
                    <button onClick={() => { setEditing(p.id); setCreating(false); }} title="Edit"
                      className="flex items-center gap-1 text-[11px] font-semibold text-steel hover:text-sky">
                      <Pencil size={12} /> Edit
                    </button>
                  </div>
                </td>
              </tr>
            )
          ))}
          {plans.length === 0 && (
            <tr><td colSpan={6} className="px-2 py-6 text-center text-steel">No commission plans yet — create one below.</td></tr>
          )}
        </tbody>
      </table>

      {creating ? (
        <PlanForm onDone={done} onCancel={() => setCreating(false)} />
      ) : (
        <button onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-1 rounded border border-sky/40 px-3 py-1.5 text-[12px] font-bold text-sky hover:bg-sky/5">
          <Plus size={13} /> New commission plan
        </button>
      )}

      <p className="text-[11px] text-steel">
        The <b>default</b> plan applies to every IB relationship without an explicit plan. Rate is per closed lot;
        L1/L2 shares are what each sub-IB level keeps as commission rolls up the tree. Editing a plan affects future
        accruals — already-booked ledger lines are never rewritten.
      </p>
    </div>
  );
}
