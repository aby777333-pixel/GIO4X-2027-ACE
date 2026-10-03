"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { previewPricing, type PricingPreviewInput, type PricingPreviewResult } from "@/lib/pricing-actions";

export function PricingPreview() {
  const [f, setF] = useState<PricingPreviewInput>({
    symbol: "EURUSD", assetClass: "forex", mid: 1.10000, rawSpreadPips: 0.5,
    segment: "", tradingGroup: "", country: "IN", widenTrigger: "",
  });
  const [res, setRes] = useState<PricingPreviewResult | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof PricingPreviewInput, v: string) => setF((p) => ({ ...p, [k]: k === "mid" || k === "rawSpreadPips" ? Number(v) : v }));
  const inp = "rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs";
  const num = (x: number) => x.toFixed(5);

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical size={16} className="tech-accent" />
        <h2 className="text-sm font-semibold">Live Pricing Preview</h2>
        <span className="text-[11px] tech-muted">— runs the real engine (transformTick) against live config</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-[10px] uppercase tech-muted">Symbol<input value={f.symbol} onChange={(e) => set("symbol", e.target.value)} className={inp + " mt-1 block w-full"} /></label>
        <label className="text-[10px] uppercase tech-muted">Asset class<input value={f.assetClass} onChange={(e) => set("assetClass", e.target.value)} className={inp + " mt-1 block w-full"} /></label>
        <label className="text-[10px] uppercase tech-muted">Raw mid<input value={f.mid} onChange={(e) => set("mid", e.target.value)} className={inp + " mt-1 block w-full"} /></label>
        <label className="text-[10px] uppercase tech-muted">Raw spread (pips)<input value={f.rawSpreadPips} onChange={(e) => set("rawSpreadPips", e.target.value)} className={inp + " mt-1 block w-full"} /></label>
        <label className="text-[10px] uppercase tech-muted">Segment<input value={f.segment} onChange={(e) => set("segment", e.target.value)} placeholder="vip" className={inp + " mt-1 block w-full"} /></label>
        <label className="text-[10px] uppercase tech-muted">Widen trigger<input value={f.widenTrigger} onChange={(e) => set("widenTrigger", e.target.value)} placeholder="nfp" className={inp + " mt-1 block w-full"} /></label>
      </div>
      <div className="mt-2"><button onClick={() => start(async () => setRes(await previewPricing(f)))} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50">{pending ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />} Price it</button></div>

      {res && res.ok && (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {/* BLACK GLASS — the only thing the trader sees */}
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-emerald-300"><Eye size={12} /> Client sees (Black Glass)</div>
            <table className="w-full font-mono text-sm"><tbody>
              <tr><td className="tech-muted">bid</td><td className="text-right">{num(res.client.bid)}</td></tr>
              <tr><td className="tech-muted">ask</td><td className="text-right">{num(res.client.ask)}</td></tr>
            </tbody></table>
            <div className="mt-2 text-[10px] tech-muted">Final price only. No raw, no breakdown, no revenue ever leaves here.</div>
          </div>

          {/* INTERNAL — raw → broker → final */}
          <div className="tech-panel2 rounded-lg p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tech-muted"><EyeOff size={12} /> Internal — formation</div>
            <table className="w-full font-mono text-xs">
              <thead><tr className="tech-muted"><th></th><th className="text-right">bid</th><th className="text-right">ask</th></tr></thead>
              <tbody>
                <tr><td className="tech-muted">raw (LP)</td><td className="text-right">{num(res.internal.raw.bid)}</td><td className="text-right">{num(res.internal.raw.ask)}</td></tr>
                <tr><td className="tech-muted">broker</td><td className="text-right">{num(res.internal.broker.bid)}</td><td className="text-right">{num(res.internal.broker.ask)}</td></tr>
                <tr className="font-bold"><td>final</td><td className="text-right">{num(res.internal.final.bid)}</td><td className="text-right">{num(res.internal.final.ask)}</td></tr>
              </tbody>
            </table>
            <div className="mt-2 text-[11px] tech-muted">revenue/lot (price): <span className="font-mono tech-accent">{res.internal.revenuePerLot}</span>{res.internal.stale && <span className="ml-2 text-rose-400">STALE FEED</span>}</div>
          </div>

          {/* INTERNAL — breakdowns */}
          <div className="tech-panel2 rounded-lg p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tech-muted">Spread + markup breakdown</div>
            <div className="text-[11px] tech-muted">spread: <span className="font-mono">{res.internal.spread.effectiveSpread.toFixed(6)}</span></div>
            <ul className="mb-2 space-y-0.5 text-[10px]">{res.internal.spread.breakdown.map((b, i) => <li key={i} className="flex justify-between"><span className="tech-muted">{b.label}</span><span className="font-mono">{b.valuePrice.toFixed(6)}</span></li>)}</ul>
            <div className="text-[11px] tech-muted">markup buy <span className="font-mono">{res.internal.markup.buyMarkup.toFixed(6)}</span> · sell <span className="font-mono">{res.internal.markup.sellMarkup.toFixed(6)}</span></div>
            <ul className="space-y-0.5 text-[10px]">{res.internal.markup.breakdown.map((b, i) => <li key={i} className="flex justify-between"><span className="tech-muted">{b.label}</span><span className="font-mono">{b.valuePrice.toFixed(6)}</span></li>)}</ul>
          </div>
        </div>
      )}
      {res && !res.ok && <div className="mt-3 text-xs text-rose-400">{res.error}</div>}
    </div>
  );
}
