"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Power, X, Loader2, Lock, Cable } from "lucide-react";
import { upsertBridge, setBridgeStatus, deleteBridge } from "@/lib/tech-hub-actions";
import type { Bridge } from "@/lib/tech-hub-console";

const KINDS = ["mt5", "mt4", "proprietary", "lp", "payment", "banking", "crm", "kyc", "webhook", "custom"];
const CATEGORIES = ["trading", "liquidity", "payments", "data", "custom"];
const DIRECTIONS = ["inbound", "outbound", "bidirectional"];

const STATUS_CLS: Record<string, string> = {
  active: "text-emerald-400", configured: "text-sky-400", disabled: "text-slate-400", error: "text-rose-400",
};

type Draft = { id?: string; name: string; kind: string; category: string; direction: string; endpoint: string; config: string };
const EMPTY: Draft = { name: "", kind: "custom", category: "trading", direction: "bidirectional", endpoint: "", config: "{}" };

export function BridgeManager({ bridges }: { bridges: Bridge[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function edit(b: Bridge) {
    setDraft({
      id: b.id, name: b.name, kind: b.kind, category: b.category, direction: b.direction,
      endpoint: b.endpoint ?? "", config: JSON.stringify(b.config ?? {}, null, 2),
    });
    setErr(null);
    setOpen(true);
  }
  function neu() { setDraft(EMPTY); setErr(null); setOpen(true); }

  function save() {
    setErr(null);
    let config: Record<string, unknown> = {};
    if (draft.config.trim()) {
      try { config = JSON.parse(draft.config); } catch { setErr("Config must be valid JSON."); return; }
    }
    if (!draft.name.trim()) { setErr("Name is required."); return; }
    start(async () => {
      const r = await upsertBridge({ id: draft.id, name: draft.name.trim(), kind: draft.kind, category: draft.category, direction: draft.direction, endpoint: draft.endpoint.trim(), config });
      if (r.ok) { setOpen(false); setDraft(EMPTY); router.refresh(); }
      else setErr(r.error);
    });
  }
  function toggle(b: Bridge) {
    start(async () => { await setBridgeStatus(b.id, b.status === "disabled" ? "active" : "disabled"); router.refresh(); });
  }
  function remove(b: Bridge) {
    if (!confirm(`Delete bridge "${b.name}"? This cannot be undone.`)) return;
    start(async () => { await deleteBridge(b.id); router.refresh(); });
  }

  const sel = "rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs";

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cable size={16} className="tech-accent" />
          <h2 className="text-sm font-semibold">Bridges &amp; Connectors</h2>
          <span className="text-[11px] tech-muted">— build your own or standard bridges, any time</span>
        </div>
        <button onClick={neu} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500">
          <Plus size={14} /> New Bridge
        </button>
      </div>

      {open && (
        <div className="tech-panel2 mb-4 rounded-lg border tech-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold">{draft.id ? "Edit bridge" : "Create bridge"}</span>
            <button onClick={() => setOpen(false)} className="tech-muted hover:opacity-70"><X size={15} /></button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Bridge name" className={sel + " sm:col-span-2"} />
            <label className="text-[11px] tech-muted">Type
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className={sel + " mt-1 block w-full uppercase"}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="text-[11px] tech-muted">Category
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={sel + " mt-1 block w-full capitalize"}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-[11px] tech-muted">Direction
              <select value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value })} className={sel + " mt-1 block w-full capitalize"}>
                {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <input value={draft.endpoint} onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })} placeholder="Endpoint / host (optional)" className={sel} />
            <label className="text-[11px] tech-muted sm:col-span-2">Config (JSON)
              <textarea value={draft.config} onChange={(e) => setDraft({ ...draft, config: e.target.value })} rows={4} className={sel + " mt-1 block w-full font-mono"} />
            </label>
          </div>
          {err && <div className="mt-2 text-[11px] text-rose-400">{err}</div>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg border tech-border px-3 py-1.5 text-xs tech-muted">Cancel</button>
            <button onClick={save} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              {pending ? <Loader2 size={13} className="animate-spin" /> : null} {draft.id ? "Save" : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b tech-border text-left tech-muted">
              <th className="py-2 pr-3">Bridge</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Direction</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bridges.map((b) => (
              <tr key={b.id} className="border-b tech-border last:border-0">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5 font-medium">{b.name} {b.is_system && <Lock size={11} className="tech-muted" />}</div>
                  {b.endpoint && <div className="font-mono text-[10px] tech-muted">{b.endpoint}</div>}
                </td>
                <td className="py-2 pr-3 uppercase tech-muted">{b.kind}</td>
                <td className="py-2 pr-3 capitalize tech-muted">{b.category}</td>
                <td className="py-2 pr-3 capitalize tech-muted">{b.direction}</td>
                <td className="py-2 pr-3"><span className={STATUS_CLS[b.status] ?? ""}>{b.status}</span></td>
                <td className="py-2 pr-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => edit(b)} title="Edit" className="rounded p-1 tech-muted hover:tech-accent"><Pencil size={13} /></button>
                    {!b.is_system && (
                      <>
                        <button onClick={() => toggle(b)} title={b.status === "disabled" ? "Enable" : "Disable"} className="rounded p-1 tech-muted hover:text-amber-400"><Power size={13} /></button>
                        <button onClick={() => remove(b)} title="Delete" className="rounded p-1 tech-muted hover:text-rose-400"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
