"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { runDealerSync } from "@/lib/dealer-actions";

export function DealerSyncButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-[11px] tech-muted">{msg}</span>}
      <button
        onClick={() => start(async () => {
          setMsg(null);
          const r = await runDealerSync();
          if (r.ok) { setMsg(`Synced ${r.positions} positions · ${r.exposure} exposure rows`); router.refresh(); }
          else setMsg(r.error);
        })}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border tech-border tech-panel2 px-3 py-1.5 text-xs font-semibold hover:opacity-80 disabled:opacity-50"
        title="Pull live positions from GIO Raptor and recompute exposure"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync from Raptor
      </button>
    </div>
  );
}
