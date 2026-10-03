import { Cable, Activity, ShieldAlert, Layers, Wallet, ArrowLeftRight } from "lucide-react";
import type { DealerOverview, BookConfigRowDb } from "@/lib/dealer-cockpit";
import { RoutingPreview } from "@/components/dealer/RoutingPreview";
import { DealerSyncButton } from "@/components/dealer/DealerSyncButton";

const usd = (n: number | undefined) => `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const BOOK_TONE: Record<string, string> = { a_book: "bg-emerald-500/15 text-emerald-300", b_book: "bg-amber-500/15 text-amber-300", hybrid: "bg-sky-500/15 text-sky-300" };

// Dealer Desk cockpit rendered inside the Tech Hub (tech theme). Thin shell over
// @gio4x/dealer-core; reads via the dealer_* RPC wrappers.
export function DealerCockpit({ ov, configs }: { ov: DealerOverview; configs: BookConfigRowDb[] }) {
  const tiles = [
    { label: "Liquidity providers", value: `${ov.lp_active}/${ov.lp_total} active`, icon: Cable },
    { label: "Open interventions", value: String(ov.open_interventions), icon: Activity },
    { label: "Toxic clients", value: String(ov.toxic_clients), icon: ShieldAlert },
    { label: "Surveillance flags", value: String(ov.open_flags), icon: ShieldAlert },
    { label: "Book configs", value: String(ov.book_configs), icon: Layers },
    { label: "Revenue (today)", value: usd(ov.revenue_today), icon: Wallet },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Dealer Cockpit <span className="text-[11px] tech-muted">— engine @gio4x/dealer-core · trade server GIO Raptor</span></h2>
        <DealerSyncButton />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => { const Icon = t.icon; return (
          <div key={t.label} className="tech-panel rounded-xl p-4">
            <div className="flex items-center justify-between"><span className="text-[11px] tech-muted">{t.label}</span><Icon size={15} className="tech-accent" /></div>
            <div className="mt-1 text-lg font-bold">{t.value}</div>
          </div>
        ); })}
      </div>

      <RoutingPreview />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="tech-panel rounded-xl p-5">
          <h3 className="mb-3 text-sm font-semibold">Liquidity Providers</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Provider</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3 text-right">Priority</th><th className="py-2 pr-3 text-right">Reject</th><th className="py-2 pr-3 text-right">Fill</th></tr></thead>
              <tbody>
                {ov.lps.map((l) => (
                  <tr key={l.name} className="border-b tech-border last:border-0">
                    <td className="py-2 pr-3 font-medium">{l.name} {l.is_primary && <span className="text-[10px] tech-accent">primary</span>}</td>
                    <td className="py-2 pr-3"><span className={l.status === "active" ? "text-emerald-400" : l.status === "degraded" ? "text-amber-400" : "text-rose-400"}>{l.status}</span></td>
                    <td className="py-2 pr-3 text-right tech-muted">{l.priority}</td>
                    <td className="py-2 pr-3 text-right tech-muted">{(l.reject_rate * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-3 text-right tech-muted">{l.avg_fill_ms != null ? `${l.avg_fill_ms}ms` : "—"}</td>
                  </tr>
                ))}
                {ov.lps.length === 0 && <tr><td colSpan={5} className="py-6 text-center tech-muted">No providers configured.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="tech-panel rounded-xl p-5">
          <h3 className="mb-3 text-sm font-semibold">Live Exposure <span className="text-[11px] tech-muted">(by symbol)</span></h3>
          {ov.exposure.length === 0 ? (
            <div className="py-6 text-center text-sm tech-muted">No exposure snapshot yet — click “Sync from Raptor”.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Symbol</th><th className="py-2 pr-3 text-right">Net (lots)</th><th className="py-2 pr-3 text-right">Gross</th></tr></thead>
                <tbody>{ov.exposure.map((e) => (
                  <tr key={e.ref} className="border-b tech-border last:border-0"><td className="py-2 pr-3 font-medium">{e.ref}</td>
                    <td className={`py-2 pr-3 text-right ${e.net_lots >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{e.net_lots >= 0 ? "+" : ""}{e.net_lots}</td>
                    <td className="py-2 pr-3 text-right tech-muted">{e.gross_lots}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="tech-panel rounded-xl p-5">
        <h3 className="mb-3 text-sm font-semibold">Book Configuration Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Scope</th><th className="py-2 pr-3">Book</th><th className="py-2 pr-3">Dealing</th><th className="py-2 pr-3">Execution</th><th className="py-2 pr-3 text-right">Vol cap</th><th className="py-2 pr-3 text-right">Priority</th></tr></thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id} className={`border-b tech-border last:border-0 ${c.enabled ? "" : "opacity-50"}`}>
                  <td className="py-2 pr-3 font-medium">{c.scope_type}{c.scope_ref ? `: ${c.scope_ref}` : ""}</td>
                  <td className="py-2 pr-3"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${BOOK_TONE[c.book] ?? ""}`}>{c.book}</span></td>
                  <td className="py-2 pr-3 tech-muted">{c.dealing_mode}</td>
                  <td className="py-2 pr-3 tech-muted">{c.execution_model}</td>
                  <td className="py-2 pr-3 text-right tech-muted">{c.volume_threshold_lots ?? "—"}</td>
                  <td className="py-2 pr-3 text-right tech-muted">{c.priority}</td>
                </tr>
              ))}
              {configs.length === 0 && <tr><td colSpan={6} className="py-6 text-center tech-muted">No book config rows.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {(ov.recent_switches.length > 0 || ov.recent_alerts.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="tech-panel rounded-xl p-5">
            <h3 className="mb-3 text-sm font-semibold">Recent Book Switches</h3>
            <div className="space-y-1 text-xs">
              {ov.recent_switches.length === 0 ? <span className="tech-muted">None.</span> : ov.recent_switches.map((s, i) => (
                <div key={i} className="flex items-center justify-between border-b tech-border py-1.5 last:border-0"><span className="flex items-center gap-1.5"><ArrowLeftRight size={12} className="tech-muted" /> {s.account_id}: {s.from_book ?? "—"} → <b>{s.to_book}</b></span><span className="tech-muted">{s.triggered_by}</span></div>
              ))}
            </div>
          </div>
          <div className="tech-panel rounded-xl p-5">
            <h3 className="mb-3 text-sm font-semibold">Active Alerts</h3>
            <div className="space-y-1 text-xs">
              {ov.recent_alerts.length === 0 ? <span className="tech-muted">None.</span> : ov.recent_alerts.map((a, i) => (
                <div key={i} className="flex items-center justify-between border-b tech-border py-1.5 last:border-0"><span className="font-medium">{a.title}</span><span className={a.severity === "critical" ? "text-rose-400" : a.severity === "warning" ? "text-amber-400" : "tech-muted"}>{a.category}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
