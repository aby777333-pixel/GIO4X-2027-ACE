import type { ReactNode } from "react";
import { cn } from "@gio4x/ui";

type Metric = {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "flat";
  icon?: ReactNode;
  hint?: string;
};

export function MetricGrid({ metrics, columns = 4 }: { metrics: Metric[]; columns?: 2 | 3 | 4 | 5 }) {
  const colClass = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-5",
  }[columns];

  return (
    <div className={cn("grid grid-cols-1 gap-3", colClass)}>
      {metrics.map((m) => (
        <div
          key={m.label}
          className="flex flex-col gap-1.5 rounded-glass border border-slate-200/70 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-steel">
            <span>{m.label}</span>
            {m.icon ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky/10 text-sky">
                {m.icon}
              </span>
            ) : null}
          </div>
          <div className="text-2xl font-bold leading-none text-navy">{m.value}</div>
          {m.delta ? (
            <div
              className={cn(
                "text-[11px] font-medium",
                m.deltaDirection === "up"
                  ? "text-success"
                  : m.deltaDirection === "down"
                    ? "text-danger"
                    : "text-steel",
              )}
            >
              {m.deltaDirection === "up" ? "▲ " : m.deltaDirection === "down" ? "▼ " : ""}
              {m.delta}
            </div>
          ) : null}
          {m.hint ? <div className="text-[11px] text-steel-light">{m.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
