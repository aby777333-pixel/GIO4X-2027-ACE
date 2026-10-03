"use client";

import { cn } from "@gio4x/ui";

export function ChipFilter<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition",
            value === o
              ? "bg-navy text-white shadow"
              : "text-steel hover:text-navy",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
