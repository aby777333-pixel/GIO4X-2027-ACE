"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Play, Inbox } from "lucide-react";
import { toggleJob, processOutbox } from "@/lib/tech-hub-actions";
import type { Jobs } from "@/lib/tech-hub-console";

export function AutomationPanel({ jobs }: { jobs: Jobs }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const j = jobs;

  return (
    <div className="space-y-4">
      <div className="tech-panel rounded-xl p-5">
        <div className="mb-3 flex items-center gap-2"><Clock size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Scheduled Jobs</h2><span className="text-[11px] tech-muted">— pause / resume live (pg_cron)</span></div>
        {(!j.jobs || j.jobs.length === 0) ? <p className="text-xs tech-muted">No scheduled jobs.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">Job</th><th className="py-2 pr-3">Schedule</th><th className="py-2 pr-3">Last run</th><th className="py-2 pr-3">Active</th></tr></thead>
            <tbody>{j.jobs.map((job) => (
              <tr key={job.jobid} className="border-b tech-border last:border-0">
                <td className="py-2 pr-3 font-medium">{job.name}</td>
                <td className="py-2 pr-3 font-mono text-[10px] tech-muted">{job.schedule}</td>
                <td className="py-2 pr-3 tech-muted">{job.last_run ? new Date(job.last_run).toLocaleString() : "—"}{job.last_status ? ` · ${job.last_status}` : ""}</td>
                <td className="py-2 pr-3">
                  <button type="button" disabled={pending}
                    onClick={() => start(async () => { const r = await toggleJob(job.jobid, !job.active); if (r.ok) router.refresh(); else setMsg(r.error); })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50 ${job.active ? "bg-emerald-500" : "bg-slate-600"}`}
                    title={job.active ? "Active — click to pause" : "Paused — click to resume"}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${job.active ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <div className="tech-panel rounded-xl p-5">
        <div className="mb-3 flex items-center gap-2"><Inbox size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Event Outbox</h2></div>
        <div className="flex flex-wrap items-center gap-4">
          <div><div className="text-xl font-bold">{j.outbox?.pending ?? 0}</div><div className="text-[11px] tech-muted">pending</div></div>
          <div><div className="text-xl font-bold">{j.outbox?.total ?? 0}</div><div className="text-[11px] tech-muted">total</div></div>
          <button type="button" disabled={pending}
            onClick={() => start(async () => { const r = await processOutbox(); if (r.ok) router.refresh(); else setMsg(r.error); })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50">
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Process now
          </button>
        </div>
        {msg && <div className="mt-2 text-[11px] text-rose-400">{msg}</div>}
      </div>
    </div>
  );
}
