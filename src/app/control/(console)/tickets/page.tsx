import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { TICKET_LIST_COLUMNS, type TicketListItem } from "@/components/control/ticket-bits";
import { TicketsView, type TicketsViewProps } from "@/components/control/views/TicketsView";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/server/constants";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { cleanSearch } from "@/lib/server/validate";
import type { TicketCategory, TicketPriority, TicketStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Tickets", "/control/tickets");

const PER_PAGE = 25;

const ERRORS: Record<string, string> = {
  invalid: "That request was not valid. Nothing was changed.",
};

/**
 * The support queue: requests opened on the website, the ones a customer wrote
 * on most recently first. Filters and search arrive as query parameters and
 * are validated against allow-lists before they reach the database; the search
 * text is reduced to characters that cannot alter the filter.
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

  const [result, names] = await Promise.all([query, staffDirectory(supabase)]);
  // PGRST103: the requested page is past the end of the result
  const pastEnd = result.error?.code === "PGRST103";
  const failed = !!result.error && !pastEnd;
  const total = result.count ?? 0;

  return (
    <TicketsView
      status={status}
      category={category}
      priority={priority}
      who={who}
      q={q}
      error={ERRORS[firstParam(params.error)]}
      failed={failed}
      pastEnd={pastEnd}
      tickets={(result.data ?? []) as TicketListItem[]}
      names={names}
      me={ctx.userId}
      now={Date.now()}
      total={total}
      page={page}
      pageCount={Math.max(1, Math.ceil(total / PER_PAGE))}
    />
  );
}
