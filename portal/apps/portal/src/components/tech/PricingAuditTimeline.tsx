"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, Undo2, Loader2 } from "lucide-react";
import { rollbackPricing } from "@/lib/pricing-actions";
import type { PricingAuditRow } from "@/lib/pricing-terminal";

const ACT_TONE: Record<string, string> = { insert: "text-emerald-300", update: "text-sky-300", delete: "text-rose-300" };
const KEYS = ["base_value", "value", "mode", "side", "long_rate", "short_rate", "model", "enabled", "stack_order", "priority"];

function summary(a: PricingAuditRow): string {
  const nu = (a.new ?? a.previous ?? {}) as Record<string, unknown>;
  const prev = (a.previous ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  for (const k of KEYS) {
    if (k in nu) {
      const before = prev[k];
      const after = nu[k];
      if (a.action === "update" && before !== after) parts.push(`${k}: ${String(before)}→${String(after)}`);
      else if (a.action !== "update") parts.push(`${k}=${String(after)}`);
    }
    if (parts.length >= 3) break;
  }
  return parts.join(" · ") || `${a.action}`;
}

export function PricingAuditTimeline({ rows }: { rows: PricingAuditRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  function revert(id: string) {
    if (!confirm("Revert this change to its previous value?")) return;
    setErr(null);
    start(async () => { const r = await rollbackPricing(id); if (r.ok) router.refresh(); else setErr(r.error); });
  }
  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2"><History size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Audit Timeline</h2><span className="text-[11px] tech-muted">— every config change · user/IP/device · one-click rollback</span></div>
      {err && <div className="mb-2 text-[11px] text-rose-400">{err}</div>}
      {rows.length === 0 ? <p className="text-xs tech-muted">No config changes recorded yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Table</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Change</th><th className="py-2 pr-3">IP</th><th className="py-2 pr-3 text-right"></th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b tech-border last:border-0">
                  <td className="py-1.5 pr-3 tech-muted">{new Date(a.at).toLocaleString()}</td>
                  <td className="py-1.5 pr-3 font-medium">{a.table.replace(/_/g, " ")}</td>
                  <td className={`py-1.5 pr-3 font-semibold uppercase ${ACT_TONE[a.action] ?? "tech-muted"}`}>{a.action}</td>
                  <td className="py-1.5 pr-3 font-mono text-[10px] tech-muted">{summary(a)}</td>
                  <td className="py-1.5 pr-3 font-mono text-[10px] tech-muted">{a.ip ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right">
                    <button disabled={pending} onClick={() => revert(a.id)} className="inline-flex items-center gap-1 rounded border tech-border tech-panel2 px-1.5 py-1 text-[10px] tech-muted hover:tech-accent disabled:opacity-50" title="Revert">
                      {pending ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />} Revert
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
