import Link from "next/link";
import type { ReactNode } from "react";
import { Rosette } from "@/components/brand/Rosette";
import { fmtDateTime } from "@/components/control/format";
import { LEAD_STAGE_LABEL, LEAD_STATUS_LABEL } from "@/lib/server/constants";
import type { LeadStage, LeadStatus } from "@/lib/supabase/types";

/**
 * Page opening inside the console, as the Service Console had it: a bold
 * title, one line beneath, actions to the right. `eyebrow` is accepted for
 * the callers that pass one and is no longer drawn: the sidebar already says
 * which section this is.
 */
export function ControlHead({ title, lead, actions }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-13 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="h3">{title}</h1>
        {lead && <p className="mt-5 max-w-measure text-sm text-ink-3">{lead}</p>}
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

const STAGE_CLASS: Record<LeadStage, string> = {
  enquiry: "state-pre",
  contacted: "state-open",
  qualified: "state-open",
  applying: "state-open",
  client: "state-overlap",
  lost: "state-off",
};

export function StageBadge({ stage }: { stage: LeadStage }) {
  return <span className={`state ${STAGE_CLASS[stage]}`}>{LEAD_STAGE_LABEL[stage]}</span>;
}

/** The score as a number out of 100 with a bar; the label carries the meaning, the bar only repeats it. */
export function Score({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className="inline-flex items-center gap-8" title="Score out of 100, computed from what the enquirer told us">
      <span className="num w-[1.75rem] text-right text-sm text-ink">{v}</span>
      <span aria-hidden className="h-3 w-[2.125rem] overflow-hidden rounded-full bg-line">
        <span className="block h-full bg-accent" style={{ width: `${v}%` }} />
      </span>
    </span>
  );
}

/** A due time, with "Overdue" or "Today" said in words rather than by colour alone. */
export function Due({ iso, state }: { iso: string; state: "overdue" | "today" | "later" }) {
  return (
    <span className="num whitespace-nowrap text-ink-2">
      {state !== "later" && <span className={`mr-8 font-sans text-xs font-semibold ${state === "overdue" ? "text-neg" : "text-ink"}`}>{state === "overdue" ? "Overdue" : "Today"}</span>}
      {fmtDateTime(iso)}
    </span>
  );
}

/** Shown in place of a section the caller's role does not include. */
export function NoAccess({ title }: { title: string }) {
  return (
    <>
      <ControlHead title={title} />
      <div className="mt-21">
        <Notice title="Your role does not include this section">If you need it for your work, ask an administrator to change your role on the Staff page.</Notice>
      </div>
    </>
  );
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
