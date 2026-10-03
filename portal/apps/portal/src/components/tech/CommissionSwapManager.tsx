"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeCommission, computeSwap } from "@gio4x/pricing-core";
import { resolveRow } from "@gio4x/scope-engine";
import type { CommissionConfigRow, SwapConfigRow, PricingContext } from "@gio4x/pricing-core";
import { Plus, Power, Trash2, Loader2, Coins, CalendarClock, FlaskConical } from "lucide-react";
import { upsertCommission, toggleCommission, deleteCommission, upsertSwap, toggleSwap, deleteSwap } from "@/lib/pricing-actions";

const SCOPES = ["global", "asset_class", "symbol", "trading_group", "white_label", "country", "account_type", "account"];
const MODELS = ["fixed", "per_lot", "percentage", "volume_based"];
const UNITS = ["points", "pips", "percent", "absolute"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ctxOf(o: Partial<PricingContext>): PricingContext {
  return { accountId: "calc", accountType: "vip", clientGroup: "cg", tradingGroup: o.tradingGroup || "g", whiteLabel: "gio4x", country: "IN", symbol: o.symbol || "EURUSD", assetClass: o.assetClass || "forex", segment: o.segment };
}

export function CommissionSwapManager({ commission, swap }: { commission: CommissionConfigRow[]; swap: SwapConfigRow[] }) {
  // live calc
  const [calc, setCalc] = useState({ symbol: "EURUSD", assetClass: "forex", lots: "1", notional: "100000", side: "long", weekday: "3" });
  const setC = (k: string, v: string) => setCalc((p) => ({ ...p, [k]: v }));
  const inp = "rounded border tech-border tech-panel px-2 py-1 text-xs";

  const comm = computeCommission(ctxOf({ symbol: calc.symbol, assetClass: calc.assetClass }), commission, Number(calc.lots), Number(calc.notional));
  const swapByScope = new Map(swap.filter((s) => s.enabled).map((s) => [`${s.scopeType}:${s.scopeRef ?? "*"}`, s]));
  const swapRow = resolveRow<SwapConfigRow>(ctxOf({ symbol: calc.symbol, assetClass: calc.assetClass }), (st, ref) => swapByScope.get(`${st}:${ref ?? "*"}`) ?? null);
  const swapVal = swapRow ? computeSwap(calc.side as "long" | "short", swapRow.row, Number(calc.lots), Number(calc.weekday)) : null;

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2"><Coins size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Commission &amp; Swap</h2><span className="text-[11px] tech-muted">— per-scope models · most-specific wins</span></div>

      {/* live calc */}
      <div className="tech-panel2 mb-4 rounded-lg border tech-border p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tech-muted"><FlaskConical size={12} /> Live calc</div>
        <div className="flex flex-wrap items-end gap-2 text-[10px] uppercase tech-muted">
          <label>Symbol<input value={calc.symbol} onChange={(e) => setC("symbol", e.target.value)} className={inp + " ml-1 w-24"} /></label>
          <label>Asset<input value={calc.assetClass} onChange={(e) => setC("assetClass", e.target.value)} className={inp + " ml-1 w-20"} /></label>
          <label>Lots<input value={calc.lots} onChange={(e) => setC("lots", e.target.value)} className={inp + " ml-1 w-16"} /></label>
          <label>Notional<input value={calc.notional} onChange={(e) => setC("notional", e.target.value)} className={inp + " ml-1 w-24"} /></label>
          <label>Side<select value={calc.side} onChange={(e) => setC("side", e.target.value)} className={inp + " ml-1"}><option value="long">long</option><option value="short">short</option></select></label>
          <label>Rollover day<select value={calc.weekday} onChange={(e) => setC("weekday", e.target.value)} className={inp + " ml-1"}>{WD.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></label>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          <div>commission: <span className="font-mono tech-accent">${comm.amountUsd.toFixed(2)}</span> <span className="tech-muted">({comm.perSide ? "per side" : "round-turn"})</span></div>
          <div>swap ({calc.side}): <span className={`font-mono ${swapVal != null && swapVal < 0 ? "text-rose-300" : "tech-accent"}`}>{swapVal != null ? swapVal.toFixed(2) : "—"}</span> {Number(calc.weekday) === (swapRow?.row.tripleDay ?? -1) && <span className="text-[10px] text-amber-300">×3 day</span>}</div>
        </div>
      </div>

      <CommissionList rows={commission} />
      <div className="mt-4"><SwapList rows={swap} /></div>
    </div>
  );
}

function CommissionList({ rows }: { rows: CommissionConfigRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ scope_type: "symbol", scope_ref: "", model: "per_lot", value: "7", per_side: "true", currency: "USD" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const inp = "rounded border tech-border tech-panel2 px-2 py-1 text-xs";
  function add() {
    setErr(null);
    start(async () => { const r = await upsertCommission({ ...f, value: Number(f.value), per_side: f.per_side === "true" }); if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error); });
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tech-muted">Commission</h3>
        <button onClick={() => { setOpen(!open); setErr(null); }} className="inline-flex items-center gap-1 rounded border tech-border tech-panel2 px-2 py-1 text-[11px] tech-muted hover:tech-accent"><Plus size={12} /> Add</button></div>
      {open && (
        <div className="tech-panel2 mb-3 flex flex-wrap gap-2 rounded-lg border tech-border p-3">
          <select value={f.scope_type} onChange={(e) => set("scope_type", e.target.value)} className={inp}>{SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.scope_ref} onChange={(e) => set("scope_ref", e.target.value)} placeholder="scope ref" className={inp + " w-28"} />
          <select value={f.model} onChange={(e) => set("model", e.target.value)} className={inp}>{MODELS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.value} onChange={(e) => set("value", e.target.value)} placeholder="value" className={inp + " w-20"} />
          <select value={f.per_side} onChange={(e) => set("per_side", e.target.value)} className={inp}><option value="true">per side</option><option value="false">round-turn</option></select>
          <button onClick={add} disabled={pending} className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">{pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save</button>
          {err && <div className="w-full text-[11px] text-rose-400">{err}</div>}
        </div>
      )}
      <table className="w-full text-xs"><thead><tr className="border-b tech-border text-left tech-muted"><th className="py-1.5 pr-3">Scope</th><th className="py-1.5 pr-3">Model</th><th className="py-1.5 pr-3 text-right">Value</th><th className="py-1.5 pr-3">Charge</th><th className="py-1.5 pr-3 text-right"></th></tr></thead>
        <tbody>{rows.map((c) => <CRow key={c.id} c={c} />)}{rows.length === 0 && <tr><td colSpan={5} className="py-3 text-center tech-muted">No commission config.</td></tr>}</tbody></table>
    </div>
  );
}
function CRow({ c }: { c: CommissionConfigRow }) {
  const router = useRouter(); const [on, setOn] = useState(c.enabled); const [pending, start] = useTransition();
  return (
    <tr className={`border-b tech-border last:border-0 ${on ? "" : "opacity-50"}`}>
      <td className="py-1.5 pr-3 font-medium">{c.scopeType}{c.scopeRef ? `: ${c.scopeRef}` : ""}</td>
      <td className="py-1.5 pr-3 tech-muted">{c.model}</td>
      <td className="py-1.5 pr-3 text-right font-mono">{c.value} {c.currency}</td>
      <td className="py-1.5 pr-3 tech-muted">{c.perSide ? "per side" : "round-turn"}</td>
      <td className="py-1.5 pr-3"><div className="flex items-center justify-end gap-1.5">
        <button disabled={pending} onClick={() => start(async () => { const r = await toggleCommission(c.id, !on); if (r.ok) { setOn(!on); router.refresh(); } })} className="rounded p-1 tech-muted hover:text-amber-400"><Power size={13} /></button>
        <button disabled={pending} onClick={() => { if (confirm("Delete?")) start(async () => { await deleteCommission(c.id); router.refresh(); }); }} className="rounded p-1 tech-muted hover:text-rose-400"><Trash2 size={13} /></button>
      </div></td>
    </tr>
  );
}

function SwapList({ rows }: { rows: SwapConfigRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ scope_type: "symbol", scope_ref: "EURUSD", long_rate: "-2", short_rate: "0.5", triple_day: "3", unit: "points" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const inp = "rounded border tech-border tech-panel2 px-2 py-1 text-xs";
  function add() {
    setErr(null);
    start(async () => { const r = await upsertSwap({ ...f, long_rate: Number(f.long_rate), short_rate: Number(f.short_rate), triple_day: Number(f.triple_day) }); if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error); });
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1 text-xs font-semibold uppercase tech-muted"><CalendarClock size={12} /> Swap (overnight)</h3>
        <button onClick={() => { setOpen(!open); setErr(null); }} className="inline-flex items-center gap-1 rounded border tech-border tech-panel2 px-2 py-1 text-[11px] tech-muted hover:tech-accent"><Plus size={12} /> Add</button></div>
      {open && (
        <div className="tech-panel2 mb-3 flex flex-wrap gap-2 rounded-lg border tech-border p-3">
          <select value={f.scope_type} onChange={(e) => set("scope_type", e.target.value)} className={inp}>{["symbol", "asset_class", "global"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.scope_ref} onChange={(e) => set("scope_ref", e.target.value)} placeholder="symbol/asset" className={inp + " w-24"} />
          <input value={f.long_rate} onChange={(e) => set("long_rate", e.target.value)} placeholder="long" className={inp + " w-16"} />
          <input value={f.short_rate} onChange={(e) => set("short_rate", e.target.value)} placeholder="short" className={inp + " w-16"} />
          <select value={f.triple_day} onChange={(e) => set("triple_day", e.target.value)} className={inp} title="triple-charge weekday">{WD.map((d, i) => <option key={i} value={i}>{d} ×3</option>)}</select>
          <select value={f.unit} onChange={(e) => set("unit", e.target.value)} className={inp}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
          <button onClick={add} disabled={pending} className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">{pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save</button>
          {err && <div className="w-full text-[11px] text-rose-400">{err}</div>}
        </div>
      )}
      <table className="w-full text-xs"><thead><tr className="border-b tech-border text-left tech-muted"><th className="py-1.5 pr-3">Scope</th><th className="py-1.5 pr-3 text-right">Long</th><th className="py-1.5 pr-3 text-right">Short</th><th className="py-1.5 pr-3">3× day</th><th className="py-1.5 pr-3 text-right"></th></tr></thead>
        <tbody>{rows.map((s) => <SRow key={s.id} s={s} />)}{rows.length === 0 && <tr><td colSpan={5} className="py-3 text-center tech-muted">No swap config.</td></tr>}</tbody></table>
    </div>
  );
}
function SRow({ s }: { s: SwapConfigRow }) {
  const router = useRouter(); const [on, setOn] = useState(s.enabled); const [pending, start] = useTransition();
  return (
    <tr className={`border-b tech-border last:border-0 ${on ? "" : "opacity-50"}`}>
      <td className="py-1.5 pr-3 font-medium">{s.scopeType}{s.scopeRef ? `: ${s.scopeRef}` : ""}</td>
      <td className={`py-1.5 pr-3 text-right font-mono ${s.longRate < 0 ? "text-rose-300" : ""}`}>{s.longRate} {s.unit}</td>
      <td className={`py-1.5 pr-3 text-right font-mono ${s.shortRate < 0 ? "text-rose-300" : ""}`}>{s.shortRate}</td>
      <td className="py-1.5 pr-3 tech-muted">{WD[s.tripleDay] ?? s.tripleDay}</td>
      <td className="py-1.5 pr-3"><div className="flex items-center justify-end gap-1.5">
        <button disabled={pending} onClick={() => start(async () => { const r = await toggleSwap(s.id, !on); if (r.ok) { setOn(!on); router.refresh(); } })} className="rounded p-1 tech-muted hover:text-amber-400"><Power size={13} /></button>
        <button disabled={pending} onClick={() => { if (confirm("Delete?")) start(async () => { await deleteSwap(s.id); router.refresh(); }); }} className="rounded p-1 tech-muted hover:text-rose-400"><Trash2 size={13} /></button>
      </div></td>
    </tr>
  );
}
