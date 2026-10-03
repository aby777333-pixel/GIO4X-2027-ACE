"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import { setCustomerStatus } from "@/lib/customer-actions";

export function CustomerActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function set(next: string) {
    setErr(null);
    startTransition(async () => {
      const r = await setCustomerStatus(id, next);
      if (r.ok) router.refresh();
      else setErr(r.error);
    });
  }

  const suspended = status === "suspended" || status === "closed";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {suspended ? (
        <button
          type="button"
          onClick={() => set("active")}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 size={14} /> {pending ? "Working…" : "Activate account"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => set("suspended")}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
        >
          <Ban size={14} /> {pending ? "Working…" : "Suspend account"}
        </button>
      )}
      {err ? <span className="text-[11px] font-medium text-rose-600">{err}</span> : null}
    </div>
  );
}
