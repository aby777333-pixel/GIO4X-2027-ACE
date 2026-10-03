"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Waves } from "lucide-react";
import { setLpStatus, setLpMarkup } from "@/lib/tech-liquidity-actions";
import type { LpRow } from "@/lib/tech-hub-data";

const STATUSES = ["active", "degraded", "disabled"];

export function LiquidityManager({ lps }: { lps: LpRow[] }) {
  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2"><Waves size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Liquidity Providers</h2><span className="text-[11px] tech-muted">— edits apply live to routing &amp; spreads</span></div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Provider</th><th className="py-2 pr-3">Connector</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Markup (bps)</th><th className="py-2 pr-3 text-right">Fill</th></tr></thead>
          <tbody>{lps.map((lp) => <LpRowEdit key={lp.name} lp={lp} />)}</tbody>
        </table>
      </div>
    </div>
  );
}

function LpRowEdit({ lp }: { lp: LpRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(lp.status);
  const [markup, setMarkup] = useState(String(lp.markup_bps ?? ""));
  const dirty = markup !== String(lp.markup_bps ?? "");
  return (
    <tr className="border-b tech-border last:border-0">
      <td className="py-2 pr-3 font-medium">{lp.name}</td>
      <td className="py-2 pr-3 tech-muted">{lp.connector}</td>
      <td className="py-2 pr-3">
        <select value={STATUSES.includes(status) ? status : "active"} disabled={pending}
          onChange={(e) => { const v = e.target.value; start(async () => { const r = await setLpStatus(lp.name, v); if (r.ok) setStatus(v); router.refresh(); }); }}
          className="rounded border tech-border tech-panel2 px-1.5 py-1 text-xs capitalize">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1">
          <input value={markup} onChange={(e) => setMarkup(e.target.value)} className="w-16 rounded border tech-border tech-panel2 px-1.5 py-1 text-xs" />
          {dirty && <button disabled={pending} onClick={() => start(async () => { const r = await setLpMarkup(lp.name, Number(markup)); if (r.ok) router.refresh(); })} className="rounded bg-sky-600 p-1 text-white">{pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}</button>}
        </div>
      </td>
      <td className="py-2 pr-3 text-right tech-muted">{lp.fill_rate != null ? `${(lp.fill_rate * 100).toFixed(0)}%` : "—"}</td>
    </tr>
  );
}
