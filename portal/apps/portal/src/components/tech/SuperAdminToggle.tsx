"use client";

import { useState, useTransition } from "react";
import { setSuperAdmin } from "@/lib/tech-hub-actions";

export function SuperAdminToggle({ userId, on, self }: { userId: string; on: boolean; self: boolean }) {
  const [val, setVal] = useState(on);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex items-center justify-end gap-2">
      {err && <span className="text-[10px] text-rose-400">{err}</span>}
      <button
        type="button"
        disabled={pending || (self && val)}
        title={self && val ? "You can't revoke your own access" : ""}
        onClick={() =>
          start(async () => {
            setErr(null);
            const next = !val;
            const r = await setSuperAdmin(userId, next);
            if (r.ok) setVal(next);
            else setErr(r.error);
          })
        }
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50 ${val ? "bg-sky-500" : "bg-slate-600"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${val ? "translate-x-4" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
