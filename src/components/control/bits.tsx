import Link from "next/link";
import type { ReactNode } from "react";
import { Rosette } from "@/components/brand/Rosette";
import { LEAD_STATUS_LABEL } from "@/lib/server/constants";
import type { LeadStatus } from "@/lib/supabase/types";

/** Page opening inside the console: one <h1>, sized for work rather than display. */
export function ControlHead({ eyebrow, title, lead, actions }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-21 border-b border-line pb-21 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className={`h3 ${eyebrow ? "mt-13" : ""}`}>{title}</h1>
        {lead && <p className="mt-8 max-w-measure text-sm text-ink-2">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-13">{actions}</div>}
    </header>
  );
}

// shape + label, never colour alone
const STATE_CLASS: Record<LeadStatus, string> = {
  new: "state-overlap",
  open: "state-open",
  waiting: "state-pre",
  resolved: "state-off",
  spam: "state-off",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`state ${STATE_CLASS[status]} ${status === "spam" ? "line-through" : ""}`}>{LEAD_STATUS_LABEL[status]}</span>;
}

/** A message from the system: what happened and what to do next. */
export function Notice({ title, children, tone = "info" }: { title: string; children?: ReactNode; tone?: "info" | "error" | "ok" }) {
  const mark = tone === "error" ? "border-l-neg" : tone === "ok" ? "border-l-pos" : "border-l-accent";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`panel-quiet border-l-2 ${mark} px-21 py-13`}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children && <div className="mt-3 max-w-measure text-sm text-ink-2">{children}</div>}
    </div>
  );
}

/** Nothing here yet, said plainly. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-13 border-b border-line py-34">
      <Rosette size={34} blades={5} className="text-ink-3" />
      <p className="h4">{title}</p>
      {children && <div className="max-w-measure text-sm text-ink-2">{children}</div>}
    </div>
  );
}

/** Previous / next with the position stated. `href(page)` builds the link, keeping the current filters. */
export function Pager({ page, pageCount, total, noun, href }: { page: number; pageCount: number; total: number; noun: string; href: (page: number) => string }) {
  return (
    <nav aria-label="Pagination" className="mt-21 flex flex-wrap items-center justify-between gap-13 text-sm text-ink-3">
      <p className="num">
        {total} {noun}
        {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
      </p>
      {pageCount > 1 && (
        <div className="flex gap-8">
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className="btn btn-ghost">
              Previous
            </Link>
          ) : (
            <span className="btn btn-ghost" aria-disabled="true">
              Previous
            </span>
          )}
          {page < pageCount ? (
            <Link href={href(page + 1)} rel="next" className="btn btn-ghost">
              Next
            </Link>
          ) : (
            <span className="btn btn-ghost" aria-disabled="true">
              Next
            </span>
          )}
        </div>
      )}
    </nav>
  );
}

/** Label / value rows with hairlines; values wrap instead of overflowing. */
export function Facts({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl>
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-13 border-b border-line py-8">
          <dt className="text-sm text-ink-3">{row.label}</dt>
          <dd className="min-w-0 break-words text-sm text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
