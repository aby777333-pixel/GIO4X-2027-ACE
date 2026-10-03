"use client";

import { useState, useTransition } from "react";
import { toggleModule } from "@/lib/tech-hub-actions";

export function ModuleToggle({ moduleKey, enabled }: { moduleKey: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !on;
          const r = await toggleModule(moduleKey, next);
          if (r.ok) setOn(next);
        })
      }
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50 ${on ? "bg-emerald-500" : "bg-slate-600"}`}
      title={on ? "Enabled — click to disable" : "Disabled — click to enable"}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${on ? "translate-x-4" : "translate-x-1"}`} />
    </button>
  );
}
