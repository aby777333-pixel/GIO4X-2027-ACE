"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Trash2, Check, CandlestickChart } from "lucide-react";
import { toggleSymbol, updateSymbol, createSymbol, deleteSymbol } from "@/lib/tech-symbols-actions";
import type { Instrument } from "@/lib/tech-symbols";

const TYPES = ["forex", "metal", "crypto", "index", "commodity", "stock"];

function Row({ s }: { s: Instrument }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [spread, setSpread] = useState(String(s.spread_markup ?? 0));
  const [comm, setComm] = useState(String(s.commission_per_lot ?? 3.5));
  const [active, setActive] = useState(s.is_active !== false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = spread !== String(s.spread_markup ?? 0);
  const dirtyComm = comm !== String(s.commission_per_lot ?? 3.5);

  return (
    <tr className="border-b tech-border last:border-0">
      <td className="py-2 pr-3">
        <div className="font-medium">{s.symbol}</div>
        <div className="text-[10px] tech-muted">{s.description}</div>
      </td>
      <td className="py-2 pr-3 uppercase tech-muted">{s.type}</td>
      <td className="py-2 pr-3">
        <button
          type="button" disabled={pending}
          onClick={() => start(async () => { const r = await toggleSymbol(s.symbol, !active); if (r.ok) { setActive(!active); router.refresh(); } else setMsg(r.error); })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50 ${active ? "bg-emerald-500" : "bg-slate-600"}`}
          title={active ? "Live — click to disable" : "Disabled — click to enable"}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${active ? "translate-x-4" : "translate-x-1"}`} />
        </button>
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1">
          <input
            value={spread} onChange={(e) => setSpread(e.target.value)}
            className="w-16 rounded border tech-border tech-panel2 px-1.5 py-1 text-xs"
          />
          {dirty && (
            <button
              type="button" disabled={pending}
              onClick={() => start(async () => { const r = await updateSymbol(s.symbol, { spread_markup: Number(spread) }); if (r.ok) router.refresh(); else setMsg(r.error); })}
              className="rounded bg-sky-600 p-1 text-white hover:bg-sky-500" title="Save spread — applies live"
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            </button>
          )}
        </div>
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1">
          <span className="tech-muted">$</span>
          <input
            value={comm} onChange={(e) => setComm(e.target.value)}
            className="w-16 rounded border tech-border tech-panel2 px-1.5 py-1 text-xs"
          />
          {dirtyComm && (
            <button
              type="button" disabled={pending}
              onClick={() => start(async () => { const r = await updateSymbol(s.symbol, { commission_per_lot: Number(comm) }); if (r.ok) router.refresh(); else setMsg(r.error); })}
              className="rounded bg-sky-600 p-1 text-white hover:bg-sky-500" title="Save commission — applies live to the order engine"
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            </button>
          )}
        </div>
      </td>
      <td className="py-2 pr-3 text-right tech-muted">{s.min_lot}–{s.max_lot}</td>
      <td className="py-2 pr-3 text-right">
        <button
          type="button" disabled={pending}
          onClick={() => { if (confirm(`Delete ${s.symbol}? (refused if it has open positions)`)) start(async () => { const r = await deleteSymbol(s.symbol); if (r.ok) router.refresh(); else setMsg(r.error); }); }}
          className="rounded p-1 tech-muted hover:text-rose-400" title="Delete symbol"
        >
          <Trash2 size={13} />
        </button>
        {msg && <div className="text-[10px] text-rose-400">{msg}</div>}
      </td>
    </tr>
  );
}

export function SymbolManager({ symbols }: { symbols: Instrument[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ symbol: "", description: "", type: "forex", pricescale: "100000", min_lot: "0.01", max_lot: "100", lot_step: "0.01", contract_size: "100000", spread_markup: "0" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const inp = "rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs";

  function create() {
    setErr(null);
    start(async () => {
      const r = await createSymbol({
        symbol: f.symbol, description: f.description, type: f.type,
        pricescale: Number(f.pricescale), min_lot: Number(f.min_lot), max_lot: Number(f.max_lot),
        lot_step: Number(f.lot_step), contract_size: Number(f.contract_size), spread_markup: Number(f.spread_markup),
      });
      if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error);
    });
  }

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CandlestickChart size={16} className="tech-accent" />
          <h2 className="text-sm font-semibold">Symbols &amp; Spreads</h2>
          <span className="text-[11px] tech-muted">— changes apply live to the trading engine</span>
        </div>
        <button onClick={() => { setOpen(!open); setErr(null); }} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500">
          <Plus size={14} /> New Symbol
        </button>
      </div>

      {open && (
        <div className="tech-panel2 mb-4 rounded-lg border tech-border p-4">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">Create symbol</span><button onClick={() => setOpen(false)} className="tech-muted"><X size={15} /></button></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={f.symbol} onChange={(e) => set("symbol", e.target.value)} placeholder="Symbol (e.g. EURGBP)" className={inp} />
            <input value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Description" className={inp + " sm:col-span-2"} />
            <select value={f.type} onChange={(e) => set("type", e.target.value)} className={inp + " capitalize"}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <input value={f.pricescale} onChange={(e) => set("pricescale", e.target.value)} placeholder="Price scale" className={inp} />
            <input value={f.contract_size} onChange={(e) => set("contract_size", e.target.value)} placeholder="Contract size" className={inp} />
            <input value={f.min_lot} onChange={(e) => set("min_lot", e.target.value)} placeholder="Min lot" className={inp} />
            <input value={f.max_lot} onChange={(e) => set("max_lot", e.target.value)} placeholder="Max lot" className={inp} />
            <input value={f.lot_step} onChange={(e) => set("lot_step", e.target.value)} placeholder="Lot step" className={inp} />
            <input value={f.spread_markup} onChange={(e) => set("spread_markup", e.target.value)} placeholder="Spread markup" className={inp} />
          </div>
          {err && <div className="mt-2 text-[11px] text-rose-400">{err}</div>}
          <div className="mt-3 flex justify-end"><button onClick={create} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending && <Loader2 size={13} className="animate-spin" />} Create</button></div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b tech-border text-left tech-muted">
              <th className="py-2 pr-3">Symbol</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Live</th>
              <th className="py-2 pr-3">Spread markup</th><th className="py-2 pr-3">Commission/lot</th><th className="py-2 pr-3 text-right">Lots</th><th className="py-2 pr-3 text-right"></th>
            </tr>
          </thead>
          <tbody>{symbols.map((s) => <Row key={s.symbol} s={s} />)}</tbody>
        </table>
      </div>
    </div>
  );
}
