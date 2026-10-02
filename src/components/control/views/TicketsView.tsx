import Link from "next/link";
import { escalateTicket } from "@/app/control/actions-ticket-tools";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { SubmitButton } from "@/components/control/SubmitButton";
import { ReplyDue, ticketAssignee, TicketPriorityBadge, TicketStatusBadge, type TicketListItem } from "@/components/control/ticket-bits";
import { overdueText } from "@/components/control/ticket-tools";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, TICKET_PRIORITIES, TICKET_PRIORITY_LABEL, TICKET_STATUSES, TICKET_STATUS_LABEL, TICKET_TARGET_HOURS } from "@/lib/server/constants";
import type { TicketCategory, TicketPriority, TicketStatus } from "@/lib/supabase/types";

/** What tickets_overdue() said about one ticket: how far past its target it is, and whether it has been escalated. */
export type LateInfo = { hours: number; escalatedAt: string | null };

export type TicketsViewProps = {
  /** "" is the default queue: open and waiting for the customer together */
  status: TicketStatus | "all" | "";
  category: TicketCategory | "";
  priority: TicketPriority | "";
  /** "" is everyone */
  who: "mine" | "unassigned" | "";
  q: string;
  /** only tickets past their reply target (the list then comes from tickets_overdue(), longest overdue first) */
  overdue: boolean;
  /** how many tickets are past their target, counted by the database; null when it could not be read */
  overdueCount: number | null;
  /** the database returned as many rows as it will in one answer, so there may be more */
  overdueCapped: boolean;
  /** by ticket id, for the tickets on this page that are past their target */
  late: Map<string, LateInfo>;
  /** may escalate (tickets.write) */
  writable: boolean;
  /** may manage canned replies and assignment rules (tickets.manage) */
  manage: boolean;
  notice?: string;
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
export function TicketsView({
  status,
  category,
  priority,
  who,
  q,
  overdue,
  overdueCount,
  overdueCapped,
  late,
  writable,
  manage,
  notice,
  error,
  failed,
  pastEnd,
  tickets,
  names,
  me,
  now,
  total,
  page,
  pageCount,
}: TicketsViewProps) {
  const filtered = !!(status || category || priority || who || q || overdue);
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (overdue) sp.set("overdue", "1");
    if (status) sp.set("status", status);
    if (category) sp.set("category", category);
    if (priority) sp.set("priority", priority);
    if (who) sp.set("who", who);
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/control/tickets?${s}` : "/control/tickets";
  };
  const caption = overdue
    ? "Tickets past their reply target, the longest overdue first"
    : filtered
      ? "Tickets matching the current filters, newest customer activity first"
      : "Tickets that need work, newest customer activity first";
  const overdueHeading =
    overdueCount === null
      ? "The number of overdue tickets could not be read"
      : overdueCount === 0
        ? "No ticket is past its reply target"
        : `${overdueCount}${overdueCapped ? " or more" : ""} ${overdueCount === 1 ? "ticket is" : "tickets are"} past ${overdueCount === 1 ? "its" : "their"} reply target`;

  return (
    <>
      <ControlHead
        title="Tickets"
        lead="Requests for help opened on the website. The ones a customer wrote on most recently come first."
        actions={
          manage ? (
            <>
              <Link href="/control/tickets/macros" className="btn btn-ghost">
                Canned replies
              </Link>
              <Link href="/control/tickets/rules" className="btn btn-ghost">
                Assignment rules
              </Link>
            </>
          ) : undefined
        }
      />

      {(notice || error) && (
        <div className="mt-21 grid gap-13">
          {notice && !error && <Notice title={notice} tone="ok" />}
          {error && <Notice title={error} tone="error" />}
        </div>
      )}

      <section aria-labelledby="tickets-overdue" className="gxc-card mt-21 px-21 py-13">
        <div className="flex flex-wrap items-center justify-between gap-x-21 gap-y-8">
          <h2 id="tickets-overdue" className={`text-sm font-semibold ${overdueCount ? "text-neg" : "text-ink"}`}>
            {overdueHeading}
          </h2>
          {overdue ? (
            <Link href="/control/tickets" className="btn btn-ghost btn-sm">
              Back to the whole queue
            </Link>
          ) : overdueCount ? (
            <Link href="/control/tickets?overdue=1" className="btn btn-ghost btn-sm">
              Show overdue tickets
            </Link>
          ) : null}
        </div>
        <p className="mt-5 max-w-measure text-xs text-ink-3">
          Overdue means open, not yet answered, and past the internal target for its priority. Nothing escalates by itself: there is no timed job, so a ticket is escalated when a person presses Escalate. The Command Centre shows the
          same late count.
        </p>
      </section>

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
        <label className="check sm:col-span-2 lg:col-span-4">
          <input type="checkbox" name="overdue" value="1" defaultChecked={overdue} />
          <span>
            <span className="font-medium text-ink">Overdue only</span>
            <span className="block text-xs text-ink-3">Past the reply target, the longest overdue first. Overdue tickets are always Open, so Status is not used while this is ticked.</span>
          </span>
        </label>
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

      {overdue && writable && !failed && tickets.length > 0 && (
        <p className="mt-13 max-w-measure text-sm text-ink-2">
          <span className="font-semibold text-ink">What Escalate does:</span> it raises the ticket’s priority one step (Low, Normal, High, Urgent), marks it as escalated, and records both with your name and the time. It can be done once
          per ticket. It does not assign the ticket or notify anyone.
        </p>
      )}

      <div className="mt-13">
        {failed ? (
          <Notice title="The tickets could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        ) : tickets.length ? (
          <TicketsTable tickets={tickets} names={names} me={me} now={now} caption={caption} overdue={overdue} late={late} writable={writable} />
        ) : pastEnd ? (
          <Empty title="There is no such page">
            <p>
              <Link href={href(1)} className="link">
                Go to the first page
              </Link>
            </p>
          </Empty>
        ) : overdue ? (
          <Empty title={category || priority || who || q ? "Nothing overdue matches these filters" : "Nothing is overdue"}>
            <p>
              No open ticket that is still waiting for a first reply is past its target{category || priority || who || q ? " with these filters" : ""}.{" "}
              <Link href="/control/tickets" className="link">
                Go back to what needs work
              </Link>
              .
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

/** How late, and either that it has been escalated or the button that escalates it. Only in the overdue list. */
function Escalation({ ticket, info, writable }: { ticket: TicketListItem; info: LateInfo | undefined; writable: boolean }) {
  if (!info) return null;
  return (
    <div className="grid justify-items-start gap-5 text-xs">
      <span className="font-semibold text-neg">Late by {overdueText(info.hours)}</span>
      {info.escalatedAt ? (
        <span className="text-ink-2">
          <span className="font-semibold text-ink">Escalated</span> <span className="num">{fmtDateTime(info.escalatedAt)}</span>
        </span>
      ) : writable ? (
        <form action={escalateTicket}>
          <input type="hidden" name="id" value={ticket.id} />
          <input type="hidden" name="from" value="queue" />
          <SubmitButton pending="Escalating…" className="btn btn-ghost btn-sm">
            Escalate<span className="sr-only"> {ticket.reference}</span>
          </SubmitButton>
        </form>
      ) : (
        <span className="text-ink-3">Not escalated</span>
      )}
    </div>
  );
}

/**
 * Tickets as a table from `md` up and as stacked rows on a phone: the same
 * facts, composed for the width rather than squeezed into it.
 */
function TicketsTable({
  tickets,
  names,
  me,
  now,
  caption,
  overdue,
  late,
  writable,
}: {
  tickets: TicketListItem[];
  names: Map<string, string>;
  me: string;
  now: number;
  caption: string;
  overdue: boolean;
  late: Map<string, LateInfo>;
  writable: boolean;
}) {
  return (
    <>
      <div className="scroll-x hidden md:block">
        <table className={`table-gx text-sm ${overdue ? "min-w-[66rem]" : "min-w-[56rem]"}`}>
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
              {overdue && <th scope="col">Escalation</th>}
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
                  {/* in the whole queue an escalated ticket says so; the overdue list has its own column */}
                  {!overdue && late.get(ticket.id)?.escalatedAt && <span className="mt-3 block text-xs font-semibold text-ink-2">Escalated</span>}
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
                {overdue && (
                  <td className="align-top">
                    <Escalation ticket={ticket} info={late.get(ticket.id)} writable={writable} />
                  </td>
                )}
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
                {!overdue && late.get(ticket.id)?.escalatedAt && <span className="font-semibold text-ink-2">Escalated</span>}
              </span>
            </Link>
            {/* outside the link: a button cannot live inside one */}
            {overdue && late.has(ticket.id) && (
              <div className="pb-13">
                <Escalation ticket={ticket} info={late.get(ticket.id)} writable={writable} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
