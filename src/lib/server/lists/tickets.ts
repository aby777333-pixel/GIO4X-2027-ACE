/**
 * The Tickets queue's filters, in one place.
 *
 * The queue (/control/tickets) and a saved view pinned to the dashboard ask
 * the same question: the first wants a page of rows, the second only how many
 * there are. Both build their answer here, so a pinned view's count can never
 * mean something different from the list it opens.
 *
 * "Overdue" is the database's answer, not this file's: tickets_overdue()
 * (0013) returns the open, unanswered tickets past their internal target, and
 * the other filters narrow that answer here.
 */
import { TICKET_LIST_COLUMNS } from "@/components/control/ticket-bits";
import { viewParamsFrom, type ViewParams } from "@/components/control/views-shared";
import type { Db } from "@/lib/supabase/server";
import type { TicketCategory, TicketOverdueRow, TicketPriority, TicketStatus } from "@/lib/supabase/types";

export type TicketFilters = {
  /** "" is the default queue: open and waiting for the customer together */
  status: TicketStatus | "all" | "";
  category: TicketCategory | "";
  priority: TicketPriority | "";
  /** "" is everyone */
  who: "mine" | "unassigned" | "";
  /** already through cleanSearch(): only [A-Za-z0-9@._+-] */
  q: string;
};

/**
 * `tickets` with the filters applied, read as the signed-in member of staff.
 * The caller adds the order and the range. With `head` the database returns
 * the count and no rows.
 */
export function ticketsFiltered(supabase: Db, f: TicketFilters, me: string, head = false) {
  let query = supabase.from("tickets").select(TICKET_LIST_COLUMNS, { count: "exact", head });
  // no status asked for: what still needs somebody (open, or waiting for the customer)
  if (f.status === "") query = query.in("status", ["open", "pending"]);
  else if (f.status !== "all") query = query.eq("status", f.status);
  if (f.category) query = query.eq("category", f.category);
  if (f.priority) query = query.eq("priority", f.priority);
  if (f.who === "mine") query = query.eq("assigned_to", me);
  else if (f.who === "unassigned") query = query.is("assigned_to", null);
  // q contains only [A-Za-z0-9@._+-]; the quotes keep dots inside the value
  if (f.q) query = query.or(`reference.ilike."%${f.q}%",email.ilike."%${f.q}%"`);
  return query;
}

/** The overdue tickets the other filters leave. Status is not used: an overdue ticket is always open. */
export function overdueMatching(rows: TicketOverdueRow[], f: Omit<TicketFilters, "status">, me: string): TicketOverdueRow[] {
  const needle = f.q.toLowerCase();
  return rows.filter(
    (row) =>
      (!f.category || row.category === f.category) &&
      (!f.priority || row.priority === f.priority) &&
      (f.who === "mine" ? row.assigned_to === me : f.who === "unassigned" ? row.assigned_to === null : true) &&
      (!needle || row.reference.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle)),
  );
}

/** How many tickets a saved view matches now. Null when it could not be counted. */
export async function countTicketsView(supabase: Db, stored: ViewParams, me: string): Promise<number | null> {
  const p = viewParamsFrom("tickets", stored);
  const f: TicketFilters = {
    status: (p.status ?? "") as TicketStatus | "all" | "",
    category: (p.category ?? "") as TicketCategory | "",
    priority: (p.priority ?? "") as TicketPriority | "",
    who: p.who === "mine" || p.who === "unassigned" ? p.who : "",
    q: "",
  };
  if (p.overdue) {
    const { data, error } = await supabase.rpc("tickets_overdue");
    return error ? null : overdueMatching((data ?? []) as TicketOverdueRow[], f, me).length;
  }
  const { count, error } = await ticketsFiltered(supabase, f, me, true);
  return error || count === null ? null : count;
}
