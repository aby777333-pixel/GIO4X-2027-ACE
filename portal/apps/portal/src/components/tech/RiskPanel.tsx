import { Gauge, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import type { RiskData } from "@/lib/tech-hub-data";

const usd = (n: number | undefined) => `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const num = (n: number | undefined, d = 2) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: d });

export function RiskPanel({ risk }: { risk: RiskData }) {
  const cards = [
    { label: "Total exposure", value: `${num(risk.total_exposure_lots)} lots`, sub: `${risk.open_positions} open positions`, icon: Gauge },
    { label: "Net long", value: `${num(risk.net_long_lots)} lots`, sub: "buy-side", icon: TrendingUp },
    { label: "Net short", value: `${num(risk.net_short_lots)} lots`, sub: "sell-side", icon: TrendingDown },
    { label: "Floating P&L", value: usd(risk.floating_pnl), sub: `${risk.accounts_negative_margin} acct(s) neg. margin`, icon: AlertTriangle },
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
        <div className="mb-3 flex items-center gap-2"><Gauge size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Net Exposure by Symbol</h2><span className="text-[11px] tech-muted">— open positions, live</span></div>
        {risk.by_symbol.length === 0 ? <p className="text-xs tech-muted">No open exposure.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Symbol</th><th className="py-2 pr-3 text-right">Net (lots)</th><th className="py-2 pr-3 text-right">Gross</th><th className="py-2 pr-3 text-right">Positions</th><th className="py-2 pr-3 text-right">Floating P&amp;L</th></tr></thead>
            <tbody>{risk.by_symbol.map((s) => (
              <tr key={s.symbol} className="border-b tech-border last:border-0"><td className="py-1.5 pr-3 font-medium">{s.symbol}</td>
                <td className={`py-1.5 pr-3 text-right ${s.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{s.net >= 0 ? "+" : ""}{num(s.net)}</td>
                <td className="py-1.5 pr-3 text-right tech-muted">{num(s.exposure)}</td><td className="py-1.5 pr-3 text-right tech-muted">{s.positions}</td>
                <td className={`py-1.5 pr-3 text-right ${s.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{usd(s.pnl)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {risk.top_accounts.length > 0 && (
        <div className="tech-panel rounded-xl p-5">
          <h2 className="mb-3 text-sm font-semibold">Accounts by Free Margin</h2>
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Account</th><th className="py-2 pr-3 text-right">Equity</th><th className="py-2 pr-3 text-right">Margin</th><th className="py-2 pr-3 text-right">Free margin</th></tr></thead>
            <tbody>{risk.top_accounts.map((a) => (
              <tr key={a.account_number} className="border-b tech-border last:border-0"><td className="py-1.5 pr-3 font-mono">{a.account_number}</td>
                <td className="py-1.5 pr-3 text-right tech-muted">{usd(a.equity)}</td><td className="py-1.5 pr-3 text-right tech-muted">{usd(a.margin)}</td>
                <td className={`py-1.5 pr-3 text-right ${a.free_margin >= 0 ? "tech-muted" : "text-rose-400"}`}>{usd(a.free_margin)}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
