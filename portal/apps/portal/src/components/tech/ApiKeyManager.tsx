"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Copy, KeyRound, Trash2, Power } from "lucide-react";
import { createApiKey, setApiKeyStatus, deleteApiKey } from "@/lib/tech-hub-actions";
import type { ApiKey } from "@/lib/tech-hub-console";

const SCOPES = ["read", "trade", "accounts", "reports", "admin"];

export function ApiKeyManager({ keys }: { keys: ApiKey[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [rate, setRate] = useState("1000");
  const [created, setCreated] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create() {
    setErr(null);
    start(async () => {
      const r = await createApiKey(name.trim(), scopes, Number(rate));
      if (r.ok) { setCreated(r.fullKey); setName(""); setOpen(false); router.refresh(); }
      else setErr(r.error);
    });
  }

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2"><KeyRound size={16} className="tech-accent" /><h2 className="text-sm font-semibold">API Keys</h2></div>
        <button onClick={() => { setOpen(!open); setErr(null); }} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"><Plus size={14} /> New Key</button>
      </div>

      {created && (
        <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
          <div className="text-[11px] text-emerald-300">Copy this key now — it won&apos;t be shown again.</div>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 break-all rounded tech-panel2 px-2 py-1 text-xs">{created}</code>
            <button onClick={() => navigator.clipboard.writeText(created)} className="rounded bg-sky-600 p-1.5 text-white"><Copy size={13} /></button>
            <button onClick={() => setCreated(null)} className="tech-muted"><X size={15} /></button>
          </div>
        </div>
      )}

      {open && (
        <div className="tech-panel2 mb-4 rounded-lg border tech-border p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. Mobile App)" className="rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs" />
            <input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate limit (req/min)" className="rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SCOPES.map((s) => (
              <button key={s} onClick={() => setScopes((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])} className={`rounded px-2 py-1 text-[11px] ${scopes.includes(s) ? "bg-sky-600 text-white" : "tech-panel2 tech-border border tech-muted"}`}>{s}</button>
            ))}
          </div>
          {err && <div className="mt-2 text-[11px] text-rose-400">{err}</div>}
          <div className="mt-3 flex justify-end"><button onClick={create} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending && <Loader2 size={13} className="animate-spin" />} Generate</button></div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Key</th><th className="py-2 pr-3">Scopes</th><th className="py-2 pr-3 text-right">Rate</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3 text-right"></th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-b tech-border last:border-0">
                <td className="py-2 pr-3 font-medium">{k.name}</td>
                <td className="py-2 pr-3 font-mono tech-muted">{k.key_prefix}</td>
                <td className="py-2 pr-3 tech-muted">{(k.scopes ?? []).join(", ")}</td>
                <td className="py-2 pr-3 text-right tech-muted">{k.rate_limit}/min</td>
                <td className="py-2 pr-3"><span className={k.status === "active" ? "text-emerald-400" : k.status === "suspended" ? "text-amber-400" : "text-rose-400"}>{k.status}</span></td>
                <td className="py-2 pr-3"><KeyActions id={k.id} status={k.status} /></td>
              </tr>
            ))}
            {keys.length === 0 && <tr><td colSpan={6} className="py-6 text-center tech-muted">No API keys yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KeyActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button disabled={pending} title={status === "suspended" ? "Activate" : "Suspend"} onClick={() => start(async () => { await setApiKeyStatus(id, status === "suspended" ? "active" : "suspended"); router.refresh(); })} className="rounded p-1 tech-muted hover:text-amber-400"><Power size={13} /></button>
      <button disabled={pending} title="Delete" onClick={() => { if (confirm("Delete this key?")) start(async () => { await deleteApiKey(id); router.refresh(); }); }} className="rounded p-1 tech-muted hover:text-rose-400"><Trash2 size={13} /></button>
    </div>
  );
}
