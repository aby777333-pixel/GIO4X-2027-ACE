"use client";

// Feature-flag toggles for the Configuration Centre. Admin-only writes via the
// feature_flags RLS + the setFeatureFlag action.

import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { setFeatureFlag, type FeatureFlag } from "@/lib/config-actions";

export function FlagsClient({ flags: initial }: { flags: FeatureFlag[] }) {
  const [flags, setFlags] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (f: FeatureFlag) =>
    start(async () => {
      const next = !f.enabled;
      const r = await setFeatureFlag(f.key, next);
      if (r.ok) {
        setFlags((prev) => prev.map((x) => (x.key === f.key ? { ...x, enabled: next } : x)));
        setNotice(`${f.key} ${next ? "enabled" : "disabled"}`);
      } else setNotice(r.error ?? "Update failed");
    });

  if (flags.length === 0) return <p className="text-[12px] text-steel">No feature flags defined.</p>;

  return (
    <div className="space-y-2">
      {notice && <div className="rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-[12px] text-success">{notice}</div>}
      {flags.map((f) => (
        <div key={f.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[12px] font-semibold text-navy">
              {f.key}
              <StatusBadge tone={f.enabled ? "success" : "neutral"}>{f.enabled ? "on" : "off"}</StatusBadge>
            </div>
            {f.description && <div className="text-[11px] text-steel">{f.description}</div>}
          </div>
          <button
            onClick={() => toggle(f)}
            disabled={pending}
            aria-label={`Toggle ${f.key}`}
            className="relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40"
            style={{ backgroundColor: f.enabled ? "#0ea5e9" : "#cbd5e1" }}
          >
            <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: f.enabled ? 22 : 2 }} />
          </button>
        </div>
      ))}
      <p className="text-[11px] text-steel">Flags gate the matching platform module. Changes take effect on the next load for every user.</p>
    </div>
  );
}
