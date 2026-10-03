"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { setFundStatus, type StaffFund } from "@/lib/pamm-actions";
import type { Enums } from "@gio4x/supabase";

export function FundStatusButtons({ fund }: { fund: StaffFund }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(status: Enums<"pamm_fund_status">) {
    setErr(null);
    startTransition(async () => {
      const res = await setFundStatus(fund.id, status);
      if (res.ok) router.refresh();
      else setErr(res.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {err ? <span className="text-[10px] text-rose-600">{err}</span> : null}
      {fund.status !== "active" ? (
        <button
          type="button"
          onClick={() => run("active")}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 size={13} /> Approve
        </button>
      ) : (
        <button
          type="button"
          onClick={() => run("paused")}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-steel hover:text-navy disabled:opacity-50"
        >
          <PauseCircle size={13} /> Pause
        </button>
      )}
      <button
        type="button"
        onClick={() => run("closed")}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-steel hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
      >
        <XCircle size={13} /> Close
      </button>
    </div>
  );
}
