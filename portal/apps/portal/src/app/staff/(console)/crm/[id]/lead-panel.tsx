"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { UserPlus, BadgeCheck } from "lucide-react";
import {
  updateLeadStage,
  assignLead,
  addLeadActivity,
  convertLead,
} from "@/lib/crm-actions";
import {
  LEAD_STAGES,
  STAGE_LABEL,
  ACTIVITY_KINDS,
  ACTIVITY_LABEL,
  type LeadStage,
  type ActivityKind,
} from "@/lib/crm-constants";

type StaffOption = { id: string; name: string };

export function LeadPanel({
  leadId,
  stage,
  assignedStaff,
  converted,
  currentUserId,
  staff,
}: {
  leadId: string;
  stage: LeadStage;
  assignedStaff: string | null;
  converted: boolean;
  currentUserId: string;
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong.");
    });
  }

  function onStage(e: React.ChangeEvent<HTMLSelectElement>) {
    const to = e.target.value as LeadStage;
    let reason: string | undefined;
    if (to === "lost") reason = window.prompt("Reason for marking lost? (optional)") ?? undefined;
    run(() => updateLeadStage(leadId, to, reason));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Stage
          </label>
          <select
            value={stage}
            disabled={pending}
            onChange={onStage}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Assigned to
          </label>
          <select
            value={assignedStaff ?? ""}
            disabled={pending}
            onChange={(e) => run(() => assignLead(leadId, e.target.value || null))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.id === currentUserId ? " (me)" : ""}
              </option>
            ))}
          </select>
          {assignedStaff !== currentUserId ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => assignLead(leadId, currentUserId))}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky/30 px-3 py-1.5 text-sm font-medium text-sky transition hover:bg-sky/5 disabled:opacity-50"
            >
              <UserPlus size={14} /> Assign to me
            </button>
          ) : null}
        </div>

        {converted ? (
          <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            <BadgeCheck size={16} /> Converted
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Convert this lead to a client? This marks it Won."))
                run(() => convertLead(leadId));
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <BadgeCheck size={16} /> Convert to client
          </button>
        )}

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      <AddActivity leadId={leadId} />
    </div>
  );
}

function AddActivity({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<ActivityKind>("note");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) {
      setError("Note cannot be empty.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addLeadActivity(leadId, kind, body);
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <form onSubmit={onSubmit} className="space-y-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
          Log activity
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ActivityKind)}
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          {ACTIVITY_KINDS.map((k) => (
            <option key={k} value={k}>
              {ACTIVITY_LABEL[k]}
            </option>
          ))}
        </select>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="What happened?"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}
        <Button variant="primary" type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Add to timeline"}
        </Button>
      </form>
    </div>
  );
}
