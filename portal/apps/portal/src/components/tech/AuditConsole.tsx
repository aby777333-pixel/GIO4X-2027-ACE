"use client";

import { useState, useTransition } from "react";
import { Search, Download, Loader2, ScrollText, Undo2 } from "lucide-react";
import { searchAudit, rollbackAudit } from "@/lib/tech-hub-actions";
import type { AuditRow } from "@/lib/tech-hub-console";

const REVERTIBLE = new Set(["setting.changed", "flag.set", "module.enabled", "module.disabled", "superadmin.granted", "superadmin.revoked"]);
const canRevert = (r: AuditRow) => REVERTIBLE.has(r.action) && r.detail != null && "before" in r.detail;

function detailView(d: Record<string, unknown>): string {
  if (d == null) return "";
  if ("before" in d || "after" in d) {
    const b = d.before; const a = d.after;
    const fmt = (v: unknown) => (v == null ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));
    const key = d.key ?? d.user_id ?? "";
    return `${key ? key + ": " : ""}${fmt(b)} → ${fmt(a)}`;
  }
  return JSON.stringify(d);
}

function toCsv(rows: AuditRow[]): string {
  const cols = ["created_at", "action", "module", "actor_email", "ip", "detail"];
  const esc = (v: unknown) => { const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(","))].join("\n");
}

export function AuditConsole({ initial }: { initial: AuditRow[] }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AuditRow[]>(initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run() {
    setErr(null);
    start(async () => { const r = await searchAudit(q); if (r.ok) setRows(r.rows); else setErr(r.error); });
  }
  function revert(r: AuditRow) {
    if (!confirm(`Revert "${r.action}" to its previous value?`)) return;
    setErr(null);
    start(async () => { const res = await rollbackAudit(r.id); if (!res.ok) { setErr(res.error); return; } const s = await searchAudit(q); if (s.ok) setRows(s.rows); });
  }
  function dl(format: "csv" | "json") {
    const content = format === "csv" ? toCsv(rows) : JSON.stringify(rows, null, 2);
    const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `gio4x-audit.${format}`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><ScrollText size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Audit Center</h2><span className="text-[11px] tech-muted">— every action, with IP &amp; before/after</span></div>
        <div className="flex gap-1.5">
          {(["csv", "json"] as const).map((f) => (
            <button key={f} onClick={() => dl(f)} className="inline-flex items-center gap-1 rounded border tech-border tech-panel2 px-2 py-1 text-[10px] uppercase tech-muted hover:tech-accent"><Download size={11} /> {f}</button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border tech-border tech-panel2 px-2.5">
          <Search size={14} className="tech-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") run(); }} placeholder="Search action, module, user, IP, value…" className="flex-1 bg-transparent py-1.5 text-xs outline-none" />
        </div>
        <button onClick={run} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50">{pending ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Search</button>
      </div>
      {err && <div className="mb-2 text-[11px] text-rose-400">{err}</div>}

      {rows.length === 0 ? (
        <div className="text-xs tech-muted">No matching audit events.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Module</th><th className="py-2 pr-3">Change</th><th className="py-2 pr-3">User</th><th className="py-2 pr-3">IP</th><th className="py-2 pr-3">Time</th><th className="py-2 pr-3 text-right"></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b tech-border last:border-0">
                  <td className="py-1.5 pr-3 font-mono tech-accent">{r.action}</td>
                  <td className="py-1.5 pr-3 tech-muted">{r.module ?? "—"}</td>
                  <td className="py-1.5 pr-3 font-mono text-[10px] tech-muted">{detailView(r.detail)}</td>
                  <td className="py-1.5 pr-3 tech-muted">{r.actor_email ?? "—"}</td>
                  <td className="py-1.5 pr-3 font-mono text-[10px] tech-muted">{r.ip ?? "—"}</td>
                  <td className="py-1.5 pr-3 tech-muted">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right">
                    {canRevert(r) && (
                      <button onClick={() => revert(r)} disabled={pending} className="inline-flex items-center gap-1 rounded border tech-border tech-panel2 px-1.5 py-1 text-[10px] tech-muted hover:tech-accent disabled:opacity-50" title="Revert to previous value">
                        <Undo2 size={11} /> Revert
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[10px] tech-muted">{rows.length} event(s). IP is captured when the request carries a forwarded client address.</p>
    </div>
  );
}
