import { NoAccess } from "@/components/control/bits";
import { BOARD_STEP, type TicketBoardColumn } from "@/components/control/board-shared";
import { controlMeta, firstParam } from "@/components/control/format";
import type { TicketListItem } from "@/components/control/ticket-bits";
import { TicketsView, type LateInfo, type TicketsViewProps } from "@/components/control/views/TicketsView";
import { readTicketColumn } from "@/lib/server/boards";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/server/constants";
import { overdueMatching, ticketsFiltered } from "@/lib/server/lists/tickets";
import { readViews } from "@/lib/server/personal";
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
 *
 * `?view=board` shows the same tickets as a board, one column per status: one
 * query per status (its count and its first cards, in the queue's order), and
 * the list is not asked. The filters belong to the list and are not applied.
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
  const boardView = firstParam(params.view) === "board";
  const overdue = !boardView && firstParam(params.overdue) === "1";
  const pageParam = Number.parseInt(firstParam(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 100000 ? pageParam : 1;

  // the filters are applied in src/lib/server/lists/tickets.ts, which a saved view's count on the dashboard uses too
  const query = ticketsFiltered(supabase, { status, category, priority, who, q }, ctx.userId)
    .order("last_customer_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  // with the Overdue filter on, the list is the function's answer and the table is not asked
  const [result, names, overdueResult, boardResults, views] = await Promise.all([
    overdue || boardView ? null : query,
    staffDirectory(supabase),
    supabase.rpc("tickets_overdue"),
    boardView ? Promise.all(TICKET_STATUSES.map((s) => readTicketColumn(supabase, s, BOARD_STEP))) : null,
    // saved views belong to the list and its filters, which the board does not use
    boardView ? null : readViews(ctx, "tickets", params),
  ]);
  const board: TicketBoardColumn[] | undefined = boardResults ? TICKET_STATUSES.map((s, i) => ({ status: s, count: boardResults[i]?.count ?? 0, cards: boardResults[i]?.cards ?? [] })) : undefined;

  const overdueRows: TicketOverdueRow[] | null = overdueResult.error ? null : ((overdueResult.data ?? []) as TicketOverdueRow[]);
  const late = new Map<string, LateInfo>();
  for (const row of overdueRows ?? []) late.set(row.id, { hours: Number(row.hours_overdue), escalatedAt: row.escalated_at ?? null });

  let tickets: TicketListItem[];
  let total: number;
  let failed: boolean;
  let pastEnd: boolean;
  if (overdue) {
    const matching = overdueMatching(overdueRows ?? [], { category, priority, who, q }, ctx.userId);
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
      canAssign={can(ctx, "leads.assign")}
      view={boardView ? "board" : "list"}
      board={board}
      boardFailed={!!boardResults && boardResults.some((r) => r.failed)}
      manage={can(ctx, "tickets.manage")}
      views={views ?? undefined}
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
