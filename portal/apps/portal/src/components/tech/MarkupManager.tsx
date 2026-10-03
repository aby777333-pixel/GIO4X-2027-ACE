"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Power, Layers, Loader2, X } from "lucide-react";
import { upsertMarkup, toggleMarkup, deleteMarkup } from "@/lib/pricing-actions";
import type { MarkupLayerRow, EngineSettings } from "@gio4x/pricing-core";

const SCOPES = ["global", "asset_class", "symbol", "trading_group", "white_label", "country", "account_type", "account"];
const SIDES = ["buy", "sell", "dual"];
const UNITS = ["pips", "points", "percent", "absolute"];
const SIDE_TONE: Record<string, string> = { buy: "text-emerald-300", sell: "text-rose-300", dual: "text-sky-300" };

export function MarkupManager({ layers, engine }: { layers: MarkupLayerRow[]; engine?: EngineSettings }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ layer: "global", scope_ref: "", side: "dual", value: "0.5", unit: "pips", stack_order: "100" });
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const inp = "rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs";

  // Layer-stack: sum enabled pip layers per side (dual hits both). Cap shown alongside.
  const cap = engine?.maxTotalMarkupPips ?? 5;
  const pipLayers = layers.filter((l) => l.enabled && l.unit === "pips");
  const buyTotal = pipLayers.filter((l) => l.side === "buy" || l.side === "dual").reduce((s, l) => s + l.value, 0);
  const sellTotal = pipLayers.filter((l) => l.side === "sell" || l.side === "dual").reduce((s, l) => s + l.value, 0);
  const bar = (v: number) => `${Math.min((v / cap) * 100, 100)}%`;

  function add() {
    setErr(null);
    start(async () => {
      const r = await upsertMarkup({ layer: f.layer, scope_ref: f.scope_ref, side: f.side, value: Number(f.value), unit: f.unit, stack_order: Number(f.stack_order) });
      if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error);
    });
  }

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2"><Layers size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Markup Engine — layer stack</h2></div>
        <button onClick={() => { setOpen(!open); setErr(null); }} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"><Plus size={14} /> Add layer</button>
      </div>

      {/* stack summary vs cap */}
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        {([["Buy", buyTotal], ["Sell", sellTotal]] as const).map(([label, total]) => (
          <div key={label} className="tech-panel2 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs"><span className="tech-muted">{label} markup (pips)</span><span className="font-mono font-bold">{total.toFixed(2)} / {cap} cap</span></div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-slate-600/40"><div className={`h-2 rounded-full ${total >= cap ? "bg-rose-500" : "bg-sky-500"}`} style={{ width: bar(total) }} /></div>
          </div>
        ))}
      </div>

      {open && (
        <div className="tech-panel2 mb-4 grid gap-2 rounded-lg border tech-border p-3 sm:grid-cols-3 lg:grid-cols-7">
          <select value={f.layer} onChange={(e) => set("layer", e.target.value)} className={inp}>{SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.scope_ref} onChange={(e) => set("scope_ref", e.target.value)} placeholder="scope ref (e.g. EURUSD)" className={inp} />
          <select value={f.side} onChange={(e) => set("side", e.target.value)} className={inp}>{SIDES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.value} onChange={(e) => set("value", e.target.value)} placeholder="value" className={inp} />
          <select value={f.unit} onChange={(e) => set("unit", e.target.value)} className={inp}>{UNITS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.stack_order} onChange={(e) => set("stack_order", e.target.value)} placeholder="stack order" className={inp} />
          <button onClick={add} disabled={pending} className="inline-flex items-center justify-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add</button>
          {err && <div className="text-[11px] text-rose-400 sm:col-span-3 lg:col-span-7">{err}</div>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Layer</th><th className="py-2 pr-3">Scope</th><th className="py-2 pr-3">Side</th><th className="py-2 pr-3 text-right">Value</th><th className="py-2 pr-3 text-right">Stack</th><th className="py-2 pr-3 text-right">Actions</th></tr></thead>
          <tbody>
            {[...layers].sort((a, b) => a.stackOrder - b.stackOrder).map((l) => <Row key={l.id} l={l} />)}
            {layers.length === 0 && <tr><td colSpan={6} className="py-6 text-center tech-muted">No markup layers.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ l }: { l: MarkupLayerRow }) {
  const router = useRouter();
  const [on, setOn] = useState(l.enabled);
  const [pending, start] = useTransition();
  return (
    <tr className={`border-b tech-border last:border-0 ${on ? "" : "opacity-50"}`}>
      <td className="py-2 pr-3 font-medium">{l.layer}</td>
      <td className="py-2 pr-3 tech-muted">{l.scopeRef ?? "—"}</td>
      <td className={`py-2 pr-3 font-semibold ${SIDE_TONE[l.side] ?? ""}`}>{l.side}</td>
      <td className="py-2 pr-3 text-right font-mono">{l.value} {l.unit}{l.pctOfVolume != null ? ` ·${l.pctOfVolume}%vol` : ""}</td>
      <td className="py-2 pr-3 text-right tech-muted">{l.stackOrder}</td>
      <td className="py-2 pr-3">
        <div className="flex items-center justify-end gap-1.5">
          <button disabled={pending} title={on ? "Disable" : "Enable"} onClick={() => start(async () => { const r = await toggleMarkup(l.id, !on); if (r.ok) { setOn(!on); router.refresh(); } })} className="rounded p-1 tech-muted hover:text-amber-400"><Power size={13} /></button>
          <button disabled={pending} title="Delete" onClick={() => { if (confirm("Delete layer?")) start(async () => { await deleteMarkup(l.id); router.refresh(); }); }} className="rounded p-1 tech-muted hover:text-rose-400"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  );
}
