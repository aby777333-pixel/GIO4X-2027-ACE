"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ToggleLeft, Loader2 } from "lucide-react";
import { setFlag } from "@/lib/tech-hub-actions";
import type { Flag } from "@/lib/tech-hub-console";

export function FlagManager({ flags }: { flags: Flag[] }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2"><ToggleLeft size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Feature Flags</h2><span className="text-[11px] tech-muted">— toggles apply live across the platform</span></div>
      <div className="mb-4 flex gap-2">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="new_feature_key" className="flex-1 rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs font-mono" />
        <button disabled={pending || !key.trim()} onClick={() => start(async () => { await setFlag(key.trim(), false); setKey(""); router.refresh(); })} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />} Add</button>
      </div>
      <div className="space-y-1.5">
        {flags.map((f) => <FlagRow key={f.key} f={f} />)}
        {flags.length === 0 && <div className="py-4 text-center text-xs tech-muted">No flags.</div>}
      </div>
    </div>
  );
}

function FlagRow({ f }: { f: Flag }) {
  const router = useRouter();
  const [on, setOn] = useState(f.enabled);
  const [pending, start] = useTransition();
  return (
    <div className="tech-panel2 flex items-center justify-between rounded-lg border tech-border px-3 py-2">
      <span className="font-mono text-xs">{f.key}</span>
      <button disabled={pending} onClick={() => start(async () => { const r = await setFlag(f.key, !on); if (r.ok) setOn(!on); router.refresh(); })} className={`relative inline-flex h-5 w-9 items-center rounded-full ${on ? "bg-emerald-500" : "bg-slate-600"}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${on ? "translate-x-4" : "translate-x-1"}`} /></button>
    </div>
  );
}
