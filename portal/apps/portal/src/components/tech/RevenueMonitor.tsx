import { LineChart, Wallet, CalendarDays, Coins } from "lucide-react";
import type { RevenueData } from "@/lib/pricing-terminal";
import { RevenueSyncButton } from "./RevenueSyncButton";

const usd = (n: number | undefined) => `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const SRC_LABEL: Record<string, string> = { spread_markup: "Spread markup", commission: "Commission", swap: "Swap", overnight: "Overnight", conversion: "Conversion", withdrawal: "Withdrawal", extraction: "Extraction" };

export function RevenueMonitor({ data }: { data: RevenueData }) {
  const tiles = [
    { label: "Total revenue", value: usd(data.total), icon: Wallet },
    { label: "Today", value: usd(data.today), icon: CalendarDays },
    { label: "Last 7 days", value: usd(data.last_7d), icon: LineChart },
    { label: "Ledger rows", value: String(data.rows), icon: Coins },
  ];
  const maxSrc = Math.max(1, ...data.by_source.map((s) => Math.abs(s.amt)));

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><LineChart size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Revenue Monitor</h2>
          <span className="text-[11px] tech-muted">— shared dealer.revenue_ledger · internal only</span></div>
        <RevenueSyncButton />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => { const Icon = t.icon; return (
          <div key={t.label} className="tech-panel2 rounded-lg p-3">
            <div className="flex items-center justify-between"><span className="text-[11px] tech-muted">{t.label}</span><Icon size={14} className="tech-accent" /></div>
            <div className="mt-1 text-lg font-bold">{t.value}</div>
          </div>
        ); })}
      </div>

      {data.rows === 0 ? (
        <p className="text-xs tech-muted">No revenue recorded yet. Click “Sync from Raptor” to pull live commission + swap from the trading core into the shared ledger (or wait for the settlement path to attribute fills).</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tech-muted">By source</h3>
            <div className="space-y-1.5">
              {data.by_source.map((s) => (
                <div key={s.source} className="text-xs">
                  <div className="flex justify-between"><span>{SRC_LABEL[s.source] ?? s.source}</span><span className="font-mono">{usd(s.amt)}</span></div>
                  <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-600/40"><div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${(Math.abs(s.amt) / maxSrc) * 100}%` }} /></div>
                </div>
              ))}
            </div>
            <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tech-muted">By book</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {data.by_book.map((b) => <span key={b.book} className="tech-panel2 rounded px-2 py-1">{b.book}: <span className="font-mono">{usd(b.amt)}</span></span>)}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tech-muted">By symbol</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-1.5 pr-3">Symbol</th><th className="py-1.5 pr-3 text-right">Revenue</th></tr></thead>
                <tbody>{data.by_symbol.map((s) => (
                  <tr key={s.symbol} className="border-b tech-border last:border-0"><td className="py-1.5 pr-3 font-medium">{s.symbol}</td><td className="py-1.5 pr-3 text-right font-mono">{usd(s.amt)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
