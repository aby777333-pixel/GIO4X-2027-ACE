import Link from "next/link";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { ReplyDue, ticketAssignee, TicketPriorityBadge, TicketStatusBadge, type TicketListItem } from "@/components/control/ticket-bits";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, TICKET_PRIORITIES, TICKET_PRIORITY_LABEL, TICKET_STATUSES, TICKET_STATUS_LABEL, TICKET_TARGET_HOURS } from "@/lib/server/constants";
import type { TicketCategory, TicketPriority, TicketStatus } from "@/lib/supabase/types";

export type TicketsViewProps = {
  /** "" is the default queue: open and waiting for the customer together */
  status: TicketStatus | "all" | "";
  category: TicketCategory | "";
  priority: TicketPriority | "";
  /** "" is everyone */
  who: "mine" | "unassigned" | "";
  q: string;
  error?: string;
  failed: boolean;
  pastEnd: boolean;
  tickets: TicketListItem[];
  names: Map<string, string>;
  me: string;
  /** rendered-at time, for "Reply due" and "Late" */
  now: number;
  total: number;
  page: number;
  pageCount: number;
};

/** Presentation only. The filters shown here were validated by the page before they reached the database. */
export function TicketsView({ status, category, priority, who, q, error, failed, pastEnd, tickets, names, me, now, total, page, pageCount }: TicketsViewProps) {
  const filtered = !!(status || category || priority || who || q);
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (category) sp.set("category", category);
    if (priority) sp.set("priority", priority);
    if (who) sp.set("who", who);
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/control/tickets?${s}` : "/control/tickets";
  };
  const caption = filtered ? "Tickets matching the current filters, newest customer activity first" : "Tickets that need work, newest customer activity first";

  return (
    <>
      <ControlHead title="Tickets" lead="Requests for help opened on the website. The ones a customer wrote on most recently come first." />

      {error && (
        <div className="mt-21">
          <Notice title={error} tone="error" />
        </div>
      )}

      <form method="get" action="/control/tickets" role="search" aria-label="Filter tickets" className="mt-21 grid gap-13 border-b border-line pb-21 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="field sm:col-span-2 lg:col-span-4">
          <label htmlFor="tickets-q">Reference or email</label>
          <input id="tickets-q" name="q" type="search" className="input" defaultValue={q} maxLength={100} placeholder="TK-… or name@example.com" autoComplete="off" spellCheck={false} />
        </div>
        <div className="field">
          <label htmlFor="tickets-status">Status</label>
          <select id="tickets-status" name="status" className="select" defaultValue={status}>
            <option value="">Needs work</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TICKET_STATUS_LABEL[s]}
              </option>
            ))}
            <option value="all">All</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="tickets-category">Category</label>
          <select id="tickets-category" name="category" className="select" defaultValue={category}>
            <option value="">Any category</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TICKET_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tickets-priority">Priority</label>
          <select id="tickets-priority" name="priority" className="select" defaultValue={priority}>
            <option value="">Any priority</option>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TICKET_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tickets-who">Assigned to</label>
          <select id="tickets-who" name="who" className="select" defaultValue={who}>
            <option value="">Everyone</option>
            <option value="mine">Me</option>
            <option value="unassigned">Nobody yet</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-8 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="btn btn-primary">
            Apply
          </button>
          {filtered && (
            <Link href="/control/tickets" className="btn btn-quiet">
              Clear
            </Link>
          )}
          <p className="text-xs text-ink-3">“Needs work” is Open and Waiting for customer together.</p>
        </div>
      </form>

      <div className="mt-13">
        {failed ? (
          <Notice title="The tickets could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        ) : tickets.length ? (
          <TicketsTable tickets={tickets} names={names} me={me} now={now} caption={caption} />
        ) : pastEnd ? (
          <Empty title="There is no such page">
            <p>
              <Link href={href(1)} className="link">
                Go to the first page
              </Link>
            </p>
          </Empty>
        ) : filtered ? (
          <Empty title="Nothing matches these filters">
            <p>
              Try a different status, category or priority, or{" "}
              <Link href="/control/tickets" className="link">
                go back to what needs work
              </Link>
              .
            </p>
          </Empty>
        ) : (
          <Empty title="Nothing needs work">
            <p>
              No ticket is open or waiting for a customer. When someone asks for help on the website’s Support page, the request appears here with its reference.{" "}
              <Link href="/control/tickets?status=all" className="link">
                See all tickets
              </Link>
              , including solved and closed ones.
            </p>
          </Empty>
        )}
      </div>

      {!failed && !pastEnd && total > 0 && <Pager page={page} pageCount={pageCount} total={total} noun={total === 1 ? "ticket" : "tickets"} href={href} />}

      {!failed && tickets.length > 0 && (
        <p className="mt-13 max-w-measure text-xs text-ink-3">
          “Reply due” is an internal target counted from when the ticket was opened: {[...TICKET_PRIORITIES].reverse().map((p) => `${TICKET_TARGET_HOURS[p]} hours for ${TICKET_PRIORITY_LABEL[p]}`).join(", ")}. It is shown until the first reply
          to the customer, and is not a promise made to them.
        </p>
      )}
    </>
  );
}

/**
 * Tickets as a table from `md` up and as stacked rows on a phone: the same
 * facts, composed for the width rather than squeezed into it.
 */
function TicketsTable({ tickets, names, me, now, caption }: { tickets: TicketListItem[]; names: Map<string, string>; me: string; now: number; caption: string }) {
  return (
    <>
      <div className="scroll-x hidden md:block">
        <table className="table-gx min-w-[56rem] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Reference and subject</th>
              <th scope="col">From</th>
              <th scope="col">Category</th>
              <th scope="col">Priority</th>
              <th scope="col">Status</th>
              <th scope="col">Assigned</th>
              <th scope="col">Opened</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td className="max-w-[17rem] align-top">
                  <Link href={`/control/tickets/${ticket.id}`} className="link num whitespace-nowrap text-sm font-medium">
                    {ticket.reference}
                  </Link>
                  <span className="mt-3 block truncate text-ink" title={ticket.subject}>
                    {ticket.subject}
                  </span>
                </td>
                <td className="max-w-[12rem] align-top">
                  <span className="block truncate text-ink">{ticket.name}</span>
                  <span className="block truncate text-xs text-ink-3">{ticket.email}</span>
                </td>
                <td className="max-w-[10rem] align-top text-ink-2">{TICKET_CATEGORY_LABEL[ticket.category]}</td>
                <td className="align-top">
                  <TicketPriorityBadge priority={ticket.priority} />
                </td>
                <td className="align-top">
                  <TicketStatusBadge status={ticket.status} />
                  <span className="mt-5 block empty:hidden">
                    <ReplyDue ticket={ticket} now={now} stacked />
                  </span>
                </td>
                <td className="whitespace-nowrap align-top text-ink-2">{ticketAssignee(ticket.assigned_to, names, me)}</td>
                <td className="num align-top text-ink-2">
                  {/* the date over the time, so the column stays narrow */}
                  {fmtDateTime(ticket.created_at)
                    .split(", ")
                    .map((part, i) => (
                      <span key={part} className={`block whitespace-nowrap ${i ? "text-xs text-ink-3" : ""}`}>
                        {part}
                      </span>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden" aria-label={caption}>
        {tickets.map((ticket) => (
          <li key={ticket.id} className="border-b border-line">
            <Link href={`/control/tickets/${ticket.id}`} className="block py-13">
              <span className="flex items-center justify-between gap-13">
                <span className="num text-sm font-medium text-accent">{ticket.reference}</span>
                <TicketStatusBadge status={ticket.status} />
              </span>
              <span className="mt-5 block break-words text-sm font-medium text-ink">{ticket.subject}</span>
              <span className="mt-3 block truncate text-sm text-ink-2">{ticket.name}</span>
              <span className="block truncate text-xs text-ink-3">{ticket.email}</span>
              <span className="mt-8 flex flex-wrap items-center justify-between gap-x-13 gap-y-5">
                <TicketPriorityBadge priority={ticket.priority} />
                <ReplyDue ticket={ticket} now={now} />
              </span>
              <span className="mt-5 flex flex-wrap gap-x-13 text-xs text-ink-3">
                <span>{TICKET_CATEGORY_LABEL[ticket.category]}</span>
                <span>{ticketAssignee(ticket.assigned_to, names, me)}</span>
                <span className="num">Opened {fmtDateTime(ticket.created_at)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
