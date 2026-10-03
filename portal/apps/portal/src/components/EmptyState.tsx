import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky/10 text-sky">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-navy">{title}</h3>
      {hint ? <p className="max-w-sm text-xs text-steel">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
