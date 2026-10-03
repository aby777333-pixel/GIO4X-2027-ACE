import Link from "next/link";
import { Database, Layers, ShieldCheck, ScrollText, Boxes, Users, Activity, BarChart3, Wallet, TrendingUp, Server, Radio, CircleDot } from "lucide-react";
import { loadTechConsole } from "@/lib/tech-hub-console";
import { loadExecDashboard, loadTechHub } from "@/lib/tech-hub-data";
import { KillSwitches } from "@/components/tech/KillSwitches";
import { ModuleToggle } from "@/components/tech/ModuleToggle";

export const dynamic = "force-dynamic";

const usd = (n: number | undefined) => `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const num = (n: number | undefined, d = 2) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: d });

const STATUS_BADGE: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-300",
  beta: "bg-amber-500/15 text-amber-300",
  roadmap: "bg-slate-500/15 text-slate-300",
};

function rel(ts: string): string {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

export default async function TechDashboard() {
  const [res, exec, hub] = await Promise.all([loadTechConsole(), loadExecDashboard(), loadTechHub()]);
  if (!res.ok) {
    return <div className="tech-panel rounded-xl p-8 text-sm text-rose-300">{res.error}</div>;
  }
  const { overview, modules, audit } = res;
  const lp = hub.ok ? hub.data.stats : null;
  const bridgesOk = hub.ok ? hub.data.bridges.every((b) => b.last_status !== "failed") : true;

  const execTiles = [
    { label: "Active traders", value: String(exec?.active_traders ?? 0), sub: `${exec?.accounts_live ?? 0} live · ${exec?.accounts_demo ?? 0} demo`, icon: Users },
    { label: "Open positions", value: String(exec?.open_positions ?? 0), sub: `${num(exec?.open_volume)} lots`, icon: Activity },
    { label: "Volume (today)", value: `${num(exec?.volume_today)} lots`, sub: `${exec?.trades_today ?? 0} trades`, icon: BarChart3 },
    { label: "Commission (today)", value: usd(exec?.rev_commission_today), sub: `${usd(exec?.rev_commission_7d)} 7d`, icon: Wallet },
    { label: "Floating P&L", value: usd(exec?.floating_pnl), sub: `realized ${usd(exec?.realized_pnl_today)} today`, icon: TrendingUp },
    { label: "Client equity", value: usd(exec?.equity_total), sub: "across active accounts", icon: Database },
  ];

  const health = [
    { label: "Trading core", ok: exec != null, detail: exec != null ? "Live" : "Unreachable", icon: Server },
    { label: "Database", ok: overview != null, detail: overview?.db.size_pretty ?? "—", icon: Database },
    { label: "Liquidity", ok: lp ? lp.lp_healthy > 0 : false, detail: lp ? `${lp.lp_healthy}/${lp.lp_total} LPs` : "—", icon: Radio },
    { label: "Bridges", ok: bridgesOk, detail: hub.ok ? `${hub.data.bridges.length} active` : "—", icon: Layers },
  ];

  const tiles = [
    { label: "Modules", value: `${overview?.modules.enabled ?? 0}/${overview?.modules.total ?? 0}`, sub: "enabled", icon: Boxes },
    { label: "Super admins", value: String(overview?.super_admins ?? 0), sub: "with full control", icon: ShieldCheck },
    { label: "Actions (24h)", value: String(overview?.audit_24h ?? 0), sub: "audited", icon: ScrollText },
    { label: "DB tables", value: String(overview?.db.tables ?? 0), sub: `${overview?.db.profiles ?? 0} profiles`, icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Command Center</h1>
        <p className="text-sm tech-muted">Live executive view across trading, liquidity, infrastructure and security — the GIO4X operating system.</p>
      </div>

      {/* Executive metrics — live from the trading core */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs tech-muted"><Activity size={13} className="tech-accent" /> Executive Dashboard <span className="opacity-60">· live</span></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {execTiles.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.label} className="tech-panel rounded-xl p-4">
                <div className="flex items-center justify-between"><span className="text-[11px] tech-muted">{t.label}</span><Icon size={15} className="tech-accent" /></div>
                <div className="mt-1 text-xl font-bold">{t.value}</div>
                <div className="text-[10px] tech-muted">{t.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* System health strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {health.map((h) => {
          const Icon = h.icon;
          return (
            <div key={h.label} className="tech-panel flex items-center gap-3 rounded-xl p-4">
              <Icon size={18} className="tech-muted" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold"><CircleDot size={11} className={h.ok ? "text-emerald-400" : "text-rose-400"} /> {h.label}</div>
                <div className="truncate text-[11px] tech-muted">{h.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue by symbol — live */}
      {exec && exec.by_symbol.length > 0 && (
        <div className="tech-panel rounded-xl p-5">
          <div className="mb-3 flex items-center gap-2"><BarChart3 size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Volume &amp; Commission by Symbol</h2><span className="text-[11px] tech-muted">— last 7 days</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Symbol</th><th className="py-2 pr-3 text-right">Positions</th><th className="py-2 pr-3 text-right">Volume (lots)</th><th className="py-2 pr-3 text-right">Commission</th></tr></thead>
              <tbody>
                {exec.by_symbol.map((s) => (
                  <tr key={s.symbol} className="border-b tech-border last:border-0">
                    <td className="py-1.5 pr-3 font-medium">{s.symbol}</td>
                    <td className="py-1.5 pr-3 text-right tech-muted">{s.positions}</td>
                    <td className="py-1.5 pr-3 text-right tech-muted">{num(s.volume)}</td>
                    <td className="py-1.5 pr-3 text-right">{usd(s.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Platform tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="tech-panel rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs tech-muted">{t.label}</span>
                <Icon size={16} className="tech-accent" />
              </div>
              <div className="mt-1 text-2xl font-bold">{t.value}</div>
              <div className="text-[11px] tech-muted">{t.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Emergency controls */}
      <div className="tech-panel rounded-xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Emergency Controls</h2>
          <span className="text-[11px] tech-muted">— global kill switches (turn a subsystem OFF instantly)</span>
        </div>
        <KillSwitches settings={overview?.settings ?? {}} />
      </div>

      {/* Modules grid */}
      <div className="tech-panel rounded-xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <Layers size={16} className="tech-accent" />
          <h2 className="text-sm font-semibold">Modules</h2>
          <span className="text-[11px] tech-muted">— enable/disable any module without affecting the rest</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((m) => (
            <div key={m.key} className="tech-panel2 flex items-start justify-between gap-3 rounded-lg p-3">
              <Link href={`/tech/${m.key}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium hover:underline">{m.name}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${STATUS_BADGE[m.status] ?? ""}`}>{m.status}</span>
                </div>
                <div className="mt-0.5 line-clamp-1 text-[11px] tech-muted">{m.description}</div>
              </Link>
              <ModuleToggle moduleKey={m.key} enabled={m.enabled} />
            </div>
          ))}
        </div>
      </div>

      {/* Audit */}
      <div className="tech-panel rounded-xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <ScrollText size={16} className="tech-accent" />
          <h2 className="text-sm font-semibold">Recent Activity</h2>
        </div>
        {audit.length === 0 ? (
          <div className="text-xs tech-muted">No actions logged yet. Every super-admin change is recorded here.</div>
        ) : (
          <div className="space-y-1">
            {audit.map((a, i) => (
              <div key={i} className="flex items-center justify-between border-b tech-border py-1.5 text-xs last:border-0">
                <span className="flex items-center gap-2">
                  <span className="font-mono tech-accent">{a.action}</span>
                  {a.module && <span className="tech-muted">· {a.module}</span>}
                </span>
                <span className="tech-muted">{a.actor_email} · {rel(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
