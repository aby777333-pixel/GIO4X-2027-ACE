"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Power, Loader2, SlidersHorizontal } from "lucide-react";
import { upsertSpread, toggleSpread } from "@/lib/pricing-actions";
import type { SpreadConfigRow } from "@gio4x/pricing-core";

const SCOPES = ["global", "asset_class", "symbol", "trading_group", "white_label", "country", "account_type", "account"];
const MODES = ["fixed", "dynamic"];
const UNITS = ["pips", "points", "percent", "absolute"];

export function SpreadManager({ configs }: { configs: SpreadConfigRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ scope_type: "symbol", scope_ref: "", mode: "fixed", base_value: "1.5", unit: "pips", min_spread: "", max_spread: "", priority: "50" });
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const inp = "rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs";

  function add() {
    setErr(null);
    start(async () => {
      const r = await upsertSpread({ scope_type: f.scope_type, scope_ref: f.scope_ref, mode: f.mode, base_value: Number(f.base_value), unit: f.unit, min_spread: f.min_spread, max_spread: f.max_spread, priority: Number(f.priority) });
      if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error);
    });
  }

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2"><SlidersHorizontal size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Spread Manager</h2><span className="text-[11px] tech-muted">— most-specific scope wins</span></div>
        <button onClick={() => { setOpen(!open); setErr(null); }} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"><Plus size={14} /> Add spread</button>
      </div>

      {open && (
        <div className="tech-panel2 mb-4 grid gap-2 rounded-lg border tech-border p-3 sm:grid-cols-3 lg:grid-cols-8">
          <select value={f.scope_type} onChange={(e) => set("scope_type", e.target.value)} className={inp}>{SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.scope_ref} onChange={(e) => set("scope_ref", e.target.value)} placeholder="scope ref" className={inp} />
          <select value={f.mode} onChange={(e) => set("mode", e.target.value)} className={inp}>{MODES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.base_value} onChange={(e) => set("base_value", e.target.value)} placeholder="base" className={inp} />
          <select value={f.unit} onChange={(e) => set("unit", e.target.value)} className={inp}>{UNITS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.min_spread} onChange={(e) => set("min_spread", e.target.value)} placeholder="min" className={inp} />
          <input value={f.max_spread} onChange={(e) => set("max_spread", e.target.value)} placeholder="max" className={inp} />
          <button onClick={add} disabled={pending} className="inline-flex items-center justify-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add</button>
          {err && <div className="text-[11px] text-rose-400 sm:col-span-3 lg:col-span-8">{err}</div>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Scope</th><th className="py-2 pr-3">Mode</th><th className="py-2 pr-3 text-right">Base</th><th className="py-2 pr-3 text-right">Min/Max</th><th className="py-2 pr-3 text-right">Priority</th><th className="py-2 pr-3 text-right"></th></tr></thead>
          <tbody>
            {[...configs].sort((a, b) => a.priority - b.priority).map((c) => <Row key={c.id} c={c} />)}
            {configs.length === 0 && <tr><td colSpan={6} className="py-6 text-center tech-muted">No spread config.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ c }: { c: SpreadConfigRow }) {
  const router = useRouter();
  const [on, setOn] = useState(c.enabled);
  const [pending, start] = useTransition();
  return (
    <tr className={`border-b tech-border last:border-0 ${on ? "" : "opacity-50"}`}>
      <td className="py-2 pr-3 font-medium">{c.scopeType}{c.scopeRef ? `: ${c.scopeRef}` : ""}</td>
      <td className="py-2 pr-3 tech-muted">{c.mode}</td>
      <td className="py-2 pr-3 text-right font-mono">{c.baseValue} {c.unit}</td>
      <td className="py-2 pr-3 text-right tech-muted">{c.minSpread ?? "—"} / {c.maxSpread ?? "—"}</td>
      <td className="py-2 pr-3 text-right tech-muted">{c.priority}</td>
      <td className="py-2 pr-3 text-right">
        <button disabled={pending} title={on ? "Disable" : "Enable"} onClick={() => start(async () => { const r = await toggleSpread(c.id, !on); if (r.ok) { setOn(!on); router.refresh(); } })} className="rounded p-1 tech-muted hover:text-amber-400"><Power size={13} /></button>
      </td>
    </tr>
  );
}
