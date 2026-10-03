"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Trash2, Check } from "lucide-react";
import { upsertRegistryItem, toggleRegistryItem, deleteRegistryItem } from "@/lib/tech-hub-actions";
import type { RegistryItem } from "@/lib/tech-hub-console";

export type ConfigField = { key: string; label: string; type?: "number" | "text" };

function fieldVal(cfg: Record<string, unknown>, key: string): string {
  const v = cfg?.[key];
  return v == null ? "" : String(v);
}

function Row({ item, kind, fields }: { item: RegistryItem; kind: string; fields: ConfigField[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(item.name);
  const [label, setLabel] = useState(item.label ?? "");
  const [cfg, setCfg] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, fieldVal(item.config, f.key)])));
  const [msg, setMsg] = useState<string | null>(null);
  const on = item.enabled;

  function save() {
    setMsg(null);
    const config: Record<string, unknown> = { ...item.config };
    for (const f of fields) config[f.key] = f.type === "number" ? Number(cfg[f.key]) : cfg[f.key];
    start(async () => { const r = await upsertRegistryItem({ id: item.id, kind, name, label, config }); if (r.ok) { setEdit(false); router.refresh(); } else setMsg(r.error); });
  }

  return (
    <>
      <tr className="border-b tech-border last:border-0">
        <td className="py-2 pr-3">
          <div className="font-medium">{item.name}</div>
          {item.label && <div className="text-[10px] tech-muted">{item.label}</div>}
        </td>
        <td className="py-2 pr-3">
          {fields.length > 0 && <div className="flex flex-wrap gap-x-3 gap-y-0.5 tech-muted">{fields.map((f) => <span key={f.key} className="text-[10px]"><span className="opacity-60">{f.label}:</span> {fieldVal(item.config, f.key) || "—"}</span>)}</div>}
        </td>
        <td className="py-2 pr-3">
          <button
            type="button" disabled={pending}
            onClick={() => start(async () => { const r = await toggleRegistryItem(item.id, !on); if (r.ok) router.refresh(); else setMsg(r.error); })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50 ${on ? "bg-emerald-500" : "bg-slate-600"}`}
            title={on ? "Active — click to disable" : "Disabled — click to enable"}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${on ? "translate-x-4" : "translate-x-1"}`} />
          </button>
        </td>
        <td className="py-2 pr-3 text-right">
          <button onClick={() => setEdit(!edit)} className="rounded px-1.5 py-1 text-[10px] tech-muted hover:tech-accent">Edit</button>
          <button
            type="button" disabled={pending}
            onClick={() => { if (confirm(`Delete ${item.name}?`)) start(async () => { const r = await deleteRegistryItem(item.id); if (r.ok) router.refresh(); else setMsg(r.error); }); }}
            className="rounded p-1 tech-muted hover:text-rose-400" title="Delete"
          ><Trash2 size={13} /></button>
        </td>
      </tr>
      {edit && (
        <tr className="border-b tech-border"><td colSpan={4} className="py-2">
          <div className="tech-panel2 grid gap-2 rounded-lg border tech-border p-3 sm:grid-cols-2 lg:grid-cols-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-lg border tech-border tech-panel px-2.5 py-1.5 text-xs" />
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="rounded-lg border tech-border tech-panel px-2.5 py-1.5 text-xs" />
            {fields.map((f) => <input key={f.key} value={cfg[f.key]} onChange={(e) => setCfg((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.label} className="rounded-lg border tech-border tech-panel px-2.5 py-1.5 text-xs" />)}
            <div className="flex items-center gap-2"><button onClick={save} disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save</button>{msg && <span className="text-[10px] text-rose-400">{msg}</span>}</div>
          </div>
        </td></tr>
      )}
    </>
  );
}

export function RegistryManager({ items, kind, title, fields, addLabel }: { items: RegistryItem[]; kind: string; title: string; fields: ConfigField[]; addLabel?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const inp = "rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs";

  function create() {
    setErr(null);
    if (!name.trim()) { setErr("Name is required."); return; }
    const config: Record<string, unknown> = {};
    for (const f of fields) if (cfg[f.key] !== undefined && cfg[f.key] !== "") config[f.key] = f.type === "number" ? Number(cfg[f.key]) : cfg[f.key];
    start(async () => { const r = await upsertRegistryItem({ kind, name, label, config }); if (r.ok) { setOpen(false); setName(""); setLabel(""); setCfg({}); router.refresh(); } else setErr(r.error); });
  }

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button onClick={() => { setOpen(!open); setErr(null); }} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"><Plus size={14} /> {addLabel ?? "Add"}</button>
      </div>
      {open && (
        <div className="tech-panel2 mb-4 rounded-lg border tech-border p-4">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">New entry</span><button onClick={() => setOpen(false)} className="tech-muted"><X size={15} /></button></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inp} />
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label / description" className={inp} />
            {fields.map((f) => <input key={f.key} value={cfg[f.key] ?? ""} onChange={(e) => setCfg((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.label} className={inp} />)}
          </div>
          {err && <div className="mt-2 text-[11px] text-rose-400">{err}</div>}
          <div className="mt-3 flex justify-end"><button onClick={create} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending && <Loader2 size={13} className="animate-spin" />} Create</button></div>
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-xs tech-muted">No entries yet — add one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Details</th><th className="py-2 pr-3">Enabled</th><th className="py-2 pr-3 text-right"></th></tr></thead>
            <tbody>{items.map((it) => <Row key={it.id} item={it} kind={kind} fields={fields} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
