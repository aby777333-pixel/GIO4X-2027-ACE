"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radio, Plus, Power, Trash2, Loader2, Route } from "lucide-react";
import { upsertLpMarkup, toggleLpMarkup, deleteLpMarkup, upsertLpRouting, toggleLpRouting, deleteLpRouting } from "@/lib/pricing-actions";
import type { LpHealthRow, RoutingRowUi } from "@/lib/pricing-terminal";
import type { LpMarkupRow } from "@gio4x/pricing-core";

const SIDES = ["buy", "sell", "dual"];
const UNITS = ["pips", "points", "percent", "absolute"];
const MODES = ["best_price", "weighted", "revenue_optimized", "risk_optimized", "latency_optimized"];
const SIDE_TONE: Record<string, string> = { buy: "text-emerald-300", sell: "text-rose-300", dual: "text-sky-300" };

export function LpMarkupManager({ lps, markup, routing }: { lps: LpHealthRow[]; markup: LpMarkupRow[]; routing: RoutingRowUi[] }) {
  const lpName = (id: string) => lps.find((l) => l.id === id)?.name ?? id.slice(0, 8);
  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2"><Radio size={16} className="tech-accent" /><h2 className="text-sm font-semibold">LP Markup &amp; Routing</h2>
        <span className="text-[11px] tech-muted">— pricing routes the <b>quote</b>; DEALER-CORE routes the <b>order</b></span></div>

      {/* shared LP health */}
      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-1.5 pr-3">Provider</th><th className="py-1.5 pr-3">Status</th><th className="py-1.5 pr-3 text-right">Priority</th><th className="py-1.5 pr-3 text-right">Reject</th><th className="py-1.5 pr-3 text-right">Fill</th></tr></thead>
          <tbody>
            {lps.map((l) => (
              <tr key={l.id} className="border-b tech-border last:border-0">
                <td className="py-1.5 pr-3 font-medium">{l.name} {l.is_primary && <span className="text-[10px] tech-accent">primary</span>}</td>
                <td className="py-1.5 pr-3"><span className={l.status === "active" ? "text-emerald-400" : l.status === "degraded" ? "text-amber-400" : "text-rose-400"}>{l.status}</span></td>
                <td className="py-1.5 pr-3 text-right tech-muted">{l.priority}</td>
                <td className="py-1.5 pr-3 text-right tech-muted">{(l.reject_rate * 100).toFixed(1)}%</td>
                <td className="py-1.5 pr-3 text-right tech-muted">{l.avg_fill_ms != null ? `${l.avg_fill_ms}ms` : "—"}</td>
              </tr>
            ))}
            {lps.length === 0 && <tr><td colSpan={5} className="py-3 text-center tech-muted">No providers.</td></tr>}
          </tbody>
        </table>
      </div>

      <MarkupList markup={markup} lps={lps} lpName={lpName} />
      <div className="mt-4"><RoutingList routing={routing} /></div>
    </div>
  );
}

function MarkupList({ markup, lps, lpName }: { markup: LpMarkupRow[]; lps: LpHealthRow[]; lpName: (id: string) => string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ lp_id: lps[0]?.id ?? "", symbols: "", side: "dual", value: "0.2", unit: "pips" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const inp = "rounded border tech-border tech-panel2 px-2 py-1 text-xs";
  function add() {
    setErr(null);
    if (!f.lp_id) { setErr("Pick an LP."); return; }
    const symbols = f.symbols.split(",").map((s) => s.trim()).filter(Boolean);
    start(async () => { const r = await upsertLpMarkup({ lp_id: f.lp_id, symbols, side: f.side, value: Number(f.value), unit: f.unit }); if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error); });
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tech-muted">LP feed markup</h3>
        <button onClick={() => { setOpen(!open); setErr(null); }} className="inline-flex items-center gap-1 rounded border tech-border tech-panel2 px-2 py-1 text-[11px] tech-muted hover:tech-accent"><Plus size={12} /> Add</button></div>
      {open && (
        <div className="tech-panel2 mb-3 flex flex-wrap gap-2 rounded-lg border tech-border p-3">
          <select value={f.lp_id} onChange={(e) => set("lp_id", e.target.value)} className={inp}>{lps.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <input value={f.symbols} onChange={(e) => set("symbols", e.target.value)} placeholder="symbols (comma, empty=all)" className={inp + " w-44"} />
          <select value={f.side} onChange={(e) => set("side", e.target.value)} className={inp}>{SIDES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.value} onChange={(e) => set("value", e.target.value)} placeholder="value" className={inp + " w-16"} />
          <select value={f.unit} onChange={(e) => set("unit", e.target.value)} className={inp}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
          <button onClick={add} disabled={pending} className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">{pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save</button>
          {err && <div className="w-full text-[11px] text-rose-400">{err}</div>}
        </div>
      )}
      <table className="w-full text-xs"><thead><tr className="border-b tech-border text-left tech-muted"><th className="py-1.5 pr-3">LP</th><th className="py-1.5 pr-3">Symbols</th><th className="py-1.5 pr-3">Side</th><th className="py-1.5 pr-3 text-right">Value</th><th className="py-1.5 pr-3 text-right"></th></tr></thead>
        <tbody>{markup.map((m) => (
          <MRow key={m.id} m={m} name={lpName(m.lpId)} />
        ))}{markup.length === 0 && <tr><td colSpan={5} className="py-3 text-center tech-muted">No LP markup.</td></tr>}</tbody></table>
    </div>
  );
}
function MRow({ m, name }: { m: LpMarkupRow; name: string }) {
  const router = useRouter(); const [on, setOn] = useState(m.enabled); const [pending, start] = useTransition();
  return (
    <tr className={`border-b tech-border last:border-0 ${on ? "" : "opacity-50"}`}>
      <td className="py-1.5 pr-3 font-medium">{name}</td>
      <td className="py-1.5 pr-3 tech-muted">{m.symbols.length ? m.symbols.join(", ") : "all"}</td>
      <td className={`py-1.5 pr-3 font-semibold ${SIDE_TONE[m.side] ?? ""}`}>{m.side}</td>
      <td className="py-1.5 pr-3 text-right font-mono">{m.value} {m.unit}</td>
      <td className="py-1.5 pr-3"><div className="flex items-center justify-end gap-1.5">
        <button disabled={pending} onClick={() => start(async () => { const r = await toggleLpMarkup(m.id, !on); if (r.ok) { setOn(!on); router.refresh(); } })} className="rounded p-1 tech-muted hover:text-amber-400"><Power size={13} /></button>
        <button disabled={pending} onClick={() => { if (confirm("Delete?")) start(async () => { await deleteLpMarkup(m.id); router.refresh(); }); }} className="rounded p-1 tech-muted hover:text-rose-400"><Trash2 size={13} /></button>
      </div></td>
    </tr>
  );
}

function RoutingList({ routing }: { routing: RoutingRowUi[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ scope_type: "symbol", scope_ref: "", mode: "best_price" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const inp = "rounded border tech-border tech-panel2 px-2 py-1 text-xs";
  function add() {
    setErr(null);
    start(async () => { const r = await upsertLpRouting({ ...f }); if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error); });
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1 text-xs font-semibold uppercase tech-muted"><Route size={12} /> Quote-feed routing</h3>
        <button onClick={() => { setOpen(!open); setErr(null); }} className="inline-flex items-center gap-1 rounded border tech-border tech-panel2 px-2 py-1 text-[11px] tech-muted hover:tech-accent"><Plus size={12} /> Add</button></div>
      {open && (
        <div className="tech-panel2 mb-3 flex flex-wrap gap-2 rounded-lg border tech-border p-3">
          <select value={f.scope_type} onChange={(e) => set("scope_type", e.target.value)} className={inp}>{["symbol", "asset_class", "global"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.scope_ref} onChange={(e) => set("scope_ref", e.target.value)} placeholder="symbol/asset (empty=global)" className={inp + " w-40"} />
          <select value={f.mode} onChange={(e) => set("mode", e.target.value)} className={inp}>{MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          <button onClick={add} disabled={pending} className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">{pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save</button>
          {err && <div className="w-full text-[11px] text-rose-400">{err}</div>}
        </div>
      )}
      <table className="w-full text-xs"><thead><tr className="border-b tech-border text-left tech-muted"><th className="py-1.5 pr-3">Scope</th><th className="py-1.5 pr-3">Mode</th><th className="py-1.5 pr-3 text-right"></th></tr></thead>
        <tbody>{routing.map((r) => <RRow key={r.id} r={r} />)}{routing.length === 0 && <tr><td colSpan={3} className="py-3 text-center tech-muted">No routing config.</td></tr>}</tbody></table>
    </div>
  );
}
function RRow({ r }: { r: RoutingRowUi }) {
  const router = useRouter(); const [on, setOn] = useState(r.enabled); const [pending, start] = useTransition();
  return (
    <tr className={`border-b tech-border last:border-0 ${on ? "" : "opacity-50"}`}>
      <td className="py-1.5 pr-3 font-medium">{r.scope_type}{r.scope_ref ? `: ${r.scope_ref}` : ""}</td>
      <td className="py-1.5 pr-3 tech-accent">{r.mode}</td>
      <td className="py-1.5 pr-3"><div className="flex items-center justify-end gap-1.5">
        <button disabled={pending} onClick={() => start(async () => { const x = await toggleLpRouting(r.id, !on); if (x.ok) { setOn(!on); router.refresh(); } })} className="rounded p-1 tech-muted hover:text-amber-400"><Power size={13} /></button>
        <button disabled={pending} onClick={() => { if (confirm("Delete?")) start(async () => { await deleteLpRouting(r.id); router.refresh(); }); }} className="rounded p-1 tech-muted hover:text-rose-400"><Trash2 size={13} /></button>
      </div></td>
    </tr>
  );
}
