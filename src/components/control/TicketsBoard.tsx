"use client";

import Link from "next/link";
import { useMemo } from "react";
import { moveTicketStatus } from "@/app/control/actions-board";
import { Board, type BoardColumnData } from "@/components/control/Board";
import { BOARD_MAX, BOARD_STEP, compareTicketCards, initialsOf, type BoardMoreAnswer, type TicketBoardColumn, type TicketCard } from "@/components/control/board-shared";
import { ReplyDue, TicketPriorityBadge } from "@/components/control/ticket-bits";
import { TICKET_STATUS_LABEL, TICKET_STATUSES } from "@/lib/server/constants";
import type { TicketStatus } from "@/lib/supabase/types";

/** A refusal code from moveTicketStatus as a sentence. Nothing the server or the database said is shown. */
const REFUSALS: Record<string, string> = {
  "signed-out": "Your session has ended; sign in again and repeat the move.",
  unavailable: "The console could not reach the database just now.",
  forbidden: "Your role does not allow that change.",
  invalid: "That move was not valid.",
  save: "The change could not be saved.",
  network: "The server could not be reached.",
};

const STATUS_NOTE: Record<TicketStatus, string> = {
  open: "Needs a reply or more work from staff",
  pending: "Staff have replied; the customer has not written back",
  solved: "Answered; a new message from the customer reopens it",
  closed: "Finished; it takes no more replies",
};

const isStatus = (v: string): v is TicketStatus => (TICKET_STATUSES as readonly string[]).includes(v);

async function moreTickets(status: string, limit: number): Promise<{ count: number; cards: TicketCard[] } | null> {
  const response = await fetch(`/control/tickets/board-more?status=${encodeURIComponent(status)}&limit=${limit}`, {
    cache: "no-store",
    credentials: "same-origin",
    redirect: "manual",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as Partial<BoardMoreAnswer<TicketCard>>;
  if (body.ok !== true || typeof body.count !== "number" || !Array.isArray(body.cards)) return null;
  return { count: body.count, cards: body.cards };
}

/** Who holds the ticket, as two letters with the name beside them for assistive technology. No address is ever drawn. */
function Assignee({ assignedTo, names, me }: { assignedTo: string | null; names: Record<string, string>; me: string }) {
  if (!assignedTo) return <span className="text-xs text-ink-3">Unassigned</span>;
  const name = names[assignedTo];
  const said = assignedTo === me ? "you" : (name ?? "a member of staff");
  return (
    <span className="inline-flex items-center gap-5 text-xs text-ink-3" title={`Assigned to ${said}`}>
      <span aria-hidden className="grid h-[1.3125rem] min-w-[1.3125rem] place-items-center rounded-full border border-line-strong px-3 text-[0.625rem] font-semibold text-ink">
        {name ? initialsOf(name) : "?"}
      </span>
      <span className="sr-only">Assigned to {said}</span>
    </span>
  );
}

/**
 * Tickets as a board: one column per status. The board reflects the status
 * and sets it, nothing more: a reply to the customer still moves an open
 * ticket to "Waiting for customer" by itself, in the database, when the reply
 * is written on the ticket's own page.
 */
export function TicketsBoard({ columns, writable, names, me, now }: { columns: TicketBoardColumn[]; writable: boolean; names: Record<string, string>; me: string; now: number }) {
  const data = useMemo<BoardColumnData<TicketCard>[]>(() => columns.map((c) => ({ key: c.status, label: TICKET_STATUS_LABEL[c.status], note: STATUS_NOTE[c.status], count: c.count, cards: c.cards })), [columns]);

  return (
    <Board<TicketCard>
      label="Tickets"
      columns={data}
      writable={writable}
      wide="lg"
      step={BOARD_STEP}
      max={BOARD_MAX}
      compare={compareTicketCards}
      place={(card, column) => (isStatus(column) ? { ...card, status: column } : card)}
      move={async (card, to) => (await moveTicketStatus(card.id, to)).code}
      explain={(code) => REFUSALS[code] ?? REFUSALS.save ?? ""}
      more={moreTickets}
      allHref={(status) => `/control/tickets?status=${encodeURIComponent(status)}`}
      emptyText="No tickets here."
      renderCard={(ticket) => (
        <>
          <span className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
            <Link href={`/control/tickets/${ticket.id}`} draggable={false} className="link num whitespace-nowrap text-xs font-medium">
              {ticket.reference}
            </Link>
            <TicketPriorityBadge priority={ticket.priority} />
          </span>
          <span className="mt-5 block break-words text-sm text-ink line-clamp-3">{ticket.subject}</span>
          <span className="mt-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
            <ReplyDue ticket={ticket} now={now} />
            <Assignee assignedTo={ticket.assigned_to} names={names} me={me} />
          </span>
        </>
      )}
    />
  );
}
