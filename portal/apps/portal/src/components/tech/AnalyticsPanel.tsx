import { BarChart3, Wallet, Activity } from "lucide-react";
import type { ExecDashboard } from "@/lib/tech-hub-data";

const usd = (n: number | undefined) => `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const num = (n: number | undefined, d = 2) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: d });

export function AnalyticsPanel({ exec }: { exec: ExecDashboard }) {
  const cards = [
    { label: "Commission (today)", value: usd(exec.rev_commission_today), sub: `${usd(exec.rev_commission_7d)} 7d`, icon: Wallet },
    { label: "Volume (today)", value: `${num(exec.volume_today)} lots`, sub: `${num(exec.volume_7d)} lots 7d`, icon: BarChart3 },
    { label: "Trades (today)", value: String(exec.trades_today), sub: `${exec.open_positions} open`, icon: Activity },
    { label: "Realized P&L (today)", value: usd(exec.realized_pnl_today), sub: `floating ${usd(exec.floating_pnl)}`, icon: BarChart3 },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => { const Icon = c.icon; return (
          <div key={c.label} className="tech-panel rounded-xl p-4">
            <div className="flex items-center justify-between"><span className="text-[11px] tech-muted">{c.label}</span><Icon size={15} className="tech-accent" /></div>
            <div className="mt-1 text-xl font-bold">{c.value}</div><div className="text-[10px] tech-muted">{c.sub}</div>
          </div>
        ); })}
      </div>
      <div className="tech-panel rounded-xl p-5">
        <div className="mb-3 flex items-center gap-2"><BarChart3 size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Revenue &amp; Volume by Symbol</h2><span className="text-[11px] tech-muted">— last 7 days, live</span></div>
        {exec.by_symbol.length === 0 ? <p className="text-xs tech-muted">No trading activity in the window.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Symbol</th><th className="py-2 pr-3 text-right">Positions</th><th className="py-2 pr-3 text-right">Volume (lots)</th><th className="py-2 pr-3 text-right">Commission</th></tr></thead>
            <tbody>{exec.by_symbol.map((s) => (
              <tr key={s.symbol} className="border-b tech-border last:border-0"><td className="py-1.5 pr-3 font-medium">{s.symbol}</td>
                <td className="py-1.5 pr-3 text-right tech-muted">{s.positions}</td><td className="py-1.5 pr-3 text-right tech-muted">{num(s.volume)}</td>
                <td className="py-1.5 pr-3 text-right">{usd(s.commission)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
