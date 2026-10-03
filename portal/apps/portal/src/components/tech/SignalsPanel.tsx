import { Radio, Users, Layers } from "lucide-react";
import type { Signals } from "@/lib/tech-hub-console";

const BADGE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300", approved: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-amber-500/15 text-amber-300", paused: "bg-slate-500/15 text-slate-300",
  rejected: "bg-rose-500/15 text-rose-300", closed: "bg-slate-500/15 text-slate-300",
};

export function SignalsPanel({ signals }: { signals: Signals }) {
  const s = signals;
  const card = "tech-panel2 rounded-lg border tech-border p-3";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className={card}><div className="flex items-center gap-1.5 text-[11px] tech-muted"><Radio size={13} /> Signal providers</div><div className="mt-1 text-xl font-bold">{s.stats?.providers ?? 0}</div></div>
        <div className={card}><div className="flex items-center gap-1.5 text-[11px] tech-muted"><Layers size={13} /> PAMM / MAM funds</div><div className="mt-1 text-xl font-bold">{s.stats?.funds ?? 0}</div></div>
        <div className={card}><div className="flex items-center gap-1.5 text-[11px] tech-muted"><Users size={13} /> Copy subscriptions</div><div className="mt-1 text-xl font-bold">{s.stats?.subscriptions ?? 0}</div></div>
      </div>

      <div className="tech-panel rounded-xl p-5">
        <h2 className="mb-3 text-sm font-semibold">Signal &amp; Copy Providers</h2>
        {(!s.providers || s.providers.length === 0) ? <p className="text-xs tech-muted">No signal providers registered yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Provider</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3 text-right">Subscribers</th></tr></thead>
            <tbody>{s.providers.map((p) => (
              <tr key={p.id} className="border-b tech-border last:border-0"><td className="py-2 pr-3 font-medium">{p.name}</td>
                <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 text-[10px] uppercase ${BADGE[p.status] ?? "bg-slate-500/15 text-slate-300"}`}>{p.status}</span></td>
                <td className="py-2 pr-3 text-right tech-muted">{p.subscribers}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <div className="tech-panel rounded-xl p-5">
        <h2 className="mb-3 text-sm font-semibold">PAMM / MAM Funds</h2>
        {(!s.funds || s.funds.length === 0) ? <p className="text-xs tech-muted">No managed funds yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Fund</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3 text-right">AUM</th><th className="py-2 pr-3 text-right">NAV/unit</th></tr></thead>
            <tbody>{s.funds.map((f) => (
              <tr key={f.id} className="border-b tech-border last:border-0"><td className="py-2 pr-3 font-medium">{f.name}</td>
                <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 text-[10px] uppercase ${BADGE[f.status] ?? "bg-slate-500/15 text-slate-300"}`}>{f.status}</span></td>
                <td className="py-2 pr-3 text-right tech-muted">{f.aum != null ? `$${Number(f.aum).toLocaleString()}` : "—"}</td>
                <td className="py-2 pr-3 text-right tech-muted">{f.nav != null ? Number(f.nav).toFixed(4) : "—"}</td></tr>
            ))}</tbody>
          </table></div>
        )}
        <p className="mt-3 text-[11px] tech-muted">Provider &amp; fund lifecycle (approve / pause / payout) is managed in the Staff Console → Copy &amp; PAMM desks; this view mirrors live state.</p>
      </div>
    </div>
  );
}
