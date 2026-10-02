"use client";

import Link from "next/link";
import { useMemo } from "react";
import { moveLeadStage } from "@/app/control/actions-board";
import { Score } from "@/components/control/bits";
import { Board, type BoardAsk, type BoardColumnData } from "@/components/control/Board";
import { BOARD_MAX, BOARD_STEP, compareLeadCards, type BoardMoreAnswer, type LeadBoardColumn, type LeadCard } from "@/components/control/board-shared";
import { fmtDate, STAGE_NOTE } from "@/components/control/format";
import { LEAD_STAGE_LABEL, LEAD_STAGES, LOST_REASON_LABEL, LOST_REASONS } from "@/lib/server/constants";
import type { LeadStage } from "@/lib/supabase/types";

/** A refusal code from moveLeadStage as a sentence. Nothing the server or the database said is shown. */
const REFUSALS: Record<string, string> = {
  "signed-out": "Your session has ended; sign in again and repeat the move.",
  unavailable: "The console could not reach the database just now.",
  forbidden: "Your role does not allow that change.",
  reason: "A lost enquiry needs a reason.",
  invalid: "That move was not valid.",
  save: "The change could not be saved.",
  network: "The server could not be reached.",
};

const isStage = (v: string): v is LeadStage => (LEAD_STAGES as readonly string[]).includes(v);

// A lost enquiry always says why: the question is asked before anything is saved.
const ASK_LOST: BoardAsk = {
  column: "lost",
  title: (reference) => `Why was ${reference} lost?`,
  label: "Reason",
  placeholder: "Choose a reason",
  options: LOST_REASONS.map((r) => ({ value: r, label: LOST_REASON_LABEL[r] })),
  confirm: "Move to Lost",
};

async function moreLeads(stage: string, limit: number): Promise<{ count: number; cards: LeadCard[] } | null> {
  const response = await fetch(`/control/pipeline/more?stage=${encodeURIComponent(stage)}&limit=${limit}`, {
    cache: "no-store",
    credentials: "same-origin",
    redirect: "manual",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as Partial<BoardMoreAnswer<LeadCard>>;
  if (body.ok !== true || typeof body.count !== "number" || !Array.isArray(body.cards)) return null;
  return { count: body.count, cards: body.cards };
}

/**
 * The Pipeline as a board: one column per stage. The page read the columns;
 * this draws them and sends a move through moveLeadStage, the non-redirecting
 * sibling of the stage form on an enquiry's own page.
 */
export function PipelineBoard({ columns, writable, names, me }: { columns: LeadBoardColumn[]; writable: boolean; names: Record<string, string>; me: string }) {
  const data = useMemo<BoardColumnData<LeadCard>[]>(() => columns.map((c) => ({ key: c.stage, label: LEAD_STAGE_LABEL[c.stage], note: STAGE_NOTE[c.stage], count: c.count, cards: c.cards })), [columns]);
  const owner = (lead: LeadCard) => (!lead.assigned_to ? "Unassigned" : lead.assigned_to === me ? "You" : (names[lead.assigned_to] ?? "Assigned"));

  return (
    <Board<LeadCard>
      label="Pipeline"
      columns={data}
      writable={writable}
      wide="xl"
      step={BOARD_STEP}
      max={BOARD_MAX}
      compare={compareLeadCards}
      place={(card, column) => (isStage(column) ? { ...card, stage: column } : card)}
      move={async (card, to, extra) => (await moveLeadStage(card.id, to, extra)).code}
      explain={(code) => REFUSALS[code] ?? REFUSALS.save ?? ""}
      ask={ASK_LOST}
      more={moreLeads}
      allHref={(stage) => `/control/leads?stage=${encodeURIComponent(stage)}&sort=score`}
      emptyText="Nobody here."
      renderCard={(lead) => (
        <>
          {/* in a narrow column the score drops under the reference instead of leaving the card */}
          <span className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
            <Link href={`/control/leads/${lead.id}`} draggable={false} className="link num whitespace-nowrap text-xs font-medium">
              {lead.reference}
            </Link>
            <Score value={lead.score} />
          </span>
          <span className="mt-5 block truncate text-sm text-ink">{lead.name}</span>
          <span className="block truncate text-xs text-ink-3">{lead.topic}</span>
          <span className="mt-3 flex flex-wrap gap-x-8 text-xs text-ink-3">
            <span className="num">{fmtDate(lead.created_at)}</span>
            <span>{owner(lead)}</span>
          </span>
        </>
      )}
    />
  );
}
