import { Activity, BookOpen, Gauge, AlertTriangle } from "lucide-react";
import type { ApiUsage } from "@/lib/tech-hub-console";

const ENDPOINTS = [
  { m: "GET", p: "/api/v1/ping", d: "Auth check — returns your key name + scopes." },
  { m: "GET", p: "/api/v1/instruments", d: "Live tradable instruments (symbol, spread, commission, lot specs)." },
  { m: "GET", p: "/api/v1/quotes", d: "Live aggregated bid/ask book." },
];

const codeBadge: Record<string, string> = { "2": "text-emerald-400", "4": "text-amber-400", "5": "text-rose-400" };

export function ApiUsagePanel({ usage }: { usage: ApiUsage }) {
  const cards = [
    { label: "Calls (24h)", value: usage.last_24h.toLocaleString(), sub: `${usage.last_1h} in last hour`, icon: Activity },
    { label: "Total calls", value: usage.total.toLocaleString(), sub: "all time", icon: Activity },
    { label: "Avg latency", value: `${usage.avg_latency_ms} ms`, sub: "last 24h", icon: Gauge },
    { label: "Errors (24h)", value: usage.errors_24h.toLocaleString(), sub: "4xx/5xx", icon: AlertTriangle },
  ];
  return (
    <div className="space-y-4">
      {/* Live API documentation */}
      <div className="tech-panel rounded-xl p-5">
        <div className="mb-3 flex items-center gap-2"><BookOpen size={16} className="tech-accent" /><h2 className="text-sm font-semibold">REST API — live endpoints</h2></div>
        <p className="mb-3 text-[11px] tech-muted">Base URL <code className="tech-panel2 rounded px-1.5 py-0.5">https://app.gio4x.com/api/v1</code> · Auth header <code className="tech-panel2 rounded px-1.5 py-0.5">Authorization: Bearer &lt;key&gt;</code> (create keys above). Rate-limited per key/minute; every call is logged below.</p>
        <div className="space-y-1.5">
          {ENDPOINTS.map((e) => (
            <div key={e.p} className="tech-panel2 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs">
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">{e.m}</span>
              <span className="font-mono">{e.p}</span>
              <span className="tech-muted">— {e.d}</span>
            </div>
          ))}
        </div>
        <pre className="tech-panel2 mt-3 overflow-x-auto rounded-lg p-3 text-[11px] tech-muted">{`curl https://app.gio4x.com/api/v1/instruments \\\n  -H "Authorization: Bearer gio4x_live_..."`}</pre>
      </div>

      {/* Live usage analytics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => { const Icon = c.icon; return (
          <div key={c.label} className="tech-panel rounded-xl p-4">
            <div className="flex items-center justify-between"><span className="text-[11px] tech-muted">{c.label}</span><Icon size={15} className="tech-accent" /></div>
            <div className="mt-1 text-xl font-bold">{c.value}</div><div className="text-[10px] tech-muted">{c.sub}</div>
          </div>
        ); })}
      </div>

      <div className="tech-panel rounded-xl p-5">
        <h2 className="mb-3 text-sm font-semibold">Usage by Endpoint <span className="text-[11px] tech-muted">— last 7 days</span></h2>
        {usage.by_endpoint.length === 0 ? <p className="text-xs tech-muted">No API calls yet. Create a key and hit an endpoint to see analytics here.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Endpoint</th><th className="py-2 pr-3 text-right">Calls</th><th className="py-2 pr-3 text-right">Avg latency</th></tr></thead>
            <tbody>{usage.by_endpoint.map((e) => (
              <tr key={e.path} className="border-b tech-border last:border-0"><td className="py-1.5 pr-3 font-mono">{e.path}</td>
                <td className="py-1.5 pr-3 text-right">{e.calls.toLocaleString()}</td><td className="py-1.5 pr-3 text-right tech-muted">{e.avg_ms} ms</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {usage.recent.length > 0 && (
        <div className="tech-panel rounded-xl p-5">
          <h2 className="mb-3 text-sm font-semibold">Recent Requests</h2>
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Key</th><th className="py-2 pr-3">Endpoint</th><th className="py-2 pr-3 text-right">Status</th><th className="py-2 pr-3 text-right">Latency</th><th className="py-2 pr-3">IP</th><th className="py-2 pr-3 text-right">Time</th></tr></thead>
            <tbody>{usage.recent.map((r, i) => (
              <tr key={i} className="border-b tech-border last:border-0"><td className="py-1.5 pr-3 tech-muted">{r.key_name ?? "—"}</td>
                <td className="py-1.5 pr-3 font-mono text-[10px]">{r.method} {r.path}</td>
                <td className={`py-1.5 pr-3 text-right font-mono ${codeBadge[String(r.status)[0]] ?? "tech-muted"}`}>{r.status}</td>
                <td className="py-1.5 pr-3 text-right tech-muted">{r.latency_ms} ms</td>
                <td className="py-1.5 pr-3 font-mono text-[10px] tech-muted">{r.ip ?? "—"}</td>
                <td className="py-1.5 pr-3 text-right tech-muted">{new Date(r.created_at).toLocaleTimeString()}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
