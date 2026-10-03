"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@gio4x/ui";

export type Tab = { id: string; label: string; content: ReactNode };

/**
 * Tabs — uncontrolled by default. Pass `value` + `onChange` together to make
 * it controlled (e.g. when an external trigger like a method tile should
 * change the active tab). `initial` is ignored in controlled mode.
 */
export function Tabs({
  tabs,
  initial,
  value,
  onChange,
}: {
  tabs: Tab[];
  initial?: string;
  value?: string;
  onChange?: (id: string) => void;
}) {
  const isControlled = value !== undefined && typeof onChange === "function";
  const [internal, setInternal] = useState(initial ?? tabs[0]?.id);
  const active = isControlled ? value! : internal;
  const setActive = (id: string) => {
    if (isControlled) onChange!(id);
    else setInternal(id);
  };
  const current = tabs.find((t) => t.id === active);
  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-slate-100">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "relative px-4 py-2.5 text-sm transition",
                isActive ? "font-semibold text-navy" : "text-steel hover:text-navy",
              )}
            >
              {t.label}
              {isActive ? (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-sky" />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-5">{current?.content}</div>
    </div>
  );
}
