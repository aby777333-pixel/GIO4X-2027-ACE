"use client";

import { useState, useTransition } from "react";
import { Download, FileBarChart, Loader2 } from "lucide-react";
import { exportReport } from "@/lib/tech-hub-actions";

const REPORTS = [
  { kind: "revenue", label: "Revenue by Symbol" },
  { kind: "exposure", label: "Exposure by Symbol" },
  { kind: "lp_performance", label: "LP Performance" },
  { kind: "overview", label: "System Overview" },
  { kind: "audit", label: "Audit Log" },
  { kind: "apikeys", label: "API Keys" },
  { kind: "bridges", label: "Bridges" },
  { kind: "security", label: "Security Rules" },
];

export function ReportingPanel() {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function dl(kind: string, format: "csv" | "json") {
    setErr(null); setBusy(`${kind}-${format}`);
    start(async () => {
      const r = await exportReport(kind, format);
      setBusy(null);
      if (!r.ok) { setErr(r.error); return; }
      const blob = new Blob([r.content], { type: r.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.filename; a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2"><FileBarChart size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Reports &amp; Exports</h2></div>
      {err && <div className="mb-2 text-[11px] text-rose-400">{err}</div>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((rep) => (
          <div key={rep.kind} className="tech-panel2 flex items-center justify-between rounded-lg border tech-border px-3 py-2.5">
            <span className="text-xs font-medium">{rep.label}</span>
            <div className="flex gap-1.5">
              {(["csv", "json"] as const).map((fmt) => (
                <button key={fmt} disabled={pending} onClick={() => dl(rep.kind, fmt)} className="inline-flex items-center gap-1 rounded border tech-border tech-panel px-2 py-1 text-[10px] uppercase tech-muted hover:tech-accent disabled:opacity-50">
                  {busy === `${rep.kind}-${fmt}` ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} {fmt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
