"use client";

import { Download } from "lucide-react";

// Generic client-side CSV export. Pass headers + a 2D array of cell values;
// the rows are serialized and downloaded in the browser (no server round-trip).
export function ExportCsvButton({
  filename,
  headers,
  rows,
  disabled,
}: {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  disabled?: boolean;
}) {
  function download() {
    if (!rows.length) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={disabled || rows.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-navy transition hover:border-sky/40 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download size={14} /> Export CSV
    </button>
  );
}
