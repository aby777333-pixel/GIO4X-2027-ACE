"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { upsertSecurityRule, toggleSecurityRule, deleteSecurityRule } from "@/lib/tech-hub-actions";
import type { SecurityRule } from "@/lib/tech-hub-console";

const KINDS = [
  { k: "ip_allow", label: "IP allow" },
  { k: "ip_block", label: "IP block" },
  { k: "geo_block", label: "Geo block (country)" },
  { k: "mfa_policy", label: "MFA policy" },
];

export function SecurityManager({ rules }: { rules: SecurityRule[] }) {
  const router = useRouter();
  const [kind, setKind] = useState("ip_allow");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setErr(null);
    if (!value.trim()) { setErr("Value required."); return; }
    start(async () => { const r = await upsertSecurityRule({ kind, value: value.trim(), note: note.trim() }); if (r.ok) { setValue(""); setNote(""); router.refresh(); } else setErr(r.error); });
  }

  const inp = "rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs";
  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2"><ShieldCheck size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Access &amp; Security Rules</h2></div>
      <div className="tech-panel2 mb-4 grid gap-2 rounded-lg border tech-border p-3 sm:grid-cols-[160px_1fr_1fr_auto]">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={inp}>{KINDS.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</select>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 203.0.113.0/24, IN, required" className={inp} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={inp} />
        <button onClick={add} disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />} Add</button>
      </div>
      {err && <div className="mb-2 text-[11px] text-rose-400">{err}</div>}
      <table className="w-full text-xs">
        <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Kind</th><th className="py-2 pr-3">Value</th><th className="py-2 pr-3">Note</th><th className="py-2 pr-3">Enabled</th><th className="py-2 pr-3 text-right"></th></tr></thead>
        <tbody>
          {rules.map((r) => <RuleRow key={r.id} r={r} />)}
          {rules.length === 0 && <tr><td colSpan={5} className="py-6 text-center tech-muted">No rules yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function RuleRow({ r }: { r: SecurityRule }) {
  const router = useRouter();
  const [on, setOn] = useState(r.enabled);
  const [pending, start] = useTransition();
  return (
    <tr className="border-b tech-border last:border-0">
      <td className="py-2 pr-3 uppercase tech-muted">{r.kind.replace("_", " ")}</td>
      <td className="py-2 pr-3 font-mono">{r.value}</td>
      <td className="py-2 pr-3 tech-muted">{r.note}</td>
      <td className="py-2 pr-3">
        <button disabled={pending} onClick={() => start(async () => { const x = await toggleSecurityRule(r.id, !on); if (x.ok) setOn(!on); router.refresh(); })} className={`relative inline-flex h-5 w-9 items-center rounded-full ${on ? "bg-emerald-500" : "bg-slate-600"}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${on ? "translate-x-4" : "translate-x-1"}`} /></button>
      </td>
      <td className="py-2 pr-3 text-right"><button disabled={pending} onClick={() => { if (confirm("Delete rule?")) start(async () => { await deleteSecurityRule(r.id); router.refresh(); }); }} className="rounded p-1 tech-muted hover:text-rose-400"><Trash2 size={13} /></button></td>
    </tr>
  );
}
