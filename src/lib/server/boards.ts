/**
 * Reading one column of a board AS THE SIGNED-IN USER. Used by the pages
 * (the first cards of every column) and by the "Show more" routes (one column
 * again, with a larger limit), so both always ask the same question in the
 * same order. Row-level security decides what comes back.
 */
import { LEAD_CARD_COLUMNS, TICKET_CARD_COLUMNS, type LeadCard, type TicketCard } from "@/components/control/board-shared";
import type { Db } from "@/lib/supabase/server";
import type { LeadStage, TicketStatus } from "@/lib/supabase/types";

export type ColumnRead<C> = { failed: boolean; count: number; cards: C[] };

/** One pipeline stage: spam left out, highest score first, then newest (the Pipeline's order since it was built). */
export async function readLeadColumn(supabase: Db, stage: LeadStage, limit: number): Promise<ColumnRead<LeadCard>> {
  try {
    const { data, count, error } = await supabase
      .from("leads")
      .select(LEAD_CARD_COLUMNS, { count: "exact" })
      .eq("stage", stage)
      .neq("status", "spam")
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    return { failed: !!error, count: count ?? 0, cards: (data ?? []) as LeadCard[] };
  } catch {
    return { failed: true, count: 0, cards: [] };
  }
}

/** One ticket status, in the queue's order: the customer who wrote most recently first, then newest. */
export async function readTicketColumn(supabase: Db, status: TicketStatus, limit: number): Promise<ColumnRead<TicketCard>> {
  try {
    const { data, count, error } = await supabase
      .from("tickets")
      .select(TICKET_CARD_COLUMNS, { count: "exact" })
      .eq("status", status)
      .order("last_customer_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    return { failed: !!error, count: count ?? 0, cards: (data ?? []) as TicketCard[] };
  } catch {
    return { failed: true, count: 0, cards: [] };
  }
}
