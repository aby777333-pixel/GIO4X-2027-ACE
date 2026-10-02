import { fmtDateTime } from "@/components/control/format";
import { TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, TICKET_TARGET_HOURS } from "@/lib/server/constants";
import type { TicketPriority, TicketRow, TicketStatus } from "@/lib/supabase/types";

/** What the queue shows for one ticket. The message itself is read only on the ticket's own page. */
export type TicketListItem = Pick<
  TicketRow,
  "id" | "reference" | "created_at" | "name" | "email" | "category" | "subject" | "status" | "priority" | "assigned_to" | "first_response_at" | "last_customer_at"
>;

export const TICKET_LIST_COLUMNS = "id, reference, created_at, name, email, category, subject, status, priority, assigned_to, first_response_at, last_customer_at";

// shape + label, never colour alone
const STATUS_CLASS: Record<TicketStatus, string> = {
  open: "state-overlap",
  pending: "state-pre",
  solved: "state-open",
  closed: "state-off",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`state whitespace-nowrap ${STATUS_CLASS[status]}`}>{TICKET_STATUS_LABEL[status]}</span>;
}

const PRIORITY_RANK: Record<TicketPriority, number> = { low: 1, normal: 2, high: 3, urgent: 4 };
const PRIORITY_CLASS: Record<TicketPriority, string> = {
  low: "text-ink-3",
  normal: "text-ink-2",
  high: "font-semibold text-warn",
  urgent: "font-semibold text-neg",
};

/** The priority in words, with one to four rising bars repeating it as a shape. */
export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const rank = PRIORITY_RANK[priority];
  return (
    <span className={`inline-flex items-center gap-5 whitespace-nowrap text-xs ${PRIORITY_CLASS[priority]}`}>
      <span aria-hidden className="inline-flex items-end gap-px">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`block w-[3px] rounded-[1px] bg-current ${n <= rank ? "" : "opacity-20"}`} style={{ height: `${3 + n * 2}px` }} />
        ))}
      </span>
      {TICKET_PRIORITY_LABEL[priority]}
    </span>
  );
}

/**
 * When a first reply is due, from real columns only: the ticket is open and
 * nobody has answered the customer yet. `created_at` plus the internal target
 * for its priority. Null once it has been answered, or when it is not open.
 */
export function replyDue(ticket: Pick<TicketRow, "created_at" | "status" | "priority" | "first_response_at">, now: number): { at: string; late: boolean } | null {
  if (ticket.first_response_at || ticket.status !== "open") return null;
  const opened = new Date(ticket.created_at).getTime();
  if (Number.isNaN(opened)) return null;
  const due = opened + TICKET_TARGET_HOURS[ticket.priority] * 60 * 60 * 1000;
  return { at: new Date(due).toISOString(), late: due < now };
}

/** "Reply due" with the time, or "Late" in words once that time has passed. Nothing once answered. */
export function ReplyDue({ ticket, now, stacked = false }: { ticket: Pick<TicketRow, "created_at" | "status" | "priority" | "first_response_at">; now: number; stacked?: boolean }) {
  const due = replyDue(ticket, now);
  if (!due) return null;
  return (
    <span className={`text-xs ${stacked ? "block" : "inline-flex flex-wrap items-baseline gap-x-5"}`}>
      <span className={`font-semibold ${due.late ? "text-neg" : "text-ink"} ${stacked ? "block" : ""}`}>{due.late ? "Late" : "Reply due"}</span>
      <span className={`num text-ink-3 ${stacked ? "block max-w-[9.5rem]" : "whitespace-nowrap"}`}>
        {due.late ? "was due " : ""}
        {fmtDateTime(due.at)}
      </span>
    </span>
  );
}

/** Who holds a ticket, as the person looking at it would say it. */
export function ticketAssignee(assignedTo: string | null, names: Map<string, string>, me: string): string {
  if (!assignedTo) return "Unassigned";
  if (assignedTo === me) return "You";
  return names.get(assignedTo) ?? "Assigned";
}
