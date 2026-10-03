"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Loader2, ArrowRight } from "lucide-react";
import { previewRouting, type PreviewInput, type PreviewResult } from "@/lib/dealer-actions";

const BOOK_TONE: Record<string, string> = {
  a_book: "bg-emerald-500/15 text-emerald-300", b_book: "bg-amber-500/15 text-amber-300", hybrid: "bg-sky-500/15 text-sky-300",
};

export function RoutingPreview() {
  const [f, setF] = useState<PreviewInput>({
    accountId: "acc-001", accountType: "vip", clientGroup: "cg-default", tradingGroup: "tg-standard",
    whiteLabel: "gio4x", country: "IN", symbol: "EURUSD", assetClass: "forex", volumeLots: 1, riskScore: 50,
  });
  const [res, setRes] = useState<PreviewResult | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof PreviewInput, v: string) => setF((p) => ({ ...p, [k]: k === "volumeLots" || k === "riskScore" ? Number(v) : v }));
  const inp = "rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs";

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical size={16} className="tech-accent" />
        <h2 className="text-sm font-semibold">Live Routing Preview</h2>
        <span className="text-[11px] tech-muted">— runs the real engine against live book config</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <label className="text-[10px] uppercase tech-muted">Symbol<input value={f.symbol} onChange={(e) => set("symbol", e.target.value)} className={inp + " mt-1 block w-full"} /></label>
        <label className="text-[10px] uppercase tech-muted">Asset class<input value={f.assetClass} onChange={(e) => set("assetClass", e.target.value)} className={inp + " mt-1 block w-full"} /></label>
        <label className="text-[10px] uppercase tech-muted">Account<input value={f.accountId} onChange={(e) => set("accountId", e.target.value)} className={inp + " mt-1 block w-full"} /></label>
        <label className="text-[10px] uppercase tech-muted">Trading group<input value={f.tradingGroup} onChange={(e) => set("tradingGroup", e.target.value)} className={inp + " mt-1 block w-full"} /></label>
        <label className="text-[10px] uppercase tech-muted">Country<input value={f.country} onChange={(e) => set("country", e.target.value)} className={inp + " mt-1 block w-full"} /></label>
        <label className="text-[10px] uppercase tech-muted">Volume (lots)<input value={f.volumeLots} onChange={(e) => set("volumeLots", e.target.value)} className={inp + " mt-1 block w-full"} /></label>
        <label className="text-[10px] uppercase tech-muted">Risk score (0-100)<input value={f.riskScore ?? ""} onChange={(e) => set("riskScore", e.target.value)} className={inp + " mt-1 block w-full"} /></label>
        <div className="flex items-end"><button onClick={() => start(async () => setRes(await previewRouting(f)))} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50">{pending ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />} Resolve</button></div>
      </div>

      {res && res.ok && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="tech-panel2 rounded-lg p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tech-muted">Decision</div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${BOOK_TONE[res.decision.book] ?? ""}`}>{res.decision.book}</span>
              <span className="tech-muted">exec: <b>{res.decision.executionModel}</b></span>
              {res.decision.needsDealer && <span className="rounded bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300">needs dealer</span>}
              {res.decision.lpId && <span className="tech-muted">LP: {res.decision.lpId}</span>}
            </div>
            {res.decision.flags.length > 0 && <div className="mt-2 text-[11px] tech-muted">flags: {res.decision.flags.join(", ")}</div>}
            <pre className="mt-2 overflow-x-auto rounded tech-panel p-2 text-[10px] tech-muted">{JSON.stringify(res.decision.ruleSnapshot, null, 2)}</pre>
          </div>
          <div className="tech-panel2 rounded-lg p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tech-muted">Resolved config &amp; provenance</div>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(res.config.resolvedFrom).map(([field, rf]) => (
                  <tr key={field} className="border-b tech-border last:border-0">
                    <td className="py-1 pr-2 font-medium">{field}</td>
                    <td className="py-1 pr-2 font-mono tech-muted">{String((res.config as unknown as Record<string, unknown>)[field] ?? "—")}</td>
                    <td className="py-1 text-right text-[10px] tech-muted">{rf.scopeType}{rf.scopeRef ? `:${rf.scopeRef}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {res && !res.ok && <div className="mt-3 text-xs text-rose-400">{res.error}</div>}
    </div>
  );
}
