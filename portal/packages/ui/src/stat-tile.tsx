import type { ReactNode } from "react";
import { cn } from "./cn";

type StatTileProps = {
  icon?: ReactNode;
  label: string;
  value: string;
  unit?: string;
  active?: boolean;
  onClick?: () => void;
};

export function StatTile({ icon, label, value, unit, active, onClick }: StatTileProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition",
        active
          ? "border-transparent bg-sky text-white shadow-md"
          : "border-slate-200 bg-white hover:border-sky/40 hover:bg-sky/5",
      )}
    >
      {icon ? (
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            active ? "bg-white/20 text-white" : "bg-sky/10 text-sky",
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className={cn("text-xs", active ? "text-white/80" : "text-steel")}>{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={cn("text-lg font-semibold", active ? "text-white" : "text-navy")}>
          {value}
        </span>
        {unit ? (
          <span className={cn("text-xs", active ? "text-white/70" : "text-steel-light")}>
            {unit}
          </span>
        ) : null}
      </span>
    </Tag>
  );
}
