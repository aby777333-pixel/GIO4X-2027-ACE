"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { updateLeadStage } from "@/lib/crm-actions";
import { LEAD_STAGES, type LeadStage } from "@/lib/crm-constants";

export function StageMover({ leadId, stage }: { leadId: string; stage: LeadStage }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const idx = LEAD_STAGES.indexOf(stage);
  const prev = idx > 0 ? LEAD_STAGES[idx - 1] : null;
  const next = idx >= 0 && idx < LEAD_STAGES.length - 1 ? LEAD_STAGES[idx + 1] : null;

  function move(to: LeadStage | null) {
    if (!to) return;
    let reason: string | undefined;
    if (to === "lost") {
      reason = window.prompt("Reason for marking lost? (optional)") ?? undefined;
    }
    startTransition(async () => {
      const res = await updateLeadStage(leadId, to, reason);
      if (res.ok) router.refresh();
      else window.alert(res.error);
    });
  }

  return (
    <div className="mt-2 flex items-center justify-between gap-1">
      <button
        type="button"
        disabled={!prev || pending}
        onClick={() => move(prev)}
        className="inline-flex items-center rounded-md border border-slate-200 px-1.5 py-1 text-steel transition hover:border-sky/30 hover:text-navy disabled:opacity-30"
        aria-label="Move back a stage"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        type="button"
        disabled={!next || pending}
        onClick={() => move(next)}
        className="inline-flex items-center rounded-md border border-slate-200 px-1.5 py-1 text-steel transition hover:border-sky/30 hover:text-navy disabled:opacity-30"
        aria-label="Advance a stage"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
