"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { setSetting } from "@/lib/tech-hub-actions";

const SWITCHES = [
  { key: "kill_switch_trading", label: "Trading", danger: true },
  { key: "kill_switch_api", label: "APIs", danger: true },
  { key: "kill_switch_bridges", label: "Bridges", danger: true },
  { key: "maintenance_mode", label: "Maintenance mode", danger: false },
];

export function KillSwitches({ settings }: { settings: Record<string, unknown> }) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(SWITCHES.map((s) => [s.key, settings[s.key] === true])),
  );
  const [pending, start] = useTransition();

  function flip(key: string) {
    start(async () => {
      const next = !state[key];
      const r = await setSetting(key, next);
      if (r.ok) setState((s) => ({ ...s, [key]: next }));
    });
  }

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {SWITCHES.map((s) => {
        const active = state[s.key];
        return (
          <button
            key={s.key}
            type="button"
            disabled={pending}
            onClick={() => flip(s.key)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs transition disabled:opacity-60 ${
              active ? "border-rose-500/50 bg-rose-500/10 text-rose-300" : "tech-panel2 tech-border tech-muted hover:opacity-80"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {s.danger && <AlertTriangle size={13} className={active ? "text-rose-400" : ""} />}
              {s.label}
            </span>
            <span className={`text-[10px] font-bold uppercase ${active ? "text-rose-400" : "text-emerald-400"}`}>{active ? "OFF" : "ON"}</span>
          </button>
        );
      })}
    </div>
  );
}
