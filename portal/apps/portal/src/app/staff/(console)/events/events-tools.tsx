"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { RefreshCw, Zap } from "lucide-react";
import { dispatchEvents } from "@/lib/events-actions";

// "Process now" — manually drain the outbox and report how many events fanned
// out into notifications. The page otherwise auto-dispatches on money actions.
export function DispatchButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await dispatchEvents();
      if (res.ok) {
        setMsg(
          res.dispatched === 0
            ? "Nothing pending — all caught up."
            : `Dispatched ${res.dispatched} event${res.dispatched === 1 ? "" : "s"}.`,
        );
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {msg ? <span className="text-xs font-medium text-emerald-600">{msg}</span> : null}
      {err ? <span className="text-xs font-medium text-rose-600">{err}</span> : null}
      <Button variant="primary" onClick={run} disabled={pending}>
        {pending ? (
          <RefreshCw size={16} className="mr-1.5 animate-spin" />
        ) : (
          <Zap size={16} className="mr-1.5" />
        )}
        {pending ? "Processing…" : "Process now"}
      </Button>
    </div>
  );
}
