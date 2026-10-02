/**
 * What the two boards (Pipeline, Tickets) and the server share: which columns
 * a card is made from, how many cards a column shows, and the shape of the
 * answer when a column asks for more. Plain data, safe on both sides.
 */
import type { WriteCode } from "@/lib/server/crm-writes";
import type { LeadRow, LeadStage, TicketRow, TicketStatus } from "@/lib/supabase/types";

/** A card on the Pipeline board. No address: the card names the person and the enquiry's page has the rest. */
export type LeadCard = Pick<LeadRow, "id" | "reference" | "created_at" | "name" | "topic" | "assigned_to" | "stage" | "score">;
export const LEAD_CARD_COLUMNS = "id, reference, created_at, name, topic, assigned_to, stage, score";

/** A card on the Tickets board. Neither the customer's name nor their address is read for it. */
export type TicketCard = Pick<TicketRow, "id" | "reference" | "created_at" | "subject" | "status" | "priority" | "assigned_to" | "first_response_at" | "last_customer_at">;
export const TICKET_CARD_COLUMNS = "id, reference, created_at, subject, status, priority, assigned_to, first_response_at, last_customer_at";

/** Cards a column shows at first, and how many each "Show more" adds. */
export const BOARD_STEP = 8;
/** The most cards one column will hold; past this the column links to the list. */
export const BOARD_MAX = 200;

export type LeadBoardColumn = { stage: LeadStage; count: number; cards: LeadCard[] };
export type TicketBoardColumn = { status: TicketStatus; count: number; cards: TicketCard[] };

/** What GET /control/pipeline/more and /control/tickets/board-more answer with. */
export type BoardMoreAnswer<C> = { ok: true; count: number; cards: C[] };

/**
 * The outcome of dropping a card, as a fixed code. `signed-out` and
 * `unavailable` are about the caller; the rest are WriteCode (crm-writes.ts).
 */
export type BoardCode = WriteCode | "signed-out" | "unavailable";
export type BoardResult = { code: BoardCode };

// newest first; a time that cannot be read sorts last
const newestFirst = (a: string | null, b: string | null): number => {
  const ta = a ? Date.parse(a) : Number.NaN;
  const tb = b ? Date.parse(b) : Number.NaN;
  if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
  if (Number.isNaN(ta)) return 1;
  if (Number.isNaN(tb)) return -1;
  return tb - ta;
};

/** The same order the Pipeline has always used: highest score first, then newest. */
export function compareLeadCards(a: LeadCard, b: LeadCard): number {
  return b.score - a.score || newestFirst(a.created_at, b.created_at);
}

/** The queue's order: the customer who wrote most recently first (never-written last), then newest. */
export function compareTicketCards(a: TicketCard, b: TicketCard): number {
  return newestFirst(a.last_customer_at, b.last_customer_at) || newestFirst(a.created_at, b.created_at);
}

/** Two letters for a name, as the sidebar draws its own. */
export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") || "S"
  );
}
