"use client";

// §29 Reporting Centre UI — pick a report + date window, preview the grid, and
// export CSV. Scheduled email delivery is honestly deferred to the Bulk Emailer.

import { useState, useTransition } from "react";
import { FileBarChart, Download, Play, Mail } from "lucide-react";
import { runReport, REPORT_TYPES, type ReportType, type ReportResult } from "@/lib/report-actions";

function toCsv(columns: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
}

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export function ReportsClient() {
  const [type, setType] = useState<ReportType>("trades");
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [result, setResult] = useState<ReportResult | null>(null);
  const [pending, start] = useTransition();

  const run = () => start(async () => setResult(await runReport(type, from, to)));

  const download = () => {
    if (!result || result.rows.length === 0) return;
    const blob = new Blob([toCsv(result.columns, result.rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `raptor-${type}-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const meta = REPORT_TYPES.find((r) => r.key === type)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3">
        <label className="text-[10px] uppercase tracking-wide text-steel">Report
          <select value={type} onChange={(e) => { setType(e.target.value as ReportType); setResult(null); }}
            className="mt-0.5 block w-52 rounded border border-steel/25 bg-white px-2 py-1 text-[12px] text-navy outline-none focus:border-sky">
            {REPORT_TYPES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wide text-steel">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="mt-0.5 block rounded border border-steel/25 px-2 py-1 text-[12px] text-navy outline-none focus:border-sky" />
        </label>
        <label className="text-[10px] uppercase tracking-wide text-steel">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="mt-0.5 block rounded border border-steel/25 px-2 py-1 text-[12px] text-navy outline-none focus:border-sky" />
        </label>
        <button onClick={run} disabled={pending}
          className="flex items-center gap-1 rounded bg-sky px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40">
          <Play size={13} /> {pending ? "Running…" : "Run report"}
        </button>
        <button onClick={download} disabled={!result || result.rows.length === 0}
          className="flex items-center gap-1 rounded border border-sky/40 px-3 py-1.5 text-[12px] font-bold text-sky disabled:opacity-40">
          <Download size={13} /> CSV
        </button>
      </div>
      <p className="px-1 text-[11px] text-steel">{meta.desc}</p>

      {result?.error && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[12px] text-danger">{result.error}</div>
      )}

      {result && !result.error && (
        <div className="rounded-xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <FileBarChart size={15} className="text-sky" /> {result.title}
            </div>
            {result.summary && <span className="text-[11px] text-steel">{result.summary}</span>}
          </div>
          <div className="max-h-[520px] overflow-auto">
            {result.rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-steel">No rows for this window.</p>
            ) : (
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-steel/25 text-[10px] uppercase tracking-wide text-steel">
                    {result.columns.map((c) => <th key={c} className="px-2 py-1.5 whitespace-nowrap">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 500).map((row, i) => (
                    <tr key={i} className="border-b border-steel/10">
                      {row.map((cell, j) => <td key={j} className="px-2 py-1.5 whitespace-nowrap font-mono text-navy">{String(cell ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {result.rows.length > 500 && (
            <div className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-steel">
              Showing first 500 of {result.rows.length} rows — download the CSV for the full report.
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-slate-100 p-3">
        <Mail size={15} className="mt-0.5 shrink-0 text-steel" />
        <div className="text-[12px] text-steel">
          <span className="font-semibold text-navy">Scheduled &amp; emailed reports</span> — run any report here and export CSV now.
          Automated daily/weekly delivery to a distribution list goes through the Bulk Emailer (needs the RESEND_API_KEY env).
        </div>
      </div>
    </div>
  );
}
