import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { TICKET_LIST_COLUMNS, type TicketListItem } from "@/components/control/ticket-bits";
import { TicketsView, type LateInfo, type TicketsViewProps } from "@/components/control/views/TicketsView";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/server/constants";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { cleanSearch } from "@/lib/server/validate";
import type { TicketCategory, TicketOverdueRow, TicketPriority, TicketStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Tickets", "/control/tickets");

const PER_PAGE = 25;
/** The most rows the API returns in one answer. At this many, the overdue count is "this many or more". */
const API_MAX_ROWS = 1000;

const NOTICES: Record<string, string> = {
  escalated: "Escalated. The priority went up one step and the escalation is recorded with your name.",
  flagged: "Escalated. The ticket was already Urgent, so the priority is unchanged; the escalation is recorded with your name.",
};
const ERRORS: Record<string, string> = {
  invalid: "That request was not valid. Nothing was changed.",
  forbidden: "Your role does not allow that change. Nothing was changed.",
  save: "The change could not be saved. Nothing was changed; please try again.",
  escalated_already: "That ticket has already been escalated. A ticket can be escalated once; nothing was changed.",
  not_late: "That ticket is no longer late against its reply target (it has been answered, is not open, or is still in time). Nothing was changed.",
};

/**
 * The support queue: requests opened on the website, the ones a customer wrote
 * on most recently first. Filters and search arrive as query parameters and
 * are validated against allow-lists before they reach the database; the search
 * text is reduced to characters that cannot alter the filter.
 *
 * "Overdue" is the database's answer, not this page's: tickets_overdue()
 * (0013) returns the open, unanswered tickets past their internal target with
 * the database's own clock, the same rule the Command Centre counts as late.
 * With the Overdue filter on, that answer IS the list (longest overdue first)
 * and the other filters narrow it here; otherwise it only supplies the count
 * at the top and marks which tickets have been escalated. If it cannot be read
 * (for example 0013 is not applied yet) the queue itself still works.
 */
export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "tickets.read")) return <NoAccess title="Tickets" />;
  const { supabase } = ctx;

  const params = await searchParams;
  const statusParam = firstParam(params.status);
  // no status asked for: what still needs somebody (open, or waiting for the customer)
  const status: TicketsViewProps["status"] = statusParam === "all" ? "all" : (TICKET_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as TicketStatus) : "";
  const categoryParam = firstParam(params.category);
  const category = (TICKET_CATEGORIES as readonly string[]).includes(categoryParam) ? (categoryParam as TicketCategory) : "";
  const priorityParam = firstParam(params.priority);
  const priority = (TICKET_PRIORITIES as readonly string[]).includes(priorityParam) ? (priorityParam as TicketPriority) : "";
  const whoParam = firstParam(params.who);
  const who = whoParam === "mine" || whoParam === "unassigned" ? whoParam : "";
  const q = cleanSearch(firstParam(params.q));
  const overdue = firstParam(params.overdue) === "1";
  const pageParam = Number.parseInt(firstParam(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 100000 ? pageParam : 1;

  let query = supabase.from("tickets").select(TICKET_LIST_COLUMNS, { count: "exact" });
  if (status === "") query = query.in("status", ["open", "pending"]);
  else if (status !== "all") query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (priority) query = query.eq("priority", priority);
  if (who === "mine") query = query.eq("assigned_to", ctx.userId);
  else if (who === "unassigned") query = query.is("assigned_to", null);
  // q contains only [A-Za-z0-9@._+-]; the quotes keep dots inside the value
  if (q) query = query.or(`reference.ilike."%${q}%",email.ilike."%${q}%"`);
  query = query
    .order("last_customer_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  // with the Overdue filter on, the list is the function's answer and the table is not asked
  const [result, names, overdueResult] = await Promise.all([overdue ? null : query, staffDirectory(supabase), supabase.rpc("tickets_overdue")]);

  const overdueRows: TicketOverdueRow[] | null = overdueResult.error ? null : ((overdueResult.data ?? []) as TicketOverdueRow[]);
  const late = new Map<string, LateInfo>();
  for (const row of overdueRows ?? []) late.set(row.id, { hours: Number(row.hours_overdue), escalatedAt: row.escalated_at ?? null });

  let tickets: TicketListItem[];
  let total: number;
  let failed: boolean;
  let pastEnd: boolean;
  if (overdue) {
    const needle = q.toLowerCase();
    const matching = (overdueRows ?? []).filter(
      (row) =>
        (!category || row.category === category) &&
        (!priority || row.priority === priority) &&
        (who === "mine" ? row.assigned_to === ctx.userId : who === "unassigned" ? row.assigned_to === null : true) &&
        (!needle || row.reference.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle)),
    );
    total = matching.length;
    tickets = matching.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    failed = overdueRows === null;
    pastEnd = !failed && page > 1 && tickets.length === 0;
  } else {
    // PGRST103: the requested page is past the end of the result
    pastEnd = result?.error?.code === "PGRST103";
    failed = !!result?.error && !pastEnd;
    total = result?.count ?? 0;
    tickets = (result?.data ?? []) as TicketListItem[];
  }

  return (
    <TicketsView
      status={overdue ? "" : status}
      category={category}
      priority={priority}
      who={who}
      q={q}
      overdue={overdue}
      overdueCount={overdueRows ? overdueRows.length : null}
      overdueCapped={!!overdueRows && overdueRows.length >= API_MAX_ROWS}
      late={late}
      writable={can(ctx, "tickets.write")}
      manage={can(ctx, "tickets.manage")}
      notice={NOTICES[firstParam(params.notice)]}
      error={ERRORS[firstParam(params.error)]}
      failed={failed}
      pastEnd={pastEnd}
      tickets={tickets}
      names={names}
      me={ctx.userId}
      now={Date.now()}
      total={total}
      page={page}
      pageCount={Math.max(1, Math.ceil(total / PER_PAGE))}
    />
  );
}
