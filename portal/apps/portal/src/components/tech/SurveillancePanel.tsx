"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Loader2, Play, Check } from "lucide-react";
import { runSurveillance, resolveAlert } from "@/lib/tech-hub-actions";
import type { Surveillance } from "@/lib/tech-hub-console";

const SEV: Record<string, string> = {
  high: "bg-rose-500/15 text-rose-300", medium: "bg-amber-500/15 text-amber-300", low: "bg-slate-500/15 text-slate-300",
};
const KIND_LABEL: Record<string, string> = {
  large_loss: "Large loss", concentration: "Concentration", rapid_fire: "Rapid-fire", high_slippage: "High slippage", margin_risk: "Margin risk",
};

export function SurveillancePanel({ data }: { data: Surveillance }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function scan() {
    setMsg(null);
    start(async () => { const r = await runSurveillance(); if (r.ok) { setMsg(r.message ?? "Done."); router.refresh(); } else setMsg(r.error); });
  }
  function resolve(id: string) {
    start(async () => { const r = await resolveAlert(id); if (r.ok) router.refresh(); else setMsg(r.error); });
  }

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><ShieldAlert size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Trade Surveillance</h2>
          <span className="text-[11px] tech-muted">— live anomaly detection over the trading core</span></div>
        <button onClick={scan} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50">
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Run scan
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs">
        <div><span className="text-lg font-bold">{data.counts.open}</span> <span className="tech-muted">open</span></div>
        <div><span className="text-lg font-bold text-rose-300">{data.counts.high}</span> <span className="tech-muted">high severity</span></div>
        <div><span className="text-lg font-bold">{data.counts.resolved_24h}</span> <span className="tech-muted">resolved 24h</span></div>
      </div>
      {msg && <div className="mb-2 text-[11px] tech-accent">{msg}</div>}

      {data.open.length === 0 ? (
        <p className="text-xs tech-muted">No open alerts. Run a scan to detect anomalies (large losses, concentration, rapid-fire, slippage, margin risk).</p>
      ) : (
        <div className="space-y-1.5">
          {data.open.map((a) => (
            <div key={a.id} className="tech-panel2 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${SEV[a.severity] ?? SEV.low}`}>{a.severity}</span>
                <span className="shrink-0 font-medium">{KIND_LABEL[a.kind] ?? a.kind}</span>
                <span className="truncate tech-muted">— {a.detail}</span>
              </span>
              <button onClick={() => resolve(a.id)} disabled={pending} className="inline-flex shrink-0 items-center gap-1 rounded border tech-border px-2 py-1 text-[10px] tech-muted hover:tech-accent disabled:opacity-50" title="Mark resolved">
                <Check size={11} /> Resolve
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] tech-muted">Rule-based detection runs live now; an AI narrative/scoring layer activates automatically when an LLM key is configured.</p>
    </div>
  );
}
