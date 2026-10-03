"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Settings2, Loader2, Check, X } from "lucide-react";
import { toggleCapability, setCapabilityConfig } from "@/lib/tech-hub-actions";
import { isCapabilityLive } from "@/lib/tech-capabilities";
import type { Capability } from "@/lib/tech-hub-console";

function Row({ moduleKey, feature, state }: { moduleKey: string; feature: string; state: Capability }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState(() => JSON.stringify(state.config ?? {}, null, 2));
  const [msg, setMsg] = useState<string | null>(null);
  const live = isCapabilityLive(moduleKey, feature);
  const on = state.enabled;

  function saveConfig() {
    setMsg(null);
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(cfg || "{}"); } catch { setMsg("Invalid JSON."); return; }
    start(async () => { const r = await setCapabilityConfig(moduleKey, feature, parsed); if (r.ok) { setOpen(false); router.refresh(); } else setMsg(r.error); });
  }

  return (
    <div className={`tech-panel2 rounded-lg px-3 py-2 ${on ? "" : "opacity-60"}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-2">
          {live ? <CheckCircle2 size={14} className="shrink-0 text-emerald-400" /> : <Circle size={14} className="shrink-0 tech-muted" />}
          <span className="truncate">{feature}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${live ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}>{live ? "Live" : "Planned"}</span>
          <button onClick={() => { setOpen(!open); setMsg(null); }} className="rounded p-1 tech-muted hover:tech-accent" title="Edit settings"><Settings2 size={13} /></button>
          <button
            type="button" disabled={pending}
            onClick={() => start(async () => { const r = await toggleCapability(moduleKey, feature, !on); if (r.ok) router.refresh(); else setMsg(r.error); })}
            className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition disabled:opacity-50 ${on ? "bg-emerald-500" : "bg-slate-600"}`}
            style={{ height: "1.05rem", width: "2rem" }}
            title={on ? "Enabled — click to disable" : "Disabled — click to enable"}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${on ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </span>
      </div>
      {open && (
        <div className="mt-2 border-t tech-border pt-2">
          <label className="mb-1 block text-[10px] uppercase tech-muted">Settings (JSON)</label>
          <textarea value={cfg} onChange={(e) => setCfg(e.target.value)} spellCheck={false} rows={Math.min(8, Math.max(3, cfg.split("\n").length))} className="w-full rounded border tech-border tech-panel px-2 py-1.5 font-mono text-[11px] outline-none" />
          <div className="mt-1.5 flex items-center gap-2">
            <button onClick={saveConfig} disabled={pending} className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">{pending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save</button>
            <button onClick={() => { setOpen(false); setCfg(JSON.stringify(state.config ?? {}, null, 2)); }} className="inline-flex items-center gap-1 rounded border tech-border px-2.5 py-1 text-[11px] tech-muted"><X size={11} /> Cancel</button>
            {msg && <span className="text-[10px] text-rose-400">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function CapabilityManager({ moduleKey, features, states }: { moduleKey: string; features: string[]; states: Capability[] }) {
  const byCap = new Map(states.map((s) => [s.capability, s]));
  const liveCount = features.filter((f) => isCapabilityLive(moduleKey, f)).length;
  const onCount = features.filter((f) => byCap.get(f)?.enabled !== false).length;
  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Capabilities</h2>
        <span className="text-[11px] tech-muted">{liveCount} live · {onCount}/{features.length} enabled · each editable</span>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {features.map((f) => <Row key={f} moduleKey={moduleKey} feature={f} state={byCap.get(f) ?? { capability: f, enabled: true, config: {} }} />)}
      </div>
      <p className="mt-3 text-[11px] tech-muted">
        <span className="font-semibold text-emerald-300">Live</span> capabilities also drive the controls below. Every capability — live or planned — is enable/disable + JSON-settings editable here, persisted and audited.
      </p>
    </div>
  );
}
